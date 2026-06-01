/* SmartStock Pro — Service Worker */
const CACHE = 'ssp-v2';
const BASE  = '/smart-stock-pro';

const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/css/variables.css',
  BASE + '/css/layout.css',
  BASE + '/css/components.css',
  BASE + '/css/dashboard.css',
  BASE + '/css/tables.css',
  BASE + '/css/forms.css',
  BASE + '/css/responsive.css',
  BASE + '/js/config.js',
  BASE + '/js/utils.js',
  BASE + '/js/mock-data.js',
  BASE + '/js/components.js',
  BASE + '/js/toast.js',
  BASE + '/js/router.js',
  BASE + '/js/app.js',
  BASE + '/js/dashboard.js',
  BASE + '/js/inventory.js',
  BASE + '/js/sales.js',
  BASE + '/js/customers.js',
  BASE + '/js/suppliers.js',
  BASE + '/js/expenses.js',
  BASE + '/js/payroll.js',
  BASE + '/js/reports.js',
  BASE + '/js/analytics.js',
  BASE + '/js/ai.js',
  BASE + '/js/settings.js',
  BASE + '/js/notifications.js',
  BASE + '/js/auth.js',
  BASE + '/services/database.js',
  BASE + '/services/auth-service.js',
  BASE + '/services/notification-service.js',
  BASE + '/services/ai-service.js',
];

/* Install — cache all files */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* Activate — remove old caches */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Fetch — serve from cache, fallback to network */
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .catch(() => caches.match(BASE + '/index.html'))
      )
  );
});
