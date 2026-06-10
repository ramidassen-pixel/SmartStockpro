const CACHE_NAME = 'smartstock-v5';
const urlsToCache = [
  '/smart-stock-pro/',
  '/smart-stock-pro/index.html',
  '/smart-stock-pro/assets/css/variables.css',
  '/smart-stock-pro/assets/css/reset.css',
  '/smart-stock-pro/assets/css/layout.css',
  '/smart-stock-pro/assets/css/components.css',
  '/smart-stock-pro/assets/css/pages.css',
  '/smart-stock-pro/assets/css/responsive.css',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => caches.match('/smart-stock-pro/index.html'))
  );
});
