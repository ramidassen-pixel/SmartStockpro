/* === database.js === */
// SmartStock Pro V5 — Cloud-Sync Database Engine (Stage 2B)
// localStorage = offline cache | Supabase = source of truth
// Sync status: 'synced' | 'syncing' | 'offline' | 'error'

var DB = {
  KEY: 'ssp_v5',
  _data: null,
  _bizId: null,   // set by DB.init(bizId, token) after login
  _token: null,   // Supabase access token
  _syncStatus: 'synced',
  _realtimeSub: null,
  _pendingUploads: [], // offline queue

  // ── Supabase helpers ─────────────────────────────────────────────────────
  _url() { return 'https://ovbtqkpvhivqnnxojjwu.supabase.co'; },
  _anon() { return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92YnRxa3B2aGl2cW5ueG9qand1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTQ1NDEsImV4cCI6MjA5Njc5MDU0MX0.TZ_B5NBC3uIyqMYs442umeoi3o78CCwTZW6YgHS9efw'; },
  _hdr() {
    return {
      'Content-Type': 'application/json',
      'apikey': this._anon(),
      'Authorization': 'Bearer ' + (this._token || this._anon()),
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    };
  },
  _rest(table) { return this._url() + '/rest/v1/' + table; },

  // ── Sync status indicator ────────────────────────────────────────────────
  _setStatus(s) {
    this._syncStatus = s;
    var el = document.getElementById('sync-status-indicator');
    if (!el) return;
    var map = { synced:'✅ Synced', syncing:'🔄 Syncing…', offline:'📴 Offline', error:'⚠️ Sync Error' };
    var col = { synced:'#2ecc71', syncing:'#f39c12', offline:'#95a5a6', error:'#e74c3c' };
    el.textContent = map[s] || s;
    el.style.color = col[s] || '#fff';
  },

  // ── Initialise after login ───────────────────────────────────────────────
  init: function(bizId, token) {
    this._bizId = bizId;
    this._token = token;
    this.load(); // always load local cache first so UI is instant
    this._injectSyncIndicator();
    this._startRealtime();
  },

  _injectSyncIndicator: function() {
    if (document.getElementById('sync-status-indicator')) return;
    var el = document.createElement('div');
    el.id = 'sync-status-indicator';
    el.style.cssText = 'position:fixed;bottom:60px;right:12px;z-index:9999;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);pointer-events:none;transition:opacity .4s';
    el.textContent = '✅ Synced';
    el.style.color = '#2ecc71';
    document.body.appendChild(el);
  },

  // ── Pull ALL cloud data for this business on login ───────────────────────
  syncFromCloud: function() {
    var self = this;
    if (!self._bizId || !self._token) return Promise.resolve();
    self._setStatus('syncing');

    var tables = [
      ['biz_products','products'],
      ['biz_sales','sales'],
      ['biz_customers','customers'],
      ['biz_suppliers','suppliers'],
      ['biz_expenses','expenses'],
      ['biz_employees','employees'],
      ['biz_payroll','payroll'],
      ['biz_payments','payments'],
      ['biz_quotations','quotations'],
      ['biz_allocations','allocations'],
      ['biz_purchase_orders','purchaseOrders'],
      ['biz_grns','grns'],
      ['biz_supplier_bills','supplierBills'],
      ['biz_stock_movements','stockMovements'],
      ['biz_monthly_statements','monthlyStatements'],
    ];

    var fetches = tables.map(function(pair) {
      var cloudTable = pair[0], localKey = pair[1];
      return fetch(self._rest(cloudTable) + '?business_id=eq.' + encodeURIComponent(self._bizId) + '&deleted=eq.false&select=id,data,updated_at', {
        headers: self._hdr()
      })
      .then(function(r){ return r.json(); })
      .then(function(rows) {
        if (!Array.isArray(rows)) return;
        // Merge strategy: cloud wins by updated_at
        var localArr = self.get(localKey) || [];
        var localMap = {};
        localArr.forEach(function(item) { localMap[item.id] = item; });
        rows.forEach(function(row) {
          var cloudItem = row.data;
          cloudItem.id = row.id;
          cloudItem._updatedAt = row.updated_at;
          var local = localMap[row.id];
          // Cloud wins unless local is strictly newer
          if (!local || !local._updatedAt || row.updated_at >= local._updatedAt) {
            localMap[row.id] = cloudItem;
          }
        });
        self._data[localKey] = Object.values(localMap);
      })
      .catch(function() {});
    });

    // Also fetch settings and categories
    fetches.push(
      fetch(self._rest('biz_settings') + '?business_id=eq.' + encodeURIComponent(self._bizId), { headers: self._hdr() })
      .then(function(r){ return r.json(); })
      .then(function(rows) {
        if (Array.isArray(rows) && rows.length > 0) {
          var cloud = rows[0].data || {};
          var local = self._data.settings || {};
          // Cloud wins
          self._data.settings = Object.assign({}, local, cloud);
          self._data.settings._updatedAt = rows[0].updated_at;
        }
      }).catch(function(){}),

      fetch(self._rest('biz_categories') + '?business_id=eq.' + encodeURIComponent(self._bizId), { headers: self._hdr() })
      .then(function(r){ return r.json(); })
      .then(function(rows) {
        if (Array.isArray(rows) && rows.length > 0) {
          self._data.productCategories = rows[0].categories;
        }
      }).catch(function(){})
    );

    return Promise.all(fetches).then(function() {
      self.save();
      self._setStatus('synced');
      // Flush any pending offline writes
      self._flushPending();
    }).catch(function() {
      self._setStatus('error');
    });
  },

  // ── Push a single record to cloud (upsert) ───────────────────────────────
  _push: function(cloudTable, id, data) {
    var self = this;
    if (!self._bizId || !self._token) {
      self._pendingUploads.push({ cloudTable: cloudTable, id: id, data: data });
      self._setStatus('offline');
      return;
    }
    self._setStatus('syncing');
    var payload = { id: id, business_id: self._bizId, data: data, deleted: false };
    fetch(self._rest(cloudTable), {
      method: 'POST',
      headers: self._hdr(),
      body: JSON.stringify(payload),
    })
    .then(function(r) {
      if (r.ok || r.status === 409) { self._setStatus('synced'); }
      else { self._setStatus('error'); self._pendingUploads.push({ cloudTable: cloudTable, id: id, data: data }); }
    })
    .catch(function() {
      self._setStatus('offline');
      self._pendingUploads.push({ cloudTable: cloudTable, id: id, data: data });
    });
  },

  // ── Soft-delete a record in cloud ────────────────────────────────────────
  _pushDelete: function(cloudTable, id) {
    var self = this;
    if (!self._bizId || !self._token) return;
    self._setStatus('syncing');
    fetch(self._rest(cloudTable) + '?id=eq.' + encodeURIComponent(id) + '&business_id=eq.' + encodeURIComponent(self._bizId), {
      method: 'PATCH',
      headers: self._hdr(),
      body: JSON.stringify({ deleted: true }),
    })
    .then(function(r){ self._setStatus(r.ok ? 'synced' : 'error'); })
    .catch(function(){ self._setStatus('offline'); });
  },

  // ── Push settings to cloud ───────────────────────────────────────────────
  _pushSettings: function() {
    var self = this;
    if (!self._bizId || !self._token) return;
    self._setStatus('syncing');
    var payload = { business_id: self._bizId, data: self._data.settings };
    fetch(self._rest('biz_settings'), {
      method: 'POST',
      headers: self._hdr(),
      body: JSON.stringify(payload),
    })
    .then(function(r){ self._setStatus(r.ok ? 'synced' : 'error'); })
    .catch(function(){ self._setStatus('offline'); });
  },

  // ── Push categories to cloud ─────────────────────────────────────────────
  _pushCategories: function() {
    var self = this;
    if (!self._bizId || !self._token) return;
    var payload = { business_id: self._bizId, categories: self._data.productCategories || [] };
    fetch(self._rest('biz_categories'), {
      method: 'POST',
      headers: self._hdr(),
      body: JSON.stringify(payload),
    }).catch(function(){});
  },

  // ── Flush offline queue ───────────────────────────────────────────────────
  _flushPending: function() {
    var self = this;
    var queue = self._pendingUploads.slice();
    self._pendingUploads = [];
    queue.forEach(function(item) {
      self._push(item.cloudTable, item.id, item.data);
    });
  },

  // ── Realtime subscriptions (Supabase Realtime via websocket) ─────────────
  _startRealtime: function() {
    var self = this;
    if (!self._bizId || !self._token) return;
    // Use native WebSocket to subscribe to Postgres changes
    try {
      var wsUrl = 'wss://ovbtqkpvhivqnnxojjwu.supabase.co/realtime/v1/websocket?apikey=' + self._anon() + '&vsn=1.0.0';
      var ws = new WebSocket(wsUrl);
      self._realtimeSub = ws;

      ws.onopen = function() {
        // Join the realtime channel for this business
        var tables = ['biz_products','biz_sales','biz_customers','biz_suppliers','biz_expenses','biz_employees','biz_payroll','biz_payments','biz_quotations','biz_allocations','biz_purchase_orders','biz_grns','biz_supplier_bills','biz_stock_movements','biz_categories','biz_settings'];
        tables.forEach(function(t, i) {
          ws.send(JSON.stringify({
            topic: 'realtime:public:' + t + ':business_id=eq.' + self._bizId,
            event: 'phx_join',
            payload: { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table: t, filter: 'business_id=eq.' + self._bizId }] }, access_token: self._token },
            ref: String(i + 1)
          }));
        });
      };

      ws.onmessage = function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.event !== 'postgres_changes') return;
          var payload = msg.payload && msg.payload.data;
          if (!payload) return;
          // Re-pull the changed table from cloud to keep local cache in sync
          self._pullTableByEvent(payload.table, payload.type, payload.record, payload.old_record);
        } catch(err) {}
      };

      ws.onerror = function() { self._setStatus('offline'); };
      ws.onclose = function() {
        // Reconnect after 5s
        setTimeout(function() { self._startRealtime(); }, 5000);
      };
    } catch(e) {}
  },

  _pullTableByEvent: function(cloudTable, eventType, record, oldRecord) {
    var self = this;
    var keyMap = {
      'biz_products':'products','biz_sales':'sales','biz_customers':'customers',
      'biz_suppliers':'suppliers','biz_expenses':'expenses','biz_employees':'employees',
      'biz_payroll':'payroll','biz_payments':'payments','biz_quotations':'quotations',
      'biz_allocations':'allocations','biz_purchase_orders':'purchaseOrders',
      'biz_grns':'grns','biz_supplier_bills':'supplierBills',
      'biz_stock_movements':'stockMovements','biz_monthly_statements':'monthlyStatements',
    };
    var localKey = keyMap[cloudTable];

    if (cloudTable === 'biz_settings') {
      if (record && record.data) {
        self._data.settings = Object.assign({}, self._data.settings, record.data);
        self.save();
        self._notifyRefresh();
      }
      return;
    }
    if (cloudTable === 'biz_categories') {
      if (record && record.categories) {
        self._data.productCategories = record.categories;
        self.save();
        self._notifyRefresh();
      }
      return;
    }
    if (!localKey) return;

    var arr = self._data[localKey] || [];
    if (eventType === 'DELETE' || (record && record.deleted)) {
      var delId = (oldRecord && oldRecord.id) || (record && record.id);
      self._data[localKey] = arr.filter(function(x){ return x.id !== delId; });
    } else if (record && record.data) {
      var item = record.data;
      item.id = record.id;
      item._updatedAt = record.updated_at;
      var idx = arr.findIndex(function(x){ return x.id === item.id; });
      if (idx > -1) arr[idx] = item;
      else arr.unshift(item);
      self._data[localKey] = arr;
    }
    self.save();
    self._notifyRefresh();
  },

  // Notify the app to re-render the current page after a realtime push
  _notifyRefresh: function() {
    try {
      var page = window.location.hash || '';
      if (typeof Router !== 'undefined' && Router.current) {
        // Soft refresh: let each module re-render if it has a render() fn
        var mod = Router.current;
        if (mod && typeof mod.render === 'function') mod.render();
      }
    } catch(e) {}
  },

  // ── Local cache (localStorage) ───────────────────────────────────────────
  _default: function() {
    return {
      settings: { bizName:'SmartStock Pro', currency:'$', tax:0, lowStock:5, theme:'dark' },
      users: [], products: [], sales: [], customers: [], suppliers: [],
      expenses: [], employees: [], payroll: [], notifications: [],
      payments: [], allocations: [], purchaseOrders: [], grns: [],
      supplierBills: [], quotations: [], employeeLoans: [], stockMovements: [],
      monthlyStatements: [], businesses: [], branches: [], customRoles: [],
      auditLogs: [], activityLogs: [],
    };
  },

  load: function() {
    var raw = Utils.storage.get(this.KEY);
    this._data = raw || this._default();
    var d = this._data;
    ['users','products','sales','customers','suppliers','expenses','employees','payroll',
     'notifications','payments','allocations','purchaseOrders','grns','supplierBills',
     'quotations','employeeLoans','businesses','branches','customRoles','auditLogs','activityLogs',
     'stockMovements','monthlyStatements']
      .forEach(function(k){ if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.settings) d.settings = this._default().settings;
    return this._data;
  },

  save: function() { if (this._data) Utils.storage.set(this.KEY, this._data); },
  get: function(key) { if (!this._data) this.load(); return this._data[key]; },
  set: function(key, val) { if (!this._data) this.load(); this._data[key] = val; this.save(); },

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: function() { return this.get('settings') || {}; },
  saveSettings: function(s) {
    this._data.settings = Object.assign({}, this.getSettings(), s);
    this.save();
    this._pushSettings();
  },

  // ── Products ─────────────────────────────────────────────────────────────
  getProducts: function() { return this.get('products') || []; },
  getCategories: function() {
    var custom = this.get('productCategories');
    if (custom && custom.length) return custom;
    return ['Tiles','Cement','Tools','Paint','Plumbing','Electrical','Adhesives','Stone','Mosaic','Paving','Other'];
  },
  saveCategories: function(arr) {
    this.set('productCategories', arr);
    this._pushCategories();
  },
  addProduct: function(p) {
    p.id = Utils.uid('P'); p.createdAt = Utils.today();
    var arr = this.get('products'); arr.push(p); this.save();
    this._push('biz_products', p.id, p);
    return p;
  },
  updateProduct: function(id, data) {
    var arr = this.get('products'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data, { updatedAt: Utils.today() }); this.save(); this._push('biz_products', id, arr[i]); }
  },
  deleteProduct: function(id) {
    this._data.products = this.get('products').filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_products', id);
  },

  // ── Sales ─────────────────────────────────────────────────────────────────
  getSales: function() { return this.get('sales') || []; },
  addSale: function(s) {
    s.id = Utils.uid('INV'); s.createdAt = Utils.today();
    var arr = this.get('sales'); arr.unshift(s); this.save();
    this._push('biz_sales', s.id, s);
    return s;
  },
  updateSale: function(id, data) {
    var arr = this.get('sales'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_sales', id, arr[i]); }
  },
  deleteSale: function(id) {
    this._data.sales = this.get('sales').filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_sales', id);
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  getCustomers: function() { return this.get('customers') || []; },
  addCustomer: function(c) {
    c.id = Utils.uid('C'); c.createdAt = Utils.today(); c.totalSpent=0; c.purchases=0;
    var arr = this.get('customers'); arr.push(c); this.save();
    this._push('biz_customers', c.id, c);
    return c;
  },
  updateCustomer: function(id, data) {
    var arr = this.get('customers'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_customers', id, arr[i]); }
  },
  deleteCustomer: function(id) {
    this._data.customers = this.get('customers').filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_customers', id);
  },
  findOrCreateCustomer: function(name, phone) {
    if (!name || name.toLowerCase() === 'walk-in customer') return null;
    var existing = this.getCustomers().find(function(c){ return c.name.toLowerCase().trim() === name.toLowerCase().trim(); });
    if (existing) return existing;
    return this.addCustomer({ name: name.trim(), phone: phone||'', email:'', status:'Active', credit:0 });
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────
  getSuppliers: function() { return this.get('suppliers') || []; },
  addSupplier: function(s) {
    s.id = Utils.uid('S'); s.createdAt = Utils.today();
    var arr = this.get('suppliers'); arr.push(s); this.save();
    this._push('biz_suppliers', s.id, s);
    return s;
  },
  updateSupplier: function(id, data) {
    var arr = this.get('suppliers'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_suppliers', id, arr[i]); }
  },
  deleteSupplier: function(id) {
    this._data.suppliers = this.get('suppliers').filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_suppliers', id);
  },

  // ── Expenses ──────────────────────────────────────────────────────────────
  getExpenses: function() { return this.get('expenses') || []; },
  addExpense: function(e) {
    e.id = Utils.uid('EXP'); e.createdAt = Utils.today();
    var arr = this.get('expenses'); arr.unshift(e); this.save();
    this._push('biz_expenses', e.id, e);
    return e;
  },
  deleteExpense: function(id) {
    this._data.expenses = this.get('expenses').filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_expenses', id);
  },

  // ── Employees ─────────────────────────────────────────────────────────────
  getEmployees: function() { return this.get('employees') || []; },
  addEmployee: function(e) {
    e.id = Utils.uid('E'); e.createdAt = Utils.today();
    var arr = this.get('employees'); arr.push(e); this.save();
    this._push('biz_employees', e.id, e);
    return e;
  },
  updateEmployee: function(id, data) {
    var arr = this.get('employees'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_employees', id, arr[i]); }
  },
  deleteEmployee: function(id) {
    this._data.employees = this.get('employees').filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_employees', id);
  },

  // ── Payroll ───────────────────────────────────────────────────────────────
  getPayroll: function() { return this.get('payroll') || []; },
  addPayroll: function(p) {
    p.id = Utils.uid('PAY'); p.paidAt = Utils.today();
    var arr = this.get('payroll'); arr.unshift(p); this.save();
    this._push('biz_payroll', p.id, p);
    return p;
  },

  // ── Monthly Statements ────────────────────────────────────────────────────
  getMonthlyStatements: function() { return this.get('monthlyStatements') || []; },
  saveMonthlyStatement: function(stmt) {
    var arr = this.get('monthlyStatements') || [];
    var idx = arr.findIndex(function(s){ return s.id===stmt.id; });
    if (idx >= 0) arr[idx] = stmt; else arr.unshift(stmt);
    this.set('monthlyStatements', arr);
    this._push('biz_monthly_statements', stmt.id, stmt);
    return stmt;
  },

  // ── Stock Movements ───────────────────────────────────────────────────────
  getStockMovements: function() { return this.get('stockMovements') || []; },
  addStockMovement: function(mv) {
    mv.id = mv.id || Utils.uid('SM');
    var arr = this.get('stockMovements') || []; arr.unshift(mv); this.set('stockMovements', arr);
    this._push('biz_stock_movements', mv.id, mv);
  },

  // ── Payments (partial sale payments) ─────────────────────────────────────
  getPayments: function() { return this.get('payments') || []; },
  addPayment: function(p) {
    p.id = Utils.uid('PAY'); p.paidAt = new Date().toISOString();
    var arr = this.get('payments'); arr.unshift(p); this.save();
    this._push('biz_payments', p.id, p);
    return p;
  },
  getPaymentsForSale: function(saleId) { return this.getPayments().filter(function(p){ return p.saleId === saleId; }); },
  getPaymentsForCustomer: function(custId) { return this.getPayments().filter(function(p){ return p.customerId === custId; }); },

  // ── Allocations ───────────────────────────────────────────────────────────
  getAllocations: function() { return this.get('allocations') || []; },
  addAllocation: function(a) {
    a.id = Utils.uid('ALC'); a.createdAt = Utils.today();
    var arr = this.get('allocations'); arr.push(a); this.save();
    this._push('biz_allocations', a.id, a);
    return a;
  },
  updateAllocation: function(id, data) {
    var arr = this.get('allocations'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_allocations', id, arr[i]); }
  },
  deleteAllocation: function(id) {
    this._data.allocations = this.getAllocations().filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_allocations', id);
  },
  getAllocatedDaily: function() {
    var today = Utils.today();
    return this.getAllocations().filter(function(a){
      if (!a.startDate || a.startDate > today) return false;
      if (a.endDate && a.endDate < today) return false;
      return true;
    });
  },
  getAllocatedDailyTotal: function() {
    return this.getAllocatedDaily().reduce(function(sum,a){ return sum+(parseFloat(a.daily)||0); }, 0);
  },

  // ── Purchase Orders ───────────────────────────────────────────────────────
  getPurchaseOrders: function() { return this.get('purchaseOrders') || []; },
  addPurchaseOrder: function(p) {
    p.id = Utils.uid('PO'); p.createdAt = Utils.today();
    var arr = this.get('purchaseOrders'); arr.unshift(p); this.save();
    this._push('biz_purchase_orders', p.id, p);
    return p;
  },
  updatePurchaseOrder: function(id, data) {
    var arr = this.get('purchaseOrders'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_purchase_orders', id, arr[i]); }
  },
  deletePurchaseOrder: function(id) {
    this._data.purchaseOrders = this.getPurchaseOrders().filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_purchase_orders', id);
  },

  // ── GRNs ──────────────────────────────────────────────────────────────────
  getGRNs: function() { return this.get('grns') || []; },
  addGRN: function(g) {
    g.id = Utils.uid('GRN'); g.createdAt = Utils.today();
    var arr = this.get('grns'); arr.unshift(g); this.save();
    this._push('biz_grns', g.id, g);
    return g;
  },
  updateGRN: function(id, data) {
    var arr = this.get('grns'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_grns', id, arr[i]); }
  },

  // ── Supplier Bills ────────────────────────────────────────────────────────
  getSupplierBills: function() { return this.get('supplierBills') || []; },
  addSupplierBill: function(b) {
    b.id = Utils.uid('BILL'); b.createdAt = Utils.today();
    var arr = this.get('supplierBills'); arr.unshift(b); this.save();
    this._push('biz_supplier_bills', b.id, b);
    return b;
  },
  updateSupplierBill: function(id, data) {
    var arr = this.get('supplierBills'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_supplier_bills', id, arr[i]); }
  },
  deleteSupplierBill: function(id) {
    this._data.supplierBills = this.getSupplierBills().filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_supplier_bills', id);
  },

  // ── Quotations ────────────────────────────────────────────────────────────
  getQuotations: function() { return this.get('quotations') || []; },
  addQuotation: function(q) {
    var yr = new Date().getFullYear();
    var num = String(this.getQuotations().length + 1).padStart(4,'0');
    q.id = 'QT-' + yr + '-' + num; q.createdAt = Utils.today();
    var arr = this.get('quotations'); arr.unshift(q); this.save();
    this._push('biz_quotations', q.id, q);
    return q;
  },
  updateQuotation: function(id, data) {
    var arr = this.get('quotations'), i = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); this._push('biz_quotations', id, arr[i]); }
  },
  deleteQuotation: function(id) {
    this._data.quotations = this.getQuotations().filter(function(x){ return x.id!==id; }); this.save();
    this._pushDelete('biz_quotations', id);
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  stats: function() {
    var sales    = this.getSales();
    var expenses = this.getExpenses();
    var products = this.getProducts();
    var today    = Utils.today();
    var month    = today.slice(0,7);
    var todaySales  = sales.filter(function(s){ return s.date===today; });
    var monthSales  = sales.filter(function(s){ return s.date&&s.date.startsWith(month); });
    var monthExp    = expenses.filter(function(e){ return e.date&&e.date.startsWith(month); });
    var totalRev    = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var totalExp    = monthExp.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var todayRev    = todaySales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var totalCogs   = monthSales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost||0)*parseInt(i.qty||1)); },0); }, 0);
    var lowStock    = products.filter(function(p){ return p.qty<=(p.lowLevel||5)&&p.status!=='inactive'; });
    var outStock    = products.filter(function(p){ return p.qty===0&&p.status!=='inactive'; });
    var allocatedDaily = this.getAllocatedDailyTotal();
    var trueNetProfit  = totalRev - totalExp - allocatedDaily;
    return { totalRev:totalRev, totalExp:totalExp, todayRev:todayRev,
      netProfit:totalRev-totalExp, trueNetProfit:trueNetProfit,
      allocatedDaily:allocatedDaily, totalCogs:totalCogs,
      grossProfit:totalRev-totalCogs, lowStock:lowStock, outStock:outStock,
      todayCount:todaySales.length, monthCount:monthSales.length };
  },
};
