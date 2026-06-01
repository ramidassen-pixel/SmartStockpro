/* SmartStock Pro — Suppliers Page */
const Suppliers = {
  async render() {
    const list = await DB.getSuppliers();
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Suppliers</h1>
          <p class="page-subtitle">${list.length} suppliers</p></div>
        <button class="btn btn-primary btn-sm" onclick="Suppliers.openAddModal()">${Components.icon('plus',13)} Add Supplier</button>
      </div>
      <div class="card animate-in" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Supplier</th><th>Contact</th><th>Email</th><th>Phone</th><th>Balance</th><th>Orders</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${list.map(s=>`<tr>
            <td><span class="font-mono text-gold text-xs">${s.id}</span></td>
            <td style="font-weight:600">${Utils.esc(s.name)}</td>
            <td class="text-sec">${s.contact}</td>
            <td class="text-sec text-sm">${Utils.esc(s.email)}</td>
            <td class="text-sec text-sm">${s.phone}</td>
            <td style="color:${s.balance>0?'var(--color-error)':'var(--color-success)'};font-weight:600">${s.balance>0?Utils.currency(s.balance):'Clear'}</td>
            <td>${s.orders}</td>
            <td>${Components.badge(s.status)}</td>
            <td><div class="flex gap-2">
              <button class="btn btn-icon btn-ghost btn-sm">${Components.icon('eye',13)}</button>
              <button class="btn btn-icon btn-ghost btn-sm">${Components.icon('edit',13)}</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  },

  openAddModal() {
    Components.openModal(Components.modal({id:'sup-modal',title:'Add Supplier',
      body:`<div class="flex flex-col gap-3">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Company Name</label><input class="form-input" id="sp-name" placeholder="Supplier Co."/></div>
          <div class="form-group"><label class="form-label">Contact Person</label><input class="form-input" id="sp-contact"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" id="sp-email"/></div>
          <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="sp-phone"/></div>
        </div>
        <div class="form-group"><label class="form-label">Country / Address</label><input class="form-input" id="sp-addr"/></div>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Components.closeModal('sup-modal')">Cancel</button>
              <button class="btn btn-primary" onclick="Suppliers.save()">${Components.icon('check',13)} Save</button>`}));
  },

  async save() {
    const name = Utils.$('#sp-name')?.value;
    if (!name) { Toast.show('Name required','error'); return; }
    await DB.addSupplier({ name, contact:Utils.$('#sp-contact')?.value, email:Utils.$('#sp-email')?.value, phone:Utils.$('#sp-phone')?.value, balance:0, orders:0, status:'Active' });
    Toast.show('Supplier added','success');
    Components.closeModal('sup-modal');
    this.render();
  },
};
