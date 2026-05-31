/* SmartStock Pro — Analytics Page */
const Analytics = {
  render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Analytics</h1>
          <p class="page-subtitle">Deep-dive business intelligence</p></div>
        <div class="tabs">
          ${['12 Months','6 Months','30 Days'].map((t,i)=>`<div class="tab${i===0?' active':''}">${t}</div>`).join('')}
        </div>
      </div>
      <div class="grid g-4 mb-4">
        ${[
          {label:'Avg Order Value',    val:'$420',  trend:'+5.2%', color:'var(--color-gold)'  },
          {label:'Customer LTV',       val:'$3,840',trend:'+11.8%',color:'var(--color-info)'  },
          {label:'Inventory Turnover', val:'4.2x',  trend:'+0.4x', color:'var(--color-success)'},
          {label:'Gross Margin',       val:'47.2%', trend:'+1.3%', color:'var(--color-purple)' },
        ].map(k=>`<div class="kpi-card animate-in" style="--kpi-color:${k.color};--kpi-bg:${k.color}22">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value" style="color:${k.color};font-size:22px">${k.val}</div>
          <div class="kpi-change up">${k.trend}</div></div>`).join('')}
      </div>
      <div class="grid g-1-2 mb-4">
        <div class="card animate-in">
          <div class="font-display mb-1" style="font-size:13px;font-weight:600">Revenue Trend</div>
          <div class="text-sec text-sm mb-3">12-month</div>
          ${Components.lineChart(MockData.chartRevenue, MockData.chartLabels,'var(--color-gold)')}
          ${Components.lineChart(MockData.chartProfit,  MockData.chartLabels,'var(--color-success)')}
        </div>
        <div class="card animate-in">
          <div class="font-display mb-3" style="font-size:13px;font-weight:600">Top Products</div>
          ${MockData.inventory.slice(0,5).map((p,i)=>`
          <div style="margin-bottom:12px">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm truncate" style="max-width:65%">${Utils.esc(p.name)}</span>
              <span class="text-gold text-sm font-bold">${Utils.currency(p.price*(70-i*10))}</span>
            </div>
            ${Components.progressBar(70-i*12)}</div>`).join('')}
        </div>
      </div>
      <div class="card animate-in">
        <div class="font-display mb-3" style="font-size:13px;font-weight:600">Category Revenue</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${['Tiles','Mosaic','Paving','Stone','Adhesives'].map((cat,i)=>`
          <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:10px;padding:12px 16px;flex:1;min-width:110px">
            <div class="text-sec text-xs mb-1">${cat}</div>
            <div style="font-size:18px;font-weight:700;color:${['var(--color-gold)','var(--color-info)','var(--color-success)','var(--color-purple)','var(--color-warning)'][i]}">$${[42,28,18,12,8][i]}K</div>
            <div class="text-success text-xs mt-1">▲ ${[18,12,8,22,5][i]}%</div>
          </div>`).join('')}
        </div>
      </div>`;
  },
};
