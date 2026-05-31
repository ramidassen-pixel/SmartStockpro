/* SmartStock Pro — Client-side Router */
const Router = {
  current: 'dashboard',
  routes: {
    dashboard: () => Dashboard.render(),
    inventory: () => Inventory.render(),
    sales:     () => Sales.render(),
    customers: () => Customers.render(),
    suppliers: () => Suppliers.render(),
    expenses:  () => Expenses.render(),
    payroll:   () => Payroll.render(),
    reports:   () => Reports.render(),
    analytics: () => Analytics.render(),
    ai:        () => AIPage.render(),
    settings:  () => Settings.render(),
  },

  navigate(page) {
    if (!this.routes[page]) return;
    this.current = page;
    // Update nav active state
    Utils.$$('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // Update topbar title
    const nav = App.navItems.find(n => n.key === page);
    const titleEl = Utils.$('.topbar-title');
    if (titleEl && nav) titleEl.textContent = nav.label;
    // Render page
    const content = Utils.$('#page-content');
    if (content) {
      content.innerHTML = '';
      content.className = 'page-content animate-in';
      this.routes[page]();
    }
    // Close mobile sidebar
    App.closeMobileSidebar();
    // Update URL hash
    window.location.hash = page;
  },

  init() {
    const hash = window.location.hash.replace('#','');
    this.navigate(this.routes[hash] ? hash : 'dashboard');
    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#','');
      if (this.routes[h] && h !== this.current) this.navigate(h);
    });
  },
};
