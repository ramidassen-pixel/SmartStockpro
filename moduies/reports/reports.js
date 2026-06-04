'use strict';
const Reports = {
  period: 'month',
  render() {
    const pg = Utils.get('pg-reports');
    if (!pg) return;
    const settings = DB.getSettings();
    const cur = settings.currency||'$';
    const sales = DB.getSales();
    const expenses = DB.getExpenses();
    const today = Utils.today();
    const month = today.slice(0,7);
    const week = (() => { const d=new Date(); d.setDate(d.getDate()-6); return d.toISOString().slice(0,10); })();
    const periods = { today: s=>s.date===today, week: s=>s.date>=week, month: s=>s.date&&s.date.startsWith(month) };
    const fn = periods[this.period];
    const filtered = sales.filter(fn);
    const expFiltered = expenses.filter(fn);
    const rev = filtered.reduce((a,s)=>a+(parseFloat(s.total)||0),0);
    const exp = expFiltered.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
    const cogs = filtered.reduce((a,s)=>a+(s.items||[]).reduce((b,i)=>b+(parseFloat(i.cost||0)*parseInt(i.qty||1)),0),0);
    const profit = rev - exp;
    // Top products
    const prodMap = {};
    filtered.forEach(s=>(s.items||[]).forEach(i=>{ prodMap[i.name]=(prodMap[i.name]||0)+i.qty; }));
    const topProds = Object.entries(prodMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Reports</div>
          <div class="page-sub">Business performance</div></div>
        <div class="page-actions">
          <button class="btn-ghost btn-sm" onclick="Reports.exportCSV()">📥 Export</button>
        </div>
      </div>
      <div class="chips">
        ${[['today','Today'],['week','This Week'],['month','This Month']].map(([k,l])=>
          `<div class="chip${this.period===k?' active':''}" onclick="Reports.setPeriod('${k}')">${l}</div>`).join('')}
      </div>
      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--gold);--kibg:var(--goldbg)">
            <div class="kpi-icon">💰</div><div class="kpi-label">Revenue</div>
            <div class="kpi-value">${Utils.cur(rev,cur)}</div>
            <div class="kpi-sub">${filtered.length} sales</div>
          </div>
          <div class="kpi" style="--kc:var(--err);--kibg:var(--errbg)">
            <div class="kpi-icon">💸</div><div class="kpi-label">Expenses</div>
            <div class="kpi-value">${Utils.cur(exp,cur)}</div>
          </div>
          <div class="kpi" style="--kc:${profit>=0?'var(--ok)':'var(--err)'};--kibg:${profit>=0?'var(--okbg)':'var(--errbg)'}">
            <div class="kpi-icon">${profit>=0?'📈':'📉'}</div><div class="kpi-label">Net Profit</div>
            <div class="kpi-value">${Utils.cur(profit,cur)}</div>
          </div>
          <div class="kpi" style="--kc:var(--info);--kibg:var(--infobg)">
            <div class="kpi-icon">📊</div><div class="kpi-label">Margin</div>
            <div class="kpi-value">${rev>0?Math.round((profit/rev)*100):0}%</div>
          </div>
        </div>
        ${topProds.length ? `
        <div class="sec-title">Top Selling Products</div>
        <div class="card card-body">
          ${topProds.map((p,i)=>`<div class="report-row">
            <span class="report-label">${i+1}. ${Utils.esc(p[0])}</span>
            <span class="report-val gold">${p[1]} units</span>
          </div>`).join('')}
        </div>` : ''}
        <div class="sec-title">Transaction List</div>
        ${filtered.length ? `<div class="card">${filtered.slice(0,20).map(s=>`
          <div class="list-item">
            <div class="list-icon" style="background:var(--goldbg)">🧾</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(s.customer||'Walk-in')}</div>
              <div class="list-meta">${s.id} · ${Utils.date(s.date)}</div>
            </div>
            <div class="list-right">
              <div class="list-val">${Utils.cur(s.total,cur)}</div>
              ${Utils.statusBadge(s.status||'Paid')}
            </div>
          </div>`).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No data for this period</div></div>'}
      </div>`;
  },
  setPeriod(p) { this.period=p; this.render(); },
  exportCSV() {
    const sales = DB.getSales();
    const rows = [['ID','Date','Customer','Total','Status','Items']];
    sales.forEach(s=>rows.push([s.id, s.date||'', s.customer||'', s.total||0, s.status||'', (s.items||[]).length]));
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('
');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'smartstock_sales_' + Utils.today() + '.csv';
    a.click();
    Toast.show('CSV exported ✓','ok');
  },
};
