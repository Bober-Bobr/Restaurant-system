#!/bin/bash
set -euo pipefail

# Resolve absolute paths so the script works regardless of CWD.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$REPO_DIR/apps/web/dist"
WEB_ROOT="/var/www/restaurant"

cd "$REPO_DIR"

# ── Protect the server's configuration from the checkout ────────────────────
# apps/api/.env and apps/web/.env used to be TRACKED, holding the repo's
# development values. The server's real ones therefore lived one `git reset`,
# `git checkout .` or `git stash` away from being replaced by a SQLite
# DATABASE_URL and a placeholder JWT_SECRET — which is exactly what happened.
#
# They are gitignored now, so the commit that untracks them DELETES them from
# this working tree on the way past. Copy them aside first and put them back.
# The root .env holds the Postgres container's credentials (docker-compose.yml
# reads POSTGRES_USER/PASSWORD/DB from it). It is STILL tracked — .gitignore
# lists it, but that has no effect on a file already in the index — so it is
# guarded here too until it is untracked properly.
ENV_FILES=(apps/api/.env apps/web/.env .env)
declare -A ENV_BACKUP=()
for f in "${ENV_FILES[@]}"; do
  if [ -f "$REPO_DIR/$f" ]; then
    backup="$(mktemp)"
    cp "$REPO_DIR/$f" "$backup"
    ENV_BACKUP["$f"]="$backup"
    # While a file is still tracked AND locally modified, `merge --ff-only`
    # refuses to run at all ("local changes would be overwritten") — so the very
    # commit that untracks it could never be pulled. The copy above is what
    # makes discarding the modification safe; it is put back below.
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      git checkout -- "$f" 2>/dev/null || true
    fi
  fi
done

echo "==> Pulling latest changes..."
git fetch origin
git merge --ff-only origin/main

for f in "${ENV_FILES[@]}"; do
  backup="${ENV_BACKUP[$f]:-}"
  [ -n "$backup" ] || continue
  if [ ! -f "$REPO_DIR/$f" ]; then
    # mkdir because git removes a directory that the checkout leaves empty.
    mkdir -p "$(dirname "$REPO_DIR/$f")"
    cp "$backup" "$REPO_DIR/$f"
    echo "    Restored $f, which the checkout removed."
  elif ! cmp -s "$backup" "$REPO_DIR/$f"; then
    # The checkout changed a file the server owns. Keep the server's copy and
    # say so — a silent swap here is how the wrong database gets deployed.
    cp "$backup" "$REPO_DIR/$f"
    echo "    !! $f was overwritten by the checkout; the server's copy was kept."
    echo "       (It should be gitignored — check that it is not tracked.)"
  fi
  rm -f "$backup"
done

echo "==> Installing dependencies..."
npm install

# Database is PostgreSQL (Docker). Read the connection string from apps/api/.env
# so `prisma migrate deploy` and the PM2 restart below all use the same URL.
# (dotenv does NOT override an already-set env var, so exporting it here makes it
# authoritative for the pm2 --update-env restart too.)
echo "==> Loading DATABASE_URL from apps/api/.env..."
ENV_FILE="$REPO_DIR/apps/api/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE does not exist."
  echo "       The API reads its configuration from there; it is gitignored, so a"
  echo "       fresh checkout will not have one. Copy it from the running deploy."
  exit 1
fi

# Accepts the shapes a hand-edited .env actually turns up in: an `export`
# prefix, leading whitespace, single OR double quotes, and CRLF line endings
# (which leave a \r that silently corrupts the URL rather than failing loudly).
DATABASE_URL="$(sed -n -E 's/^[[:space:]]*(export[[:space:]]+)?DATABASE_URL[[:space:]]*=[[:space:]]*(.*)$/\2/p' "$ENV_FILE" | head -1)"
DATABASE_URL="${DATABASE_URL%$'\r'}"                                   # CRLF
DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"   # "..."
DATABASE_URL="${DATABASE_URL%\'}"; DATABASE_URL="${DATABASE_URL#\'}"   # '...'
export DATABASE_URL

