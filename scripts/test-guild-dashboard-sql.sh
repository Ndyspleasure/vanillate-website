#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Tes skema Vanillate Dashboard di Postgres lokal sekali-pakai.
#
#    bash scripts/test-guild-dashboard-sql.sh      (atau: npm run test:sql)
#
#  Butuh binary PostgreSQL (initdb, pg_ctl, psql) — sudah ada di runner
#  ubuntu-latest GitHub Actions. Cluster dibuat di direktori sementara, dengan
#  socket Unix (tanpa port TCP), lalu dihapus setelah selesai.
#  Urutan: supabase-stub.sql → guild-dashboard-schema.sql (dua kali, untuk
#  membuktikan idempoten) → guild-dashboard.test.sql.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PGBIN="${PGBIN:-}"
if [ -z "$PGBIN" ]; then
  if command -v pg_config >/dev/null 2>&1 && [ -x "$(pg_config --bindir)/initdb" ]; then
    PGBIN="$(pg_config --bindir)"
  else
    PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
  fi
fi
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "✗ initdb tidak ditemukan. Pasang PostgreSQL atau set PGBIN." >&2
  exit 1
fi

TMP="$(mktemp -d)"
chmod 777 "$TMP"

# initdb menolak jalan sebagai root → pakai user postgres bila perlu.
run() {
  if [ "$(id -u)" = "0" ]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

cleanup() {
  run "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

run "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
run "$PGBIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null

PSQL=("$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$TMP" -U postgres -d postgres)

for f in supabase/tests/supabase-stub.sql supabase/guild-dashboard-schema.sql supabase/guild-dashboard-schema.sql; do
  PGOPTIONS="-c client_min_messages=warning" run "${PSQL[@]}" -f "$ROOT/$f" >/dev/null
done

run "${PSQL[@]}" -t -f "$ROOT/supabase/tests/guild-dashboard.test.sql" 2>&1 | grep -E "NOTICE|ERROR|GAGAL|LULUS|CONTEXT" | sed -E "s/^psql:[^ ]+ (NOTICE|ERROR): +/  /"
echo "✓ Tes SQL guild dashboard lulus."
