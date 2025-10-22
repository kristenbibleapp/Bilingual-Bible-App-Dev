const CACHE_NAME = 'bilingual-bible-shell-v1';
const OFFLINE_URLS = [
  '/', 'index.html', 'style-kristen.css', 'app.js', 'manifest.json'
];

// Install: cache shell only
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(OFFLINE_URLS)));
});

// Activate: remove any old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first, no logging, no JSON caching
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});