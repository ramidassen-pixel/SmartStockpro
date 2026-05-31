/* SmartStock Pro — App Shell */
const App = {
  sidebarOpen: window.innerWidth > 900,

  navItems: [
    {key:'dashboard', label:'Dashboard',    icon:'grid',     badge:null},
    {key:'inventory', label:'Inventory',    icon:'box',      badge:3},
    {key:'sales',     label:'Sales & POS',  icon:'file-text',badge:null},
    {key:'customers', label:'Customers',    icon:'users',    badge:null},
    {key:'suppliers', label:'Suppliers',    icon:'truck',    badge:null},
    {key:'expenses',  label:'Expenses',     icon:'clock',    badge:null},
    {key:'payroll',   label:'Payroll',      icon:'credit-card',badge:2},
    {key:'reports',   label:'Reports',      icon:'bar-chart',badge:null},
    {key:'analytics', label:'Analytics',    icon:'trending-up',badge:null},
    {key:'ai',        label:'AI Assistant', icon:'cpu',      badge:'NEW'},
    {key:'settings',  label:'Settings',     icon:'settings', badge:null},
  ],

  navSections: [
    {label:'Main',       keys:['dashboard','inventory','sales','customers','suppliers']},
    {label:'Finance',    keys:['expenses','payroll','reports']},
    {label:'Intelligence',keys:['analytics','ai','settings']},
  ],

  init() {
    this.renderShell();
    Router.init();
    Notifications.init();
  },

  renderShell() {
    const navHTML = this.navSections.map(sec => {
      const items = sec.keys.map(k => {
        const n = this.navItems.find(i => i.key === k);
        const badge = n.badge
          ? `<span class="nav-badge${typeof n.badge==='string'?' gold':''}">${n.badge}</span>`
          : '';
        return `<div class="nav-item" data-page="${n.key}" onclick="Router.navigate('${n.key}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="flex-shrink:0;opacity:0.8"></svg>
          ${n.label}${badge}</div>`;
      }).join('');
      return `<div class="nav-section"><div class="nav-label">${sec.label}</div>${items}</div>`;
    }).join('');

    document.getElementById('app').innerHTML = `
      <!-- SIDEBAR -->
      <nav class="sidebar${this.sidebarOpen?'':' collapsed'}" id="sidebar">
        <div class="sidebar-logo">
          <div class="logo-icon">📦</div>
          <div><div class="logo-text">SmartStock</div><div class="logo-sub">Pro Edition</div></div>
        </div>
        <div class="sidebar-nav">${navHTML}</div>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="avatar">A</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">Admin User</div>
              <div class="sidebar-user-role">Administrator</div>
            </div>
            <div class="online-dot"></div>
          </div>
        </div>
      </nav>

      <!-- MAIN -->
      <div class="main-area${this.sidebarOpen?'':' full-width'}" id="main-area">
        <!-- TOPBAR -->
        <header class="topbar">
          <div class="topbar-toggle" onclick="App.toggleSidebar()">${Components.icon('menu',18)}</div>
          <span class="topbar-title font-display">Dashboard</span>
          <div class="topbar-search">
            ${Components.icon('search',14,'var(--color-text-dim)')}
            <input placeholder="Quick search..." oninput="App.search(this.value)"/>
          </div>
          <div class="topbar-actions">
            <div class="topbar-btn" id="notif-btn" onclick="Notifications.toggleDropdown()">
              ${Components.icon('bell',16)}
              <div class="notif-dot" id="notif-dot"></div>
            </div>
            <div class="avatar" onclick="Router.navigate('settings')">A</div>
          </div>
        </header>

        <!-- PAGE -->
        <main id="page-content" class="page-content"></main>
      </div>

      <!-- Mobile overlay -->
      <div class="overlay" id="sidebar-overlay" style="display:none" onclick="App.closeMobileSidebar()"></div>

      <!-- Toast container -->
      <div class="toast-container" id="toast-container"></div>
    `;
  },

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    const sidebar   = document.getElementById('sidebar');
    const main      = document.getElementById('main-area');
    const overlay   = document.getElementById('sidebar-overlay');
    if (window.innerWidth <= 900) {
      sidebar.classList.toggle('mobile-open', this.sidebarOpen);
      overlay.style.display = this.sidebarOpen ? 'block' : 'none';
    } else {
      sidebar.classList.toggle('collapsed', !this.sidebarOpen);
      main.classList.toggle('full-width', !this.sidebarOpen);
    }
  },

  closeMobileSidebar() {
    if (window.innerWidth <= 900) {
      document.getElementById('sidebar')?.classList.remove('mobile-open');
      const ov = document.getElementById('sidebar-overlay');
      if (ov) ov.style.display = 'none';
      this.sidebarOpen = false;
    }
  },

  search: Utils.debounce(function(q){
    if (q.length < 2) return;
    Toast.show(`Searching for "${q}"...`, 'info');
  }, 400),
};
