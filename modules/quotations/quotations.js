/* === quotations.js === */
var Quotations = {
  filter: 'All',

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN LIST
  // ══════════════════════════════════════════════════════════════════════════
  render: function() {
    var pg = Utils.get('pg-quotations');
    if (!pg) return;
    var list     = DB.getQuotations();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var today    = Utils.today();

    // Auto-mark expired
    list.forEach(function(q) {
      if (q.status === 'Sent' && q.expiryDate && q.expiryDate < today) {
        DB.updateQuotation(q.id, {status: 'Expired'});
      }
    });
    list = DB.getQuotations();

    var filters = ['All','Draft','Sent','Approved','Declined','Expired'];
    var filtered = this.filter === 'All' ? list : list.filter(function(q){ return q.status === Quotations.filter; });

    var totalVal  = list.reduce(function(a,q){ return a+(parseFloat(q.total)||0); },0);
    var approved  = list.filter(function(q){ return q.status==='Approved'; });
    var approvedV = approved.reduce(function(a,q){ return a+(parseFloat(q.total)||0); },0);
    var pending   = list.filter(function(q){ return q.status==='Sent'; }).length;

    var chips = filters.map(function(f){
      var cnt = f==='All' ? list.length : list.filter(function(q){ return q.status===f; }).length;
      return '<div class="chip'+(Quotations.filter===f?' active':'')+'" onclick="Quotations.setFilter(\''+f+'\')">'
        +f+' ('+cnt+')</div>';
    }).join('');

    var rows = filtered.map(function(q) {
      var sc = {Draft:'var(--t3)',Sent:'var(--in)',Approved:'var(--ok)',Declined:'var(--er)',Expired:'var(--wa)'}[q.status]||'var(--t3)';
      var expired = q.expiryDate && q.expiryDate < today && q.status !== 'Declined';
      return '<div class="list-item" onclick="Quotations.viewQuotation(\''+q.id+'\')">'
        +'<div class="list-icon" style="background:var(--inb);font-size:18px">📄</div>'
        +'<div class="list-info">'
        +'<div class="list-name">'+Utils.esc(q.clientName||'No client')+'</div>'
        +'<div class="list-meta" style="font-family:var(--fm)">'+q.id+' · '+Utils.date(q.date)+'</div>'
        +(q.expiryDate?'<div class="list-meta" style="font-size:10px;color:'+(expired?'var(--er)':'var(--t3)')+'">Expires: '+Utils.date(q.expiryDate)+(expired?' ⚠️ EXPIRED':' ')+'</div>':'')
        +'</div>'
        +'<div class="list-right">'
        +'<div class="list-val">'+Utils.cur(q.total||0,cur)+'</div>'
        +'<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40">'+q.status+'</span>'
        +'<div class="list-actions">'
        +'<button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Quotations.printQuotation(\''+q.id+'\')" title="Print">🖨</button>'
        +(q.status!=='Approved'&&q.status!=='Declined'?'<button class="btn-ok btn-sm" onclick="event.stopPropagation();Quotations.convertToInvoice(\''+q.id+'\')">→ Invoice</button>':'')
        +'<button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Quotations.del(\''+q.id+'\')">🗑</button>'
        +'</div></div></div>';
    }).join('');

    pg.innerHTML = '<div class="page-header">'
      +'<div><div class="page-title">Quotations</div><div class="page-sub">'+list.length+' quotations total</div></div>'
      +'<div class="page-actions"><button class="btn-primary btn-sm" onclick="Quotations.openNewQuotation()">＋ New Quote</button></div>'
      +'</div>'
      +'<div class="sec"><div class="kpi-grid">'
      +'<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📄</div><div class="kpi-label">Total Quotes</div><div class="kpi-value">'+list.length+'</div><div class="kpi-sub">'+Utils.cur(totalVal,cur)+'</div></div>'
      +'<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">⏳</div><div class="kpi-label">Pending</div><div class="kpi-value">'+pending+'</div><div class="kpi-sub">Awaiting response</div></div>'
      +'<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">✅</div><div class="kpi-label">Approved</div><div class="kpi-value">'+approved.length+'</div><div class="kpi-sub">'+Utils.cur(approvedV,cur)+'</div></div>'
      +'<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">📊</div><div class="kpi-label">Conversion</div><div class="kpi-value">'+(list.length?Math.round((approved.length/list.length)*100):0)+'%</div><div class="kpi-sub">Approval rate</div></div>'
      +'</div></div>'
      +'<div class="chips">'+chips+'</div>'
      +'<div class="sec">'
      +(filtered.length?'<div class="card">'+rows+'</div>'
        :'<div class="empty"><div class="empty-icon">📄</div><div class="empty-title">No '+(this.filter!=='All'?this.filter+' ':'')+'quotations yet</div>'
          +'<div class="empty-sub">Create professional quotations for your clients</div>'
          +'<div class="empty-action"><button class="btn-primary btn-sm" onclick="Quotations.openNewQuotation()">＋ New Quotation</button></div></div>')
      +'</div>';
  },

  setFilter: function(f) { this.filter=f; this.render(); },

  // ══════════════════════════════════════════════════════════════════════════
  // NEW QUOTATION FORM
  // ══════════════════════════════════════════════════════════════════════════
  _cart: [],
  _discount: 0,
  _tax: 0,

  openNewQuotation: function() {
    this._cart = [];
    this._discount = 0;
    this._tax = 0;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var custs    = DB.getCustomers();
    var nextNum  = this._nextNumber();

    var custSugg = custs.slice(0,50).map(function(c){
      return '<option value="'+Utils.esc(c.name)+'">';
    }).join('');

    Modal.open({
      title: 'New Quotation', sub: nextNum, barColor: 'var(--in)',
      body: '<datalist id="qt-cust-list">'+custSugg+'</datalist>'

        // Client info
        +'<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        +'<div style="font-size:10px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">👤 Client Information</div>'
        +'<div class="form-row" style="margin-bottom:8px">'
        +'<div class="fg" style="margin:0"><label class="fl">Client Name *</label>'
        +'<input class="fi" id="qt-client" list="qt-cust-list" placeholder="Type or select client..." oninput="Quotations._onClientInput(this.value)"></div>'
        +'<div class="fg" style="margin:0"><label class="fl">Phone</label>'
        +'<input class="fi" id="qt-phone" type="tel" placeholder="+231 77 000 000"></div>'
        +'</div>'
        +'<div class="form-row">'
        +'<div class="fg" style="margin:0"><label class="fl">Email</label>'
        +'<input class="fi" id="qt-email" type="email" placeholder="client@email.com"></div>'
        +'<div class="fg" style="margin:0"><label class="fl">Address</label>'
        +'<input class="fi" id="qt-addr" placeholder="Client address"></div>'
        +'</div>'
        +'<div id="qt-client-info" style="display:none;margin-top:8px;font-size:11px;color:var(--ok);font-weight:600"></div>'
        +'</div>'

        // Dates
        +'<div class="form-row" style="margin-bottom:14px">'
        +'<div class="fg"><label class="fl">Date</label><input class="fi" id="qt-date" type="date" value="'+Utils.today()+'"></div>'
        +'<div class="fg"><label class="fl">Expiry Date</label><input class="fi" id="qt-expiry" type="date"></div>'
        +'</div>'

        // Products
        +'<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        +'<div style="font-size:10px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📦 Products / Services</div>'
        +'<div class="fg" style="margin-bottom:10px"><label class="fl">Add Product</label>'
        +'<select class="fi" id="qt-prod-sel" onchange="Quotations._addItem(this)">'+QuickCreate.productOptions()+'</select></div>'
        +'<div id="qt-items-wrap"><div style="text-align:center;padding:14px;color:var(--t3);font-size:13px">No items added yet</div></div>'
        +'</div>'

        // Totals
        +'<div id="qt-totals"></div>'

        // Terms
        +'<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        +'<div style="font-size:10px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📝 Terms & Notes</div>'
        +'<div class="fg" style="margin-bottom:8px"><label class="fl">Payment Terms</label>'
        +'<select class="fi" id="qt-payterms"><option>Immediate</option><option>Net 7</option><option>Net 14</option><option>Net 30</option><option>Net 60</option><option>50% Upfront</option></select></div>'
        +'<div class="fg" style="margin-bottom:8px"><label class="fl">Notes to Client</label>'
        +'<input class="fi" id="qt-notes" placeholder="Additional notes for the client..."></div>'
        +'<div class="fg"><label class="fl">Terms & Conditions</label>'
        +'<input class="fi" id="qt-terms" placeholder="e.g. Prices valid for 30 days. Delivery not included."></div>'
        +'</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-ghost" onclick="Quotations.saveQuotation(\'draft\')" style="color:var(--t2)">💾 Save Draft</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Quotations.saveQuotation(\'sent\')">📤 Save &amp; Print</button>',
    });
    this._renderItems();
    this._renderTotals();
  },

  _nextNumber: function() {
    var list = DB.getQuotations();
    var year = new Date().getFullYear();
    var num  = list.length + 1;
    return 'QT-' + year + '-' + String(num).padStart(4,'0');
  },

  _onClientInput: function(val) {
    var infoEl = Utils.get('qt-client-info');
    if (!val.trim()) { if(infoEl) infoEl.style.display='none'; return; }
    var cust = DB.getCustomers().find(function(c){ return c.name.toLowerCase()===val.toLowerCase().trim(); });
    if (cust) {
      var phone = Utils.get('qt-phone'); if(phone&&!phone.value) phone.value = cust.phone||'';
      var email = Utils.get('qt-email'); if(email&&!email.value) email.value = cust.email||'';
      var addr  = Utils.get('qt-addr');  if(addr&&!addr.value)   addr.value  = cust.address||'';
      if (infoEl) {
        infoEl.textContent = '✓ Existing customer — '+DB.getSales().filter(function(s){ return s.customerId===cust.id; }).length+' previous invoices';
        infoEl.style.display = 'block';
      }
    } else { if(infoEl) infoEl.style.display='none'; }
  },

  _addItem: function(sel) {
    if (QuickCreate.onProductChange(sel, function(newProd) {
      var s2 = Utils.get('qt-prod-sel'); if(s2) s2.innerHTML = QuickCreate.productOptions();
      Quotations._cart.push({id:newProd.id,name:newProd.name,qty:1,price:newProd.price,discount:0,tax:0,unit:newProd.unit||'Pcs'});
      Quotations._renderItems(); Quotations._renderTotals();
    })) return;
    var id = sel.value; if (!id) return;
    var p  = DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    sel.value = '';
    if (this._cart.find(function(i){ return i.id===id; })) return;
    this._cart.push({id:p.id,name:p.name,qty:1,price:p.price,discount:0,tax:0,unit:p.unit||'Pcs'});
    this._renderItems();
    this._renderTotals();
  },

  _renderItems: function() {
    var el = Utils.get('qt-items-wrap'); if(!el) return;
    var cur = DB.getSettings().currency||'$';
    if (!this._cart.length) {
      el.innerHTML='<div style="text-align:center;padding:14px;color:var(--t3);font-size:13px">No items added yet</div>';
      return;
    }
    el.innerHTML = this._cart.map(function(item,i){
      var lineTotal = item.qty * item.price * (1-(item.discount/100)) * (1+(item.tax/100));
      return '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r10);padding:11px 13px;margin-bottom:8px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
        +'<div style="font-size:13px;font-weight:700;color:var(--t1);flex:1;padding-right:8px">'+Utils.esc(item.name)+'<span style="font-size:10px;color:var(--t3);margin-left:6px">'+item.unit+'</span></div>'
        +'<button onclick="Quotations._cart.splice('+i+',1);Quotations._renderItems();Quotations._renderTotals()" style="width:20px;height:20px;border-radius:50%;background:var(--erb);border:1px solid var(--erbd);color:var(--er);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:7px;align-items:end">'
        // Qty
        +'<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Qty</div>'
        +'<input type="number" value="'+item.qty+'" min="1" oninput="Quotations._cart['+i+'].qty=parseInt(this.value)||1;Quotations._renderTotals()" style="width:100%;font-size:13px;font-weight:700;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 7px;-webkit-appearance:none;color:var(--t1)"></div>'
        // Unit Price
        +'<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Unit Price</div>'
        +'<input type="number" value="'+item.price+'" min="0" step="0.01" oninput="Quotations._cart['+i+'].price=parseFloat(this.value)||0;Quotations._renderTotals()" style="width:100%;font-size:13px;font-weight:700;background:var(--gb);border:1.5px solid rgba(201,168,76,.25);border-radius:6px;padding:5px 7px;-webkit-appearance:none;color:var(--g)"></div>'
        // Discount
        +'<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Disc. %</div>'
        +'<input type="number" value="'+item.discount+'" min="0" max="100" oninput="Quotations._cart['+i+'].discount=parseFloat(this.value)||0;Quotations._renderTotals()" style="width:100%;font-size:13px;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 7px;-webkit-appearance:none;color:var(--er)"></div>'
        // Line Total
        +'<div style="text-align:right"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Total</div>'
        +'<div style="font-size:15px;font-weight:800;color:var(--g)">'+Utils.cur(lineTotal,cur)+'</div>'
        +'</div>'
        +'</div></div>';
    }).join('');
  },

  _renderTotals: function() {
    var el = Utils.get('qt-totals'); if(!el) return;
    var cur = DB.getSettings().currency||'$';
    if (!this._cart.length) { el.innerHTML=''; return; }
    var subtotal = this._cart.reduce(function(a,item){ return a+item.qty*item.price*(1-(item.discount/100)); },0);
    var taxAmt   = subtotal * (this._tax/100);
    var total    = subtotal + taxAmt;
    el.innerHTML = '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
      +'<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">🧮 Summary</div>'
      +'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px"><span style="color:var(--t2)">Subtotal</span><span style="font-weight:600;font-family:var(--fm)">'+Utils.cur(subtotal,cur)+'</span></div>'
      +'<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bd)">'
      +'<span style="font-size:13px;color:var(--t2);flex:1">Tax %</span>'
      +'<input type="number" value="'+this._tax+'" min="0" max="100" oninput="Quotations._tax=parseFloat(this.value)||0;Quotations._renderTotals()" style="width:70px;text-align:center;font-size:13px;background:var(--bg2);border:1px solid var(--bd2);border-radius:6px;padding:4px 6px;color:var(--t1)">'
      +'<span style="font-size:13px;font-weight:600;font-family:var(--fm);min-width:60px;text-align:right">'+Utils.cur(taxAmt,cur)+'</span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:17px;font-weight:900"><span style="color:var(--t1)">TOTAL</span><span style="color:var(--g);font-family:var(--fm)">'+Utils.cur(total,cur)+'</span></div>'
      +'</div>';
  },

  saveQuotation: function(action) {
    if (!this._cart.length) { Toast.show('Add at least one item','err'); return; }
    var clientName = Utils.val('qt-client').trim();
    if (!clientName) { Toast.show('Client name is required','err'); return; }

    var subtotal = this._cart.reduce(function(a,item){ return a+item.qty*item.price*(1-(item.discount/100)); },0);
    var taxAmt   = subtotal * (this._tax/100);
    var total    = subtotal + taxAmt;
    var status   = action==='sent' ? 'Sent' : 'Draft';

    // Auto-create or link customer
    var cust = DB.findOrCreateCustomer(clientName, Utils.val('qt-phone'));
    if (cust && Utils.val('qt-email')) DB.updateCustomer(cust.id,{email:Utils.val('qt-email'),address:Utils.val('qt-addr')});

    var qt = DB.addQuotation({
      clientName:   clientName,
      clientPhone:  Utils.val('qt-phone'),
      clientEmail:  Utils.val('qt-email'),
      clientAddress:Utils.val('qt-addr'),
      customerId:   cust ? cust.id : null,
      items:        this._cart.map(function(i){ return Object.assign({},i); }),
      subtotal:     subtotal,
      taxPct:       this._tax,
      taxAmount:    taxAmt,
      total:        total,
      payTerms:     (Utils.get('qt-payterms')||{value:'Immediate'}).value,
      notes:        Utils.val('qt-notes'),
      terms:        Utils.val('qt-terms'),
      date:         Utils.val('qt-date')||Utils.today(),
      expiryDate:   Utils.val('qt-expiry')||'',
      status:       status,
    });

    Toast.show('Quotation '+qt.id+' saved ✓','ok');
    Modal.close();
    this.render();
    if (action === 'sent') {
      setTimeout(function(){ Quotations.printQuotation(qt.id); }, 400);
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW QUOTATION
  // ══════════════════════════════════════════════════════════════════════════
  viewQuotation: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var cur = DB.getSettings().currency||'$';
    var sc  = {Draft:'var(--t3)',Sent:'var(--in)',Approved:'var(--ok)',Declined:'var(--er)',Expired:'var(--wa)'}[q.status]||'var(--t3)';
    var statusOpts = ['Draft','Sent','Approved','Declined'].map(function(s){
      return '<option'+(q.status===s?' selected':'')+'>'+s+'</option>';
    }).join('');

    var itemsHtml = (q.items||[]).map(function(item){
      var lineTotal = item.qty*item.price*(1-(item.discount/100));
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">'
        +'<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(item.name)+'</div>'
        +'<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+item.qty+' '+item.unit+' × '+Utils.cur(item.price,cur)+(item.discount>0?' (−'+item.discount+'%)':'')+'</div></div>'
        +'<div style="font-size:14px;font-weight:700;color:var(--g)">'+Utils.cur(lineTotal,cur)+'</div></div>';
    }).join('');

    Modal.open({
      title:q.id, sub:Utils.esc(q.clientName)+' · '+Utils.date(q.date), barColor:'var(--in)',
      body: '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
          +'<span style="font-size:12px;color:var(--t2)">Status</span>'
          +'<select onchange="Quotations.updateStatus(\''+id+'\',this.value)" style="background:var(--bg2);border:1px solid var(--bd2);border-radius:6px;padding:4px 8px;font-size:12px;color:var(--t1)">'+statusOpts+'</select>'
          +'</div>'
          +'<div class="report-row"><span class="report-label">Client</span><span class="report-val">'+Utils.esc(q.clientName)+'</span></div>'
          +(q.clientPhone?'<div class="report-row"><span class="report-label">Phone</span><span class="report-val">'+Utils.esc(q.clientPhone)+'</span></div>':'')
          +(q.expiryDate?'<div class="report-row"><span class="report-label">Expires</span><span class="report-val">'+Utils.date(q.expiryDate)+'</span></div>':'')
          +'<div class="report-row"><span class="report-label">Payment Terms</span><span class="report-val">'+Utils.esc(q.payTerms||'Immediate')+'</span></div>'
          +'</div>'
          +'<div class="card card-body" style="margin-bottom:12px">'+itemsHtml+'</div>'
          +'<div class="card card-body">'
          +'<div class="report-row"><span class="report-label">Subtotal</span><span class="report-val">'+Utils.cur(q.subtotal,cur)+'</span></div>'
          +(q.taxAmount>0?'<div class="report-row"><span class="report-label">Tax ('+q.taxPct+'%)</span><span class="report-val">'+Utils.cur(q.taxAmount,cur)+'</span></div>':'')
          +'<div class="report-row" style="border-top:2px solid var(--bd2);padding-top:8px;margin-top:4px"><span style="font-size:15px;font-weight:800;color:var(--t1)">TOTAL</span><span style="font-size:17px;font-weight:900;color:var(--g);font-family:var(--fm)">'+Utils.cur(q.total,cur)+'</span></div>'
          +'</div>'
          +(q.notes?'<div style="background:var(--bg3);border-radius:var(--r8);padding:10px 12px;margin-top:10px;font-size:12px;color:var(--t2)">📝 '+Utils.esc(q.notes)+'</div>':''),
      footer: '<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            + '<button class="btn-ghost btn-icon" onclick="Quotations.printQuotation(\''+id+'\')">🖨 Print</button>'
            + (q.status!=='Approved'&&q.status!=='Declined'?'<button class="btn-primary" style="flex:1" onclick="Modal.close();Quotations.convertToInvoice(\''+id+'\')">→ Convert to Invoice</button>':''),
    });
  },

  updateStatus: function(id, status) {
    DB.updateQuotation(id,{status:status});
    Toast.show('Status updated to '+status+' ✓','ok');
    if (status==='Approved') {
      Toast.show('Tap "→ Invoice" to convert to an invoice','ok');
    }
    this.render();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONVERT TO INVOICE
  // ══════════════════════════════════════════════════════════════════════════
  convertToInvoice: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var cur = DB.getSettings().currency||'$';
    Modal.open({
      title:'Convert to Invoice', sub:q.id+' → Invoice', barColor:'var(--ok)',
      body: '<div style="text-align:center;padding:20px 10px">'
          +'<div style="font-size:48px;margin-bottom:14px">📄→🧾</div>'
          +'<div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:8px">Convert this quotation to an invoice?</div>'
          +'<div style="font-size:13px;color:var(--t2);margin-bottom:16px">Client: <strong>'+Utils.esc(q.clientName)+'</strong><br>Amount: <strong style="color:var(--g)">'+Utils.cur(q.total,cur)+'</strong></div>'
          +'</div>'
          +'<div class="fg"><label class="fl">Payment Method</label>'
          +'<select class="fi" id="cv-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Credit</option></select></div>'
          +'<div class="fg"><label class="fl">Amount Paid Now</label>'
          +'<input class="fi" id="cv-paid" type="number" value="'+q.total.toFixed(2)+'" min="0" step="0.01" style="font-size:16px;font-weight:700;color:var(--ok)"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Quotations._doConvert(\''+id+'\')">✅ Create Invoice</button>',
    });
  },

  _doConvert: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var method = (Utils.get('cv-method')||{value:'Cash'}).value;
    var paid   = Math.min(parseFloat(Utils.val('cv-paid')||0), q.total);
    var balance= Math.max(0, q.total-paid);
    var status = paid>=q.total?'Paid':(paid>0?'Partial':'Credit');

    // Find or create customer
    var cust = DB.findOrCreateCustomer(q.clientName, q.clientPhone);
    if (cust && (q.clientEmail||q.clientAddress)) {
      DB.updateCustomer(cust.id,{email:q.clientEmail||cust.email,address:q.clientAddress||cust.address});
    }

    // Create sale
    var sale = DB.addSale({
      customer:   q.clientName,
      customerId: cust?cust.id:null,
      items:      q.items,
      subtotal:   q.subtotal,
      discount:   0,
      total:      q.total,
      amountPaid: status==='Paid'?q.total:paid,
      balance:    status==='Paid'?0:balance,
      payment:    method,
      status:     status,
      date:       Utils.today(),
      notes:      'Converted from quotation '+q.id,
      fromQuotation: id,
    });

    // Deduct stock
    q.items.forEach(function(item){
      var p=DB.getProducts().find(function(x){ return x.id===item.id; });
      if(p) DB.updateProduct(item.id,{qty:Math.max(0,(p.qty||0)-(parseInt(item.qty)||0))});
    });

    // Update customer
    if(cust) DB.updateCustomer(cust.id,{totalSpent:(cust.totalSpent||0)+q.total,purchases:(cust.purchases||0)+1});

    // Mark quotation approved
    DB.updateQuotation(id,{status:'Approved',convertedToInvoice:sale.id});

    Modal.close();
    Toast.show('Invoice '+sale.id+' created from quotation ✓','ok');
    this.render();
    // Show print prompt
    setTimeout(function(){ Sales.showPrintPrompt(sale.id,'invoice'); },400);
  },

  del: function(id) {
    confirmDel('Delete this quotation?', function(){
      DB.deleteQuotation(id);
      Toast.show('Deleted','warn');
      Quotations.render();
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PROFESSIONAL PRINT / PDF
  // ══════════════════════════════════════════════════════════════════════════
  printQuotation: function(id) {
    var q        = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var bizAddr  = settings.bizAddress || '';
    var bizPhone = settings.bizPhone   || '';
    var bizEmail = settings.bizEmail   || '';
    var bizLogo  = settings.bizLogo    || '';
    var now      = new Date();

    // Calculate totals per line
    var subtotal = q.subtotal || q.items.reduce(function(a,item){ return a+item.qty*item.price*(1-(item.discount/100)); },0);
    var taxAmt   = q.taxAmount || 0;
    var total    = q.total || subtotal + taxAmt;

    var logoHtml = bizLogo
      ? '<img src="'+bizLogo+'" alt="Logo" onerror="this.style.display=\'none\'" style="width:80px;height:80px;object-fit:contain;object-position:center">'
      : '<div style="width:80px;height:80px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:32px">📦</div>';

    var statusColors = {Draft:'#6b7280',Sent:'#2563eb',Approved:'#16a34a',Declined:'#dc2626',Expired:'#d97706'};
    var statusColor  = statusColors[q.status] || '#6b7280';

    var itemRows = (q.items||[]).map(function(item,i){
      var lineTotal = item.qty * item.price * (1-(item.discount/100));
      var bg = i%2===0 ? '' : 'background:#f9fafb';
      return '<tr style="'+bg+'">'
        +'<td style="padding:10px 12px;font-size:12px;border-bottom:1px solid #e5e7eb">'+Utils.esc(item.name)+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:center;border-bottom:1px solid #e5e7eb">'+item.qty+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:center;border-bottom:1px solid #e5e7eb">'+item.unit+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb">'+Utils.cur(item.price,cur)+'</td>'
        +(item.discount>0?'<td style="padding:10px 12px;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;color:#dc2626">'+item.discount+'%</td>'
          :'<td style="padding:10px 12px;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;color:#9ca3af">—</td>')
        +'<td style="padding:10px 12px;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:700">'+Utils.cur(lineTotal,cur)+'</td>'
        +'</tr>';
    }).join('');

    var css = '*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
      +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:13px;color:#111;background:#fff}'
      +'.page{max-width:210mm;margin:0 auto;padding:16mm}'
      +'.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #111}'
      +'.biz-block{flex:1;padding-right:20px}'
      +'.biz-name{font-size:24px;font-weight:900;letter-spacing:-.03em;margin-bottom:6px}'
      +'.biz-detail{font-size:11px;color:#555;line-height:1.7}'
      +'.doc-block{text-align:right;flex-shrink:0}'
      +'.doc-title{font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#111;margin-bottom:8px}'
      +'.doc-num{font-size:14px;font-weight:700;color:#555;margin-bottom:4px}'
      +'.doc-status{display:inline-block;padding:3px 12px;border-radius:99px;font-size:10px;font-weight:800;border:2px solid;letter-spacing:.08em}'
      +'.client-section{display:flex;justify-content:space-between;margin-bottom:28px;gap:20px}'
      +'.client-box{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px}'
      +'.client-box h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:8px}'
      +'.client-box p{font-size:12px;color:#111;line-height:1.7}'
      +'.items-table{width:100%;border-collapse:collapse;margin-bottom:0}'
      +'.items-table th{background:#111;color:#fff;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}'
      +'.items-table th:not(:first-child){text-align:right}'
      +'.items-table th:nth-child(2),.items-table th:nth-child(3){text-align:center}'
      +'.totals-block{display:flex;justify-content:flex-end;margin-top:0}'
      +'.totals-inner{width:280px}'
      +'.totals-row{display:flex;justify-content:space-between;padding:7px 12px;font-size:12px;border-bottom:1px solid #e5e7eb}'
      +'.totals-row.grand{background:#111;color:#fff;font-size:15px;font-weight:800;padding:12px;border-radius:0 0 8px 8px;border:none}'
      +'.notes-block{margin-top:20px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:11px;color:#555;line-height:1.7}'
      +'.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end}'
      +'.sig-line{border-top:1px solid #333;padding-top:6px;font-size:10px;color:#777;width:180px}'
      +'.page-footer{text-align:center;font-size:10px;color:#9ca3af;margin-top:16px}'
      +'@media print{@page{size:A4;margin:12mm}.page{padding:0}}'
      +'@page{@bottom-right{content:counter(page) " / " counter(pages);font-size:9px;color:#aaa}}';

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      +'<meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<title>Quotation '+q.id+'</title><style>'+css+'</style></head><body>'
      +'<div class="page">'

      // Header
      +'<div class="header">'
      +'<div style="display:flex;align-items:flex-start;gap:16px">'
      +logoHtml
      +'<div class="biz-block">'
      +'<div class="biz-name">'+Utils.esc(bizName)+'</div>'
      +'<div class="biz-detail">'
      +(bizAddr?bizAddr+'<br>':'')
      +(bizPhone?'Tel: '+bizPhone+'<br>':'')
      +(bizEmail?bizEmail:'')
      +'</div></div></div>'
      +'<div class="doc-block">'
      +'<div class="doc-title">Quotation</div>'
      +'<div class="doc-num">'+q.id+'</div>'
      +'<div class="doc-num" style="font-size:11px;font-weight:400">Date: '+Utils.date(q.date)+'</div>'
      +(q.expiryDate?'<div class="doc-num" style="font-size:11px;font-weight:400">Valid until: '+Utils.date(q.expiryDate)+'</div>':'')
      +'<div style="margin-top:8px"><span class="doc-status" style="color:'+statusColor+';border-color:'+statusColor+'">'+q.status.toUpperCase()+'</span></div>'
      +'</div></div>'

      // Client + Quote info
      +'<div class="client-section">'
      +'<div class="client-box">'
      +'<h3>Bill To</h3>'
      +'<p><strong>'+Utils.esc(q.clientName)+'</strong><br>'
      +(q.clientAddress?q.clientAddress+'<br>':'')
      +(q.clientPhone?'Tel: '+q.clientPhone+'<br>':'')
      +(q.clientEmail?q.clientEmail:'')
      +'</p></div>'
      +'<div class="client-box">'
      +'<h3>Quotation Details</h3>'
      +'<p>Payment Terms: <strong>'+Utils.esc(q.payTerms||'Immediate')+'</strong><br>'
      +'Prepared by: <strong>'+Utils.esc(settings.bizName||'')+'</strong><br>'
      +(q.expiryDate?'Offer valid until: <strong>'+Utils.date(q.expiryDate)+'</strong><br>':'')
      +'Generated: '+now.toLocaleDateString()
      +'</p></div>'
      +'</div>'

      // Items table
      +'<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:0">'
      +'<table class="items-table">'
      +'<thead><tr>'
      +'<th style="text-align:left;width:35%">Description</th>'
      +'<th style="text-align:center;width:10%">Qty</th>'
      +'<th style="text-align:center;width:10%">Unit</th>'
      +'<th style="text-align:right;width:15%">Unit Price</th>'
      +'<th style="text-align:right;width:10%">Disc.</th>'
      +'<th style="text-align:right;width:20%">Amount</th>'
      +'</tr></thead>'
      +'<tbody>'+itemRows+'</tbody>'
      +'</table>'

      // Totals
      +'<div class="totals-block">'
      +'<div class="totals-inner">'
      +'<div class="totals-row"><span>Subtotal</span><span>'+Utils.cur(subtotal,cur)+'</span></div>'
      +(taxAmt>0?'<div class="totals-row"><span>Tax ('+q.taxPct+'%)</span><span>'+Utils.cur(taxAmt,cur)+'</span></div>':'')
      +'<div class="totals-row grand"><span>TOTAL</span><span>'+Utils.cur(total,cur)+'</span></div>'
      +'</div></div>'
      +'</div>'

      // Notes & Terms
      +((q.notes||q.terms)?'<div class="notes-block">'
        +(q.notes?'<p><strong>Notes:</strong> '+Utils.esc(q.notes)+'</p>':'')
        +(q.terms?'<p style="margin-top:6px"><strong>Terms &amp; Conditions:</strong> '+Utils.esc(q.terms)+'</p>':'')
        +'</div>':'')

      // Signatures
      +'<div class="footer">'
      +'<div class="sig-line">Authorized Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: __________</div>'
      +'<div class="sig-line">Client Acceptance &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: __________</div>'
      +'</div>'

      // Footer
      +'<div class="page-footer">'
      +Utils.esc(bizName)+(bizPhone?' · Tel: '+bizPhone:'')+' · Thank you for your business!'
      +'</div>'

      +'</div></body></html>';

    Sales._printHtml(html, 'quotation-print-frame');
  },
};
