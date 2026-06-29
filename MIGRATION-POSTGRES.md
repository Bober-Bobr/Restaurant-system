# SQLite → PostgreSQL migration runbook

The app now uses **PostgreSQL** (running in Docker) instead of SQLite. This
guide has two parts: **A) your local machine** (do this first, to confirm
everything works) and **B) the production server** (the real cutover).

The old SQLite `dev.db` is only ever **read** during the data copy, never
modified — so a rollback is always possible.

---

## What changed in the code

| File | Change |
|---|---|
| `docker-compose.yml` | New — Postgres 16, bound to `127.0.0.1:5432` only |
| `.env.docker.example` | New — template for the Postgres password |
| `apps/api/prisma/schema.prisma` | `provider` is now `postgresql` |
| `apps/api/prisma/schema.sqlite.prisma` | New — read-only source schema for the data copy |
| `apps/api/prisma/migrations/0_init/` | New — single Postgres baseline migration |
| `apps/api/prisma/migrations.sqlite-archive/` | Old SQLite migrations, kept for reference (not run) |
| `apps/api/src/scripts/migrate-to-postgres.ts` | New — copies all rows SQLite → Postgres |
| `scripts/backup*.sh` | Now dump Postgres via `pg_dump` instead of `sqlite3` |

---

## A) Local machine (dry run)

```bash
cd ~/.../Restaurant-system            # repo root

# 1. Install the docker compose plugin if `docker compose version` fails:
sudo apt install -y docker-compose-plugin

# 2. Create the Postgres password file (root of the repo):
cp .env.docker.example .env
#   edit .env and set POSTGRES_PASSWORD to anything for local use

# 3. Start Postgres:
docker compose up -d postgres
docker compose ps                     # wait until "healthy"

# 4. Point the API at Postgres. Edit apps/api/.env:
#      DATABASE_URL=postgresql://vmenu:<your-password>@localhost:5432/vmenu
#      SQLITE_URL=file:./prisma/dev.db        # add this line (old DB to read)

# 5. Create the tables + generate the client:
cd apps/api
npx prisma migrate deploy             # applies 0_init to Postgres
npx prisma generate

# 6. Copy existing SQLite data into Postgres:
cd ../..
npm run migrate:to-postgres --workspace=apps/api
#   prints a row count per table; should finish with "Done."

# 7. Run the app and confirm your data is there:
npm run dev
```

If the app shows your restaurants/events/menu correctly, the local dry run
passed and you can do the server.

---

## B) Production server (the real cutover)

> Do this during a quiet period. Total downtime is only steps 6–9 (a few minutes).

### 1. Safety backup of the CURRENT SQLite data (before anything)

```bash
cd ~/Restaurant-system/apps/api
mkdir -p ~/backups
cp prisma/dev.db ~/backups/dev-PRE-PG-$(date +%F-%H%M).db
tar czf ~/backups/uploads-PRE-PG-$(date +%F-%H%M).tar.gz uploads
```

### 2. Get the new code + Docker compose plugin

```bash
cd ~/Restaurant-system
git pull                                  # or your usual deploy
sudo apt install -y docker-compose-plugin # if `docker compose version` fails
```

### 3. Start Postgres in Docker

```bash
cp .env.docker.example .env
nano .env          # set a STRONG POSTGRES_PASSWORD, keep POSTGRES_USER/DB=vmenu
docker compose up -d postgres
docker compose ps  # wait for "healthy"
```

### 4. Point the API at Postgres

Edit `apps/api/.env`:

```
DATABASE_URL=postgresql://vmenu:<the-strong-password>@localhost:5432/vmenu
SQLITE_URL=file:./prisma/dev.db
```

(Leave `JWT_SECRET` and everything else unchanged.)

### 5. Create the Postgres tables

```bash
cd ~/Restaurant-system/apps/api
npx prisma migrate deploy
npx prisma generate
```

### 6. Stop the app (begin downtime)

```bash
pm2 stop all          # or: systemctl stop <your-service>
```

### 7. Copy the data SQLite → Postgres

```bash
cd ~/Restaurant-system
npm run migrate:to-postgres --workspace=apps/api
```

Check the printed counts look right (restaurants, events, menu items, users…).

### 8. Rebuild with the new code

```bash
npm run build
```

### 9. Start the app (end downtime)

```bash
pm2 start all         # or: systemctl start <your-service>
pm2 logs --lines 50   # confirm it boots with no DB errors
```

Open the site and verify everything loads. **Done.**

### 10. Switch the backups over

The backup scripts now dump Postgres. Test once:

```bash
~/Restaurant-system/scripts/backup-rclone.sh
ls -la ~/backups        # expect a fresh db-*.dump
```

Your existing cron line keeps working — only the produced file changed from
`dev-*.db.gz` to `db-*.dump`.

---

## Rollback (if step 9 misbehaves)

The SQLite DB was never touched, so:

```bash
pm2 stop all
# revert apps/api/.env DATABASE_URL back to: file:./prisma/dev.db
git checkout <previous-commit>      # old code that uses sqlite
npm run build
pm2 start all
```

You're back on SQLite with zero data loss. Investigate, then retry the cutover.

---

## Restoring a Postgres backup (`db-*.dump`)

```bash
# Copy the dump into the container and restore it:
docker cp ~/backups/db-2026-06-26-0330.dump vmenu-postgres:/tmp/restore.dump
docker exec vmenu-postgres pg_restore -U vmenu -d vmenu --clean --if-exists /tmp/restore.dump
```

Uploads + env restore exactly as before (untar `files-*.tar.gz`).

---

## Notes

- Postgres data lives in the Docker volume `vmenu-pgdata` — it survives
  container restarts and `docker compose down`. Only `docker compose down -v`
  deletes it (don't).
- Once you're confident on Postgres, the SQLite `dev.db`, the
  `migrations.sqlite-archive/` folder, `schema.sqlite.prisma`, and the
  `migrate-to-postgres.ts` script can be deleted. No rush.
