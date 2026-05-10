const STATIC_CACHE = 'check-pro-static-v3';
const API_CACHE = 'check-pro-api-v3';

const staticUrls = [
  '/', '/manifest.json',
  '/css/modules/base.css', '/css/modules/components.css', '/css/modules/layout.css',
  '/html/pages/portal.html', '/html/pages/ticket.html', '/html/pages/landing.html',
  '/html/pages/wheel.html', '/html/pages/registro.html'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE).then(function(c) { return c.addAll(staticUrls); }));
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== STATIC_CACHE && k !== API_CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

// Background sync for offline actions
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-guest') {
    event.waitUntil(syncOfflineGuests());
  }
});

async function syncOfflineGuests() {
  var clients = await self.clients.matchAll();
  clients.forEach(function(c) { c.postMessage({ type: 'SYNC_COMPLETED' }); });
}

self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // API requests: network first, fallback to cache
  if (url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        return caches.open(API_CACHE).then(function(cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || new Response(JSON.stringify({ offline: true, error: 'Sin conexión' }), { headers: { 'Content-Type': 'application/json' } });
        });
      })
    );
    return;
  }

  // Pages: network first, then cache
  if (url.includes('/portal') || url.includes('/ticket') || url.includes('/landing') || url.includes('/raffle') || url.includes('/registro')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request).then(function(c) { return c || caches.match('/html/pages/portal.html'); });
      })
    );
    return;
  }

  // Static: cache first, network update
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchP = fetch(event.request).then(function(resp) {
        return caches.open(STATIC_CACHE).then(function(cache) { cache.put(event.request, resp.clone()); return resp; });
      }).catch(function() { return cached; });
      return cached || fetchP;
    })
  );
});

// Push notifications
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Check Pro', body: event.data.text() }; }
  self.registration.showNotification(data.title || 'Check Pro', {
    body: data.body || '', icon: '/manifest.json', badge: '/manifest.json',
    data: { url: data.url || '/' }, vibrate: [200, 100, 200]
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});

// Message channel for PWA install
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
