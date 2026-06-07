var Dashboard = {
  render: function() {
    var pg = Utils.get('pg-dashboard');
    if (!pg) return;
    var s        = DB.stats();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var sales    = DB.getSales();
    var products = DB.getProducts().filter(function(p){ return p.status !== 'inactive'; });

    // ── KPI Cards ──
    var profitColor = s.trueNetProfit >= 0 ? 'var(--ok)' : 'var(--er)';
    var profitBg    = s.trueNetProfit >= 0 ? 'var(--okb)' : 'var(--erb)';
    var profitIcon  = s.trueNetProfit >= 0 ? '💹' : '📉';
    var profitSub   = s.allocatedDaily > 0
      ? 'Incl. ' + Utils.cur(s.allocatedDaily, cur) + '/day alloc.'
      : (s.trueNetProfit >= 0 ? 'Profitable' : 'Loss');

    var kpis = '<div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)" onclick="Router.go(\'sales\')">'
      + '<div class="kpi-icon">💰</div><div class="kpi-label">Today Revenue</div>'
      + '<div class="kpi-value">'+Utils.cur(s.todayRev,cur)+'</div>'
      + '<div class="kpi-sub">'+s.todayCount+' sales</div></div>'

      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)" onclick="Router.go(\'finance\')">'
      + '<div class="kpi-icon">📈</div><div class="kpi-label">Monthly Revenue</div>'
      + '<div class="kpi-value">'+Utils.cur(s.totalRev,cur)+'</div>'
      + '<div class="kpi-sub">'+s.monthCount+' sales</div></div>'

      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)" onclick="Router.go(\'expenses\')">'
      + '<div class="kpi-icon">💸</div><div class="kpi-label">Expenses</div>'
      + '<div class="kpi-value">'+Utils.cur(s.totalExp,cur)+'</div>'
      + '<div class="kpi-sub">This month</div></div>'

      + '<div class="kpi" style="--kc:'+profitColor+';--kibg:'+profitBg+'" onclick="Router.go(\'finance\')">'
      + '<div class="kpi-icon">'+profitIcon+'</div><div class="kpi-label">True Net Profit</div>'
      + '<div class="kpi-value">'+Utils.cur(s.trueNetProfit,cur)+'</div>'
      + '<div class="kpi-sub">'+profitSub+'</div></div>'
      + '</div>';

    // ── Allocation Breakdown Card (only when allocations exist) ──
    var allocBreakdown = '';
    if (s.allocatedDaily > 0) {
      var tnpColor = s.trueNetProfit >= 0 ? 'var(--ok)' : 'var(--er)';
      allocBreakdown = '<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:var(--r12);padding:13px 15px;margin-top:2px;cursor:pointer" onclick="Allocations.render()">'
        + '<div style="font-size:11px;font-weight:700;color:var(--wa);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">📊 True Profit Breakdown</div>'
        + '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">'
        + '<span style="color:var(--t2)">Today Revenue</span>'
        + '<span style="color:var(--ok);font-weight:700">'+Utils.cur(s.todayRev,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">'
        + '<span style="color:var(--t2)">Manual Expenses</span>'
        + '<span style="color:var(--er);font-weight:700">-'+Utils.cur(s.totalExp,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">'
        + '<span style="color:var(--wa)">Allocated Expenses</span>'
        + '<span style="color:var(--wa);font-weight:700">-'+Utils.cur(s.allocatedDaily,cur)+'/day</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid rgba(245,158,11,.2);margin-top:5px;font-size:15px;font-weight:800">'
        + '<span style="color:var(--t1)">True Net Profit</span>'
        + '<span style="color:'+tnpColor+'">'+Utils.cur(s.trueNetProfit,cur)+'</span></div>'
        + '</div>';
    }

    // ── Quick Actions ──
    var qaGrid = '<div class="qa-grid">'
      + '<div class="qa-btn" onclick="Sales.openNewSale()">'
      + '<div class="qa-icon" style="background:var(--okb)">🧾</div><div class="qa-label">New Sale</div></div>'
      + '<div class="qa-btn" onclick="Products.openAddModal()">'
      + '<div class="qa-icon" style="background:var(--gb)">📦</div><div class="qa-label">Add Product</div></div>'
      + '<div class="qa-btn" onclick="Customers.openAddModal()">'
      + '<div class="qa-icon" style="background:var(--inb)">👤</div><div class="qa-label">Add Customer</div></div>'
      + '<div class="qa-btn" onclick="Expenses.openAddModal()">'
      + '<div class="qa-icon" style="background:var(--erb)">💸</div><div class="qa-label">Add Expense</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'reports\')">'
      + '<div class="qa-icon" style="background:var(--wab)">📊</div><div class="qa-label">Reports</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'ai\')">'
      + '<div class="qa-icon" style="background:var(--gb)">🤖</div><div class="qa-label">AI Assistant</div></div>'
      + '</div>';

    // ── Weekly Chart ──
    var weekChart = '<div class="sec"><div class="chart-wrap">'
      + '<div class="chart-title">This Week\'s Revenue</div>'
      + '<div class="chart-sub">'+cur+' daily breakdown</div>'
      + Charts.weekBars(sales)
      + '</div></div>';

    // ── Stock Alerts ──
    var alertsHtml = '';
    var alertItems = s.outStock.slice(0,3).concat(s.lowStock.slice(0,3));
    if (alertItems.length > 0) {
      var alertRows = alertItems.map(function(p) {
        var isOut   = p.qty === 0;
        var pct     = Math.min(100, Math.max(3, Math.round((p.qty / ((p.lowLevel||5)*3)) * 100)));
        var barCol  = isOut ? 'var(--er)' : 'var(--wa)';
        var bgCol   = isOut ? 'var(--erb)' : 'var(--wab)';
        var label   = isOut ? 'Out of Stock' : 'Low Stock';
        return '<div class="list-item" onclick="Router.go(\'products\')">'
          + '<div class="list-icon" style="background:'+bgCol+'">'+(isOut?'🚫':'⚠️')+'</div>'
          + '<div class="list-info">'
          + '<div class="list-name">'+Utils.esc(p.name)+'</div>'
          + '<div class="list-meta">'+(p.sku||'—')+' · '+(p.category||'—')+'</div>'
          + '<div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:'+pct+'%;background:'+barCol+'"></div></div></div>'
          + '</div>'
          + '<div class="list-right">'+Utils.statusBadge(label)
          + '<div style="font-size:12px;color:var(--t2);margin-top:4px">'+p.qty+' left</div>'
          + '</div></div>';
      }).join('');
      alertsHtml = '<div class="sec">'
        + '<div class="sec-title">⚠️ Stock Alerts <span class="sec-link" onclick="Router.go(\'products\')">View All</span></div>'
        + '<div class="card">'+alertRows+'</div></div>';
    }

    // ── Recent Sales ──
    var recentRows = sales.slice(0,5).map(function(s) {
      return '<div class="list-item">'
        + '<div class="list-icon" style="background:var(--gb3)">🧾</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
        + '<div class="list-meta">'+s.id+' · '+Utils.date(s.date)+'</div>'
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val">'+Utils.cur(s.total,cur)+'</div>'
        + '<div style="margin-top:3px">'+Utils.statusBadge(s.status||'Paid')+'</div>'
        + '</div></div>';
    }).join('');

    var recentHtml = '<div class="sec">'
      + '<div class="sec-title">Recent Sales <span class="sec-link" onclick="Router.go(\'sales\')">View All</span></div>'
      + (sales.length > 0
        ? '<div class="card">'+recentRows+'</div>'
        : '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No sales yet</div><div class="empty-sub">Tap "New Sale" to get started</div></div>')
      + '</div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Dashboard</div>'
      + '<div class="page-sub">'+new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Router.go(\'reports\')">📋 Reports</button></div>'
      + '</div>'
      + '<div class="sec">' + kpis + allocBreakdown + '</div>'
      + '<div class="sec"><div class="sec-title">Quick Actions</div>' + qaGrid + '</div>'
      + weekChart
      + alertsHtml
      + recentHtml;
  },
};
