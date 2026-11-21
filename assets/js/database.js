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
    var self = this;
    this._bizId = bizId;
    this._token = token;
    // 🔒 DATA ISOLATION: every business gets its OWN local cache key.
    // Previously a single shared key ('ssp_v5') let a new account on the
    // same device see the previous business's data.
    this.KEY = 'ssp_v5_' + bizId;
    Utils.storage.del('ssp_v5'); // remove the old shared cache for good
    this._data = null;           // drop anything loaded before login
    this.load(); // always load local cache first so UI is instant
    this._loadQueue();
    this._injectSyncIndicator();
    this._startRealtime();

    // Keep devices in step: re-sync when the app comes back to the foreground,
    // when the network returns, and every 2 minutes while open.
    if (!this._listenersAdded) {
      this._listenersAdded = true;
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') self._resyncSoon();
      });
      window.addEventListener('online', function() { self._resyncSoon(); });
      setInterval(function() {
        if (document.visibilityState === 'visible') self._resyncSoon();
      }, 120000);
    }
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

  // ── Cloud table ↔ local key map ──────────────────────────────────────────
  _tables: [
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
  ],

  // ── Access token: refresh before it expires (Supabase tokens last ~1h) ───
  _ensureToken: function() {
    var self = this;
    if (typeof Auth === 'undefined' || !Auth._session) return Promise.resolve(self._token);
    var sess = Auth._session;
    if (sess.access_token && Date.now() < (sess.expires_at || 0) - 120000) {
      self._token = sess.access_token;
      return Promise.resolve(self._token);
    }
    if (typeof Auth.refreshSession !== 'function') return Promise.resolve(self._token);
    return Auth.refreshSession().then(function(newSess) {
      if (newSess && newSess.access_token) {
        var changed = self._token !== newSess.access_token;
        self._token = newSess.access_token;
        // Realtime socket was joined with the old token: reconnect with the new one
        if (changed && self._realtimeSub) { try { self._realtimeSub.close(); } catch(e) {} }
      }
      return self._token;
    }).catch(function() { return self._token; });
  },

  // ── Persistent upload queue (survives refresh / app close) ───────────────
  _queueKey: function() { return 'ssp_pending_' + (this._bizId || 'none'); },
  _loadQueue: function() {
    var q = Utils.storage.get(this._queueKey());
    // carry over anything queued in memory before login
    this._pendingUploads = (Array.isArray(q) ? q : []).concat(this._pendingUploads || []);
    this._saveQueue();
  },
  _saveQueue: function() {
    if (this._bizId) Utils.storage.set(this._queueKey(), this._pendingUploads);
  },
  _enqueue: function(item) {
    // Keep only the latest change per record
    this._pendingUploads = (this._pendingUploads || []).filter(function(x) {
      return !(x.cloudTable === item.cloudTable && x.id === item.id);
    });
    this._pendingUploads.push(item);
    this._saveQueue();
    this._scheduleFlush();
  },
  _isPending: function(cloudTable, id) {
    return (this._pendingUploads || []).some(function(x) {
      return x.cloudTable === cloudTable && (x.id === id || (x.op === 'delbulk' && x.ids.indexOf(id) >= 0));
    });
  },
  _scheduleFlush: function() {
    var self = this;
    clearTimeout(self._flushTimer);
    self._flushTimer = setTimeout(function() { self._flushPending(); }, 300);
  },

  // ── Push a single record to cloud (queued, upserted) ─────────────────────
  _push: function(cloudTable, id, data) {
    this._enqueue({ op: 'up', cloudTable: cloudTable, id: id, data: data });
  },

  // ── Soft-delete a record in cloud ────────────────────────────────────────
  _pushDelete: function(cloudTable, id) {
    this._enqueue({ op: 'del', cloudTable: cloudTable, id: id });
  },

  // ── Push settings to cloud ───────────────────────────────────────────────
  _pushSettings: function() {
    this._enqueue({ op: 'settings', cloudTable: 'biz_settings', id: '_settings' });
  },

  // ── Push categories to cloud ─────────────────────────────────────────────
  _pushCategories: function() {
    this._enqueue({ op: 'categories', cloudTable: 'biz_categories', id: '_categories' });
  },

  // Send one queued item; resolves true on success
  _sendItem: function(item) {
    var self = this, url, opts;
    var hdr = self._hdr();
    if (item.op === 'del') {
      url = self._rest(item.cloudTable) + '?id=eq.' + encodeURIComponent(item.id) + '&business_id=eq.' + encodeURIComponent(self._bizId);
      opts = { method: 'PATCH', headers: hdr, body: JSON.stringify({ deleted: true }) };
    } else if (item.op === 'delbulk') {
      // Soft-delete many records in one request: id=in.("a","b",...)
      var list = item.ids.map(function(x){ return '"' + String(x).replace(/"/g, '') + '"'; }).join(',');
      url = self._rest(item.cloudTable) + '?id=in.(' + encodeURIComponent(list) + ')&business_id=eq.' + encodeURIComponent(self._bizId);
      opts = { method: 'PATCH', headers: hdr, body: JSON.stringify({ deleted: true }) };
    } else if (item.op === 'settings') {
      url = self._rest('biz_settings');
      opts = { method: 'POST', headers: hdr, body: JSON.stringify({ business_id: self._bizId, data: self._data.settings, updated_at: new Date().toISOString() }) };
    } else if (item.op === 'categories') {
      url = self._rest('biz_categories');
      opts = { method: 'POST', headers: hdr, body: JSON.stringify({ business_id: self._bizId, categories: self._data.productCategories || [] }) };
    } else if (item.op === 'bulk') {
      url = self._rest(item.cloudTable);
      opts = { method: 'POST', headers: hdr, body: JSON.stringify(item.rows) };
    } else {
      url = self._rest(item.cloudTable);
      opts = { method: 'POST', headers: hdr, body: JSON.stringify({ id: item.id, business_id: self._bizId, data: item.data, deleted: false }) };
    }
    return fetch(url, opts).then(function(r) { return { ok: r.ok || r.status === 409, status: r.status }; });
  },

  // ── Flush queue: send everything, keep what fails for next time ──────────
  _flushPending: function() {
    var self = this;
    if (!self._bizId || !self._token) { if ((self._pendingUploads||[]).length) self._setStatus('offline'); return Promise.resolve(); }
    if (self._flushing) return self._flushing;
    if (!(self._pendingUploads || []).length) return Promise.resolve();
    self._setStatus('syncing');

    self._flushing = self._ensureToken().then(function() {
      var queue = self._pendingUploads.slice();
      var failed = false, retriedAuth = false;
      // Sequential, so order is kept and we can stop on network loss
      return queue.reduce(function(p, item) {
        return p.then(function() {
          if (failed) return;
          return self._sendItem(item).then(function(res) {
            if (res.status === 401 && !retriedAuth) {
              retriedAuth = true;
              if (Auth._session) Auth._session.expires_at = 0; // force refresh
              return self._ensureToken().then(function() { return self._sendItem(item); });
            }
            return res;
          }).then(function(res) {
            if (res && res.ok) {
              // remove exactly this item (a newer change for the same record may have been queued meanwhile)
              self._pendingUploads = self._pendingUploads.filter(function(x) { return x !== item; });
              self._saveQueue();
            } else {
              failed = true;
            }
          }).catch(function() { failed = true; });
        });
      }, Promise.resolve()).then(function() {
        self._setStatus(failed ? (navigator.onLine === false ? 'offline' : 'error') : 'synced');
      });
    }).then(function() { self._flushing = null; }, function() { self._flushing = null; });
    return self._flushing;
  },

  // GET with the current token; if the server rejects it (expired/revoked), refresh once and retry
  _authGet: function(url) {
    var self = this;
    return fetch(url, { headers: self._hdr() }).then(function(r) {
      if (r.status !== 401) return r;
      if (typeof Auth !== 'undefined' && Auth._session) Auth._session.expires_at = 0;
      return self._ensureToken().then(function() { return fetch(url, { headers: self._hdr() }); });
    });
  },

  // ── Fetch every row of a table, page by page (API returns max 1000 per call)
  _fetchAll: function(cloudTable, select) {
    var self = this, PAGE = 1000, all = [];
    function page(offset) {
      return self._authGet(self._rest(cloudTable) + '?business_id=eq.' + encodeURIComponent(self._bizId)
          + '&select=' + select + '&order=id.asc&limit=' + PAGE + '&offset=' + offset)
        .then(function(r) {
          if (!r.ok) throw new Error(cloudTable + ' HTTP ' + r.status);
          return r.json();
        })
        .then(function(rows) {
          if (!Array.isArray(rows)) throw new Error(cloudTable + ' bad response');
          all = all.concat(rows);
          return rows.length === PAGE ? page(offset + PAGE) : all;
        });
    }
    return page(0);
  },

  _resyncSoon: function() {
    var self = this;
    if (!self._bizId || !self._token) return;
    if (self._lastSync && Date.now() - self._lastSync < 20000) return; // not more than every 20s
    clearTimeout(self._resyncTimer);
    self._resyncTimer = setTimeout(function() { self.syncFromCloud(); }, 500);
  },

  // ── Pull ALL cloud data for this business ────────────────────────────────
  syncFromCloud: function() {
    var self = this;
    if (!self._bizId || !self._token) return Promise.resolve();
    if (self._syncing) return self._syncing;
    self._lastSync = Date.now();
    self._setStatus('syncing');
    var hadError = false;

    self._syncing = self._ensureToken()
    .then(function() { return self._flushPending(); }) // send local changes first so the cloud copy is current
    .then(function() {
      var fetches = self._tables.map(function(pair) {
        var cloudTable = pair[0], localKey = pair[1];
        return self._fetchAll(cloudTable, 'id,data,updated_at,deleted').then(function(rows) {
          var localArr = self.get(localKey) || [];
          var localMap = {}, cloudIds = {};
          localArr.forEach(function(item) { localMap[item.id] = item; });
          rows.forEach(function(row) {
            cloudIds[row.id] = true;
            if (self._isPending(cloudTable, row.id)) return; // local change not uploaded yet: keep it
            if (row.deleted) { delete localMap[row.id]; return; }
            var cloudItem = row.data || {};
            cloudItem.id = row.id;
            cloudItem._updatedAt = row.updated_at;
            localMap[row.id] = cloudItem;
          });
          // Self-heal: records that only exist on this device (an earlier upload failed) → upload them now
          var missing = Object.keys(localMap).filter(function(id) {
            return id && !cloudIds[id] && !self._isPending(cloudTable, id);
          });
          for (var i = 0; i < missing.length; i += 200) {
            var rowsOut = missing.slice(i, i + 200).map(function(id) {
              return { id: id, business_id: self._bizId, data: localMap[id], deleted: false };
            });
            self._pendingUploads.push({ op: 'bulk', cloudTable: cloudTable, id: '_bulk_' + Date.now() + '_' + i, rows: rowsOut });
          }
          // Keep newest first for the lists the app builds that way (sales/expenses)
          var merged = Object.values(localMap);
          if (localKey === 'sales' || localKey === 'expenses') merged.sort(function(a, b) {
            var da = String(a.date || a.createdAt || ''), db = String(b.date || b.createdAt || '');
            return da < db ? 1 : da > db ? -1 : 0;
          });
          self._data[localKey] = merged;
        }).catch(function() { hadError = true; });
      });

      fetches.push(
        self._authGet(self._rest('biz_settings') + '?business_id=eq.' + encodeURIComponent(self._bizId))
        .then(function(r){ if (!r.ok) throw new Error('settings'); return r.json(); })
        .then(function(rows) {
          if (Array.isArray(rows) && rows.length > 0 && !self._isPending('biz_settings', '_settings')) {
            var cloud = rows[0].data || {};
            self._data.settings = Object.assign({}, self._data.settings || {}, cloud);
            self._data.settings._updatedAt = rows[0].updated_at;
          }
        }).catch(function(){ hadError = true; }),

        self._authGet(self._rest('biz_categories') + '?business_id=eq.' + encodeURIComponent(self._bizId))
        .then(function(r){ if (!r.ok) throw new Error('categories'); return r.json(); })
        .then(function(rows) {
          if (Array.isArray(rows) && rows.length > 0 && !self._isPending('biz_categories', '_categories')) {
            self._data.productCategories = rows[0].categories;
          }
        }).catch(function(){ hadError = true; })
      );
      return Promise.all(fetches);
    })
    .then(function() {
      self.save();
      self._saveQueue();
      self._notifyRefresh(true);
      return self._flushPending(); // uploads any self-heal batches
    })
    .then(function() {
      if (hadError) self._setStatus(navigator.onLine === false ? 'offline' : 'error');
      else if (!(self._pendingUploads || []).length) self._setStatus('synced');
    })
    .catch(function() { self._setStatus('error'); })
    .then(function() { self._syncing = null; });
    return self._syncing;
  },

  // ── Realtime subscriptions (Supabase Realtime via websocket) ─────────────
  _startRealtime: function() {
    var self = this;
    if (!self._bizId || !self._token) return;
    if (self._realtimeSub && self._realtimeSub.readyState <= 1) return; // already connecting/open
    try {
      var wsUrl = 'wss://ovbtqkpvhivqnnxojjwu.supabase.co/realtime/v1/websocket?apikey=' + self._anon() + '&vsn=1.0.0';
      var ws = new WebSocket(wsUrl);
      self._realtimeSub = ws;
      var hb = null, ref = 100;

      ws.onopen = function() {
        // Join the realtime channel for this business
        var tables = self._tables.map(function(p){ return p[0]; }).concat(['biz_categories','biz_settings']);
        tables.forEach(function(t, i) {
          ws.send(JSON.stringify({
            topic: 'realtime:public:' + t + ':business_id=eq.' + self._bizId,
            event: 'phx_join',
            payload: { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table: t, filter: 'business_id=eq.' + self._bizId }] }, access_token: self._token },
            ref: String(i + 1)
          }));
        });
        // Heartbeat: the server drops sockets that stay silent for ~60s
        hb = setInterval(function() {
          try { ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) })); } catch(e) {}
        }, 25000);
        // Catch up on anything missed while disconnected
        self._resyncSoon();
      };

      ws.onmessage = function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.event !== 'postgres_changes') return;
          var payload = msg.payload && msg.payload.data;
          if (!payload) return;
          self._pullTableByEvent(payload.table, payload.type, payload.record, payload.old_record);
        } catch(err) {}
      };

      ws.onerror = function() {};
      ws.onclose = function() {
        clearInterval(hb);
        if (self._realtimeSub === ws) self._realtimeSub = null;
        // Reconnect after 5s (with a fresh token if needed)
        setTimeout(function() { self._ensureToken().then(function(){ self._startRealtime(); }); }, 5000);
      };
    } catch(e) {}
  },

  _pullTableByEvent: function(cloudTable, eventType, record, oldRecord) {
    var self = this;
    var localKey = null;
    self._tables.forEach(function(p){ if (p[0] === cloudTable) localKey = p[1]; });

    if (cloudTable === 'biz_settings') {
      if (record && record.data && !self._isPending('biz_settings', '_settings')) {
        self._data.settings = Object.assign({}, self._data.settings, record.data);
        self.save();
        self._notifyRefresh();
      }
      return;
    }
    if (cloudTable === 'biz_categories') {
      if (record && record.categories && !self._isPending('biz_categories', '_categories')) {
        self._data.productCategories = record.categories;
        self.save();
        self._notifyRefresh();
      }
      return;
    }
    if (!localKey) return;
    var id = (record && record.id) || (oldRecord && oldRecord.id);
    if (id && self._isPending(cloudTable, id)) return; // our own newer change is on its way

    var arr = self._data[localKey] || [];
    if (eventType === 'DELETE' || (record && record.deleted)) {
      self._data[localKey] = arr.filter(function(x){ return x.id !== id; });
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

  // Re-render the current page (and top bar) after cloud data changes
  _notifyRefresh: function(now) {
    var self = this;
    clearTimeout(self._refreshTimer);
    self._refreshTimer = setTimeout(function() {
      try {
        // Profile photo + logo live in the synced settings
        var s = self.getSettings();
        if (typeof Auth !== 'undefined' && Auth.currentUser && typeof Settings !== 'undefined') {
          var photos = s.userPhotos || {};
          if (Object.prototype.hasOwnProperty.call(photos, Auth.currentUser.id)) {
            Auth.currentUser.photo = photos[Auth.currentUser.id] || '';
          }
          Settings._applyUserPhoto(Auth.currentUser.photo || '', Auth.currentUser);
          Settings._applyBizLogo(s.bizLogo || '');
          var bn = document.getElementById('tb-biz-name'); if (bn && s.bizName) bn.textContent = s.bizName;
          if (typeof Sidebar !== 'undefined') Sidebar.syncBrand();
        }
        // Don't redraw under the user's fingers while they type in the page
        var a = document.activeElement;
        var typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && !a.closest('.modal, #modal, [id*="modal"]');
        if (!typing && typeof Router !== 'undefined' && typeof Router.refresh === 'function') Router.refresh();
        if (typeof Notifs !== 'undefined') Notifs.check();
      } catch(e) {}
    }, now ? 0 : 400);
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
  // Call a database function (e.g. record_sale). Rejects with err.network=true when offline,
  // or err.server=true + the server's message when the server refused it.
  rpc: function(fn, body) {
    var self = this;
    var call = function() {
      var h = Object.assign({}, self._hdr()); delete h.Prefer;
      return fetch(self._url() + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(body) });
    };
    return self._ensureToken().then(call).then(function(r) {
      if (r.status !== 401) return r;
      if (typeof Auth !== 'undefined' && Auth._session) Auth._session.expires_at = 0;
      return self._ensureToken().then(call);
    }).then(function(r) {
      return r.json().catch(function() { return {}; }).then(function(d) {
        if (r.ok) return d;
        var e = new Error((d && (d.message || d.msg)) || ('Server error ' + r.status));
        e.status = r.status; e.server = r.status < 500; e.network = r.status >= 500;
        throw e;
      });
    }, function() { var e = new Error('offline'); e.network = true; throw e; });
  },

  // Put what the server saved (record_sale) into this device's copy — nothing to upload again
  applyServerSale: function(res) {
    if (!res || !res.sale) return;
    var self = this, s = res.sale;
    var sales = this.get('sales'), i = sales.findIndex(function(x){ return x.id === s.id; });
    if (i > -1) sales[i] = s; else sales.unshift(s);
    if (res.payment) {
      var pays = this.get('payments');
      if (!pays.some(function(x){ return x.id === res.payment.id; })) pays.unshift(res.payment);
    }
    (res.products || []).forEach(function(p) {
      var prods = self.get('products'), j = prods.findIndex(function(x){ return x.id === p.id; });
      var rec = Object.assign({}, p.data, { id: p.id });
      if (j > -1) prods[j] = rec; else prods.push(rec);
    });
    var mvs = this.get('stockMovements') || [];
    (res.movements || []).forEach(function(m) { if (!mvs.some(function(x){ return x.id === m.id; })) mvs.unshift(m); });
    this._data.stockMovements = mvs;
    this.save();
  },

  addSale: function(s) {
    s.id = s.id || Utils.uid('INV'); s.createdAt = Utils.today();
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
  // Delete many invoices at once (same effect as deleteSale for each), synced in batches of 100
  deleteSales: function(ids) {
    var gone = {}; ids.forEach(function(id){ gone[id] = true; });
    this._data.sales = this.get('sales').filter(function(x){ return !gone[x.id]; }); this.save();
    // drop any queued upload for these invoices, then queue the batched soft-deletes
    this._pendingUploads = (this._pendingUploads || []).filter(function(x){ return !(x.cloudTable === 'biz_sales' && gone[x.id]); });
    for (var i = 0; i < ids.length; i += 100) {
      this._pendingUploads.push({ op: 'delbulk', cloudTable: 'biz_sales', id: '_delbulk_' + Date.now() + '_' + i, ids: ids.slice(i, i + 100) });
    }
    this._saveQueue();
    this._scheduleFlush();
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
  // Highest number used this year + 1, so deleting a quotation never makes
  // the next one reuse (and overwrite) an existing number.
  nextQuotationId: function() {
    var yr = new Date().getFullYear(), pre = 'QT-' + yr + '-', max = 0;
    this.getQuotations().forEach(function(x){
      if (x.id && x.id.indexOf(pre) === 0) { var n = parseInt(x.id.slice(pre.length), 10); if (n > max) max = n; }
    });
    return pre + String(max + 1).padStart(4,'0');
  },
  addQuotation: function(q) {
    q.id = this.nextQuotationId(); q.createdAt = Utils.today();
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
