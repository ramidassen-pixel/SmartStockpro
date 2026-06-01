/* SmartStock Pro — Sales Page */
const Sales = {
  async render() {
    const sales = await DB.getSales();
    const collected = sales.filter(s=>s.paid).reduce((a,s)=>a+s.total,0);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Sales & Invoices</h1>
          <p class="page-subtitle">${sales.length} invoices · ${Utils.currency(collected)} collected</p></div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm">${Components.icon('filter',13)} Filter</button>
          <button class="btn btn-primary btn-sm" onclick="Sales.openNewInvoice()">${Components.icon('plus',13)} New Invoice</button>
        </div>
      </div>
      <div class="grid g-4 mb-4">
        ${[
          {label:'Total Invoiced',val:Utils.currency(sales.reduce((a,s)=>a+s.total,0)),color:'var(--color-gold)'},
          {label:'Collected',     val:Utils.currency(collected),color:'var(--color-success)'},
          {label:'Pending',       val:sales.filter(s=>s.status==='Pending').length,color:'var(--color-warning)'},
          {label:'Overdue',       val:sales.filter(s=>s.status==='Overdue').length, color:'var(--color-error)'},
        ].map(k=>`<div class="kpi-card animate-in" style="--kpi-color:${k.color};--kpi-bg:${k.color}22">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value" style="color:${k.color};font-size:22px">${k.val}</div></div>`).join('')}
      </div>
      <div class="card animate-in" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table>
          <thead><tr><th>Invoice</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>${sales.map(s=>`<tr>
            <td><span class="font-mono text-gold text-xs">${s.id}</span></td>
            <td style="font-weight:500">${Utils.esc(s.customer)}</td>
            <td class="text-sec">${s.items} items</td>
            <td style="font-weight:700">${Utils.currency(s.total)}</td>
            <td>${Components.badge(s.status)}</td>
            <td class="text-sec text-sm">${s.date}</td>
            <td><div class="flex gap-2">
              <button class="btn btn-icon btn-ghost btn-sm" title="Print" onclick="window.print()">${Components.icon('print',13)}</button>
              <button class="btn btn-icon btn-ghost btn-sm" title="View">${Components.icon('eye',13)}</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  },

  openNewInvoice() {
    const custs = MockData.customers.map(c=>`<option>${Utils.esc(c.name)}</option>`).join('');
    const prods = MockData.inventory.map(p=>`<option>${Utils.esc(p.name)} — ${Utils.currency(p.price)}</option>`).join('');
    Components.openModal(Components.modal({id:'sale-modal',title:'Create New Invoice',
      body:`<div class="flex flex-col gap-3">
        <div class="form-group"><label class="form-label">Customer</label>
          <select class="form-select" id="s-cust">${custs}</select></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Invoice Date</label>
            <input class="form-input" type="date" id="s-date" value="${new Date().toISOString().slice(0,10)}"/></div>
          <div class="form-group"><label class="form-label">Due Date</label>
            <input class="form-input" type="date" id="s-due"/></div>
        </div>
        <div class="form-group"><label class="form-label">Products</label>
          <select class="form-select" id="s-prod">${prods}</select></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Discount %</label>
            <input class="form-input" type="number" id="s-disc" value="0"/></div>
          <div class="form-group"><label class="form-label">Tax %</label>
            <input class="form-input" type="number" id="s-tax" value="${CONFIG.company.tax}"/></div>
        </div>
        <div class="form-group"><label class="form-label">Notes</label>
          <input class="form-input" id="s-notes" placeholder="Optional notes..."/></div>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Components.closeModal('sale-modal')">Cancel</button>
              <button class="btn btn-primary" onclick="Sales.createInvoice()">${Components.icon('check',13)} Create Invoice</button>`}));
  },

  async createInvoice() {
    await DB.addSale({
      customer: Utils.$('#s-cust')?.value,
      date:     Utils.$('#s-date')?.value,
      items: 1, total: Math.random()*2000+200,
      paid: false, status:'Pending',
    });
    Toast.show('Invoice created','success');
    Components.closeModal('sale-modal');
    this.render();
  },
};
