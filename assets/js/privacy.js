/* === privacy.js ===
   Privacy lock for the dashboard's "today" figures ONLY:
   Today's Net Profit, Today Sales, Today Expenses, COGS and Allocated. Every other amount is always visible.
   - Hidden ($••••) whenever the app opens; the eye button on the Net Profit card toggles them.
   - Showing them needs a privacy PIN (made once per device), the device's fingerprint / face, or the account password.
   - They hide again after 10 minutes without use, or when the app is left for more than 30 seconds. */
var Privacy = {
  hidden: true,
  MASK: '••••',
  IDLE_MS: 10 * 60 * 1000,
  AWAY_MS: 30 * 1000,
  _lastActive: Date.now(),
  _awayAt: 0,

  masked: function() {
    return this.hidden && typeof Auth !== 'undefined' && !!Auth.currentUser;
  },

  init: function() {
    var self = this;
    // The lock covers only the dashboard's five "today" figures (see Dashboard.render → privMoney).
    // Hide again after inactivity or when the app is left
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function(ev) {
      document.addEventListener(ev, function() { self._lastActive = Date.now(); }, { passive: true });
    });
    setInterval(function() {
      if (!self.hidden && Date.now() - self._lastActive > self.IDLE_MS) self.hide(true);
    }, 30000);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') self._awayAt = Date.now();
      else if (self._awayAt && !self.hidden && Date.now() - self._awayAt > self.AWAY_MS) self.hide(true);
    });
    this._paintButton();
  },

  toggle: function() {
    if (this.hidden) this.openUnlock();
    else this.hide();
  },

  hide: function(auto) {
    this.hidden = true;
    this._refresh();
    if (!auto && typeof Toast !== 'undefined') Toast.show('Figures hidden', 'ok');
  },

  _reveal: function() {
    this.hidden = false;
    this._lastActive = Date.now();
    if (typeof Modal !== 'undefined') Modal.close();
    this._refresh();
    if (typeof Toast !== 'undefined') Toast.show('Figures shown — they hide again after 10 minutes', 'ok');
  },

  _refresh: function() {
    this._paintButton();
    try { if (typeof Router !== 'undefined') Router.refresh(); } catch (e) {}
  },

  _paintButton: function() {}, // the eye button is drawn by Dashboard.render

  // ── Unlock dialog ─────────────────────────────────────────────────────────
  _bioKey: function() {
    var u = (Auth.currentUser && Auth.currentUser.id) || 'user';
    return 'ssp_bio_' + location.hostname + '_' + u;
  },
  _bioId: function() { try { return localStorage.getItem(this._bioKey()) || ''; } catch (e) { return ''; } },
  _bioSupported: function() {
    if (!window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function() { return false; });
  },

  // ── Privacy PIN (4–6 digits, this device only; stored as a salted PBKDF2 hash) ──
  _pinKey: function() { return 'ssp_pin_' + location.hostname + '_' + ((Auth.currentUser && Auth.currentUser.id) || 'user'); },
  _pinRec: function() { try { return JSON.parse(localStorage.getItem(this._pinKey()) || 'null'); } catch (e) { return null; } },
  _hashPin: function(pin, saltB64, iter) {
    var self = this, enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
      .then(function(k) { return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: self._unb64(saltB64), iterations: iter }, k, 256); })
      .then(function(bits) { return self._b64(bits); });
  },
  _savePin: function(pin) {
    var self = this, salt = this._b64(this._rand(16)), iter = 150000;
    return this._hashPin(pin, salt, iter).then(function(h) {
      try { localStorage.setItem(self._pinKey(), JSON.stringify({ s: salt, h: h, i: iter })); } catch (e) {}
    });
  },
  _fails: 0, _lockUntil: 0,

  _field: function(id, label, placeholder, numeric) {
    // read-only until tapped + autocomplete off: the browser can't slip a saved password in
    return '<div class="fg"><label class="fl" for="' + id + '">' + label + '</label>'
      + '<div class="pw-wrap"><input class="fi" id="' + id + '" name="' + id + '-' + Date.now() + '" type="password"'
      + (numeric ? ' inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code"' : ' autocomplete="new-password"')
      + ' data-lpignore="true" data-1p-ignore readonly onfocus="this.removeAttribute(\'readonly\')" onpointerdown="this.removeAttribute(\'readonly\')" ontouchstart="this.removeAttribute(\'readonly\')"'
      + ' placeholder="' + placeholder + '" onkeydown="if(event.key===\'Enter\')Privacy.submit()">'
      + '<span class="pw-eye" onclick="Auth.togglePw(\'' + id + '\')">' + Icons.svg('eye', 18) + '</span></div></div>';
  },

  // mode: 'pin' (enter PIN), 'create' (first time: make a PIN), 'password' (account password)
  openUnlock: function(mode) {
    var self = this;
    this._bioSupported().then(function(ok) {
      var has = ok && !!self._bioId();
      var pinRec = self._pinRec();
      mode = mode || (pinRec ? 'pin' : 'create');
      self._mode = mode;
      var ico = function(n, s) { return Icons.svg(n, s); };
      var body = '<div class="pv-lock">' + ico('shield-lock', 30) + '</div>';
      if (mode === 'create') {
        body += '<p class="pv-text">Create a privacy PIN to show today\'s figures. You\'ll use it (or your fingerprint) every time. It works on this device only.</p>'
          + self._field('pv-pin', 'New PIN (4–6 digits)', '••••', true)
          + self._field('pv-pin2', 'Type the PIN again', '••••', true);
      } else {
        body += '<p class="pv-text">Today\'s profit, sales and costs are hidden so people near your screen can\'t see them.</p>';
        if (has) body += '<button class="btn-primary btn-full pv-bio" onclick="Privacy.unlockWithBiometric()">' + ico('fingerprint', 20) + '<span>Use fingerprint / face</span></button>'
          + '<div class="pv-or"><span>or</span></div>';
        body += mode === 'pin'
          ? self._field('pv-pin', 'Your privacy PIN', '••••', true)
          : self._field('pv-pass', 'Your SmartStock account password', 'Type your password', false);
      }
      if (ok && !has) body += '<label class="pv-check"><input type="checkbox" id="pv-enrol" checked> Use fingerprint / face to unlock next time</label>';
      body += '<div id="pv-err" class="form-err hidden"></div>';
      if (mode === 'pin') body += '<button class="pv-link" onclick="Privacy.openUnlock(\'password\')">Forgot your PIN? Use your account password</button>';
      if (mode === 'password' && pinRec) body += '<button class="pv-link" onclick="Privacy.openUnlock(\'pin\')">Use your PIN instead</button>';
      if (mode === 'password' && !pinRec) body += '<button class="pv-link" onclick="Privacy.openUnlock(\'create\')">Create a PIN instead</button>';
      Modal.open({
        title: 'Show figures', sub: mode === 'create' ? 'Set up your privacy PIN' : 'Confirm it\'s you', barColor: 'var(--g)',
        body: body,
        footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
          + '<button class="btn-primary" style="flex:1" id="pv-go" onclick="Privacy.submit()">' + ico('lock-open', 18) + (mode === 'create' ? ' Save PIN &amp; show' : ' Show figures') + '</button>',
      });
      setTimeout(function() {
        ['pv-pin', 'pv-pin2', 'pv-pass'].forEach(function(id) { var i = document.getElementById(id); if (i) i.value = ''; });
        var first = document.getElementById(mode === 'password' ? 'pv-pass' : 'pv-pin');
        if (first && !has) { first.removeAttribute('readonly'); first.focus(); }
      }, 150);
    });
  },

  submit: function() {
    if (this._mode === 'create') return this.createPin();
    if (this._mode === 'password') return this.unlockWithPassword();
    return this.unlockWithPin();
  },

  _err: function(msg) {
    var e = document.getElementById('pv-err');
    if (e) { e.textContent = msg; e.classList.remove('hidden'); }
  },

  // After a successful check: optionally set up fingerprint, then show
  _success: function(note) {
    var self = this;
    var enrol = (document.getElementById('pv-enrol') || {}).checked;
    if (enrol) {
      self.register().then(function() { self._reveal(); Toast.show('Fingerprint / face unlock set up ✓', 'ok'); },
                           function() { self._reveal(); if (note) Toast.show(note, 'ok'); });
    } else { self._reveal(); if (note) Toast.show(note, 'ok'); }
  },

  createPin: function() {
    var self = this;
    var a = (document.getElementById('pv-pin') || {}).value || '';
    var b = (document.getElementById('pv-pin2') || {}).value || '';
    if (!/^\d{4,6}$/.test(a)) { this._err('Use 4 to 6 digits for your PIN.'); return; }
    if (a !== b) { this._err('The two PINs don\'t match. Type them again.'); document.getElementById('pv-pin2').value = ''; return; }
    this._savePin(a).then(function() { self._success('Privacy PIN saved ✓'); },
                          function() { self._err('This browser can\'t save a PIN. Use your account password instead.'); });
  },

  unlockWithPin: function() {
    var self = this, rec = this._pinRec(), box = document.getElementById('pv-pin');
    var pin = (box || {}).value || '';
    if (Date.now() < this._lockUntil) { this._err('Too many wrong PINs. Wait a minute, or use your account password.'); return; }
    if (!rec) { this.openUnlock('create'); return; }
    if (!pin) { this._err('Enter your PIN.'); return; }
    this._hashPin(pin, rec.s, rec.i).then(function(h) {
      if (h === rec.h) { self._fails = 0; self._success(); return; }
      self._fails++;
      if (box) { box.value = ''; box.focus(); }
      if (self._fails >= 5) { self._lockUntil = Date.now() + 60000; self._fails = 0; self._err('Too many wrong PINs. Wait a minute, or use your account password.'); }
      else self._err('That PIN isn\'t right. Try again.');
    });
  },

  // Check the password against the real account (Supabase Auth). Success also clears a forgotten PIN.
  unlockWithPassword: function() {
    var self = this;
    var pw = (document.getElementById('pv-pass') || {}).value || '';
    var email = Auth.currentUser && Auth.currentUser.email;
    if (!pw) { this._err('Enter your password.'); return; }
    if (!email) { this._err('Sign in again to use this.'); return; }
    var btn = document.getElementById('pv-go'); if (btn) btn.disabled = true;
    fetch(SUPABASE_AUTH_URL + '/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: String(email).trim().toLowerCase(), password: pw }),
    }).then(function(r) {
      if (btn) btn.disabled = false;
      if (r.ok) {
        var hadPin = !!self._pinRec();
        try { localStorage.removeItem(self._pinKey()); } catch (e) {}
        self._success(hadPin ? 'PIN cleared — you\'ll create a new one next time' : null);
      } else if (r.status === 429) self._err('Too many tries. Wait a minute and try again.');
      else {
        self._err('Your account says this password isn\'t right. Use your PIN or fingerprint instead.');
        var box = document.getElementById('pv-pass'); if (box) { box.value = ''; box.focus(); }
      }
    }).catch(function() {
      if (btn) btn.disabled = false;
      self._err('No internet connection — use your PIN or fingerprint instead.');
    });
  },

  // ── Fingerprint / face (WebAuthn platform authenticator) ─────────────────
  _rand: function(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; },
  _b64: function(buf) {
    var s = '', b = new Uint8Array(buf);
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  _unb64: function(str) {
    var s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  },

  register: function() {
    var self = this, u = Auth.currentUser || {};
    return navigator.credentials.create({ publicKey: {
      challenge: this._rand(32),
      rp: { name: 'SmartStock Pro', id: location.hostname },
      user: { id: new TextEncoder().encode(String(u.id || 'user')).slice(0, 64), name: u.email || 'user', displayName: u.name || u.email || 'SmartStock user' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none',
    }}).then(function(cred) {
      try { localStorage.setItem(self._bioKey(), self._b64(cred.rawId)); } catch (e) {}
      return cred;
    });
  },

  unlockWithBiometric: function() {
    var self = this, id = this._bioId();
    if (!id) { this._err('Fingerprint / face isn\'t set up on this device yet. Use your password.'); return; }
    navigator.credentials.get({ publicKey: {
      challenge: this._rand(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: this._unb64(id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    }}).then(function(a) {
      // Byte 32 of authenticatorData holds the flags; 0x04 = the user was verified (fingerprint/face/PIN)
      var flags = new Uint8Array(a.response.authenticatorData)[32];
      if (flags & 0x04) self._reveal();
      else self._err('Your device didn\'t confirm it\'s you. Use your password.');
    }).catch(function(e) {
      if (e && e.name === 'NotAllowedError') self._err('Cancelled or not recognised. Try again or use your password.');
      else { try { localStorage.removeItem(self._bioKey()); } catch (x) {} self._err('Fingerprint / face isn\'t available. Use your password — you can set it up again.'); }
    });
  },
};
Privacy.init();
