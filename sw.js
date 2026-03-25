const CACHE_NAME = 'check-v12.16.2-cache';
const assets = [
  '/',
  '/index.html',
  '/style_v12_16_2.css',
  '/modern_v12_16_2.css',
  '/script_v12_16_2.js',
  '/manifest.json',
  '/socket.io/socket.io.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assets)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Ignorar peticiones a la API para no cachear datos dinámicos erróneamente
  if (e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request).then((response) => {
        if (response) return response;
        
        // Fallback para cuando no hay red ni caché
        if (e.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
        
        return new Response('Network error', {
          status: 408,
          statusText: 'Network error'
        });
      });
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Notificación de Check Pro',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || {},
    tag: data.tag || 'check-pro-notification',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Check Pro', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
