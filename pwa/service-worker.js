/* SmartStock Pro — Service Worker v6 */
var CACHE = 'smartstock-v6';
var BASE  = '/SmartStockpro';

var CORE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/pwa/manifest.json',
  BASE + '/pwa/icon-192.png',
  BASE + '/pwa/icon-512.png',
];

/* ── Install ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(CORE);
    }).then(function() {
      return self.skipWaiting();
    }).catch(function(err) {
      console.log('SW install error:', err);
    })
  );
});

/* ── Activate — delete old caches ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: cache-first for icons/manifest, network-first for HTML ── */
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var url = e.request.url;

  /* Always serve icons and manifest from cache */
  if (url.includes('/pwa/icon') || url.includes('/pwa/manifest')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
          return res;
        });
      })
    );
    return;
  }

  /* Network-first for HTML, fallback to cache */
  if (e.request.mode === 'navigate' || url.includes('index.html')) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return res;
      }).catch(function() {
        return caches.match(BASE + '/index.html');
      })
    );
    return;
  }

  /* Default: cache-first */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(res) {
        if (!res || res.status !== 200) return res;
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return res;
      }).catch(function() {
        if (e.request.mode === 'navigate') {
          return caches.match(BASE + '/index.html');
        }
      });
    })
  );
});

/* ── Force update ── */
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
