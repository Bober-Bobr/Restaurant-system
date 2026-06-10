const ROOT_DOMAIN = 'v-menu.uz';

// Single-label subdomains reserved for platform roles — never treated as a restaurant slug.
const RESERVED_SUBDOMAINS = new Set(['admin', 'manager', 'cabinet', 'www']);

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
  return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || host === 'localhost';
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

// Matches <slug>.invitation.v-menu.uz — returns the restaurant slug or null.
export function getInvitationSubdomainSlug(): string | null {
  const host = window.location.hostname;
  const suffix = `.invitation.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return slug || null;
}

// Matches <restaurant>.catering-admin.v-menu.uz — true when on that subdomain.
export function isCateringAdminSubdomain(): boolean {
  return window.location.hostname.endsWith(`.catering-admin.${ROOT_DOMAIN}`);
}

// Matches <restaurant>.banquet.v-menu.uz — the restaurant admin/employee/kitchen app.
// Returns the restaurant slug or null.
export function getBanquetSlug(): string | null {
  const host = window.location.hostname;
  const suffix = `.banquet.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) return null; // only single-label slugs
  return slug;
}

// Matches <restaurant>.v-menu.uz (single label, non-reserved) → public catering site.
// Returns the restaurant slug or null.
export function getCateringSlug(): string | null {
  const host = window.location.hostname;
  const suffix = `.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  // Exclude multi-label subdomains (e.g. foo.banquet, foo.invitation) and reserved labels.
  if (!slug || slug.includes('.') || RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

export function getSubdomainSlug(): string | null {
  const host = window.location.hostname;
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || !host.endsWith(`.${ROOT_DOMAIN}`)) return null;
  return host.replace(`.${ROOT_DOMAIN}`, '');
}

export function buildSubdomainUrl(slug: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `https://${slug}.${ROOT_DOMAIN}/?${qs}`;
}
