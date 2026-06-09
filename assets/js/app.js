var UI = {
  toggleNotifPanel() {
    const p = Utils.get('notif-panel');
    if (!p) return;
    const hidden = p.classList.contains('hidden');
    if (hidden) { Notifs.check(); p.classList.remove('hidden'); }
    else p.classList.add('hidden');
  },
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
    const mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.content = theme === 'light' ? '#f5f5f5' : '#0a0a0a';
  },
  closeSidebar() {},  // kept for compatibility, sidebar removed
};

var App = {
  async boot() {
    DB.load();
    const loggedIn = await Auth.boot();
    setTimeout(() => {
      const loader = Utils.get('loader');
      if (loader) loader.classList.add('hidden');
      if (loggedIn) this.showShell();
      else this.showLogin();
    }, 800);
  },

  showLogin() {
    Utils.hide('loader');
    Utils.hide('app-shell');
    Utils.show('login-screen');
    const s = DB.getSettings();
    UI.applyTheme(s.theme || 'dark');
  },

  showShell() {
    // Restore business logo and user photo on every boot
    setTimeout(function() {
      var _s  = DB.getSettings();
      var _u  = Auth.currentUser;
      if (typeof Settings !== 'undefined') {
        if (_s.bizLogo) Settings._applyBizLogo(_s.bizLogo);
        if (_u && _u.photo) Settings._applyUserPhoto(_u.photo, _u);
        else if (_u) {
          var _av = Utils.get('tb-avatar');
          if (_av) {
            var _in = _u.name ? _u.name[0].toUpperCase() : (_u.username ? _u.username[0].toUpperCase() : 'U');
            _av.innerHTML = _in;
          }
        }
        // Update topbar sub text
        var _sub = Utils.get('tb-biz-sub');
        if (_sub && (_s.bizPhone||_s.bizAddress)) _sub.textContent = _s.bizPhone||_s.bizAddress;
      }
    }, 100);
    Utils.hide('loader');
    Utils.hide('login-screen');
    Utils.show('app-shell');
    Utils.get('app-shell').classList.remove('hidden');
    const user = Auth.currentUser;
    const s = DB.getSettings();
    UI.applyTheme(s.theme || 'dark');
    // Update topbar/sidebar
    if (user) {
      const av = user.name ? user.name[0].toUpperCase() : 'U';
      Utils.set('tb-biz-name', Utils.esc(s.bizName || 'SmartStock Pro'));
    const subEl = document.querySelector('.tb-sub');
    if (subEl) subEl.textContent = user.role ? user.role.charAt(0).toUpperCase()+user.role.slice(1) : 'Business Manager';
      const tav=Utils.get('tb-avatar'); if(tav) tav.textContent=av;
    }
    Notifs.check();
    Router.go('dashboard');
  },
};
