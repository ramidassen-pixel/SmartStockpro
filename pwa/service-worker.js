/* SmartStock Pro — Service Worker v5 */
var CACHE_NAME = 'smartstock-v5';
var BASE = '/SmartStockpro';

/* Files to cache on install */
var CACHE_FILES = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/assets/css/variables.css',
  BASE + '/assets/css/reset.css',
  BASE + '/assets/css/layout.css',
  BASE + '/assets/css/components.css',
  BASE + '/assets/css/pages.css',
  BASE + '/assets/css/responsive.css',
  BASE + '/assets/js/bundle.js',
  BASE + '/pwa/manifest.json',
  BASE + '/pwa/icon-192.png',
  BASE + '/pwa/icon-512.png',
];

/* Install — cache all core files */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(CACHE_FILES);
      })
      .then(function() {
        return self.skipWaiting();
      })
      .catch(function(err) {
        console.log('SW install error:', err);
      })
  );
});

/* Activate — delete old caches */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* Fetch — serve from cache, fallback to network */
self.addEventListener('fetch', function(e) {
  /* Skip non-GET and cross-origin requests */
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;

      /* Not in cache — fetch from network and cache it */
      return fetch(e.request).then(function(response) {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        /* Clone response to cache and return */
        var toCache = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, toCache);
        });
        return response;
      }).catch(function() {
        /* Offline fallback — serve index.html for navigation requests */
        if (e.request.mode === 'navigate') {
          return caches.match(BASE + '/index.html');
        }
      });
    })
  );
});

/* Message — force update */
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
