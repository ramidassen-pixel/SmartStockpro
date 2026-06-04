var PAGES = ['dashboard','products','sales','customers','suppliers','expenses','salary','finance','reports','ai','settings','more'];
var BN_PAGES = ['dashboard','sales','products','customers','more'];

var Router = {
  current: 'dashboard',

  go(page) {
    if (!PAGES.includes(page)) page = 'dashboard';
    this.current = page;
    // Hide all pages
    PAGES.forEach(p => {
      const el = Utils.get('pg-' + p);
      if (el) el.classList.remove('active');
    });
    // Show target
    const target = Utils.get('pg-' + page);
    if (target) target.classList.add('active');
    // Update bottom nav
    BN_PAGES.forEach(p => {
      const btn = Utils.get('bn-' + p);
      if (btn) btn.classList.toggle('active', p === page || (p==='more' && !BN_PAGES.includes(page)));
    });
    // Close sidebar
    UI.closeSidebar();
    // Scroll to top
    const pc = Utils.get('pages-container');
    if (pc) pc.scrollTop = 0;
    // Render page
    const renders = {
      dashboard: () => Dashboard.render(),
      products:  () => Products.render(),
      sales:     () => Sales.render(),
      customers: () => Customers.render(),
      suppliers: () => Suppliers.render(),
      expenses:  () => Expenses.render(),
      salary:    () => Salary.render(),
      finance:   () => Finance.render(),
      reports:   () => Reports.render(),
      ai:        () => AI.render(),
      settings:  () => Settings.render(),
      more:      () => MorePage.render(),
    };
    try {
      if (renders[page]) renders[page]();
    } catch(e) {
      const el = Utils.get('pg-' + page);
      if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Error loading page</div><div class="empty-sub">${e.message}</div></div>`;
    }
  },
};
