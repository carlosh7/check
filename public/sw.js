const CACHE = 'check-pro-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/css/modules/base.css',
  '/css/modules/components.css'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request).catch(function() {
      return caches.match(event.request);
    }));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request).then(function(networkResponse) {
        return caches.open(CACHE).then(function(cache) {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});

self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Check Pro', body: event.data.text() }; }
  self.registration.showNotification(data.title || 'Check Pro', {
    body: data.body || '',
    icon: '/manifest.json',
    badge: '/manifest.json',
    data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
