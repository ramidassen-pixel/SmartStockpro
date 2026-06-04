var Sales = {
  filter:'All', cart:[], discount:0,

  render() {
    const pg = Utils.get('pg-sales');
    if (!pg) return;
    const all = DB.getSales();
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    const filters = ['All','Paid','Credit','Partial'];
    const filtered = this.filter==='All' ? all : all.filter(s=>s.status===this.filter);
    const totalRev = all.reduce((a,s)=>a+(parseFloat(s.total)||0),0);
    const collected = all.filter(s=>s.status==='Paid').reduce((a,s)=>a+(parseFloat(s.total)||0),0);
    const pending = all.filter(s=>s.status!=='Paid').reduce((a,s)=>a+(parseFloat(s.total)||0),0);

    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Sales</div>
          <div class="page-sub">${all.length} invoices</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Sales.openNewSale()">+ New Sale</button>
        </div>
      </div>
      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--gold);--kibg:var(--goldbg)">
            <div class="kpi-icon">💰</div><div class="kpi-label">Total Revenue</div>
            <div class="kpi-value">${Utils.cur(totalRev,cur)}</div>
          </div>
          <div class="kpi" style="--kc:var(--ok);--kibg:var(--okbg)">
            <div class="kpi-icon">✅</div><div class="kpi-label">Collected</div>
            <div class="kpi-value">${Utils.cur(collected,cur)}</div>
          </div>
          <div class="kpi" style="--kc:var(--warn);--kibg:var(--warnbg)">
            <div class="kpi-icon">⏳</div><div class="kpi-label">Pending</div>
            <div class="kpi-value">${Utils.cur(pending,cur)}</div>
          </div>
          <div class="kpi" style="--kc:var(--info);--kibg:var(--infobg)">
            <div class="kpi-icon">📊</div><div class="kpi-label">Invoices</div>
            <div class="kpi-value">${all.length}</div>
          </div>
        </div>
      </div>
      <div class="chips">
        ${filters.map(f=>`<div class="chip${this.filter===f?' active':''}" onclick="Sales.setFilter('${f}')">${f} (${f==='All'?all.length:all.filter(s=>s.status===f).length})</div>`).join('')}
      </div>
      <div class="sec">
        ${filtered.length ? `<div class="card">${filtered.map(s=>`
          <div class="list-item">
            <div class="list-icon" style="background:var(--goldbg)">🧾</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(s.customer||'Walk-in')}</div>
              <div class="list-meta">${s.id} · ${Utils.date(s.date)} · ${(s.items||[]).length} items</div>
            </div>
            <div class="list-right">
              <div class="list-val">${Utils.cur(s.total,cur)}</div>
              <div style="margin-top:3px">${Utils.statusBadge(s.status||'Paid')}</div>
              <div class="list-actions">
                ${s.status!=='Paid'?`<button class="btn-ok btn-sm" onclick="Sales.markPaid('${s.id}')">✓ Paid</button>`:''}
                <button class="btn-danger btn-sm btn-icon" onclick="Sales.del('${s.id}')">🗑</button>
              </div>
            </div>
          </div>`).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No sales yet</div><div class="empty-sub">Tap "+ New Sale" to create your first sale</div></div>'}
      </div>`;
  },

  setFilter(f) { this.filter=f; this.render(); },

  openNewSale() {
    this.cart = [];
    this.discount = 0;
    const custs = DB.getCustomers();
    const prods = DB.getProducts().filter(p=>p.status!=='inactive'&&p.qty>0);
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    Modal.open({
      title:'New Sale', sub:'Create invoice',
      barColor:'var(--ok)',
      body:`
        <div class="form-row">
          <div class="fg"><label class="fl">Customer</label>
            <select class="fi" id="s-cust">
              <option value="">Walk-in Customer</option>
              ${custs.map(c=>`<option value="${c.id}">${Utils.esc(c.name)}</option>`).join('')}
            </select></div>
          <div class="fg"><label class="fl">Date</label>
            <input class="fi" id="s-date" type="date" value="${Utils.today()}"></div>
        </div>
        <div class="fg"><label class="fl">Add Products</label>
          <select class="fi" id="s-prod-sel" onchange="Sales.addToCart(this)">
            <option value="">— tap to add product —</option>
            ${prods.map(p=>`<option value="${p.id}">${Utils.esc(p.name)} · ${Utils.cur(p.price,cur)} · Stock: ${p.qty}</option>`).join('')}
          </select></div>
        <div id="s-cart-wrap"></div>
        <div id="s-totals"></div>
        <div class="form-row">
          <div class="fg"><label class="fl">Discount %</label>
            <input class="fi" id="s-disc" type="number" value="0" min="0" max="100" oninput="Sales.updateCart()"></div>
          <div class="fg"><label class="fl">Payment</label>
            <select class="fi" id="s-method">
              <option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Credit</option>
            </select></div>
        </div>
        <div class="fg"><label class="fl">Notes</label>
          <input class="fi" id="s-notes" placeholder="Optional..."></div>`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Sales.saveSale()">🧾 Save Invoice</button>`,
    });
    this.updateCart();
  },

  addToCart(sel) {
    const id = sel.value; if(!id) return;
    const p = DB.getProducts().find(x=>x.id===id);
    if (!p) return;
    sel.value = '';
    const existing = this.cart.find(i=>i.id===id);
    if (existing) existing.qty++;
    else this.cart.push({id, name:p.name, price:p.price, cost:p.cost||0, qty:1, maxQty:p.qty});
    this.updateCart();
  },

  updateCart() {
    this.discount = parseFloat(Utils.val('s-disc')||0);
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    const cartEl = Utils.get('s-cart-wrap');
    const totEl  = Utils.get('s-totals');
    if (!cartEl) return;
    if (!this.cart.length) {
      cartEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px">No items added yet</div>';
      if(totEl) totEl.innerHTML = '';
      return;
    }
    cartEl.innerHTML = `<div class="card" style="margin-bottom:10px">${this.cart.map((item,i)=>`
      <div class="list-item" style="padding:10px 12px">
        <div class="list-info">
          <div class="list-name" style="font-size:13px">${Utils.esc(item.name)}</div>
          <div style="font-size:11px;color:var(--text2)">${Utils.cur(item.price,cur)} each</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <button onclick="Sales.changeQty(${i},-1)" style="width:28px;height:28px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);cursor:pointer;font-size:16px">−</button>
          <span style="min-width:24px;text-align:center;font-weight:700">${item.qty}</span>
          <button onclick="Sales.changeQty(${i},1)" style="width:28px;height:28px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);cursor:pointer;font-size:16px">+</button>
        </div>
        <div style="min-width:70px;text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:800;color:var(--gold)">${Utils.cur(item.price*item.qty,cur)}</div>
          <button onclick="Sales.removeItem(${i})" style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;margin-top:2px">✕</button>
        </div>
      </div>`).join('')}</div>`;
    const sub = this.cart.reduce((a,i)=>a+i.price*i.qty,0);
    const discAmt = sub*(this.discount/100);
    const total = sub - discAmt;
    if(totEl) totEl.innerHTML = `
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r10);padding:12px;margin-bottom:12px">
        <div class="report-row"><span class="report-label">Subtotal</span><span class="report-val gold">${Utils.cur(sub,cur)}</span></div>
        ${this.discount>0?`<div class="report-row"><span class="report-label" style="color:var(--err)">Discount (${this.discount}%)</span><span class="report-val err">−${Utils.cur(discAmt,cur)}</span></div>`:''}
        <div class="report-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
          <span style="font-size:15px;font-weight:800;color:var(--text)">Total</span>
          <span class="report-val gold" style="font-size:18px">${Utils.cur(total,cur)}</span>
        </div>
      </div>`;
  },

  changeQty(i, d) { if(this.cart[i]) { this.cart[i].qty=Math.max(1,this.cart[i].qty+d); this.updateCart(); } },
  removeItem(i)   { this.cart.splice(i,1); this.updateCart(); },

  saveSale() {
    if (!this.cart.length) { Toast.show('Add at least one product','err'); return; }
    const sub = this.cart.reduce((a,i)=>a+i.price*i.qty,0);
    const discAmt = sub*(this.discount/100);
    const total = sub - discAmt;
    const method = Utils.get('s-method')?.value || 'Cash';
    const custId = Utils.val('s-cust');
    const cust = custId ? DB.getCustomers().find(c=>c.id===custId) : null;
    DB.addSale({
      customer: cust ? cust.name : 'Walk-in',
      customerId: custId||null,
      items: this.cart.map(i=>({...i})),
      total, discount:this.discount, subtotal:sub,
      payment: method,
      status: method==='Credit'?'Credit':'Paid',
      date: Utils.val('s-date') || Utils.today(),
      notes: Utils.val('s-notes'),
    });
    // Update product stock
    this.cart.forEach(item => {
      const p = DB.getProducts().find(x=>x.id===item.id);
      if (p) DB.updateProduct(item.id, { qty: Math.max(0, (p.qty||0) - item.qty) });
    });
    // Update customer totals
    if (cust) DB.updateCustomer(custId, { totalSpent:(cust.totalSpent||0)+total, purchases:(cust.purchases||0)+1 });
    Toast.show('Sale saved ✓','ok');
    Modal.close();
    this.render();
    Notifs.check();
  },

  markPaid(id) {
    DB.updateSale(id, { status:'Paid' });
    Toast.show('Marked as paid ✓','ok');
    this.render();
  },

  del(id) {
    confirmDel('Delete this invoice?', () => {
      DB.deleteSale(id);
      Toast.show('Sale deleted','warn');
      this.render();
    });
  },
};
