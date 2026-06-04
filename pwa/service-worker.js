var CACHE = 'ssp-v5-1';
var BASE = '/smart-stock-pro';
var CORE = [BASE+'/',BASE+'/index.html',
  BASE+'/assets/css/variables.css',BASE+'/assets/css/reset.css',BASE+'/assets/css/layout.css',
  BASE+'/assets/css/components.css',BASE+'/assets/css/pages.css',BASE+'/assets/css/responsive.css',
  BASE+'/assets/js/utils.js',BASE+'/assets/js/database.js',BASE+'/assets/js/auth.js',
  BASE+'/assets/js/router.js',BASE+'/assets/js/notifications.js',BASE+'/assets/js/charts.js',
  BASE+'/assets/js/app.js',
  BASE+'/modules/dashboard/dashboard.js',BASE+'/modules/products/products.js',
  BASE+'/modules/sales/sales.js',BASE+'/modules/customers/customers.js',
  BASE+'/modules/suppliers/suppliers.js',BASE+'/modules/expenses/expenses.js',
  BASE+'/modules/salary/salary.js',BASE+'/modules/finance/finance.js',
  BASE+'/modules/reports/reports.js',BASE+'/modules/ai/ai.js',
  BASE+'/modules/settings/settings.js',BASE+'/modules/settings/more.js',
];
self.addEventListener('install', e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e=>e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).catch(()=>caches.match(BASE+'/index.html')))));
