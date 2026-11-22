#!/usr/bin/env bash
# Tes RPC bot_settings_save_batch di Postgres lokal sekali-pakai.
set -eu
pg="${PGBIN:-$(pg_config --bindir)}"
cd "$(dirname "$0")/.."
base=$(mktemp -d /tmp/cms-batch.XXXXXX)
trap '"$pg/pg_ctl" -D "$base/data" -m immediate stop >/dev/null 2>&1; rm -rf "$base"' EXIT
"$pg/initdb" -D "$base/data" -U postgres -A trust >/dev/null
"$pg/pg_ctl" -D "$base/data" -o "-k $base -c listen_addresses=''" -l "$base/log" -w start >/dev/null
psql=("$pg/psql" -X -q -v ON_ERROR_STOP=1 -h "$base" -U postgres)
"${psql[@]}" -f supabase/tests/bot-settings-batch-prereq.sql
"${psql[@]}" -f supabase/migrations/20261122120000_bot_settings_save_batch.sql
"${psql[@]}" -f supabase/tests/bot-settings-batch.test.sql
"${psql[@]}" -f supabase/bot-settings-save-batch-rollback.sql
"${psql[@]}" -f supabase/migrations/20261122120000_bot_settings_save_batch.sql
echo "OK bot_settings_save_batch"
