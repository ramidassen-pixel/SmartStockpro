var Suppliers = {
  editId: null,
  render() {
    const pg = Utils.get('pg-suppliers');
    if (!pg) return;
    const list = DB.getSuppliers();
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Suppliers</div>
          <div class="page-sub">${list.length} suppliers</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Suppliers.openAddModal()">+ Add</button>
        </div>
      </div>
      <div class="sec">
        ${list.length ? `<div class="card">${list.map(s=>`
          <div class="list-item">
            <div class="list-icon" style="background:var(--warnbg)">🏭</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(s.name)}</div>
              <div class="list-meta">${s.contact||'—'} · ${s.phone||'—'}</div>
              ${(s.balance||0)>0?`<div style="font-size:11px;color:var(--err)">Owe: ${Utils.cur(s.balance,cur)}</div>`:'<div style="font-size:11px;color:var(--ok)">Balance clear</div>'}
            </div>
            <div class="list-right">
              ${Utils.statusBadge(s.status||'Active')}
              <div class="list-actions">
                <button class="btn-ghost btn-sm btn-icon" onclick="Suppliers.openEditModal('${s.id}')">✏️</button>
                <button class="btn-danger btn-sm btn-icon" onclick="Suppliers.del('${s.id}','${Utils.esc(s.name)}')">🗑</button>
              </div>
            </div>
          </div>`).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">🏭</div><div class="empty-title">No suppliers yet</div><div class="empty-sub">Add your first supplier</div></div>'}
      </div>`;
  },
  openAddModal() {
    this.editId = null;
    Modal.open({ title:'Add Supplier', body:this._form(), barColor:'var(--warn)',
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Suppliers.save()">💾 Save</button>` });
  },
  openEditModal(id) {
    this.editId = id;
    const s = DB.getSuppliers().find(x=>x.id===id);
    if (!s) return;
    Modal.open({ title:'Edit Supplier', sub:s.name, body:this._form(s), barColor:'var(--warn)',
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Suppliers.save()">💾 Update</button>` });
  },
  _form(s) {
    s = s||{};
    return `
      <div class="form-row">
        <div class="fg"><label class="fl">Company Name *</label><input class="fi" id="sf-name" value="${Utils.esc(s.name||'')}" placeholder="Supplier Co."></div>
        <div class="fg"><label class="fl">Contact Person</label><input class="fi" id="sf-contact" value="${Utils.esc(s.contact||'')}" placeholder="John Smith"></div>
      </div>
      <div class="form-row">
        <div class="fg"><label class="fl">Phone</label><input class="fi" id="sf-phone" value="${Utils.esc(s.phone||'')}" type="tel"></div>
        <div class="fg"><label class="fl">Email</label><input class="fi" id="sf-email" value="${Utils.esc(s.email||'')}" type="email"></div>
      </div>
      <div class="form-row">
        <div class="fg"><label class="fl">Outstanding Balance</label><input class="fi" id="sf-bal" type="number" value="${s.balance||0}" min="0"></div>
        <div class="fg"><label class="fl">Status</label>
          <select class="fi" id="sf-status"><option${(s.status||'Active')==='Active'?' selected':''}>Active</option><option${s.status==='Inactive'?' selected':''}>Inactive</option></select></div>
      </div>
      <div class="fg"><label class="fl">Address</label><input class="fi" id="sf-addr" value="${Utils.esc(s.address||'')}" placeholder="Country, City"></div>`;
  },
  save() {
    const name = Utils.val('sf-name');
    if (!name) { Toast.show('Company name is required','err'); return; }
    const data = { name, contact:Utils.val('sf-contact'), phone:Utils.val('sf-phone'), email:Utils.val('sf-email'), address:Utils.val('sf-addr'), balance:parseFloat(Utils.val('sf-bal')||0), status:Utils.get('sf-status')?.value||'Active' };
    if (this.editId) { DB.updateSupplier(this.editId, data); Toast.show('Supplier updated ✓','ok'); }
    else { DB.addSupplier(data); Toast.show('Supplier added ✓','ok'); }
    Modal.close(); this.render();
  },
  del(id, name) { confirmDel(`Delete "${name}"?`, ()=>{ DB.deleteSupplier(id); Toast.show('Deleted','warn'); this.render(); }); },
};
