'use strict';
const Dashboard = {
  render() {
    const pg = Utils.get('pg-dashboard');
    if (!pg) return;
    const s = DB.stats();
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    const sales = DB.getSales();
    const products = DB.getProducts().filter(p=>p.status!=='inactive');
    pg.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Dashboard</div>
          <div class="page-sub">${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <div class="page-actions">
          <button class="btn-ghost btn-sm" onclick="Router.go('reports')">📋 Reports</button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--gold);--kibg:var(--goldbg)" onclick="Router.go('sales')">
            <div class="kpi-icon">💰</div>
            <div class="kpi-label">Today Revenue</div>
            <div class="kpi-value">${Utils.cur(s.todayRev, cur)}</div>
            <div class="kpi-sub">${s.todayCount} sales</div>
          </div>
          <div class="kpi" style="--kc:var(--ok);--kibg:var(--okbg)" onclick="Router.go('finance')">
            <div class="kpi-icon">📈</div>
            <div class="kpi-label">Monthly Revenue</div>
            <div class="kpi-value">${Utils.cur(s.totalRev, cur)}</div>
            <div class="kpi-sub">${s.monthCount} sales</div>
          </div>
          <div class="kpi" style="--kc:var(--err);--kibg:var(--errbg)" onclick="Router.go('expenses')">
            <div class="kpi-icon">💸</div>
            <div class="kpi-label">Expenses</div>
            <div class="kpi-value">${Utils.cur(s.totalExp, cur)}</div>
            <div class="kpi-sub">This month</div>
          </div>
          <div class="kpi" style="--kc:${s.netProfit>=0?'var(--ok)':'var(--err)'};--kibg:${s.netProfit>=0?'var(--okbg)':'var(--errbg)'}" onclick="Router.go('finance')">
            <div class="kpi-icon">${s.netProfit>=0?'💹':'📉'}</div>
            <div class="kpi-label">Net Profit</div>
            <div class="kpi-value">${Utils.cur(s.netProfit, cur)}</div>
            <div class="kpi-sub">${s.netProfit>=0?'Profitable':'Loss'}</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="sec">
        <div class="sec-title">Quick Actions</div>
        <div class="qa-grid">
          <div class="qa-btn" onclick="Sales.openNewSale()">
            <div class="qa-icon" style="background:var(--okbg)">🧾</div>
            <div class="qa-label">New Sale</div>
          </div>
          <div class="qa-btn" onclick="Products.openAddModal()">
            <div class="qa-icon" style="background:var(--goldbg)">📦</div>
            <div class="qa-label">Add Product</div>
          </div>
          <div class="qa-btn" onclick="Customers.openAddModal()">
            <div class="qa-icon" style="background:var(--infobg)">👤</div>
            <div class="qa-label">Add Customer</div>
          </div>
          <div class="qa-btn" onclick="Expenses.openAddModal()">
            <div class="qa-icon" style="background:var(--errbg)">💸</div>
            <div class="qa-label">Add Expense</div>
          </div>
          <div class="qa-btn" onclick="Router.go('reports')">
            <div class="qa-icon" style="background:var(--warnbg)">📊</div>
            <div class="qa-label">Reports</div>
          </div>
          <div class="qa-btn" onclick="Router.go('ai')">
            <div class="qa-icon" style="background:var(--goldbg)">🤖</div>
            <div class="qa-label">AI Assistant</div>
          </div>
        </div>
      </div>

      <!-- Weekly Chart -->
      <div class="sec">
        <div class="chart-wrap">
          <div class="chart-title">This Week's Revenue</div>
          <div class="chart-sub">${cur} daily breakdown</div>
          ${Charts.weekBars(sales)}
        </div>
      </div>

      <!-- Stock Alerts -->
      ${s.lowStock.length > 0 || s.outStock.length > 0 ? `
      <div class="sec">
        <div class="sec-title">⚠️ Stock Alerts <span class="sec-link" onclick="Router.go('products')">View All</span></div>
        <div class="card">
          ${[...s.outStock.slice(0,3), ...s.lowStock.slice(0,3)].map(p=>`
          <div class="list-item" onclick="Router.go('products')">
            <div class="list-icon" style="background:${p.qty===0?'var(--errbg)':'var(--warnbg)'}">${p.qty===0?'🚫':'⚠️'}</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(p.name)}</div>
              <div class="list-meta">${p.sku||'—'} · ${p.category||'—'}</div>
              <div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:${Math.min(100,Math.max(3,Utils.pct(p.qty,(p.lowLevel||5)*3)))}%;background:${p.qty===0?'var(--err)':'var(--warn)'}"></div></div></div>
            </div>
            <div class="list-right">
              ${Utils.statusBadge(p.qty===0?'Out of Stock':'Low Stock')}
              <div style="font-size:12px;color:var(--text2);margin-top:4px">${p.qty} left</div>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Recent Sales -->
      <div class="sec">
        <div class="sec-title">Recent Sales <span class="sec-link" onclick="Router.go('sales')">View All</span></div>
        ${sales.length > 0 ? `<div class="card">${sales.slice(0,5).map(s=>`
          <div class="list-item">
            <div class="list-icon" style="background:var(--goldbg)">🧾</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(s.customer||'Walk-in')}</div>
              <div class="list-meta">${s.id} · ${Utils.date(s.date)}</div>
            </div>
            <div class="list-right">
              <div class="list-val">${Utils.cur(s.total,cur)}</div>
              <div style="margin-top:3px">${Utils.statusBadge(s.status||'Paid')}</div>
            </div>
          </div>`).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No sales yet</div><div class="empty-sub">Tap "New Sale" to get started</div></div>'}
      </div>
    `;
  },
};
