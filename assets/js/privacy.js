/* === privacy.js ===
   Privacy lock for the dashboard's "today" figures ONLY:
   Today's Net Profit, Today Sales, Today Expenses, COGS and Allocated. Every other amount is always visible.
   - Hidden ($••••) whenever the app opens; the eye button on the Net Profit card toggles them.
   - Showing them needs the device's fingerprint / Face ID / Windows Hello, or the account password.
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

  openUnlock: function() {
    var self = this;
    this._bioSupported().then(function(ok) {
      var has = ok && !!self._bioId();
      var ico = function(n, s) { return Icons.svg(n, s); };
      Modal.open({
        title: 'Show figures', sub: 'Confirm it\'s you', barColor: 'var(--g)',
        body: '<div class="pv-lock">' + ico('shield-lock', 30) + '</div>'
          + '<p class="pv-text">Sales totals, profit and other amounts are hidden so people near your screen can\'t see them.</p>'
          + (has ? '<button class="btn-primary btn-full pv-bio" onclick="Privacy.unlockWithBiometric()">' + ico('fingerprint', 20) + '<span>Use fingerprint / face</span></button>'
                   + '<div class="pv-or"><span>or use your password</span></div>' : '')
          + '<div class="fg"><label class="fl" for="pv-pass">Your SmartStock password</label>'
          // readonly-until-focus + new-password stop the browser auto-filling a saved password here:
          // it's hidden behind dots, so anything typed was being added to the saved one
          + '<div class="pw-wrap"><input class="fi" id="pv-pass" name="pv-check-' + Date.now() + '" type="password" autocomplete="new-password" data-lpignore="true" data-1p-ignore readonly onfocus="this.removeAttribute(\'readonly\')" onpointerdown="this.removeAttribute(\'readonly\')" ontouchstart="this.removeAttribute(\'readonly\')" placeholder="Type your password" onkeydown="if(event.key===\'Enter\')Privacy.unlockWithPassword()">'
          + '<span class="pw-eye" onclick="Auth.togglePw(\'pv-pass\')">' + ico('eye', 18) + '</span></div></div>'
          + (ok && !has ? '<label class="pv-check"><input type="checkbox" id="pv-enrol" checked> Use fingerprint / face to unlock next time</label>' : '')
          + '<div id="pv-err" class="form-err hidden"></div>',
        footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
          + '<button class="btn-primary" style="flex:1" id="pv-go" onclick="Privacy.unlockWithPassword()">' + ico('lock-open', 18) + ' Show figures</button>',
      });
      // Start empty even if the browser filled something in, then focus
      setTimeout(function() { var i = document.getElementById('pv-pass'); if (i) { i.value = ''; if (!has) i.focus(); } }, 150);
    });
  },

  _err: function(msg) {
    var e = document.getElementById('pv-err');
    if (e) { e.textContent = msg; e.classList.remove('hidden'); }
  },

  // Check the password against the real account (Supabase Auth)
  unlockWithPassword: function() {
    var self = this;
    var pw = (document.getElementById('pv-pass') || {}).value || '';
    var email = Auth.currentUser && Auth.currentUser.email;
    if (!pw) { this._err('Enter your password.'); return; }
    if (!email) { this._err('Sign in again to use this.'); return; }
    var btn = document.getElementById('pv-go'); if (btn) btn.disabled = true;
    var enrol = (document.getElementById('pv-enrol') || {}).checked;
    fetch(SUPABASE_AUTH_URL + '/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: email, password: pw }),
    }).then(function(r) {
      if (btn) btn.disabled = false;
      if (r.ok) {
        if (enrol) {
          // Ask for the fingerprint now while the user is here; reveal either way
          self.register().then(function() { self._reveal(); Toast.show('Fingerprint / face unlock set up ✓', 'ok'); },
                               function() { self._reveal(); });
        } else self._reveal();
      } else if (r.status === 429) self._err('Too many tries. Wait a minute and try again.');
      else {
        self._err('That password isn\'t right. The box has been cleared — type it again (tap the eye to see what you type).');
        var box = document.getElementById('pv-pass'); if (box) { box.value = ''; box.focus(); }
      }
    }).catch(function() {
      if (btn) btn.disabled = false;
      self._err(self._bioId() ? 'No internet — use your fingerprint / face instead.' : 'No internet connection. Try again when you\'re online.');
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
