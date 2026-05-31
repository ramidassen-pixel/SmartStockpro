/* SmartStock Pro — Expenses Page */
const Expenses = {
  async render() {
    const list = await DB.getExpenses();
    const total = list.reduce((a,e)=>a+e.amount,0);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Expenses</h1>
          <p class="page-subtitle">May 2024 · ${Utils.currency(total)} total</p></div>
        <button class="btn btn-primary btn-sm" onclick="Expenses.openAddModal()">${Components.icon('plus',13)} Add Expense</button>
      </div>
      <div class="grid g-3 mb-4">
        ${[{cat:'Salaries',icon:'👥',pct:60},{cat:'Rent',icon:'🏢',pct:24},{cat:'Other',icon:'📋',pct:16}].map(c=>`
        <div class="card animate-in">
          <div class="flex items-center gap-2 mb-3">
            <span style="font-size:20px">${c.icon}</span>
            <span style="font-weight:600">${c.cat}</span>
            <span class="text-gold font-bold" style="margin-left:auto">${c.pct}%</span>
          </div>${Components.progressBar(c.pct)}</div>`).join('')}
      </div>
      <div class="card animate-in" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Category</th><th>Description</th><th>Amount</th><th>Date</th><th>Recurring</th><th>Actions</th></tr></thead>
          <tbody id="exp-table">${list.map(e=>`<tr>
            <td><span class="font-mono text-gold text-xs">${e.id}</span></td>
            <td><span class="badge badge-info">${Utils.esc(e.category)}</span></td>
            <td>${Utils.esc(e.description)}</td>
            <td style="color:var(--color-error);font-weight:700">${Utils.currency(e.amount)}</td>
            <td class="text-sec text-sm">${e.date}</td>
            <td>${e.recurring?'<span class="badge badge-gold">Yes</span>':'<span class="text-sec text-sm">No</span>'}</td>
            <td><button class="btn btn-icon btn-danger btn-sm" onclick="Expenses.delete('${e.id}')">${Components.icon('trash',13)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  },

  openAddModal() {
    Components.openModal(Components.modal({id:'exp-modal',title:'Add Expense',
      body:`<div class="flex flex-col gap-3">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Category</label>
            <select class="form-select" id="e-cat"><option>Rent</option><option>Utilities</option><option>Salaries</option><option>Marketing</option><option>Maintenance</option><option>Insurance</option><option>Other</option></select></div>
          <div class="form-group"><label class="form-label">Amount ($)</label>
            <input class="form-input" type="number" id="e-amt" placeholder="0.00"/></div>
        </div>
        <div class="form-group"><label class="form-label">Description</label>
          <input class="form-input" id="e-desc" placeholder="Expense description"/></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Date</label>
            <input class="form-input" type="date" id="e-date" value="${new Date().toISOString().slice(0,10)}"/></div>
          <div class="form-group"><label class="form-label">Recurring</label>
            <select class="form-select" id="e-rec"><option value="0">No</option><option value="1">Yes</option></select></div>
        </div>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Components.closeModal('exp-modal')">Cancel</button>
              <button class="btn btn-primary" onclick="Expenses.save()">${Components.icon('check',13)} Save</button>`}));
  },

  async save() {
    const amt = +Utils.$('#e-amt')?.value;
    if (!amt) { Toast.show('Amount required','error'); return; }
    await DB.addExpense({ category:Utils.$('#e-cat')?.value, description:Utils.$('#e-desc')?.value, amount:amt, date:Utils.$('#e-date')?.value, recurring:!!+Utils.$('#e-rec')?.value });
    Toast.show('Expense added','success');
    Components.closeModal('exp-modal');
    this.render();
  },

  async delete(id) {
    if (!confirm('Delete this expense?')) return;
    await DB.deleteExpense(id);
    Toast.show('Expense deleted','warning');
    this.render();
  },
};
