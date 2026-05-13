#!/bin/bash
set -euo pipefail

# Resolve absolute paths so the script works regardless of CWD.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$REPO_DIR/apps/web/dist"
WEB_ROOT="/var/www/restaurant"

cd "$REPO_DIR"

echo "==> Pulling latest changes..."
git fetch origin
git merge --ff-only origin/main

echo "==> Installing dependencies..."
npm install

echo "==> Fixing database permissions..."
chmod 664 apps/api/prisma/dev.db 2>/dev/null || true
chmod 775 apps/api/prisma/

echo "==> Generating Prisma client..."
npx prisma generate --schema=apps/api/prisma/schema.prisma

echo "==> Running database migrations..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

echo "==> Building API..."
npm run build -w @banquet/api

echo "==> Building frontend..."
npm run build -w @banquet/web

echo "==> Verifying frontend build..."
if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "ERROR: $DIST_DIR/index.html is missing. Frontend build failed."
  exit 1
fi

echo "==> Deploying frontend to $WEB_ROOT..."
mkdir -p "$WEB_ROOT"
rm -rf "$WEB_ROOT"/* "$WEB_ROOT"/.[!.]*  2>/dev/null || true
# Use ./. so dotfiles in dist/ also get copied; -v shows each file.
cp -rv "$DIST_DIR"/. "$WEB_ROOT/"

echo "==> Verifying deploy..."
if [ ! -f "$WEB_ROOT/index.html" ]; then
  echo "ERROR: $WEB_ROOT/index.html missing after copy."
  exit 1
fi
DEPLOYED_JS="$(grep -oE 'index-[A-Za-z0-9_-]+\.js' "$WEB_ROOT/index.html" | head -1 || true)"
BUILT_JS="$(grep -oE 'index-[A-Za-z0-9_-]+\.js' "$DIST_DIR/index.html" | head -1 || true)"
if [ "$DEPLOYED_JS" != "$BUILT_JS" ]; then
  echo "ERROR: deployed bundle ($DEPLOYED_JS) does not match built bundle ($BUILT_JS)."
  exit 1
fi
echo "    Bundle live: $DEPLOYED_JS"

echo "==> Restarting API..."
pm2 restart restaurant-api --update-env

echo "==> Done. Deploy complete."
