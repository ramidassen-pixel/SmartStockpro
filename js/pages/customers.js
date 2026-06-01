const Customers = {
  editId: null,
  render() {
    const list = DB.customers();
    const vip = list.filter(c=>c.status==='VIP').length;
    const credit = list.filter(c=>c.credit>0).length;
    const html = `
<div class="sec">
  <div class="sh">Customers <span class="sl" onclick="openD('d-customer');Customers.clearForm()">+ Add</span></div>
  <div class="kgrid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:14px">
    ${[
      {label:'Total',val:list.length,color:'var(--in)',icon:'👥'},
      {label:'VIP',  val:vip,        color:'var(--g)', icon:'⭐'},
      {label:'Credit',val:credit,    color:'var(--wa)',icon:'💳'},
    ].map(k=>`
    <div class="kcard" style="--kc:${k.color};padding:12px 13px">
      <div style="font-size:18px;margin-bottom:8px">${k.icon}</div>
      <div class="kcard-lbl">${k.label}</div>
      <div class="kcard-val" style="font-size:20px">${k.val}</div>
    </div>`).join('')}
  </div>
  <div id="cust-list"></div>
</div>`;
    Utils.set('pg-customers', html);
    this.renderList();
  },

  renderList() {
    const list = DB.customers();
    const html = list.map(c=>`
    <div class="card" style="margin-bottom:10px">
      <div class="list-item">
        <div class="list-icon" style="background:var(--inb);font-size:18px;font-weight:800;color:var(--in)">${c.name[0]}</div>
        <div class="list-info">
          <div class="list-name">${Utils.esc(c.name)} ${Utils.statusBadge(c.status)}</div>
          <div class="list-meta">${c.phone||'—'} · ${c.email||'—'}</div>
          <div class="list-meta" style="margin-top:2px">
            ${c.purchases} purchases · ${Utils.cur(c.total)} total
            ${c.credit>0?`· <span class="c-wa">Credit: ${Utils.cur(c.credit)}</span>`:''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
          <button class="act-btn gold" onclick="Customers.openEdit('${c.id}')">✏️</button>
        </div>
      </div>
    </div>`).join('');
    Utils.set('cust-list', html || '<div class="empty"><div class="ei">👥</div><div class="et">No customers yet</div><div class="es">Add your first customer</div><div class="es-action"><button class="btn bg bsm" onclick="openD(\'d-customer\');Customers.clearForm()">+ Add Customer</button></div></div>');
  },

  clearForm() {
    this.editId = null;
    Utils.set('cust-form-title','Add Customer');
    ['cf-name','cf-phone','cf-email','cf-addr'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    const cr=document.getElementById('cf-credit');if(cr)cr.value='0';
    const st=document.getElementById('cf-status');if(st)st.value='Active';
  },

  openEdit(id) {
    const c = DB.customers().find(x=>x.id===id); if(!c) return;
    this.editId = id;
    Utils.set('cust-form-title','Edit Customer');
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
    set('cf-name',c.name);set('cf-phone',c.phone||'');set('cf-email',c.email||'');
    set('cf-addr',c.addr||'');set('cf-credit',c.credit||0);
    const st=document.getElementById('cf-status');if(st)st.value=c.status;
    openD('d-customer');
  },

  save(action) {
    const name = Utils.val('cf-name');
    if(!name){Toast.show('Name is required','er');return;}
    const data={
      name, phone:Utils.val('cf-phone'), email:Utils.val('cf-email'),
      addr:Utils.val('cf-addr'), credit:parseFloat(Utils.val('cf-credit')||0),
      status:document.getElementById('cf-status')?.value||'Active',
    };
    if(this.editId){DB.customers().find(x=>x.id===this.editId) && Object.assign(MockData.customers.find(x=>x.id===this.editId),data); Toast.show('Customer updated ✓','ok');}
    else{DB.addCustomer(data);Toast.show('Customer added ✓','ok');}
    if(action==='addnew'){this.clearForm();}
    else{closeD('d-customer');}
    this.render();
  },
};