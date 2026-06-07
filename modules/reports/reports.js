var Reports = {
  period: 'month',

  render: function() {
    var pg = Utils.get('pg-reports');
    if (!pg) return;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var sales    = DB.getSales();
    var expenses = DB.getExpenses();
    var today    = Utils.today();
    var month    = today.slice(0, 7);
    var weekDate = new Date(); weekDate.setDate(weekDate.getDate() - 6);
    var weekStr  = weekDate.toISOString().slice(0, 10);

    var filtered, expFiltered;
    if (this.period === 'today') {
      filtered    = sales.filter(function(s){ return s.date === today; });
      expFiltered = expenses.filter(function(e){ return e.date === today; });
    } else if (this.period === 'week') {
      filtered    = sales.filter(function(s){ return s.date >= weekStr; });
      expFiltered = expenses.filter(function(e){ return e.date >= weekStr; });
    } else {
      filtered    = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
      expFiltered = expenses.filter(function(e){ return e.date && e.date.startsWith(month); });
    }

    var rev    = filtered.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var exp    = expFiltered.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var profit = rev - exp;
    var margin = rev > 0 ? Math.round((profit/rev)*100) : 0;

    // Top products
    var prodMap = {};
    filtered.forEach(function(s){
      (s.items||[]).forEach(function(item){
        prodMap[item.name] = (prodMap[item.name]||0) + (parseInt(item.qty)||1);
      });
    });
    var topProds = Object.keys(prodMap)
      .map(function(k){ return [k, prodMap[k]]; })
      .sort(function(a,b){ return b[1]-a[1]; })
      .slice(0, 5);

    // Build chips
    var chips = [['today','Today'],['week','This Week'],['month','This Month']].map(function(pair){
      return '<div class="chip'+(Reports.period===pair[0]?' active':'')+'" onclick="Reports.setPeriod(\''+pair[0]+'\')">'+pair[1]+'</div>';
    }).join('');

    // Build KPI cards
    var profitColor = profit>=0 ? 'var(--ok)' : 'var(--er)';
    var profitBg    = profit>=0 ? 'var(--okb)' : 'var(--erb)';
    var profitIcon  = profit>=0 ? '📈' : '📉';
    var kpis = '<div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">💰</div><div class="kpi-label">Revenue</div><div class="kpi-value">'+Utils.cur(rev,cur)+'</div><div class="kpi-sub">'+filtered.length+' sales</div></div>'
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)"><div class="kpi-icon">💸</div><div class="kpi-label">Expenses</div><div class="kpi-value">'+Utils.cur(exp,cur)+'</div></div>'
      + '<div class="kpi" style="--kc:'+profitColor+';--kibg:'+profitBg+'"><div class="kpi-icon">'+profitIcon+'</div><div class="kpi-label">Net Profit</div><div class="kpi-value">'+Utils.cur(profit,cur)+'</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📊</div><div class="kpi-label">Margin</div><div class="kpi-value">'+margin+'%</div></div>'
      + '</div>';

    // Top products
    var topProdsHtml = '';
    if (topProds.length) {
      topProdsHtml = '<div class="sec-title" style="margin-top:14px">Top Selling Products</div>'
        + '<div class="card card-body">'
        + topProds.map(function(p,i){
            return '<div class="report-row">'
              + '<span class="report-label">'+(i+1)+'. '+Utils.esc(p[0])+'</span>'
              + '<span class="report-val gold">'+p[1]+' units</span>'
              + '</div>';
          }).join('')
        + '</div>';
    }

    // Transaction list
    var txRows = filtered.slice(0, 20).map(function(s){
      return '<div class="list-item">'
        + '<div class="list-icon" style="background:var(--gb3)">🧾</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
        + '<div class="list-meta">'+s.id+' · '+Utils.date(s.date)+'</div>'
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val">'+Utils.cur(s.total,cur)+'</div>'
        + Utils.statusBadge(s.status||'Paid')
        + '</div></div>';
    }).join('');

    var txHtml = filtered.length
      ? '<div class="card">'+txRows+'</div>'
      : '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No data for this period</div></div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Reports</div><div class="page-sub">Business performance</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Reports.exportCSV()">📥 Export</button></div>'
      + '</div>'
      + '<div class="chips">'+chips+'</div>'
      + '<div class="sec">'
      + kpis
      + topProdsHtml
      + '<div class="sec-title" style="margin-top:14px">Transaction List</div>'
      + txHtml
      + '</div>';
  },

  setPeriod: function(p) { this.period = p; this.render(); },

  exportCSV: function() {
    var sales  = DB.getSales();
    var header = ['ID', 'Date', 'Customer', 'Total', 'Status', 'Items'];
    var dataRows = sales.map(function(s) {
      return [s.id||'', s.date||'', s.customer||'', s.total||0, s.status||'', (s.items||[]).length];
    });
    var allRows  = [header].concat(dataRows);
    var csvLines = allRows.map(function(row) {
      return row.map(function(cell) {
        return '"' + String(cell).replace(/"/g, '""') + '"';
      }).join(',');
    });
    var csvText = csvLines.join('\r\n');
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvText);
    a.download = 'smartstock_reports_' + Utils.today() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    Toast.show('CSV exported \u2713', 'ok');
  },
};
