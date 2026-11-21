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
      return '<div class="list-item" style="flex-wrap:wrap" onclick="Quotations.viewQuotation(\''+q.id+'\')">'
        +'<div class="list-icon" style="background:var(--inb);font-size:18px">📄</div>'
        +'<div class="list-info">'
        +'<div class="list-name">'+Utils.esc(q.clientName||'No client')+'</div>'
        +'<div class="list-meta" style="font-family:var(--fm)">'+q.id+' · '+Utils.date(q.date)+'</div>'
        +(q.expiryDate?'<div class="list-meta" style="font-size:10px;color:'+(expired?'var(--er)':'var(--t3)')+'">Expires: '+Utils.date(q.expiryDate)+(expired?' ⚠️ EXPIRED':' ')+'</div>':'')
        +'</div>'
        +'<div class="list-right">'
        +'<div class="list-val">'+Utils.cur(q.total||0,cur)+'</div>'
        +'<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40">'+q.status+'</span>'
        +'</div>'
        +'<div class="list-actions" style="width:100%;margin-top:8px">'
        +(q.convertedToInvoice?'':'<button class="btn-ghost btn-sm" onclick="event.stopPropagation();Quotations.openEdit(\''+q.id+'\')" title="Edit">✏️ Edit</button>')
        +'<button class="btn-ghost btn-sm" onclick="event.stopPropagation();Quotations.openSend(\''+q.id+'\')" title="Send">📤 Send</button>'
        +'<button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Quotations.printQuotation(\''+q.id+'\')" title="Print">🖨</button>'
        +(q.status!=='Approved'&&q.status!=='Declined'?'<button class="btn-ok btn-sm" onclick="event.stopPropagation();Quotations.convertToInvoice(\''+q.id+'\')">→ Invoice</button>':'')
        +'<button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Quotations.del(\''+q.id+'\')">🗑</button>'
        +'</div></div>';
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

  _editId: null,

  openNewQuotation: function() { this._openForm(null); },

  openEdit: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    if (q.convertedToInvoice) {
      Toast.show('This quotation is already an invoice. Edit the invoice in Sales instead.','err');
      return;
    }
    Modal.close();
    setTimeout(function(){ Quotations._openForm(q); }, 50);
  },

  _openForm: function(q) {
    this._editId = q ? q.id : null;
    this._cart = q ? (q.items||[]).map(function(i){ return Object.assign({discount:0,tax:0,unit:'Pcs'},i); }) : [];
    this._discount = 0;
    this._tax = q ? (parseFloat(q.taxPct)||0) : 0;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var custs    = DB.getCustomers();
    var nextNum  = q ? q.id : this._nextNumber();

    var custSugg = custs.slice(0,50).map(function(c){
      return '<option value="'+Utils.esc(c.name)+'">';
    }).join('');

    Modal.open({
      title: q ? 'Edit Quotation' : 'New Quotation', sub: nextNum, barColor: 'var(--in)',
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
            + (q
              ? '<button class="btn-ghost" onclick="Quotations.saveQuotation(\'keep\')" style="color:var(--t2)">💾 Save</button>'
                + '<button class="btn-primary" style="flex:1" onclick="Quotations.saveQuotation(\'send\')">📤 Save &amp; Send</button>'
              : '<button class="btn-ghost" onclick="Quotations.saveQuotation(\'draft\')" style="color:var(--t2)">💾 Draft</button>'
                + '<button class="btn-ghost" onclick="Quotations.saveQuotation(\'sent\')" style="color:var(--t2)">🖨 Print</button>'
                + '<button class="btn-primary" style="flex:1" onclick="Quotations.saveQuotation(\'send\')">📤 Save &amp; Send</button>'),
    });
    if (q) {
      var setV = function(id, v){ var el = Utils.get(id); if (el && v != null) el.value = v; };
      setV('qt-client', q.clientName); setV('qt-phone', q.clientPhone); setV('qt-email', q.clientEmail);
      setV('qt-addr', q.clientAddress); setV('qt-date', q.date); setV('qt-expiry', q.expiryDate);
      setV('qt-notes', q.notes); setV('qt-terms', q.terms);
      if (q.payTerms) setV('qt-payterms', q.payTerms);
    }
    this._renderItems();
    this._renderTotals();
  },

  _nextNumber: function() { return DB.nextQuotationId(); },

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
    var editing  = this._editId ? DB.getQuotations().find(function(x){ return x.id===Quotations._editId; }) : null;
    var status   = editing ? editing.status : (action==='draft' ? 'Draft' : 'Sent');
    if (editing && status==='Expired' && (Utils.val('qt-expiry')||'') >= Utils.today()) status = 'Sent';

    // Auto-create or link customer
    var cust = DB.findOrCreateCustomer(clientName, Utils.val('qt-phone'));
    if (cust && Utils.val('qt-email')) DB.updateCustomer(cust.id,{email:Utils.val('qt-email'),address:Utils.val('qt-addr')});

    var data = {
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
    };
    var qt;
    if (editing) {
      data.updatedAt = Utils.today();
      DB.updateQuotation(editing.id, data);
      qt = DB.getQuotations().find(function(x){ return x.id===editing.id; });
    } else {
      qt = DB.addQuotation(data);
    }
    this._editId = null;

    Toast.show('Quotation '+qt.id+(editing?' updated':' saved')+' ✓','ok');
    Modal.close();
    this.render();
    if (action === 'sent') {
      setTimeout(function(){ Quotations.printQuotation(qt.id); }, 400);
    } else if (action === 'send') {
      setTimeout(function(){ Quotations.openSend(qt.id); }, 400);
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SEND — WhatsApp to the client, to a friend, or any app on the phone
  // ══════════════════════════════════════════════════════════════════════════
  _message: function(q) {
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var bizPhone = settings.bizPhone || '';
    var nl = '\n', line = '─────────────────────' + nl;
    var msg = '📄 *QUOTATION — ' + bizName + '*' + nl + line;
    msg += '📋 *' + q.id + '*' + nl;
    msg += '📅 Date: ' + Utils.date(q.date) + nl;
    if (q.expiryDate) msg += '⏳ Valid until: ' + Utils.date(q.expiryDate) + nl;
    msg += '👤 ' + (q.clientName || 'Client') + nl + nl;
    msg += '*Items:*' + nl;
    (q.items||[]).forEach(function(item){
      var disc = parseFloat(item.discount)||0;
      var lt = (parseFloat(item.qty)||0) * (parseFloat(item.price)||0) * (1 - disc/100);
      msg += '• ' + item.name + ' — ' + item.qty + ' ' + (item.unit||'') + ' × ' + Utils.cur(item.price,cur)
        + (disc > 0 ? ' (−' + disc + '%)' : '') + ' = ' + Utils.cur(lt,cur) + nl;
    });
    msg += line;
    if ((parseFloat(q.taxAmount)||0) > 0) {
      msg += 'Subtotal: ' + Utils.cur(q.subtotal,cur) + nl;
      msg += 'Tax (' + q.taxPct + '%): ' + Utils.cur(q.taxAmount,cur) + nl;
    }
    msg += '💰 *TOTAL: ' + Utils.cur(q.total,cur) + '*' + nl;
    if (q.payTerms) msg += '💳 Payment terms: ' + q.payTerms + nl;
    if (q.notes) msg += '📝 ' + q.notes + nl;
    if (q.terms) msg += 'Terms: ' + q.terms + nl;
    msg += nl + 'Thank you! 🙏';
    if (bizPhone) msg += nl + '📞 ' + bizPhone;
    return msg;
  },

  // Liberian numbers are often typed as 0886...; WhatsApp needs 231886...
  _waPhone: function(phone) {
    var d = String(phone||'').replace(/[^0-9]/g,'');
    if (d.indexOf('00') === 0) d = d.slice(2);
    else if (d.charAt(0) === '0') d = '231' + d.slice(1);
    return d.length >= 8 ? d : '';
  },

  openSend: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var phone = this._waPhone(q.clientPhone);
    var opt = function(icon, title, sub, onclick, primary) {
      return '<button class="'+(primary?'btn-primary':'btn-ghost')+'" onclick="'+onclick+'" style="width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;margin-bottom:10px">'
        +'<span style="font-size:24px">'+icon+'</span><span style="flex:1"><span style="display:block;font-weight:800;font-size:14px">'+title+'</span>'
        +'<span style="display:block;font-size:11px;opacity:.75;font-weight:500">'+sub+'</span></span></button>';
    };
    var canFiles = !!(navigator.canShare && window.File);
    var head = function(t){ return '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin:4px 0 8px">'+t+'</div>'; };
    Modal.open({
      title: 'Send Quotation', sub: q.id + ' · ' + Utils.esc(q.clientName||''), barColor: 'var(--ok)',
      body: head('📸 As a photo')
        + '<div id="qt-photo-prev" style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:8px;margin-bottom:10px;text-align:center;min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--t3);font-size:12px">Making the photo…</div>'
        + opt('📸', canFiles ? 'Send photo' : 'Save photo',
              canFiles ? 'Pick WhatsApp, then the client or a friend' : 'Saves the picture, then attach it in WhatsApp',
              'Quotations.sendPhoto(\''+id+'\')', true)
        + head('💬 As a text message')
        + (phone
          ? opt('💬','WhatsApp text to '+Utils.esc(q.clientName||'client'), '+'+phone, 'Quotations.sendWhatsApp(\''+id+'\',true)')
          : '')
        + opt('👥','WhatsApp text: choose a contact','Send to a friend, a group or anyone', 'Quotations.sendWhatsApp(\''+id+'\',false)')
        + (navigator.share ? opt('📲','Text to other apps','SMS, Messenger, Telegram, email…', 'Quotations.shareOther(\''+id+'\')') : '')
        + opt('📋','Copy text','Paste it anywhere', 'Quotations.copyText(\''+id+'\')'),
      footer: '<button class="btn-ghost" style="flex:1" onclick="Modal.close()">Close</button>',
    });
    // Make the picture now, so tapping "Send photo" can share it straight away
    this._photo = null;
    this._makeImage(q).then(function(blob){
      Quotations._photo = { id: id, blob: blob };
      var el = Utils.get('qt-photo-prev'); if (!el) return;
      el.innerHTML = '<img src="'+URL.createObjectURL(blob)+'" alt="Quotation photo" style="width:100%;max-height:340px;object-fit:contain;border-radius:6px;background:#fff">';
    }).catch(function(){
      var el = Utils.get('qt-photo-prev'); if (el) el.textContent = 'Could not make the photo. Use the text options below.';
    });
  },

  // ── Quotation as a PNG picture ─────────────────────────────────────────────
  _photo: null,

  _photoFile: function(q, blob) {
    var name = 'Quotation-' + q.id + '.png';
    try { return new File([blob], name, { type: 'image/png' }); } catch (e) { return null; }
  },

  sendPhoto: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var ph = this._photo;
    if (!ph || ph.id !== id) { Toast.show('The photo is still being made, try again in a second','warn'); return; }
    var file = this._photoFile(q, ph.blob);
    var cur = DB.getSettings().currency || '$';
    var bizName = DB.getSettings().bizName || 'SmartStock Pro';
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Quotation ' + q.id,
        text: 'Quotation ' + q.id + ' from ' + bizName + ' · Total ' + Utils.cur(q.total||0, cur) })
        .then(function(){ Quotations._markSent(id); })
        .catch(function(e){ if (e && e.name !== 'AbortError') Quotations._downloadPhoto(q, ph.blob); });
    } else {
      this._downloadPhoto(q, ph.blob);
    }
  },

  _downloadPhoto: function(q, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'Quotation-' + q.id + '.png';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
    Toast.show('Photo saved ✓ Attach it in WhatsApp from your gallery or downloads','ok');
    if (q.status === 'Draft') { DB.updateQuotation(q.id, {status:'Sent'}); this.render(); }
  },

  _loadImg: function(src) {
    return new Promise(function(res){
      if (!src) return res(null);
      var img = new Image();
      if (!/^data:|^blob:/.test(src)) img.crossOrigin = 'anonymous';
      img.onload = function(){ res(img); };
      img.onerror = function(){ res(null); };
      img.src = src;
      setTimeout(function(){ res(null); }, 5000);
    });
  },

  // Draws the quotation on a canvas (navy and gold design) and returns a PNG blob.
  _makeImage: function(q) {
    var self = this;
    var st = DB.getSettings();
    return this._loadImg(st.bizLogo || '').then(function(logo){
      var blob = function(withLogo){
        var c = self._drawQuote(q, st, withLogo);
        return new Promise(function(res, rej){
          try { c.toBlob(function(b){ b ? res(b) : rej(new Error('no image')); }, 'image/png'); }
          catch (e) { rej(e); }   // a logo from another site can block the export
        });
      };
      return blob(logo).catch(function(){ return blob(null); });
    });
  },

  _drawQuote: function(q, st, logo) {
    var NAVY = '#0f2557', GOLD = '#f2b51c', LIGHT = '#eef3fb', LINE = '#c9d3e3', INK = '#111827', SOFT = '#374151';
    var F = 'Arial, Helvetica, sans-serif';
    var cur = st.currency || '$';
    var items = q.items || [];
    var W = 1050, ROW = 57;
    var hasTax = (parseFloat(q.taxAmount)||0) > 0;
    var noteLines = [];
    var W2 = W;

    var c = document.createElement('canvas');
    var x = c.getContext('2d');
    // measure notes first (needs a context)
    x.font = '20px ' + F;
    var wrap = function(text, maxW) {
      var out = [], line = '';
      String(text).split(/\s+/).forEach(function(w){
        var t = line ? line + ' ' + w : w;
        if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      if (line) out.push(line);
      return out;
    };
    if (q.notes) noteLines = noteLines.concat(wrap('Notes: ' + q.notes, W2 - 80));
    if (q.terms) noteLines = noteLines.concat(wrap('Terms & Conditions: ' + q.terms, W2 - 80));

    var tableY = 520, headH = 62;
    var rowsEnd = tableY + headH + items.length * ROW;
    var totalsH = 70 + (hasTax ? 46 : 0) + 76;
    var notesY = rowsEnd + totalsH + 30;
    var notesH = noteLines.length ? noteLines.length * 28 + 30 : 0;
    var sigY = notesY + notesH + (notesH ? 50 : 20);
    var H = sigY + 330;

    var scale = 1.5;
    c.width = W * scale; c.height = H * scale;
    x.scale(scale, scale);

    var rr = function(px, py, w, h, r, fill, stroke) {
      var tl = r.tl!=null ? r.tl : r, tr = r.tr!=null ? r.tr : r, br = r.br!=null ? r.br : r, bl = r.bl!=null ? r.bl : r;
      x.beginPath();
      x.moveTo(px+tl, py); x.lineTo(px+w-tr, py); x.quadraticCurveTo(px+w, py, px+w, py+tr);
      x.lineTo(px+w, py+h-br); x.quadraticCurveTo(px+w, py+h, px+w-br, py+h);
      x.lineTo(px+bl, py+h); x.quadraticCurveTo(px, py+h, px, py+h-bl);
      x.lineTo(px, py+tl); x.quadraticCurveTo(px, py, px+tl, py); x.closePath();
      if (fill) { x.fillStyle = fill; x.fill(); }
      if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1.5; x.stroke(); }
    };
    var text = function(t, px, py, font, color, align, maxW) {
      x.font = font; x.fillStyle = color; x.textAlign = align || 'left'; x.textBaseline = 'alphabetic';
      t = String(t == null ? '' : t);
      if (maxW) {
        if (x.measureText(t).width > maxW) {
          while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1);
          t += '…';
        }
      }
      x.fillText(t, px, py);
    };
    // shrink a font until the text fits
    var fit = function(t, px, py, size, weight, color, maxW, align) {
      var s = size;
      do { x.font = weight + ' ' + s + 'px ' + F; s--; } while (s > 12 && x.measureText(t).width > maxW);
      text(t, px, py, x.font, color, align, maxW);
    };
    var money = function(v){ return Utils.cur(parseFloat(v)||0, cur); };

    // page
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);

    // logo box
    x.fillStyle = '#000'; x.fillRect(18, 20, 185, 192);
    if (logo) {
      var s = Math.min(175 / logo.width, 182 / logo.height);
      var lw = logo.width * s, lh = logo.height * s;
      x.drawImage(logo, 18 + (185 - lw) / 2, 20 + (192 - lh) / 2, lw, lh);
    } else {
      fit((st.bizName || 'LOGO').toUpperCase(), 110, 125, 30, '900', GOLD, 165, 'center');
    }

    // business block
    var bizMax = 748 - 232 - 16;
    fit(st.bizName || 'SmartStock Pro', 232, 100, 56, 'bold', NAVY, bizMax);
    var by = 142;
    var info = [];
    if (st.bizAddress) info.push(['📍', st.bizAddress]);
    if (st.bizPhone)   info.push(['📞', 'Tel: ' + st.bizPhone]);
    if (st.bizEmail)   info.push(['✉', st.bizEmail]);
    info.forEach(function(row){
      text(row[0], 232, by, '18px ' + F, NAVY);
      fit(row[1], 264, by, 20, 'normal', INK, bizMax - 32);
      by += 33;
    });

    // QUOTATION badge
    rr(748, 36, 285, 172, 14, LIGHT);
    rr(748, 36, 285, 70, {tl:14, tr:14, br:0, bl:0}, NAVY);
    fit('QUOTATION', 890, 90, 46, 'bold', '#ffffff', 260, 'center');
    fit(q.id, 890, 150, 30, 'bold', INK, 260, 'center');
    text('Date: ' + Utils.date(q.date), 890, 188, '24px ' + F, INK, 'center', 260);

    // gold + navy stripes
    var stripe = function(py, color, x0) {
      x.fillStyle = color; x.beginPath();
      x.moveTo(x0, py); x.lineTo(W, py - 3); x.lineTo(W, py + 4); x.lineTo(x0, py + 7); x.closePath(); x.fill();
    };
    stripe(246, GOLD, 0); stripe(261, NAVY, 70);

    // Bill To / Details cards
    var card = function(px, w, title, lines) {
      rr(px, 305, w, 178, 14, LIGHT, LINE);
      rr(px, 305, w, 46, {tl:14, tr:14, br:0, bl:0}, NAVY);
      text(title, px + 26, 337, 'bold 24px ' + F, '#ffffff');
      var ly = 390;
      lines.forEach(function(l){
        if (!l) return;
        if (l.b) {
          x.font = 'bold 23px ' + F; x.fillStyle = INK; x.textAlign = 'left';
          var bw = x.measureText(l.b).width;
          x.fillText(l.b, px + 26, ly);
          text(l.t, px + 26 + bw + 6, ly, '23px ' + F, INK, 'left', w - 60 - bw);
        } else {
          text(l.t, px + 26, ly, (l.bold ? 'bold ' : '') + '23px ' + F, INK, 'left', w - 52);
        }
        ly += 34;
      });
    };
    card(20, 488, 'BILL TO', [
      { t: q.clientName || 'Client', bold: true },
      q.clientPhone ? { t: 'Tel: ' + q.clientPhone } : null,
      q.clientAddress ? { t: q.clientAddress } : null,
      q.clientEmail ? { t: q.clientEmail } : null,
    ].filter(Boolean).slice(0, 3));
    card(535, 496, 'QUOTATION DETAILS', [
      { b: 'Payment Terms:', t: q.payTerms || 'Immediate' },
      { b: 'Prepared by:', t: st.bizName || '' },
      q.expiryDate ? { b: 'Valid until:', t: Utils.date(q.expiryDate) } : { b: 'Generated:', t: new Date().toLocaleDateString() },
    ]);

    // items table
    var cols = [20, 372, 475, 578, 748, 857, 1030];
    var tW = cols[6] - cols[0];
    rr(cols[0], tableY, tW, headH + items.length * ROW + totalsH, 14, '#ffffff', LINE);
    rr(cols[0], tableY, tW, headH, {tl:14, tr:14, br:0, bl:0}, NAVY);
    var heads = [['DESCRIPTION','left'],['QTY','center'],['UNIT','center'],['UNIT PRICE','center'],['DISC.','center'],['AMOUNT','right']];
    heads.forEach(function(h, i){
      var px = h[1] === 'left' ? cols[i] + 20 : h[1] === 'right' ? cols[i+1] - 30 : (cols[i] + cols[i+1]) / 2;
      text(h[0], px, tableY + 40, 'bold 23px ' + F, '#ffffff', h[1]);
    });
    items.forEach(function(it, i){
      var y0 = tableY + headH + i * ROW;
      x.fillStyle = i % 2 ? '#ffffff' : '#f4f7fc'; x.fillRect(cols[0] + 1, y0, tW - 2, ROW);
      x.strokeStyle = LINE; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(cols[0], y0 + ROW); x.lineTo(cols[6], y0 + ROW); x.stroke();
      for (var k = 1; k < 6; k++) { x.beginPath(); x.moveTo(cols[k], y0); x.lineTo(cols[k], y0 + ROW); x.stroke(); }
      var disc = parseFloat(it.discount) || 0;
      var lt = (parseFloat(it.qty)||0) * (parseFloat(it.price)||0) * (1 - disc/100);
      var ty = y0 + 37;
      text(it.name, cols[0] + 20, ty, '23px ' + F, INK, 'left', cols[1] - cols[0] - 30);
      text(it.qty, (cols[1]+cols[2])/2, ty, '23px ' + F, INK, 'center');
      text(it.unit || '', (cols[2]+cols[3])/2, ty, '23px ' + F, INK, 'center', cols[3]-cols[2]-10);
      text(money(it.price), (cols[3]+cols[4])/2, ty, '23px ' + F, INK, 'center');
      text(disc > 0 ? disc + '%' : '—', (cols[4]+cols[5])/2, ty, '23px ' + F, disc > 0 ? '#dc2626' : INK, 'center');
      text(money(lt), cols[6] - 30, ty, '23px ' + F, INK, 'right');
    });

    // totals
    var ty2 = rowsEnd + 42;
    text('Subtotal', 750, ty2, 'bold 24px ' + F, INK, 'right');
    text(money(q.subtotal), cols[6] - 30, ty2, 'bold 26px ' + F, INK, 'right');
    if (hasTax) {
      ty2 += 46;
      text('Tax (' + q.taxPct + '%)', 750, ty2, 'bold 24px ' + F, INK, 'right');
      text(money(q.taxAmount), cols[6] - 30, ty2, 'bold 26px ' + F, INK, 'right');
    }
    var gy = ty2 + 22;
    rr(623, gy, 408, 76, 12, NAVY);
    text('TOTAL', 650, gy + 50, 'bold 34px ' + F, '#ffffff');
    fit(money(q.total), 1010, gy + 50, 34, 'bold', '#ffffff', 220, 'right');

    // notes
    if (noteLines.length) {
      rr(20, notesY, tW, notesH, 12, LIGHT, LINE);
      noteLines.forEach(function(l, i){ text(l, 40, notesY + 36 + i * 28, '20px ' + F, SOFT); });
    }

    // signatures
    x.strokeStyle = NAVY; x.lineWidth = 3;
    x.beginPath(); x.moveTo(28, sigY); x.lineTo(472, sigY); x.stroke();
    x.beginPath(); x.moveTo(672, sigY); x.lineTo(1028, sigY); x.stroke();
    text('Authorized Signature     Date: ____________', 28, sigY + 34, '22px ' + F, INK);
    text('Client Acceptance   Date: _________', 672, sigY + 34, '22px ' + F, INK, 'left', 356);

    // footer
    var fy = sigY + 135;
    text((st.bizName || '') + (st.bizPhone ? ' –  Tel: ' + st.bizPhone : ''), W/2, fy, 'italic bold 24px Georgia, serif', NAVY, 'center', W - 80);
    text('Thank you for your business!', W/2, fy + 36, 'italic bold 24px Georgia, serif', NAVY, 'center');

    // bottom waves
    var bottom = H;
    x.fillStyle = GOLD; x.beginPath();
    x.moveTo(0, bottom - 135); x.quadraticCurveTo(W*0.3, bottom - 60, W/2 + 20, bottom - 30);
    x.quadraticCurveTo(W*0.75, bottom - 70, W, bottom - 135); x.lineTo(W, bottom); x.lineTo(0, bottom); x.closePath(); x.fill();
    x.fillStyle = NAVY; x.beginPath();
    x.moveTo(0, bottom - 100); x.quadraticCurveTo(W*0.3, bottom - 35, W/2 + 20, bottom - 8);
    x.quadraticCurveTo(W*0.75, bottom - 45, W, bottom - 105); x.lineTo(W, bottom); x.lineTo(0, bottom); x.closePath(); x.fill();

    return c;
  },

  _markSent: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; });
    if (q && q.status === 'Draft') DB.updateQuotation(id, {status:'Sent'});
    Modal.close();
    this.render();
  },

  sendWhatsApp: function(id, toClient) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    Sales._openWhatsApp(this._message(q), toClient ? this._waPhone(q.clientPhone) : '');
    this._markSent(id);
  },

  shareOther: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    navigator.share({ title: 'Quotation ' + q.id, text: this._message(q) })
      .then(function(){ Quotations._markSent(id); })
      .catch(function(){ /* cancelled */ });
  },

  copyText: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var msg = this._message(q);
    var done = function(){ Toast.show('Quotation text copied ✓','ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(done, function(){ Quotations._copyFallback(msg); done(); });
    } else { this._copyFallback(msg); done(); }
  },

  _copyFallback: function(msg) {
    var ta = document.createElement('textarea'); ta.value = msg; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
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
            + (q.convertedToInvoice ? '' : '<button class="btn-ghost btn-icon" onclick="Quotations.openEdit(\''+id+'\')">✏️ Edit</button>')
            + '<button class="btn-ghost btn-icon" onclick="Modal.close();setTimeout(function(){Quotations.openSend(\''+id+'\')},50)">📤 Send</button>'
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
    Toast.show('Invoice '+Sales.no(sale)+' created from quotation ✓','ok');
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
