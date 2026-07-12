/* === auth.js === */
/* SmartStock Pro V5 — Authentication via Supabase Auth (real, cross-device) */
var SUPABASE_EMAIL_URL = 'https://ovbtqkpvhivqnnxojjwu.supabase.co/functions/v1/send-email';
var SUPABASE_AUTH_URL  = 'https://ovbtqkpvhivqnnxojjwu.supabase.co/auth/v1';

var Auth = {
  currentUser: null,
  _session: null,   // { access_token, refresh_token, expires_at }

  /* ═══════════════════════════════════════════════════════
     LOGIN — real Supabase Auth, works from any device
  ═══════════════════════════════════════════════════════ */
  login: function() {
    var input = Utils.val('l-user').trim();
    var pw    = Utils.val('l-pass');
    if (!input) { Auth._err('login-err', '⚠️ Enter your email'); return; }
    if (!pw)    { Auth._err('login-err', '⚠️ Enter your password'); return; }
    if (!input.includes('@')) { Auth._err('login-err', '⚠️ Use the email address you registered with'); return; }

    var btn = Utils.get('login-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

    fetch(SUPABASE_AUTH_URL + '/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: input.toLowerCase(), password: pw }),
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(result) {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
      if (!result.ok) {
        var msg = (result.data && result.data.error_description) || (result.data && result.data.msg) || 'Login failed';
        if (msg.toLowerCase().includes('invalid')) {
          Auth._err('login-err', '❌ Incorrect email or password.');
        } else if (msg.toLowerCase().includes('confirm')) {
          Auth._err('login-err', '📧 Please confirm your email first. Check your inbox.');
        } else {
          Auth._err('login-err', '❌ ' + msg);
        }
        return;
      }
      Auth._session = {
        access_token:  result.data.access_token,
        refresh_token: result.data.refresh_token,
        expires_at:    Date.now() + (result.data.expires_in || 3600) * 1000,
      };
      Utils.storage.set('ssp_session', Auth._session);
      Auth._loadProfileAndEnter();
    })
    .catch(function(err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
      Auth._err('login-err', '❌ Network error: ' + err.message);
    });
  },

  // After a successful Supabase Auth login (or session restore), pull this
  // user's own platform_users + platform_businesses rows and assemble the
  // SAME-SHAPED currentUser object every other module already expects
  // (id, name, email, role, status, businessIds, currentBusinessId, ...).
  _loadProfileAndEnter: function() {
    var hdr = {
      'Content-Type':  'application/json',
      'apikey':         SUPABASE_ANON,
      'Authorization': 'Bearer ' + Auth._session.access_token,
    };
    fetch(SUPABASE_URL + '/rest/v1/platform_users?select=*', { headers: hdr })
      .then(function(r){ return r.json(); })
      .then(function(rows) {
        var row = (Array.isArray(rows) && rows[0]) || null;
        if (!row) {
          if (Utils.get('login-screen') && Utils.get('login-screen').style.display !== 'none') {
            Auth._err('login-err', '❌ Account found but no business profile exists. Contact support.');
          } else {
            Utils.storage.del('ssp_session');
            App.showLogin();
          }
          return;
        }
        if (row.status === 'pending') {
          Auth._showPendingApproval({ businessIds: [row.business_id] });
          return;
        }
        if (row.status === 'rejected') {
          Utils.storage.del('ssp_session');
          App.showLogin();
          setTimeout(function(){ Auth._err('login-err', '❌ Your registration was rejected. Contact the business owner.'); }, 100);
          return;
        }
        if (row.status === 'suspended' || row.status === 'disabled') {
          Utils.storage.del('ssp_session');
          App.showLogin();
          setTimeout(function(){ Auth._err('login-err', '🚫 This account has been ' + row.status + '. Contact your administrator.'); }, 100);
          return;
        }

        var user = {
          id:                row.id,
          username:          row.email,
          name:              row.name,
          email:             row.email,
          phone:             row.phone || '',
          role:              row.role || 'sales_employee',
          status:            row.status || 'active',
          emailVerified:     true,
          businessIds:       [row.business_id],
          currentBusinessId: row.business_id,
          permissions:       row.permissions || {},
          createdAt:         row.registered_at,
          photo:             row.photo || '',
        };

        Auth.currentUser = user;
        try { if (typeof Activity !== 'undefined') Activity.startSession(user); } catch(e) {}
        try { if (typeof Platform !== 'undefined') Platform.pingLogin(user, row.business_id); } catch(e) {}

        // ── Stage 2B: Init cloud sync ──────────────────────────────────────
        try {
          DB.init(row.business_id, Auth._session.access_token);
          App.showShell(); // show UI immediately from local cache
          DB.syncFromCloud().then(function() {
            // Refresh current page after cloud data loads
            try {
              if (typeof Router !== 'undefined' && Router.current && typeof Router.current.render === 'function') {
                Router.current.render();
              }
            } catch(e) {}
            if (user.role === 'primary_admin') {
              var pendingCount = 0;
              try { pendingCount = (DB.get('users') || []).filter(function(u){ return u.status === 'pending'; }).length; } catch(e){}
              if (pendingCount > 0) Toast.show('📋 ' + pendingCount + ' user approval(s) pending — check Team & Access', 'warn');
            }
          });
        } catch(e) {
          App.showShell();
        }
      })
      .catch(function(err) {
        if (Utils.get('login-screen') && Utils.get('login-screen').style.display !== 'none') {
          Auth._err('login-err', '❌ Could not load profile: ' + err.message);
        } else {
          App.showLogin();
        }
      });
  },

  /* ═══════════════════════════════════════════════════════
     REGISTRATION — CREATE NEW BUSINESS (real Supabase Auth account)
  ═══════════════════════════════════════════════════════ */
  signup: function() {
    var bizName  = Utils.val('s-biz').trim();
    var name     = Utils.val('s-name').trim();
    var email    = Utils.val('s-email').trim().toLowerCase();
    var phone    = Utils.val('s-phone').trim();
    var pw       = Utils.val('s-pass');
    var pwConf   = Utils.val('s-pass-conf');

    if (!bizName)  { Auth._err('signup-err', '⚠️ Business name is required'); return; }
    if (!name)     { Auth._err('signup-err', '⚠️ Your full name is required'); return; }
    if (!email || !email.includes('@')) { Auth._err('signup-err', '⚠️ Enter a valid email address'); return; }
    if (!phone)    { Auth._err('signup-err', '⚠️ Phone number is required'); return; }
    if (pw.length < 8) { Auth._err('signup-err', '⚠️ Password must be at least 8 characters'); return; }
    if (pw !== pwConf)  { Auth._err('signup-err', '⚠️ Passwords do not match'); return; }
    if (!Auth._strongPw(pw)) { Auth._err('signup-err', '⚠️ Password must contain uppercase, lowercase and a number'); return; }

    var btn = Utils.get('signup-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }

    var bizId  = Utils.uid('BIZ');
    var userMeta = { name: name, business_id: bizId, role: 'primary_admin' };

    fetch(SUPABASE_AUTH_URL + '/signup?redirect_to=' + encodeURIComponent(Auth._confirmRedirect()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: email, password: pw, data: userMeta }),
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(result) {
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
      if (!result.ok) {
        var msg = (result.data && result.data.msg) || (result.data && result.data.error_description) || 'Sign up failed';
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
          Auth._err('signup-err', '❌ An account with this email already exists. Please sign in.');
        } else {
          Auth._err('signup-err', '❌ ' + msg);
        }
        return;
      }

      var authUserId = result.data.id || (result.data.user && result.data.user.id);

      // Create the matching business + user rows in our own tables
      var biz  = { id: bizId, name: bizName, owner_name: name, owner_email: email, owner_phone: phone, status: 'active' };
      var user = { id: authUserId, business_id: bizId, name: name, email: email, phone: phone, role: 'primary_admin', status: 'active' };

      fetch(SUPABASE_URL + '/rest/v1/platform_businesses', {
        method: 'POST', headers: Platform._hdr(), body: JSON.stringify(biz),
      }).catch(function(){});
      fetch(SUPABASE_URL + '/rest/v1/platform_users', {
        method: 'POST', headers: Platform._hdr(), body: JSON.stringify(user),
      }).catch(function(){});

      DB.saveSettings({ bizName: bizName, currency: '$', bizPhone: phone, bizEmail: email });
      try { if (typeof AuditLog !== 'undefined') AuditLog.record('REGISTER', 'Created business: ' + bizName); } catch(e) {}

      // Supabase sends its own confirmation email automatically on signup.
      Auth._showCheckEmailScreen(email);
    })
    .catch(function(err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
      Auth._err('signup-err', '❌ Network error: ' + err.message);
    });
  },

  _showCheckEmailScreen: function(email) {
    var loginScreen = Utils.get('login-screen');
    if (!loginScreen) return;
    loginScreen.innerHTML =
      '<div style="width:100%;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:linear-gradient(160deg,#070A12,#0d1a2e,#070A12);box-sizing:border-box">'
      + '<div style="width:100%;max-width:420px;background:rgba(13,26,46,.9);border:1px solid rgba(212,168,67,.15);border-radius:20px;padding:24px 20px;box-sizing:border-box;text-align:center">'
      + '<div style="font-size:52px;margin-bottom:8px">📧</div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1)">Check Your Email</div>'
      + '<div style="font-size:13px;color:var(--t2);margin:12px 0 20px;line-height:1.7">We sent a confirmation link to<br><strong style="color:var(--g)">' + Utils.esc(email) + '</strong><br><br>Tap the link in that email, then come back here and sign in.</div>'
      + '<button class="btn-primary btn-full" onclick="location.reload()">← Back to Sign In</button>'
      + '</div></div>';
    loginScreen.style.display = 'block';
    loginScreen.classList.remove('hidden');
  },

  /* ═══════════════════════════════════════════════════════
     JOIN EXISTING BUSINESS (real Supabase Auth account, status=pending)
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

    Auth._err('join-err', '🔍 Searching for "' + Utils.esc(bizName) + '"...');
    fetch(SUPABASE_URL + '/rest/v1/platform_businesses?name=ilike.' + encodeURIComponent(bizName) + '&select=id,name,status', {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON },
    })
    .then(function(r){ return r.json(); })
    .then(function(results) {
      if (!results || !results.length) {
        Auth._err('join-err',
          '❌ No business named "' + Utils.esc(bizName) + '" found.<br><br>'
          + '<strong>Is this your first time?</strong><br>'
          + '👉 Go to <strong>New Biz</strong> tab to register your business.<br><br>'
          + 'If your employer created the business, ask them for the <strong>exact business name</strong>.'
        );
        return;
      }
      Auth._continueJoin(results[0], name, email, phone, pw);
    })
    .catch(function() {
      Auth._err('join-err', '❌ Could not search for that business. Check your connection and try again.');
    });
  },

  _continueJoin: function(biz, name, email, phone, pw) {
    var userMeta = { name: name, business_id: biz.id, role: 'sales_employee' };

    fetch(SUPABASE_AUTH_URL + '/signup?redirect_to=' + encodeURIComponent(Auth._confirmRedirect()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: email, password: pw, data: userMeta }),
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(result) {
      if (!result.ok) {
        var msg = (result.data && result.data.msg) || 'Sign up failed';
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
          Auth._err('join-err', '❌ An account with this email already exists.');
        } else {
          Auth._err('join-err', '❌ ' + msg);
        }
        return;
      }

      var authUserId = result.data.id || (result.data.user && result.data.user.id);
      var user = { id: authUserId, business_id: biz.id, name: name, email: email, phone: phone, role: 'sales_employee', status: 'pending' };

      fetch(SUPABASE_URL + '/rest/v1/platform_users', {
        method: 'POST', headers: Platform._hdr(), body: JSON.stringify(user),
      }).catch(function(){});

      try { if (typeof AuditLog !== 'undefined') AuditLog.record('JOIN_REQUEST', 'Requested to join: ' + biz.name); } catch(e) {}
      Auth._showCheckEmailScreen(email);
      Toast.show('Request sent — confirm your email, then wait for approval', 'ok');
    })
    .catch(function(err) {
      Auth._err('join-err', '❌ Network error: ' + err.message);
    });
  },

  _showPendingApproval: function(user) {
    var loginScreen = Utils.get('login-screen');
    if (!loginScreen) return;
    loginScreen.innerHTML = '<div class="login-card">'
      + '<div style="text-align:center;padding:20px 0">'
      + '<div style="font-size:64px;margin-bottom:14px">⏳</div>'
      + '<div class="login-title" style="font-size:20px">Awaiting Approval</div>'
      + '<div class="login-sub" style="margin-bottom:16px">Your email is confirmed!</div>'
      + '<div style="background:var(--wab);border:1px solid var(--wabd);border-radius:var(--r12);padding:16px;font-size:13px;color:var(--t1);line-height:1.7;margin-bottom:20px">'
      + 'Your registration request has been submitted to the Primary Admin.<br><br>'
      + 'You will be able to sign in once your account is approved.'
      + '</div>'
      + '<button class="btn-ghost btn-full" onclick="location.reload()">← Back to Sign In</button>'
      + '</div></div>';
  },

  /* ═══════════════════════════════════════════════════════
     FORGOT PASSWORD — real Supabase Auth reset email
  ═══════════════════════════════════════════════════════ */
  forgotPassword: function() {
    // Fallback: if the modal system is unavailable for any reason,
    // use a simple prompt so the feature always works.
    if (typeof Modal === 'undefined' || !Utils.get('modal-overlay')) {
      var email = window.prompt('Enter your registered email address:');
      if (email && email.includes('@')) {
        fetch(SUPABASE_AUTH_URL + '/recover?redirect_to=' + encodeURIComponent(Auth._confirmRedirect().replace('confirm.html','reset.html')), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }).then(function(){ alert('If an account exists for that email, a reset link has been sent.'); })
          .catch(function(){ alert('Network error - try again.'); });
      }
      return;
    }
    Modal.open({
      title: 'Reset Password', barColor: 'var(--wa)',
      sub: 'Enter your registered email address',
      body: '<div class="fg"><label class="fl">Email Address</label>'
          + '<input class="fi" id="fp-email" type="email" placeholder="your@email.com"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Auth.sendResetCode()">📧 Send Reset Link</button>',
    });
  },

  sendResetCode: function() {
    var email = Utils.val('fp-email').trim().toLowerCase();
    if (!email || !email.includes('@')) { Toast.show('Enter a valid email', 'err'); return; }

    fetch(SUPABASE_AUTH_URL + '/recover?redirect_to=' + encodeURIComponent(Auth._confirmRedirect().replace('confirm.html','reset.html')), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: email }),
    })
    .then(function(){
      Modal.close();
      Toast.show('If an account exists for that email, a reset link has been sent.', 'ok');
    })
    .catch(function() {
      Toast.show('Network error — try again', 'err');
    });
  },

  /* ═══════════════════════════════════════════════════════
     LOGOUT — ends the real Supabase session
  ═══════════════════════════════════════════════════════ */
  logout: function() {
    try { if (typeof Activity !== 'undefined') Activity.endSession(); } catch(e) {}
    try { if (typeof AuditLog !== 'undefined') AuditLog.record('LOGOUT', 'User logged out'); } catch(e) {}
    var token = Auth._session && Auth._session.access_token;
    if (token) {
      fetch(SUPABASE_AUTH_URL + '/logout', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + token },
      }).catch(function(){});
    }
    Auth.currentUser = null;
    Auth._session = null;
    Utils.storage.del('ssp_session');
    location.reload();
  },

  /* ═══════════════════════════════════════════════════════
     APPROVAL WORKFLOW (called by UserMgmt) — updates platform_users
  ═══════════════════════════════════════════════════════ */
  approveUser: function(userId, role) {
    var token = Auth._session && Auth._session.access_token;
    var data  = { status: 'active' };
    if (role) data.role = role;
    fetch(SUPABASE_URL + '/rest/v1/platform_users?id=eq.' + encodeURIComponent(userId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + (token || SUPABASE_ANON),
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    })
    .then(function(r){ return r.json(); })
    .then(function(rows) {
      var u = Array.isArray(rows) && rows[0];
      if (!u) { Toast.show('Could not approve — check connection', 'err'); return; }
      try { if (typeof AuditLog !== 'undefined') AuditLog.record('USER_APPROVED', 'Approved: ' + u.name + ' as ' + (role||u.role)); } catch(e) {}
      Auth._sendEmail({ to: u.email, type: 'approved', name: u.name, bizName: DB.getSettings().bizName || 'SmartStock Pro' }, null);
      Toast.show(u.name + ' approved ✓', 'ok');
    })
    .catch(function() { Toast.show('Could not approve — check connection', 'err'); });
  },

  rejectUser: function(userId) {
    var token = Auth._session && Auth._session.access_token;
    fetch(SUPABASE_URL + '/rest/v1/platform_users?id=eq.' + encodeURIComponent(userId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + (token || SUPABASE_ANON),
      },
      body: JSON.stringify({ status: 'rejected' }),
    })
    .then(function(){
      try { if (typeof AuditLog !== 'undefined') AuditLog.record('USER_REJECTED', 'Rejected user: ' + userId); } catch(e) {}
      Toast.show('User rejected', 'warn');
    })
    .catch(function() { Toast.show('Could not reject — check connection', 'err'); });
  },

  /* ═══════════════════════════════════════════════════════
     UI TABS  (unchanged from before)
  ═══════════════════════════════════════════════════════ */
  showTab: function(tab) {
    var forms = ['login-form','signup-form','join-form'];
    var tabs  = ['ltab-in','ltab-up','ltab-join'];
    forms.forEach(function(f) {
      var el = Utils.get(f);
      if (el) { el.style.display = 'none'; el.classList.add('hidden'); }
    });
    tabs.forEach(function(t) {
      var el = Utils.get(t);
      if (el) {
        el.classList.remove('active');
        el.style.background = 'transparent';
        el.style.color = 'rgba(255,255,255,0.5)';
      }
    });
    ['login-err','signup-err','join-err'].forEach(function(e) {
      var el = Utils.get(e);
      if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
    });
    var formMap = { 'in':'login-form', 'up':'signup-form', 'join':'join-form' };
    var tabMap  = { 'in':'ltab-in',    'up':'ltab-up',     'join':'ltab-join' };
    var showForm = Utils.get(formMap[tab]);
    var activeTab= Utils.get(tabMap[tab]);
    if (showForm) { showForm.style.display = 'block'; showForm.classList.remove('hidden'); }
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.style.background = '#D4A843';
      activeTab.style.color = '#07080D';
    }
  },

  togglePw: function(id) {
    var el = Utils.get(id);
    if (el) el.type = (el.type === 'password') ? 'text' : 'password';
  },

  /* ═══════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════ */
  _err: function(id, msg) {
    var el = Utils.get(id);
    if (el) {
      el.innerHTML = msg;
      el.classList.remove('hidden');
      el.style.display = 'block';
    }
  },


  // URL of the post-confirmation landing page (works on any host)
  _confirmRedirect: function() {
    return location.origin + location.pathname.replace(/[^\/]*$/, '') + 'confirm.html';
  },

  _strongPw: function(pw) {
    return /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
  },

  /* ═══════════════════════════════════════════════════════
     SEND EMAIL via Supabase Edge Function (used for the
     custom "approved" notification only — signup/reset
     emails are now sent natively by Supabase Auth itself)
  ═══════════════════════════════════════════════════════ */
  _sendEmail: function(payload, fallbackCode) {
    return fetch(SUPABASE_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) return { sent: true };
      return { sent: false, code: fallbackCode };
    })
    .catch(function() {
      return { sent: false, code: fallbackCode };
    });
  },

  /* ═══════════════════════════════════════════════════════
     SESSION RESTORE — runs on app boot. Tries the stored
     Supabase session first (works across restarts on the
     SAME device); if the access token has expired, uses the
     refresh token to get a new one automatically.
  ═══════════════════════════════════════════════════════ */
  bootSync: function() {
    var sess = Utils.storage.get('ssp_session');
    if (!sess || !sess.access_token) return false;
    Auth._session = sess;

    if (Date.now() < sess.expires_at - 30000) {
      Auth._loadProfileAndEnter();
      return true;
    }

    // Expired — try to refresh silently
    if (sess.refresh_token) {
      fetch(SUPABASE_AUTH_URL + '/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ refresh_token: sess.refresh_token }),
      })
      .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
      .then(function(result) {
        if (!result.ok) { Utils.storage.del('ssp_session'); App.showLogin(); return; }
        Auth._session = {
          access_token:  result.data.access_token,
          refresh_token: result.data.refresh_token,
          expires_at:    Date.now() + (result.data.expires_in || 3600) * 1000,
        };
        Utils.storage.set('ssp_session', Auth._session);
        Auth._loadProfileAndEnter();
      })
      .catch(function() { Utils.storage.del('ssp_session'); App.showLogin(); });
      return true; // tell App we're attempting a restore (async)
    }

    Utils.storage.del('ssp_session');
    return false;
  },
};
