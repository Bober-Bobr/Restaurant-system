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

# Database is PostgreSQL (Docker). Read the connection string from apps/api/.env
# so `prisma migrate deploy` and the PM2 restart below all use the same URL.
# (dotenv does NOT override an already-set env var, so exporting it here makes it
# authoritative for the pm2 --update-env restart too.)
echo "==> Loading DATABASE_URL from apps/api/.env..."
DATABASE_URL="$(grep -E '^DATABASE_URL=' apps/api/.env | head -1 | cut -d= -f2-)"
DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"   # strip optional surrounding quotes
export DATABASE_URL
if [[ "$DATABASE_URL" != postgresql://* ]]; then
  echo "ERROR: DATABASE_URL in apps/api/.env is not a postgresql:// URL."
  echo "       Aborting before touching the database. Check apps/api/.env."
  exit 1
fi

echo "==> Ensuring PostgreSQL container is running..."
docker compose up -d postgres
# Wait until Postgres accepts connections before running migrations.
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -q; then break; fi
  [ "$i" -eq 30 ] && { echo "ERROR: PostgreSQL did not become ready in time."; exit 1; }
  sleep 1
done

echo "==> Generating Prisma client..."
"$REPO_DIR/apps/api/node_modules/.bin/prisma" generate --schema=apps/api/prisma/schema.prisma

echo "==> Running database migrations..."
"$REPO_DIR/apps/api/node_modules/.bin/prisma" migrate deploy --schema=apps/api/prisma/schema.prisma

echo "==> Building API..."
npm run build -w @banquet/api

echo "==> Clearing Vite build cache..."
rm -rf apps/web/node_modules/.vite apps/web/dist

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
