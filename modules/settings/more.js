/* === more.js === */
var MorePage = {
  render: function() {
    var pg = Utils.get('pg-more');
    if (!pg) return;
    var installItem = [];
    if (typeof Install !== 'undefined' && !Install.isInstalled()) {
      var mob = Install.device().mobile;
      installItem.push({ icon: mob ? 'device-mobile' : 'device-desktop', label: mob ? 'Install Mobile App' : 'Install Desktop App',
        desc: mob ? 'Home-screen icon, full screen, works offline' : 'Own window & desktop icon, works offline',
        bg:'var(--gb)', action:'Install.install()', badge:'APP' });
    }
    var sections = [
      {
        label: 'Business',
        items: [
          { icon:'credit-card', label:'Plan & Billing',   desc:'Your plan · upgrade with Mobile Money', bg:'var(--gb)', action:"Router.go('billing')", badge:'' },
          { icon:'file-text', label:'Quotations',         desc:'Create & manage client quotations', bg:'var(--inb)', action:"Router.go('quotations')", badge:'NEW' },
          { icon:'history', label:'Stock History',   desc:'Stock in/out & adjustments',         bg:'var(--inb)', action:"Router.go('stock')",          badge:'' },
          { icon:'alert-triangle', label:'Debt Report',    desc:'Customer outstanding balances',       bg:'var(--erb)', action:'Customers.debtReport()',      badge:'' },
          { icon:'database', label:'Data Backup',    desc:'Download & restore your data',        bg:'var(--okb)', action:'Backup._openBackupModal()',    badge:'SAFE' },
          { icon:'help', label:'Support Center',          desc:'Help, feedback & issue tickets',    bg:'var(--inb)', action:"Router.go('support')",   badge:'NEW' },
          { icon:'user-cog', label:'Team & Access',         desc:'Users, roles & permissions',       bg:'var(--gb)',  action:"Router.go('usermgmt')",  badge:'NEW' },
          { icon:'robot', label:'AI Assistant',        desc:'Ask Claude about your business',   bg:'var(--gb)',  action:"Router.go('ai')" },
          { icon:'building-warehouse', label:'Suppliers',           desc:'Manage your suppliers',            bg:'var(--wab)', action:"Router.go('suppliers')" },
          { icon:'truck', label:'Supply Management',  desc:'Purchase orders, GRN & bills',     bg:'var(--inb)', action:"Router.go('supply')", badge:'NEW' },
          { icon:'coins', label:'Salary & Payroll',   desc:'Manage employee salaries',         bg:'var(--okb)', action:"Router.go('salary')" },
        ]
      },
      {
        label: 'Finance',
        items: [
          { icon:'report-money', label:'Finance Overview',   desc:'P&L, Cash Flow, margins',          bg:'var(--inb)', action:"Router.go('finance')" },
          { icon:'report-analytics', label:'Reports',            desc:'Financial performance reports',    bg:'var(--wab)', action:"Router.go('reports')" },
          { icon:'lock', label:'Daily Closing',        desc:'End of day cash count & summary',   bg:'var(--gb)',  action:"Router.go('closing')", badge:'NEW' },
          { icon:'calendar', label:'Daily Report',       desc:"Print today's daily report",       bg:'var(--gb)',  action:"Reports.switchToDaily ? Reports.switchToDaily() : null; Router.go('reports')" },
          { icon:'calendar-stats', label:'Expense Allocations',desc:'Set up recurring cost allocations',bg:'rgba(245,158,11,.12)', action:"Allocations.render ? Allocations.render() : null" },
        ]
      },
      {
        label: 'System',
        items: installItem.concat(
          (typeof SuperAdmin !== 'undefined' && SuperAdmin._isAdmin === true)
            ? [{ icon:'shield-lock', label:'Platform Admin', desc:'All shops, users, plans & payments', bg:'var(--gb)', action:"Router.go('superadmin')", badge:'OWNER' }]
            : []
        ).concat([
          { icon:'settings', label:'Settings',           desc:'App configuration & profile',      bg:'var(--gb)',  action:"Router.go('settings')" },
          { icon:'bell', label:'Notifications',      desc:'Stock & salary alerts',            bg:'var(--erb)', action:"Notifs.check();UI.toggleNotifPanel()" },
          { icon:'download', label:'Export Data',        desc:'Download backup as JSON',          bg:'var(--okb)', action:"Settings.exportData()" },
          { icon:'moon', label:'Toggle Theme',       desc:'Switch dark / light mode',         bg:'var(--bg3)', action:"Settings.toggleTheme()" },
          { icon:'logout', label:'Sign Out',           desc:'Log out of this account',          bg:'var(--erb)', action:"Auth.logout()", danger:true },
        ])
      }
    ];

    var html = '<div class="page-header"><div><div class="page-title">More</div><div class="page-sub">Features & settings</div></div></div>';
    sections.forEach(function(section) {
      html += '<div class="sec"><div class="sec-title">'+section.label+'</div><div class="card">';
      section.items.forEach(function(item) {
        var badge = item.badge ? '<span style="background:var(--g);color:#07080D;font-size:9px;font-weight:800;padding:2px 8px;border-radius:99px;flex-shrink:0">'+item.badge+'</span>' : '';
        html += '<div class="more-item" onclick="'+item.action+'">'
          +'<div class="more-icon" style="background:'+item.bg+';color:'+(item.danger?'var(--er)':'var(--g)')+'">'+(Icons.svg(item.icon,20)||item.icon)+'</div>'
          +'<div class="more-text"><div class="more-name"'+(item.danger?' style="color:var(--er)"':'')+'>'+item.label+'</div>'
          +'<div class="more-desc">'+item.desc+'</div></div>'
          +badge
          +'<div class="more-arrow">&#8250;</div></div>';
      });
      html += '</div></div>';
    });
    pg.innerHTML = html;
  },
};
