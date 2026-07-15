const CACHE = 'ssp-v6.1';
const ASSETS = [
  './',
  'index.html',
  'confirm.html',
  'reset.html',
  'forgot.html',
  'assets/css/variables.css',
  'assets/css/reset.css',
  'assets/css/layout.css',
  'assets/css/components.css',
  'assets/css/pages.css',
  'assets/css/responsive.css',
  'assets/js/utils.js',
  'assets/js/database.js',
  'assets/js/auth.js',
  'assets/js/quickcreate.js',
  'assets/js/router.js',
  'assets/js/notifications.js',
  'assets/js/charts.js',
  'assets/js/app.js',
  'assets/js/rbac.js',
  'assets/js/platform.js',
  'modules/dashboard/dashboard.js',
  'modules/products/products.js',
  'modules/sales/sales.js',
  'modules/customers/customers.js',
  'modules/suppliers/suppliers.js',
  'modules/suppliers/supply.js',
  'modules/expenses/expenses.js',
  'modules/expenses/allocations.js',
  'modules/salary/salary.js',
  'modules/finance/finance.js',
  'modules/reports/reports.js',
  'modules/quotations/quotations.js',
  'modules/ai/ai.js',
  'modules/settings/settings.js',
  'assets/js/globalsearch.js',
  'modules/settings/more.js',
  'modules/users/usermgmt.js',
  'modules/closing/closing.js',
  'modules/support/support.js',
  'modules/settings/backup.js',
  'modules/products/stock.js',
  'assets/js/boot.js',
  'pwa/manifest.json',
  'pwa/icon-192.png',
  'pwa/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
