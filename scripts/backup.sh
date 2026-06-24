#!/usr/bin/env bash
# Daily backup of the v-menu.uz database, uploads, and secrets.
# Keeps the last 14 days; safe to run while the app is live.
set -euo pipefail

APP_DIR="$HOME/Restaurant-system/apps/api"
DEST="$HOME/backups"
KEEP_DAYS=14
STAMP="$(date +%F-%H%M)"

mkdir -p "$DEST"

# 1. Consistent SQLite snapshot (never plain-cp a live DB).
sqlite3 "$APP_DIR/prisma/dev.db" ".backup '$DEST/dev-$STAMP.db'"
gzip -f "$DEST/dev-$STAMP.db"

# 2. Uploaded files + env secrets.
tar czf "$DEST/files-$STAMP.tar.gz" \
  -C "$APP_DIR" uploads .env \
  -C "$APP_DIR/../web" .env

# 3. Prune anything older than KEEP_DAYS.
find "$DEST" -name 'dev-*.db.gz'   -mtime +$KEEP_DAYS -delete
find "$DEST" -name 'files-*.tar.gz' -mtime +$KEEP_DAYS -delete

echo "Backup done: $DEST (dev-$STAMP.db.gz, files-$STAMP.tar.gz)"
