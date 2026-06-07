const ROOT_DOMAIN = 'v-menu.uz';

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

// Matches <restaurant>.public-catering.v-menu.uz — returns the restaurant slug or null.
export function getCateringSlug(): string | null {
  const host = window.location.hostname;
  const suffix = `.public-catering.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return slug || null;
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
