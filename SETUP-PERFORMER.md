# Setting up `performer.v-menu.uz`

The performer workspace: profile (avatar, photos, videos), calendar, booking
inbox and devices. Used by `PERFORMER` accounts, who belong to no restaurant.

It is served by the **same SPA build and the same API** as every other host —
there is no separate app to deploy. Only three things are genuinely new: a DNS
record, an nginx server block, and a TLS SAN.

Run everything as `root` on the production server unless stated otherwise.
Paths assume the repo is at `/root/Restaurant-system`; adjust if yours differs.

**Order matters.** DNS first (it propagates slowly), then nginx on port 80, then
deploy, then TLS. Certbot in step 4 needs steps 1–2 already working, because it
validates over HTTP.

---

## Step 0 — Preflight

Five checks, ~1 minute. Each one prevents a confusing failure later.

**0.1 — You are on the right machine and the repo is clean**

```bash
cd /root/Restaurant-system
git status --short          # expect empty; local edits will block the ff-only pull
git log --oneline -1
```

A dirty tree makes `deploy.sh` fail at `git merge --ff-only`. Commit, stash or
discard first.

**0.2 — The API is currently healthy**

```bash
pm2 list | grep restaurant-api        # expect "online"
curl -s localhost:4000/api/health
```

Establish that it works *before* you change anything. If it is already broken,
fix that first — otherwise you will blame this feature.

**0.3 — Postgres is up**

```bash
docker compose exec -T postgres pg_isready
```

**0.4 — Note your current certificate names**

```bash
certbot certificates
```

Copy the `Domains:` line somewhere. You need it verbatim in step 4, and getting
it wrong silently drops hosts from the cert.

**0.5 — Confirm the two migrations are present in the checkout**

```bash
ls apps/api/prisma/migrations | grep -E 'performer|performers'
```

Expect both:

| Migration | What it does |
|---|---|
| `20260730170000_admin_role_performer` | adds `PERFORMER` to the `AdminRole` enum |
| `20260730180000_performers` | creates `PerformerProfile`, `PerformerBooking`, `PerformerEvent`; drops the unused `InviteRequest.performers` column |

They are split because PostgreSQL will not let a newly added enum value be
*used* in the same transaction that adds it, and Prisma wraps each migration in
one. **Do not merge them.**

---

## Step 1 — DNS

**1.1 — Find the IP the other hosts use**

```bash
dig +short rmanager.v-menu.uz
```

Use exactly that address. Do not assume — if the server sits behind a proxy or
has multiple interfaces, guessing gets you a host that resolves nowhere.

**1.2 — Add the record**

In the AIRNET control panel for `v-menu.uz`:

| Field | Value |
|---|---|
| Type | `A` |
| Name / Host | `performer` |
| Value | the IP from 1.1 |
| TTL | 3600 (or the panel default) |

No wildcard is involved. The .uz registrar rejects wildcard DNS, which is why
every host in this system is a named record.

**1.3 — Verify at the authoritative server first**

```bash
dig +short performer.v-menu.uz @8.8.8.8
```

This is the real check — it bypasses every cache between you and the zone.
Retry for a few minutes if empty.

**1.4 — Then verify from where you will actually browse**

```bash
dig +short performer.v-menu.uz
```

> **If 1.3 answers but 1.4 does not**, your router or ISP resolver has cached
> the old NXDOMAIN. Nothing is wrong with the server. This zone's SOA `minimum`
> is 86400, so a cached miss is held for up to 24 hours. Options: wait, flush
> the local resolver, or test from mobile data. This is exactly what happened
> with `nfc.v-connect.uz`.
>
> Asking AIRNET to lower the SOA `minimum` to 3600 makes future hosts appear
> within an hour instead of a day.

---

## Step 2 — nginx

**2.1 — Understand where API traffic actually goes**

`apps/web/.env` sets `VITE_API_URL="https://api.v-menu.uz/api"` — an **absolute
origin**, baked into the bundle at build time. Every API call from every host
goes to `api.v-menu.uz`, cross-origin, whatever hostname served the page. Uploads
follow the same route: `getPhotoUrl()` strips the trailing `/api` and prefixes the
result to every stored `/uploads/...` path.

So `performer.v-menu.uz` needs **no `/api/` proxy and no `/uploads/` alias**. It
serves static files and nothing else. If older blocks on your server contain
those sections, they are dead config — harmless, but misleading when debugging.

**2.2 — Create the server block**

`/etc/nginx/sites-available/performer.v-menu.uz`:

```nginx
server {
    listen 80;
    server_name performer.v-menu.uz;

    root /var/www/restaurant;
    index index.html;

    # /profile, /calendar, /bookings and /devices are client-side routes.
    # Without this, reloading on any of them returns a 404 from nginx.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

That is the whole block — deliberately the same shape as `rmanager.v-menu.uz`.
There is no path slug here, because a performer is identified by their token
rather than by a restaurant.

**2.3 — Enable and reload**

```bash
ln -s /etc/nginx/sites-available/performer.v-menu.uz /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

