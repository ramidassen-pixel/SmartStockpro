var Sales = {
  filter: 'All',
  cart: [],
  discount: 0,
  amountPaid: 0,

  // ── SALES LIST ─────────────────────────────────────────────────────────────
  render() {
    const pg  = Utils.get('pg-sales');
    if (!pg) return;
    const all      = DB.getSales();
    const settings = DB.getSettings();
    const cur      = settings.currency || '$';
    const filtered = this.filter === 'All' ? all : all.filter(s => s.status === this.filter);
    const totalRev  = all.reduce((a,s)=>a+(parseFloat(s.total)||0),0);
    const collected = all.filter(s=>s.status==='Paid').reduce((a,s)=>a+(parseFloat(s.total)||0),0);
    const partPaid  = all.filter(s=>s.status==='Partial').reduce((a,s)=>a+(parseFloat(s.amountPaid)||0),0);
    const outstanding = all.filter(s=>s.status!=='Paid').reduce((a,s)=>a+(parseFloat(s.balance)||0),0);

    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Sales</div>
          <div class="page-sub">${all.length} invoices total</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button>
        </div>
      </div>

      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">
            <div class="kpi-icon">💰</div><div class="kpi-label">Total Revenue</div>
            <div class="kpi-value">${Utils.cur(totalRev,cur)}</div>
            <div class="kpi-sub">${all.length} invoices</div>
          </div>
          <div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)">
            <div class="kpi-icon">✅</div><div class="kpi-label">Collected</div>
            <div class="kpi-value">${Utils.cur(collected+partPaid,cur)}</div>
            <div class="kpi-sub">${all.filter(s=>s.status==='Paid').length} paid</div>
          </div>
          <div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)">
            <div class="kpi-icon">⏳</div><div class="kpi-label">Outstanding</div>
            <div class="kpi-value">${Utils.cur(outstanding,cur)}</div>
            <div class="kpi-sub">${all.filter(s=>s.status!=='Paid').length} open</div>
          </div>
          <div class="kpi" style="--kc:var(--in);--kibg:var(--inb)">
            <div class="kpi-icon">📊</div><div class="kpi-label">Invoices</div>
            <div class="kpi-value">${all.length}</div>
            <div class="kpi-sub">All time</div>
          </div>
        </div>
      </div>

      <div class="chips">
        ${['All','Paid','Partial','Credit'].map(f=>`
          <div class="chip${this.filter===f?' active':''}" onclick="Sales.setFilter('${f}')">
            ${f} (${f==='All'?all.length:all.filter(s=>s.status===f).length})
          </div>`).join('')}
      </div>

      <div class="sec">
        ${filtered.length ? `<div class="card">${filtered.map(s=>`
          <div class="list-item" onclick="Sales.viewInvoice('${s.id}')">
            <div class="list-icon" style="background:var(--gb3);border-color:rgba(201,168,76,.15);font-size:20px">🧾</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(s.customer||'Walk-in')}</div>
              <div class="list-meta">${s.id} · ${Utils.date(s.date)}</div>
              ${s.status==='Partial'?`
              <div style="margin-top:5px">
                <div class="progress"><div class="progress-fill" style="width:${Math.min(100,Math.round(((parseFloat(s.amountPaid)||0)/(parseFloat(s.total)||1))*100))}%;background:var(--wa)"></div></div>
                <div style="font-size:10px;color:var(--wa);margin-top:3px;font-family:var(--fm)">Paid ${Utils.cur(s.amountPaid||0,cur)} · Bal ${Utils.cur(s.balance||0,cur)}</div>
              </div>`:''}
            </div>
            <div class="list-right">
              <div class="list-val">${Utils.cur(s.total,cur)}</div>
              <div style="margin-top:4px">${Utils.statusBadge(s.status||'Paid')}</div>
              <div class="list-actions">
                <button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Sales.printReceipt('${s.id}')" title="Print">🖨</button>
                ${s.status!=='Paid'?`<button class="btn-ok btn-sm" onclick="event.stopPropagation();Sales.openPayBalance('${s.id}')">💳 Pay</button>`:''}
                <button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Sales.del('${s.id}')">🗑</button>
              </div>
            </div>
          </div>`).join('')}</div>` : `
          <div class="empty">
            <div class="empty-icon">🧾</div>
            <div class="empty-title">No ${this.filter!=='All'?this.filter+' ':''}sales yet</div>
            <div class="empty-sub">Tap "+ New Sale" to get started</div>
            <div class="empty-action"><button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button></div>
          </div>`}
      </div>`;
  },

  setFilter(f) { this.filter=f; this.render(); },

  // ── NEW SALE FORM ──────────────────────────────────────────────────────────
  openNewSale() {
    this.cart=[]; this.discount=0; this.amountPaid=0;
    const custs    = DB.getCustomers();
    const prods    = DB.getProducts().filter(p=>p.status!=='inactive'&&p.qty>0);
    const settings = DB.getSettings();
    const cur      = settings.currency||'$';

    Modal.open({
      title:'New Sale', sub:'Create invoice', barColor:'var(--ok)',
      body:`
        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">👤 Customer</div>
          <div class="form-row" style="margin-bottom:8px">
            <div class="fg" style="margin:0">
              <label class="fl">Customer Name</label>
              <input class="fi" id="s-cust-name" placeholder="Type name or Walk-in..." oninput="Sales.onCustNameInput(this.value)" style="font-weight:600">
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Date</label>
              <input class="fi" id="s-date" type="date" value="${Utils.today()}">
            </div>
          </div>
          <input type="hidden" id="s-cust-id" value="">
          <div id="s-cust-suggestions" style="display:none;border:1px solid var(--bd2);border-radius:var(--r8);background:var(--bg2);overflow:hidden;max-height:140px;overflow-y:auto"></div>
          <div id="s-cust-tag" style="display:none;font-size:11px;color:var(--ok);font-weight:600;margin-top:5px;font-family:var(--fm)"></div>
        </div>

        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📦 Products</div>
          <div class="fg" style="margin-bottom:10px">
            <label class="fl">Add Product</label>
            <select class="fi" id="s-prod-sel" onchange="Sales.addToCart(this)">
              <option value="">— tap to select product —</option>
              ${prods.map(p=>`<option value="${p.id}">${Utils.esc(p.name)} · ${Utils.cur(p.price,cur)} · ${p.qty} left</option>`).join('')}
            </select>
          </div>
          <div id="s-cart-wrap"><div style="text-align:center;padding:14px 0;color:var(--t3);font-size:13px">No items added yet</div></div>
        </div>

        <div id="s-totals"></div>

        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">💳 Payment</div>
          <div class="form-row" style="margin-bottom:12px">
            <div class="fg" style="margin:0">
              <label class="fl">Discount %</label>
              <input class="fi" id="s-disc" type="number" value="0" min="0" max="100" oninput="Sales.updateTotals()">
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Payment Method</label>
              <select class="fi" id="s-method">
                <option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Credit</option>
              </select>
            </div>
          </div>
          <div class="fg" style="margin:0">
            <label class="fl">Amount Paid Now <span style="color:var(--t3);text-transform:none;letter-spacing:0;font-weight:400">(leave 0 for full payment or credit)</span></label>
            <input class="fi" id="s-amt-paid" type="number" value="0" min="0" step="0.01" oninput="Sales.updateTotals()" style="font-size:16px;font-weight:700;color:var(--ok)">
          </div>
        </div>

        <div class="fg">
          <label class="fl">Notes (optional)</label>
          <input class="fi" id="s-notes" placeholder="Any extra information...">
        </div>`,
      footer:`
        <button class="btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn-ghost" onclick="Sales.saveSale('new')" style="color:var(--g);border-color:rgba(201,168,76,.3)">💾 Save &amp; New</button>
        <button class="btn-primary" style="flex:1" onclick="Sales.saveSale('close')">🧾 Save Invoice</button>`,
    });
    const nameEl=Utils.get('s-cust-name'); if(nameEl) nameEl.value='Walk-in Customer';
    this.updateTotals();
  },

  // ── CUSTOMER NAME AUTO-SUGGEST ─────────────────────────────────────────────
  onCustNameInput(val) {
    Utils.get('s-cust-id').value='';
    Utils.get('s-cust-tag').style.display='none';
    if (!val.trim()) { Utils.get('s-cust-suggestions').style.display='none'; return; }
    const custs = DB.getCustomers().filter(c=>c.name.toLowerCase().includes(val.toLowerCase())).slice(0,6);
    const box = Utils.get('s-cust-suggestions');
    if (!custs.length) { box.style.display='none'; return; }
    box.style.display='block';
    const cur = DB.getSettings().currency||'$';
    box.innerHTML = custs.map(c=>`
      <div onclick="Sales.selectCust('${c.id}','${Utils.esc(c.name)}')"
        style="padding:10px 13px;cursor:pointer;font-size:13px;font-weight:600;color:var(--t1);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px"
        onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
        <span style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#07080D;flex-shrink:0">${c.name[0].toUpperCase()}</span>
        <span style="flex:1">${Utils.esc(c.name)}</span>
        <span style="font-size:10px;color:var(--t2)">${Utils.cur(c.totalSpent||0,cur)}</span>
      </div>`).join('');
  },

  selectCust(id, name) {
    Utils.get('s-cust-name').value=name;
    Utils.get('s-cust-id').value=id;
    Utils.get('s-cust-suggestions').style.display='none';
    const tag=Utils.get('s-cust-tag'); tag.textContent='✓ Linked to existing customer record'; tag.style.display='block';
  },

  // ── CART ───────────────────────────────────────────────────────────────────
  addToCart(sel) {
    const id=sel.value; if(!id) return;
    const p=DB.getProducts().find(x=>x.id===id); if(!p) return;
    sel.value='';
    const ex=this.cart.find(i=>i.id===id);
    if(ex) ex.qty++; else this.cart.push({id,name:p.name,price:p.price,cost:p.cost||0,qty:1,maxQty:p.qty});
    this.renderCart();
  },

  renderCart() {
    const el=Utils.get('s-cart-wrap'); if(!el) return;
    const cur=DB.getSettings().currency||'$';
    if(!this.cart.length){
      el.innerHTML='<div style="text-align:center;padding:14px 0;color:var(--t3);font-size:13px">No items added yet</div>';
      this.updateTotals(); return;
    }
    el.innerHTML=this.cart.map((item,i)=>`
      <div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px 13px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:var(--t1);flex:1;padding-right:8px">${Utils.esc(item.name)}</div>
          <button onclick="Sales.removeItem(${i})" style="width:22px;height:22px;border-radius:50%;background:var(--erb);border:1px solid var(--erbd);color:var(--er);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end">
          <div>
            <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Qty</div>
            <div style="display:flex;align-items:center;gap:5px">
              <button onclick="Sales.changeQty(${i},-1)" style="width:26px;height:26px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd2);color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">−</button>
              <input type="number" value="${item.qty}" min="1" oninput="Sales.setQty(${i},this.value)"
                style="width:44px;text-align:center;font-size:14px;font-weight:700;color:var(--t1);background:var(--bg3);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 2px;-webkit-appearance:none">
              <button onclick="Sales.changeQty(${i},1)" style="width:26px;height:26px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd2);color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">+</button>
            </div>
          </div>
          <div>
            <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Unit Price</div>
            <input type="number" value="${item.price}" min="0" step="0.01" oninput="Sales.setPrice(${i},this.value)"
              style="width:100%;text-align:right;font-size:14px;font-weight:700;color:var(--g);background:var(--bg3);border:1.5px solid rgba(201,168,76,.3);border-radius:6px;padding:5px 8px;-webkit-appearance:none">
          </div>
          <div style="text-align:right">
            <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Line Total</div>
            <div style="font-size:16px;font-weight:800;color:var(--g)" id="lt-${i}">${Utils.cur(item.price*item.qty,cur)}</div>
          </div>
        </div>
      </div>`).join('');
    this.updateTotals();
  },

  changeQty(i,d) { if(this.cart[i]){this.cart[i].qty=Math.max(1,(this.cart[i].qty||1)+d);this.renderCart();} },

  setQty(i,val) {
    const n=parseInt(val); if(!this.cart[i]||isNaN(n)||n<1) return;
    this.cart[i].qty=n;
    const cur=DB.getSettings().currency||'$';
    const el=Utils.get('lt-'+i); if(el) el.textContent=Utils.cur(this.cart[i].price*n,cur);
    this.updateTotals();
  },

  setPrice(i,val) {
    const n=parseFloat(val); if(!this.cart[i]||isNaN(n)||n<0) return;
    this.cart[i].price=n;
    const cur=DB.getSettings().currency||'$';
    const el=Utils.get('lt-'+i); if(el) el.textContent=Utils.cur(n*this.cart[i].qty,cur);
    this.updateTotals();
  },

  removeItem(i) { this.cart.splice(i,1); this.renderCart(); },

  // ── TOTALS PANEL ───────────────────────────────────────────────────────────
  updateTotals() {
    const totEl=Utils.get('s-totals');
    const cur=DB.getSettings().currency||'$';
    this.discount=parseFloat(Utils.val('s-disc')||0);
    if(!this.cart.length){ if(totEl) totEl.innerHTML=''; return; }
    const sub     = this.cart.reduce((a,i)=>a+(parseFloat(i.price)||0)*(parseInt(i.qty)||0),0);
    const discAmt = sub*(this.discount/100);
    const total   = sub-discAmt;
    const paidRaw = parseFloat(Utils.val('s-amt-paid')||0);
    const paid    = Math.min(paidRaw, total);
    const balance = Math.max(0, total-paid);
    const method  = Utils.get('s-method')?.value||'Cash';
    // Status logic:
    // - No amount entered + Credit method = Credit
    // - No amount entered + Cash = assume full cash payment on save
    // - Partial amount entered = Partial
    // - Full amount entered = Paid
    const isFullPayment = paidRaw <= 0; // 0 means full cash assumed on save
    const status  = paid>0&&balance>0 ? 'Partial' : (paidRaw<=0&&method==='Credit') ? 'Credit' : 'Paid';
    const sc      = {Paid:'var(--ok)',Partial:'var(--wa)',Credit:'var(--er)'}[status];

    // When paid=0, assume full cash — show "Full payment on save"
    const showPartial = paidRaw > 0 && balance > 0;
    const displayNote = paidRaw <= 0 && method !== 'Credit'
      ? '<div style="font-size:11px;color:var(--ok);margin-top:8px;font-weight:600">✓ Full payment assumed on save</div>'
      : '';

    if(totEl) totEl.innerHTML=`
      <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">
        <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">🧮 Order Summary</div>
        ${this.discount>0?`
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)">
          <span style="font-size:13px;color:var(--t2)">Subtotal</span><span style="font-size:13px;font-weight:600;font-family:var(--fm)">${Utils.cur(sub,cur)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)">
          <span style="font-size:13px;color:var(--er)">Discount (${this.discount}%)</span><span style="font-size:13px;font-weight:600;color:var(--er);font-family:var(--fm)">−${Utils.cur(discAmt,cur)}</span>
        </div>`:''}
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd2)">
          <span style="font-size:15px;font-weight:800;color:var(--t1)">Total Amount</span>
          <span style="font-size:18px;font-weight:900;color:var(--g);letter-spacing:-.02em;font-family:var(--fm)">${Utils.cur(total,cur)}</span>
        </div>
        ${showPartial?`
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)">
          <span style="font-size:13px;color:var(--ok);font-weight:600">✓ Amount Paid</span>
          <span style="font-size:14px;font-weight:700;color:var(--ok);font-family:var(--fm)">${Utils.cur(paidRaw,cur)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)">
          <span style="font-size:13px;color:var(--wa);font-weight:600">⏳ Balance Due</span>
          <span style="font-size:14px;font-weight:700;color:var(--wa);font-family:var(--fm)">${Utils.cur(balance,cur)}</span>
        </div>
        <div style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-bottom:5px">
            <span>Payment progress</span><span>${Math.round((paidRaw/total)*100)}% paid</span>
          </div>
          <div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${Math.round((paidRaw/total)*100)}%;background:linear-gradient(90deg,var(--ok),var(--g));border-radius:3px;transition:width .4s ease"></div>
          </div>
        </div>`:''}
        <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--t3)">Invoice status</span>
          <span style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;background:${sc}18;border:1px solid ${sc}40;color:${sc}">${status}</span>
        </div>
        ${displayNote}
      </div>`;
  },

  // ── SAVE SALE ──────────────────────────────────────────────────────────────
  saveSale(action) {
    action=action||'close';
    if(!this.cart.length){ Toast.show('Add at least one product','err'); return; }
    const custName = Utils.val('s-cust-name').trim()||'Walk-in Customer';
    const custId   = Utils.val('s-cust-id')||null;
    const method   = Utils.get('s-method')?.value||'Cash';
    const sub      = this.cart.reduce((a,i)=>a+(parseFloat(i.price)||0)*(parseInt(i.qty)||0),0);
    const discAmt  = sub*(this.discount/100);
    const total    = sub-discAmt;
    const paidRaw  = parseFloat(Utils.val('s-amt-paid')||0);
    const paid     = Math.min(paidRaw, total);
    const balance  = Math.max(0, total-paid);
    const status   = paid>0&&balance>0?'Partial':(paid<=0&&method==='Credit')?'Credit':'Paid';

    // Auto-create or find customer
    let finalCustId = custId;
    if (!finalCustId && custName && custName.toLowerCase()!=='walk-in customer') {
      const c = DB.findOrCreateCustomer(custName);
      if (c) finalCustId = c.id;
    }
    const cust = finalCustId ? DB.getCustomers().find(c=>c.id===finalCustId) : null;

    const sale = DB.addSale({
      customer:   custName,
      customerId: finalCustId||null,
      items:      this.cart.map(i=>({...i})),
      subtotal:   sub, discount:this.discount, total,
      amountPaid: status==='Paid' ? total : paid,
      balance:    status==='Paid' ? 0 : balance,
      payment: method, status,
      date:  Utils.val('s-date')||Utils.today(),
      notes: Utils.val('s-notes'),
    });

    // Record initial payment in payment history
    if (paid>0 || status==='Paid') {
      DB.addPayment({
        saleId:     sale.id,
        customerId: finalCustId||null,
        amount:     status==='Paid'?total:paid,
        method,
        note:      'Initial payment',
        invoiceRef: sale.id,
      });
    }

    // Deduct stock
    this.cart.forEach(item=>{
      const p=DB.getProducts().find(x=>x.id===item.id);
      if(p) DB.updateProduct(item.id,{qty:Math.max(0,(p.qty||0)-(parseInt(item.qty)||0))});
    });

    // Update customer totals
    if(cust) DB.updateCustomer(finalCustId,{totalSpent:(cust.totalSpent||0)+total,purchases:(cust.purchases||0)+1});

    Toast.show('Invoice '+sale.id+' saved ✓','ok');
    Notifs.check();

    // Show non-blocking print prompt after save
    if(action!=='new') {
      setTimeout(()=>{ Sales.showPrintPrompt(sale.id, 'invoice'); }, 300);
    }

    if(action==='new'){
      this.cart=[]; this.discount=0; this.amountPaid=0;
      const n=Utils.get('s-cust-name'); if(n) n.value='Walk-in Customer';
      Utils.get('s-cust-id').value='';
      Utils.get('s-cust-tag').style.display='none';
      const d=Utils.get('s-disc'); if(d) d.value='0';
      const p=Utils.get('s-amt-paid'); if(p) p.value='0';
      const nt=Utils.get('s-notes'); if(nt) nt.value='';
      this.renderCart();
      Toast.show('Ready for next sale','ok');
    } else {
      Modal.close();
    }
    this.render();
  },

  // ── VIEW INVOICE DETAIL ────────────────────────────────────────────────────
  viewInvoice(id) {
    const s=DB.getSales().find(x=>x.id===id); if(!s) return;
    const payments=DB.getPaymentsForSale(id);
    const settings=DB.getSettings();
    const cur=settings.currency||'$';
    const bizName=settings.bizName||'SmartStock Pro';

    Modal.open({
      title:'Invoice '+s.id, sub:Utils.date(s.date),
      barColor: s.status==='Paid'?'var(--ok)':s.status==='Partial'?'var(--wa)':'var(--er)',
      body:`
        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:14px;margin-bottom:12px">
          <div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:3px">${Utils.esc(s.customer||'Walk-in')}</div>
          <div style="font-size:11px;color:var(--t2);font-family:var(--fm)">${s.id} · ${Utils.date(s.date)} · ${s.payment||'Cash'}</div>
        </div>

        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">
          <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Items</div>
          ${(s.items||[]).map(item=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd)">
            <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--t1)">${Utils.esc(item.name)}</div>
              <div style="font-size:11px;color:var(--t2);font-family:var(--fm)">${item.qty} × ${Utils.cur(item.price,cur)}</div></div>
            <div style="font-size:14px;font-weight:700;color:var(--g)">${Utils.cur(item.price*item.qty,cur)}</div>
          </div>`).join('')}
        </div>

        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">
          ${s.discount>0?`<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:var(--t2);font-size:13px">Discount (${s.discount}%)</span><span style="color:var(--er);font-family:var(--fm)">−${Utils.cur(s.subtotal*(s.discount/100),cur)}</span></div>`:''}
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--bd)">
            <span style="font-size:15px;font-weight:800;color:var(--t1)">Total</span>
            <span style="font-size:17px;font-weight:900;color:var(--g);font-family:var(--fm)">${Utils.cur(s.total,cur)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0">
            <span style="color:var(--ok);font-size:13px;font-weight:600">✓ Paid</span>
            <span style="color:var(--ok);font-family:var(--fm);font-weight:700">${Utils.cur(s.amountPaid||0,cur)}</span>
          </div>
          ${(s.balance||0)>0?`<div style="display:flex;justify-content:space-between;padding:5px 0">
            <span style="color:var(--wa);font-size:13px;font-weight:600">⏳ Balance</span>
            <span style="color:var(--wa);font-family:var(--fm);font-weight:700">${Utils.cur(s.balance,cur)}</span>
          </div>`:''}
        </div>

        ${payments.length>0?`
        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px">
          <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Payment History (${payments.length})</div>
          ${payments.map(p=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd)">
            <div><div style="font-size:12px;font-weight:600;color:var(--t1)">${Utils.esc(p.note||'Payment')}</div>
              <div style="font-size:10px;color:var(--t3);font-family:var(--fm)">${p.id} · ${p.paidAt?new Date(p.paidAt).toLocaleDateString():''}</div></div>
            <div style="font-size:14px;font-weight:700;color:var(--ok);font-family:var(--fm)">${Utils.cur(p.amount,cur)}</div>
          </div>`).join('')}
        </div>`:''}`,
      footer:`
        <button class="btn-ghost" onclick="Modal.close()">Close</button>
        <button class="btn-ghost btn-icon" onclick="Sales.printReceipt('${id}')" title="Print">🖨 Print</button>
        ${s.status!=='Paid'?`<button class="btn-primary" style="flex:1" onclick="Modal.close();Sales.openPayBalance('${id}')">💳 Pay Balance</button>`:
          '<button class="btn-ok" style="flex:1" disabled>✅ Fully Paid</button>'}`,
    });
  },

  // ── PAY BALANCE ────────────────────────────────────────────────────────────
  openPayBalance(id) {
    const s=DB.getSales().find(x=>x.id===id); if(!s) return;
    const cur=DB.getSettings().currency||'$';
    const bal=parseFloat(s.balance)||0;

    Modal.open({
      title:'Pay Balance', sub:'Invoice '+s.id+' · '+Utils.esc(s.customer||'Walk-in'),
      barColor:'var(--wa)',
      body:`
        <div style="background:var(--gb3);border:1px solid rgba(201,168,76,.2);border-radius:var(--r10);padding:14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:13px;color:var(--t2)">Original Total</span>
            <span style="font-weight:700;font-family:var(--fm)">${Utils.cur(s.total,cur)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:13px;color:var(--ok)">Already Paid</span>
            <span style="font-weight:700;color:var(--ok);font-family:var(--fm)">${Utils.cur(s.amountPaid||0,cur)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(201,168,76,.2)">
            <span style="font-size:15px;font-weight:800;color:var(--wa)">Outstanding Balance</span>
            <span style="font-size:18px;font-weight:900;color:var(--wa);font-family:var(--fm)">${Utils.cur(bal,cur)}</span>
          </div>
        </div>

        <div class="fg">
          <label class="fl">Amount Paying Now *</label>
          <input class="fi" id="pb-amount" type="number" value="${bal.toFixed(2)}" min="0.01" max="${bal.toFixed(2)}" step="0.01"
            style="font-size:18px;font-weight:800;color:var(--ok)" oninput="Sales.updateBalancePreview('${id}',this.value)">
        </div>
        <div class="fg">
          <label class="fl">Payment Method</label>
          <select class="fi" id="pb-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select>
        </div>
        <div class="fg">
          <label class="fl">Note (optional)</label>
          <input class="fi" id="pb-note" placeholder="e.g. Balance payment">
        </div>
        <div id="pb-preview"></div>`,
      footer:`
        <button class="btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn-primary" style="flex:1" onclick="Sales.saveBalancePayment('${id}')">💳 Record Payment</button>`,
    });
    this.updateBalancePreview(id, bal.toFixed(2));
  },

  updateBalancePreview(id, val) {
    const s=DB.getSales().find(x=>x.id===id); if(!s) return;
    const cur=DB.getSettings().currency||'$';
    const paying=Math.min(parseFloat(val)||0, parseFloat(s.balance)||0);
    const newBal=Math.max(0,(parseFloat(s.balance)||0)-paying);
    const el=Utils.get('pb-preview');
    if(!el) return;
    const willBePaid = newBal<=0;
    el.innerHTML=`
      <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-top:4px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;color:var(--ok)">Paying Now</span>
          <span style="font-weight:700;color:var(--ok);font-family:var(--fm)">${Utils.cur(paying,cur)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:13px;color:${willBePaid?'var(--ok)':'var(--wa)'};font-weight:700">New Balance</span>
          <span style="font-weight:800;font-family:var(--fm);color:${willBePaid?'var(--ok)':'var(--wa)'}">
            ${willBePaid?'✅ FULLY PAID':Utils.cur(newBal,cur)}
          </span>
        </div>
      </div>`;
  },

  saveBalancePayment(id) {
    const s=DB.getSales().find(x=>x.id===id); if(!s) return;
    const paying=Math.min(parseFloat(Utils.val('pb-amount'))||0, parseFloat(s.balance)||0);
    if(paying<=0){ Toast.show('Enter a valid amount','err'); return; }
    const method=Utils.get('pb-method')?.value||'Cash';
    const note=Utils.val('pb-note')||'Balance payment';
    const newBal=Math.max(0,(parseFloat(s.balance)||0)-paying);
    const newPaid=(parseFloat(s.amountPaid)||0)+paying;
    const newStatus=newBal<=0?'Paid':'Partial';

    // Update sale
    DB.updateSale(id,{amountPaid:newPaid,balance:newBal,status:newStatus});

    // Record payment
    const pmt=DB.addPayment({
      saleId:id, customerId:s.customerId||null,
      amount:paying, method, note,
      invoiceRef:'PMT-'+id,
    });

    Modal.close();
    Toast.show(newStatus==='Paid'?'Invoice fully paid! ✅':'Payment recorded ✓','ok');

    // Show non-blocking print prompt
    setTimeout(()=>{ Sales.showPrintPrompt(id, 'payment', pmt.id, paying, newBal); }, 300);
    this.render();
  },

  // ── MARK PAID ──────────────────────────────────────────────────────────────
  markPaid(id) {
    const s=DB.getSales().find(x=>x.id===id); if(!s) return;
    DB.updateSale(id,{status:'Paid',amountPaid:s.total,balance:0});
    DB.addPayment({saleId:id,customerId:s.customerId||null,amount:s.balance||0,method:'Cash',note:'Full settlement'});
    Toast.show('Marked as fully paid ✓','ok');
    this.render();
  },

  del(id) {
    confirmDel('Delete this invoice?',()=>{ DB.deleteSale(id); Toast.show('Deleted','warn'); this.render(); });
  },


  // ── PRINT PROMPT (non-blocking) ───────────────────────────────────────────
  showPrintPrompt(saleId, type, paymentId, amount, newBalance) {
    var s = DB.getSales().find(function(x){ return x.id === saleId; });
    if (!s) return;
    var settings = DB.getSettings();
    var cur = settings.currency || '$';
    var isPayment = type === 'payment';

    // Store args for the print button to use — avoids nested quote issues
    window._printArgs = { saleId: saleId, type: type, paymentId: paymentId, amount: amount, newBalance: newBalance };

    Modal.open({
      title:    isPayment ? '✅ Payment Recorded!' : '✅ Invoice Saved!',
      sub:      isPayment
                ? 'Paid ' + Utils.cur(amount||0,cur) + ' — ' + Utils.esc(s.customer||'Customer')
                : saleId + ' · ' + Utils.esc(s.customer||'Walk-in') + ' · ' + Utils.cur(s.total,cur),
      barColor: 'var(--ok)',
      body: '<div style="text-align:center;padding:16px 0 20px">'
          + '<div style="font-size:52px;margin-bottom:14px">' + (isPayment ? '💳' : '🧾') + '</div>'
          + '<div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:8px">'
          + (isPayment ? 'Payment receipt ready' : 'Invoice saved successfully') + '</div>'
          + '<div style="font-size:13px;color:var(--t2);line-height:1.6">'
          + 'Would you like to print the ' + (isPayment ? 'payment receipt' : 'customer receipt') + ' now?'
          + '</div></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()" style="flex:1">Not Now</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Sales._doPrint()">🖨 Print Now</button>',
    });
  },

  // Called by the Print Now button — reads args stored by showPrintPrompt
  _doPrint() {
    Modal.close();
    var args = window._printArgs;
    if (!args) return;
    if (args.type === 'payment') {
      Sales.printPaymentReceipt(args.saleId, args.paymentId, args.amount, args.newBalance);
    } else {
      Sales.printReceipt(args.saleId);
    }
    window._printArgs = null;
  },

  // ── PRINT RECEIPT ──────────────────────────────────────────────────────────
  printReceipt(id) {
    const s=DB.getSales().find(x=>x.id===id); if(!s) return;
    const settings=DB.getSettings();
    const cur=settings.currency||'$';
    const bizName=settings.bizName||'SmartStock Pro';
    const now=new Date();

    const html=`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Receipt ${s.id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:13px;color:#000;background:#fff;padding:12px;max-width:360px;margin:0 auto}
  .center{text-align:center} .bold{font-weight:bold} .lg{font-size:16px} .sm{font-size:11px}
  .line{border-top:1px dashed #000;margin:8px 0}
  .row{display:flex;justify-content:space-between;padding:3px 0}
  .total-row{display:flex;justify-content:space-between;padding:5px 0;font-weight:bold;font-size:14px}
  .paid{color:#16a34a} .bal{color:#d97706}
  @media print{@page{margin:5mm}body{max-width:100%}}
</style></head>
<body>
  <div class="center bold lg">${Utils.esc(bizName)}</div>
  <div class="center sm">Business Receipt</div>
  <div class="center sm">${now.toLocaleString()}</div>
  <div class="line"></div>
  <div class="row"><span>Customer:</span><span class="bold">${Utils.esc(s.customer||'Walk-in')}</span></div>
  <div class="row"><span>Invoice #:</span><span class="bold">${s.id}</span></div>
  <div class="row"><span>Date:</span><span>${Utils.date(s.date)}</span></div>
  <div class="row"><span>Payment:</span><span>${s.payment||'Cash'}</span></div>
  <div class="line"></div>
  <div class="bold sm" style="margin-bottom:4px">ITEMS</div>
  ${(s.items||[]).map(item=>`
  <div class="row"><span style="flex:1;padding-right:8px">${Utils.esc(item.name)}</span></div>
  <div class="row sm"><span>${item.qty} x ${Utils.cur(item.price,cur)}</span><span class="bold">${Utils.cur(item.price*item.qty,cur)}</span></div>`).join('')}
  <div class="line"></div>
  ${s.discount>0?`<div class="row"><span>Discount (${s.discount}%)</span><span>-${Utils.cur((s.subtotal||0)*(s.discount/100),cur)}</span></div>`:''}
  <div class="total-row"><span>TOTAL</span><span>${Utils.cur(s.total,cur)}</span></div>
  <div class="row paid"><span>Amount Paid</span><span class="bold">${Utils.cur(s.amountPaid||s.total,cur)}</span></div>
  ${(s.balance||0)>0?`<div class="row bal"><span>Balance Due</span><span class="bold">${Utils.cur(s.balance,cur)}</span></div>`:''}
  <div class="line"></div>
  <div class="center sm bold">Status: ${s.status||'Paid'}</div>
  ${s.notes?`<div class="center sm" style="margin-top:4px">${Utils.esc(s.notes)}</div>`:''}
  <div class="line"></div>
  <div class="center sm">Thank you for your business!</div>
  <div class="center sm bold" style="margin-top:4px">${Utils.esc(bizName)}</div>
</body></html>`;

    // Use hidden iframe to avoid popup blocker on mobile
    var existing = document.getElementById('print-frame');
    if (existing) existing.remove();
    var iframe = document.createElement('iframe');
    iframe.id = 'print-frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(function() {
      try { iframe.contentWindow.print(); }
      catch(e) {
        // Fallback: open in new tab
        var url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        window.open(url, '_blank');
      }
    }, 600);
  },

  printPaymentReceipt(saleId, paymentId, amount, newBalance) {
    const s=DB.getSales().find(x=>x.id===saleId); if(!s) return;
    const settings=DB.getSettings();
    const cur=settings.currency||'$';
    const bizName=settings.bizName||'SmartStock Pro';
    const now=new Date();

    const html=`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Payment Receipt</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:13px;color:#000;background:#fff;padding:12px;max-width:360px;margin:0 auto}
  .center{text-align:center} .bold{font-weight:bold} .lg{font-size:16px} .sm{font-size:11px}
  .line{border-top:1px dashed #000;margin:8px 0}
  .row{display:flex;justify-content:space-between;padding:3px 0}
  .paid{color:#16a34a} .bal{color:#d97706}
  @media print{@page{margin:5mm}body{max-width:100%}}
</style></head>
<body>
  <div class="center bold lg">${Utils.esc(bizName)}</div>
  <div class="center bold sm">PAYMENT RECEIPT</div>
  <div class="center sm">${now.toLocaleString()}</div>
  <div class="line"></div>
  <div class="row"><span>Customer:</span><span class="bold">${Utils.esc(s.customer||'Walk-in')}</span></div>
  <div class="row"><span>Receipt #:</span><span class="bold">${paymentId||'PMT'}</span></div>
  <div class="row"><span>Original Invoice:</span><span>${saleId}</span></div>
  <div class="row"><span>Date:</span><span>${now.toLocaleDateString()}</span></div>
  <div class="line"></div>
  <div class="row"><span>Invoice Total:</span><span>${Utils.cur(s.total,cur)}</span></div>
  <div class="row"><span>Previously Paid:</span><span>${Utils.cur((s.amountPaid||0)-amount,cur)}</span></div>
  <div class="line"></div>
  <div class="row paid bold lg"><span>Amount Paid Today</span><span>${Utils.cur(amount,cur)}</span></div>
  <div class="line"></div>
  <div class="row ${newBalance<=0?'paid':'bal'} bold"><span>Remaining Balance</span><span>${newBalance<=0?'FULLY PAID ✓':Utils.cur(newBalance,cur)}</span></div>
  <div class="line"></div>
  <div class="center sm">Thank you for your payment!</div>
  <div class="center sm bold">${Utils.esc(bizName)}</div>
</body></html>`;

    var existing2 = document.getElementById('print-frame-2');
    if (existing2) existing2.remove();
    var iframe2 = document.createElement('iframe');
    iframe2.id = 'print-frame-2';
    iframe2.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
    document.body.appendChild(iframe2);
    iframe2.contentDocument.open();
    iframe2.contentDocument.write(html);
    iframe2.contentDocument.close();
    setTimeout(function() {
      try { iframe2.contentWindow.print(); }
      catch(e) {
        var url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        window.open(url, '_blank');
      }
    }, 600);
  },
};
