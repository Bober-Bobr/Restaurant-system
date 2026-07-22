// Service worker — makes the PWA installable AND lets an already-visited flyer
// open without a connection. We can't work fully offline on the very first
// visit (nothing is cached yet); once a flyer has been opened online, its app
// shell, assets, images and data are cached and it reopens offline.

const CACHE = 'vmenu-v4';
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

// Cache-first with background refresh (stale-while-revalidate). Good for
// immutable, content-hashed build assets.
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then((res) => (res && res.ok ? put(request, res) : res)).catch(() => null);
  return cached || (await network) || fetch(request);
}

// Network-first with a cache fallback. Used for mutable flyer data so edits show
// immediately when online, while a previously-opened flyer still loads offline.
async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) return put(request, res);
    // Non-OK (e.g. 404) — prefer a good cached copy if we have one.
    return (await caches.match(request)) || res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('offline and not cached');
  }
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

  const isAsset = url.origin === self.location.origin && !url.pathname.startsWith('/api/');
  const isApi = url.pathname.includes('/api/public/');
  const isUpload = url.pathname.includes('/uploads/');

  // Flyer data must be fresh on every online visit (edits appear immediately),
  // falling back to cache only when offline.
  if (isApi) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Immutable build assets and uploaded images are content-addressed, so serving
  // the cached copy first (with a background refresh) is safe and fast; a
  // previously-opened flyer still renders offline.
  if (isAsset || isUpload) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
