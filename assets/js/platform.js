/* === platform.js === */
/* SmartStock Pro V5 — Platform Sync & Super Admin */

var SUPABASE_URL  = 'https://ovbtqkpvhivqnnxojjwu.supabase.co';
var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92YnRxa3B2aGl2cW5ueG9qand1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTQ1NDEsImV4cCI6MjA5Njc5MDU0MX0.TZ_B5NBC3uIyqMYs442umeoi3o78CCwTZW6YgHS9efw';
var ADMIN_FN_URL  = SUPABASE_URL + '/functions/v1/admin-data';

/* ══════════════════════════════════════════════════════════════
   PLATFORM SYNC — sends registration & activity to Supabase
══════════════════════════════════════════════════════════════ */
var Platform = {

  _hdr: function() {
    return {
      'Content-Type':  'application/json',
      'apikey':         SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Prefer':        'resolution=merge-duplicates',
    };
  },

  // Call this when a new business is created
  syncBusiness: function(biz, owner) {
    if (!biz || !biz.id) return;
    var payload = {
      id:             biz.id,
      name:           biz.name || '',
      owner_name:     owner ? (owner.name||'') : '',
      owner_email:    owner ? (owner.email||'') : '',
      owner_phone:    owner ? (owner.phone||'') : (biz.phone||''),
      currency:       biz.currency || '$',
      country:        'Liberia',
      status:         'active',
      plan:           'free',
      registered_at:  new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      user_count:     1,
      device_info:    navigator.userAgent.slice(0,120),
    };
    fetch(SUPABASE_URL + '/rest/v1/platform_businesses', {
      method:  'POST',
      headers: Platform._hdr(),
      body:    JSON.stringify(payload),
    }).then(function(r){
      console.log('Platform: business synced', r.status);
    }).catch(function(e){
      console.log('Platform: sync error', e.message);
    });
  },

  // Call this when a user registers or joins
  syncUser: function(user, bizId) {
    if (!user || !user.id) return;
    var payload = {
      id:             user.id,
      business_id:    bizId || (user.businessIds && user.businessIds[0]) || null,
      name:           user.name || user.username || '',
      email:          user.email || '',
      phone:          user.phone || '',
      role:           user.role || 'sales_employee',
      status:         user.status || 'active',
      registered_at:  new Date().toISOString(),
      last_login_at:  new Date().toISOString(),
      device_info:    navigator.userAgent.slice(0,120),
      app_version:    'V5',
    };
    fetch(SUPABASE_URL + '/rest/v1/platform_users', {
      method:  'POST',
      headers: Platform._hdr(),
      body:    JSON.stringify(payload),
    }).then(function(r){
      console.log('Platform: user synced', r.status);
    }).catch(function(e){
      console.log('Platform: user sync error', e.message);
    });
  },

  // Call this on login — updates last_active
  pingLogin: function(user, bizId) {
    if (!user) return;
    fetch(ADMIN_FN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'ping', userId: user.id, bizId: bizId || null }),
    }).catch(function(){});

    // Log activity event
    fetch(SUPABASE_URL + '/rest/v1/platform_activity', {
      method:  'POST',
      headers: Platform._hdr(),
      body:    JSON.stringify({
        business_id: bizId || null,
        user_id:     user.id,
        event:       'login',
        event_date:  Utils.today(),
      }),
    }).catch(function(){});
  },

  // Log a key business event
  logEvent: function(eventName) {
    var user = Auth.currentUser;
    if (!user) return;
    var bizId = user.currentBusinessId || (user.businessIds && user.businessIds[0]);
    fetch(SUPABASE_URL + '/rest/v1/platform_activity', {
      method:  'POST',
      headers: Platform._hdr(),
      body:    JSON.stringify({
        business_id: bizId || null,
        user_id:     user.id,
        event:       eventName,
        event_date:  Utils.today(),
      }),
    }).catch(function(){});
  },
};

