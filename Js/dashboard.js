/* SmartStock Pro — Dashboard Page */
const Dashboard = {
  render() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back — business at a glance</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm">${Components.icon('download',13)} Export</button>
          <button class="btn btn-primary btn-sm" onclick="Router.navigate('dashboard')">${Components.icon('refresh',13)} Refresh</button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="grid g-4 mb-4" id="kpi-row"></div>

      <!-- Charts + Activity -->
      <div class="grid g-1-2 mb-4">
        <div class="card card-accent-gold animate-in">
          <div class="flex items-center justify-between mb-3">
            <div><div class="font-display" style="font-size:13px;font-weight:600">Revenue Overview</div>
              <div class="text-sec text-sm">Monthly performance</div></div>
          </div>
          <div id="revenue-chart"></div>
        </div>
        <div class="card animate-in">
          <div class="font-display mb-3" style="font-size:13px;font-weight:600">Recent Activity</div>
          <div id="activity-list"></div>
        </div>
      </div>

      <!-- Profit + Stock Alerts -->
      <div class="grid g-2-1 mb-4">
        <div class="card card-accent-success animate-in">
          <div class="flex items-center justify-between mb-3">
            <div><div class="font-display" style="font-size:13px;font-weight:600">Profit Trend</div>
              <div class="text-sec text-sm">Net profit by month</div></div>
            <span class="text-success font-bold" style="font-size:20px">$65.4K</span>
          </div>
          <div id="profit-chart"></div>
        </div>
        <div class="card animate-in">
          <div class="font-display mb-3" style="font-size:13px;font-weight:600">⚠️ Stock Alerts</div>
          <div id="stock-alerts"></div>
          <button class="btn btn-ghost btn-sm w-full mt-3" onclick="Router.navigate('inventory')">View All Inventory</button>
        </div>
      </div>

      <!-- Recent Sales -->
      <div class="card animate-in" style="padding:0;overflow:hidden">
        <div class="table-toolbar">
          <span class="font-display" style="font-size:13px;font-weight:600">Recent Invoices</span>
          <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="Router.navigate('sales')">View All</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Invoice</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
          <tbody id="recent-sales"></tbody>
        </table></div>
      </div>`;

    // KPIs
    Utils.render('#kpi-row', MockData.kpis.map(k=>Components.kpiCard(k)).join(''));
    // Charts
    Utils.render('#revenue-chart', Components.barChart(MockData.chartRevenue, MockData.chartLabels));
    Utils.render('#profit-chart',  Components.lineChart(MockData.chartProfit, MockData.chartLabels,'var(--color-success)'));
    // Activity
    Utils.render('#activity-list', MockData.activity.map(a=>`
      <div class="activity-item">
        <span class="activity-icon">${a.icon}</span>
        <div><div class="activity-text truncate">${Utils.esc(a.text)}</div>
        <div class="activity-time">${a.time}</div></div>
      </div>`).join(''));
    // Stock alerts
    const alerts = MockData.inventory.filter(p=>p.status!=='In Stock');
    Utils.render('#stock-alerts', alerts.map(p=>`
      <div class="stock-alert-item">
        <div class="stock-alert-name truncate">${Utils.esc(p.name)}</div>
        <div class="stock-alert-meta">
          ${Components.progressBar(Math.max(5,(p.qty/p.low)*100), p.qty===0?'var(--color-error)':'var(--color-warning)')}
          ${Components.badge(p.status)}
        </div>
        <div class="text-xs text-sec mt-1">${p.qty} / ${p.low} minimum</div>
      </div>`).join(''));
    // Recent sales
    Utils.render('#recent-sales', MockData.sales.slice(0,5).map(s=>`
      <tr>
        <td><span class="font-mono text-gold text-xs">${s.id}</span></td>
        <td style="font-weight:500">${Utils.esc(s.customer)}</td>
        <td class="text-sec">${s.items}</td>
        <td style="font-weight:700">${Utils.currency(s.total)}</td>
        <td>${Components.badge(s.status)}</td>
        <td class="text-sec text-sm">${s.date}</td>
      </tr>`).join(''));
  },
};
