// Minimal service worker — required for the browser to treat this site as
// an installable PWA. We don't precache anything (the HTML shell is small
// and the app calls the API directly), but a network-first fetch handler
// lets the browser see the SW as "controlling" once it activates.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Empty fetch handler: required for the browser to mark the app as
// installable, but we don't intercept anything — the browser does its
// default network fetch.
self.addEventListener('fetch', () => {});
