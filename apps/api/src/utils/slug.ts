// Restaurant slugs are derived from the name, not stored. This MUST stay in
// lockstep with `toSubdomainSlug` in apps/web/src/utils/subdomain.ts — the web
// app builds the URL with its copy and the API resolves it back with this one.
export function toSubdomainSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63)
    || 'restaurant';
}
