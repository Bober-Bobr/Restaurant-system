const ROOT_DOMAIN: string = (import.meta.env.VITE_ROOT_DOMAIN as string | undefined) ?? 'v-menu.uz';

// Build an absolute URL on the root domain, e.g. https://v-menu.local/login
export function buildAbsoluteUrl(path = '/'): string {
  return `https://${ROOT_DOMAIN}${path}`;
}

// Build an absolute URL on a subdomain, e.g. https://admin.v-menu.local/
export function buildSubdomainBase(subdomain: string, path = '/'): string {
  return `https://${subdomain}.${ROOT_DOMAIN}${path}`;
}

// ── v-invite.uz — the standalone invitation-builder product ──────────────────
const INVITE_DOMAIN: string = (import.meta.env.VITE_INVITE_DOMAIN as string | undefined) ?? 'v-invite.uz';

// Root v-invite.uz host → the builder app (login / dashboard / editor).
export function isInviteRootDomain(): boolean {
  const host = window.location.hostname;
  return host === INVITE_DOMAIN || host === `www.${INVITE_DOMAIN}` || host === 'v-invite.local';
}

// <name>.v-invite.uz → a published invitation site. Returns the slug or null.
export function getInviteSiteSlug(): string | null {
  const host = window.location.hostname;
  const suffix = `.${INVITE_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.') || slug === 'www') return null;
  return slug;
}

// Published invitations use PATH-based links (v-invite.uz/<slug>) because the
// .uz registrar does not allow wildcard subdomain DNS records.
export function buildInviteSiteUrl(slug: string): string {
  return `https://${INVITE_DOMAIN}/${slug}`;
}

export function inviteDomain(): string {
  return INVITE_DOMAIN;
}

// First path segments on the root domain that are NOT a restaurant catering
// slug (they belong to the platform: login and the kiosk tablet views).
const CATERING_RESERVED_PATHS = new Set(['login', 'tablet']);

// The catering site, banquet admin and food-admin are all PATH-based now
// (v-menu.uz/<slug>, banquet.v-menu.uz/<slug>, food-admin.v-menu.uz/<slug>) —
// mirroring flyers and invitations — so no per-restaurant subdomain/DNS record
// is needed. This returns the first path segment (or null when at the root).
function firstPathSegment(): string | null {
  const seg = window.location.pathname.split('/').filter(Boolean)[0];
  return seg || null;
}

export function toSubdomainSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63)
    || 'restaurant';
}

export function isRootDomain(): boolean {
  const host = window.location.hostname;
  return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || host === 'localhost' || host === 'v-menu.local';
}

export function isAdminSubdomain(): boolean {
  return window.location.hostname === `admin.${ROOT_DOMAIN}`;
}

export function isCabinetSubdomain(): boolean {
  return window.location.hostname === `cabinet.${ROOT_DOMAIN}`;
}

export function isManagerSubdomain(): boolean {
  return window.location.hostname === `manager.${ROOT_DOMAIN}`;
}

// rmanager.v-menu.uz — the Restaurant Manager (expense ledger / devices) app.
export function isRestaurantManagerSubdomain(): boolean {
  return window.location.hostname === `rmanager.${ROOT_DOMAIN}`;
}

// Matches <slug>.invitation.v-menu.uz — returns the restaurant slug or null.
export function getInvitationSubdomainSlug(): string | null {
  const host = window.location.hostname;
  const suffix = `.invitation.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return slug || null;
}

// Flyers live on the `.event.` host: `event.v-menu.uz` (no restaurant) or
// `<restaurant>.event.v-menu.uz`. The public flyer resolves by PATH slug, so this
// just detects the host; the restaurant label is cosmetic.
export function isEventSubdomain(): boolean {
  const host = window.location.hostname;
  if (host === `event.${ROOT_DOMAIN}`) return true;
  const suffix = `.event.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return false;
  const label = host.slice(0, -suffix.length);
  return !!label && !label.includes('.'); // only single-label slugs
}

