var Sales = {
  filter: 'All',
  cart: [],
  discount: 0,

  // ── RENDER SALES LIST ──────────────────────────────────────────────────────
  render() {
    var pg = Utils.get('pg-sales');
    if (!pg) return;
    var all      = DB.getSales();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var filtered = this.filter === 'All' ? all : all.filter(function(s){ return s.status === Sales.filter; });
    var totalRev    = all.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var collected   = all.filter(function(s){ return s.status==='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var partPaid    = all.filter(function(s){ return s.status==='Partial'; }).reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); }, 0);
    var outstanding = all.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);

    var rows = filtered.map(function(s) {
      var progress = s.status==='Partial'
        ? '<div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:'+Math.min(100,Math.round(((parseFloat(s.amountPaid)||0)/(parseFloat(s.total)||1))*100))+'%;background:var(--wa)"></div></div>'
          + '<div style="font-size:10px;color:var(--wa);margin-top:3px;font-family:var(--fm)">Paid '+Utils.cur(s.amountPaid||0,cur)+' · Bal '+Utils.cur(s.balance||0,cur)+'</div></div>'
        : '';
      var payBtn = s.status!=='Paid'
        ? '<button class="btn-ok btn-sm" onclick="event.stopPropagation();Sales.openPayBalance(\''+s.id+'\')">💳 Pay</button>'
        : '';
      return '<div class="list-item" onclick="Sales.viewInvoice(\''+s.id+'\') ">'
        + '<div class="list-icon" style="background:var(--gb3);border-color:rgba(201,168,76,.15);font-size:20px">🧾</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
        + '<div class="list-meta">'+s.id+' · '+Utils.date(s.date)+'</div>'
        + progress
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val">'+Utils.cur(s.total,cur)+'</div>'
        + '<div style="margin-top:4px">'+Utils.statusBadge(s.status||'Paid')+'</div>'
        + '<div class="list-actions">'
        + '<button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Sales.printReceipt(\''+s.id+'\')" title="Print">🖨</button>'
        + payBtn
        + '<button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Sales.del(\''+s.id+'\')">🗑</button>'
        + '</div></div></div>';
    }).join('');

    var emptyState = '<div class="empty"><div class="empty-icon">🧾</div>'
      + '<div class="empty-title">No '+(this.filter!=='All'?this.filter+' ':'')+'sales yet</div>'
      + '<div class="empty-sub">Tap "+ New Sale" to get started</div>'
      + '<div class="empty-action"><button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button></div></div>';

    var chips = ['All','Paid','Partial','Credit'].map(function(f){
      var cnt = f==='All' ? all.length : all.filter(function(s){ return s.status===f; }).length;
      return '<div class="chip'+(Sales.filter===f?' active':'')+'" onclick="Sales.setFilter(\''+f+'\')">'+f+' ('+cnt+')</div>';
    }).join('');

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Sales</div><div class="page-sub">'+all.length+' invoices total</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button></div>'
      + '</div>'
      + '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">💰</div><div class="kpi-label">Total Revenue</div><div class="kpi-value">'+Utils.cur(totalRev,cur)+'</div><div class="kpi-sub">'+all.length+' invoices</div></div>'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">✅</div><div class="kpi-label">Collected</div><div class="kpi-value">'+Utils.cur(collected+partPaid,cur)+'</div><div class="kpi-sub">'+all.filter(function(s){return s.status==='Paid';}).length+' paid</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">⏳</div><div class="kpi-label">Outstanding</div><div class="kpi-value">'+Utils.cur(outstanding,cur)+'</div><div class="kpi-sub">'+all.filter(function(s){return s.status!=='Paid';}).length+' open</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📊</div><div class="kpi-label">Invoices</div><div class="kpi-value">'+all.length+'</div><div class="kpi-sub">All time</div></div>'
      + '</div></div>'
      + '<div class="chips">'+chips+'</div>'
      + '<div class="sec">'+(filtered.length ? '<div class="card">'+rows+'</div>' : emptyState)+'</div>';
  },

  setFilter: function(f) { this.filter=f; this.render(); },

  // ── NEW SALE FORM ──────────────────────────────────────────────────────────
  openNewSale: function() {
    this.cart=[]; this.discount=0;
    var custs    = DB.getCustomers();
    var prods    = DB.getProducts().filter(function(p){ return p.status!=='inactive' && p.qty>0; });
    var settings = DB.getSettings();
    var cur      = settings.currency||'$';

    var custOpts = prods.map(function(p){
      return '<option value="'+p.id+'">'+Utils.esc(p.name)+' · '+Utils.cur(p.price,cur)+' · '+p.qty+' left</option>';
    }).join('');

    Modal.open({
      title:'New Sale', sub:'Create invoice', barColor:'var(--ok)',
      body: '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">👤 Customer</div>'
          + '<div class="form-row" style="margin-bottom:8px">'
          + '<div class="fg" style="margin:0"><label class="fl">Customer Name</label>'
          + '<input class="fi" id="s-cust-name" placeholder="Type name or Walk-in..." oninput="Sales.onCustNameInput(this.value)" style="font-weight:600"></div>'
          + '<div class="fg" style="margin:0"><label class="fl">Date</label>'
          + '<input class="fi" id="s-date" type="date" value="'+Utils.today()+'"></div></div>'
          + '<input type="hidden" id="s-cust-id" value="">'
          + '<div id="s-cust-suggestions" style="display:none;border:1px solid var(--bd2);border-radius:var(--r8);background:var(--bg2);overflow:hidden;max-height:140px;overflow-y:auto"></div>'
          + '<div id="s-cust-tag" style="display:none;font-size:11px;color:var(--ok);font-weight:600;margin-top:5px;font-family:var(--fm)"></div>'
          + '</div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📦 Products</div>'
          + '<div class="fg" style="margin-bottom:10px"><label class="fl">Add Product</label>'
          + '<select class="fi" id="s-prod-sel" onchange="Sales.addToCart(this)"><option value="">— tap to select product —</option>'+custOpts+'</select></div>'
          + '<div id="s-cart-wrap"><div style="text-align:center;padding:14px 0;color:var(--t3);font-size:13px">No items added yet</div></div>'
          + '</div>'
          + '<div id="s-totals"></div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">💳 Payment</div>'
          + '<div class="form-row" style="margin-bottom:12px">'
          + '<div class="fg" style="margin:0"><label class="fl">Discount %</label><input class="fi" id="s-disc" type="number" value="0" min="0" max="100" oninput="Sales.updateTotals()"></div>'
          + '<div class="fg" style="margin:0"><label class="fl">Payment Method</label><select class="fi" id="s-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Credit</option></select></div>'
          + '</div>'
          + '<div class="fg" style="margin:0"><label class="fl">Amount Paid Now <span style="color:var(--t3);text-transform:none;letter-spacing:0;font-weight:400">(0 = full payment on save)</span></label>'
          + '<input class="fi" id="s-amt-paid" type="number" value="0" min="0" step="0.01" oninput="Sales.updateTotals()" style="font-size:16px;font-weight:700;color:var(--ok)"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Notes (optional)</label><input class="fi" id="s-notes" placeholder="Any extra information..."></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-ghost" onclick="Sales.saveSale(\'new\')" style="color:var(--g);border-color:rgba(201,168,76,.3)">💾 Save &amp; New</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Sales.saveSale(\'close\')">🧾 Save Invoice</button>',
    });
    var nameEl=Utils.get('s-cust-name');
    if(nameEl) nameEl.value='Walk-in Customer';
    this.updateTotals();
  },

  // ── CUSTOMER AUTO-SUGGEST + INFO PANEL ────────────────────────────────────
  onCustNameInput: function(val) {
    Utils.get('s-cust-id').value='';
    Utils.get('s-cust-tag').style.display='none';
    if (!val.trim()) { Utils.get('s-cust-suggestions').style.display='none'; return; }
    var custs = DB.getCustomers().filter(function(c){ return c.name.toLowerCase().indexOf(val.toLowerCase())!==-1; }).slice(0,6);
    var box = Utils.get('s-cust-suggestions');
    if (!custs.length) { box.style.display='none'; return; }
    box.style.display='block';
    var cur = DB.getSettings().currency||'$';
    box.innerHTML = custs.map(function(c){
      var allSales = DB.getSales().filter(function(s){ return s.customerId===c.id||s.customer===c.name; });
      var openBal  = allSales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
      return '<div onclick="Sales.selectCust(\''+c.id+'\',\''+Utils.esc(c.name)+'\')" '
        + 'style="padding:10px 13px;cursor:pointer;font-size:13px;font-weight:600;color:var(--t1);border-bottom:1px solid var(--bd)" '
        + 'onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">'
        + '<span style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#07080D;flex-shrink:0">'+c.name[0].toUpperCase()+'</span>'
        + '<span style="flex:1">'+Utils.esc(c.name)+'</span>'
        + (openBal>0?'<span style="font-size:10px;color:var(--wa);font-weight:700">Owes '+Utils.cur(openBal,cur)+'</span>':'<span style="font-size:10px;color:var(--ok)">Clear</span>')
        + '</div>'
        + '<div style="font-size:10px;color:var(--t2);padding-left:36px">'
        + allSales.length+' invoices · Total spent: '+Utils.cur(c.totalSpent||0,cur)
        + (c.phone?' · '+c.phone:'')
        + '</div></div>';
    }).join('');
  },

  selectCust: function(id, name) {
    Utils.get('s-cust-name').value=name;
    Utils.get('s-cust-id').value=id;
    Utils.get('s-cust-suggestions').style.display='none';
    var tag=Utils.get('s-cust-tag');
    // Show customer info panel
    var c = DB.getCustomers().find(function(x){ return x.id===id; });
    var allSales = DB.getSales().filter(function(s){ return s.customerId===id||s.customer===name; });
    var openBal  = allSales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
    var cur = DB.getSettings().currency||'$';
    var lastSale = allSales[0];
    tag.style.display='block';
    tag.innerHTML = '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r8);padding:10px 12px;margin-top:6px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--ok);margin-bottom:6px">✓ Customer record found</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">'
      + '<div style="color:var(--t3)">Invoices: <span style="color:var(--t1);font-weight:700">'+allSales.length+'</span></div>'
      + '<div style="color:var(--t3)">Total spent: <span style="color:var(--g);font-weight:700">'+Utils.cur(c?c.totalSpent||0:0,cur)+'</span></div>'
      + '<div style="color:var(--t3)">Outstanding: <span style="color:'+(openBal>0?'var(--wa)':'var(--ok)')+';font-weight:700">'+(openBal>0?Utils.cur(openBal,cur):'Clear')+'</span></div>'
      + '<div style="color:var(--t3)">Last sale: <span style="color:var(--t1);font-weight:700">'+(lastSale?Utils.date(lastSale.date):'None')+'</span></div>'
      + '</div>'
      + (openBal>0?'<div style="font-size:10px;color:var(--wa);margin-top:6px;font-weight:600">⚠️ This customer has an outstanding balance of '+Utils.cur(openBal,cur)+'</div>':'')
      + '</div>';
  },

  // ── CART ───────────────────────────────────────────────────────────────────
  addToCart: function(sel) {
    var id=sel.value; if(!id) return;
    var p=DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    sel.value='';
    var ex=this.cart.find(function(i){ return i.id===id; });
    if(ex) ex.qty++; else this.cart.push({id:p.id,name:p.name,price:p.price,cost:p.cost||0,qty:1,maxQty:p.qty});
    this.renderCart();
  },

  renderCart: function() {
    var el=Utils.get('s-cart-wrap'); if(!el) return;
    var cur=DB.getSettings().currency||'$';
    if(!this.cart.length){
      el.innerHTML='<div style="text-align:center;padding:14px 0;color:var(--t3);font-size:13px">No items added yet</div>';
      this.updateTotals(); return;
    }
    el.innerHTML=this.cart.map(function(item,i){
      return '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px 13px;margin-bottom:8px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);flex:1;padding-right:8px">'+Utils.esc(item.name)+'</div>'
        + '<button onclick="Sales.removeItem('+i+')" style="width:22px;height:22px;border-radius:50%;background:var(--erb);border:1px solid var(--erbd);color:var(--er);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end">'
        + '<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Qty</div>'
        + '<div style="display:flex;align-items:center;gap:5px">'
        + '<button onclick="Sales.changeQty('+i+',-1)" style="width:26px;height:26px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd2);color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">−</button>'
        + '<input type="number" value="'+item.qty+'" min="1" oninput="Sales.setQty('+i+',this.value)" style="width:44px;text-align:center;font-size:14px;font-weight:700;color:var(--t1);background:var(--bg3);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 2px;-webkit-appearance:none">'
        + '<button onclick="Sales.changeQty('+i+',1)" style="width:26px;height:26px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd2);color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">+</button>'
        + '</div></div>'
        + '<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Unit Price</div>'
        + '<input type="number" value="'+item.price+'" min="0" step="0.01" oninput="Sales.setPrice('+i+',this.value)" style="width:100%;text-align:right;font-size:14px;font-weight:700;color:var(--g);background:var(--bg3);border:1.5px solid rgba(201,168,76,.3);border-radius:6px;padding:5px 8px;-webkit-appearance:none">'
        + '</div>'
        + '<div style="text-align:right"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Line Total</div>'
        + '<div style="font-size:16px;font-weight:800;color:var(--g)" id="lt-'+i+'">'+Utils.cur(item.price*item.qty,cur)+'</div>'
        + '</div></div></div>';
    }).join('');
    this.updateTotals();
  },

  changeQty: function(i,d){ if(this.cart[i]){this.cart[i].qty=Math.max(1,(this.cart[i].qty||1)+d);this.renderCart();} },

  setQty: function(i,val){
    var n=parseInt(val); if(!this.cart[i]||isNaN(n)||n<1) return;
    this.cart[i].qty=n;
    var cur=DB.getSettings().currency||'$';
    var el=Utils.get('lt-'+i); if(el) el.textContent=Utils.cur(this.cart[i].price*n,cur);
    this.updateTotals();
  },

  setPrice: function(i,val){
    var n=parseFloat(val); if(!this.cart[i]||isNaN(n)||n<0) return;
    this.cart[i].price=n;
    var cur=DB.getSettings().currency||'$';
    var el=Utils.get('lt-'+i); if(el) el.textContent=Utils.cur(n*this.cart[i].qty,cur);
    this.updateTotals();
  },

  removeItem: function(i){ this.cart.splice(i,1); this.renderCart(); },

  // ── TOTALS ─────────────────────────────────────────────────────────────────
  updateTotals: function(){
    var totEl=Utils.get('s-totals');
    var cur=DB.getSettings().currency||'$';
    this.discount=parseFloat(Utils.val('s-disc')||0);
    if(!this.cart.length){ if(totEl) totEl.innerHTML=''; return; }
    var sub     = this.cart.reduce(function(a,i){ return a+(parseFloat(i.price)||0)*(parseInt(i.qty)||0); },0);
    var discAmt = sub*(this.discount/100);
    var total   = sub-discAmt;
    var paidRaw = parseFloat(Utils.val('s-amt-paid')||0);
    var paid    = Math.min(paidRaw, total);
    var balance = Math.max(0, total-paid);
    var method  = (Utils.get('s-method')||{value:'Cash'}).value||'Cash';
    var status  = paid>0&&balance>0?'Partial':(paidRaw<=0&&method==='Credit')?'Credit':'Paid';
    var sc      = {Paid:'var(--ok)',Partial:'var(--wa)',Credit:'var(--er)'}[status];
    var showPartial = paidRaw>0 && balance>0;
    var noteHtml = paidRaw<=0 && method!=='Credit'
      ? '<div style="font-size:11px;color:var(--ok);margin-top:8px;font-weight:600">✓ Full payment assumed on save</div>' : '';
    var progressHtml = showPartial
      ? '<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-bottom:5px"><span>Progress</span><span>'+Math.round((paidRaw/total)*100)+'% paid</span></div>'
        + '<div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">'
        + '<div style="height:100%;width:'+Math.round((paidRaw/total)*100)+'%;background:linear-gradient(90deg,var(--ok),var(--g));border-radius:3px"></div></div></div>' : '';
    var discHtml = this.discount>0
      ? '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--t2)">Subtotal</span><span style="font-size:13px;font-weight:600;font-family:var(--fm)">'+Utils.cur(sub,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--er)">Discount ('+this.discount+'%)</span><span style="font-size:13px;font-weight:600;color:var(--er);font-family:var(--fm)">−'+Utils.cur(discAmt,cur)+'</span></div>' : '';
    var paidHtml = showPartial
      ? '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--ok);font-weight:600">✓ Amount Paid</span><span style="font-size:14px;font-weight:700;color:var(--ok);font-family:var(--fm)">'+Utils.cur(paidRaw,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--wa);font-weight:600">⏳ Balance Due</span><span style="font-size:14px;font-weight:700;color:var(--wa);font-family:var(--fm)">'+Utils.cur(balance,cur)+'</span></div>' : '';
    if(totEl) totEl.innerHTML = '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">🧮 Order Summary</div>'
      + discHtml
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd2)"><span style="font-size:15px;font-weight:800;color:var(--t1)">Total Amount</span><span style="font-size:18px;font-weight:900;color:var(--g);letter-spacing:-.02em;font-family:var(--fm)">'+Utils.cur(total,cur)+'</span></div>'
      + paidHtml + progressHtml
      + '<div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:var(--t3)">Invoice status</span><span style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;background:'+sc+'18;border:1px solid '+sc+'40;color:'+sc+'">'+status+'</span></div>'
      + noteHtml+'</div>';
  },

  // ── SAVE SALE ──────────────────────────────────────────────────────────────
  saveSale: function(action){
    action=action||'close';
    if(!this.cart.length){ Toast.show('Add at least one product','err'); return; }
    var custName = Utils.val('s-cust-name').trim()||'Walk-in Customer';
    var custId   = Utils.val('s-cust-id')||null;
    var method   = (Utils.get('s-method')||{value:'Cash'}).value||'Cash';
    var sub      = this.cart.reduce(function(a,i){ return a+(parseFloat(i.price)||0)*(parseInt(i.qty)||0); },0);
    var discAmt  = sub*(this.discount/100);
    var total    = sub-discAmt;
    var paidRaw  = parseFloat(Utils.val('s-amt-paid')||0);
    var paid     = Math.min(paidRaw, total);
    var balance  = Math.max(0, total-paid);
    var status   = paid>0&&balance>0?'Partial':(paid<=0&&method==='Credit')?'Credit':'Paid';

    var finalCustId = custId;
    if (!finalCustId && custName && custName.toLowerCase()!=='walk-in customer') {
      var nc = DB.findOrCreateCustomer(custName);
      if (nc) finalCustId = nc.id;
    }
    var cust = finalCustId ? DB.getCustomers().find(function(c){ return c.id===finalCustId; }) : null;

    var sale = DB.addSale({
      customer:custName, customerId:finalCustId||null,
      items:this.cart.map(function(i){ return {id:i.id,name:i.name,price:i.price,cost:i.cost,qty:i.qty}; }),
      subtotal:sub, discount:this.discount, total:total,
      amountPaid:status==='Paid'?total:paid,
      balance:status==='Paid'?0:balance,
      payment:method, status:status,
      date:Utils.val('s-date')||Utils.today(),
      notes:Utils.val('s-notes'),
    });

    if (paid>0 || status==='Paid') {
      DB.addPayment({ saleId:sale.id, customerId:finalCustId||null,
        amount:status==='Paid'?total:paid, method:method,
        note:'Initial payment', invoiceRef:sale.id });
    }
    this.cart.forEach(function(item){
      var p=DB.getProducts().find(function(x){ return x.id===item.id; });
      if(p) DB.updateProduct(item.id,{qty:Math.max(0,(p.qty||0)-(parseInt(item.qty)||0))});
    });
    if(cust) DB.updateCustomer(finalCustId,{totalSpent:(cust.totalSpent||0)+total,purchases:(cust.purchases||0)+1});

    Toast.show('Invoice '+sale.id+' saved ✓','ok');
    Notifs.check();

    if(action==='new'){
      this.cart=[]; this.discount=0;
      var n=Utils.get('s-cust-name'); if(n) n.value='Walk-in Customer';
      Utils.get('s-cust-id').value='';
      Utils.get('s-cust-tag').style.display='none';
      var d=Utils.get('s-disc'); if(d) d.value='0';
      var p2=Utils.get('s-amt-paid'); if(p2) p2.value='0';
      var nt=Utils.get('s-notes'); if(nt) nt.value='';
      this.renderCart();
      Toast.show('Ready for next sale','ok');
      this.render();
    } else {
      Modal.close();
      this.render();
      // Show print prompt after close
      var sid = sale.id;
      setTimeout(function(){ Sales.showPrintPrompt(sid,'invoice'); }, 350);
    }
  },

  // ── VIEW INVOICE + FULL PAYMENT HISTORY ───────────────────────────────────
  viewInvoice: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var payments=DB.getPaymentsForSale(id);
    var settings=DB.getSettings();
    var cur=settings.currency||'$';

    var itemsHtml = (s.items||[]).map(function(item){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd)">'
        + '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(item.name)+'</div>'
        + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+item.qty+' × '+Utils.cur(item.price,cur)+'</div></div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--g)">'+Utils.cur(item.price*item.qty,cur)+'</div></div>';
    }).join('');

    var paymentsHtml = payments.length>0
      ? '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-top:12px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">💳 Payment History ('+payments.length+')</div>'
        + payments.map(function(p,idx){
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">'
              + '<div>'
              + '<div style="font-size:12px;font-weight:700;color:var(--t1)">#'+(idx+1)+' — '+Utils.esc(p.note||'Payment')+'</div>'
              + '<div style="font-size:10px;color:var(--t3);font-family:var(--fm)">'+p.id+' · '+(p.paidAt?new Date(p.paidAt).toLocaleDateString():'')+' · '+(p.method||'Cash')+'</div>'
              + '</div>'
              + '<div style="text-align:right">'
              + '<div style="font-size:14px;font-weight:800;color:var(--ok);font-family:var(--fm)">'+Utils.cur(p.amount,cur)+'</div>'
              + '<button onclick="Sales.printPaymentReceipt(\''+id+'\',\''+p.id+'\','+p.amount+',0)" style="font-size:10px;color:var(--g);background:var(--gb);border:1px solid rgba(201,168,76,.2);border-radius:4px;padding:2px 7px;cursor:pointer;margin-top:3px">🖨 Print</button>'
              + '</div></div>';
          }).join('')
        + '</div>' : '';

    var barColor = s.status==='Paid'?'var(--ok)':s.status==='Partial'?'var(--wa)':'var(--er)';
    var footerPayBtn = s.status!=='Paid'
      ? '<button class="btn-primary" style="flex:1" onclick="Modal.close();Sales.openPayBalance(\''+id+'\')">💳 Pay Balance</button>'
      : '<button class="btn-ok" style="flex:1" disabled>✅ Fully Paid</button>';

    Modal.open({
      title:'Invoice '+s.id, sub:Utils.date(s.date), barColor:barColor,
      body: '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:14px;margin-bottom:12px">'
          + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:3px">'+Utils.esc(s.customer||'Walk-in')+'</div>'
          + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+s.id+' · '+Utils.date(s.date)+' · '+(s.payment||'Cash')+'</div>'
          + '</div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Items</div>'
          + itemsHtml + '</div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px">'
          + (s.discount>0?'<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:var(--t2);font-size:13px">Discount ('+s.discount+'%)</span><span style="color:var(--er);font-family:var(--fm)">−'+Utils.cur((s.subtotal||0)*(s.discount/100),cur)+'</span></div>':'')
          + '<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--bd)"><span style="font-size:15px;font-weight:800;color:var(--t1)">Total</span><span style="font-size:17px;font-weight:900;color:var(--g);font-family:var(--fm)">'+Utils.cur(s.total,cur)+'</span></div>'
          + '<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:var(--ok);font-size:13px;font-weight:600">✓ Paid</span><span style="color:var(--ok);font-family:var(--fm);font-weight:700">'+Utils.cur(s.amountPaid||0,cur)+'</span></div>'
          + ((s.balance||0)>0?'<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:var(--wa);font-size:13px;font-weight:600">⏳ Balance</span><span style="color:var(--wa);font-family:var(--fm);font-weight:700">'+Utils.cur(s.balance,cur)+'</span></div>':'')
          + '</div>'
          + paymentsHtml,
      footer: '<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            + '<button class="btn-ghost" onclick="Sales.printReceipt(\''+id+\')" style="padding:10px 14px">🖨 Print</button>'
            + footerPayBtn,
    });
  },

  // ── PAY BALANCE ────────────────────────────────────────────────────────────
  openPayBalance: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var cur=DB.getSettings().currency||'$';
    var bal=parseFloat(s.balance)||0;
    var payments=DB.getPaymentsForSale(id);

    var histHtml = payments.length>0
      ? '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r8);padding:10px;margin-bottom:12px">'
        + '<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Previous Payments</div>'
        + payments.map(function(p){
            return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">'
              +'<span style="color:var(--t2)">'+Utils.esc(p.note||'Payment')+' · '+(p.paidAt?new Date(p.paidAt).toLocaleDateString():'')+'</span>'
              +'<span style="color:var(--ok);font-weight:700">'+Utils.cur(p.amount,cur)+'</span></div>';
          }).join('')
        + '</div>' : '';

    Modal.open({
      title:'Pay Balance', sub:'Invoice '+s.id+' · '+Utils.esc(s.customer||'Walk-in'), barColor:'var(--wa)',
      body: histHtml
          + '<div style="background:var(--gb3);border:1px solid rgba(201,168,76,.2);border-radius:var(--r10);padding:14px;margin-bottom:14px">'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;color:var(--t2)">Original Total</span><span style="font-weight:700;font-family:var(--fm)">'+Utils.cur(s.total,cur)+'</span></div>'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;color:var(--ok)">Already Paid</span><span style="font-weight:700;color:var(--ok);font-family:var(--fm)">'+Utils.cur(s.amountPaid||0,cur)+'</span></div>'
          + '<div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(201,168,76,.2)"><span style="font-size:15px;font-weight:800;color:var(--wa)">Outstanding Balance</span><span style="font-size:18px;font-weight:900;color:var(--wa);font-family:var(--fm)">'+Utils.cur(bal,cur)+'</span></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Amount Paying Now *</label>'
          + '<input class="fi" id="pb-amount" type="number" value="'+bal.toFixed(2)+'" min="0.01" max="'+bal.toFixed(2)+'" step="0.01" style="font-size:18px;font-weight:800;color:var(--ok)" oninput="Sales.updateBalancePreview(\''+id+'\',this.value)"></div>'
          + '<div class="fg"><label class="fl">Payment Method</label><select class="fi" id="pb-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div>'
          + '<div class="fg"><label class="fl">Note (optional)</label><input class="fi" id="pb-note" placeholder="e.g. Balance payment"></div>'
          + '<div id="pb-preview"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Sales.saveBalancePayment(\''+id+'\')">💳 Record Payment</button>',
    });
    this.updateBalancePreview(id, bal.toFixed(2));
  },

  updateBalancePreview: function(id,val){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var cur=DB.getSettings().currency||'$';
    var paying=Math.min(parseFloat(val)||0, parseFloat(s.balance)||0);
    var newBal=Math.max(0,(parseFloat(s.balance)||0)-paying);
    var el=Utils.get('pb-preview'); if(!el) return;
    el.innerHTML = '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-top:4px">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;color:var(--ok)">Paying Now</span><span style="font-weight:700;color:var(--ok);font-family:var(--fm)">'+Utils.cur(paying,cur)+'</span></div>'
      + '<div style="display:flex;justify-content:space-between"><span style="font-size:13px;color:'+(newBal<=0?'var(--ok)':'var(--wa)')+';font-weight:700">New Balance</span>'
      + '<span style="font-weight:800;font-family:var(--fm);color:'+(newBal<=0?'var(--ok)':'var(--wa)')+'">'+( newBal<=0?'✅ FULLY PAID':Utils.cur(newBal,cur))+'</span></div></div>';
  },

  saveBalancePayment: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var paying=Math.min(parseFloat(Utils.val('pb-amount'))||0, parseFloat(s.balance)||0);
    if(paying<=0){ Toast.show('Enter a valid amount','err'); return; }
    var method=(Utils.get('pb-method')||{value:'Cash'}).value||'Cash';
    var note=Utils.val('pb-note')||'Balance payment';
    var newBal=Math.max(0,(parseFloat(s.balance)||0)-paying);
    var newPaid=(parseFloat(s.amountPaid)||0)+paying;
    var newStatus=newBal<=0?'Paid':'Partial';
    DB.updateSale(id,{amountPaid:newPaid,balance:newBal,status:newStatus});
    var pmt=DB.addPayment({saleId:id,customerId:s.customerId||null,amount:paying,method:method,note:note,invoiceRef:'PMT-'+id});
    Modal.close();
    Toast.show(newStatus==='Paid'?'Invoice fully paid! ✅':'Payment recorded ✓','ok');
    this.render();
    // Print prompt
    var pid=pmt.id; var nb=newBal;
    setTimeout(function(){ Sales.showPrintPrompt(id,'payment',pid,paying,nb); }, 350);
  },

  markPaid: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    DB.updateSale(id,{status:'Paid',amountPaid:s.total,balance:0});
    DB.addPayment({saleId:id,customerId:s.customerId||null,amount:s.balance||0,method:'Cash',note:'Full settlement'});
    Toast.show('Marked as fully paid ✓','ok'); this.render();
  },

  del: function(id){
    confirmDel('Delete this invoice?',function(){ DB.deleteSale(id); Toast.show('Deleted','warn'); Sales.render(); });
  },

  // ── PRINT PROMPT ───────────────────────────────────────────────────────────
  showPrintPrompt: function(saleId,type,paymentId,amount,newBalance){
    var s=DB.getSales().find(function(x){ return x.id===saleId; }); if(!s) return;
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var isPayment=type==='payment';
    window._printArgs={saleId:saleId,type:type,paymentId:paymentId,amount:amount,newBalance:newBalance};
    Modal.open({
      title:    isPayment?'✅ Payment Recorded!':'✅ Invoice Saved!',
      sub:      isPayment?'Paid '+Utils.cur(amount||0,cur)+' — '+Utils.esc(s.customer||'Customer'):saleId+' · '+Utils.esc(s.customer||'Walk-in')+' · '+Utils.cur(s.total,cur),
      barColor: 'var(--ok)',
      body: '<div style="text-align:center;padding:16px 0 20px">'
          + '<div style="font-size:52px;margin-bottom:14px">'+(isPayment?'💳':'🧾')+'</div>'
          + '<div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:8px">'+(isPayment?'Payment receipt ready':'Invoice saved successfully')+'</div>'
          + '<div style="font-size:13px;color:var(--t2);line-height:1.6">Would you like to print the '+(isPayment?'payment receipt':'customer receipt')+' now?</div></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()" style="flex:1">Not Now</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Sales._doPrint()">🖨 Print Now</button>',
    });
  },

  _doPrint: function(){
    Modal.close();
    var args=window._printArgs; if(!args) return;
    window._printArgs=null;
    if(args.type==='payment') Sales.printPaymentReceipt(args.saleId,args.paymentId,args.amount,args.newBalance);
    else Sales.printReceipt(args.saleId);
  },

  // ── PRINT RECEIPT ──────────────────────────────────────────────────────────
  printReceipt: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var bizName=settings.bizName||'SmartStock Pro';
    var now=new Date();
    var payments=DB.getPaymentsForSale(id);

    var itemRows=(s.items||[]).map(function(item){
      return '<div class="row"><span style="flex:1;padding-right:8px">'+item.name+'</span></div>'
            +'<div class="row sm"><span>'+item.qty+' x '+Utils.cur(item.price,cur)+'</span><span class="bold">'+Utils.cur(item.price*item.qty,cur)+'</span></div>';
    }).join('');

    var payHistRows=payments.length>1
      ? '<div class="line"></div><div class="bold sm" style="margin-bottom:4px">PAYMENT HISTORY</div>'
        +payments.map(function(p,i){
          return '<div class="row sm"><span>#'+(i+1)+' '+( p.paidAt?new Date(p.paidAt).toLocaleDateString():'')+'</span><span class="paid bold">'+Utils.cur(p.amount,cur)+'</span></div>';
        }).join('') : '';

    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt '+s.id+'</title>'
      +'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Courier New",monospace;font-size:13px;color:#000;background:#fff;padding:12px;max-width:360px;margin:0 auto}.center{text-align:center}.bold{font-weight:bold}.lg{font-size:16px}.sm{font-size:11px}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;padding:3px 0}.paid{color:#16a34a}.bal{color:#d97706}@media print{@page{margin:5mm}body{max-width:100%}}</style></head><body>'
      +'<div class="center bold lg">'+bizName+'</div>'
      +'<div class="center sm">Business Receipt</div>'
      +'<div class="center sm">'+now.toLocaleString()+'</div>'
      +'<div class="line"></div>'
      +'<div class="row"><span>Customer:</span><span class="bold">'+Utils.esc(s.customer||'Walk-in')+'</span></div>'
      +'<div class="row"><span>Invoice #:</span><span class="bold">'+s.id+'</span></div>'
      +'<div class="row"><span>Date:</span><span>'+Utils.date(s.date)+'</span></div>'
      +'<div class="row"><span>Payment:</span><span>'+(s.payment||'Cash')+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="bold sm" style="margin-bottom:4px">ITEMS</div>'
      +itemRows
      +'<div class="line"></div>'
      +(s.discount>0?'<div class="row"><span>Discount ('+s.discount+'%)</span><span>-'+Utils.cur((s.subtotal||0)*(s.discount/100),cur)+'</span></div>':'')
      +'<div class="row bold lg"><span>TOTAL</span><span>'+Utils.cur(s.total,cur)+'</span></div>'
      +'<div class="row paid"><span>Amount Paid</span><span class="bold">'+Utils.cur(s.amountPaid||s.total,cur)+'</span></div>'
      +((s.balance||0)>0?'<div class="row bal"><span>Balance Due</span><span class="bold">'+Utils.cur(s.balance,cur)+'</span></div>':'')
      +payHistRows
      +'<div class="line"></div>'
      +'<div class="center sm bold">Status: '+(s.status||'Paid')+'</div>'
      +(s.notes?'<div class="center sm" style="margin-top:4px">'+Utils.esc(s.notes)+'</div>':'')
      +'<div class="line"></div>'
      +'<div class="center sm">Thank you for your business!</div>'
      +'<div class="center sm bold" style="margin-top:4px">'+bizName+'</div>'
      +'</body></html>';

    Sales._printHtml(html,'print-frame');
  },

  printPaymentReceipt: function(saleId,paymentId,amount,newBalance){
    var s=DB.getSales().find(function(x){ return x.id===saleId; }); if(!s) return;
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var bizName=settings.bizName||'SmartStock Pro';
    var now=new Date();
    var allPayments=DB.getPaymentsForSale(saleId);

    var payHistRows=allPayments.map(function(p,i){
      return '<div class="row sm"><span>#'+(i+1)+' '+Utils.esc(p.note||'Payment')+' · '+(p.paidAt?new Date(p.paidAt).toLocaleDateString():'')+'</span><span class="paid bold">'+Utils.cur(p.amount,cur)+'</span></div>';
    }).join('');

    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Receipt</title>'
      +'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Courier New",monospace;font-size:13px;color:#000;background:#fff;padding:12px;max-width:360px;margin:0 auto}.center{text-align:center}.bold{font-weight:bold}.lg{font-size:16px}.sm{font-size:11px}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;padding:3px 0}.paid{color:#16a34a}.bal{color:#d97706}@media print{@page{margin:5mm}body{max-width:100%}}</style></head><body>'
      +'<div class="center bold lg">'+bizName+'</div>'
      +'<div class="center bold sm">PAYMENT RECEIPT</div>'
      +'<div class="center sm">'+now.toLocaleString()+'</div>'
      +'<div class="line"></div>'
      +'<div class="row"><span>Customer:</span><span class="bold">'+Utils.esc(s.customer||'Walk-in')+'</span></div>'
      +'<div class="row"><span>Receipt #:</span><span class="bold">'+(paymentId||'PMT')+'</span></div>'
      +'<div class="row"><span>Original Invoice:</span><span>'+saleId+'</span></div>'
      +'<div class="row"><span>Date:</span><span>'+now.toLocaleDateString()+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="row"><span>Invoice Total:</span><span>'+Utils.cur(s.total,cur)+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="bold sm" style="margin-bottom:4px">ALL PAYMENTS</div>'
      +payHistRows
      +'<div class="line"></div>'
      +'<div class="row paid bold lg"><span>Amount Paid Today</span><span>'+Utils.cur(amount,cur)+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="row '+(newBalance<=0?'paid':'bal')+' bold"><span>Remaining Balance</span><span>'+(newBalance<=0?'FULLY PAID ✓':Utils.cur(newBalance,cur))+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="center sm">Thank you for your payment!</div>'
      +'<div class="center sm bold">'+bizName+'</div>'
      +'</body></html>';

    Sales._printHtml(html,'print-frame-2');
  },

  // ── SHARED PRINT HELPER ────────────────────────────────────────────────────
  _printHtml: function(html, frameId){
    var old=document.getElementById(frameId); if(old) old.remove();
    var f=document.createElement('iframe');
    f.id=frameId;
    f.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
    document.body.appendChild(f);
    try {
      f.contentDocument.open();
      f.contentDocument.write(html);
      f.contentDocument.close();
      setTimeout(function(){
        try { f.contentWindow.print(); }
        catch(e){ window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank'); }
      }, 600);
    } catch(e){
      window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank');
    }
  },
};
