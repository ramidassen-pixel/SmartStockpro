var Finance = {
  render() {
    const pg = Utils.get('pg-finance');
    if (!pg) return;
    const settings = DB.getSettings();
    const cur = settings.currency||'$';
    const s = DB.stats();
    const sales = DB.getSales();
    const grossMargin = s.totalRev>0 ? Math.round((s.grossProfit/s.totalRev)*100) : 0;
    const netMargin   = s.totalRev>0 ? Math.round((s.netProfit/s.totalRev)*100) : 0;
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Finance</div>
          <div class="page-sub">This month · Automatically calculated</div></div>
      </div>
      <div class="sec">
        <div class="sec-title">📊 Profit & Loss</div>
        <div class="card card-body">
          <div class="report-row"><span class="report-label">Gross Revenue</span><span class="report-val gold">${Utils.cur(s.totalRev,cur)}</span></div>
          <div class="report-row"><span class="report-label">Cost of Goods Sold</span><span class="report-val err">(${Utils.cur(s.totalCogs,cur)})</span></div>
          <div class="report-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
            <span class="report-label">Gross Profit</span><span class="report-val ${s.grossProfit>=0?'ok':'err'}">${Utils.cur(s.grossProfit,cur)} (${grossMargin}%)</span>
          </div>
          <div class="report-row"><span class="report-label">Operating Expenses</span><span class="report-val err">(${Utils.cur(s.totalExp,cur)})</span></div>
          <div class="report-row" style="border-top:2px solid var(--border);padding-top:10px;margin-top:6px">
            <span style="font-size:15px;font-weight:800;color:var(--text)">NET PROFIT</span>
            <span class="report-val ${s.netProfit>=0?'ok':'err'}" style="font-size:18px">${Utils.cur(s.netProfit,cur)} (${netMargin}%)</span>
          </div>
        </div>
      </div>
      <div class="sec">
        <div class="sec-title">💵 Cash Flow</div>
        <div class="card card-body">
          <div class="report-row"><span class="report-label">Revenue Collected</span><span class="report-val ok">${Utils.cur(sales.filter(s=>s.status==='Paid').reduce((a,s)=>a+(parseFloat(s.total)||0),0),cur)}</span></div>
          <div class="report-row"><span class="report-label">Revenue Pending</span><span class="report-val warn">${Utils.cur(sales.filter(s=>s.status!=='Paid').reduce((a,s)=>a+(parseFloat(s.total)||0),0),cur)}</span></div>
          <div class="report-row"><span class="report-label">Cash Out (Expenses)</span><span class="report-val err">(${Utils.cur(s.totalExp,cur)})</span></div>
          <div class="report-row" style="border-top:2px solid var(--border);padding-top:10px;margin-top:6px">
            <span style="font-size:14px;font-weight:800">Net Cash Flow</span>
            <span class="report-val ${(s.totalRev-s.totalExp)>=0?'ok':'err'}" style="font-size:16px">${Utils.cur(s.totalRev-s.totalExp,cur)}</span>
          </div>
        </div>
      </div>
      <div class="sec">
        <div class="sec-title">📈 6-Month Revenue Trend</div>
        <div class="chart-wrap">${Charts.monthBars(sales,'gold')}</div>
      </div>
      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--gold);--kibg:var(--goldbg)">
            <div class="kpi-icon">📦</div><div class="kpi-label">Total Sales</div>
            <div class="kpi-value">${sales.length}</div>
          </div>
          <div class="kpi" style="--kc:var(--ok);--kibg:var(--okbg)">
            <div class="kpi-icon">💳</div><div class="kpi-label">Avg Order</div>
            <div class="kpi-value">${Utils.cur(sales.length?s.totalRev/sales.length:0,cur)}</div>
          </div>
          <div class="kpi" style="--kc:var(--info);--kibg:var(--infobg)">
            <div class="kpi-icon">👥</div><div class="kpi-label">Customers</div>
            <div class="kpi-value">${DB.getCustomers().length}</div>
          </div>
          <div class="kpi" style="--kc:var(--warn);--kibg:var(--warnbg)">
            <div class="kpi-icon">📦</div><div class="kpi-label">Products</div>
            <div class="kpi-value">${DB.getProducts().filter(p=>p.status!=='inactive').length}</div>
          </div>
        </div>
      </div>`;
  },
};