/* ══════════════════════════════════════════════════════════════
   PLATFORM ADMIN — for the platform owner's own account only.
   Access is checked by the server (public.platform_admins via
   is_platform_admin / admin_overview). There is no PIN: the old
   one was visible in this public file.
══════════════════════════════════════════════════════════════ */
var SuperAdmin = {
  _isAdmin: null,        // null = not checked yet
  _data: null,
  _tab: 'overview',
  _q: '',

  // Ask the server once whether this account is the platform owner (cached per sign-in)
  check: function(force) {
    var self = this;
    if (!force && this._isAdmin !== null) return Promise.resolve(this._isAdmin);
    if (typeof DB === 'undefined' || !DB.rpc) return Promise.resolve(false);
    return DB.rpc('is_platform_admin', {}).then(function(r) {
      var was = self._isAdmin;
      self._isAdmin = r === true;
      if (was !== self._isAdmin && typeof Router !== 'undefined' && Router.current === 'more' && typeof MorePage !== 'undefined') MorePage.render();
      return self._isAdmin;
    }, function() { return false; });
  },

  // Headers for the admin-data server function: the signed-in account's own token
  fnCall: function(body) {
    return DB._ensureToken().then(function(tok) {
      return fetch(ADMIN_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: 'Bearer ' + (tok || DB._token || SUPABASE_ANON) },
        body: JSON.stringify(body),
      });
    }).then(function(r) { return r.json(); });
  },

  // Old entry points keep working
  tryAccess: function() { Router.go('superadmin'); },
  render: function() { Router.go('superadmin'); },

  _loadAndRender: function() {
    var pg = Utils.get('pg-superadmin'); if (!pg) return;
    var self = this;
    pg.innerHTML = this._header() + '<div class="sec"><div class="card card-body" style="text-align:center;color:var(--t3)">Loading platform data…</div></div>';
    DB.rpc('admin_overview', {}).then(function(d) {
      self._isAdmin = true;
      self._data = d || {};
      self._paint();
    }, function(e) {
      var denied = e && e.server;
      if (denied) self._isAdmin = false;
      pg.innerHTML = self._header(true)
        + '<div class="empty"><div class="empty-icon">' + (denied ? '🔒' : '📶') + '</div>'
        + '<div class="empty-title">' + (denied ? 'Only the platform owner can open this page' : 'Could not load platform data') + '</div>'
        + '<div class="empty-sub">' + (denied ? 'Sign in with the platform owner account.' : 'Check your connection and try again.') + '</div>'
        + (denied ? '' : '<div class="empty-action"><button class="btn-primary btn-sm" onclick="SuperAdmin._loadAndRender()">Try again</button></div>') + '</div>';
    });
  },

  _header: function(noRefresh) {
    return '<div class="page-header"><div><div class="page-title">🛡️ Platform Admin</div>'
      + '<div class="page-sub">All SmartStock Pro shops</div></div>'
      + (noRefresh ? '' : '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="SuperAdmin._loadAndRender()">↻ Refresh</button></div>')
      + '</div>';
  },

  setTab: function(t) { this._tab = t; this._q = ''; this._paint(); var pc = Utils.get('pages-container'); if (pc) pc.scrollTop = 0; },

  _paint: function() {
    var pg = Utils.get('pg-superadmin'); if (!pg || !this._data) return;
    var d = this._data, pay = d.payments || {};
    var tabs = [['overview', 'Overview'], ['shops', 'Shops (' + (d.shops || []).length + ')'], ['users', 'Users (' + (d.users || []).length + ')'],
                ['payments', 'Payments' + (pay.pending ? ' (' + pay.pending + ')' : '')], ['activity', 'Activity']];
    var self = this;
    var body = { overview: this._overview, shops: this._shops, users: this._users, payments: this._payments, activity: this._activity }[this._tab] || this._overview;
    pg.innerHTML = this._header()
      + '<div class="chips" role="tablist">' + tabs.map(function(t) {
          return '<div class="chip' + (self._tab === t[0] ? ' active' : '') + '" role="tab" aria-selected="' + (self._tab === t[0]) + '" onclick="SuperAdmin.setTab(\'' + t[0] + '\')">' + t[1] + '</div>';
        }).join('') + '</div>'
      + '<div id="sa-body">' + body.call(this) + '</div><div style="height:40px"></div>';
    if (this._tab === 'payments') this._loadPayments();
  },

  // ── helpers ───────────────────────────────────────────────────────────────
  _kpi: function(icon, label, val, sub, color) {
    return '<div class="kpi" style="--kc:' + color + ';--kibg:' + color + '1a"><div class="kpi-icon">' + icon + '</div>'
      + '<div class="kpi-label">' + label + '</div><div class="kpi-value">' + val + '</div><div class="kpi-sub">' + sub + '</div></div>';
  },
  _timeAgo: function(iso) {
    if (!iso) return 'never';
    var diff = Date.now() - new Date(iso).getTime(), mins = Math.floor(diff / 60000), hours = Math.floor(mins / 60), days = Math.floor(hours / 24);
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 30) return days + 'd ago';
    return Utils.date(iso);
  },
  _pill: function(text, color) {
    return '<span style="font-size:10px;padding:3px 8px;border-radius:99px;font-weight:800;background:' + color + '1f;color:' + color + ';border:1px solid ' + color + '40;white-space:nowrap">' + text + '</span>';
  },
  _planOf: function(s) {
    var today = Utils.today();
    if (s.plan === 'owner') return ['Owner', 'var(--g)'];
    if (s.plan && s.paid_until && s.paid_until >= today) return [(s.plan === 'business' ? 'Business' : 'Shop') + ' · to ' + Utils.date(s.paid_until), 'var(--ok)'];
    if (s.plan && s.paid_until) return ['Plan ended ' + Utils.date(s.paid_until), 'var(--er)'];
    if (s.trial_ends && s.trial_ends >= today) return ['Trial · ends ' + Utils.date(s.trial_ends), 'var(--in)'];
    return ['Trial ended', 'var(--wa)'];
  },
  _shopName: function(id) {
    var s = (this._data.shops || []).find(function(x) { return x.id === id; });
    return s ? s.name : (id || '');
  },
  _search: function(ph) {
    return '<div class="sec" style="margin-bottom:0"><input class="fi" type="search" placeholder="' + ph + '" value="' + Utils.esc(this._q) + '" '
      + 'oninput="SuperAdmin._q=this.value;SuperAdmin._repaintList()" aria-label="' + ph + '"></div>';
  },
  _repaintList: function() {
    var el = Utils.get('sa-list'); if (!el) return;
    el.innerHTML = this._tab === 'shops' ? this._shopRows() : this._userRows();
  },
  _match: function(o, keys) {
    var q = this._q.trim().toLowerCase(); if (!q) return true;
    return keys.some(function(k) { return String(o[k] || '').toLowerCase().indexOf(q) > -1; });
  },

  // ── tabs ──────────────────────────────────────────────────────────────────
  _overview: function() {
    var d = this._data, shops = d.shops || [], users = d.users || [], act = d.activity || [], pay = d.payments || {};
    var today = Utils.today(), month = today.slice(0, 7), self = this;
    var weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    var activeWeek = shops.filter(function(s) { return s.last_active_at && s.last_active_at >= weekAgo; }).length;
    var paying = shops.filter(function(s) { return s.plan && s.plan !== 'owner' && s.paid_until && s.paid_until >= today; }).length;
    var trials = shops.filter(function(s) { return !s.plan && s.trial_ends >= today; }).length;
    var ended = shops.filter(function(s) { return s.plan !== 'owner' && !(s.paid_until && s.paid_until >= today) && !(s.trial_ends >= today); });
    var pendingUsers = users.filter(function(u) { return u.status === 'pending'; }).length;
    var loginsToday = act.filter(function(a) { return a.event === 'login' && a.event_date === today; }).length;
    var newShops = shops.filter(function(s) { return (s.registered_at || '').slice(0, 7) === month; }).length;

    var html = '<div class="sec"><div class="kpi-grid">'
      + this._kpi('🏢', 'Shops', shops.length, activeWeek + ' active this week', 'var(--g)')
      + this._kpi('💳', 'Paying', paying, trials + ' on trial', 'var(--ok)')
      + this._kpi('💰', 'Income this month', '$' + (parseFloat(pay.approved_month) || 0), '$' + (parseFloat(pay.approved_total) || 0) + ' all time', 'var(--in)')
      + this._kpi('⏳', 'To confirm', pay.pending || 0, 'MoMo payments', 'var(--wa)')
      + '</div></div>'
      + '<div class="sec"><div class="card card-body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">'
      + '<div><div style="font-size:24px;font-weight:900;color:var(--g)">' + newShops + '</div><div style="font-size:11px;color:var(--t2)">New shops this month</div></div>'
      + '<div><div style="font-size:24px;font-weight:900;color:var(--in)">' + users.length + '</div><div style="font-size:11px;color:var(--t2)">Users (' + pendingUsers + ' waiting)</div></div>'
      + '<div><div style="font-size:24px;font-weight:900;color:var(--ok)">' + loginsToday + '</div><div style="font-size:11px;color:var(--t2)">Logins today</div></div>'
      + '</div></div>';
    if (pay.pending) {
      html += '<div class="sec"><button class="btn-primary btn-full" onclick="SuperAdmin.setTab(\'payments\')">💳 ' + pay.pending + ' payment' + (pay.pending > 1 ? 's' : '') + ' waiting for you to confirm</button></div>';
    }
    if (ended.length) {
      html += '<div class="sec"><div class="sec-title">⏳ Trial or plan ended (' + ended.length + ')</div><div class="card">'
        + ended.slice(0, 10).map(function(s) { return self._shopRow(s); }).join('') + '</div></div>';
    }
    return html;
  },

  _shopRow: function(s) {
    var p = this._planOf(s);
    var phone = String(s.owner_phone || '').replace(/[^0-9]/g, '');
    return '<div class="list-item" style="flex-wrap:wrap;cursor:default">'
      + '<div class="list-icon" style="background:var(--gb);font-size:18px">🏢</div>'
      + '<div class="list-info">'
      + '<div class="list-name">' + Utils.esc(s.name || s.id) + '</div>'
      + '<div class="list-meta">' + Utils.esc(s.owner_name || '') + (s.owner_phone ? ' · ' + Utils.esc(s.owner_phone) : '') + '</div>'
      + (s.owner_email ? '<div class="list-meta">' + Utils.esc(s.owner_email) + '</div>' : '')
      + '<div class="list-meta" style="font-size:11px">' + s.sales + ' sales (' + s.sales_30d + ' in 30 days) · ' + s.products + ' products · ' + s.users + ' user' + (s.users === 1 ? '' : 's') + '</div>'
      + '<div class="list-meta" style="font-size:11px;color:var(--t3)">Joined ' + Utils.date(s.registered_at) + ' · Last active ' + this._timeAgo(s.last_active_at)
      + (s.last_sale ? ' · Last sale ' + Utils.date(s.last_sale) : '') + '</div>'
      + (s.deletion_scheduled_for ? '<div class="list-meta" style="color:var(--er)">⚠️ Deletion scheduled ' + Utils.date(s.deletion_scheduled_for) + '</div>' : '')
      + '</div>'
      + '<div class="list-right">' + this._pill(p[0], p[1]) + '</div>'
      + '<div class="list-actions" style="width:100%;margin-top:8px">'
      + (phone.length > 5 ? '<button class="btn-ghost btn-sm" onclick="SuperAdmin.whatsapp(\'' + s.id + '\')">💬 WhatsApp</button>' : '')
      + '<button class="btn-ghost btn-sm" onclick="SuperAdmin.openPlan(\'' + s.id + '\')">💳 Plan</button>'
      + '</div></div>';
  },
  _shopRows: function() {
    var self = this, list = (this._data.shops || []).filter(function(s) { return self._match(s, ['name', 'owner_name', 'owner_email', 'owner_phone', 'id']); });
    return list.length ? '<div class="card">' + list.map(function(s) { return self._shopRow(s); }).join('') + '</div>'
      : '<div class="empty"><div class="empty-icon">🏢</div><div class="empty-title">No shops found</div></div>';
  },
  _shops: function() {
    return this._search('Search shop, owner, phone or email') + '<div class="sec" id="sa-list">' + this._shopRows() + '</div>';
  },

  _userRows: function() {
    var self = this;
    var list = (this._data.users || []).filter(function(u) {
      return self._match(Object.assign({ shop: self._shopName(u.business_id) }, u), ['name', 'email', 'phone', 'shop', 'role']);
    });
    var roleName = function(r) { return r === 'primary_admin' ? 'Owner' : r === 'sales_employee' ? 'Sales staff' : String(r || '').replace(/_/g, ' '); };
    return list.length ? '<div class="card">' + list.map(function(u) {
      var c = u.status === 'active' ? 'var(--ok)' : u.status === 'pending' ? 'var(--wa)' : 'var(--er)';
      return '<div class="list-item" style="cursor:default">'
        + '<div class="list-icon" style="background:var(--inb);font-size:18px">👤</div>'
        + '<div class="list-info"><div class="list-name">' + Utils.esc(u.name || '(no name)') + '</div>'
        + '<div class="list-meta">' + Utils.esc(self._shopName(u.business_id)) + ' · ' + Utils.esc(roleName(u.role)) + '</div>'
        + '<div class="list-meta" style="font-size:11px;color:var(--t3)">' + (u.email ? Utils.esc(u.email) + ' · ' : '') + 'Last login ' + self._timeAgo(u.last_login_at) + '</div></div>'
        + '<div class="list-right">' + self._pill(String(u.status || '').toUpperCase(), c) + '</div></div>';
    }).join('') + '</div>' : '<div class="empty"><div class="empty-icon">👥</div><div class="empty-title">No users found</div></div>';
  },
  _users: function() {
    return this._search('Search name, email, phone or shop') + '<div class="sec" id="sa-list">' + this._userRows() + '</div>'
      + '<div style="font-size:12px;color:var(--t3);padding:0 16px">Each shop owner approves their own staff in Team &amp; Access.</div>';
  },

  _payments: function() {
    return '<div id="sa-pay"><div class="sec"><div class="card card-body" style="text-align:center;color:var(--t3)">Loading payments…</div></div></div>';
  },
  _loadPayments: function() {
    if (typeof Billing === 'undefined') return;
    Billing.load().then(function() {
      var el = Utils.get('sa-pay'); if (!el) return;
      el.innerHTML = Billing._reviewHtml();
    }, function() {
      var el = Utils.get('sa-pay'); if (el) el.innerHTML = '<div class="empty"><div class="empty-title">Could not load payments</div></div>';
    });
  },

  _activity: function() {
    var self = this, d = this._data, users = d.users || [];
    var icons = { login: '🔑', sale_created: '🧾', report_generated: '📊', product_added: '📦', expense_added: '💸', quotation_created: '📄' };
    var act = d.activity || [];
    return '<div class="sec">' + (act.length ? '<div class="card">' + act.map(function(a) {
      var u = users.find(function(x) { return x.id === a.user_id; });
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--bd)">'
        + '<div style="font-size:18px">' + (icons[a.event] || '📋') + '</div>'
        + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--t1)">' + Utils.esc(String(a.event || '').replace(/_/g, ' ')) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + Utils.esc(u ? u.name : '') + (u ? ' · ' : '') + Utils.esc(self._shopName(a.business_id)) + '</div></div>'
        + '<div style="font-size:11px;color:var(--t3);white-space:nowrap">' + self._timeAgo(a.created_at) + '</div></div>';
    }).join('') + '</div>' : '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No activity yet</div></div>') + '</div>';
  },

  // ── actions ───────────────────────────────────────────────────────────────
  whatsapp: function(id) {
    var s = (this._data.shops || []).find(function(x) { return x.id === id; }); if (!s) return;
    var d = String(s.owner_phone || '').replace(/[^0-9]/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2); else if (d.charAt(0) === '0') d = '231' + d.slice(1);
    Sales._openWhatsApp('Hello ' + (s.owner_name || '') + ', this is SmartStock Pro about your shop "' + (s.name || '') + '".', d);
  },

  openPlan: function(id) {
    var s = (this._data.shops || []).find(function(x) { return x.id === id; }); if (!s) return;
    var p = this._planOf(s);
    var base = s.paid_until && s.paid_until >= Utils.today() ? new Date(s.paid_until) : new Date();
    var plus = function(m) { var x = new Date(base); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); };
    Modal.open({
      title: 'Change plan', sub: Utils.esc(s.name || s.id), barColor: 'var(--g)',
      body: '<div style="margin-bottom:12px">Now: ' + this._pill(p[0], p[1]) + '</div>'
        + '<div class="fg"><label class="fl" for="sa-plan">Plan</label><select class="fi" id="sa-plan" onchange="document.getElementById(\'sa-until-wrap\').style.display=(this.value===\'owner\'||this.value===\'none\')?\'none\':\'block\'">'
        + '<option value="shop"' + (s.plan === 'shop' ? ' selected' : '') + '>Shop ($9/month)</option>'
        + '<option value="business"' + (s.plan === 'business' ? ' selected' : '') + '>Business ($19/month)</option>'
        + '<option value="owner"' + (s.plan === 'owner' ? ' selected' : '') + '>Owner (free forever)</option>'
        + '<option value="none">No plan (back to trial rules)</option></select></div>'
        + '<div id="sa-until-wrap"' + (s.plan === 'owner' ? ' style="display:none"' : '') + '>'
        + '<div class="fg"><label class="fl" for="sa-until">Paid until</label><input class="fi" type="date" id="sa-until" value="' + (s.paid_until && s.paid_until >= Utils.today() ? s.paid_until : plus(1)) + '"></div>'
        + '<div class="chips" style="padding:0;margin:-4px 0 6px">'
        + [1, 3, 6, 12].map(function(m) { return '<div class="chip" onclick="document.getElementById(\'sa-until\').value=\'' + plus(m) + '\'">+' + m + ' mo</div>'; }).join('')
        + '</div></div>'
        + '<div style="font-size:12px;color:var(--t3)">Use this for free months or corrections. Mobile Money payments are approved under Payments instead.</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn-primary" style="flex:1" onclick="SuperAdmin.savePlan(\'' + id + '\')">Save</button>',
    });
  },

  savePlan: function(id) {
    var plan = (Utils.get('sa-plan') || {}).value, until = Utils.val('sa-until') || null;
    if ((plan === 'shop' || plan === 'business') && !until) { Toast.show('Choose the date the plan ends', 'err'); return; }
    var self = this;
    DB.rpc('admin_set_plan', { p_business_id: id, p_plan: plan, p_paid_until: (plan === 'shop' || plan === 'business') ? until : null })
      .then(function() {
        Modal.close();
        Toast.show('Plan saved ✓', 'ok');
        self._loadAndRender();
      }, function(e) { Toast.show(e.network ? 'No connection. Try again.' : e.message, 'err', 6000); });
  },
};
