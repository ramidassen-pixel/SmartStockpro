var UI = {
  toggleNotifPanel: function() {
    var p = Utils.get('notif-panel');
    if (!p) return;
    if (p.classList.contains('hidden')) { Notifs.check(); p.classList.remove('hidden'); }
    else p.classList.add('hidden');
  },
  applyTheme: function(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
    var mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.content = theme === 'light' ? '#f2f3f8' : '#070A12';
  },
  closeSidebar: function() {},
};

var App = {
  _hide: function(id) {
    var el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.classList.add('hidden'); }
  },
  _show: function(id, disp) {
    var el = document.getElementById(id);
    if (el) { el.style.display = disp || 'block'; el.classList.remove('hidden'); }
  },

  showLogin: function() {
    App._hide('loader');
    App._hide('app-shell');
    App._show('login-screen', 'flex');
    try { UI.applyTheme(DB.getSettings().theme || 'dark'); } catch(e) {}
  },

  showShell: function() {
    App._hide('loader');
    App._hide('login-screen');
    App._show('app-shell', 'flex');
    try {
      var user = Auth.currentUser || {};
      var s    = DB.getSettings();
      UI.applyTheme(s.theme || 'dark');
      var bn = document.getElementById('tb-biz-name');
      if (bn) bn.textContent = s.bizName || 'SmartStock Pro';
      var bs = document.getElementById('tb-biz-sub');
      if (bs) bs.textContent = s.bizPhone || s.bizAddress || 'Business Manager';
      var av = document.getElementById('tb-avatar');
      if (av && user.name) av.textContent = user.name[0].toUpperCase();
      if (s.bizLogo && typeof Settings !== 'undefined') Settings._applyBizLogo(s.bizLogo);
      if (user.photo && typeof Settings !== 'undefined') Settings._applyUserPhoto(user.photo, user);
      try { Notifs.check(); } catch(e2) {}
      Router.go('dashboard');
    } catch(e) { console.error('showShell:', e); Router.go('dashboard'); }
  },

  boot: function() {
    try { DB.load(); } catch(e) { console.error('DB:', e); }
    var loggedIn = false;
    try {
      var sess = Utils.storage.get('ssp_session');
      if (sess && sess.uid) {
        var users = DB.get('users') || [];
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === sess.uid && users[i].status !== 'pending') {
            Auth.currentUser = users[i]; loggedIn = true; break;
          }
        }
      }
    } catch(e) { console.error('session:', e); }
    if (loggedIn) App.showShell();
    else App.showLogin();
  },
};