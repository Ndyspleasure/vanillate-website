#!/usr/bin/env bash
# Requires DATABASE_URL supplied as an environment secret; never logged.
set -euo pipefail
umask 077
: "${DATABASE_URL:?Set DATABASE_URL as an environment secret}"
: "${CMS_BACKUP_DIR:?Set CMS_BACKUP_DIR to a private directory outside the repository}"
pg="${PGBIN:-$(pg_config --bindir)}"
mkdir -p "$CMS_BACKUP_DIR"
out="$CMS_BACKUP_DIR/cms-$(date -u +%Y%m%dT%H%M%SZ).dump"
# Credentials are inherited by libpq, not included in command arguments.
PGDATABASE="$DATABASE_URL" "$pg/pg_dump" --format=custom --no-owner --no-privileges --file="$out"
"$pg/pg_restore" --list "$out" > "$out.manifest"
sha256sum "$out" > "$out.sha256"
printf 'Backup archive created: %s\nRestore into an isolated database and verify before applying production migrations.\n' "$out"
