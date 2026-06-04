var UI = {
  toggleSidebar() {
    const sb = Utils.get('sidebar');
    const ov = Utils.get('sidebar-overlay');
    if (!sb) return;
    const isOpen = sb.classList.contains('open');
    if (isOpen) { sb.classList.remove('open'); ov && ov.classList.add('hidden'); }
    else { sb.classList.add('open'); ov && ov.classList.remove('hidden'); }
  },
  closeSidebar() {
    const sb = Utils.get('sidebar');
    const ov = Utils.get('sidebar-overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.add('hidden');
  },
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
      ['tb-avatar','sb-avatar'].forEach(id => { const e=Utils.get(id); if(e) e.textContent=av; });
      Utils.set('sb-username', Utils.esc(user.name || user.username));
      Utils.set('sb-role', Utils.esc(user.role || 'Owner'));
      Utils.set('sb-biz-name', Utils.esc(s.bizName || 'SmartStock Pro'));
    }
    Notifs.check();
    Router.go('dashboard');
  },
};
