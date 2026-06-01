const App = {
  page: 'home',

  sidebarItems: [
    {section:'Business'},
    {page:'home',     icon:'🏠', label:'Dashboard',   sub:'Overview & KPIs'},
    {page:'inventory',icon:'📦', label:'Inventory',    sub:'Products & stock'},
    {page:'sales',    icon:'🧾', label:'Sales & POS',  sub:'Invoices & payments'},
    {page:'customers',icon:'👥', label:'Customers',    sub:'Client management'},
    {section:'Finance'},
    {page:'reports',  icon:'📊', label:'Reports',      sub:'P&L, cash flow'},
    {page:'expenses', icon:'💸', label:'Expenses',     sub:'Cost tracking',  action:'openExpenses'},
    {page:'payroll',  icon:'💰', label:'Payroll',      sub:'Staff salaries', action:'openPayroll'},
    {section:'Intelligence'},
    {page:'ai',       icon:'🤖', label:'AI Assistant', sub:'Business insights'},
    {section:'System'},
    {page:'settings', icon:'⚙️', label:'Settings',     sub:'App configuration'},
  ],

  init() {
    this.loadTheme();
    this.buildSidebar();
    this.nav('home');
    setTimeout(() => {
      const loader = document.getElementById('ss-loader');
      if (loader) loader.classList.add('hidden');
    }, 900);
    document.getElementById('ef-date').value = Utils.today();
    document.getElementById('sf-date').value = Utils.today();
  },

  loadTheme() {
    const t = Utils.storage.get('ssp_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  },

  toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Utils.storage.set('ssp_theme', next);
  },

  nav(page) {
    this.page = page;
    Utils.$$('.pg').forEach(el => el.classList.remove('on'));
    Utils.$$('.bn').forEach(el => el.classList.remove('on'));
    const pg = document.getElementById('pg-' + page);
    const bn = document.getElementById('bn-' + page);
    if (pg) pg.classList.add('on');
    if (bn) bn.classList.add('on');
    // Render page
    const renderers = { home:HomePage, inventory:Inventory, sales:Sales, customers:Customers, reports:Reports, ai:AIPage, more:MorePage };
    if (renderers[page]) renderers[page].render();
    document.getElementById('pc').scrollTop = 0;
    this.closeSidebar();
  },

  goHome() { this.nav('home'); },

  openNotifs() { Toast.show('No new notifications','ok'); },

  openSidebar() {
    document.getElementById('sidebar-menu').classList.add('on');
    document.getElementById('sb-overlay').classList.add('on');
    document.getElementById('menu-btn').classList.add('open');
  },

  closeSidebar() {
    document.getElementById('sidebar-menu').classList.remove('on');
    document.getElementById('sb-overlay').classList.remove('on');
    document.getElementById('menu-btn').classList.remove('open');
  },

  buildSidebar() {
    let html = '';
    this.sidebarItems.forEach(item => {
      if (item.section) {
        html += `<div class="sb-sec-lbl">${item.section}</div>`;
      } else {
        const action = item.action ? `${item.action}()` : `App.nav('${item.page}')`;
        html += `<div class="sb-item" onclick="${action}">
          <div class="sb-icon" style="background:var(--gd)">${item.icon}</div>
          <div class="sb-text">
            <div class="sb-t">${item.label}</div>
            <div class="sb-s">${item.sub}</div>
          </div>
          <div class="sb-arrow">›</div>
        </div>`;
      }
    });
    Utils.set('sb-body', html);
  },

  confirm(title, msg, icon, onConfirm) {
    Utils.set('conf-title', title);
    Utils.set('conf-msg', msg);
    Utils.set('conf-icon', icon || '⚠️');
    const btn = document.getElementById('conf-btn');
    btn.onclick = () => { closeD('d-confirm'); onConfirm(); };
    openD('d-confirm');
  },
};

function openExpenses() { App.closeSidebar(); openD('d-expense'); }
function openPayroll()  { App.closeSidebar(); Toast.show('Payroll module coming soon','wa'); }