// Minimal service worker — required for the browser to treat this site as
// an installable PWA. We don't precache anything (the HTML shell is small
// and the app calls the API directly), but a network-first fetch handler
// lets the browser see the SW as "controlling" once it activates.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through; needed for the SW to be considered active.
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});