# Prisma accepts both schemes; so does this check, because rejecting a URL the
# API itself would have connected with is a confusing way to fail.
if [[ "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ]]; then
  # Say what was actually found. The old message named the expectation but not
  # the reality, which left nothing to act on.
  echo "ERROR: DATABASE_URL in $ENV_FILE is not a postgres URL."
  if ! grep -qE '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL[[:space:]]*=' "$ENV_FILE"; then
    if grep -qE '^[[:space:]]*#.*DATABASE_URL' "$ENV_FILE"; then
      echo "       Found it, but the line is COMMENTED OUT."
    elif grep -qE '^[[:space:]]*DATABASE_URL[[:space:]]*:' "$ENV_FILE"; then
      # `pm2 env` prints KEY: value. Pasted straight into .env, dotenv ignores
      # every line silently and the API starts with no configuration at all.
      echo "       The line uses 'KEY: value' — that is pm2's display format."
      echo "       A .env file needs 'KEY=value':"
      echo "         DATABASE_URL=\"postgresql://user:password@localhost:5432/db\""
      echo "       Convert the whole file with:"
      echo "         sed -i -E 's/^([A-Za-z_][A-Za-z0-9_]*): *(.*)\$/\\1=\"\\2\"/' $ENV_FILE"
    else
      echo "       There is no DATABASE_URL line in the file at all."
    fi
  elif [ -z "$DATABASE_URL" ]; then
    echo "       The line is there but the value is empty."
  else
    # Mask the password before it reaches a terminal or a CI log.
    echo "       Found:    $(printf '%s' "$DATABASE_URL" | sed -E 's#(://[^:/@]+:)[^@]*@#\1********@#')"
    echo "       Expected: postgresql://user:password@host:5432/database"
    case "$DATABASE_URL" in
      file:*)     echo "       That is the SQLite URL from local development — this checkout is"
                  echo "       carrying a dev .env. Restore the server's own file." ;;
      mysql://*)  echo "       That is a MySQL URL; this project is PostgreSQL." ;;
      *://*)      echo "       The scheme is not one Prisma will connect to here." ;;
      *)          echo "       That does not look like a connection URL at all." ;;
    esac
  fi
  echo "       Aborting before touching the database."
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

# Tests run HERE on purpose: after `prisma generate`, because the API suite
# imports @prisma/client for its enums, and before `migrate deploy`, which is
# the first step of this script that changes something we cannot take back.
# A failure now costs a deploy; a failure after the migration costs a restore.
#
# SKIP_TESTS=1 ./deploy.sh exists for a rollback during an incident, when the
# priority is getting the previous release back up. It announces itself.
if [ "${SKIP_TESTS:-0}" = "1" ]; then
  echo "==> !! SKIPPING TESTS (SKIP_TESTS=1) — deploying unverified code."
else
  echo "==> Running unit tests..."
  if [ ! -x "$REPO_DIR/node_modules/.bin/vitest" ]; then
    echo "ERROR: vitest is not installed, so the tests cannot run."
    echo "       This usually means dev dependencies were omitted (NODE_ENV=production"
    echo "       or a previous 'npm install --omit=dev'). Fix with:"
    echo "         npm install --include=dev"
    echo "       To deploy anyway during an incident: SKIP_TESTS=1 ./deploy.sh"
    exit 1
  fi
  # `npm test` runs both projects (api + web). set -e aborts the deploy on the
  # first failing test, before the database or the live bundle is touched.
  #
  # VMENU_DEPLOY=1 turns on the strict half of `config/envFile.test.ts`, which
  # reads apps/api/.env and refuses a deploy when it is the repository's own
  # development copy — the state a `git stash` on the server leaves behind, and
  # the one that silently cost us the database URL, the signing secret and both
  # Telegram bot tokens. A developer's machine is meant to hold those dev
  # values, so the strict rules only ever apply here.
  VMENU_DEPLOY=1 npm test
fi

echo "==> Running database migrations..."
"$REPO_DIR/apps/api/node_modules/.bin/prisma" migrate deploy --schema=apps/api/prisma/schema.prisma

echo "==> Building API..."
npm run build -w @banquet/api

echo "==> Clearing Vite build cache..."
rm -rf apps/web/node_modules/.vite apps/web/dist

# Purge compiled .js shadows left beside the .tsx sources by older builds.
# Vite resolves .js BEFORE .tsx, so a stale sibling silently shadows real source
# and the build quietly produces the previous release. tsconfig.json now sets
# "noEmit": true so nothing new is emitted, but these files are gitignored —
# a checkout can never remove the ones an earlier build already wrote.
# Guarded: only delete a .js that still has a .ts/.tsx sibling, so a
# hand-written .js under src/ would be left alone.
echo "==> Purging stale compiled .js shadows in apps/web/src..."
find apps/web/src -name '*.js' -print0 | while IFS= read -r -d '' f; do
  base="${f%.js}"
  if [ -f "$base.ts" ] || [ -f "$base.tsx" ]; then rm -f "$f"; fi
done

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
