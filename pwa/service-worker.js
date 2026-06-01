/* SmartStock Pro — Service Worker (offline support) */
const CACHE = 'ssp-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/dashboard.css',
  '/css/tables.css',
  '/css/forms.css',
  '/css/responsive.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/mock-data.js',
  '/js/components.js',
  '/js/toast.js',
  '/js/router.js',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/inventory.js',
  '/js/sales.js',
  '/js/customers.js',
  '/js/suppliers.js',
  '/js/expenses.js',
  '/js/payroll.js',
  '/js/reports.js',
  '/js/analytics.js',
  '/js/ai.js',
  '/js/settings.js',
  '/services/database.js',
  '/services/auth-service.js',
  '/services/notification-service.js',
  '/services/ai-service.js',
];

self.addEventListener('install',  e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch', e => e.respondWith(
  caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('/index.html')))
));
