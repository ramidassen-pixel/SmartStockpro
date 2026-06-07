var Finance = {
  render: function() {
    var pg = Utils.get('pg-finance');
    if (!pg) return;
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';
    var s         = DB.stats();
    var sales     = DB.getSales();
    var allocs    = DB.getAllocatedDaily();
    var allocTot  = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    var grossMargin = s.totalRev > 0 ? Math.round((s.grossProfit/s.totalRev)*100) : 0;
    var trueMargin  = s.totalRev > 0 ? Math.round((s.trueNetProfit/s.totalRev)*100) : 0;

    // ── Profit & Loss ──
    var allocRows = allocs.length
      ? '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)">'
        + '<span class="report-label" style="color:var(--wa)">Allocated Expenses (daily)</span>'
        + '<span class="report-val err" style="color:var(--wa)">('+Utils.cur(allocTot,cur)+')</span></div>'
      : '';

    var plHtml = '<div class="sec">'
      + '<div class="sec-title">📊 Profit &amp; Loss</div>'
      + '<div class="card card-body">'
      + '<div class="report-row"><span class="report-label">Gross Revenue</span><span class="report-val gold">'+Utils.cur(s.totalRev,cur)+'</span></div>'
      + '<div class="report-row"><span class="report-label">Cost of Goods Sold</span><span class="report-val err">('+Utils.cur(s.totalCogs,cur)+')</span></div>'
      + '<div class="report-row" style="border-top:1px solid var(--bd);padding-top:8px;margin-top:4px">'
      + '<span class="report-label">Gross Profit</span>'
      + '<span class="report-val '+(s.grossProfit>=0?'ok':'err')+'">'+Utils.cur(s.grossProfit,cur)+' ('+grossMargin+'%)</span></div>'
      + '<div class="report-row"><span class="report-label">Manual Expenses</span><span class="report-val err">('+Utils.cur(s.totalExp,cur)+')</span></div>'
      + allocRows
      + '<div class="report-row" style="border-top:2px solid var(--bd);padding-top:10px;margin-top:6px">'
      + '<span style="font-size:15px;font-weight:800;color:var(--t1)">TRUE NET PROFIT</span>'
      + '<span class="report-val '+(s.trueNetProfit>=0?'ok':'err')+'" style="font-size:18px">'+Utils.cur(s.trueNetProfit,cur)+' ('+trueMargin+'%)</span></div>'
      + '</div></div>';

    // ── Expense Breakdown ──
    var expBreakdown = allocs.length
      ? '<div class="sec">'
        + '<div class="sec-title">📋 Expense Breakdown</div>'
        + '<div class="card card-body">'
        + '<div class="report-row"><span class="report-label">Manual Expenses (month)</span><span class="report-val err">'+Utils.cur(s.totalExp,cur)+'</span></div>'
        + '<div class="report-row"><span class="report-label" style="color:var(--wa)">Allocated Expenses (daily)</span><span class="report-val" style="color:var(--wa)">'+Utils.cur(allocTot,cur)+'</span></div>'
        + '<div class="report-row" style="border-top:1px solid var(--bd);padding-top:8px;margin-top:4px">'
        + '<span class="report-label">Total All Expenses</span>'
        + '<span class="report-val err">'+Utils.cur(s.totalExp+allocTot,cur)+'</span></div>'
        + (allocs.length > 0 ? '<div style="margin-top:10px;font-size:11px;font-weight:700;color:var(--wa);margin-bottom:6px">Active Allocations</div>'
          + allocs.map(function(a){
              return '<div class="report-row"><span class="report-label" style="color:var(--t2)">'+Utils.esc(a.name)+'</span>'
                + '<span style="font-size:12px;color:var(--wa);font-weight:600">'+Utils.cur(a.daily,cur)+'/day</span></div>';
            }).join('') : '')
        + '</div></div>'
      : '';

    // ── Cash Flow ──
    var cashPaid = sales.filter(function(s){ return s.status==='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var cashPending = sales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);
    var netCash = cashPaid - s.totalExp - allocTot;
    var cashColor = netCash >= 0 ? 'ok' : 'err';

    var cashHtml = '<div class="sec">'
      + '<div class="sec-title">💵 Cash Flow</div>'
      + '<div class="card card-body">'
      + '<div class="report-row"><span class="report-label">Revenue Collected</span><span class="report-val ok">'+Utils.cur(cashPaid,cur)+'</span></div>'
      + '<div class="report-row"><span class="report-label">Revenue Pending</span><span class="report-val warn">'+Utils.cur(cashPending,cur)+'</span></div>'
      + '<div class="report-row"><span class="report-label">Cash Out (Manual Exp.)</span><span class="report-val err">('+Utils.cur(s.totalExp,cur)+')</span></div>'
      + (allocTot>0?'<div class="report-row"><span class="report-label" style="color:var(--wa)">Cash Out (Allocated)</span><span style="color:var(--wa);font-family:var(--fm);font-weight:700">('+Utils.cur(allocTot,cur)+')</span></div>':'')
      + '<div class="report-row" style="border-top:2px solid var(--bd);padding-top:10px;margin-top:6px">'
      + '<span style="font-size:14px;font-weight:800">Net Cash Flow</span>'
      + '<span class="report-val '+cashColor+'" style="font-size:16px">'+Utils.cur(netCash,cur)+'</span></div>'
      + '</div></div>';

    // ── 6-Month Chart ──
    var chartHtml = '<div class="sec">'
      + '<div class="sec-title">📈 6-Month Revenue Trend</div>'
      + '<div class="chart-wrap">'+Charts.monthBars(sales,'gold')+'</div></div>';

    // ── KPIs ──
    var kpiHtml = '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">📦</div><div class="kpi-label">Total Sales</div><div class="kpi-value">'+sales.length+'</div></div>'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">💳</div><div class="kpi-label">Avg Order</div><div class="kpi-value">'+Utils.cur(sales.length?s.totalRev/sales.length:0,cur)+'</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">👥</div><div class="kpi-label">Customers</div><div class="kpi-value">'+DB.getCustomers().length+'</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">📅</div><div class="kpi-label">Allocations</div><div class="kpi-value">'+allocs.length+'</div><div class="kpi-sub">'+Utils.cur(allocTot,cur)+'/day</div></div>'
      + '</div></div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Finance</div>'
      + '<div class="page-sub">This month · Auto-calculated</div></div>'
      + '</div>'
      + plHtml + expBreakdown + cashHtml + chartHtml + kpiHtml;
  },
};
