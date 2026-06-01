const CACHE = 'ssp-v3';
const BASE  = '/smart-stock-pro';
const FILES = [
  BASE+'/',BASE+'/index.html',
  BASE+'/css/variables.css',BASE+'/css/layout.css',
  BASE+'/css/components.css',BASE+'/css/forms.css',BASE+'/css/responsive.css',
  BASE+'/js/config.js',BASE+'/js/utils.js',BASE+'/js/data.js',
  BASE+'/js/toast.js',BASE+'/js/app.js',
  BASE+'/js/pages/home.js',BASE+'/js/pages/inventory.js',
  BASE+'/js/pages/sales.js',BASE+'/js/pages/customers.js',
  BASE+'/js/pages/reports.js',BASE+'/js/pages/ai.js',BASE+'/js/pages/more.js',
  BASE+'/services/db.js',BASE+'/services/ai-service.js',
];
self.addEventListener('install',  e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',    e=>e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).catch(()=>caches.match(BASE+'/index.html')))));