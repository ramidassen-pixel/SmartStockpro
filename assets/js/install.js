/* === install.js ===
   Recommends installing SmartStock Pro as an app:
   - Laptop/desktop browser → "Get the desktop app" (own window, Start menu/Dock icon)
   - Phone browser          → "Get the mobile app"  (home-screen icon, full screen)
   Uses the browser's real install prompt where available (Chrome, Edge, Android),
   and shows step-by-step instructions where it isn't (iPhone/iPad Safari, Mac Safari, Firefox).
   Never shows inside the installed app. "Not now" hides it for 7 days. */
var Install = {
  _deferred: null,
  SNOOZE_KEY: 'ssp_install_snooze',
  SNOOZE_DAYS: 7,

  isInstalled: function() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || (window.matchMedia && window.matchMedia('(display-mode: window-controls-overlay)').matches)
        || window.navigator.standalone === true;
  },

  device: function() {
    var ua = navigator.userAgent || '';
    var iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    var ios = /iPhone|iPad|iPod/.test(ua) || iPadOS;
    var android = /Android/.test(ua);
    var mobile = ios || android || /Mobile|Opera Mini|IEMobile/.test(ua);
    return {
      mobile: mobile, ios: ios, android: android,
      safari: /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Edg\//.test(ua),
      firefox: /Firefox|FxiOS/.test(ua),
      mac: /Macintosh/.test(ua) && !iPadOS,
    };
  },

  _snoozed: function() {
    try { var t = parseInt(localStorage.getItem(this.SNOOZE_KEY), 10); return t && Date.now() < t; } catch (e) { return false; }
  },
  _snooze: function() {
    try { localStorage.setItem(this.SNOOZE_KEY, String(Date.now() + this.SNOOZE_DAYS * 864e5)); } catch (e) {}
  },

  init: function() {
    var self = this;
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();          // we show our own banner instead of the browser mini-bar
      self._deferred = e;
      self._maybeShow();
    });
    window.addEventListener('appinstalled', function() {
      self._deferred = null;
      self.hide();
      try { Toast.show('SmartStock Pro installed ✓ Open it from your ' + (self.device().mobile ? 'home screen' : 'desktop or Start menu'), 'ok'); } catch (e) {}
    });
    // Browsers with no install prompt (iPhone Safari, Mac Safari, Firefox): show instructions banner
    setTimeout(function() { self._maybeShow(); }, 4000);
  },

  _maybeShow: function() {
    if (this.isInstalled() || this._snoozed() || document.getElementById('install-banner')) return;
    var d = this.device();
    // On Chrome/Edge/Android wait for the real prompt; elsewhere we can only give instructions
    var promptBrowser = !d.ios && !d.firefox && !(d.mac && d.safari);
    if (promptBrowser && !this._deferred) return;
    this._showBanner(d);
  },

  _showBanner: function(d) {
    var el = document.createElement('div');
    el.id = 'install-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', d.mobile ? 'Get the mobile app' : 'Get the desktop app');
    var title = d.mobile ? '📱 Get the SmartStock Pro mobile app' : '💻 Get the SmartStock Pro desktop app';
    var sub = d.mobile
      ? 'Opens full screen from your home screen, loads faster and works offline.'
      : 'Opens in its own window from your desktop or Start menu, loads faster and works offline.';
    el.innerHTML =
        '<div class="ib-icon"><img src="pwa/icon-192.png" alt=""></div>'
      + '<div class="ib-text"><div class="ib-title">' + title + '</div><div class="ib-sub">' + sub + '</div></div>'
      + '<div class="ib-actions">'
      + '<button type="button" class="ib-later">Not now</button>'
      + '<button type="button" class="ib-go">' + (this._deferred ? 'Install' : 'How to install') + '</button>'
      + '</div>';
    el.className = d.mobile ? 'ib-mobile' : 'ib-desktop';
    document.body.appendChild(el);
    var self = this;
    el.querySelector('.ib-later').onclick = function() { self._snooze(); self.hide(); };
    el.querySelector('.ib-go').onclick = function() { self.install(); };
    requestAnimationFrame(function() { el.classList.add('ib-show'); });
  },

  hide: function() {
    var el = document.getElementById('install-banner');
    if (el) el.parentNode.removeChild(el);
  },

  // Also callable from a menu: Install.install()
  install: function() {
    var self = this;
    if (this.isInstalled()) { try { Toast.show('You are already using the installed app ✓', 'ok'); } catch (e) {} return; }
    if (this._deferred) {
      var ev = this._deferred;
      this._deferred = null;
      ev.prompt();
      ev.userChoice.then(function(choice) {
        if (choice && choice.outcome === 'accepted') self.hide();
      }).catch(function() {});
      return;
    }
    this.showInstructions();
  },

  showInstructions: function() {
    var d = this.device(), steps, title;
    if (d.ios) {
      title = 'Install on iPhone / iPad';
      steps = ['Open this page in <b>Safari</b>.',
               'Tap the <b>Share</b> button <span class="ib-key">⬆︎</span> at the bottom (or top) of the screen.',
               'Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.',
               'Open <b>SmartStock</b> from your home screen.'];
    } else if (d.android) {
      title = 'Install on Android';
      steps = ['Open this page in <b>Chrome</b>.',
               'Tap the <b>⋮</b> menu at the top right.',
               'Tap <b>Install app</b> (or <b>Add to Home screen</b>), then <b>Install</b>.',
               'Open <b>SmartStock</b> from your home screen.'];
    } else if (d.mac && d.safari) {
      title = 'Install on Mac';
      steps = ['In Safari, open the <b>File</b> menu (or the Share button).',
               'Choose <b>Add to Dock</b>, then <b>Add</b>.',
               'Open <b>SmartStock</b> from your Dock or Applications.'];
    } else if (d.firefox) {
      title = 'Install the desktop app';
      steps = ['Firefox can\'t install web apps.',
               'Open this page in <b>Google Chrome</b> or <b>Microsoft Edge</b>.',
               'Click the <b>install icon</b> <span class="ib-key">⊕</span> at the right end of the address bar, then <b>Install</b>.'];
    } else {
      title = 'Install the desktop app';
      steps = ['Click the <b>install icon</b> <span class="ib-key">⊕</span> at the right end of the address bar.',
               'Or open the browser menu <b>⋮</b> → <b>Install SmartStock Pro</b> (Edge: <b>Apps → Install this site as an app</b>).',
               'Open <b>SmartStock Pro</b> from your desktop or Start menu.'];
    }
    var body = '<ol class="ib-steps">' + steps.map(function(s){ return '<li>' + s + '</li>'; }).join('') + '</ol>';
    if (typeof Modal !== 'undefined' && document.getElementById('modal-overlay')) {
      Modal.open({ title: title, barColor: 'var(--g)', body: body,
        footer: '<button class="btn-primary" style="flex:1" onclick="Modal.close()">Got it</button>' });
    } else {
      alert(title + '\n\n' + steps.map(function(s, i){ return (i + 1) + '. ' + s.replace(/<[^>]+>/g, ''); }).join('\n'));
    }
  },
};
Install.init();
