var MorePage = {
  render() {
    const pg = Utils.get('pg-more');
    if (!pg) return;

    const user = Auth.currentUser || {};
    const s = DB.getSettings();

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">More</div>
          <div class="page-sub">All features & settings</div>
        </div>
      </div>

      <!-- USER PROFILE CARD -->
      <div class="sec">
        <div class="card" style="padding:16px;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--gold3));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#0a0a0a;flex-shrink:0">
              ${(user.name||user.username||'U')[0].toUpperCase()}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:16px;font-weight:800;color:var(--text)">${Utils.esc(user.name||user.username||'User')}</div>
              <div style="font-size:12px;color:var(--gold);margin-top:2px;font-weight:600;text-transform:capitalize">${Utils.esc(user.role||'Owner')}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:1px">${Utils.esc(s.bizName||'SmartStock Pro')}</div>
            </div>
            <button class="btn-ghost btn-sm" onclick="Router.go('settings')">Edit</button>
          </div>
        </div>
      </div>

      <!-- MAIN NAVIGATION -->
      <div class="sec">
        <div class="more-section-label">Navigation</div>
        <div class="card" style="overflow:hidden">
          ${MorePage._item('🏠','Dashboard',      'Business overview & KPIs',         'var(--goldbg)',  "Router.go('dashboard')")}
          ${MorePage._item('🧾','Sales & POS',    'Create invoices & record sales',    'var(--okbg)',    "Router.go('sales')")}
          ${MorePage._item('📦','Products',       'Manage your inventory',             'var(--goldbg)',  "Router.go('products')")}
          ${MorePage._item('👥','Customers',      'Customer profiles & history',       'var(--infobg)', "Router.go('customers')")}
          ${MorePage._item('🏭','Suppliers',      'Supplier management & balances',    'var(--warnbg)', "Router.go('suppliers')")}
        </div>
      </div>

      <!-- FINANCE -->
      <div class="sec">
        <div class="more-section-label">Finance</div>
        <div class="card" style="overflow:hidden">
          ${MorePage._item('💸','Expenses',        'Track business expenses',          'var(--errbg)',   "Router.go('expenses')")}
          ${MorePage._item('💰','Salary & Payroll','Manage employee salaries',         'var(--okbg)',    "Router.go('salary')")}
          ${MorePage._item('📊','Finance Overview','P&L, Cash Flow, analysis',         'var(--infobg)', "Router.go('finance')")}
          ${MorePage._item('📋','Reports',         'Daily, weekly, monthly reports',   'var(--warnbg)', "Router.go('reports')")}
        </div>
      </div>

      <!-- INTELLIGENCE -->
      <div class="sec">
        <div class="more-section-label">Intelligence</div>
        <div class="card" style="overflow:hidden">
          ${MorePage._item('🤖','AI Assistant',    'Ask Claude about your business',   'var(--goldbg)', "Router.go('ai')", 'AI')}
        </div>
      </div>

      <!-- TOOLS -->
      <div class="sec">
        <div class="more-section-label">Tools</div>
        <div class="card" style="overflow:hidden">
          ${MorePage._item('🔔','Notifications',   'Check stock & salary alerts',      'var(--errbg)',  "Notifs.check();UI.toggleNotifPanel()")}
          ${MorePage._item('📥','Export Backup',   'Download all data as JSON',        'var(--okbg)',   "Settings.exportData()")}
          ${MorePage._item('🌙','Toggle Theme',    'Switch dark / light mode',         'rgba(255,255,255,0.07)', "MorePage.toggleTheme()")}
        </div>
      </div>

      <!-- SYSTEM -->
      <div class="sec">
        <div class="more-section-label">System</div>
        <div class="card" style="overflow:hidden">
          ${MorePage._item('⚙️','Settings',        'App configuration & profile',      'var(--goldbg)', "Router.go('settings')")}
          ${MorePage._item('🚪','Sign Out',         'Log out of this account',          'var(--errbg)',  "Auth.logout()", '', true)}
        </div>
      </div>

      <!-- VERSION -->
      <div style="text-align:center;padding:16px 0 24px;color:var(--text3);font-size:11px">
        SmartStock Pro V5 · Built for your business
      </div>
    `;
  },

  _item(icon, label, desc, bg, action, badge, danger) {
    return `
      <div class="more-item" onclick="${action}">
        <div class="more-icon" style="background:${bg}">${icon}</div>
        <div class="more-text">
          <div class="more-name" ${danger ? 'style="color:var(--err)"' : ''}>${label}</div>
          <div class="more-desc">${desc}</div>
        </div>
        ${badge ? `<span class="badge badge-gold">${badge}</span>` : ''}
        <div class="more-arrow">›</div>
      </div>`;
  },

  toggleTheme() {
    const s = DB.getSettings();
    const next = s.theme === 'light' ? 'dark' : 'light';
    DB.saveSettings({ theme: next });
    UI.applyTheme(next);
    Toast.show('Theme changed ✓', 'ok');
    this.render();
  },
};
