#!/usr/bin/env bash
# Daily backup of the v-menu.uz database, uploads, and secrets,
# with an off-server copy pushed to a cloud remote via rclone.
# Keeps the last 14 days locally AND on the remote. Safe to run while live.
set -euo pipefail

APP_DIR="$HOME/Restaurant-system/apps/api"
DEST="$HOME/backups"
KEEP_DAYS=14
STAMP="$(date +%F-%H%M)"

# rclone remote to push to. Create it once with: rclone config
# Format is "<remote-name>:<path>", e.g. "gdrive:vmenu-backups" or "s3:my-bucket/vmenu".
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:vmenu-backups}"

mkdir -p "$DEST"

# 1. Consistent SQLite snapshot (never plain-cp a live DB).
sqlite3 "$APP_DIR/prisma/dev.db" ".backup '$DEST/dev-$STAMP.db'"
gzip -f "$DEST/dev-$STAMP.db"

# 2. Uploaded files + env secrets.
tar czf "$DEST/files-$STAMP.tar.gz" \
  -C "$APP_DIR" uploads .env \
  -C "$APP_DIR/../web" .env

# 3. Push today's two artifacts to the cloud remote.
rclone copy "$DEST/dev-$STAMP.db.gz"    "$RCLONE_REMOTE/" --log-level INFO
rclone copy "$DEST/files-$STAMP.tar.gz" "$RCLONE_REMOTE/" --log-level INFO

# 4. Prune old backups locally...
find "$DEST" -name 'dev-*.db.gz'    -mtime +$KEEP_DAYS -delete
find "$DEST" -name 'files-*.tar.gz' -mtime +$KEEP_DAYS -delete

# 5. ...and on the remote (rclone's own age filter).
rclone delete "$RCLONE_REMOTE/" --min-age "${KEEP_DAYS}d" --include 'dev-*.db.gz'
rclone delete "$RCLONE_REMOTE/" --min-age "${KEEP_DAYS}d" --include 'files-*.tar.gz'

echo "Backup done: local $DEST + remote $RCLONE_REMOTE (dev-$STAMP.db.gz, files-$STAMP.tar.gz)"
