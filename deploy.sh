#!/bin/bash
set -e

echo "==> Pulling latest changes..."
git stash
git pull --rebase
git stash pop 2>/dev/null || true

echo "==> Installing dependencies..."
npm install

echo "==> Fixing database permissions..."
chmod 664 apps/api/prisma/dev.db 2>/dev/null || true
chmod 775 apps/api/prisma/

echo "==> Generating Prisma client..."
npx prisma generate --schema=apps/api/prisma/schema.prisma

echo "==> Building API..."
npm run build -w @banquet/api

echo "==> Building frontend..."
npm run build -w @banquet/web

echo "==> Deploying frontend to /var/www/restaurant..."
rm -rf /var/www/restaurant/*
cp -r apps/web/dist/* /var/www/restaurant/

echo "==> Restarting API..."
pm2 restart restaurant-api --update-env

echo "==> Done. Deploy complete."
