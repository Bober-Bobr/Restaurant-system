# What you need to do

Everything built but **not yet live**, in the order to do it. Nothing in Parts
1–4 (module permissions, Additional Services, invitations, performers) is
running in production until this is worked through.

Five migrations are pending, two hosts need DNS/nginx/TLS, and four things need
setting up by hand afterwards — including one (**Step 8**) that has no UI at all
and which silently makes a whole feature invisible if skipped.

Detailed performer host guide: [SETUP-PERFORMER.md](SETUP-PERFORMER.md).

---

## At a glance

| # | Step | Where | Risk if skipped |
|---|---|---|---|
| 1 | Back up the database | server | two migrations drop columns |
| 2 | Deploy code + migrations | server | nothing else works |
| 3 | Verify migrations landed | server | silent half-state |
| 4 | DNS for `performer` (+ v-connect) | AIRNET | host does not resolve |
| 5 | nginx blocks | server | wrong app / 413 on video |
| 6 | TLS certificates | server | no HTTPS |
| 7 | Grant module permissions | Chief Admin UI | new restaurants locked out |
| 8 | **Promote a v-invite SYSTEM_ADMIN** | **SQL only** | **invitation orders invisible forever** |
| 9 | Rotate the `nfc_maker` password | server | known-compromised password |
| 10 | Create performer accounts | admin UI | performers block is empty |
| 11 | Set studio contacts | manager / v-invite UI | blank attribution blocks |
| 12 | End-to-end verification | browser | — |

---

## Step 1 — Back up the database

Do this first. Two of the pending migrations drop columns
(`InviteRequest.photoUrl`, `InviteRequest.performers`). Both are on a table with
little or no production data, so the real risk is low — but a five-migration
batch is not the moment to find out you have no backup.

**1.1 — Dump**

```bash
cd /root/Restaurant-system
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > ~/vmenu-backup-$(date +%F-%H%M).sql
```

**1.2 — Check it is not empty**

```bash
ls -lh ~/vmenu-backup-*.sql | tail -1
head -5 ~/vmenu-backup-*.sql | tail -1     # expect PostgreSQL dump header
```

A zero-byte file means the dump failed silently. Do not continue.

---

## Step 2 — Deploy code + migrations

**2.1 — Confirm the tree is clean**

```bash
cd /root/Restaurant-system
git status --short         # must be empty; deploy.sh uses --ff-only
```

**2.2 — Deploy**

```bash
./deploy.sh
```

Pull → install → `prisma migrate deploy` → build API → build web → copy to
`/var/www/restaurant` (bundle hash verified) → `pm2 restart restaurant-api`.

**2.3 — Watch the migration section**

Under `==> Running database migrations...` you should see these five applied:

| Migration | Brings |
|---|---|
| `20260730100000_restaurant_module_permissions` | Part 1 — the three module switches |
| `20260730140000_invite_request` | Part 3 — invitation orders |
| `20260730160000_invite_request_photos` | multiple photos per order |
| `20260730170000_admin_role_performer` | Part 4 — the `PERFORMER` enum value |
| `20260730180000_performers` | Part 4 — profile / calendar / bookings |

If earlier v-connect migrations (`nfc_plaque`, `platform_contact`, …) also apply
here, that is expected — they were pending too.

**Stop on any error.** Do not continue to step 4 with a partial migration.

---

## Step 3 — Verify migrations landed

All commands read the DB credentials from inside the container, so they work
whether or not you overrode `POSTGRES_USER` / `POSTGRES_DB`.

**3.1 — New tables**

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"' \
  | grep -Ei 'performer|inviterequest|nfcplaque|platformcontact'
```

Expect: `PerformerProfile`, `PerformerEvent`, `PerformerBooking`,
`InviteRequest`, `NfcPlaque`, `PlatformContact`.

**3.2 — The module columns**

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d \"Restaurant\""' | grep module
```

Expect `moduleBanquet`, `moduleCatering`, `moduleAddons`.

