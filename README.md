# Banquet Management System

A full-stack monorepo for managing restaurant banquet events, menus, halls, and table categories.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Node.js, Express 5, Prisma, SQLite, Zod, JWT |
| Frontend | React, Vite, React Query, Zustand, Tailwind CSS |
| Export | PDFKit, ExcelJS |
| Runtime | Node.js >=20 |

## Project Structure

```
Restaurant-system/
├── apps/
│   ├── api/          # Express REST API (port 4000)
│   └── web/          # React frontend (port 5173)
└── package.json      # npm workspaces root
```

## Local Development

### Prerequisites

- Node.js **>=20** and npm >=10

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

**API** — copy and edit:
```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:
```env
DATABASE_URL="file:./dev.db"
PORT=4000
JWT_SECRET="your-random-secret-at-least-32-chars"
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Frontend** — copy and edit:
```bash
cp apps/web/.env.example apps/web/.env
```

`apps/web/.env` defaults are fine for local development:
```env
VITE_API_URL="http://localhost:4000/api"
```

### 3. Set up the database

```bash
npm run prisma:generate -w @banquet/api
npm run prisma:migrate -w @banquet/api
```

### 4. Start development servers

```bash
npm run dev
```

- API: http://localhost:4000
- Frontend: http://localhost:5173

The first admin account can be registered from the login page. Subsequent registrations require setting `ALLOW_OPEN_ADMIN_REGISTRATION=true` in the API `.env`.

---

## Production Deployment (Debian/Ubuntu)

### Prerequisites

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx

# Install tsx and pm2 globally
npm install -g tsx pm2
```

### 1. Clone and install

```bash
git clone <repo-url> /root/Restaurant-system
cd /root/Restaurant-system
npm install
```

### 2. Configure environment

**API** — create `/root/Restaurant-system/apps/api/.env`:
```env
DATABASE_URL="file:./dev.db"
PORT=4000
JWT_SECRET="<generated-secret>"
```

**Frontend** — create `/root/Restaurant-system/apps/web/.env`:
```env
VITE_API_URL="https://your-domain.com/api"
```

### 3. Run database migrations

```bash
cd /root/Restaurant-system/apps/api
npx prisma generate
npx prisma migrate deploy
chmod 664 prisma/dev.db
chmod 775 prisma/
```

### 4. Build

```bash
cd /root/Restaurant-system
npm run build -w @banquet/web
```

### 5. Start the API with PM2

```bash
cd /root/Restaurant-system/apps/api
pm2 start /usr/local/bin/tsx --name "restaurant-api" -- src/server.ts
pm2 save
pm2 startup   # run the printed command to enable auto-start
```

### 6. Deploy frontend to Nginx

```bash
mkdir -p /var/www/restaurant
cp -r /root/Restaurant-system/apps/web/dist/* /var/www/restaurant/
```

Create `/etc/nginx/sites-available/restaurant`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/restaurant;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        alias /root/Restaurant-system/apps/api/uploads/;
        add_header Cross-Origin-Resource-Policy cross-origin;
        add_header Access-Control-Allow-Origin *;
        expires 1y;
    }
}
```

Enable it:
```bash
ln -s /etc/nginx/sites-available/restaurant /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

### 7. (Optional) Enable HTTPS with Let's Encrypt

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Redeployment

When updating the project:
```bash
cd /root/Restaurant-system
npm install
npx prisma migrate deploy --prefix apps/api   # if schema changed
npm run build -w @banquet/web
cp -r apps/web/dist/* /var/www/restaurant/
pm2 restart restaurant-api
```

---

## Environment Variables Reference

### `apps/api/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path, e.g. `file:./dev.db` |
| `PORT` | No | API port (default: `4000`) |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens (min 32 chars) |
| `ALLOW_OPEN_ADMIN_REGISTRATION` | No | Set `true` to allow registering more admins |

### `apps/web/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Full URL to the API, e.g. `https://domain.com/api` |

---

## Admin Roles

| Role | Permissions |
|------|-------------|
| `OWNER` | Full access — manages restaurants, users, and all data |
| `ADMIN` | Manages events, menu, halls, and table categories for their restaurant |
| `EMPLOYEE` | Read and limited write access |
