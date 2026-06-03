const HomePage = {
  render() {
    const prods = DB.products();
    const sales = DB.sales();
    const expenses = DB.expenses();
    const revenue = sales.reduce((a,s)=>a+s.total,0);
    const collected = sales.filter(s=>s.paid).reduce((a,s)=>a+s.total,0);
    const totalExp = expenses.reduce((a,e)=>a+e.amount,0);
    const profit = collected - totalExp;
    const lowStock = prods.filter(p=>p.status!=='In Stock').length;
    const margin = revenue>0 ? Math.round((profit/revenue)*100) : 0;
    const grossPct = revenue>0 ? Math.round((collected/revenue)*100) : 0;
    const expPct = revenue>0 ? Math.round((totalExp/revenue)*100) : 0;
    const netPct = Math.max(0, grossPct - expPct);
    const netColor = profit>=0 ? 'var(--ok)' : 'var(--er)';
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = new Date().getDay();
    const weekVals = [42,68,55,80,70,92,76];
    const maxW = Math.max(...weekVals);

    const html = `
<div class="sec">
  <!-- HERO NET -->
  <div class="hero-net">
    <div class="hero-net-lbl">NET PROFIT · THIS MONTH</div>
    <div class="hero-net-val" style="color:${netColor}">${Utils.cur(profit)}</div>
    <div class="hero-net-meta">
      <div class="hero-net-chip">Revenue <span class="c-ok">${Utils.cur(revenue)}</span></div>
      <div class="hero-net-chip">Expenses <span class="c-er">${Utils.cur(totalExp)}</span></div>
      <div class="hero-net-chip" style="margin-left:auto;padding:3px 10px;border-radius:99px;font-family:var(--fm);font-size:11px;font-weight:700;border:1px solid ${netColor};color:${netColor}">${margin}% margin</div>
    </div>
    <div class="profit-bar-wrap">
      <div class="profit-bar-track">
        <div class="profit-bar-gross" style="width:${grossPct}%"></div>
        <div class="profit-bar-exp" style="width:${expPct}%"></div>
        <div class="profit-bar-net" style="width:${netPct}%;background:${netColor}"></div>
      </div>
    </div>
  </div>

  <!-- KPI CARDS -->
  <div class="kgrid">
    ${[
      {label:'Revenue',val:Utils.cur(revenue),icon:'💰',color:'var(--g)',   sub:'Total this month'},
      {label:'Collected',val:Utils.cur(collected),icon:'✅',color:'var(--ok)',sub:sales.filter(s=>s.paid).length+' invoices paid'},
      {label:'Expenses',val:Utils.cur(totalExp),icon:'📉',color:'var(--er)',sub:'Operating costs'},
      {label:'Stock Alerts',val:lowStock,icon:'⚠️',color:'var(--wa)',sub:prods.filter(p=>p.status==='Out of Stock').length+' out of stock'},
    ].map(k=>`
    <div class="kcard" style="--kc:${k.color}" onclick="App.nav('${k.label==='Stock Alerts'?'inventory':'reports'}')">
      <div class="kcard-icon" style="background:${k.color}18">${k.icon}</div>
      <div class="kcard-lbl">${k.label}</div>
      <div class="kcard-val">${k.val}</div>
      <div class="kcard-sub">${k.sub}</div>
      <div class="kcard-glow"></div>
    </div>`).join('')}
  </div>

  <!-- WEEK CHART -->
  <div class="chart-card">
    <div class="chart-header">
      <div><div class="chart-title">This Week's Revenue</div><div class="chart-sub">Daily breakdown</div></div>
      <div><div class="chart-total-val">${Utils.cur(weekVals.reduce((a,v)=>a+v*100,0))}</div><div style="font-size:9px;color:var(--t3);font-family:var(--fm);margin-top:2px">7-DAY TOTAL</div></div>
    </div>
    <div class="week-bars">
      ${weekVals.map((v,i)=>`
      <div class="week-bar-col">
        <div class="week-bar-fill ${i===today?'today':'past'}" style="height:${Math.round((v/maxW)*100)}%"></div>
        <div class="week-bar-lbl" style="color:${i===today?'var(--g)':'var(--t4)'}">${days[i]}</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- QUICK ACTIONS -->
  <div class="sh">Quick Actions</div>
  <div class="qa-grid">
    ${[
      {icon:'🧾',label:'New Invoice',  bg:'var(--okb)',  action:"openD('d-sale');Sales.initForm()"},
      {icon:'📦',label:'Add Product',  bg:'var(--gd)',   action:"openD('d-product');Inventory.clearForm()"},
      {icon:'👤',label:'Add Customer', bg:'var(--inb)',  action:"openD('d-customer');Customers.clearForm()"},
      {icon:'💸',label:'Add Expense',  bg:'var(--erb)',  action:"openD('d-expense')"},
      {icon:'📊',label:'Reports',      bg:'var(--pub)',  action:"App.nav('reports')"},
      {icon:'🤖',label:'AI Assistant', bg:'var(--teb)',  action:"App.nav('ai')"},
    ].map(q=>`
    <div class="qa-btn" onclick="${q.action}">
      <div class="qa-icon" style="background:${q.bg}">${q.icon}</div>
      <div class="qa-lbl">${q.label}</div>
    </div>`).join('')}
  </div>
</div>

<!-- ACTIVITY -->
<div class="sec">
  <div class="act-card">
    <div class="act-head">
      <div style="font-size:13px;font-weight:700">Recent Activity</div>
      <span class="sl" onclick="App.nav('sales')">See all</span>
    </div>
    ${sales.slice(0,5).map(s=>`
    <div class="act-item" onclick="App.nav('sales')">
      <div class="act-dot" style="background:var(--gd)">🧾</div>
      <div class="act-body">
        <div class="act-name">${Utils.esc(s.customer)}</div>
        <div class="act-meta">${s.id} · ${s.date}</div>
      </div>
      <div class="act-right">
        <div class="act-amount c-g">${Utils.cur(s.total)}</div>
        <div class="act-time">${Utils.statusBadge(s.status)}</div>
      </div>
    </div>`).join('')}
  </div>

  <!-- STOCK ALERTS -->
  ${prods.filter(p=>p.status!=='In Stock').length ? `
  <div class="act-card">
    <div class="act-head">
      <div style="font-size:13px;font-weight:700">⚠️ Stock Alerts</div>
      <span class="sl" onclick="App.nav('inventory')">Manage</span>
    </div>
    ${prods.filter(p=>p.status!=='In Stock').map(p=>`
    <div class="act-item" onclick="App.nav('inventory')">
      <div class="act-dot" style="background:${p.qty===0?'var(--erb)':'var(--wab)'}">${p.qty===0?'🚫':'⚠️'}</div>
      <div class="act-body">
        <div class="act-name">${Utils.esc(p.name)}</div>
        <div style="margin-top:5px"><div class="prog-bar"><div class="prog-fill" style="width:${Math.max(3,Math.round((p.qty/p.low)*100))}%;background:${p.qty===0?'var(--er)':'var(--wa)'}"></div></div></div>
        <div class="act-meta">${p.qty} units remaining · min ${p.low}</div>
      </div>
      <div class="act-right">${Utils.statusBadge(p.status)}</div>
    </div>`).join('')}
  </div>` : ''}
</div>`;

    Utils.set('pg-home', html);
  }
};