`nginx -t` must print `syntax is ok` **and** `test is successful`. Never reload
on a failed test — a broken config takes down every host, not just this one.

**2.4 — Raise the upload limit on `api.v-menu.uz` (not here)**

This is the step that is easy to get wrong, because the change belongs to a
different host than the one you are setting up.

Performers upload video showreels. The API accepts 60 MB per file; nginx defaults
to **1 MB** and rejects oversized requests itself — Express never sees them,
nothing appears in the API log, and the browser gets a bare `413`. Photos keep
working, so it presents as "videos are broken".

Check whether a limit is already set globally:

```bash
grep -rn client_max_body_size /etc/nginx/
```

If nothing is set, or it is below 64M, add to the **`api.v-menu.uz`** server
block:

```nginx
    client_max_body_size 64M;          # at server level

    location / {
        proxy_pass http://localhost:4000/;
        # ... existing proxy_set_header lines ...
        proxy_read_timeout 300s;       # a 60 MB upload outlasts the 60s default
        proxy_send_timeout 300s;
        proxy_request_buffering off;   # stream through instead of spooling first
    }
```

Then `nginx -t && systemctl reload nginx`.

The full annotated block is in
[DEPLOY-CHECKLIST.md § Nginx configuration](DEPLOY-CHECKLIST.md#nginx-configuration).

**2.5 — Smoke test over plain HTTP**

```bash
curl -sI http://performer.v-menu.uz/ | head -1    # expect 200
```

The app will redirect to login at this point, which is correct — the new build is
not deployed until step 3.

---

## Step 3 — Deploy the code

**3.1 — Run the deploy**

```bash
cd /root/Restaurant-system
./deploy.sh
```

It pulls, `npm install`s, loads `DATABASE_URL` from `apps/api/.env`, ensures
Postgres is up, runs `prisma generate` and **`prisma migrate deploy`**, builds
API then web, copies `dist` to `/var/www/restaurant`, verifies the deployed
bundle hash matches the built one, and restarts `restaurant-api`.

**No env var changes are needed.** Host detection derives `performer.v-menu.uz`
from `VITE_ROOT_DOMAIN` (default `v-menu.uz`), so nothing new is baked into the
build. You do **not** need to edit `apps/web/.env`.

**3.2 — Watch for the migration lines**

In the output, under `==> Running database migrations...`, both migration names
should appear as applied. If it says `No pending migrations`, they were already
applied — fine. If it **errors**, stop here; do not continue to step 4.

**3.3 — Verify the tables exist**

The Postgres user and database name come from the compose environment and can be
overridden, so read them from inside the container rather than hardcoding:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"' | grep -i performer
```

Expect three rows: `PerformerProfile`, `PerformerBooking`, `PerformerEvent`.

**3.4 — Verify the enum value exists**

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT unnest(enum_range(NULL::\"AdminRole\"))"' \
  | grep PERFORMER
```

If this is empty, the enum migration did not run, and creating a performer in
step 5 will fail with a database error. Re-check 3.2.

**3.5 — Confirm the new bundle is actually live**

`deploy.sh` already fails loudly if the copy did not take, but to see it:

```bash
grep -oE 'index-[A-Za-z0-9_-]+\.js' /var/www/restaurant/index.html
```

Note the hash. If step 6a loops, compare it against what the browser loads —
a mismatch means a stale cache, not a bug.

---

## Step 4 — TLS

**4.1 — Reissue the certificate including the new name**

Take the `Domains:` list from step 0.4 and append `performer.v-menu.uz`. All in
one command:

```bash
certbot --nginx \
  -d v-menu.uz -d www.v-menu.uz \
  -d admin.v-menu.uz -d manager.v-menu.uz -d cabinet.v-menu.uz \
  -d rmanager.v-menu.uz -d banquet.v-menu.uz -d food-admin.v-menu.uz \
  -d event.v-menu.uz \
  -d performer.v-menu.uz
```

> The names above are the expected set for this system, but **your server is the
> authority** — use what `certbot certificates` printed. Omitting a name that is
> currently covered issues a cert without it, and that host starts failing TLS
> immediately.

**4.2 — Confirm the SAN list**

```bash
certbot certificates | grep -A1 Domains
```

`performer.v-menu.uz` should be there, alongside everything that was there
before.

**4.3 — Confirm HTTPS serves**

```bash
curl -sI https://performer.v-menu.uz/ | head -1       # expect 200
```

**4.4 — Confirm certbot rewrote the block**

The `--nginx` plugin edits your file in place, adding `listen 443 ssl` and the
cert paths. Re-test and reload:

```bash
nginx -t && systemctl reload nginx
```

---

## Step 5 — Create the first performer account

There is no seeded performer, and there should not be — unlike `nfc_maker`,
these are real people's accounts.

**5.1 — Sign in as someone who can create them**

| Role | Where | Page |
|---|---|---|
| `CHIEF_ADMIN` | `admin.v-menu.uz` | Users tab |
| `OWNER` | `cabinet.v-menu.uz` | users |
| `ADMIN` | `banquet.v-menu.uz/<slug>` | `/admin/users` |

`CATERING_ADMIN` deliberately **cannot** create performers. That is enforced
server-side, not merely hidden in the UI.

**5.2 — Create the account**

Choose role **Performer**, set a username and a password, save.

**5.3 — Confirm it has no restaurant**

The account is created with `restaurantId = null` on purpose. A performer is not
staff of the venue that signed them up — they are platform-wide and bookable by
anyone. The server forces this regardless of who creates them, so you cannot get
it wrong from the UI, but it is worth understanding why the account shows no
restaurant in the list.

**5.4 — Hand over the credentials**

Tell the performer to sign in at **`https://v-menu.uz/login`**, not at
`performer.v-menu.uz`. Sign-in is on the root domain for every role.

---

## Step 6 — Walk the flow end to end

Do all six sub-steps. The last one is the only real proof.

### 6a — The performer signs in

1. Open **`https://v-menu.uz/login`**.
2. Enter the credentials from 5.2.
3. You should land on `https://performer.v-menu.uz/profile`.

> **If you loop back to the login page**, the token is not crossing the origin
> boundary. Auth lives in `localStorage`, which is per-origin, so the login page
> passes it to the subdomain as `_at` / `_rt` / `_u` / `_r` query params, which
> the app consumes and immediately strips from the address bar. Seeing them
> flash is normal. A loop means the browser is running a build from before this
> feature — compare the bundle hash against 3.5 and hard-reload.

### 6b — Fill in the profile

On `/profile`:

1. Upload an **avatar**.
2. Add two or three **photos**.
3. Add one **video** — this exercises the 64 MB nginx limit from 2.4.
4. Set the **stage name** and **craft** (e.g. "DJ").
5. Leave **"Show me in the performers list"** ON, or they will not appear in 6d.
6. Press **Save**.

Nothing is persisted until Save. Uploads attach to the draft first, so a
half-filled form leaves no trace.

### 6c — Add a calendar entry by hand

On `/calendar` → **Add event**. Set a date, time, name and note, then Save.

**Write down that date — call it D.** You need it twice below.

### 6d — Browse and book as a guest

Open the Additional Services page. Either entry point works:

- a restaurant with `moduleBanquet` **off** → `https://banquet.v-menu.uz/<slug>`
- or the tablet Summary page after confirming a booking, when `moduleAddons` is on

Scroll past Invitations to **Performers**:

1. Set the date picker to **D** → your performer reads **Busy**.
2. Change it to any other date → they read **Available**.
3. **View profile** → the photos and video from 6b play.
4. Enter a name and phone, then **Send booking request**.

The performer's own phone is never shown here. Guests reach a performer through
a request, not by calling them.

### 6e — Accept the request

Back on `performer.v-menu.uz`:

1. **Notifications** carries a badge with the pending count. It refreshes every
   60 seconds, so reload if you are impatient.
2. Open it — the request shows restaurant, date, time and contact.
3. Press **Accept**.

### 6f — Confirm the loop closed *(the real test)*

1. Go to **Calendar** — a new entry has appeared, tagged **From a booking**.
2. Return to the Additional Services performers list and set the date to the one
   you just booked → the performer now reads **Busy**.

That is the assertion that matters. Availability means "has a calendar entry
that day", and accepting a booking is what creates the entry — one source of
truth, so a performer can never show as free for a date they already agreed to.
Both writes happen in a single transaction.

If 6f shows **Available**, the accept did not create the event. Check the API
log (`pm2 logs restaurant-api`) for a transaction error.

---

## Troubleshooting

| Symptom | Cause | Step |
|---|---|---|
| Login loops back to `/login` | Browser running a pre-feature build | 3.5, 6a |
| `performer.v-menu.uz` shows the wrong app | Block missing or not enabled | 2.3 |
| 404 on refresh at `/calendar` | SPA fallback missing | 2.2 |
| Video upload fails with 413 | `client_max_body_size` missing on the **`api.v-menu.uz`** block | 2.4 |
| Photos upload but render broken | `/uploads/` alias wrong on the **`api.v-menu.uz`** block — must point at `apps/api/uploads/` | 2.4 |
| Performer missing from the guest list | Visibility switch off, or profile never saved | 6b |
| Everyone shows "Available" regardless of date | No date chosen. Availability is per-date; with no date the field is deliberately absent rather than defaulting to free | 6d |
| "Performer" not offered as a role | Enum migration did not run | 3.4 |
| Accepting does not create a calendar entry | Transaction failed — check `pm2 logs restaurant-api` | 6f |
| Other hosts break after certbot | A name was dropped from the SAN list | 4.1 |
| Availability off by one day near midnight | Should not happen — dates are parsed at UTC midnight. If it does, report it: something is writing a date through local time | — |

---

## What this feature touched elsewhere

- `InviteRequest.performers` is **dropped**. The invitations form no longer asks
  about performers; they are their own section now.
- `AdminUsersPage` offers **Performer** to OWNER and ADMIN.
- The root-domain login page gained a `PERFORMER` redirect branch.

Nothing else changed for existing roles.
