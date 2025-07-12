const CACHE_NAME = 'bilingual-bible-cache-v1';
const OFFLINE_URLS = [
  '/',
  './',
  'index.html',
  'style-kristen.css',
  'app.js',
  'manifest.json',
  
];

// 🔔 Utility: Send log messages to page
function sendToClients(msg) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(msg));
  });
}

// ⚙️ Install: Pre-cache the app shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
});

// 🧹 Activate: Clean up old cache versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 🚀 Fetch: Cache-first + visual logging + safe fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  sendToClients(`➡️ Fetching: ${url}`);

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        sendToClients(`✅ Served from cache: ${url}`);
        return cachedResponse;
      }

      return fetch(event.request)
        .then(networkResponse => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, cloned);
              sendToClients(`📦 Cached: ${url}`);
            });
            return networkResponse;
          } else {
            sendToClients(`⚠️ Not cached (status/type): ${url}`);
            return networkResponse;
          }
        })
        .catch(err => {
          sendToClients(`❌ Fetch failed: ${url} (${err})`);

          // 🧱 Offline fallback
          if (event.request.destination === 'document') {
            return caches.match('index.html');
          } else if (
            event.request.destination === 'script' ||
            event.request.destination === 'style' ||
            url.endsWith('.json')
          ) {
            // Return a harmless empty response to avoid crashes
            return new Response('', {
              status: 200,
              statusText: 'Offline fallback empty',
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // No fallback for other types
        });
    })
  );
});
