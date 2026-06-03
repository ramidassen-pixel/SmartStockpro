const Sales = {
  filter: 'All',
  cart: [],

  render() {
    const all = DB.sales();
    const filt = this.filter==='All' ? all : all.filter(s=>s.status===this.filter);
    const html = `
<div class="sec">
  <div class="sh">Sales & Invoices <span class="sl" onclick="openD('d-sale');Sales.initForm()">+ New</span></div>
  <div class="chips">
    ${['All','Paid','Partial','Credit'].map(f=>
      `<div class="chip${Sales.filter===f?' on':''}" onclick="Sales.setFilter('${f}')">${f}</div>`
    ).join('')}
  </div>
  <div id="sales-list"></div>
</div>`;
    Utils.set('pg-sales', html);
    this.renderList(filt);
  },

  setFilter(f) { this.filter=f; this.render(); },

  renderList(list) {
    if (!list || !list.length) {
      Utils.set('sales-list','<div class="empty"><div class="ei">🧾</div><div class="et">No invoices found</div></div>');
      return;
    }
    const html = list.map(s=>`
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px">
        <div class="list-icon" style="background:var(--gd)">🧾</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--t1)">${Utils.esc(s.customer)}</div>
          <div style="font-size:11px;color:var(--t3);margin-top:3px;font-family:var(--fm)">${s.id} · ${s.date}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:17px;font-weight:900;color:var(--g)">${Utils.cur(s.total)}</div>
          <div style="margin-top:4px">${Utils.statusBadge(s.status)}</div>
        </div>
      </div>
      ${s.items.length ? `
      <div style="padding:4px 14px 10px;border-top:1px solid var(--bd);background:var(--gd3)">
        ${s.items.map(i=>`
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:var(--t2);border-bottom:1px solid var(--bd)">
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">${Utils.esc(i.name)}</span>
          <span style="font-weight:700;color:var(--g)">${i.qty}× ${Utils.cur(i.price)}</span>
        </div>`).join('')}
      </div>` : ''}
      <div style="display:flex;gap:6px;padding:8px 14px;background:var(--s2);border-top:1px solid var(--bd)">
        <button class="act-btn">🖨 Print</button>
        <button class="act-btn gold">💬 Share</button>
        ${!s.paid?`<button class="act-btn ok" onclick="Sales.markPaid('${s.id}')">✓ Mark Paid</button>`:''}
      </div>
    </div>`).join('');
    Utils.set('sales-list', html);
  },

  initForm() {
    this.cart = [];
    const sel = document.getElementById('sf-cust');
    if (sel) { sel.innerHTML = DB.customers().map(c=>`<option value="${c.id}">${Utils.esc(c.name)}</option>`).join(''); }
    const psel = document.getElementById('sf-prod-select');
    if (psel) { psel.innerHTML = '<option value="">— tap to add product —</option>' + DB.products().filter(p=>p.qty>0).map(p=>`<option value="${p.id}">${Utils.esc(p.name)} — ${Utils.cur(p.price)}</option>`).join(''); }
    document.getElementById('sf-date').value = Utils.today();
    document.getElementById('sf-disc').value = '0';
    this.renderCart();
  },

  addToCart(sel) {
    const id = sel.value; if (!id) return;
    const p = DB.products().find(x=>x.id===id);
    if (!p) return;
    const exists = this.cart.find(i=>i.id===id);
    if (exists) { exists.qty++; }
    else { this.cart.push({id,name:p.name,price:p.price,qty:1}); }
    sel.value = '';
    this.renderCart();
  },

  renderCart() {
    if (!this.cart.length) {
      Utils.set('sf-cart','<div style="padding:16px 14px;text-align:center;color:var(--t3);font-size:13px">No items added yet</div>');
      Utils.set('sf-totals','');
      return;
    }
    const html = this.cart.map((item,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bd)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--t1)">${Utils.esc(item.name)}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:2px">${Utils.cur(item.price)} each</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <button class="act-btn" onclick="Sales.changeQty(${i},-1)" style="padding:5px 9px;font-size:14px">−</button>
        <span style="min-width:28px;text-align:center;font-weight:700">${item.qty}</span>
        <button class="act-btn" onclick="Sales.changeQty(${i},1)" style="padding:5px 9px;font-size:14px">+</button>
      </div>
      <div style="font-weight:900;color:var(--g);min-width:64px;text-align:right;font-size:14px">${Utils.cur(item.price*item.qty)}</div>
      <button onclick="Sales.removeItem(${i})" style="color:var(--t4);font-size:16px;padding:4px;cursor:pointer">✕</button>
    </div>`).join('');
    Utils.set('sf-cart', html);
    this.updateTotals();
  },

  changeQty(i, d) { if(this.cart[i]){this.cart[i].qty=Math.max(1,this.cart[i].qty+d);this.renderCart();} },
  removeItem(i)  { this.cart.splice(i,1); this.renderCart(); },

  updateTotals() {
    const subtotal = this.cart.reduce((a,i)=>a+i.price*i.qty,0);
    const disc = parseFloat(Utils.val('sf-disc')||0);
    const discAmt = subtotal*(disc/100);
    const total = subtotal - discAmt;
    Utils.set('sf-totals',`
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="color:var(--t2)">Subtotal</span><span>${Utils.cur(subtotal)}</span></div>
      ${disc>0?`<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="color:var(--er)">Discount (${disc}%)</span><span class="c-er">−${Utils.cur(discAmt)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;border-top:1px solid var(--bd);padding-top:8px;margin-top:6px"><span>Total</span><span class="c-g">${Utils.cur(total)}</span></div>`);
  },

  saveSale(action) {
    if (!this.cart.length) { Toast.show('Add at least one product','er'); return; }
    const custEl = document.getElementById('sf-cust');
    const custName = custEl?.options[custEl.selectedIndex]?.text || 'Walk-in';
    const disc = parseFloat(Utils.val('sf-disc')||0);
    const subtotal = this.cart.reduce((a,i)=>a+i.price*i.qty,0);
    const total = subtotal*(1-disc/100);
    const method = document.getElementById('sf-method')?.value||'Cash';
    DB.addSale({
      customer:custName, items:this.cart.map(i=>({name:i.name,qty:i.qty,price:i.price})),
      total, paid:method!=='Credit', date:Utils.val('sf-date')||Utils.today(),
      status:method==='Credit'?'Credit':method==='Bank Transfer'?'Partial':'Paid'
    });
    Toast.show('Invoice saved ✓','ok');
    if (action==='addnew') { this.initForm(); }
    else { closeD('d-sale'); }
    this.render();
  },

  markPaid(id) {
    const s = MockData.sales.find(x=>x.id===id);
    if (s) { s.paid=true; s.status='Paid'; }
    Toast.show('Marked as paid ✓','ok');
    this.render();
  },
};