const Reports = {
  render() {
    const sales = DB.sales();
    const expenses = DB.expenses();
    const revenue = sales.reduce((a,s)=>a+s.total,0);
    const collected = sales.filter(s=>s.paid).reduce((a,s)=>a+s.total,0);
    const totalExp = expenses.reduce((a,e)=>a+e.amount,0);
    const cogs = revenue * 0.54;
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - totalExp;
    const row=(label,val,pos,bold)=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--bd);font-weight:${bold?800:400};font-size:${bold?14:13}px">
        <span style="color:${bold?'var(--t1)':'var(--t2)'}">${label}</span>
        <span style="color:${pos?'var(--ok)':'var(--er)'};font-family:var(--fm)">${val}</span>
      </div>`;
    const html = `
<div class="sec">
  <div class="sh">Financial Reports</div>
  <!-- P&L -->
  <div class="card" style="padding:16px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;margin-bottom:14px">📊 Profit & Loss — This Month</div>
    ${row('Gross Revenue',       Utils.cur(revenue),     true,  false)}
    ${row('Cost of Goods Sold',  '('+Utils.cur(cogs)+')',false, false)}
    ${row('Gross Profit',        Utils.cur(grossProfit), true,  false)}
    ${row('Operating Expenses',  '('+Utils.cur(totalExp)+')', false, false)}
    ${row('NET PROFIT',          Utils.cur(netProfit),   netProfit>=0, true)}
  </div>
  <!-- Cash Flow -->
  <div class="card" style="padding:16px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;margin-bottom:14px">💵 Cash Flow</div>
    ${row('Opening Balance',     Utils.cur(32400),       true,  false)}
    ${row('Cash Collected',      Utils.cur(collected),   true,  false)}
    ${row('Cash Out (Expenses)', '('+Utils.cur(totalExp)+')', false, false)}
    ${row('Closing Balance',     Utils.cur(32400+collected-totalExp), true, true)}
  </div>
  <!-- Quarterly -->
  <div class="card" style="padding:16px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;margin-bottom:14px">📅 Quarterly Overview 2024</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${['Q1','Q2','Q3','Q4'].map((q,i)=>`
      <div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r10);padding:13px">
        <div style="font-size:9px;color:var(--t3);font-family:var(--fm);margin-bottom:5px">${q} 2024</div>
        <div style="font-size:20px;font-weight:900;color:var(--g)">$${[62,78,84,91][i]}K</div>
        <div style="font-size:10px;color:var(--ok);margin-top:3px">▲ ${[8,12,18,22][i]}% YoY</div>
      </div>`).join('')}
    </div>
  </div>
  <!-- Expenses breakdown -->
  <div class="act-card">
    <div class="act-head"><div style="font-size:13px;font-weight:700">Expense Breakdown</div></div>
    ${expenses.map(e=>`
    <div class="act-item">
      <div class="act-dot" style="background:var(--erb)">💸</div>
      <div class="act-body">
        <div class="act-name">${Utils.esc(e.description)}</div>
        <div class="act-meta">${e.category} · ${e.date} ${e.recurring?'· <span style="color:var(--wa)">Recurring</span>':''}</div>
      </div>
      <div class="act-right">
        <div class="act-amount c-er">${Utils.cur(e.amount)}</div>
        <button class="act-btn danger" style="margin-top:5px" onclick="Expenses.delete('${e.id}')">🗑</button>
      </div>
    </div>`).join('')}
  </div>
</div>`;
    Utils.set('pg-reports', html);
  },
};

const Expenses = {
  save(action) {
    const amt = parseFloat(Utils.val('ef-amt')||0);
    if(!amt){Toast.show('Amount is required','er');return;}
    DB.addExpense({
      category:document.getElementById('ef-cat')?.value||'Other',
      description:Utils.val('ef-desc'),
      amount:amt, date:Utils.val('ef-date')||Utils.today(),
      recurring:!!parseInt(Utils.val('ef-rec')||'0'),
    });
    Toast.show('Expense saved ✓','ok');
    ['ef-amt','ef-desc'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    if(action==='addnew'){return;}
    closeD('d-expense');
    if(App.page==='reports') Reports.render();
  },
  delete(id){
    App.confirm('Delete Expense','Remove this expense record?','💸',()=>{
      DB.deleteExpense(id);
      Toast.show('Expense deleted','wa');
      Reports.render();
    });
  },
};