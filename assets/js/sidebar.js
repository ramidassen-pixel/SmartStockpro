/* === sidebar.js ===
   Desktop side menu (visible ≥1024px wide via CSS). Phones keep the bottom nav. */
var Sidebar = {
  groups: [
    { label: 'Main', items: [
      ['dashboard',  'layout-dashboard',   'Dashboard'],
      ['sales',      'receipt',            'Sales'],
      ['products',   'package',            'Products'],
      ['customers',  'users',              'Customers'],
      ['stock',      'history',            'Stock history'],
    ]},
    { label: 'Business', items: [
      ['quotations', 'file-text',          'Quotations'],
      ['suppliers',  'building-warehouse', 'Suppliers'],
      ['supply',     'truck',              'Supply'],
      ['expenses',   'wallet',             'Expenses'],
      ['salary',     'coins',              'Salary & payroll'],
    ]},
    { label: 'Finance', items: [
      ['finance',    'report-money',       'Finance'],
      ['reports',    'report-analytics',   'Reports'],
      ['closing',    'lock',               'Daily closing'],
    ]},
    { label: 'System', items: [
      ['ai',         'robot',              'AI assistant'],
      ['usermgmt',   'user-cog',           'Team & access'],
      ['support',    'help',               'Support'],
      ['settings',   'settings',           'Settings'],
    ]},
  ],

  render: function() {
    var el = document.getElementById('sidebar');
    if (!el) return;
    var html = '<div class="sb-brand" onclick="Router.go(\'dashboard\')">'
      + '<img class="sb-logo" src="pwa/icon-192.png" alt="">'
      + '<div class="sb-brand-text"><div class="sb-name" id="sb-biz-name">SmartStock Pro</div><div class="sb-sub">Business manager</div></div>'
      + '</div>'
      + '<button class="sb-new-sale" onclick="Sales.openNewSale()">' + Icons.svg('plus', 18) + '<span>New sale</span></button>'
      + '<nav class="sb-nav">';
    this.groups.forEach(function(g) {
      html += '<div class="sb-group">' + g.label + '</div>';
      g.items.forEach(function(it) {
        html += '<a class="sb-item" id="sn-' + it[0] + '" href="#" role="button" onclick="Router.go(\'' + it[0] + '\');return false">'
          + Icons.svg(it[1], 19) + '<span>' + it[2] + '</span></a>';
      });
    });
    html += '</nav><div class="sb-foot">';
    if (typeof Install !== 'undefined' && !Install.isInstalled()) {
      html += '<a class="sb-item" href="#" role="button" onclick="Install.install();return false">' + Icons.svg('device-desktop', 19) + '<span>Install desktop app</span></a>';
    }
    html += '<a class="sb-item sb-logout" href="#" role="button" onclick="Auth.logout();return false">' + Icons.svg('logout', 19) + '<span>Sign out</span></a>'
      + '</div>';
    el.innerHTML = html;
    this.setActive((typeof Router !== 'undefined' && Router.current) || 'dashboard');
    this.syncBrand();
  },

  setActive: function(page) {
    var items = document.querySelectorAll('.sb-item.active');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
    var a = document.getElementById('sn-' + page);
    if (a) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
    // Desktop top bar shows the current page name
    var t = document.getElementById('tb-page-title');
    if (t) t.textContent = a ? a.textContent : (page === 'more' ? 'More' : page.charAt(0).toUpperCase() + page.slice(1));
  },

  syncBrand: function() {
    try {
      var s = DB.getSettings();
      var n = document.getElementById('sb-biz-name');
      if (n && s.bizName) n.textContent = s.bizName;
      var logo = document.querySelector('.sb-logo');
      if (logo && s.bizLogo) logo.src = s.bizLogo;
    } catch (e) {}
  },
};

document.addEventListener('DOMContentLoaded', function() {
  Sidebar.render();
  Icons.hydrate(document);
});
