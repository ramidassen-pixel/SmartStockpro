var Auth = {
  currentUser: null,

  login: function() {
    var username = Utils.val('l-user');
    var password = Utils.val('l-pass');
    if (!username) { Auth._err('login-err', 'Enter your username'); return; }
    if (!password) { Auth._err('login-err', 'Enter your password'); return; }
    var users = DB.get('users') || [];
    if (!users.length) { Auth._err('login-err', 'No accounts yet — create one first'); return; }
    var user = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === username.toLowerCase()) { user = users[i]; break; }
    }
    if (!user) { Auth._err('login-err', 'Username not found'); return; }
    // Check password — supports plain, btoa, and SHA-256 hash
    var ok = (password === user.password)
          || (btoa(password) === user.password)
          || (typeof user.password === 'string' && user.password.length < 20 && password === user.password);
    if (!ok) {
      // Try SHA-256 async
      Auth._hashPw(password).then(function(hashed) {
        if (hashed === user.password) {
          Auth._doLogin(user);
        } else {
          Auth._err('login-err', 'Incorrect password');
        }
      });
      return;
    }
    Auth._doLogin(user);
  },

  _doLogin: function(user) {
    Auth.currentUser = user;
    Utils.storage.set('ssp_session', { uid: user.id });
    try { if (typeof Activity !== 'undefined') Activity.startSession(user); } catch(e) {}
    App.showShell();
  },

  signup: function() {
    var biz   = Utils.val('s-biz');
    var name  = Utils.val('s-name');
    var uname = Utils.val('s-user');
    var pw    = Utils.val('s-pass');
    if (!biz)        { Auth._err('signup-err', 'Enter your business name'); return; }
    if (!name)       { Auth._err('signup-err', 'Enter your full name'); return; }
    if (!uname)      { Auth._err('signup-err', 'Choose a username'); return; }
    if (pw.length < 6) { Auth._err('signup-err', 'Password must be at least 6 characters'); return; }
    var users = DB.get('users') || [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === uname.toLowerCase()) {
        Auth._err('signup-err', 'Username already taken'); return;
      }
    }
    // First user becomes Primary Admin
    var assignedRole = users.length === 0 ? 'primary_admin' : 'sales_employee';
    var user = {
      id: Utils.uid('U'),
      username: uname,
      name: name,
      role: assignedRole,
      status: 'active',
      createdAt: Utils.today(),
      password: pw,
    };
    users.push(user);
    DB.set('users', users);
    DB.saveSettings({ bizName: biz, currency: '$' });
    Auth.currentUser = user;
    Utils.storage.set('ssp_session', { uid: user.id });
    try { if (typeof Activity !== 'undefined') Activity.startSession(user); } catch(e) {}
    App.showShell();
  },

  logout: function() {
    try { if (typeof Activity !== 'undefined') Activity.endSession(); } catch(e) {}
    Auth.currentUser = null;
    Utils.storage.del('ssp_session');
    location.reload();
  },

  showTab: function(tab) {
    var inF  = Utils.get('login-form');
    var upF  = Utils.get('signup-form');
    var tIn  = Utils.get('ltab-in');
    var tUp  = Utils.get('ltab-up');
    var eI   = Utils.get('login-err');
    var eS   = Utils.get('signup-err');
    if (eI) eI.classList.add('hidden');
    if (eS) eS.classList.add('hidden');
    if (tab === 'in') {
      if (inF) { inF.style.display = 'block'; inF.classList.remove('hidden'); }
      if (upF) { upF.style.display = 'none';  upF.classList.add('hidden');    }
      if (tIn) tIn.classList.add('active');
      if (tUp) tUp.classList.remove('active');
    } else {
      if (upF) { upF.style.display = 'block'; upF.classList.remove('hidden'); }
      if (inF) { inF.style.display = 'none';  inF.classList.add('hidden');    }
      if (tUp) tUp.classList.add('active');
      if (tIn) tIn.classList.remove('active');
    }
  },

  togglePw: function(id) {
    var el = Utils.get(id);
    if (el) el.type = (el.type === 'password') ? 'text' : 'password';
  },

  _err: function(id, msg) {
    var el = Utils.get(id);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); el.style.display = 'block'; }
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

  forgotPassword: function() {
    var uname = Utils.val('l-user') || '';
    if (!uname) {
      Modal.open({
        title: 'Reset Password', barColor: 'var(--wa)',
        body: '<div class="fg"><label class="fl">Enter your Username</label>'
            + '<input class="fi" id="fp-user" placeholder="Your username"></div>',
        footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
              + '<button class="btn-primary" style="flex:1" onclick="Auth.doReset()">Find Account</button>',
      });
      return;
    }
    Auth._showResetFor(uname);
  },

  _showResetFor: function(uname) {
    var users = DB.get('users') || [];
    var found = false;
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === uname.toLowerCase()) { found = true; break; }
    }
    if (!found) {
      Modal.open({
        title: 'Not Found',
        body: '<div style="text-align:center;padding:20px 10px">'
            + '<div style="font-size:44px;margin-bottom:12px">🔍</div>'
            + '<div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:8px">Username not found</div>'
            + '<div style="font-size:13px;color:var(--t2)">No account with that username exists.</div></div>',
        footer: '<button class="btn-primary btn-full" onclick="Modal.close()">OK</button>',
      });
      return;
    }
    Auth._resetUser = uname;
    Modal.open({
      title: 'Reset Password', sub: 'Account: ' + uname, barColor: 'var(--wa)',
      body: '<div class="fg"><label class="fl">New Password (min 6 chars)</label>'
          + '<input class="fi" id="fp-new" type="password" placeholder="Enter new password"></div>'
          + '<div class="fg"><label class="fl">Confirm Password</label>'
          + '<input class="fi" id="fp-conf" type="password" placeholder="Confirm new password"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Auth.saveReset()">Reset Password</button>',
    });
  },

  doReset: function() {
    var el = Utils.get('fp-user');
    if (!el) return;
    var uname = el.value.trim();
    if (!uname) { Toast.show('Enter your username', 'err'); return; }
    Modal.close();
    setTimeout(function() { Auth._showResetFor(uname); }, 250);
  },

  saveReset: function() {
    var newPw = Utils.val('fp-new');
    var conf  = Utils.val('fp-conf');
    if (!newPw || newPw.length < 6) { Toast.show('Min 6 characters', 'err'); return; }
    if (newPw !== conf) { Toast.show('Passwords do not match', 'err'); return; }
    var users = DB.get('users') || [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === Auth._resetUser.toLowerCase()) {
        users[i].password = newPw;
        DB.set('users', users);
        Modal.close();
        Toast.show('Password reset! Sign in with your new password.', 'ok');
        return;
      }
    }
    Toast.show('Account not found', 'err');
  },

  _resetUser: '',

  bootSync: function() {
    try {
      var sess = Utils.storage.get('ssp_session');
      if (sess && sess.uid) {
        var users = DB.get('users') || [];
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === sess.uid && users[i].status !== 'pending') {
            Auth.currentUser = users[i]; return true;
          }
        }
      }
    } catch(e) {}
    return false;
  },
};