'use strict';
const Customers = {
  editId: null,
  render() {
    const pg = Utils.get('pg-customers');
    if (!pg) return;
    const list = DB.getCustomers();
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Customers</div>
          <div class="page-sub">${list.length} customers · ${list.filter(c=>c.status==='VIP').length} VIP</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Customers.openAddModal()">+ Add</button>
        </div>
      </div>
      <div class="sec">
        ${list.length ? `<div class="card">${list.map(c=>`
          <div class="list-item">
            <div class="list-icon" style="background:var(--infobg);font-size:18px;font-weight:800;color:var(--info)">${(c.name||'?')[0].toUpperCase()}</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(c.name)} ${c.status==='VIP'?'<span class="badge badge-gold">VIP</span>':''}</div>
              <div class="list-meta">${c.phone||'—'} · ${c.email||'—'}</div>
              <div class="list-meta">${c.purchases||0} purchases · ${Utils.cur(c.totalSpent||0,cur)} total</div>
              ${(c.credit||0)>0?`<div style="font-size:11px;color:var(--err);margin-top:2px">Credit: ${Utils.cur(c.credit,cur)}</div>`:''}
            </div>
            <div class="list-right">
              <div class="list-actions">
                <button class="btn-ghost btn-sm btn-icon" onclick="Customers.openEditModal('${c.id}')">✏️</button>
                <button class="btn-danger btn-sm btn-icon" onclick="Customers.del('${c.id}','${Utils.esc(c.name)}')">🗑</button>
              </div>
            </div>
          </div>`).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">👥</div><div class="empty-title">No customers yet</div><div class="empty-sub">Add your first customer to get started</div></div>'}
      </div>`;
  },
  openAddModal() {
    this.editId = null;
    Modal.open({ title:'Add Customer', body:this._form(), barColor:'var(--info)',
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Customers.save()">💾 Save</button>` });
  },
  openEditModal(id) {
    this.editId = id;
    const c = DB.getCustomers().find(x=>x.id===id);
    if (!c) return;
    Modal.open({ title:'Edit Customer', sub:c.name, body:this._form(c), barColor:'var(--info)',
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Customers.save()">💾 Update</button>` });
  },
  _form(c) {
    c = c||{};
    return `
      <div class="form-row">
        <div class="fg"><label class="fl">Full Name *</label><input class="fi" id="cf-name" value="${Utils.esc(c.name||'')}" placeholder="John Doe"></div>
        <div class="fg"><label class="fl">Phone</label><input class="fi" id="cf-phone" value="${Utils.esc(c.phone||'')}" placeholder="+1 555-0000" type="tel"></div>
      </div>
      <div class="fg"><label class="fl">Email</label><input class="fi" id="cf-email" value="${Utils.esc(c.email||'')}" type="email" placeholder="email@example.com"></div>
      <div class="form-row">
        <div class="fg"><label class="fl">Status</label>
          <select class="fi" id="cf-status"><option${(c.status||'Active')==='Active'?' selected':''}>Active</option><option${c.status==='VIP'?' selected':''}>VIP</option><option${c.status==='Inactive'?' selected':''}>Inactive</option></select></div>
        <div class="fg"><label class="fl">Credit Limit</label><input class="fi" id="cf-credit" type="number" value="${c.credit||0}" min="0"></div>
      </div>
      <div class="fg"><label class="fl">Address</label><input class="fi" id="cf-addr" value="${Utils.esc(c.address||'')}" placeholder="Street, City"></div>`;
  },
  save() {
    const name = Utils.val('cf-name');
    if (!name) { Toast.show('Name is required','err'); return; }
    const data = { name, phone:Utils.val('cf-phone'), email:Utils.val('cf-email'), address:Utils.val('cf-addr'), credit:parseFloat(Utils.val('cf-credit')||0), status:Utils.get('cf-status')?.value||'Active' };
    if (this.editId) { DB.updateCustomer(this.editId, data); Toast.show('Customer updated ✓','ok'); }
    else { DB.addCustomer(data); Toast.show('Customer added ✓','ok'); }
    Modal.close(); this.render();
  },
  del(id, name) { confirmDel(`Delete "${name}"?`, ()=>{ DB.deleteCustomer(id); Toast.show('Deleted','warn'); this.render(); }); },
};
