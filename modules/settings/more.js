var MorePage = {
  render() {
    const pg = Utils.get('pg-more');
    if (!pg) return;
    const items = [
      { icon:'🤖', label:'AI Assistant',      desc:'Ask Claude about your business', bg:'var(--goldbg)',  action:"Router.go('ai')",       badge:'NEW' },
      { icon:'🏭', label:'Suppliers',         desc:'Manage your suppliers',          bg:'var(--warnbg)', action:"Router.go('suppliers')"  },
      { icon:'💰', label:'Salary & Payroll',  desc:'Manage employee salaries',       bg:'var(--okbg)',   action:"Router.go('salary')"     },
      { icon:'📊', label:'Finance Overview',  desc:'P&L, Cash Flow',                 bg:'var(--infobg)', action:"Router.go('finance')"    },
      { icon:'📋', label:'Reports',           desc:'Daily, weekly, monthly reports', bg:'var(--warnbg)', action:"Router.go('reports')"    },
      { icon:'⚙️', label:'Settings',          desc:'App configuration & profile',    bg:'var(--goldbg)', action:"Router.go('settings')"   },
      { icon:'🔔', label:'Notifications',     desc:'Stock & salary alerts',          bg:'var(--errbg)',  action:"Notifs.check();UI.toggleNotifPanel()" },
      { icon:'📥', label:'Export Data',       desc:'Download backup as JSON',        bg:'var(--okbg)',   action:"Settings.exportData()"   },
      { icon:'🌙', label:'Toggle Theme',      desc:'Switch dark / light mode',       bg:'var(--bg3)',    action:"Settings.toggleTheme()"  },
      { icon:'🚪', label:'Sign Out',          desc:'Log out of this account',        bg:'var(--errbg)',  action:"Auth.logout()", color:'var(--err)' },
    ];
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">More</div>
          <div class="page-sub">Features & settings</div></div>
      </div>
      <div class="sec">
        <div class="card">
          ${items.map(item=>`
          <div class="more-item" onclick="${item.action}">
            <div class="more-icon" style="background:${item.bg}">${item.icon}</div>
            <div class="more-text">
              <div class="more-name" ${item.color?`style="color:${item.color}"`:''}>${item.label}</div>
              <div class="more-desc">${item.desc}</div>
            </div>
            ${item.badge?`<span class="badge badge-gold">${item.badge}</span>`:''}
            <div class="more-arrow">›</div>
          </div>`).join('')}
        </div>
      </div>`;
  },
};
