// Service worker — makes the PWA installable AND lets an already-visited flyer
// open without a connection. We can't work fully offline on the very first
// visit (nothing is cached yet); once a flyer has been opened online, its app
// shell, assets, images and data are cached and it reopens offline.

const CACHE = 'vmenu-v3';
// The SPA shell we always want available offline for navigations.
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Put a response in the cache, ignoring failures (e.g. opaque/oversized).
function put(request, response) {
  const copy = response.clone();
  caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
  return response;
}

// Cache-first with background refresh (stale-while-revalidate).
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then((res) => (res && res.ok ? put(request, res) : res)).catch(() => null);
  return cached || (await network) || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // App navigations: try the network, fall back to the cached SPA shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => put(request, res))
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html'))),
    );
    return;
  }

  const isAsset = url.origin === self.location.origin;
  const isApi = url.pathname.includes('/api/public/');
  const isUpload = url.pathname.includes('/uploads/');

  // Same-origin build assets, the public (no-auth) flyer API, and uploaded
  // images are cached so a previously-opened flyer renders offline. Everything
  // else (authenticated API calls, etc.) falls through to the default fetch.
  if (isAsset || isApi || isUpload) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
