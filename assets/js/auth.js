/* SmartStock Pro V5 — Complete Authentication System */
var Auth = {
  currentUser: null,
  _failedAttempts: {},  // track failed logins per username
  _resetUser: '',

  /* ═══════════════════════════════════════════════════════
     LOGIN
  ═══════════════════════════════════════════════════════ */
  login: function() {
    var input = Utils.val('l-user').trim();
    var pw    = Utils.val('l-pass');
    if (!input) { Auth._err('login-err', '⚠️ Enter your email or username'); return; }
    if (!pw)    { Auth._err('login-err', '⚠️ Enter your password'); return; }

    var users = DB.get('users') || [];
    if (!users.length) { Auth._err('login-err', 'No accounts found. Please create a business first.'); return; }

    // Find by email OR username
    var user = null;
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if ((u.email && u.email.toLowerCase() === input.toLowerCase()) ||
          (u.username && u.username.toLowerCase() === input.toLowerCase())) {
        user = u; break;
      }
    }
    if (!user) { Auth._err('login-err', '❌ No account found with that email or username.'); return; }

    // Account lockout after 5 failed attempts
    var key = user.username;
    var attempts = Auth._failedAttempts[key] || { count: 0, lastAttempt: 0 };
    var now = Date.now();
    if (attempts.count >= 5 && (now - attempts.lastAttempt) < 15 * 60 * 1000) {
      var mins = Math.ceil((15 * 60 * 1000 - (now - attempts.lastAttempt)) / 60000);
      Auth._err('login-err', '🔒 Account locked. Too many failed attempts. Try again in ' + mins + ' minute(s).');
      return;
    }

    // Status checks
    if (user.status === 'pending') {
      Auth._err('login-err', '⏳ Account pending approval from the Primary Admin. Please wait.');
      return;
    }
    if (user.status === 'rejected') {
      Auth._err('login-err', '❌ Your registration was rejected. Contact the business owner.');
      return;
    }
    if (user.status === 'suspended' || user.status === 'disabled') {
      Auth._err('login-err', '🚫 This account has been ' + user.status + '. Contact your administrator.');
      return;
    }

    // Email verification check
    if (user.emailVerified === false) {
      Auth._showVerificationRequired(user);
      return;
    }

    // Password check
    var ok = (pw === user.password)
          || (typeof btoa !== 'undefined' && btoa(pw) === user.password);

    if (!ok) {
      // Try SHA-256
      Auth._hashPw(pw).then(function(hashed) {
        if (hashed === user.password) {
          Auth._failedAttempts[key] = { count: 0, lastAttempt: 0 };
          Auth._doLogin(user);
        } else {
          attempts.count++;
          attempts.lastAttempt = Date.now();
          Auth._failedAttempts[key] = attempts;
          var remaining = 5 - attempts.count;
          if (remaining > 0) {
            Auth._err('login-err', '❌ Incorrect password. ' + remaining + ' attempt(s) remaining.');
          } else {
            Auth._err('login-err', '🔒 Account locked for 15 minutes due to too many failed attempts.');
          }
          try { if (typeof AuditLog !== 'undefined') AuditLog.record('LOGIN_FAILED', 'Failed login for: ' + user.username); } catch(e) {}
        }
      });
      return;
    }

    Auth._failedAttempts[key] = { count: 0, lastAttempt: 0 };
    Auth._doLogin(user);
  },

  _doLogin: function(user) {
    Auth.currentUser = user;
    Utils.storage.set('ssp_session', { uid: user.id, loginTime: new Date().toISOString() });
    try { if (typeof Activity !== 'undefined') Activity.startSession(user); } catch(e) {}
    try { if (typeof AuditLog !== 'undefined') AuditLog.record('LOGIN', 'Successful login'); } catch(e) {}

    // Check for pending user approvals (notify primary admin)
    if (user.role === 'primary_admin') {
      var pendingCount = (DB.get('users') || []).filter(function(u){ return u.status === 'pending'; }).length;
      if (pendingCount > 0) {
        setTimeout(function() {
          Toast.show('📋 ' + pendingCount + ' user approval(s) pending — check Team & Access', 'warn');
        }, 2000);
      }
    }
    App.showShell();
  },

  _showVerificationRequired: function(user) {
    Auth._err('login-err', '📧 Email not verified. Check your inbox or resend the verification email.');
    // Show resend button
    var errEl = Utils.get('login-err');
    if (errEl) {
      errEl.innerHTML += '<br><button onclick="Auth.resendVerification(\'' + user.id + '\')" style="margin-top:8px;background:var(--g);color:#07080D;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">📧 Resend Verification</button>';
    }
  },

  /* ═══════════════════════════════════════════════════════
     REGISTRATION — CREATE NEW BUSINESS
  ═══════════════════════════════════════════════════════ */
  signup: function() {
    var bizName  = Utils.val('s-biz').trim();
    var name     = Utils.val('s-name').trim();
    var email    = Utils.val('s-email').trim().toLowerCase();
    var phone    = Utils.val('s-phone').trim();
    var pw       = Utils.val('s-pass');
    var pwConf   = Utils.val('s-pass-conf');

    // Validation
    if (!bizName)  { Auth._err('signup-err', '⚠️ Business name is required'); return; }
    if (!name)     { Auth._err('signup-err', '⚠️ Your full name is required'); return; }
    if (!email || !email.includes('@')) { Auth._err('signup-err', '⚠️ Enter a valid email address'); return; }
    if (!phone)    { Auth._err('signup-err', '⚠️ Phone number is required'); return; }
    if (pw.length < 8) { Auth._err('signup-err', '⚠️ Password must be at least 8 characters'); return; }
    if (pw !== pwConf)  { Auth._err('signup-err', '⚠️ Passwords do not match'); return; }
    if (!Auth._strongPw(pw)) { Auth._err('signup-err', '⚠️ Password must contain uppercase, lowercase and a number'); return; }

    var users      = DB.get('users') || [];
    var businesses = DB.get('businesses') || [];

    // Check duplicate email
    for (var i = 0; i < users.length; i++) {
      if (users[i].email && users[i].email.toLowerCase() === email) {
        Auth._err('signup-err', '❌ An account with this email already exists. Please sign in.'); return;
      }
    }

    // Check duplicate business name
    for (var j = 0; j < businesses.length; j++) {
      if (businesses[j].name.toLowerCase() === bizName.toLowerCase()) {
        Auth._err('signup-err', '❌ "' + bizName + '" is already registered. Contact the business owner or choose a different name.');
        return;
      }
    }

    var verifyCode = Auth._genCode();
    var userId     = Utils.uid('U');
    var bizId      = Utils.uid('BIZ');

    // Create business
    var biz = {
      id:        bizId,
      name:      bizName,
      address:   '',
      phone:     phone,
      email:     email,
      currency:  '$',
      timezone:  'Africa/Monrovia',
      logo:      '',
      ownerId:   userId,
      createdAt: Utils.today(),
    };
    businesses.push(biz);
    DB.set('businesses', biz.id && [biz].concat(businesses.filter(function(b){ return b.id !== biz.id; })) || businesses);

    // Create default branch
    var branches = DB.get('branches') || [];
    branches.push({ id: Utils.uid('BR'), businessId: bizId, name: 'Main Branch', location: '', managerId: userId, createdAt: Utils.today() });
    DB.set('branches', branches);

    // Create Primary Admin user
    var user = {
      id:             userId,
      username:       email,          // email is username
      name:           name,
      email:          email,
      phone:          phone,
      role:           'primary_admin',
      status:         'active',
      emailVerified:  false,          // must verify
      verifyCode:     verifyCode,
      businessIds:    [bizId],
      currentBusinessId: bizId,
      permissions:    {},
      createdAt:      Utils.today(),
      password:       pw,
    };
    users.push(user);
    DB.set('users', users);

    DB.saveSettings({ bizName: bizName, currency: '$', bizPhone: phone, bizEmail: email });
    try { if (typeof AuditLog !== 'undefined') AuditLog.record('REGISTER', 'Created business: ' + bizName); } catch(e) {}

    // Show verification screen instead of logging in
    Auth._showEmailVerification(user, verifyCode);
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
    if (pw.length < 6) { Auth._err('join-err', '⚠️ Password min 6 characters'); return; }
    if (pw !== pwConf)  { Auth._err('join-err', '⚠️ Passwords do not match'); return; }

    var businesses = DB.get('businesses') || [];
    var biz = null;
    for (var i = 0; i < businesses.length; i++) {
      if (businesses[i].name.toLowerCase() === bizName.toLowerCase()) { biz = businesses[i]; break; }
    }
    if (!biz) {
      Auth._err('join-err', '❌ Business "' + bizName + '" not found. Check the name or contact the business owner.');
      return;
    }

    var users = DB.get('users') || [];
    for (var j = 0; j < users.length; j++) {
      if (users[j].email && users[j].email.toLowerCase() === email) {
        Auth._err('join-err', '❌ An account with this email already exists.'); return;
      }
    }

    var verifyCode = Auth._genCode();
    var user = {
      id:            Utils.uid('U'),
      username:      email,
      name:          name,
      email:         email,
      phone:         phone,
      role:          'sales_employee',
      status:        'pending',       // awaits approval
      emailVerified: false,
      verifyCode:    verifyCode,
      businessIds:   [biz.id],
      currentBusinessId: biz.id,
      permissions:   {},
      createdAt:     Utils.today(),
      password:      pw,
      requestedBizId: biz.id,
    };
    users.push(user);
    DB.set('users', users);

    // Notify primary admin
    try {
      var notifs = DB.get('notifications') || [];
      notifs.unshift({ id: Utils.uid('N'), type: 'user_request', message: name + ' has requested to join ' + biz.name, userId: user.id, bizId: biz.id, read: false, createdAt: new Date().toISOString() });
      DB.set('notifications', notifs);
    } catch(e) {}

    try { if (typeof AuditLog !== 'undefined') AuditLog.record('JOIN_REQUEST', 'Requested to join: ' + bizName); } catch(e) {}

    Auth._showEmailVerification(user, verifyCode);
  },

  /* ═══════════════════════════════════════════════════════
     EMAIL VERIFICATION
  ═══════════════════════════════════════════════════════ */
  _showEmailVerification: function(user, code) {
    var loginScreen = Utils.get('login-screen');
    if (!loginScreen) return;
    loginScreen.innerHTML = '<div class="login-card">'
      + '<div style="text-align:center;padding:10px 0 20px">'
      + '<div style="font-size:64px;margin-bottom:14px">📧</div>'
      + '<div class="login-title" style="font-size:20px">Verify Your Email</div>'
      + '<div class="login-sub" style="margin-bottom:18px">We sent a 6-digit code to<br><strong style="color:var(--g)">' + Utils.esc(user.email) + '</strong></div>'
      + '<div id="verify-err" class="form-err hidden"></div>'
      + '<div class="fg"><label class="fl">Enter Verification Code</label>'
      + '<input class="fi" id="verify-code" type="text" maxlength="6" placeholder="000000" style="text-align:center;font-size:24px;font-weight:700;letter-spacing:8px">'
      + '</div>'
      + '<button class="btn-primary btn-full" onclick="Auth.verifyEmail(\'' + user.id + '\')" style="margin-bottom:12px">✓ Verify Email</button>'
      + '<button class="btn-ghost btn-full" onclick="Auth.resendVerification(\'' + user.id + '\')">📧 Resend Code</button>'
      + '<div style="margin-top:16px;font-size:12px;color:var(--t3)">For demo: your code is <strong style="color:var(--g)">' + code + '</strong></div>'
      + '</div>'
      + '<div style="text-align:center;margin-top:14px"><button class="btn-ghost btn-sm" onclick="location.reload()">← Back to Sign In</button></div>'
      + '</div>';
    loginScreen.style.display = 'flex';
    loginScreen.classList.remove('hidden');
  },

  verifyEmail: function(userId) {
    var code  = Utils.val('verify-code').trim();
    var users = DB.get('users') || [];
    var idx   = -1;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) { idx = i; break; }
    }
    if (idx < 0) { Auth._err('verify-err', 'Account not found'); return; }
    if (!code) { Auth._err('verify-err', 'Enter the 6-digit code'); return; }

    if (users[idx].verifyCode !== code) {
      Auth._err('verify-err', '❌ Incorrect code. Check your email and try again.');
      return;
    }
    users[idx].emailVerified = true;
    users[idx].verifyCode    = null;
    DB.set('users', users);
    try { if (typeof AuditLog !== 'undefined') AuditLog.record('EMAIL_VERIFIED', 'Email verified: ' + users[idx].email); } catch(e) {}

    if (users[idx].status === 'pending') {
      // Joined existing business — awaiting approval
      Auth._showPendingApproval(users[idx]);
    } else {
      // Created new business — log in immediately
      Auth._doLogin(users[idx]);
      Toast.show('✅ Email verified! Welcome to SmartStock Pro.', 'ok');
    }
  },

  _showPendingApproval: function(user) {
    var loginScreen = Utils.get('login-screen');
    if (!loginScreen) return;
    loginScreen.innerHTML = '<div class="login-card">'
      + '<div style="text-align:center;padding:20px 0">'
      + '<div style="font-size:64px;margin-bottom:14px">⏳</div>'
      + '<div class="login-title" style="font-size:20px">Awaiting Approval</div>'
      + '<div class="login-sub" style="margin-bottom:16px">Your email is verified!</div>'
      + '<div style="background:var(--wab);border:1px solid var(--wabd);border-radius:var(--r12);padding:16px;font-size:13px;color:var(--t1);line-height:1.7;margin-bottom:20px">'
      + 'Your registration request has been submitted to the Primary Admin of <strong>' + Utils.esc(user.businessIds && user.businessIds[0] ? Auth._getBizName(user.businessIds[0]) : 'the business') + '</strong>.<br><br>'
      + 'You will be notified once your account is approved.'
      + '</div>'
      + '<button class="btn-ghost btn-full" onclick="location.reload()">← Back to Sign In</button>'
      + '</div></div>';
  },

  _getBizName: function(bizId) {
    var bizes = DB.get('businesses') || [];
    var b = bizes.find(function(x){ return x.id === bizId; });
    return b ? b.name : 'Unknown';
  },

  resendVerification: function(userId) {
    var users = DB.get('users') || [];
    var idx = -1;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) { idx = i; break; }
    }
    if (idx < 0) { Toast.show('Account not found', 'err'); return; }
    var newCode = Auth._genCode();
    users[idx].verifyCode = newCode;
    DB.set('users', users);
    Toast.show('New code: ' + newCode + ' (shown for demo — would email in production)', 'ok');
  },

  /* ═══════════════════════════════════════════════════════
     FORGOT PASSWORD
  ═══════════════════════════════════════════════════════ */
  forgotPassword: function() {
    Modal.open({
      title: 'Reset Password', barColor: 'var(--wa)',
      sub: 'Enter your registered email address',
      body: '<div class="fg"><label class="fl">Email Address</label>'
          + '<input class="fi" id="fp-email" type="email" placeholder="your@email.com"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Auth.sendResetCode()">📧 Send Reset Code</button>',
    });
  },

  sendResetCode: function() {
    var email = Utils.val('fp-email').trim().toLowerCase();
    if (!email || !email.includes('@')) { Toast.show('Enter a valid email', 'err'); return; }
    var users = DB.get('users') || [];
    var user = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].email && users[i].email.toLowerCase() === email) { user = users[i]; break; }
    }
    if (!user) {
      Toast.show('No account found with that email', 'err');
      return;
    }
    var code    = Auth._genCode();
    var expiry  = Date.now() + 15 * 60 * 1000; // 15 min expiry
    var userArr = DB.get('users') || [];
    for (var j = 0; j < userArr.length; j++) {
      if (userArr[j].id === user.id) {
        userArr[j].resetCode   = code;
        userArr[j].resetExpiry = expiry;
        break;
      }
    }
    DB.set('users', userArr);
    try { if (typeof AuditLog !== 'undefined') AuditLog.record('PASSWORD_RESET_REQUEST', 'Reset code sent to: ' + email); } catch(e) {}
    Modal.close();

    // Show code entry form
    setTimeout(function() {
      Modal.open({
        title: 'Enter Reset Code', barColor: 'var(--wa)',
        sub: 'Code sent to ' + email + ' (expires in 15 min)',
        body: '<div style="background:var(--wab);border:1px solid var(--wabd);border-radius:var(--r10);padding:12px;margin-bottom:14px;font-size:12px;color:var(--wa)">'
            + '📧 For demo, your reset code is: <strong style="font-size:16px;letter-spacing:4px">' + code + '</strong></div>'
            + '<div class="fg"><label class="fl">6-Digit Reset Code</label>'
            + '<input class="fi" id="rc-code" type="text" maxlength="6" placeholder="000000" style="text-align:center;font-size:20px;font-weight:700;letter-spacing:6px"></div>'
            + '<div class="fg"><label class="fl">New Password (min 8 chars)</label>'
            + '<input class="fi" id="rc-new" type="password" placeholder="New password"></div>'
            + '<div class="fg"><label class="fl">Confirm New Password</label>'
            + '<input class="fi" id="rc-conf" type="password" placeholder="Confirm password"></div>',
        footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
              + '<button class="btn-primary" style="flex:1" onclick="Auth.confirmReset(\'' + user.id + '\')">✓ Reset Password</button>',
      });
    }, 300);
  },

  confirmReset: function(userId) {
    var code  = Utils.val('rc-code').trim();
    var newPw = Utils.val('rc-new');
    var conf  = Utils.val('rc-conf');
    if (!code)             { Toast.show('Enter the reset code', 'err'); return; }
    if (newPw.length < 8)  { Toast.show('Password min 8 characters', 'err'); return; }
    if (newPw !== conf)    { Toast.show('Passwords do not match', 'err'); return; }

    var users = DB.get('users') || [];
    var idx   = -1;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) { idx = i; break; }
    }
    if (idx < 0) { Toast.show('Account not found', 'err'); return; }

    var u = users[idx];
    if (u.resetCode !== code) { Toast.show('❌ Incorrect reset code', 'err'); return; }
    if (u.resetExpiry && Date.now() > u.resetExpiry) { Toast.show('❌ Reset code expired. Request a new one.', 'err'); return; }

    users[idx].password    = newPw;
    users[idx].resetCode   = null;
    users[idx].resetExpiry = null;
    DB.set('users', users);

    try { if (typeof AuditLog !== 'undefined') AuditLog.record('PASSWORD_RESET', 'Password reset for: ' + u.email); } catch(e) {}
    Modal.close();
    Toast.show('✅ Password reset successfully! Sign in with your new password.', 'ok');
  },

  /* ═══════════════════════════════════════════════════════
     LOGOUT
  ═══════════════════════════════════════════════════════ */
  logout: function() {
    try { if (typeof Activity !== 'undefined') Activity.endSession(); } catch(e) {}
    try { if (typeof AuditLog !== 'undefined') AuditLog.record('LOGOUT', 'User logged out'); } catch(e) {}
    Auth.currentUser = null;
    Utils.storage.del('ssp_session');
    location.reload();
  },

  /* ═══════════════════════════════════════════════════════
     APPROVAL WORKFLOW (called by UserMgmt)
  ═══════════════════════════════════════════════════════ */
  approveUser: function(userId, role) {
    var users = DB.get('users') || [];
    var idx   = -1;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) { idx = i; break; }
    }
    if (idx < 0) return;
    users[idx].status = 'active';
    if (role) users[idx].role = role;
    DB.set('users', users);
    try { if (typeof AuditLog !== 'undefined') AuditLog.record('USER_APPROVED', 'Approved: ' + users[idx].name + ' as ' + (role||users[idx].role)); } catch(e) {}
    Toast.show(users[idx].name + ' approved ✓', 'ok');
  },

  rejectUser: function(userId) {
    var users = DB.get('users') || [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) { users[i].status = 'rejected'; break; }
    }
    DB.set('users', users);
    try { if (typeof AuditLog !== 'undefined') AuditLog.record('USER_REJECTED', 'Rejected user: ' + userId); } catch(e) {}
    Toast.show('User rejected', 'warn');
  },

  /* ═══════════════════════════════════════════════════════
     UI TABS
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
      if (el) el.classList.remove('active');
    });
    var errIds = ['login-err','signup-err','join-err'];
    errIds.forEach(function(e) {
      var el = Utils.get(e);
      if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
    });
    var formMap  = { 'in':'login-form',  'up':'signup-form',  'join':'join-form' };
    var tabMap   = { 'in':'ltab-in',     'up':'ltab-up',      'join':'ltab-join' };
    var showForm = Utils.get(formMap[tab]);
    var showTab  = Utils.get(tabMap[tab]);
    if (showForm) { showForm.style.display = 'block'; showForm.classList.remove('hidden'); }
    if (showTab)  { showTab.classList.add('active'); }
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

  _genCode: function() {
    return String(Math.floor(100000 + Math.random() * 900000));
  },

  _strongPw: function(pw) {
    return /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
  },

  _hashPw: function(pw) {
    return new Promise(function(resolve) {
      try {
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw)).then(function(buf) {
          resolve(Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join(''));
        }).catch(function() { resolve(btoa(pw)); });
      } catch(e) { resolve(btoa(pw)); }
    });
  },

  bootSync: function() {
    try {
      var sess = Utils.storage.get('ssp_session');
      if (sess && sess.uid) {
        var users = DB.get('users') || [];
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === sess.uid && users[i].status === 'active') {
            Auth.currentUser = users[i]; return true;
          }
        }
      }
    } catch(e) {}
    return false;
  },
};
