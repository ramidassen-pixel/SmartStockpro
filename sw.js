const CACHE = 'ssp-v5';
const ASSETS = [
  '/SmartStockpro/',
  '/SmartStockpro/index.html',
  '/SmartStockpro/assets/js/bundle.js',
  '/SmartStockpro/assets/css/variables.css',
  '/SmartStockpro/assets/css/reset.css',
  '/SmartStockpro/assets/css/layout.css',
  '/SmartStockpro/assets/css/components.css',
  '/SmartStockpro/assets/css/pages.css',
  '/SmartStockpro/assets/css/responsive.css',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
    if (res && res.status === 200 && res.type === 'basic') {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
    }
    return res;
  }).catch(() => cached)));
});
