const ROOT_DOMAIN = 'v-menu.uz';
export function toSubdomainSlug(name) {
    return name
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^-+|-+$/g, '')
        .substring(0, 63)
        || 'restaurant';
}
export function isRootDomain() {
    const host = window.location.hostname;
    return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || host === 'localhost';
}
export function getSubdomainSlug() {
    const host = window.location.hostname;
    if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || !host.endsWith(`.${ROOT_DOMAIN}`))
        return null;
    return host.replace(`.${ROOT_DOMAIN}`, '');
}
export function buildSubdomainUrl(slug, params) {
    const qs = new URLSearchParams(params).toString();
    return `https://${slug}.${ROOT_DOMAIN}/?${qs}`;
}
