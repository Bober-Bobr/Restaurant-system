#!/bin/bash
set -e

echo "==> Pulling latest changes..."
git pull

echo "==> Installing dependencies..."
npm install

echo "==> Generating Prisma client..."
npx prisma generate --schema=apps/api/prisma/schema.prisma

echo "==> Building API..."
npm run build -w @banquet/api

echo "==> Building frontend..."
npm run build -w @banquet/web

echo "==> Deploying frontend to /var/www/restaurant..."
cp -r apps/web/dist/* /var/www/restaurant/

echo "==> Restarting API..."
pm2 restart restaurant-api

echo "==> Done. Deploy complete."
