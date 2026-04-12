/**
 * Resolves a photo URL stored as a relative path (e.g. /uploads/menu/foo.jpg)
 * to an absolute URL pointing at the API server.
 *
 * The API base URL is taken from VITE_API_URL (e.g. http://localhost:4000/api),
 * so we strip the "/api" suffix to get the server origin.
 */
export function getPhotoUrl(photoUrl) {
    if (!photoUrl)
        return undefined;
    // Already absolute — return as-is
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))
        return photoUrl;
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
    // Strip trailing "/api" segment to get the server root
    const serverOrigin = apiBase.replace(/\/api\/?$/, '');
    return `${serverOrigin}${photoUrl}`;
}
