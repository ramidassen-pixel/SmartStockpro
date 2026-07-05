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
   SUPER ADMIN PANEL — only accessible with owner PIN
══════════════════════════════════════════════════════════════ */
var SuperAdmin = {
  _pin:       'ROCKSTONE2026',   // Change this to your secret PIN
  _unlocked:  false,

  // Access via Settings → tap version number 5 times
  tryAccess: function() {
    Modal.open({
      title: '🔐 Owner Access', barColor: '#1a1a2e',
      body:  '<div style="text-align:center;padding:10px 0">'
           + '<div style="font-size:48px;margin-bottom:14px">🛡️</div>'
           + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px">Enter owner PIN to access platform dashboard</div>'
           + '</div>'
           + '<div class="fg"><label class="fl">Owner PIN</label>'
           + '<input class="fi" id="sa-pin" type="password" placeholder="Enter PIN" '
           + 'style="text-align:center;font-size:18px;letter-spacing:4px" '
           + 'onkeydown="if(event.key===\'Enter\')SuperAdmin.unlock()"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="SuperAdmin.unlock()">🔓 Unlock</button>',
    });
  },

  unlock: function() {
    var pin = Utils.val('sa-pin');
    if (pin !== SuperAdmin._pin) {
      Toast.show('Incorrect PIN', 'err'); return;
    }
    SuperAdmin._unlocked = true;
    Modal.close();
    SuperAdmin.render();
  },

  render: function() {
    if (!SuperAdmin._unlocked) { SuperAdmin.tryAccess(); return; }
    var pg = Utils.get('pg-superadmin');
    if (!pg) {
      // Create the page dynamically
      var div = document.createElement('div');
      div.id = 'pg-superadmin';
      div.className = 'page';
      document.getElementById('app-shell').appendChild(div);
    }
    Router.go('superadmin');
    SuperAdmin._loadAndRender();
  },

  _loadAndRender: function() {
    var pg = Utils.get('pg-superadmin');
    if (!pg) return;
    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">🛡️ Platform Admin</div>'
      + '<div class="page-sub">SmartStock Pro — Owner Dashboard</div></div>'
      + '<button class="btn-ghost btn-sm" onclick="SuperAdmin._loadAndRender()">↻ Refresh</button>'
      + '</div>'
      + '<div id="sa-content"><div style="text-align:center;padding:40px;color:var(--t3)">Loading platform data...</div></div>';

    // Fetch through the PIN-protected admin-data Edge Function — the
    // browser never holds a key capable of reading these tables directly.
    var fnHdr = {
      'Content-Type': 'application/json',
      'x-owner-pin':  SuperAdmin._pin,
    };

    function fetchTable(table, filter) {
      return fetch(ADMIN_FN_URL, {
        method: 'POST',
        headers: fnHdr,
        body: JSON.stringify({ action: 'select', table: table, filter: filter }),
      }).then(function(r){ return r.json(); });
    }

    Promise.all([
      fetchTable('platform_businesses', 'order=registered_at.desc'),
      fetchTable('platform_users',      'order=registered_at.desc'),
      fetchTable('platform_activity',   'order=created_at.desc&limit=50'),
    ]).then(function(results) {
      var businesses = Array.isArray(results[0]) ? results[0] : [];
      var users      = Array.isArray(results[1]) ? results[1] : [];
      var activity   = Array.isArray(results[2]) ? results[2] : [];
      SuperAdmin._renderDashboard(businesses, users, activity);
    }).catch(function(err) {
      Utils.get('sa-content').innerHTML = '<div style="padding:20px;color:var(--er)">Error loading data: ' + err.message + '</div>';
    });
  },

  _renderDashboard: function(businesses, users, activity) {
    var el  = Utils.get('sa-content');
    if (!el) return;
    var now = new Date();
    var today = Utils.today();
    var thisMonth = today.slice(0,7);

    // Stats
    var totalBiz      = businesses.length;
    var activeBiz     = businesses.filter(function(b){ return b.status==='active'; }).length;
    var totalUsers    = users.length;
    var activeUsers   = users.filter(function(u){ return u.status==='active'; }).length;
    var pendingUsers  = users.filter(function(u){ return u.status==='pending'; }).length;
    var todayLogins   = activity.filter(function(a){ return a.event==='login' && a.event_date===today; }).length;
    var newBizMonth   = businesses.filter(function(b){ return b.registered_at && b.registered_at.startsWith(thisMonth); }).length;
    var newUsersMonth = users.filter(function(u){ return u.registered_at && u.registered_at.startsWith(thisMonth); }).length;

    var html = '';

    // ── KPI CARDS ─────────────────────────────────────────────────────────────
    html += '<div class="sec"><div class="kpi-grid">'
      + SuperAdmin._kpi('🏢', 'Businesses', totalBiz, activeBiz+' active', 'var(--g)')
      + SuperAdmin._kpi('👥', 'Total Users', totalUsers, activeUsers+' active', 'var(--in)')
      + SuperAdmin._kpi('⏳', 'Pending', pendingUsers, 'awaiting approval', 'var(--wa)')
      + SuperAdmin._kpi('📱', 'Logins Today', todayLogins, 'active sessions', 'var(--ok)')
      + '</div></div>'

    // ── THIS MONTH ───────────────────────────────────────────────────────────
      + '<div class="sec"><div class="card card-body" style="background:var(--gb3);border-color:rgba(212,168,67,.2)">'
      + '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">📅 This Month — '+thisMonth+'</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      + '<div style="text-align:center"><div style="font-size:28px;font-weight:900;color:var(--g)">'+newBizMonth+'</div><div style="font-size:11px;color:var(--t2)">New Businesses</div></div>'
      + '<div style="text-align:center"><div style="font-size:28px;font-weight:900;color:var(--in)">'+newUsersMonth+'</div><div style="font-size:11px;color:var(--t2)">New Users</div></div>'
      + '</div></div></div>'

    // ── BUSINESSES LIST ───────────────────────────────────────────────────────
      + '<div class="sec"><div class="sec-title">🏢 Registered Businesses ('+totalBiz+')</div>'
      + (businesses.length
          ? '<div class="card">' + businesses.slice(0,50).map(function(b){
              var ago = SuperAdmin._timeAgo(b.registered_at);
              var lastSeen = SuperAdmin._timeAgo(b.last_active_at);
              return '<div class="list-item">'
                + '<div class="list-icon" style="background:var(--gb);font-size:18px">🏢</div>'
                + '<div class="list-info">'
                + '<div class="list-name">'+Utils.esc(b.name)+'</div>'
                + '<div class="list-meta">'+Utils.esc(b.owner_name||'')+(b.owner_email?' · '+Utils.esc(b.owner_email):'')+'</div>'
                + '<div class="list-meta" style="font-size:10px;color:var(--t3)">Registered: '+ago+' · Last active: '+lastSeen+'</div>'
                + '</div>'
                + '<div class="list-right">'
                + '<span style="font-size:9px;padding:3px 8px;border-radius:99px;font-weight:700;background:'+(b.status==='active'?'var(--okb)':'var(--erb)')+';color:'+(b.status==='active'?'var(--ok)':'var(--er)')+'">'+b.status.toUpperCase()+'</span>'
                + '<div style="font-size:10px;color:var(--t3);margin-top:3px">'+b.plan.toUpperCase()+' plan</div>'
                + '</div></div>';
            }).join('') + '</div>'
          : '<div class="empty"><div class="empty-icon">🏢</div><div class="empty-title">No businesses yet</div></div>')
      + '</div>'

    // ── USERS LIST ───────────────────────────────────────────────────────────
      + '<div class="sec"><div class="sec-title">👥 Registered Users ('+totalUsers+')</div>'
      + (users.length
          ? '<div class="card">' + users.slice(0,50).map(function(u){
              var ago = SuperAdmin._timeAgo(u.registered_at);
              var biz = businesses.find(function(b){ return b.id===u.business_id; });
              return '<div class="list-item">'
                + '<div class="list-icon" style="background:var(--inb);font-size:18px">👤</div>'
                + '<div class="list-info">'
                + '<div class="list-name">'+Utils.esc(u.name)+'</div>'
                + '<div class="list-meta">'+(biz?Utils.esc(biz.name)+' · ':'')+Utils.esc(u.role||'')+'</div>'
                + '<div class="list-meta" style="font-size:10px;color:var(--t3)">'+(u.email?Utils.esc(u.email)+' · ':'')+ago+'</div>'
                + '</div>'
                + '<div class="list-right">'
                + '<span style="font-size:9px;padding:3px 8px;border-radius:99px;font-weight:700;background:'+(u.status==='active'?'var(--okb)':u.status==='pending'?'var(--wab)':'var(--erb)')+';color:'+(u.status==='active'?'var(--ok)':u.status==='pending'?'var(--wa)':'var(--er)')+'">'+u.status.toUpperCase()+'</span>'
                + '</div></div>';
            }).join('') + '</div>'
          : '<div class="empty"><div class="empty-icon">👥</div><div class="empty-title">No users yet</div></div>')
      + '</div>'

    // ── RECENT ACTIVITY ──────────────────────────────────────────────────────
      + '<div class="sec"><div class="sec-title">📋 Recent Activity</div>'
      + (activity.length
          ? '<div class="card">' + activity.slice(0,20).map(function(a){
              var biz  = businesses.find(function(b){ return b.id===a.business_id; });
              var user = users.find(function(u){ return u.id===a.user_id; });
              return '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--bd)">'
                + '<div style="font-size:18px">'+SuperAdmin._eventIcon(a.event)+'</div>'
                + '<div style="flex:1">'
                + '<div style="font-size:12px;font-weight:600;color:var(--t1)">'+a.event.replace(/_/g,' ').toUpperCase()+'</div>'
                + '<div style="font-size:10px;color:var(--t3)">'+(user?Utils.esc(user.name):a.user_id.slice(-6))+' · '+(biz?Utils.esc(biz.name):'')+'</div>'
                + '</div>'
                + '<div style="font-size:10px;color:var(--t3)">'+a.event_date+'</div>'
                + '</div>';
            }).join('') + '</div>'
          : '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No activity yet</div></div>')
      + '</div>'
      + '<div style="height:40px"></div>';

    el.innerHTML = html;
  },

  _kpi: function(icon, label, val, sub, color) {
    return '<div class="kpi" style="--kc:'+color+';--kibg:'+color+'1a">'
      + '<div class="kpi-icon">'+icon+'</div>'
      + '<div class="kpi-label">'+label+'</div>'
      + '<div class="kpi-value">'+val+'</div>'
      + '<div class="kpi-sub">'+sub+'</div>'
      + '</div>';
  },

  _timeAgo: function(iso) {
    if (!iso) return 'never';
    var diff = Date.now() - new Date(iso).getTime();
    var mins  = Math.floor(diff/60000);
    var hours = Math.floor(mins/60);
    var days  = Math.floor(hours/24);
    if (mins  < 2)   return 'just now';
    if (mins  < 60)  return mins+'m ago';
    if (hours < 24)  return hours+'h ago';
    if (days  < 7)   return days+'d ago';
    return new Date(iso).toLocaleDateString();
  },

  _eventIcon: function(evt) {
    var map = { login:'🔑', sale_created:'🧾', report_generated:'📊',
                product_added:'📦', expense_added:'💸', quotation_created:'📄' };
    return map[evt] || '📋';
  },
};
