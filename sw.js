const CACHE = 'ssp-v6.35';
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
  'assets/css/desktop.css',
  'assets/js/icons.js',
  'assets/js/sidebar.js',
  'assets/js/privacy.js',
  'assets/js/utils.js',
  'assets/js/qr.js',
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
  'modules/sales/receipt-scan.js',
  'modules/customers/customers.js',
  'modules/suppliers/suppliers.js',
  'modules/suppliers/supply.js',
  'modules/expenses/expenses.js',
  'modules/expenses/allocations.js',
  'modules/salary/salary.js',
  'modules/finance/finance.js',
  'modules/reports/reports.js',
  'modules/quotations/quotations.js',
  'modules/billing/billing.js',
  'modules/ai/ai.js',
  'modules/settings/settings.js',
  'assets/js/globalsearch.js',
  'modules/settings/more.js',
  'modules/usermgmt/usermgmt.js',
  'modules/closing/closing.js',
  'modules/support/support.js',
  'modules/settings/backup.js',
  'modules/products/stock.js',
  'assets/js/install.js',
  'assets/js/boot.js',
  'pwa/manifest.json',
  'pwa/icon-192.png',
  'pwa/icon-512.png'
];
self.addEventListener('install', e => {
  // cache: 'reload' bypasses the browser HTTP cache so a new version never precaches stale files
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first: when online, always use the newest files (so every device runs the
// same version); fall back to the cached copy only when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return; // never touch Supabase/API calls
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(cached =>
      cached || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined)
    ))
  );
});
