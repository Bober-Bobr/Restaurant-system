# What you need to do

Everything built across Parts 1–5 — module permissions, the Additional Services
page, invitation orders, performers, and hosts — exists in the repository but is
**not running in production**. This document is the full list of what stands between
here and live, in the order it has to happen.

There are ten pending database migrations, one new host to stand up, one nginx
change you would not guess, and four pieces of manual setup afterwards. One of
those four (Step 8) has no user interface at all, and skipping it silently makes
an entire feature invisible.

Read [§ Nginx configuration](#nginx-configuration) before Step 5 — it explains
how this system actually routes API traffic, which is not what the per-host
blocks suggest.

---

## Step 1 — Back up the database

Do this before anything else touches Postgres.

Three of the pending migrations drop columns: `20260730160000_invite_request_photos`
removes `InviteRequest.photoUrl` after copying it into the new `photoUrls` array,
`20260730180000_performers` removes the unused `InviteRequest.performers`, and
`20260731140100_host_program_fields` removes `PerformerProfile.craft`. All three
act on tables that are almost certainly empty in your production database, since
neither invitation orders nor performers have ever been live. So the genuine risk
here is close to zero. That is not the point — the point is that you are about to
apply ten migrations in one batch, and this is the last moment at which taking a
dump costs you nothing.

Take the dump by running `pg_dump` inside the container. Read the credentials
from the container's own environment rather than hardcoding them, because
`docker-compose.yml` defaults to `vmenu`/`vmenu` but honours `POSTGRES_USER` and
`POSTGRES_DB` from a `.env` file, and if yours overrides them a hardcoded command
fails in a confusing way:

```bash
cd /root/Restaurant-system
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > ~/vmenu-backup-$(date +%F-%H%M).sql
```

Then confirm you actually got something. A failed dump can produce a zero-byte
file and a zero exit code, which is exactly the sort of thing you discover at the
worst possible time:

```bash
ls -lh ~/vmenu-backup-*.sql | tail -1
head -1 ~/vmenu-backup-*.sql
```

The file should be at least tens of kilobytes and start with a PostgreSQL dump
header. If it is empty, stop and work out why before continuing.

---

## Step 2 — Deploy the code and run the migrations

`deploy.sh` does the whole sequence: fast-forward pull, `npm install`, load
`DATABASE_URL` from `apps/api/.env`, bring Postgres up if it is not running,
`prisma generate`, `prisma migrate deploy`, build the API, build the frontend,
copy `dist` into `/var/www/restaurant`, verify the deployed bundle hash matches
the one just built, and restart the API under pm2.

Before running it, confirm your working tree is clean. The script pulls with
`--ff-only`, so any local edit on the server aborts the deploy partway through
its first step:

```bash
cd /root/Restaurant-system
git status --short      # must print nothing
./deploy.sh
```

Watch the output under `==> Running database migrations...`. Ten migrations
should apply.

`20260730100000_restaurant_module_permissions` is Part 1. It adds the three
boolean columns to `Restaurant` and — importantly — backfills every restaurant
that already exists to banquet + catering ON. That backfill is what stops the
deploy locking out every customer you already have, and Step 3 verifies it
worked.

`20260730140000_invite_request` is Part 3. It creates the `InviteRequest` table
that invitation orders land in.

`20260730160000_invite_request_photos` converts that table's single `photoUrl`
to a `photoUrls` array, carrying over any existing value first.

`20260730170000_admin_role_performer` adds the `PERFORMER` value to the
`AdminRole` enum, and does nothing else. It is alone in its own migration on
purpose: PostgreSQL will not let a newly added enum value be *used* in the same
transaction that adds it, and Prisma wraps each migration in a transaction. Do
not merge it into the next one.

`20260730180000_performers` creates `PerformerProfile`, `PerformerBooking` and
`PerformerEvent`, and drops the unused `InviteRequest.performers` column.

`20260731100000_expense_services_manual_spent` is the Expense Ledger work. It
adds the nullable `DayEvent.manualSpentSum` column (NULL everywhere, so every
existing day keeps its computed total) and creates the `ServiceExpense` table for
the per-department Additional Services lines. Nothing is dropped and nothing is
backfilled, so this one is safe to re-run and safe to leave applied if you roll
the code back.

`20260731140000_admin_role_host` is Part 5. It adds the `HOST` value to the
`AdminRole` enum and nothing else, alone in its own migration for exactly the
same reason as `admin_role_performer` above. Do not merge it into the next one.

`20260731140100_host_program_fields` adds `program` to `PerformerBooking` and
`PerformerEvent` — the host's event running order, nullable so existing
performer rows are untouched — and drops `PerformerProfile.craft`, the
"What do you do?" field that is gone from both roles' profiles.

`20260731160000_manual_guests_revenue` renames `DayEvent.manualSpentSum` to
`manualGuestsSum`. The manual amount in the Expense Ledger now overrides the
**revenue for all guests**, not the spent total, so the column was renamed to say
what it means. A rename rather than a drop-and-add, so any figure already typed
in survives. Note that the meaning changed: if anyone had used the old field to
override a *spent* total, that number is now read as guest revenue — worth a
glance at the ledger after deploying, though in practice the feature has never
been live.

`20260801100000_invite_promo_showcase` creates the `InvitePromoShowcase` table
that holds the system administrator's choice of which invitation templates appear
on the v-invite.uz cover. No row means "shipped defaults", so this one changes
nothing on its own — the landing page looks exactly as it does today until an
administrator opens the Templates page and saves a selection.

If you also see the older v-connect migrations (`nfc_plaque`,
`platform_contact`, `platform_contact_instagram`, `extra_services`,
`admin_role_nfc_maker`) applying here, that is expected — they were pending too
and have simply been waiting for a deploy.

If any migration errors, stop. Do not carry on to the host setup with a
half-applied schema; fix the error or restore from Step 1 first.

---

## Step 3 — Verify the migrations actually landed

`deploy.sh` will fail loudly on a migration error, but it is worth confirming the
resulting schema directly, because the difference between "the deploy succeeded"
and "the feature will work" is exactly these four checks.

All of them read credentials from inside the container, for the reason given in
Step 1.

First, confirm the new tables exist:

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"' \
  | grep -Ei 'performer|inviterequest|nfcplaque|platformcontact'
```

You are looking for `PerformerProfile`, `PerformerEvent`, `PerformerBooking`,
`InviteRequest`, and — from the earlier v-connect work — `NfcPlaque` and
`PlatformContact`.

Second, confirm the module columns landed on `Restaurant`:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d \"Restaurant\""' | grep module
```

Expect `moduleBanquet`, `moduleCatering` and `moduleAddons`.

Third, confirm the new roles exist in the enum. If either is missing, creating
that account in Step 10 fails with a raw database error rather than a friendly
message:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT unnest(enum_range(NULL::\"AdminRole\"))"' \
  | grep -E 'PERFORMER|HOST|NFC_MAKER'
```

While you are here, confirm the host programme columns landed — without them the
hosts block accepts a booking request and then fails to store the programme:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d \"PerformerBooking\""' | grep program
```

Fourth — and this is the one that protects the customers you already have — check
that existing restaurants were grandfathered in:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT name, \"moduleBanquet\", \"moduleCatering\", \"moduleAddons\" FROM \"Restaurant\" ORDER BY \"createdAt\""'
```

Every restaurant that existed before this deploy should read `t | t | f` —
banquet on, catering on, additional services off. That is the migration's backfill
doing its job. **If any pre-existing restaurant reads `f | f | f`, stop and tell
me.** That venue's ADMIN, EMPLOYEE and KITCHEN accounts can no longer sign in,
and its public catering site has stopped resolving. It is recoverable in seconds
from the Chief Admin UI, but you want to know now rather than from a phone call.

---

## Step 4 — DNS

One new record is needed: `performer` on `v-menu.uz`.

Start by finding the address the existing hosts point at, rather than assuming
you remember it. If the server sits behind a proxy or has more than one
interface, a guess gets you a host that resolves to nothing:

```bash
dig +short rmanager.v-menu.uz
```

In the AIRNET control panel for `v-menu.uz`, add an **A record** with the name
`performer` pointing at that address, at whatever TTL the panel defaults to.
There is no wildcard involved anywhere in this system — the .uz registrar rejects
wildcard DNS, which is the whole reason flyers, invitations, plaques and
restaurant apps are all path-based rather than subdomain-based.

While you are in the panel, confirm the v-connect records from the earlier work
exist: an A record for the root `v-connect.uz` and one for `nfc` on that domain,
both pointing at the same address. Add them if they are missing.

Now verify, and verify in the right order. First ask a public resolver, which
goes to the authoritative nameserver and bypasses everything between you and the
zone:

```bash
dig +short performer.v-menu.uz @8.8.8.8
```

Then ask your own machine's resolver:

```bash
dig +short performer.v-menu.uz
```

If the first answers and the second does not, nothing is wrong with the server or
the record. Your router or ISP resolver has cached the earlier NXDOMAIN — the
negative answer from before the record existed. This zone's SOA `minimum` is
86400 seconds, so a cached miss can persist for a full day. This is precisely
what happened with `nfc.v-connect.uz` and cost real time chasing a non-problem.
You can wait it out, flush the local resolver, or test from mobile data. Asking
AIRNET to lower the SOA `minimum` to 3600 would mean future hosts appear within
an hour instead of a day, and is worth doing once.

Do not move on to certbot until the name resolves from the machine that will run
it, because certbot validates over HTTP against that name.

---

## Step 5 — Nginx

See [§ Nginx configuration](#nginx-configuration) below for the complete blocks
and — more importantly — an explanation of how API traffic actually flows in this
system, which is not what the existing per-host blocks imply.

The short version: `performer.v-menu.uz` needs a block that does nothing but
serve the SPA, and the **`api.v-menu.uz`** block needs one line added to it.

---

## Step 6 — TLS certificates

Two separate certificates are involved, because `v-menu.uz` and `v-connect.uz`
are different domains.

Before touching anything, record what your current certificate covers:

```bash
certbot certificates
```

Copy the `Domains:` line somewhere you can see it. You need it verbatim in a
moment, and this is the step where a mistake is quietly destructive.

To add the new host, reissue the `v-menu.uz` certificate with **every name it
already covers plus the new one**, in a single command. Certbot replaces the
certificate rather than appending to it, so any name you leave out of this
command is dropped, and that host starts failing TLS immediately — with no error
at the time you run it:

```bash
certbot --nginx \
  -d v-menu.uz -d www.v-menu.uz \
  -d api.v-menu.uz \
  -d admin.v-menu.uz -d manager.v-menu.uz -d cabinet.v-menu.uz \
  -d rmanager.v-menu.uz -d banquet.v-menu.uz -d food-admin.v-menu.uz \
  -d event.v-menu.uz \
  -d performer.v-menu.uz
```

The names above are the expected set for this system, but your server is the
authority — use what `certbot certificates` actually printed, plus
`performer.v-menu.uz`.

If the v-connect certificate has not been issued yet, do it now as a separate
certificate:

```bash
certbot --nginx -d v-connect.uz -d www.v-connect.uz -d nfc.v-connect.uz
```

Then confirm the result, remembering that certbot edits your server blocks in
place to add the `listen 443 ssl` lines and certificate paths:

```bash
certbot certificates | grep -A1 Domains
curl -sI https://performer.v-menu.uz/ | head -1     # expect 200
nginx -t && systemctl reload nginx
```

---

## Step 7 — Grant module permissions

From this deploy onward, **newly created restaurants start with all three modules
off**. Restaurants that already existed were grandfathered in by the migration, as
verified in Step 3.

Sign in as `CHIEF_ADMIN` at `https://admin.v-menu.uz` and open the **Companies**
tab. Each restaurant now shows three switches.

**Banquets** unlocks the banquet staff roles — ADMIN, EMPLOYEE and KITCHEN — and
the admin panel at `banquet.v-menu.uz/<slug>`. **Food service site** unlocks the
public catering site at `v-menu.uz/<slug>` and the CATERING_ADMIN role.
**Additional services** unlocks the Additional Services page and the button that
reaches it from the tablet.

Scroll to the bottom of the tab for a section headed **"Restaurants without a
company"**. The dashboard has only ever listed restaurants nested under a
company, but `companyId` is optional — so any company-less restaurant was
invisible there, and its switches would be unreachable without that section. If
you have none, it will not appear.

Understand what turning a module *off* does before you use it in anger. It is not
a cosmetic flag. The gate runs on every token refresh, not just at login, so
revoking a module ends live sessions within about fifteen minutes: the next
refresh returns 403 and the axios interceptor logs the user out. Turning Banquets
off also changes what `banquet.v-menu.uz/<slug>` serves — that host stops showing
the admin panel and starts showing the Additional Services page instead. That is
the designed behaviour from Part 2, not a bug, but it will surprise you if you
flip the switch to test it while someone is working.

Owners cannot grant themselves modules. An OWNER may edit their own restaurant,
but the controller strips the three module fields from any payload that does not
come from a CHIEF_ADMIN, so this is enforced server-side and not merely hidden.

---

## Step 8 — Promote a v-invite SYSTEM_ADMIN

**This one has no user interface, and skipping it makes Part 3 invisible.**

`InviteUser.role` defaults to `"USER"`. Nothing in the application, and nothing
in the seed, ever promotes an account to `SYSTEM_ADMIN`. Until you run the
statement below by hand, the **Notifications** tab does not appear for any
v-invite account, and every invitation order submitted from the Additional
Services page lands in the database where nobody can see it. The orders are not
lost — they are simply unreachable until somebody has the role.

First, list the accounts so you can pick the right one:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, email, username, role FROM \"InviteUser\" ORDER BY \"createdAt\""'
```

If that comes back empty, there are no v-invite accounts yet. Register one at
`https://v-invite.uz` first, then re-run the query.

Then promote the account, substituting the real email address:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE \"InviteUser\" SET role = '"'"'SYSTEM_ADMIN'"'"' WHERE email = '"'"'you@example.com'"'"'"'
```

psql prints the number of rows changed. You want exactly `UPDATE 1`. `UPDATE 0`
means the email did not match anything — check for typos or a different case
against the list from the previous query. Anything above 1 means your `WHERE`
clause matched too broadly, and you should look at what you just changed.

Finally, confirm it in the browser. Sign out and back in at `https://v-invite.uz`
— the role is read from the token, so an existing session will not show the
change. A **🔔 Notifications** tab should now appear in the header, carrying an
unread badge when orders are waiting. That tab is the only place invitation
orders are visible anywhere in the system.

While you are signed in as this account, note that the platform contact card on
the **Profile** page is also SYSTEM_ADMIN-only — you will need it in Step 11.

---

## Step 9 — Rotate the `nfc_maker` password

The seed file contains a hardcoded default password for the `nfc_maker` account,
and that password has additionally been passed around in plain text during
development. Treat it as compromised and change it.

Which action you take depends on whether the account already exists.

If the account has **not** been created yet, create it now with a password you
choose. The seed reads `NFC_MAKER_PASSWORD` from the environment and only falls
back to the hardcoded default when that is unset:

```bash
cd /root/Restaurant-system/apps/api
NFC_MAKER_PASSWORD='<a-new-strong-password>' npx tsx prisma/seed.ts
```

If the account **already exists**, re-running the seed will not help — it
deliberately skips password changes for existing accounts, so that a routine
re-seed can never clobber a password someone changed in production. Change it
through the interface instead: sign in as `CHIEF_ADMIN` at
`https://admin.v-menu.uz`, open Users, find `nfc_maker`, and edit its
credentials.

Either way, confirm afterwards that the old password no longer works by
attempting to sign in with it at `https://v-connect.uz/login`.

---

## Step 10 — Create performer and host accounts

There is no seeded performer or host, and there should not be — unlike
`nfc_maker`, these are real people's accounts, and a default one would be a
permanently open door.

Three roles can create them. A `CHIEF_ADMIN` does it from `admin.v-menu.uz` under
the Users tab; an `OWNER` from `cabinet.v-menu.uz`; a restaurant `ADMIN` from
`banquet.v-menu.uz/<slug>` at `/admin/users`. A `CATERING_ADMIN` deliberately
cannot, and that restriction is enforced on the server rather than by hiding the
option.

Choose the role **Performer** or **Host**, set a username and password, and
save. The two are separate roles and appear in separate blocks on the Additional
Services page, but they get the identical workspace at `performer.v-menu.uz` —
profile, calendar, booking inbox — so there is nothing extra to set up for a
host. The one difference the host will notice is that their booking requests
carry an event programme, and that a programme field appears on their calendar
entries.

The account will show no restaurant, and that is correct. Neither is staff of the
venue that happened to sign them up — they are platform-wide and bookable from
any restaurant's Additional Services page. The server forces `restaurantId` to
null for both roles no matter who creates them, including when a restaurant ADMIN
does it, so you cannot get this wrong from the interface.

When you hand over the credentials, tell them to sign in at
**`https://v-menu.uz/login`** and not at `performer.v-menu.uz`. Sign-in happens
on the root domain for every role in the system; the login page then forwards
them to their own host with the session attached.

---

## Step 11 — Set the studio contact details

These fill the attribution block at the foot of published pages, and they are
blank until somebody sets them.

For **v-connect**, sign in to the manager portal at `https://manager.v-menu.uz`
and fill in the contacts section. These appear on published NFC plaques.

For **v-invite**, sign in at `https://v-invite.uz` as the SYSTEM_ADMIN account
from Step 8, open **Profile**, and fill in the platform contact card. That card
is only rendered for a SYSTEM_ADMIN, and the server rejects the write from anyone
else, so this genuinely has to be that account. These details appear under the
"developed with love" credit on every published invitation.

---

## Step 12 — Verify end to end

Work through these in order; each one depends on the steps before it.

**Module permissions.** Turn Banquets off for a test restaurant and confirm its
ADMIN is refused at login with a clear message rather than a generic failure.
Turn it back on and confirm they can sign in again. Turn Food service off and
confirm `v-menu.uz/<slug>` stops resolving to that restaurant's site. If you have
an OWNER account, confirm that saving their own restaurant does not let them
enable a module for themselves.

**Additional Services routing.** With Banquets off for a restaurant, visit
`banquet.v-menu.uz/<slug>` and confirm you get the Additional Services page
rather than a login screen you could never get past. Then turn Banquets on and
Additional services on, confirm an event on the tablet Summary page, and check
that the prominent Additional Services button appears on the confirmation screen.
Turn Additional services off and confirm the button disappears.

**Invitation orders.** Submit the invitations form with several photos attached.
Confirm it appears on the v-invite Notifications tab with an unread badge, that
the photos are all visible and open full size, and that marking read and deleting
both work.

**Performers.** Follow the full walkthrough in
[SETUP-PERFORMER.md](SETUP-PERFORMER.md) § Step 6. The assertion that actually
matters is the last one: after the performer accepts a booking request, they must
read **Busy** for that date in the guest-facing performers list. That is what
proves the loop closed, because availability is defined as "has a calendar entry
that day" and accepting a booking is what creates the entry.

**Hosts.** Repeat that same walkthrough with a Host account, and check the three
things that are specific to hosts. First, the Additional Services page shows a
**Hosts** block below Performers, listing hosts only — no performer may appear in
it and no host in the performers block. Second, the booking form will not submit
without an event programme; clear the field and confirm the button stays
disabled, then submit through the API without one and confirm it is refused
server-side rather than only in the browser. Third, accept the request as the
host and confirm the programme is already filled in on the resulting calendar
entry, and that editing it there saves.

**No regressions.** Sign in once as each pre-existing role — CHIEF_ADMIN,
MANAGER, OWNER, RESTAURANT_MANAGER, CATERING_ADMIN and a restaurant ADMIN — and
confirm each still lands on the host it always did.

---

## Nginx configuration

### How traffic actually flows here

This is worth understanding before you copy any config, because the existing
per-host blocks are misleading.

`apps/web/.env` sets `VITE_API_URL="https://api.v-menu.uz/api"` — an **absolute
origin**, baked into the JavaScript bundle at build time. Every API call from
every host therefore goes to `api.v-menu.uz`, cross-origin, regardless of which
hostname served the page. Uploads follow the same path: `getPhotoUrl()` strips
the trailing `/api` from that value and prefixes it to every stored
`/uploads/...` path, so images and videos are fetched from
`https://api.v-menu.uz/uploads/...` too.

The practical consequences:

Every host that serves the SPA needs **nothing but** a document root and an
SPA fallback. It does not need an `/api/` proxy, and it does not need an
`/uploads/` alias. If your older blocks contain them, they are dead config —
harmless, but they will mislead you when debugging, exactly as they misled the
first draft of this document.

There is exactly **one** block that proxies to the Node process on port 4000 and
serves the uploads directory: `api.v-menu.uz`. Anything to do with request size
limits, upload timeouts or CORS headers belongs there and nowhere else.

The API already sends permissive CORS (`cors({ origin: true })`) and sets
`Cross-Origin-Resource-Policy: cross-origin` on `/uploads`, which is what makes
this cross-origin arrangement work without per-host configuration.

### Block 1 — the new host, `performer.v-menu.uz`

Create `/etc/nginx/sites-available/performer.v-menu.uz`:

```nginx
server {
    listen 80;
    server_name performer.v-menu.uz;

    root /var/www/restaurant;
    index index.html;

    # /profile, /calendar, /bookings and /devices are client-side routes. Without
    # this, reloading the page on any of them returns a 404 from nginx, because
    # no such file exists on disk.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

That is the entire block. It is deliberately identical in shape to
`rmanager.v-menu.uz`, because the performer workspace has the same needs: no path
slug (a performer is identified by their token, not a restaurant), no API proxy,
no uploads.

Enable it and reload:

```bash
ln -s /etc/nginx/sites-available/performer.v-menu.uz /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

`nginx -t` must report both `syntax is ok` and `test is successful`. Never reload
on a failed test — a broken config takes down every host on the server, not just
the one you were editing.

Smoke-test it over plain HTTP before certbot exists for this name:

```bash
curl -sI http://performer.v-menu.uz/ | head -1      # expect 200
```

### Block 2 — the change you would not guess: `api.v-menu.uz`

**This is the one that matters for performers, and it is not on the performer
host.**

Performers upload video showreels. The API accepts up to 60 MB per file. Nginx's
default `client_max_body_size` is **1 MB**, and nginx rejects an oversized request
itself — the request never reaches Express, nothing appears in the API log, and
the browser receives a bare `413`. Photos, being small, keep working perfectly.
The result looks like "video upload is broken" rather than a proxy limit.

First check whether a limit is already set globally, in which case you may not
need to change anything:

```bash
grep -rn client_max_body_size /etc/nginx/
```

If that prints nothing, or prints a value below 64M, edit your `api.v-menu.uz`
server block so it looks like this:

```nginx
server {
    listen 80;
    server_name api.v-menu.uz;

    # Uploads are large: performer showreels are capped at 60 MB server-side.
    # Nginx defaults to 1 MB and would reject them with a bare 413 before the
    # API ever sees the request.
    client_max_body_size 64M;

    location / {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # A 60 MB upload over a slow connection takes a while; the default 60s
        # would cut it off mid-transfer.
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_request_buffering off;
    }

    location /uploads/ {
        alias /root/Restaurant-system/apps/api/uploads/;
        add_header Cross-Origin-Resource-Policy cross-origin;
        add_header Access-Control-Allow-Origin *;
        expires 1y;
    }
}
```

Serving `/uploads/` directly from disk rather than proxying it to Node is worth
keeping — it means large media never occupies an API worker.

`proxy_request_buffering off` streams the upload straight through instead of
spooling the whole file to a temp directory before forwarding it. On a 60 MB
video that is the difference between a snappy upload and a long stall with no
progress.

Reload and confirm:

```bash
nginx -t && systemctl reload nginx
curl -sI https://api.v-menu.uz/api/health | head -1
```

If your API is not currently on its own hostname and is instead proxied per-host,
then `VITE_API_URL` in `apps/web/.env` does not match your deployment. In that
case put `client_max_body_size 64M;` in the `/api/` location of whichever block
is actually serving the API, and tell me — the routing documentation and this
guide both assume the `api.v-menu.uz` arrangement that the env file describes.

### Block 3 — v-connect hosts, if not already present

Two blocks, both plain SPA hosts for the same reason as above:

```nginx
server {
    listen 80;
    server_name v-connect.uz www.v-connect.uz;

    root /var/www/restaurant;
    index index.html;

    # Serves both /login and the published plaques at /<slug>.
    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    server_name nfc.v-connect.uz;

    root /var/www/restaurant;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Checking the whole set

The full list of hostnames this system serves, all from the same
`/var/www/restaurant` build: the root `v-menu.uz` (login, tablet, and path-based
catering sites), `admin`, `manager`, `cabinet`, `rmanager`, `performer`,
`banquet`, `food-admin` and `event` on `v-menu.uz`; `api.v-menu.uz` for the API
and uploads; `v-invite.uz`; and `v-connect.uz` with `nfc.v-connect.uz`.

To see what you currently have configured:

```bash
grep -rh server_name /etc/nginx/sites-enabled/ | tr -s ' ' | sort -u
```

---

## Decisions still open

None of these block the deploy, but they are unresolved and I would rather they
were your choice than my silence.

The public invitation and performer-booking endpoints have **no rate limiting**.
Both are unauthenticated out of necessity — a restaurant's guest has no account —
so both are open to spam. The realistic options are a per-IP rate limit in nginx,
a captcha on the forms, or requiring the request to carry a valid restaurant
slug. This is the only item here I would consider pre-launch.

A restaurant ADMIN can **create** a performer but cannot **delete** one. That
asymmetry is deliberate, since a performer is a platform-wide account and one
venue's admin removing someone other venues book would be worse, but say the word
if you want it symmetrical.

Plaque design templates are **owner-private** to the NFC maker who created them,
rather than shared across all makers.

~~`apps/web/tsconfig.json` has no `"noEmit": true`~~ — **fixed** while building the
food-service site. `"noEmit": true` is set and the 163 emitted `.js` shadows under
`apps/web/src/` were deleted. Nothing under `src/` was hand-written JavaScript; each
had a `.ts`/`.tsx` sibling.


---

## 13. Food-service site — `test.v-menu.uz`

The catering-site overhaul (Phase 1: redesign + cart, ordering not yet built).
**No database migration** — the only backend change is additive: `GET
/api/public/restaurant` now accepts `?slug=` as well as `?restaurantId=`, and
returns the contact/branding fields alongside the theme it already returned.

Three infrastructure steps, in this order:

**DNS.** One A record, `test` on `v-menu.uz`, pointing at the same server as the
rest. No wildcard — the .uz registrar rejects them. The SOA `minimum` is 86400s,
so a cached NXDOMAIN can persist a full day: create the record *before* you first
try the host, not after.

**Nginx.** One block. It needs no `/api` proxy and no `/uploads` alias, because
`VITE_API_URL` is an absolute origin baked into the bundle and `getPhotoUrl()`
derives `/uploads` from it — same reasoning as the v-connect hosts:

```nginx
server {
    listen 80;
    server_name test.v-menu.uz;

    root /var/www/restaurant;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Then `ln -s`, `nginx -t`, `systemctl reload nginx`.

**TLS.** Reissue the v-menu certificate with **every name it already carries plus
`-d test.v-menu.uz`**. Certbot replaces the SAN list, it does not append — drop a
name from the command and you drop it from the cert.

Afterwards, `./deploy.sh` as normal. One SPA build serves every host, so there is
nothing host-specific to deploy. The service worker cache was bumped to
`vmenu-v5`, so returning visitors pick up the new shell rather than a stale one.

**Verify:** `test.v-menu.uz/<slug>` shows the new dark site with a cart, and
`v-menu.uz/<slug>` is unchanged. If the second is not true, stop — the two are
meant to be completely independent.


---

## 14. Stage 2 — ordering (guest → waiter)

**Two new migrations**, on top of everything already listed above:

| Migration | What |
|---|---|
| `20260803100000_admin_role_catering_employee` | `ALTER TYPE "AdminRole" ADD VALUE 'CATERING_EMPLOYEE'` — alone, because Postgres will not let a new enum value be *used* in the transaction that adds it |
| `20260803100100_orders` | `Order` + `OrderItem`, their indexes, and the **partial unique index** on `(restaurantId, code) WHERE status IN ('PENDING','OPEN')` |

Nothing drops. `./deploy.sh` applies both.

**Verify the partial index landed** — it is the guard against two guests holding
the same code, and it is the one thing here Prisma cannot express, so it is worth
confirming rather than assuming:

```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "\d+ \"Order\"" | grep -i 'Order_open_code_key'
```

Expect a line containing `UNIQUE`, `(restaurantId, code)` and `WHERE status`.

### After deploying

**Create Food Employee accounts.** In the restaurant's admin → Users, the
**Food Employee** role (`CATERING_EMPLOYEE`) is now offered alongside Food Admin.
They sign in at `v-menu.uz/login` and are redirected to
`food-admin.v-menu.uz/<slug>`, landing on Orders. **No new host, DNS record or
certificate is needed** — they share the existing food-admin host.

This is a **different role from the banquet `EMPLOYEE`**, which is unchanged and
still belongs to `moduleBanquet`. Do not swap one for the other when creating
accounts — the names are similar and the products are not.

**`moduleCatering` gates them** exactly as it gates Food Admin, on login *and* on
refresh. Revoking the module ends the session within the 15-minute access-token
window.

### End-to-end check

1. On `test.v-menu.uz/<slug>`, add dishes → checkout → a three-character code appears.
2. The cart button and every dish stepper vanish; the menu stays browsable.
3. As a Food Employee on `food-admin.v-menu.uz/<slug>`, enter that code + a table number → the order appears with its dishes and comment.
4. Back on the guest device (within ~10s), the code screen becomes "Order accepted" with a **Call waiter** button.
5. Press it → their Orders tab badges within ~5s and the card turns amber. "On my way" clears it.
6. Amend the order (add a dish, edit the comment) → the guest's device reflects it on its next poll.
7. Close the order → the guest's device unlocks and the cart works again.

### Known limits

The rate limiter is **in-memory**, so it is per-process. The API runs as a single
pm2 process today; scaling to more would need a shared store.

**Closed orders are retained for one year**, then purged by a sweep that runs 5
minutes after API start and every 24h thereafter. Nothing to schedule — no cron
entry, no systemd timer, and no annual job that a deploy would silently reset.
`OrderItem` rows cascade with their order. `RETENTION_MS` in
`apps/api/src/modules/order/order.retention.ts` is the single knob if you want a
different period.

The sweep logs only when it actually removes something —
`[orders] retention sweep removed N order(s) closed over a year ago` — so
`pm2 logs restaurant-api` staying quiet is the expected state for the first year.

**Statistics** (`/stats`) read only CLOSED orders, so the page is empty until
orders are closed rather than merely placed. A Food Admin sees the whole
restaurant and a per-employee comparison; a Food Employee sees only their own.


---

## 15. v-invite — promotional site moved, template pricing added

**One migration**, `20260805100000_invite_template_pricing`: two nullable columns
(`tier`, `priceCents`) on `InviteTemplateOverride`. Nothing drops, nothing is
backfilled, and no existing row changes meaning.

### The routing change is user-visible

`v-invite.uz` now opens the **sign-in page**. The promotional site moved to
`v-invite.uz/main`. Anyone with the bare domain bookmarked lands on sign-in
rather than the marketing page — intended, but worth knowing before the first
support question.

`main` and `pricing` are now **reserved slugs**, so no invitation can be
published at either. If a project already holds one it would be shadowed by the
static route, so check before deploying:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, name, slug FROM \"InviteProject\" WHERE slug IN ('"'"'main'"'"', '"'"'pricing'"'"');"'
```

Expect zero rows. If one comes back, rename it before deploying — it will
otherwise become unreachable.

The promotional site also **no longer offers sign-in or sign-up**. Existing users
still sign in at `v-invite.uz` (the root is now the login page); there is simply
no link to it from the marketing pages.

### After deploying

A SYSTEM_ADMIN gets a new **Settings** tab (`/settings`) listing every built-in
template with a tier (Standard / Premium / Luxury) and a price. Prices are typed
in so'm and stored in tiyin. Leaving a price empty means "not on sale yet", which
is deliberately different from a price of zero.

Nothing on the promotional site reads these yet — that is the next step. Setting
them now is safe and changes nothing a visitor sees.

---

## 16 · Promotional site shows real invitations (`20260809100000_promo_showcase_works`)

**One migration**, on `InvitePromoShowcase`: adds `workSlugs` + `coverSlugs`,
drops `coverIds` + `orderIds`.

The dropped columns held **template ids**, which cannot be turned into invitation
slugs — there is no invitation they could point at. Nothing is lost that could
have been kept: the ordering and cover choices simply have to be made again
against real invitations.

### Right after deploying, the promo site looks unchanged

That is deliberate, not a failed deploy. With no invitations chosen,
`/api/vinvite/promo-works` returns nothing and the landing page falls back to
showing the built-in templates — exactly what it showed before. The section
subtitle is the only visible difference.

### To switch it over

1. Sign in as the SYSTEM_ADMIN at `v-invite.uz` and **publish** the invitations
   you want on the marketing site (only published ones can be showcased, and
   only ones belonging to that account).
2. Go to **Templates → Promotional site**. Under "Our work", add each one, order
   them with ↑↓, and star up to two for the cover.
3. Save. The landing page picks it up without a reload.

Unpublishing or deleting an invitation later removes it from the marketing site
on its own — there is nothing to remember to clean up here.

### Also in this change

- The **price list** section of the same card replaces the old per-template
  show/hide list. `hiddenIds` carried over unchanged, so anything previously
  hidden stays hidden.
- **`/pricing` is now where a design is chosen**: every row previews live (👁)
  and can be selected. The "our work" gallery no longer offers "select" — it is
  showing a customer's finished invitation, which is not on sale.
- Copy: "Ready in minutes" and "5 minutes to launch" are gone from the cover and
  from Why us; the guest-responses tile now describes the **Telegram bot** that
  forwards RSVPs, which is what the product actually does
  (`InviteTelegramLink` / `InviteProject.telegramCode`).

---

## 17. `deploy.sh` now runs the unit tests

`npm test` (vitest, ~15 s, both the API and web projects) runs as part of every
deploy. Nothing to do differently — but two things are worth knowing before the
next release.

**Where it sits, and why.** After `prisma generate`, because the API suite
imports `@prisma/client` for its enums; before `prisma migrate deploy`, which is
the first step of the script that changes something we cannot take back. A
failing test costs a deploy. The same failure one step later would cost a
restore.

**It needs dev dependencies.** vitest is a root devDependency, so a server
running `npm install` with `NODE_ENV=production`, or one that has ever been
installed with `--omit=dev`, will not have it. The script stops with an
explanation rather than skipping quietly; the fix is:

```
npm install --include=dev
```

**Emergency escape hatch:**

```
SKIP_TESTS=1 ./deploy.sh
```

For getting the previous release back up during an incident — it prints a loud
banner saying the code is unverified. Not for getting a red build out.

---

## 18. If the deploy stops at "DATABASE_URL … is not a postgresql:// URL"

That check runs **before** the migrations, the build and the tests, so nothing
was touched and nothing needs undoing. It reads `apps/api/.env` on the server —
a gitignored file, so a `git pull` never changes it and a fresh checkout has no
copy of it at all.

The message now prints what it actually found (with the password masked) and
names the likely cause. To look yourself:

```
grep -n DATABASE_URL apps/api/.env
```

| What you see | What happened |
|---|---|
| `file:./dev.db` | The checkout is carrying a **development** `.env`. Restore the server's own file. |
| line starts with `#` | Commented out. |
| no line at all | Wrong `.env`, or the file was recreated from `.env.example`. |
| empty after `=` | The value was cleared. |

The parser accepts `export` prefixes, leading whitespace, single or double
quotes, CRLF endings and the `postgres://` scheme as well as `postgresql://` —
so a rejection now means the value is genuinely wrong, not merely formatted
unusually.

---

## 19. `apps/api/.env` and `apps/web/.env` are no longer tracked in git

**This is the cause of the `DATABASE_URL … is not a postgresql:// URL` failure in
§18, and it needs one manual step on the server before the next deploy.**

Both files were committed to the repository, holding development values —
`DATABASE_URL="file:./dev.db"` and a placeholder `JWT_SECRET`. The server's real
configuration was therefore a *locally modified tracked file*, one `git reset
--hard`, `git checkout .`, `git stash` or fresh clone away from being replaced
by the repo's dev copy. That is what happened.

### Fix the server first

The running API still holds the correct configuration **in memory**. Do not
restart pm2 and do not re-run `deploy.sh` until `.env` is repaired — see the
warning below for why.

1. Recover the real values from the running process:
   ```
   pm2 env $(pm2 id restaurant-api | tr -d '[] ') | grep -E 'DATABASE_URL|JWT_SECRET'
   ```
   (This prints secrets to the terminal — do not paste the output anywhere.)
2. Write them back into `apps/api/.env`, along with everything else the API
   needs (see `apps/api/.env.example`).
3. Confirm before deploying:
   ```
   grep -n DATABASE_URL apps/api/.env      # must be postgresql:// or postgres://
   ```

If the values cannot be recovered from the process:

- **`DATABASE_URL`** — rebuild it from the Postgres container's credentials,
  which come from the `.env` next to `docker-compose.yml` (`POSTGRES_USER`,
  `POSTGRES_PASSWORD`, `POSTGRES_DB`, defaulting to `vmenu`/`vmenu`/`vmenu`):
  `postgresql://<user>:<password>@localhost:5432/<db>`
- **`JWT_SECRET`** — if it is genuinely lost, generate a new one
  (`openssl rand -base64 48`). Everyone is signed out and has to log in again;
  nothing else breaks.

### Why not to restart first

Starting the API with the dev `.env` does two things, and the second is silent:

- `schema.prisma` is `provider = "postgresql"` while the URL says
  `file:./dev.db`, so the API cannot connect — the site goes down.
- The placeholder `JWT_SECRET` is 42 characters, so it **passes** the `min(32)`
  validation in `config/env.ts` and the API starts happily signing tokens with a
  secret published in this repository. Anyone could forge an admin token, and
  nothing in the logs would say so.

Nothing was leaked by the old tracking itself: every committed version of these
files contained placeholders, never production values.

### What changed in the repo

- `.gitignore` now covers `apps/api/.env` and `apps/web/.env`; the
  `.env.example` files stay committed.
- `deploy.sh` copies both files aside before `git merge` and puts them back
  afterwards. It also discards the local modification first — while the file is
  still tracked *and* modified, `merge --ff-only` refuses outright, so the very
  commit that untracks it could not otherwise be pulled. If a checkout ever
  overwrites one again, the server's copy wins and the script says so.

---

## 20. Bringing the Telegram bots back

`git stash` on the server restored the repository's copy of `apps/api/.env`
(§19) and took **both bot tokens** with it. Nothing failed loudly, because
`registerWebhook()` runs once on boot and returns without a word when the token,
the webhook secret or the public URL is missing — the API starts, the logs look
normal, and the bots never receive another message.

Restore these to `apps/api/.env`, then restart the API:

| Key | What it does |
|---|---|
| `TELEGRAM_BOT_TOKEN` | The main bot — forwards flyer form submissions. |
| `TELEGRAM_WEBHOOK_SECRET` | Guards the public webhook path; also sent as Telegram's `secret_token`. |
| `TELEGRAM_PUBLIC_URL` | Where Telegram POSTs updates, e.g. `https://event.v-menu.uz`. |
| `TELEGRAM_INVITE_BOT_TOKEN` | Optional second bot for invitation RSVPs. Without it, the main bot serves both. |
| `TELEGRAM_BOT_USERNAME`, `TELEGRAM_INVITE_BOT_USERNAME` | Only for building `t.me` deep links; fetched via `getMe` when omitted. |

If the tokens are gone, reissue them from **@BotFather** (`/mytoken`). The
webhook secret is ours — any long random string, as long as it matches what is
registered; `openssl rand -hex 24` will do.

Webhook registration happens **on boot**, so the tokens only take effect after
`pm2 restart restaurant-api` (which `deploy.sh` does at the end). Confirm with:

```
pm2 logs restaurant-api --lines 50 | grep telegram
# → [telegram] main webhook registered at https://event.v-menu.uz/api/telegram/webhook/…
```

No line means the registration was skipped — one of the three above is still
missing.

### This cannot happen quietly again

`apps/api/src/config/envFile.test.ts` reads the real `.env` as part of the test
suite, and `deploy.sh` runs the suite with `VMENU_DEPLOY=1` **before** the
migrations and the pm2 restart. On a deploy it refuses:

- the SQLite development URL, or any non-postgres one;
- any value still carrying an example from `.env.example`;
- a missing key that `.env.example` marks `# required` — which now includes the
  three Telegram variables;
- a bot token with no webhook secret or no public URL (a half-configured bot,
  which is the silent-failure shape);
- `KEY: value` lines (pm2's display format), duplicate keys, and a `JWT_SECRET`
  too short for `env.ts`.

Problems are reported by **key name only** — no value ever reaches the output.

If you deliberately stop using the bots, remove their `# required` markers from
`apps/api/.env.example`. That is a commit somebody can read, rather than a
deploy that fails.

---

## 21. The app shell must not be cached (tab title / stale release)

**Symptom:** a visitor lands on a page showing the *previous* release — old tab
title, old bundle — and only a manual refresh fixes it. Seen after the tab-title
change, where `index.html` still carried `<title>Banquet Admin</title>`.

`index.html` is the only file in `dist/` **without** a content hash in its name.
Every asset beside it is immutable and safe to cache forever; the shell is the
opposite and must be revalidated on every visit, because it is what names the
current bundle.

Two layers were fixed in the repo:

- `apps/web/public/sw.js` — `CACHE` bumped to **`vmenu-v6`** (the `activate`
  handler deletes every other cache, which is what actually evicts the previous
  precached `index.html`), and navigations now fetch with `cache: 'reload'`,
  bypassing the browser's own HTTP cache for the shell.
- The title is applied in `main.tsx` **before the first render**, so it never
  depends on an effect that runs after the first paint, and an inline script in
  `index.html` names v-connect and v-invite before the bundle has even parsed.

**Caches are per ORIGIN.** `v-connect.uz`, `v-invite.uz` and `v-menu.uz` each
have their own service-worker registration and their own HTTP cache, so a hard
refresh on one does nothing for the others. After a shell change, every origin
needs one — which is the argument for fixing the nginx headers below rather than
chasing it by hand.

**The remaining layer is nginx**, and it is not in this repo. Each server block
serving the SPA needs the shell excluded from caching while the hashed assets
keep their long cache:

```nginx
location = /index.html {
    add_header Cache-Control "no-cache, must-revalidate";
}
location = /sw.js {
    add_header Cache-Control "no-cache";
}
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
location / { try_files $uri $uri/ /index.html; }
```

`no-cache` does **not** mean "do not store" — the browser still keeps the file
and revalidates it, so a 304 costs nothing. Apply it to every SPA host block:
`v-menu.uz`, `banquet.`, `food-admin.`, `test.`, `admin.`, `cabinet.`,
`manager.`, `rmanager.`, `performer.`, `event.`, `v-invite.uz`, `v-connect.uz`,
`nfc.v-connect.uz`.

Verify after a deploy:

```
curl -sI https://v-menu.uz/ | grep -i cache-control
curl -s  https://v-menu.uz/ | grep -o '<title>.*</title>'
```

---

## 22. New rich template — `wedding-chateau` ("Château Gates")

A wedding design built around a **film**: the hero is a video of the estate
gates opening. Registered in `RICH_TEMPLATES`, so it appears in the v-invite
template chooser and on `/pricing` as soon as this is deployed.

**It ships ~10 MB of new static assets** in `apps/web/public/chateau/` — ten
JPEGs (~3.6 MB total, re-encoded from the 10 MB PNGs they arrived as) and
`film.mp4` (6.5 MB). Vite copies `public/` into `dist/` and `deploy.sh` copies
`dist/` to `/var/www/restaurant`, so **no new deploy step is needed** — but the
copy is that much bigger, and the first deploy after this will show it.

Worth doing at the same time:

- **Give it a tier and a price** on `v-invite.uz/settings` (SYSTEM_ADMIN). A
  template with neither set simply does not appear on the `/pricing` list —
  `groupByTier` puts it in `unassigned` rather than dropping it, but nobody can
  buy what is not listed.
- **Check `film.mp4` is served with a long cache header** by the nginx `/`
  block. It is content-static but its name is not hashed, so it will be
  re-fetched on every visit if it lands under the `no-cache` rule added for
  `index.html` in §21. Only `= /index.html` and `= /sw.js` should be no-cache.

---

## 23. New rich template — `wedding-paris` ("An Afternoon in Paris")

The château's city sibling, and the second design built around a **film**: the
hero is a video of French doors opening onto Paris. Registered in
`RICH_TEMPLATES`, so it appears in the template chooser, in the landing
catalog and on `/pricing` as soon as this is deployed.

**It ships ~12 MB of new static assets** in `apps/web/public/paris/` — thirteen
JPEGs (4.2 MB total, re-encoded from the 10 MB PNGs they arrived as) and
`film.mp4` (7.2 MB). As with §22 this needs **no new deploy step**: Vite copies
`public/` into `dist/` and `deploy.sh` copies `dist/` to `/var/www/restaurant`.
The two film-based templates now account for ~22 MB of that copy between them.

Same two follow-ups as the château:

- **Give it a tier and a price** on `v-invite.uz/settings` (SYSTEM_ADMIN).
  Unpriced, it reads as "on request" in the catalog and falls into `unassigned`
  on the price list — visible, but not orderable.
- **Confirm `/paris/film.mp4` is not caught by the `no-cache` rule** from §21.
  Only `= /index.html` and `= /sw.js` should be no-cache; an unhashed 7 MB video
  re-fetched on every visit is the one mistake worth checking for here.