// The flyer slug IS the subdomain label: <slug>.event.v-menu.uz → slug (or null
// on the bare event host, where the slug comes from the path instead).
export function getEventSubdomainSlug(): string | null {
  const host = window.location.hostname;
  const suffix = `.event.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) return null;
  return slug;
}

// banquet.v-menu.uz — the (single, fixed) restaurant admin/employee/kitchen host.
// The restaurant is identified by the auth token; the path slug is cosmetic.
export function isBanquetHost(): boolean {
  return window.location.hostname === `banquet.${ROOT_DOMAIN}`;
}

// The slug in banquet.v-menu.uz/<slug>. Cosmetic for a signed-in user, but it
// is the ONLY identifier available to a visitor who is not signed in — the
// module gate resolves the restaurant from it.
export function getBanquetSlug(): string | null {
  if (!isBanquetHost()) return null;
  return firstPathSegment();
}

// food-admin.v-menu.uz — the (single, fixed) catering-admin host. The restaurant
// is identified by the auth token; the path slug is cosmetic.
export function isFoodAdminHost(): boolean {
  return window.location.hostname === `food-admin.${ROOT_DOMAIN}`;
}

// The production root domain that serves the public catering sites by path
// (v-menu.uz/<slug>). Excludes localhost / v-menu.local, where the dashboards
// are served at root paths (/admin/menu …) via role-based routing in dev.
function isCateringPathHost(): boolean {
  const host = window.location.hostname;
  return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;
}

// v-menu.uz/<slug> → public catering site. Returns the restaurant slug, or null
// at the root or on a reserved platform path (/login, /tablet).
export function getCateringSlug(): string | null {
  if (!isCateringPathHost()) return null;
  const seg = firstPathSegment();
  if (!seg || CATERING_RESERVED_PATHS.has(seg)) return null;
  return seg;
}

// Router basename: banquet/food-admin admin apps live under /<slug>, so the app's
// routes (/, /admin/menu …) resolve beneath the cosmetic slug. The public catering
// site likewise lives under /<slug> so its internal pages (/halls, /reviews …)
// resolve correctly. Everything else (root login/tablet, admin/manager/cabinet/
// rmanager subdomains, flyers, invitations) uses no basename.
export function routerBasename(): string {
  if (isBanquetHost() || isFoodAdminHost()) {
    const seg = firstPathSegment();
    return seg ? `/${seg}` : '';
  }
  const cateringSlug = getCateringSlug();
  return cateringSlug ? `/${cateringSlug}` : '';
}

// Build the public catering-site URL (path-based): https://v-menu.uz/<slug>
export function buildCateringSiteUrl(slug: string): string {
  return `https://${ROOT_DOMAIN}/${slug}`;
}

// Build a banquet-admin URL: https://banquet.v-menu.uz/<slug>/?<params>
export function buildBanquetUrl(slug: string, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return `https://banquet.${ROOT_DOMAIN}/${slug}/${qs ? `?${qs}` : ''}`;
}

// Build a food-admin URL: https://food-admin.v-menu.uz/<slug>/?<params>
export function buildFoodAdminUrl(slug: string, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return `https://food-admin.${ROOT_DOMAIN}/${slug}/${qs ? `?${qs}` : ''}`;
}

export function buildSubdomainUrl(slug: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `https://${slug}.${ROOT_DOMAIN}/?${qs}`;
}

// ── v-connect.uz — the NFC-plaque product ────────────────────────────────────
// Two hosts only (the .uz registrar rejects wildcard DNS, so published plaques
// are PATH-based just like flyers, invitations and v-invite sites):
//   v-connect.uz            → login (/login) and published plaques (/<slug>)
//   nfc.v-connect.uz        → the plaque builder
const CONNECT_DOMAIN: string = (import.meta.env.VITE_CONNECT_DOMAIN as string | undefined) ?? 'v-connect.uz';

// First path segments on v-connect.uz that belong to the platform, not a plaque.
const CONNECT_RESERVED_PATHS = new Set(['login']);

export function connectDomain(): string {
  return CONNECT_DOMAIN;
}

// The bare v-connect.uz host (login + published plaques).
export function isConnectRootDomain(): boolean {
  const host = window.location.hostname;
  return host === CONNECT_DOMAIN || host === `www.${CONNECT_DOMAIN}` || host === 'v-connect.local';
}

// nfc.v-connect.uz → the NFC plaque builder app.
export function isNfcBuilderHost(): boolean {
  const host = window.location.hostname;
  return host === `nfc.${CONNECT_DOMAIN}` || host === 'nfc.v-connect.local';
}

// Any v-connect host at all — used by the App dispatcher to claim the domain.
export function isConnectHost(): boolean {
  return isConnectRootDomain() || isNfcBuilderHost();
}

// v-connect.uz/<slug> → a published plaque. Null at the root or on /login.
export function getPlaqueSlug(): string | null {
  if (!isConnectRootDomain()) return null;
  const seg = window.location.pathname.split('/').filter(Boolean)[0];
  if (!seg || CONNECT_RESERVED_PATHS.has(seg)) return null;
  return seg;
}

// The public URL an NFC tag is written with.
export function buildPlaqueUrl(slug: string): string {
  return `https://${CONNECT_DOMAIN}/${slug}`;
}

// The builder host, optionally carrying a login handoff (same _at/_rt/_u/_r
// query protocol the v-menu subdomains use).
export function buildNfcBuilderUrl(params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return `https://nfc.${CONNECT_DOMAIN}/${qs ? `?${qs}` : ''}`;
}

// The v-connect login page.
export function buildConnectLoginUrl(): string {
  return `https://${CONNECT_DOMAIN}/login`;
}
