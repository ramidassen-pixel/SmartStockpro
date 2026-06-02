const CACHE = 'ssp-final-v1';
const BASE = '/smart-stock-pro';
const CORE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/css/app.css',
  BASE + '/js/init.js',
  BASE + '/js/dashboard.js',
  BASE + '/js/products.js',
  BASE + '/js/expenses-salary.js',
  BASE + '/js/customers.js',
  BASE + '/js/reports.js',
  BASE + '/js/utils-extra.js',
];
self.addEventListener('install',  e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch',    e => e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match(BASE + '/index.html')))));
