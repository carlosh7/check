const CACHE = 'check-pro-v2';
const STATIC_CACHE = 'check-pro-static-v2';
const API_CACHE = 'check-pro-api-v2';

const staticUrls = [
  '/',
  '/manifest.json',
  '/css/modules/base.css',
  '/css/modules/components.css',
  '/css/modules/layout.css',
  '/html/pages/portal.html',
  '/html/pages/ticket.html',
  '/html/pages/landing.html'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) { return cache.addAll(staticUrls); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== STATIC_CACHE && k !== API_CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // API requests: network first, fallback to cache (stale-while-revalidate)
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

  // Portal page: always try network first, then cache
  if (url.includes('/portal') || url.includes('/ticket') || url.includes('/landing')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request).then(function(c) {
          return c || caches.match('/html/pages/portal.html');
        });
      })
    );
    return;
  }

  // Static assets: cache first, network update in background
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        return caches.open(STATIC_CACHE).then(function(cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Check Pro', body: event.data.text() }; }
  self.registration.showNotification(data.title || 'Check Pro', {
    body: data.body || '', icon: '/manifest.json', badge: '/manifest.json', data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
