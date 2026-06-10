var MorePage = {
  render: function() {
    var pg = Utils.get('pg-more');
    if (!pg) return;
    var sections = [
      {
        label: 'Business',
        items: [
          { icon:'📄', label:'Quotations',         desc:'Create & manage client quotations', bg:'var(--inb)', action:"Router.go('quotations')", badge:'NEW' },
          { icon:'🤖', label:'AI Assistant',        desc:'Ask Claude about your business',   bg:'var(--gb)',  action:"Router.go('ai')" },
          { icon:'🏭', label:'Suppliers',           desc:'Manage your suppliers',            bg:'var(--wab)', action:"Router.go('suppliers')" },
          { icon:'🚚', label:'Supply Management',  desc:'Purchase orders, GRN & bills',     bg:'var(--inb)', action:"Router.go('supply')", badge:'NEW' },
          { icon:'💰', label:'Salary & Payroll',   desc:'Manage employee salaries',         bg:'var(--okb)', action:"Router.go('salary')" },
        ]
      },
      {
        label: 'Finance',
        items: [
          { icon:'📊', label:'Finance Overview',   desc:'P&L, Cash Flow, margins',          bg:'var(--inb)', action:"Router.go('finance')" },
          { icon:'📋', label:'Reports',            desc:'Financial performance reports',    bg:'var(--wab)', action:"Router.go('reports')" },
          { icon:'📅', label:'Daily Report',       desc:"Print today's daily report",       bg:'var(--gb)',  action:"Reports.switchToDaily ? Reports.switchToDaily() : null; Router.go('reports')" },
          { icon:'📅', label:'Expense Allocations',desc:'Set up recurring cost allocations',bg:'rgba(245,158,11,.12)', action:"Allocations.render ? Allocations.render() : null" },
        ]
      },
      {
        label: 'System',
        items: [
          { icon:'⚙️', label:'Settings',           desc:'App configuration & profile',      bg:'var(--gb)',  action:"Router.go('settings')" },
          { icon:'🔔', label:'Notifications',      desc:'Stock & salary alerts',            bg:'var(--erb)', action:"Notifs.check();UI.toggleNotifPanel()" },
          { icon:'📥', label:'Export Data',        desc:'Download backup as JSON',          bg:'var(--okb)', action:"Settings.exportData()" },
          { icon:'🌙', label:'Toggle Theme',       desc:'Switch dark / light mode',         bg:'var(--bg3)', action:"Settings.toggleTheme()" },
          { icon:'🚪', label:'Sign Out',           desc:'Log out of this account',          bg:'var(--erb)', action:"Auth.logout()", danger:true },
        ]
      }
    ];

    var html = '<div class="page-header"><div><div class="page-title">More</div><div class="page-sub">Features & settings</div></div></div>';
    sections.forEach(function(section) {
      html += '<div class="sec"><div class="sec-title">'+section.label+'</div><div class="card">';
      section.items.forEach(function(item) {
        var badge = item.badge ? '<span style="background:var(--g);color:#07080D;font-size:9px;font-weight:800;padding:2px 8px;border-radius:99px;flex-shrink:0">'+item.badge+'</span>' : '';
        html += '<div class="more-item" onclick="'+item.action+'">'
          +'<div class="more-icon" style="background:'+item.bg+'">'+item.icon+'</div>'
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
