var SUPABASE_AUTH_URL = 'https://ovbtqkpvhivqnnxojjwu.supabase.co/auth/v1';

var Auth = {
  currentUser: null,
  _session: null,

  /* ═══════════════════════════════════════════════════════
     LOGIN
  ═══════════════════════════════════════════════════════ */
  login: function() {
    var email = Utils.val('l-user').trim().toLowerCase();
    var pw    = Utils.val('l-pass');
    if (!email) { Auth._err('login-err', '⚠️ Enter your email'); return; }
    if (!pw)    { Auth._err('login-err', '⚠️ Enter your password'); return; }

    fetch(SUPABASE_AUTH_URL + '/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: email, password: pw }),
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      if (!res.ok) {
        var msg = res.data.error_description || res.data.msg || 'Login failed';
        Auth._err('login-err', '❌ ' + msg);
        return;
      }
      Auth._session = res.data;
      Utils.storage.set('ssp_session', {
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
        expires_at: Date.now() + (res.data.expires_in * 1000),
      });
      Auth._loadProfileAndEnter();
    })
    .catch(function() { Auth._err('login-err', '❌ Network error. Check your connection.'); });
  },

  /* ═══════════════════════════════════════════════════════
     SIGN UP — CREATE NEW BUSINESS
  ═══════════════════════════════════════════════════════ */
  signup: function() {
    var bizName = Utils.val('s-biz').trim();
    var name    = Utils.val('s-name').trim();
    var email   = Utils.val('s-email').trim().toLowerCase();
    var phone   = Utils.val('s-phone').trim();
    var pw      = Utils.val('s-pass');
    var pwConf  = Utils.val('s-pass-conf');

    if (!bizName) { Auth._err('signup-err', '⚠️ Business name is required'); return; }
    if (!name)    { Auth._err('signup-err', '⚠️ Your full name is required'); return; }
    if (!email || !email.includes('@')) { Auth._err('signup-err', '⚠️ Enter a valid email address'); return; }
    if (!phone)   { Auth._err('signup-err', '⚠️ Phone number is required'); return; }
    if (pw.length < 8) { Auth._err('signup-err', '⚠️ Password must be at least 8 characters'); return; }
    if (pw !== pwConf)  { Auth._err('signup-err', '⚠️ Passwords do not match'); return; }

    var bizId = Utils.uid('BIZ');

    fetch(SUPABASE_AUTH_URL + '/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({
        email: email,
        password: pw,
        data: { name: name, business_id: bizId, role: 'primary_admin' },
      }),
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); })
    .then(function(res) {
      if (!res.ok) {
        var msg = res.data.error_description || res.data.msg || 'Sign up failed';
        if (msg.toLowerCase().indexOf('already') > -1 || msg.toLowerCase().indexOf('registered') > -1) {
          Auth._err('signup-err', '❌ An account with this email already exists. Use Sign In or Forgot Password instead.');
        } else {
          Auth._err('signup-err', '❌ ' + msg);
        }
        return;
      }

      var userId = res.data.id || (res.data.user && res.data.user.id);

      var bizRow = { id: bizId, name: bizName, owner_name: name, owner_email: email, owner_phone: phone, status: 'active' };
      var userRow = { id: userId, business_id: bizId, name: name, email: email, phone: phone, role: 'primary_admin', status: 'active' };

      Promise.all([
        fetch(SUPABASE_URL + '/rest/v1/platform_businesses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON, 'Prefer': 'return=minimal' },
          body: JSON.stringify(bizRow),
        }),
        fetch(SUPABASE_URL + '/rest/v1/platform_users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON, 'Prefer': 'return=minimal' },
          body: JSON.stringify(userRow),
        }),
      ]).then(function(results) {
        var failed = results.filter(function(r) { return !r.ok; });
        if (failed.length) {
          Auth._err('signup-err', '⚠️ Account created but business profile setup failed. Contact support.');
          console.error('Signup profile creation failed', failed);
          return;
        }
        Auth._showCheckEmailScreen(email);
      });
    })
    .catch(function() { Auth._err('signup-err', '❌ Network error. Check your connection.'); });
  },

  /* ═══════════════════════════════════════════════════════
     JOIN EXISTING BUSINESS
  ═══════════════════════════════════════════════════════ */
  joinBusiness: function() {
    var bizName = Utils.val('j-biz').trim();
    var name    = Utils.val('j-name').trim();
    var email   = Utils.val('j-email').trim().toLowerCase();
    var phone   = Utils.val('j-phone').trim();
    var pw      = Utils.val('j-pass');
    var pwConf  = Utils.val('j-pass-conf');

    if (!bizName) { Auth._err('join-err', '⚠️ Enter the business name'); return; }
    if (!name)    { Auth._err('join-err', '⚠️ Enter your full name'); return; }
    if (!email || !email.includes('@')) { Auth._err('join-err', '⚠️ Enter a valid email'); return; }
    if (pw.length < 8) { Auth._err('join-err', '⚠️ Password must be at least 8 characters'); return; }
    if (pw !== pwConf)  { Auth._err('join-err', '⚠️ Passwords do not match'); return; }

    var searchUrl = SUPABASE_URL + '/rest/v1/platform_businesses?name=ilike.' + encodeURIComponent(bizName) + '&select=id,name,status';
    fetch(searchUrl, { headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON } })
      .then(function(r) { return r.json(); })
      .then(function(results) {
        if (!results || !results.length) {
          Auth._err('join-err', '❌ No business named "' + Utils.esc(bizName) + '" found. Ask your employer for the exact name, or use New Biz to register.');
          return;
        }
        var biz = results[0];

        fetch(SUPABASE_AUTH_URL + '/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
          body: JSON.stringify({ email: email, password: pw, data: { name: name, business_id: biz.id, role: 'sales_employee' } }),
        })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(res) {
          if (!res.ok) {
            var msg = res.data.error_description || res.data.msg || 'Join request failed';
            Auth._err('join-err', '❌ ' + msg);
            return;
          }
          var userId = res.data.id || (res.data.user && res.data.user.id);
          var userRow = { id: userId, business_id: biz.id, name: name, email: email, phone: phone, role: 'sales_employee', status: 'pending' };

          fetch(SUPABASE_URL + '/rest/v1/platform_users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON, 'Prefer': 'return=minimal' },
            body: JSON.stringify(userRow),
          }).then(function(r2) {
            if (!r2.ok) { Auth._err('join-err', '⚠️ Account created but request setup failed. Contact support.'); return; }
            Auth._showCheckEmailScreen(email, true);
          });
        });
      })
      .catch(function() { Auth._err('join-err', '❌ Network error. Check your connection.'); });
  },

  /* ═══════════════════════════════════════════════════════
     FORGOT PASSWORD
  ═══════════════════════════════════════════════════════ */
  forgotPassword: function() {
    var email = Utils.val('fp-email');
    if (!email) email = prompt('Enter your account email:');
    if (!email || !email.includes('@')) { Auth._err('login-err', '⚠️ Enter a valid email to reset your password'); return; }
    email = email.trim().toLowerCase();
    Auth.sendResetCode(email);
  },

  sendResetCode: function(email) {
    fetch(SUPABASE_AUTH_URL + '/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: email }),
    })
    .then(function(r) {
      if (r.ok) {
        Toast.show('📧 Password reset link sent to ' + email + '. Check your inbox & spam.', 'ok');
      } else {
        Toast.show('⚠️ Could not send reset email. Try again shortly.', 'warn');
      }
    })
    .catch(function() { Toast.show('❌ Network error sending reset email.', 'err'); });
  },

  /* ═══════════════════════════════════════════════════════
     LOGOUT
  ═══════════════════════════════════════════════════════ */
  logout: function() {
    var session = Utils.storage.get('ssp_session');
    var token = session && session.access_token;
    Utils.storage.remove('ssp_session');
    Auth.currentUser = null;
    Auth._session = null;
    if (token) {
      fetch(SUPABASE_AUTH_URL + '/logout', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + token },
      }).catch(function() {});
    }
    location.reload();
  },

  /* ═══════════════════════════════════════════════════════
     LOAD PROFILE AFTER LOGIN & ENTER APP
  ═══════════════════════════════════════════════════════ */
  _loadProfileAndEnter: function() {
    var token = Auth._session.access_token;
    fetch(SUPABASE_URL + '/rest/v1/platform_users?select=*', {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + token },
    })
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      if (!rows || !rows.length) {
        Auth._err('login-err', '❌ Account found but no business profile exists. Contact support.');
        return;
      }
      var row = rows[0];
      if (row.status === 'pending') { Auth._err('login-err', '⏳ Account pending approval from the Primary Admin.'); return; }
      if (row.status === 'rejected') { Auth._err('login-err', '❌ Your registration was rejected.'); return; }
      if (row.status === 'suspended' || row.status === 'disabled') { Auth._err('login-err', '🚫 Account ' + row.status + '. Contact your administrator.'); return; }

      var user = {
        id: row.id, name: row.name, username: row.email, email: row.email,
        role: row.role, status: row.status, photo: row.photo || '',
        businessIds: [row.business_id], currentBusinessId: row.business_id, permissions: {},
      };
      Auth.currentUser = user;
      try { if (typeof Activity !== 'undefined') Activity.startSession(user); } catch(e) {}
      try { if (typeof Platform !== 'undefined') Platform.pingLogin(user, row.business_id); } catch(e) {}

      try {
        DB.init(row.business_id, Auth._session.access_token);
        App.showShell();
        DB.syncFromCloud().then(function() {
          try {
            if (typeof Router !== 'undefined' && Router.current && typeof Router.current.render === 'function') Router.current.render();
          } catch(e) {}
          if (user.role === 'primary_admin') {
            var pendingCount = 0;
            try { pendingCount = (DB.get('users') || []).filter(function(u){ return u.status === 'pending'; }).length; } catch(e){}
            if (pendingCount > 0) Toast.show('📋 ' + pendingCount + ' user approval(s) pending', 'warn');
          }
        });
      } catch(e) { App.showShell(); }
    })
    .catch(function() { Auth._err('login-err', '❌ Could not load your profile. Try again.'); });
  },

  /* ═══════════════════════════════════════════════════════
     SESSION RESTORE ON APP BOOT
  ═══════════════════════════════════════════════════════ */
  bootSync: function() {
    var session = Utils.storage.get('ssp_session');
    if (!session || !session.access_token) return false;

    if (session.expires_at && Date.now() < session.expires_at - 60000) {
      Auth._session = session;
      Auth._loadProfileAndEnter();
      return true;
    }

    if (session.refresh_token) {
      fetch(SUPABASE_AUTH_URL + '/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(res) {
        if (!res.ok) { Utils.storage.remove('ssp_session'); App.showLogin(); return; }
        Auth._session = res.data;
        Utils.storage.set('ssp_session', {
          access_token: res.data.access_token,
          refresh_token: res.data.refresh_token,
          expires_at: Date.now() + (res.data.expires_in * 1000),
        });
        Auth._loadProfileAndEnter();
      })
      .catch(function() { App.showLogin(); });
      return true;
    }

    Utils.storage.remove('ssp_session');
    return false;
  },

  /* ═══════════════════════════════════════════════════════
     UI HELPERS
  ═══════════════════════════════════════════════════════ */
  _err: function(elId, msg) {
    var el = Utils.get(elId);
    if (!el) return;
    el.innerHTML = msg;
    el.classList.remove('hidden');
  },

  _showCheckEmailScreen: function(email, isJoin) {
    var loginScreen = Utils.get('login-screen');
    if (!loginScreen) { Toast.show('📧 Check ' + email + ' to confirm your account', 'ok'); return; }
    loginScreen.innerHTML =
      '<div class="login-card" style="text-align:center;padding:30px 20px">'
      + '<div style="font-size:56px;margin-bottom:14px">📧</div>'
      + '<div class="login-title" style="font-size:20px">Check Your Email</div>'
      + '<div class="login-sub" style="margin:10px 0 20px">'
      + 'We sent a confirmation link to<br><strong>' + Utils.esc(email) + '</strong><br><br>'
      + (isJoin ? 'After confirming, your request still needs approval from the business admin.' : 'Tap the link to activate your account, then sign in.')
      + '</div>'
      + '<button class="btn-ghost btn-full" onclick="location.reload()">← Back to Sign In</button>'
      + '</div>';
  },
};