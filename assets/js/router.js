/* === router.js === */
var PAGES = ['dashboard','products','sales','customers','suppliers','supply','expenses','salary','finance','reports','quotations','ai','settings','more','usermgmt','closing','superadmin','support','stock','billing'];
var BN_PAGES = ['dashboard','sales','products','customers','more'];

var Router = {
  current: 'dashboard',

  go: function(page){
    if (!PAGES.includes(page)) page = 'dashboard';
    this.current = page;
    // Hide all pages
    PAGES.forEach(function(p){
      var el = Utils.get('pg-' + p);
      if (el) el.classList.remove('active');
    });
    // Show target
    var target = Utils.get('pg-' + page);
    if (target) target.classList.add('active');
    // Update bottom nav
    BN_PAGES.forEach(function(p){
      var btn = Utils.get('bn-' + p);
      if (btn) btn.classList.toggle('active', p === page || (p==='more' && !BN_PAGES.includes(page)));
    });
    // Desktop side menu highlight
    if (typeof Sidebar !== 'undefined') Sidebar.setActive(page);
    // Close sidebar
    UI.closeSidebar();
    // Scroll to top
    var pc = Utils.get('pages-container');
    if (pc) pc.scrollTop = 0;
    this._render(page);
  },

  // Re-draw the current page in place (no scroll reset) — used after cloud sync
  refresh: function(){
    var el = Utils.get('app-shell');
    if (!el || el.style.display === 'none' || el.classList.contains('hidden')) return;
    this._render(this.current);
  },

  _render: function(page){
    var renders = {
      dashboard: () => Dashboard.render(),
      products:  () => Products.render(),
      sales:     () => Sales.render(),
      customers: () => Customers.render(),
      suppliers:  () => Suppliers.render(),
      supply:     () => Supply.render(),
      quotations: () => Quotations.render(),
      expenses:  () => Expenses.render(),
      salary:    () => Salary.render(),
      finance:   () => Finance.render(),
      reports:   () => Reports.render(),
      ai:        () => AI.render(),
      usermgmt:  () => UserMgmt.render(),
      closing:   () => ClosingReport.render(),
      superadmin: () => SuperAdmin._loadAndRender(),
      support:    () => Support.render(),
      stock:      () => Stock.render(),
      billing:    () => Billing.render(),
      settings:  () => Settings.render(),
      more:      () => MorePage.render(),
    };
    try {
      if (renders[page]) renders[page]();
    } catch(e) {
      var el = Utils.get('pg-' + page);
      if (el) el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Error loading page</div><div class="empty-sub">' + (e.message) + '</div></div>';
    }
  },
};

/* ── Phone / browser Back button ─────────────────────────────────────────────
   Without this, Back on Android leaves the app (it closes and reloads on the
   next open). Now Back steps back inside the app, one thing at a time:
     1. closes an open window (print preview, form/popup, notifications)
     2. on a page opened from More → goes back to More
     3. on any other page → goes to the Dashboard
     4. on the Dashboard → "Press back again to exit"; a second Back within 2s exits
   How: the app keeps one extra history entry. Back uses it up (popstate), we do
   the step above, then put the entry back.                                     */
var BackNav = {
  _armedExit: 0,
  _leaving: false,

  init: function() {
    if (!window.history || !history.pushState) return;
    try {
      history.replaceState({ ssp: 'base' }, '');
      history.pushState({ ssp: 'trap' }, '');
    } catch (e) { return; }
    window.addEventListener('popstate', function() { BackNav._onBack(); });
  },

  _rearm: function() {
    try { history.pushState({ ssp: 'trap' }, ''); } catch (e) {}
  },

  _visible: function(el) {
    return !!el && !el.classList.contains('hidden') && el.style.display !== 'none';
  },

  // 1. Close the top-most open window, if any. Returns true if something closed.
  _closeOverlay: function() {
    // Print / photo preview (full-screen iframe from Sales._printHtml)
    var prints = document.querySelectorAll('[id$="-frame-overlay"]');
    if (prints.length) {
      Array.prototype.forEach.call(prints, function(o) {
        var btn = document.getElementById(o.id.replace(/-overlay$/, '-close'));
        if (btn) btn.remove();
        o.remove();
      });
      return true;
    }
    var mo = document.getElementById('modal-overlay');
    if (this._visible(mo) && mo.innerHTML.trim()) { Modal.close(); return true; }
    var np = document.getElementById('notif-panel');
    if (this._visible(np) && typeof Notifs !== 'undefined') { Notifs.close(); return true; }
    return false;
  },

  _onBack: function() {
    if (this._leaving) return;

    if (this._closeOverlay()) { this._rearm(); return; }

    var shell = document.getElementById('app-shell');
    var inApp = shell && shell.style.display !== 'none' && !shell.classList.contains('hidden');
    var cur = Router.current;

    if (inApp && cur !== 'dashboard') {
      var fromMore = BN_PAGES.indexOf(cur) < 0 && cur !== 'more';
      Router.go(fromMore ? 'more' : 'dashboard');
      this._armedExit = 0;
      this._rearm();
      return;
    }

    // On the Dashboard (or the sign-in screen): press twice to leave
    var now = Date.now();
    if (now - this._armedExit < 2000) {
      this._leaving = true;
      history.back();          // leave the app for real
      return;
    }
    this._armedExit = now;
    if (typeof Toast !== 'undefined') Toast.show('Press back again to exit', 'info', 2000);
    this._rearm();
  },
};
BackNav.init();
