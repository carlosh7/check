const CACHE_NAME = 'check-v5-cache';
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
  '/socket.io/socket.io.js',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@800&family=Inter:wght@400;500;600&display=swap'
];

// Instalación: Cachear assets
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assets))
  );
});

// Activación: Limpiar caches antiguos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Estrategia: Network First para scripts y HTML, Cache First para el resto
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname === '/' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((res) => res || fetch(e.request))
    );
  }
});