**3.3 — The new role**

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT unnest(enum_range(NULL::\"AdminRole\"))"' \
  | grep -E 'PERFORMER|NFC_MAKER'
```

**3.4 — Existing restaurants were grandfathered in**

This is the one that protects your current customers. The migration backfills
every restaurant that already existed to banquet + catering ON:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT name, \"moduleBanquet\", \"moduleCatering\", \"moduleAddons\" FROM \"Restaurant\" ORDER BY \"createdAt\""'
```

Every pre-existing row should show `t | t | f`. **If any show `f | f | f`, stop
and tell me** — that restaurant's staff can no longer log in.

---

## Step 4 — DNS

**4.1 — Get the server IP from a host that already works**

```bash
dig +short rmanager.v-menu.uz
```

**4.2 — Add the record in the AIRNET panel**

| Type | Name | Value |
|---|---|---|
| A | `performer` | IP from 4.1 |

Also confirm these exist from the earlier v-connect work — add them if not:

| Type | Name | Value |
|---|---|---|
| A | `v-connect.uz` (root) | same IP |
| A | `nfc` (on `v-connect.uz`) | same IP |

**4.3 — Verify at the authoritative resolver**

```bash
dig +short performer.v-menu.uz @8.8.8.8
```

**4.4 — Then from your own machine**

```bash
dig +short performer.v-menu.uz
```

> If 4.3 answers and 4.4 does not, your router/ISP has cached the old
> NXDOMAIN — nothing is wrong with the server. The zone's SOA `minimum` is
> 86400, so that can persist for 24h. This is what happened with
> `nfc.v-connect.uz`. Ask AIRNET to lower it to 3600 to avoid a repeat.

---

## Step 5 — nginx

**5.1 — `performer.v-menu.uz`**

Full block in [SETUP-PERFORMER.md § Step 2](SETUP-PERFORMER.md). The one line
that is easy to miss and specific to this host:

```nginx
client_max_body_size 64M;   # inside location /api/
```

Performers upload video showreels. The API accepts 60 MB; nginx defaults to
**1 MB** and rejects the request before Express ever sees it — a bare `413`,
nothing in the API log, photos still working. Looks like "videos are broken".

**5.2 — v-connect hosts** (if not already done)

Two blocks: `v-connect.uz` (root — serves both `/login` and `/<slug>` plaques)
and `nfc.v-connect.uz` (the builder). Both need only
`root /var/www/restaurant` + `try_files … /index.html`; they call the API
cross-origin, which CORS already allows.

**5.3 — Enable and test**

```bash
ln -s /etc/nginx/sites-available/performer.v-menu.uz /etc/nginx/sites-enabled/
nginx -t                       # must say "test is successful"
systemctl reload nginx
```

Never reload on a failed test — that takes down every host, not just the new one.

**5.4 — Smoke test over plain HTTP**

```bash
curl -sI http://performer.v-menu.uz/ | head -1    # expect 200
```

---

## Step 6 — TLS

**6.1 — Record the current SAN list**

```bash
certbot certificates
```

Copy the `Domains:` line. You need it verbatim next.

**6.2 — Reissue including the new name**

Every existing name **plus** the new one, in one command:

```bash
certbot --nginx \
  -d v-menu.uz -d www.v-menu.uz \
  -d admin.v-menu.uz -d manager.v-menu.uz -d cabinet.v-menu.uz \
  -d rmanager.v-menu.uz -d banquet.v-menu.uz -d food-admin.v-menu.uz \
  -d event.v-menu.uz \
  -d performer.v-menu.uz
```

> Use what 6.1 actually printed. Omitting a name that is currently covered
> issues a cert without it, and that host starts failing TLS immediately.

**6.3 — v-connect certificate** (separate domain, separate cert)

```bash
certbot --nginx -d v-connect.uz -d www.v-connect.uz -d nfc.v-connect.uz
```

**6.4 — Verify**

```bash
certbot certificates | grep -A1 Domains
curl -sI https://performer.v-menu.uz/ | head -1    # expect 200
nginx -t && systemctl reload nginx
```

---

## Step 7 — Grant module permissions

New restaurants now default to **all modules off**. Existing ones were
grandfathered in at 3.4.

**7.1 — Open the Chief Admin dashboard**

`https://admin.v-menu.uz` → **Companies** tab.

**7.2 — Set the switches per restaurant**

Each restaurant shows three toggles:

| Toggle | Unlocks |
|---|---|
| Banquets | banquet staff roles + `banquet.v-menu.uz/<slug>` |
| Food service site | `v-menu.uz/<slug>` + the Food Admin role |
| Additional services | the Additional Services page and its button |

**7.3 — Check the company-less section**

Scroll to **"Restaurants without a company"**. Restaurants with no company never
appeared in the old tree — if you have any, their switches are only reachable
here.

**7.4 — Understand the revocation behaviour before you use it**

Turning a module **off** ends live sessions within ~15 minutes: the next token
refresh 403s and the user is logged out. It is not a soft flag. Turning Banquets
off also means `banquet.v-menu.uz/<slug>` starts serving the Additional Services
page instead of the admin panel.

---

## Step 8 — Promote a v-invite SYSTEM_ADMIN ⚠️

**Do not skip this.** There is **no UI and no seed** for it. Until you run this,
the Notifications page at v-invite.uz does not exist for anyone, and every
invitation order submitted in Part 3 lands in the database unseen.

`InviteUser.role` defaults to `"USER"`.

**8.1 — Find the account to promote**

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, email, username, role FROM \"InviteUser\" ORDER BY \"createdAt\""'
```

If the list is empty, register at `https://v-invite.uz` first, then re-run.

**8.2 — Promote it**

Replace the email with the real one:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE \"InviteUser\" SET role = '"'"'SYSTEM_ADMIN'"'"' WHERE email = '"'"'you@example.com'"'"'"'
```

**8.3 — Confirm exactly one row changed**

`UPDATE 1`. If it says `UPDATE 0`, the email did not match. If it says more than
1, you matched too broadly — review 8.1.

**8.4 — Verify in the browser**

Sign out and back in at `https://v-invite.uz`. A **🔔 Notifications** tab appears
in the header. That tab is also the only way to see invitation orders.

---

## Step 9 — Rotate the `nfc_maker` password

The seed's default password is **in the repository** and has been shared in
plain text during development. Treat it as compromised.

**9.1 — If the account does not exist yet**, create it with a password you choose:

```bash
cd /root/Restaurant-system/apps/api
NFC_MAKER_PASSWORD='<a-new-strong-password>' npx tsx prisma/seed.ts
```

**9.2 — If it already exists**, the seed will **not** reset it — that is
deliberate, so re-running the seed never clobbers a production password. Change
it through the UI instead: sign in as `CHIEF_ADMIN` at `admin.v-menu.uz` →
Users → edit credentials for `nfc_maker`.

**9.3 — Verify the old password no longer works** at `https://v-connect.uz/login`.

---

## Step 10 — Create performer accounts

**10.1 — Sign in as a role that can create them**

`CHIEF_ADMIN` (`admin.v-menu.uz` → Users), `OWNER` (`cabinet.v-menu.uz`), or
`ADMIN` (`banquet.v-menu.uz/<slug>` → `/admin/users`).

`CATERING_ADMIN` deliberately cannot — enforced server-side.

**10.2 — Create with role "Performer"**, username + password.

**10.3 — The account correctly shows no restaurant.** A performer is
platform-wide and bookable by anyone, not staff of the venue that signed them
up. The server forces `restaurantId` to null whoever creates them.

**10.4 — Tell them to sign in at `https://v-menu.uz/login`**, not at
`performer.v-menu.uz`. Sign-in is on the root domain for every role.

---

## Step 11 — Set studio contacts

These fill the attribution block at the bottom of published pages. Blank until
set.

**11.1 — v-connect** — manager portal (`manager.v-menu.uz`), contacts section.

**11.2 — v-invite** — sign in at `v-invite.uz` as the SYSTEM_ADMIN from step 8 →
**Profile** → the platform contact card (visible only to a SYSTEM_ADMIN).

---

## Step 12 — End-to-end verification

Work through these in order; each depends on the previous steps.

**12.1 — Module permissions (Part 1)**

- Turn Banquets **off** for a test restaurant → its ADMIN is refused at login
  with a clear message, not a generic error.
- Turn it back **on** → they can sign in again.
- Turn Food service **off** → `v-menu.uz/<slug>` stops resolving.
- Sign in as an OWNER and try to PATCH their own restaurant's modules → the
  fields are stripped server-side; they cannot self-grant.

**12.2 — Additional Services routing (Part 2)**

- Banquets **off** → `banquet.v-menu.uz/<slug>` shows Additional Services, not a
  login screen.
- Banquets **on** + Additional services **on** → confirm an event on the tablet
  Summary page; the prominent button appears.
- Additional services **off** → the button is gone.

**12.3 — Invitation orders (Part 3)**

- Submit the invitations form with **several photos**.
- It appears on the v-invite **Notifications** tab with an unread badge.
- Mark read / delete both work.

**12.4 — Performers (Part 4)** — full walkthrough in
[SETUP-PERFORMER.md § Step 6](SETUP-PERFORMER.md). The assertion that matters:
after the performer **accepts** a booking, they must read **Busy** for that date
in the guest-facing list. That proves the loop closed.

**12.5 — Nothing else regressed**

Sign in once as each existing role and confirm you land where you used to:
CHIEF_ADMIN, MANAGER, OWNER, RESTAURANT_MANAGER, CATERING_ADMIN, ADMIN.

---

## Known open questions

Not blockers, but decisions I flagged and you have not made:

- **The public invitation and booking endpoints have no rate limiting.** Both are
  unauthenticated by necessity. Options: per-IP limit, captcha, or requiring a
  valid restaurant slug.
- **An ADMIN can create a performer but cannot delete one** — deliberate, since
  performers are platform-wide, but say if you want it symmetrical.
- **Plaque templates are owner-private**, not shared across NFC makers.
- **`apps/web/tsconfig.json` has no `"noEmit": true`**, so every build emits
  `.js` files next to sources. Harmless but noisy; one line to fix.
