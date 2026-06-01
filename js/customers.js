/* SmartStock Pro — Customers Page */
const Customers = {
  async render() {
    const list = await DB.getCustomers();
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Customers</h1>
          <p class="page-subtitle">${list.length} registered · ${list.filter(c=>c.status==='VIP').length} VIP</p></div>
        <button class="btn btn-primary btn-sm" onclick="Customers.openAddModal()">${Components.icon('plus',13)} Add Customer</button>
      </div>
      <div class="grid g-3 mb-4">
        ${[
          {label:'Total Customers',val:list.length,                                  color:'var(--color-info)'   },
          {label:'With Credit',    val:list.filter(c=>c.credit>0).length,            color:'var(--color-warning)'},
          {label:'VIP Accounts',   val:list.filter(c=>c.status==='VIP').length,      color:'var(--color-gold)'   },
        ].map(k=>`<div class="kpi-card animate-in" style="--kpi-color:${k.color};--kpi-bg:${k.color}22">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value" style="color:${k.color};font-size:24px">${k.val}</div></div>`).join('')}
      </div>
      <div class="card animate-in" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Credit</th><th>Purchases</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${list.map(c=>`<tr>
            <td><span class="font-mono text-gold text-xs">${c.id}</span></td>
            <td style="font-weight:600">${Utils.esc(c.name)}</td>
            <td class="text-sec text-sm">${Utils.esc(c.email)}</td>
            <td class="text-sec text-sm">${c.phone}</td>
            <td style="color:${c.credit>0?'var(--color-warning)':'var(--color-text-sec)'}">${c.credit>0?Utils.currency(c.credit):'—'}</td>
            <td>${c.purchases}</td>
            <td class="text-success font-bold">${Utils.currency(c.total)}</td>
            <td>${Components.badge(c.status)}</td>
            <td><div class="flex gap-2">
              <button class="btn btn-icon btn-ghost btn-sm">${Components.icon('eye',13)}</button>
              <button class="btn btn-icon btn-ghost btn-sm">${Components.icon('edit',13)}</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  },

  openAddModal() {
    Components.openModal(Components.modal({id:'cust-modal',title:'Add Customer',
      body:`<div class="flex flex-col gap-3">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="c-name" placeholder="John Doe"/></div>
          <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="c-phone" placeholder="+1 555-0000"/></div>
        </div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" id="c-email"/></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Status</label>
            <select class="form-select" id="c-status"><option>Active</option><option>VIP</option><option>Inactive</option></select></div>
          <div class="form-group"><label class="form-label">Credit Limit</label><input class="form-input" type="number" id="c-credit" value="0"/></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="c-addr" placeholder="Street address"/></div>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Components.closeModal('cust-modal')">Cancel</button>
              <button class="btn btn-primary" onclick="Customers.save()">${Components.icon('check',13)} Save</button>`}));
  },

  async save() {
    const name = Utils.$('#c-name')?.value;
    if (!name) { Toast.show('Name required','error'); return; }
    await DB.addCustomer({ name, email:Utils.$('#c-email')?.value, phone:Utils.$('#c-phone')?.value, status:Utils.$('#c-status')?.value, credit:+Utils.$('#c-credit')?.value||0, purchases:0, total:0 });
    Toast.show('Customer added','success');
    Components.closeModal('cust-modal');
    this.render();
  },
};
