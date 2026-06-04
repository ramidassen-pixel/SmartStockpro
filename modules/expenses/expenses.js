var Expenses = {
  render() {
    const pg = Utils.get('pg-expenses');
    if (!pg) return;
    const list = DB.getExpenses();
    const settings = DB.getSettings();
    const cur = settings.currency||'$';
    const month = Utils.today().slice(0,7);
    const thisMonth = list.filter(e=>e.date&&e.date.startsWith(month));
    const total = thisMonth.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
    const cats = {};
    thisMonth.forEach(e=>{ cats[e.category]=(cats[e.category]||0)+(parseFloat(e.amount)||0); });
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Expenses</div>
          <div class="page-sub">${thisMonth.length} this month · ${Utils.cur(total,cur)} total</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Expenses.openAddModal()">+ Add</button>
        </div>
      </div>
      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--err);--kibg:var(--errbg)">
            <div class="kpi-icon">💸</div><div class="kpi-label">This Month</div>
            <div class="kpi-value">${Utils.cur(total,cur)}</div>
            <div class="kpi-sub">${thisMonth.length} expenses</div>
          </div>
          <div class="kpi" style="--kc:var(--warn);--kibg:var(--warnbg)">
            <div class="kpi-icon">📋</div><div class="kpi-label">Categories</div>
            <div class="kpi-value">${Object.keys(cats).length}</div>
            <div class="kpi-sub">Different types</div>
          </div>
        </div>
        ${Object.keys(cats).length ? `
        <div class="chart-wrap">
          <div class="chart-title">By Category</div>
          <div class="chart-sub">Monthly breakdown</div>
          ${Charts.bar(Object.values(cats), Object.keys(cats), 'ok')}
        </div>` : ''}
        <div class="sec-title">All Expenses <span class="sec-link" onclick="Expenses.openAddModal()">+ Add</span></div>
        ${list.length ? `<div class="card">${list.map(e=>`
          <div class="list-item">
            <div class="list-icon" style="background:var(--errbg)">💸</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(e.description||e.category)}</div>
              <div class="list-meta">${e.category} · ${Utils.date(e.date)} ${e.recurring?'· 🔄 Recurring':''}</div>
            </div>
            <div class="list-right">
              <div class="list-val" style="color:var(--err)">${Utils.cur(e.amount,cur)}</div>
              <div class="list-actions">
                <button class="btn-danger btn-sm btn-icon" onclick="Expenses.del('${e.id}')">🗑</button>
              </div>
            </div>
          </div>`).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">💸</div><div class="empty-title">No expenses yet</div></div>'}
      </div>`;
  },
  openAddModal() {
    Modal.open({ title:'Add Expense', barColor:'var(--err)',
      body:`
        <div class="form-row">
          <div class="fg"><label class="fl">Category *</label>
            <select class="fi" id="ef-cat"><option>Rent</option><option>Utilities</option><option>Salaries</option><option>Marketing</option><option>Maintenance</option><option>Transport</option><option>Insurance</option><option>Stock Purchase</option><option>Other</option></select></div>
          <div class="fg"><label class="fl">Amount *</label>
            <input class="fi" id="ef-amt" type="number" step="0.01" placeholder="0.00"></div>
        </div>
        <div class="fg"><label class="fl">Description</label>
          <input class="fi" id="ef-desc" placeholder="What was this expense for?"></div>
        <div class="form-row">
          <div class="fg"><label class="fl">Date</label>
            <input class="fi" id="ef-date" type="date" value="${Utils.today()}"></div>
          <div class="fg"><label class="fl">Recurring?</label>
            <select class="fi" id="ef-rec"><option value="0">No</option><option value="1">Yes — Monthly</option></select></div>
        </div>`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Expenses.save()">💾 Save</button>` });
  },
  save() {
    const amt = parseFloat(Utils.val('ef-amt')||0);
    if (!amt) { Toast.show('Amount is required','err'); return; }
    DB.addExpense({ category:Utils.get('ef-cat')?.value||'Other', description:Utils.val('ef-desc'), amount:amt, date:Utils.val('ef-date')||Utils.today(), recurring:!!parseInt(Utils.val('ef-rec')||'0') });
    Toast.show('Expense saved ✓','ok'); Modal.close(); this.render();
  },
  del(id) { confirmDel('Delete this expense?', ()=>{ DB.deleteExpense(id); Toast.show('Deleted','warn'); this.render(); }); },
};
