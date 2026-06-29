#!/usr/bin/env bash
# Daily backup of the v-menu.uz database, uploads, and secrets.
# Keeps the last 14 days; safe to run while the app is live.
#
# The database runs in the Docker container "vmenu-postgres" (see
# docker-compose.yml). We dump it with pg_dump inside that container, so no
# postgres client needs to be installed on the host.
set -euo pipefail

APP_DIR="$HOME/Restaurant-system/apps/api"
DEST="$HOME/backups"
KEEP_DAYS=14
STAMP="$(date +%F-%H%M)"

# Must match docker-compose.yml / the root .env used by compose.
PG_CONTAINER="${PG_CONTAINER:-vmenu-postgres}"
PG_USER="${POSTGRES_USER:-vmenu}"
PG_DB="${POSTGRES_DB:-vmenu}"

mkdir -p "$DEST"

# 1. Consistent SQL dump of Postgres (compressed custom format -Fc, restorable
#    with pg_restore). Safe to run while the app is live.
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc \
  > "$DEST/db-$STAMP.dump"

# 2. Uploaded files + env secrets.
tar czf "$DEST/files-$STAMP.tar.gz" \
  -C "$APP_DIR" uploads .env \
  -C "$APP_DIR/../web" .env

# 3. Prune anything older than KEEP_DAYS.
find "$DEST" -name 'db-*.dump'      -mtime +$KEEP_DAYS -delete
find "$DEST" -name 'files-*.tar.gz' -mtime +$KEEP_DAYS -delete

echo "Backup done: $DEST (db-$STAMP.dump, files-$STAMP.tar.gz)"
