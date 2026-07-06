/* === supply.js === */
var Supply = {

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER — tab switching
  // ══════════════════════════════════════════════════════════════════════════
  tab: 'overview',

  render: function() {
    var pg = Utils.get('pg-supply');
    if (!pg) return;
    var tabs = [
      ['overview', '📊 Overview'],
      ['po',       '📋 Purchase Orders'],
      ['grn',      '📦 Received (GRN)'],
      ['invoices', '🧾 Supplier Bills'],
      ['reorder',  '🔔 Reorder Alerts'],
    ];
    var chipHtml = '<div class="chips" style="padding:0 14px 0">'
      + tabs.map(function(t){
          return '<div class="chip'+(Supply.tab===t[0]?' active':'')+'" onclick="Supply.setTab(\''+t[0]+'\')">'+t[1]+'</div>';
        }).join('') + '</div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Supply</div><div class="page-sub">Procurement &amp; stock management</div></div>'
      + '<div class="page-actions">'+(Supply.tab==='po'?'<button class="btn-primary btn-sm" onclick="Supply.openNewPO()">＋ New PO</button>':Supply.tab==='grn'?'<button class="btn-primary btn-sm" onclick="Supply.openNewGRN()">＋ Receive Stock</button>':Supply.tab==='invoices'?'<button class="btn-primary btn-sm" onclick="Supply.openNewBill()">＋ Add Bill</button>':'')
      + '</div></div>'
      + chipHtml
      + '<div id="supply-body"></div>';

    Supply._renderTab();
  },

  setTab: function(t) { Supply.tab = t; Supply.render(); },

  _renderTab: function() {
    var body = Utils.get('supply-body');
    if (!body) return;
    if (Supply.tab === 'overview')  Supply._renderOverview(body);
    else if (Supply.tab === 'po')   Supply._renderPOList(body);
    else if (Supply.tab === 'grn')  Supply._renderGRNList(body);
    else if (Supply.tab === 'invoices') Supply._renderBills(body);
    else if (Supply.tab === 'reorder')  Supply._renderReorder(body);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 1 — OVERVIEW
  // ══════════════════════════════════════════════════════════════════════════
  _renderOverview: function(el) {
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';
    var suppliers = DB.getSuppliers();
    var pos       = DB.getPurchaseOrders();
    var grns      = DB.getGRNs();
    var bills     = DB.getSupplierBills();
    var products  = DB.getProducts().filter(function(p){ return p.status !== 'inactive'; });

    var totalOwed    = bills.filter(function(b){ return b.status !== 'Paid'; })
                        .reduce(function(a,b){ return a+(parseFloat(b.balance)||0); },0);
    var openPOs      = pos.filter(function(p){ return p.status !== 'Received' && p.status !== 'Cancelled'; }).length;
    var pendingGRNs  = grns.filter(function(g){ return g.status === 'Pending'; }).length;
    var overdueCount = bills.filter(function(b){ return b.status!=='Paid' && b.dueDate && b.dueDate < Utils.today(); }).length;

    // Stock value
    var stockValue = products.reduce(function(a,p){ return a+(parseFloat(p.cost)||0)*(parseInt(p.qty)||0); },0);

    // Reorder count
    var reorderNeeded = products.filter(function(p){ return p.qty <= (p.reorderPoint || p.lowLevel || 5); }).length;

    var kpis = '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)">'
      + '<div class="kpi-icon">💳</div><div class="kpi-label">Owed to Suppliers</div>'
      + '<div class="kpi-value">'+Utils.cur(totalOwed,cur)+'</div>'
      + '<div class="kpi-sub">'+(overdueCount>0?overdueCount+' overdue':'All current')+'</div></div>'

      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)">'
      + '<div class="kpi-icon">📋</div><div class="kpi-label">Open POs</div>'
      + '<div class="kpi-value">'+openPOs+'</div>'
      + '<div class="kpi-sub">Purchase orders active</div></div>'

      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">'
      + '<div class="kpi-icon">📦</div><div class="kpi-label">Stock Value</div>'
      + '<div class="kpi-value">'+Utils.cur(stockValue,cur)+'</div>'
      + '<div class="kpi-sub">At cost price</div></div>'

      + '<div class="kpi" style="--kc:'+(reorderNeeded>0?'var(--er)':'var(--ok)')+';--kibg:'+(reorderNeeded>0?'var(--erb)':'var(--okb)')+'">'
      + '<div class="kpi-icon">'+(reorderNeeded>0?'🔔':'✅')+'</div><div class="kpi-label">Reorder Needed</div>'
      + '<div class="kpi-value">'+reorderNeeded+'</div>'
      + '<div class="kpi-sub">'+(reorderNeeded>0?'Products low':'All stocked')+'</div></div>'
      + '</div></div>';

    // Recent POs
    var recentPORows = pos.slice(0,5).map(function(po) {
      var sc = {Draft:'var(--t3)',Sent:'var(--in)',Confirmed:'var(--wa)',Received:'var(--ok)',Cancelled:'var(--er)'}[po.status]||'var(--t3)';
      return '<div class="list-item" onclick="Supply.viewPO(\''+po.id+'\') ">'
        + '<div class="list-icon" style="background:var(--inb)">📋</div>'
        + '<div class="list-info"><div class="list-name">'+Utils.esc(po.supplier)+'</div>'
        + '<div class="list-meta">'+po.id+' · '+Utils.date(po.date)+'</div></div>'
        + '<div class="list-right"><div class="list-val">'+Utils.cur(po.total,cur)+'</div>'
        + '<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40;font-weight:700">'+po.status+'</span>'
        + '</div></div>';
    }).join('');

    // Overdue bills
    var overdueRows = bills.filter(function(b){ return b.status!=='Paid' && b.dueDate && b.dueDate < Utils.today(); })
      .slice(0,5).map(function(b) {
        var days = Math.round((new Date()-new Date(b.dueDate))/86400000);
        return '<div class="list-item" onclick="Supply.viewBill(\''+b.id+'\') ">'
          + '<div class="list-icon" style="background:var(--erb)">🧾</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(b.supplier)+'</div>'
          + '<div class="list-meta">'+b.id+' · Due: '+Utils.date(b.dueDate)+' ('+days+'d overdue)</div></div>'
          + '<div class="list-right"><div class="list-val" style="color:var(--er)">'+Utils.cur(b.balance,cur)+'</div>'
          + '<span style="font-size:9px;padding:2px 7px;border-radius:99px;background:var(--erb);color:var(--er);border:1px solid rgba(239,68,68,.3);font-weight:700">OVERDUE</span>'
          + '</div></div>';
      }).join('');

    el.innerHTML = kpis
      + (pos.length ? '<div class="sec"><div class="sec-title">Recent Purchase Orders <span class="sec-link" onclick="Supply.setTab(\'po\')">View All →</span></div><div class="card">'+recentPORows+'</div></div>' : '')
      + (overdueRows ? '<div class="sec"><div class="sec-title">⚠️ Overdue Bills <span class="sec-link" onclick="Supply.setTab(\'invoices\')">View All →</span></div><div class="card">'+overdueRows+'</div></div>' : '')
      + (pos.length===0&&bills.length===0 ? '<div class="sec"><div class="empty"><div class="empty-icon">🏭</div><div class="empty-title">No supply activity yet</div><div class="empty-sub">Create a Purchase Order to get started</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="Supply.setTab(\'po\')">＋ New Purchase Order</button></div></div></div>' : '');
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2 — PURCHASE ORDERS
  // ══════════════════════════════════════════════════════════════════════════
  _renderPOList: function(el) {
    var settings = DB.getSettings(); var cur = settings.currency||'$';
    var pos = DB.getPurchaseOrders();
    var statusColors = {Draft:'var(--t3)',Sent:'var(--in)',Confirmed:'var(--wa)',Received:'var(--ok)',Cancelled:'var(--er)'};

    var rows = pos.map(function(po) {
      var sc = statusColors[po.status]||'var(--t3)';
      return '<div class="list-item" onclick="Supply.viewPO(\''+po.id+'\')">'
        + '<div class="list-icon" style="background:var(--inb)">📋</div>'
        + '<div class="list-info"><div class="list-name">'+Utils.esc(po.supplier)+'</div>'
        + '<div class="list-meta">'+po.id+' · '+Utils.date(po.date)+'</div>'
        + '<div class="list-meta" style="font-size:10px;color:var(--t3)">'+(po.items||[]).length+' item'+(((po.items||[]).length)!==1?'s':'')+' · Expected: '+(po.expectedDate?Utils.date(po.expectedDate):'TBD')+'</div>'
        + '</div>'
        + '<div class="list-right"><div class="list-val">'+Utils.cur(po.total,cur)+'</div>'
        + '<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40;font-weight:700">'+po.status+'</span>'
        + '<div class="list-actions">'
        + (po.status!=='Received'&&po.status!=='Cancelled'?'<button class="btn-ok btn-sm" onclick="event.stopPropagation();Supply.openReceiveGRN(\''+po.id+'\')">📦 Receive</button>':'')
        + '<button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Supply.deletePO(\''+po.id+'\')">🗑</button>'
        + '</div></div></div>';
    }).join('');

    el.innerHTML = pos.length
      ? '<div class="sec"><div class="card">'+rows+'</div></div>'
      : '<div class="sec"><div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No purchase orders yet</div><div class="empty-sub">Tap "+ New PO" to order from a supplier</div></div></div>';
  },

  openNewPO: function() {
    var suppliers = DB.getSuppliers();
    var products  = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var cur       = DB.getSettings().currency||'$';
    if (!suppliers.length) { Toast.show('Add a supplier first','warn'); return; }
    Supply._poCart = [];

    Modal.open({
      title:'New Purchase Order', sub:'Order stock from a supplier', barColor:'var(--in)',
      body:'<div class="form-row">'
          +'<div class="fg"><label class="fl">Supplier *</label>'
          +'<select class="fi" id="po-supp" onchange="Supply._onPOSuppChange(this)">'+QuickCreate.supplierOptions()+'</select></div>'
          +'<div class="fg"><label class="fl">Expected Delivery</label>'
          +'<input class="fi" id="po-exp" type="date" value="'+Utils.today()+'"></div></div>'
          +'<div class="fg"><label class="fl">Add Products</label>'
          +'<select class="fi" id="po-prod-sel" onchange="Supply.addToPOCart(this)">'+QuickCreate.productOptions()+'</select></div>'
          +'<div id="po-cart-wrap"><div style="text-align:center;padding:14px;color:var(--t3);font-size:13px">No items added yet</div></div>'
          +'<div id="po-total-wrap"></div>'
          +'<div class="fg"><label class="fl">Notes</label><input class="fi" id="po-notes" placeholder="Any instructions..."></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.savePO()">💾 Save PO</button>',
    });
  },

  addToPOCart: function(sel) {
    // Intercept "+ Add New Product"
    if (QuickCreate.onProductChange(sel, function(newProd) {
      // Refresh dropdown and add new product to cart
      var poSel = Utils.get('po-prod-sel');
      if (poSel) poSel.innerHTML = QuickCreate.productOptions();
      Supply._poCart.push({id:newProd.id,name:newProd.name,qty:1,costPrice:parseFloat(newProd.cost)||0});
      Supply._renderPOCart();
    })) return;
    var id=sel.value; if(!id) return;
    var p=DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    sel.value='';
    if (Supply._poCart.find(function(i){ return i.id===id; })) return;
    Supply._poCart.push({id:id,name:p.name,qty:1,costPrice:parseFloat(p.cost)||0});
    Supply._renderPOCart();
  },

  _onPOSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var poSuppSel = Utils.get('po-supp');
      if (poSuppSel) {
        poSuppSel.innerHTML = QuickCreate.supplierOptions(newSupp.id);
        poSuppSel.value = newSupp.id;
      }
    });
  },

  _renderPOCart: function() {
    var el=Utils.get('po-cart-wrap'); if(!el) return;
    var cur=DB.getSettings().currency||'$';
    if(!Supply._poCart.length){ el.innerHTML='<div style="text-align:center;padding:14px;color:var(--t3);font-size:13px">No items added yet</div>'; Utils.get('po-total-wrap').innerHTML=''; return; }
    el.innerHTML=Supply._poCart.map(function(item,i){
      return '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">'
        +'<span style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(item.name)+'</span>'
        +'<input type="number" value="'+item.qty+'" min="1" oninput="Supply._setPOQty('+i+',this.value)" style="width:60px;text-align:center;font-size:13px;font-weight:600;background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:4px;color:var(--t1)">'
        +'<input type="number" value="'+item.costPrice+'" min="0" step="0.01" oninput="Supply._setPOCost('+i+',this.value)" style="width:80px;text-align:right;font-size:13px;font-weight:600;background:var(--gb);border:1px solid rgba(201,168,76,.2);border-radius:6px;padding:4px;color:var(--g)">'
        +'<button onclick="Supply._poCart.splice('+i+',1);Supply._renderPOCart()" style="background:var(--erb);border:1px solid var(--erbd);color:var(--er);border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>'
        +'</div>';
    }).join('');
    var total=Supply._poCart.reduce(function(a,i){ return a+(i.costPrice*i.qty); },0);
    Utils.get('po-total-wrap').innerHTML='<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:800"><span style="color:var(--t1)">PO Total</span><span style="color:var(--g);font-family:var(--fm)">'+Utils.cur(total,cur)+'</span></div>';
  },

  _setPOQty: function(i,v){ var n=parseInt(v); if(!isNaN(n)&&n>0){ Supply._poCart[i].qty=n; Supply._renderPOCart(); } },
  _setPOCost: function(i,v){ var n=parseFloat(v); if(!isNaN(n)&&n>=0){ Supply._poCart[i].costPrice=n; Supply._renderPOCart(); } },

  savePO: function() {
    var suppId=(Utils.get('po-supp')||{value:''}).value;
    if(!suppId){ Toast.show('Select a supplier','err'); return; }
    if(!Supply._poCart.length){ Toast.show('Add at least one product','err'); return; }
    var supp=DB.getSuppliers().find(function(s){ return s.id===suppId; });
    var total=Supply._poCart.reduce(function(a,i){ return a+(i.costPrice*i.qty); },0);
    DB.addPurchaseOrder({
      supplier: supp?supp.name:'Unknown',
      supplierId: suppId,
      items: Supply._poCart.map(function(i){ return Object.assign({},i); }),
      total: total,
      date: Utils.today(),
      expectedDate: Utils.val('po-exp'),
      notes: Utils.val('po-notes'),
      status: 'Sent',
    });
    Toast.show('Purchase Order saved ✓','ok');
    Modal.close();
    Supply.render();
  },

  viewPO: function(id) {
    var po=DB.getPurchaseOrders().find(function(x){ return x.id===id; }); if(!po) return;
    var cur=DB.getSettings().currency||'$';
    var sc={Draft:'var(--t3)',Sent:'var(--in)',Confirmed:'var(--wa)',Received:'var(--ok)',Cancelled:'var(--er)'}[po.status]||'var(--t3)';
    var statusOpts=['Draft','Sent','Confirmed','Received','Cancelled'].map(function(s){
      return '<option'+(po.status===s?' selected':'')+'>'+s+'</option>';
    }).join('');

    Modal.open({
      title:po.id, sub:Utils.esc(po.supplier)+' · '+Utils.date(po.date), barColor:'var(--in)',
      body:'<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
          +'<span style="font-size:12px;color:var(--t2)">Status</span>'
          +'<select onchange="Supply.updatePOStatus(\''+id+'\',this.value)" style="background:var(--bg2);border:1px solid var(--bd2);border-radius:6px;padding:4px 8px;font-size:12px;color:var(--t1)">'+statusOpts+'</select>'
          +'</div>'
          +'<div class="report-row"><span class="report-label">Expected Delivery</span><span class="report-val">'+(po.expectedDate?Utils.date(po.expectedDate):'Not set')+'</span></div>'
          +'<div class="report-row"><span class="report-label">PO Total</span><span class="report-val gold">'+Utils.cur(po.total,cur)+'</span></div>'
          +'</div>'
          +'<div class="sec-title" style="margin-bottom:6px">Ordered Items</div>'
          +'<div class="card card-body">'
          +(po.items||[]).map(function(item){
              return '<div class="report-row"><span class="report-label">'+Utils.esc(item.name)+'<span style="font-size:10px;color:var(--t3);margin-left:6px">×'+item.qty+'</span></span>'
                +'<span class="report-val gold">'+Utils.cur(item.costPrice*item.qty,cur)+'</span></div>';
            }).join('')
          +'</div>'+(po.notes?'<div style="font-size:12px;color:var(--t2);margin-top:10px;padding:10px;background:var(--bg3);border-radius:var(--r8)">'+Utils.esc(po.notes)+'</div>':''),
      footer:'<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            +(po.status!=='Received'&&po.status!=='Cancelled'?'<button class="btn-primary" style="flex:1" onclick="Modal.close();Supply.openReceiveGRN(\''+id+'\')">📦 Receive Stock</button>':''),
    });
  },

  updatePOStatus: function(id,status) {
    DB.updatePurchaseOrder(id,{status:status});
    Toast.show('Status updated ✓','ok');
    if (status==='Received') { Modal.close(); Supply.render(); }
  },

  deletePO: function(id) {
    confirmDel('Delete this purchase order?',function(){ DB.deletePurchaseOrder(id); Toast.show('Deleted','warn'); Supply.render(); });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 3 — GOODS RECEIVED NOTES (GRN)
  // ══════════════════════════════════════════════════════════════════════════
  _renderGRNList: function(el) {
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var grns=DB.getGRNs();
    var rows=grns.map(function(g){
      var sc=g.status==='Confirmed'?'var(--ok)':'var(--wa)';
      return '<div class="list-item" onclick="Supply.viewGRN(\''+g.id+'\')">'
        +'<div class="list-icon" style="background:var(--gb3)">📦</div>'
        +'<div class="list-info"><div class="list-name">'+Utils.esc(g.supplier)+'</div>'
        +'<div class="list-meta">'+g.id+' · '+Utils.date(g.date)+'</div>'
        +'<div class="list-meta" style="font-size:10px;color:var(--t3)">'+(g.poRef?'PO: '+g.poRef:'Manual receive')+'</div></div>'
        +'<div class="list-right"><div class="list-val">'+Utils.cur(g.total,cur)+'</div>'
        +'<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40;font-weight:700">'+g.status+'</span>'
        +'</div></div>';
    }).join('');

    el.innerHTML = grns.length
      ? '<div class="sec"><div class="card">'+rows+'</div></div>'
      : '<div class="sec"><div class="empty"><div class="empty-icon">📦</div><div class="empty-title">No stock received yet</div><div class="empty-sub">Record stock arrivals from suppliers here</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="Supply.openNewGRN()">＋ Receive Stock</button></div></div></div>';
  },

  openReceiveGRN: function(poId) {
    var po=DB.getPurchaseOrders().find(function(x){ return x.id===poId; });
    Supply._grnCart = po ? po.items.map(function(i){ return {id:i.id,name:i.name,orderedQty:i.qty,receivedQty:i.qty,costPrice:i.costPrice,condition:'Good'}; }) : [];
    Supply._grnPoRef = poId;
    Supply._openGRNForm(po?po.supplier:'', po?po.supplierId:'');
  },

  openNewGRN: function() {
    Supply._grnCart = [];
    Supply._grnPoRef = null;
    Supply._openGRNForm('', '');
  },

  _openGRNForm: function(supplierName, supplierId) {
    var suppliers=DB.getSuppliers();
    var products=DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var cur=DB.getSettings().currency||'$';

    Modal.open({
      title:'Receive Stock', sub:Supply._grnPoRef?'Receiving against '+Supply._grnPoRef:'Manual stock receipt', barColor:'var(--ok)',
      body:'<div class="form-row">'
          +'<div class="fg"><label class="fl">Supplier</label>'
          +'<select class="fi" id="grn-supp" onchange="Supply._onGRNSuppChange(this)">'+QuickCreate.supplierOptions(supplierId)+'</select></div>'
          +'<div class="fg"><label class="fl">Received Date</label>'
          +'<input class="fi" id="grn-date" type="date" value="'+Utils.today()+'"></div></div>'
          +(Supply._grnCart.length?'':
              '<div class="fg"><label class="fl">Add Product</label>'
              +'<select class="fi" id="grn-prod-sel" onchange="Supply.addToGRNCart(this)">'+QuickCreate.productOptions()+'</select></div>'
          )
          +'<div id="grn-cart-wrap"></div>'
          +'<div class="fg" style="margin-top:8px"><label class="fl">Delivery Note / Reference</label><input class="fi" id="grn-ref" placeholder="e.g. DN-1234"></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.saveGRN()">✅ Confirm Receipt</button>',
    });
    // Pre-fill supplier
    if (supplierId) { var el=Utils.get('grn-supp'); if(el) el.value=supplierId; }
    Supply._renderGRNCart();
  },

  addToGRNCart: function(sel) {
    if (QuickCreate.onProductChange(sel, function(newProd) {
      var grnSel = Utils.get('grn-prod-sel');
      if (grnSel) grnSel.innerHTML = QuickCreate.productOptions();
      Supply._grnCart.push({id:newProd.id,name:newProd.name,orderedQty:0,receivedQty:1,costPrice:parseFloat(newProd.cost)||0,condition:'Good'});
      Supply._renderGRNCart();
    })) return;
    var id=sel.value; if(!id) return;
    var p=DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    sel.value='';
    if (Supply._grnCart.find(function(i){ return i.id===id; })) return;
    Supply._grnCart.push({id:id,name:p.name,orderedQty:0,receivedQty:1,costPrice:parseFloat(p.cost)||0,condition:'Good'});
    Supply._renderGRNCart();
  },

  _onGRNSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var grnSuppSel = Utils.get('grn-supp');
      if (grnSuppSel) {
        grnSuppSel.innerHTML = QuickCreate.supplierOptions(newSupp.id);
        grnSuppSel.value = newSupp.id;
      }
    });
  },

  _renderGRNCart: function() {
    var el=Utils.get('grn-cart-wrap'); if(!el) return;
    var cur=DB.getSettings().currency||'$';
    if(!Supply._grnCart.length){ el.innerHTML=''; return; }
    el.innerHTML='<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin:10px 0 6px">Items to Receive</div>'
      +Supply._grnCart.map(function(item,i){
          return '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:10px 12px;margin-bottom:8px">'
            +'<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:8px">'+Utils.esc(item.name)+'</div>'
            +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
            +'<div><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Qty Received</div>'
            +'<input type="number" value="'+item.receivedQty+'" min="0" oninput="Supply._grnCart['+i+'].receivedQty=parseInt(this.value)||0" style="width:100%;font-size:14px;font-weight:700;background:var(--bg2);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 8px;color:var(--ok)"></div>'
            +'<div><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Cost Price</div>'
            +'<input type="number" value="'+item.costPrice+'" min="0" step="0.01" oninput="Supply._grnCart['+i+'].costPrice=parseFloat(this.value)||0" style="width:100%;font-size:14px;font-weight:700;background:var(--gb);border:1.5px solid rgba(201,168,76,.2);border-radius:6px;padding:5px 8px;color:var(--g)"></div>'
            +'<div><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Condition</div>'
            +'<select onchange="Supply._grnCart['+i+'].condition=this.value" style="width:100%;background:var(--bg2);border:1px solid var(--bd2);border-radius:6px;padding:5px;color:var(--t1);font-size:12px">'
            +'<option'+(item.condition==='Good'?' selected':'')+'>Good</option>'
            +'<option'+(item.condition==='Damaged'?' selected':'')+'>Damaged</option>'
            +'<option'+(item.condition==='Short'?' selected':'')+'>Short</option>'
            +'</select></div>'
            +'</div></div>';
        }).join('');
  },

  saveGRN: function() {
    var suppId=(Utils.get('grn-supp')||{value:''}).value;
    if(!suppId){ Toast.show('Select a supplier','err'); return; }
    if(!Supply._grnCart.length){ Toast.show('Add at least one item','err'); return; }
    var supp=DB.getSuppliers().find(function(s){ return s.id===suppId; });
    var total=Supply._grnCart.reduce(function(a,i){ return a+i.receivedQty*i.costPrice; },0);

    var grn=DB.addGRN({
      supplier: supp?supp.name:'Unknown',
      supplierId: suppId,
      poRef: Supply._grnPoRef||null,
      items: Supply._grnCart.map(function(i){ return Object.assign({},i); }),
      total: total,
      date: Utils.val('grn-date')||Utils.today(),
      deliveryRef: Utils.val('grn-ref'),
      status: 'Confirmed',
    });

    // Update product stock and cost price (weighted average)
    Supply._grnCart.forEach(function(item) {
      if (item.condition==='Damaged') return; // Don't add damaged to stock
      var p=DB.getProducts().find(function(x){ return x.id===item.id; });
      if(p){
        var newQty   = (parseInt(p.qty)||0) + item.receivedQty;
        var oldValue = (parseInt(p.qty)||0) * (parseFloat(p.cost)||0);
        var newValue = item.receivedQty * item.costPrice;
        var avgCost  = newQty>0 ? (oldValue+newValue)/newQty : item.costPrice;
        DB.updateProduct(item.id,{ qty:newQty, cost:parseFloat(avgCost.toFixed(4)) });
      }
    });

    // Mark PO as received
    if(Supply._grnPoRef) DB.updatePurchaseOrder(Supply._grnPoRef,{status:'Received'});

    Toast.show('Stock received ✓ — inventory updated','ok');
    Modal.close();
    Supply.render();
  },

  viewGRN: function(id) {
    var g=DB.getGRNs().find(function(x){ return x.id===id; }); if(!g) return;
    var cur=DB.getSettings().currency||'$';
    Modal.open({
      title:g.id, sub:Utils.esc(g.supplier)+' · '+Utils.date(g.date), barColor:'var(--ok)',
      body:'<div class="card card-body">'
          +'<div class="report-row"><span class="report-label">Supplier</span><span class="report-val">'+Utils.esc(g.supplier)+'</span></div>'
          +(g.poRef?'<div class="report-row"><span class="report-label">PO Reference</span><span class="report-val">'+g.poRef+'</span></div>':'')
          +(g.deliveryRef?'<div class="report-row"><span class="report-label">Delivery Note</span><span class="report-val">'+Utils.esc(g.deliveryRef)+'</span></div>':'')
          +'<div class="report-row"><span class="report-label">Total Value</span><span class="report-val gold">'+Utils.cur(g.total,cur)+'</span></div>'
          +'</div>'
          +'<div class="sec-title" style="margin:12px 0 6px">Items Received</div>'
          +'<div class="card card-body">'
          +(g.items||[]).map(function(item){
              var cond=item.condition!=='Good'?'<span style="font-size:9px;color:var(--er);margin-left:5px">'+item.condition+'</span>':'';
              return '<div class="report-row"><span class="report-label">'+Utils.esc(item.name)+cond+'<span style="font-size:10px;color:var(--t3);margin-left:6px">×'+item.receivedQty+'</span></span>'
                +'<span class="report-val gold">'+Utils.cur(item.costPrice*item.receivedQty,cur)+'</span></div>';
            }).join('')
          +'</div>',
      footer:'<button class="btn-primary" style="flex:1" onclick="Modal.close()">Close</button>',
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 4 — SUPPLIER BILLS / INVOICES
  // ══════════════════════════════════════════════════════════════════════════
  _renderBills: function(el) {
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var bills=DB.getSupplierBills();
    var today=Utils.today();

    var rows=bills.map(function(b){
      var isOverdue=b.status!=='Paid'&&b.dueDate&&b.dueDate<today;
      var sc=b.status==='Paid'?'var(--ok)':isOverdue?'var(--er)':'var(--wa)';
      var label=b.status==='Paid'?'PAID':isOverdue?'OVERDUE':'UNPAID';
      return '<div class="list-item" onclick="Supply.viewBill(\''+b.id+'\')">'
        +'<div class="list-icon" style="background:var(--wab)">🧾</div>'
        +'<div class="list-info"><div class="list-name">'+Utils.esc(b.supplier)+'</div>'
        +'<div class="list-meta">'+b.id+' · '+Utils.date(b.date)+'</div>'
        +'<div class="list-meta" style="font-size:10px;color:var(--t3)">Due: '+(b.dueDate?Utils.date(b.dueDate):'No due date')+'</div></div>'
        +'<div class="list-right"><div class="list-val">'+Utils.cur(b.total,cur)+'</div>'
        +(b.balance>0?'<div style="font-size:10px;color:var(--wa);margin-top:2px">Bal: '+Utils.cur(b.balance,cur)+'</div>':'')
        +'<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40;font-weight:700">'+label+'</span>'
        +(b.status!=='Paid'?'<button class="btn-ok btn-sm" style="margin-top:4px" onclick="event.stopPropagation();Supply.openPayBill(\''+b.id+'\')">💳 Pay</button>':'')
        +'</div></div>';
    }).join('');

    el.innerHTML = bills.length
      ? '<div class="sec"><div class="card">'+rows+'</div></div>'
      : '<div class="sec"><div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No supplier bills yet</div><div class="empty-sub">Record supplier invoices here to track what you owe</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="Supply.openNewBill()">＋ Add Bill</button></div></div></div>';
  },

  openNewBill: function() {
    var suppliers=DB.getSuppliers();
    Modal.open({
      title:'Add Supplier Bill', sub:'Record an invoice from a supplier', barColor:'var(--wa)',
      body:'<div class="fg"><label class="fl">Supplier *</label>'
          +'<select class="fi" id="bill-supp" onchange="Supply._onBillSuppChange(this)">'+QuickCreate.supplierOptions()+'</select></div>'
          +'<div class="fg"><label class="fl">Supplier Invoice Number</label>'
          +'<input class="fi" id="bill-ref" placeholder="e.g. INV-789"></div>'
          +'<div class="form-row">'
          +'<div class="fg"><label class="fl">Invoice Date</label>'
          +'<input class="fi" id="bill-date" type="date" value="'+Utils.today()+'"></div>'
          +'<div class="fg"><label class="fl">Due Date</label>'
          +'<input class="fi" id="bill-due" type="date"></div></div>'
          +'<div class="fg"><label class="fl">Amount *</label>'
          +'<input class="fi" id="bill-amt" type="number" step="0.01" min="0" placeholder="0.00" style="font-size:18px;font-weight:700"></div>'
          +'<div class="fg"><label class="fl">Notes</label>'
          +'<input class="fi" id="bill-notes" placeholder="What was this for?"></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.saveBill()">💾 Save Bill</button>',
    });
  },

  _onBillSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var billSel = Utils.get('bill-supp');
      if (billSel) {
        billSel.innerHTML = QuickCreate.supplierOptions(newSupp.id);
        billSel.value = newSupp.id;
      }
    });
  },

  saveBill: function() {
    var suppId=(Utils.get('bill-supp')||{value:''}).value;
    var amt=parseFloat(Utils.val('bill-amt')||0);
    if(!suppId){ Toast.show('Select a supplier','err'); return; }
    if(!amt){ Toast.show('Enter the amount','err'); return; }
    var supp=DB.getSuppliers().find(function(s){ return s.id===suppId; });
    DB.addSupplierBill({
      supplier: supp?supp.name:'Unknown',
      supplierId: suppId,
      ref: Utils.val('bill-ref'),
      date: Utils.val('bill-date')||Utils.today(),
      dueDate: Utils.val('bill-due'),
      total: amt,
      balance: amt,
      notes: Utils.val('bill-notes'),
      status: 'Unpaid',
    });
    // Update supplier balance
    if(supp){ DB.updateSupplier(suppId,{balance:(parseFloat(supp.balance)||0)+amt}); }
    Toast.show('Bill saved ✓','ok');
    Modal.close();
    Supply.render();
  },

  viewBill: function(id) {
    var b=DB.getSupplierBills().find(function(x){ return x.id===id; }); if(!b) return;
    var cur=DB.getSettings().currency||'$';
    var today=Utils.today();
    var isOverdue=b.status!=='Paid'&&b.dueDate&&b.dueDate<today;
    Modal.open({
      title:b.id, sub:Utils.esc(b.supplier), barColor:b.status==='Paid'?'var(--ok)':isOverdue?'var(--er)':'var(--wa)',
      body:'<div class="card card-body">'
          +'<div class="report-row"><span class="report-label">Supplier</span><span class="report-val">'+Utils.esc(b.supplier)+'</span></div>'
          +(b.ref?'<div class="report-row"><span class="report-label">Supplier Invoice No.</span><span class="report-val">'+Utils.esc(b.ref)+'</span></div>':'')
          +'<div class="report-row"><span class="report-label">Invoice Date</span><span class="report-val">'+Utils.date(b.date)+'</span></div>'
          +(b.dueDate?'<div class="report-row"><span class="report-label">Due Date</span><span class="report-val" style="color:'+(isOverdue?'var(--er)':'var(--t1)')+'">'+Utils.date(b.dueDate)+(isOverdue?' ⚠️ OVERDUE':'')+'</span></div>':'')
          +'<div class="report-row"><span class="report-label">Total Amount</span><span class="report-val gold">'+Utils.cur(b.total,cur)+'</span></div>'
          +'<div class="report-row"><span class="report-label">Balance Due</span><span class="report-val" style="color:'+(b.balance>0?'var(--wa)':'var(--ok)')+'">'+Utils.cur(b.balance,cur)+'</span></div>'
          +(b.notes?'<div style="font-size:12px;color:var(--t2);margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">'+Utils.esc(b.notes)+'</div>':'')
          +'</div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            +(b.status!=='Paid'?'<button class="btn-primary" style="flex:1" onclick="Modal.close();Supply.openPayBill(\''+id+'\')">💳 Pay Bill</button>':''),
    });
  },

  openPayBill: function(id) {
    var b=DB.getSupplierBills().find(function(x){ return x.id===id; }); if(!b) return;
    var cur=DB.getSettings().currency||'$';
    Modal.open({
      title:'Pay Bill', sub:Utils.esc(b.supplier)+' · '+Utils.cur(b.balance,cur)+' outstanding', barColor:'var(--ok)',
      body:'<div style="background:var(--gb3);border:1px solid rgba(201,168,76,.2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          +'<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--t2)">Total Bill</span><span style="font-weight:700">'+Utils.cur(b.total,cur)+'</span></div>'
          +'<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800"><span style="color:var(--wa)">Balance Due</span><span style="color:var(--wa)">'+Utils.cur(b.balance,cur)+'</span></div>'
          +'</div>'
          +'<div class="fg"><label class="fl">Amount Paying Now *</label>'
          +'<input class="fi" id="pb2-amt" type="number" value="'+b.balance.toFixed(2)+'" min="0.01" step="0.01" style="font-size:18px;font-weight:700;color:var(--ok)"></div>'
          +'<div class="fg"><label class="fl">Payment Method</label>'
          +'<select class="fi" id="pb2-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.payBill(\''+id+'\')">💳 Record Payment</button>',
    });
  },

  payBill: function(id) {
    var b=DB.getSupplierBills().find(function(x){ return x.id===id; }); if(!b) return;
    var paying=Math.min(parseFloat(Utils.val('pb2-amt')||0),parseFloat(b.balance)||0);
    if(paying<=0){ Toast.show('Enter valid amount','err'); return; }
    var newBal=Math.max(0,b.balance-paying);
    var newStatus=newBal<=0?'Paid':'Partial';
    DB.updateSupplierBill(id,{balance:newBal,status:newStatus});
    // Reduce supplier balance
    var supp=DB.getSuppliers().find(function(s){ return s.id===b.supplierId; });
    if(supp){ DB.updateSupplier(b.supplierId,{balance:Math.max(0,(parseFloat(supp.balance)||0)-paying)}); }
    Toast.show(newStatus==='Paid'?'Bill fully paid ✅':'Payment recorded ✓','ok');
    Modal.close();
    Supply.render();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 5 — REORDER ALERTS + AUTO-PO
  // ══════════════════════════════════════════════════════════════════════════
  _renderReorder: function(el) {
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var products=DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var suppliers=DB.getSuppliers();

    // Products needing reorder
    var needReorder=products.filter(function(p){ return p.qty<=(p.reorderPoint||p.lowLevel||5); });
    // Products fine
    var stockOK=products.filter(function(p){ return p.qty>(p.reorderPoint||p.lowLevel||5); });

    var reorderRows=needReorder.map(function(p){
      var pct=Math.min(100,Math.max(2,Math.round((p.qty/Math.max(p.reorderPoint||p.lowLevel||5,1))*100)));
      var isOut=p.qty===0;
      var lc=isOut?'var(--er)':'var(--wa)';
      var defaultSupp=suppliers.find(function(s){ return s.id===p.defaultSupplierId; });
      return '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:13px 14px;margin-bottom:10px">'
        +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">'
        +'<div><div style="font-size:14px;font-weight:700;color:var(--t1)">'+Utils.esc(p.name)+'</div>'
        +'<div style="font-size:11px;color:var(--t2);margin-top:3px">Current: <strong style="color:'+lc+'">'+p.qty+'</strong> · Reorder point: '+(p.reorderPoint||p.lowLevel||5)+'</div>'
        +'<div style="font-size:11px;color:var(--t3);margin-top:1px">Reorder qty: '+(p.reorderQty||20)+' · Cost price: '+Utils.cur(p.cost||0,cur)+'</div>'
        +'</div>'
        +'<span style="padding:3px 10px;border-radius:99px;font-size:9px;font-weight:800;background:'+lc+'18;color:'+lc+';border:1px solid '+lc+'40;white-space:nowrap">'+(isOut?'OUT OF STOCK':'LOW STOCK')+'</span>'
        +'</div>'
        +'<div class="progress" style="height:5px;margin-bottom:10px"><div class="progress-fill" style="width:'+pct+'%;background:'+lc+'"></div></div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        +(defaultSupp?'<span style="font-size:11px;color:var(--t2)">Supplier: <strong>'+Utils.esc(defaultSupp.name)+'</strong></span>':'<span style="font-size:11px;color:var(--t3)">No default supplier set</span>')
        +'<button class="btn-primary btn-sm" style="margin-left:auto" onclick="Supply.createAutoPO(\''+p.id+'\')">📋 Create PO</button>'
        +'<button class="btn-ghost btn-sm" onclick="Supply.openSetReorderLevels(\''+p.id+'\')">⚙️ Settings</button>'
        +'</div></div>';
    }).join('');

    el.innerHTML = '<div class="sec">'
      + (needReorder.length
          ? '<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:var(--r12);padding:12px 14px;margin-bottom:14px">'
            +'<div style="font-size:12px;font-weight:700;color:var(--er);margin-bottom:3px">⚠️ '+needReorder.length+' product'+(needReorder.length!==1?'s':'')+' need reordering</div>'
            +'<div style="font-size:11px;color:var(--t2)">Tap "Create PO" to auto-generate a Purchase Order</div></div>'
            + reorderRows
          : '<div style="background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r12);padding:14px;text-align:center;font-size:14px;font-weight:600;color:var(--ok)">✓ All products are well stocked</div>')
      + (stockOK.length?'<div style="font-size:10px;color:var(--t3);text-align:center;margin-top:12px">'+stockOK.length+' other products at adequate stock levels</div>':'')
      + '</div>';
  },

  createAutoPO: function(productId) {
    var p=DB.getProducts().find(function(x){ return x.id===productId; }); if(!p) return;
    var suppliers=DB.getSuppliers();
    // suppOpts built via QuickCreate for auto-PO
    var cur=DB.getSettings().currency||'$';
    var orderQty=p.reorderQty||20;
    var total=orderQty*(parseFloat(p.cost)||0);

    Modal.open({
      title:'Create Purchase Order', sub:'Reorder: '+Utils.esc(p.name), barColor:'var(--in)',
      body:'<div style="background:var(--gb3);border:1px solid rgba(201,168,76,.2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          +'<div style="font-size:13px;font-weight:700;color:var(--t1)">'+Utils.esc(p.name)+'</div>'
          +'<div style="font-size:11px;color:var(--t2);margin-top:4px">Current stock: <strong style="color:var(--er)">'+p.qty+'</strong> · Reorder qty: <strong>'+orderQty+'</strong></div>'
          +'</div>'
          +'<div class="fg"><label class="fl">Supplier *</label>'
          +'<select class="fi" id="auto-po-supp" onchange="Supply._onAutoPOSuppChange(this)">'+QuickCreate.supplierOptions(p.defaultSupplierId)+'</select></div>'
          +'<div class="form-row">'
          +'<div class="fg"><label class="fl">Order Quantity</label>'
          +'<input class="fi" id="auto-po-qty" type="number" value="'+orderQty+'" min="1" oninput="Supply._updateAutoPOTotal(\''+productId+'\',this.value)"></div>'
          +'<div class="fg"><label class="fl">Cost Price</label>'
          +'<input class="fi" id="auto-po-cost" type="number" value="'+(parseFloat(p.cost)||0).toFixed(2)+'" step="0.01" oninput="Supply._updateAutoPOTotal(\''+productId+'\',null)"></div>'
          +'</div>'
          +'<div id="auto-po-total" style="font-size:16px;font-weight:800;color:var(--g);text-align:right;padding:8px 0">PO Total: '+Utils.cur(total,cur)+'</div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.saveAutoPO(\''+productId+'\')">💾 Create PO</button>',
    });
  },

  _updateAutoPOTotal: function(productId, newQty) {
    var qty  = parseInt((Utils.get('auto-po-qty')||{value:'0'}).value)||0;
    var cost = parseFloat((Utils.get('auto-po-cost')||{value:'0'}).value)||0;
    var cur  = DB.getSettings().currency||'$';
    var el   = Utils.get('auto-po-total');
    if (el) el.textContent = 'PO Total: '+Utils.cur(qty*cost,cur);
  },

  _onAutoPOSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var autoSel = Utils.get('auto-po-supp');
      if (autoSel) {
        autoSel.innerHTML = QuickCreate.supplierOptions(newSupp.id);
        autoSel.value = newSupp.id;
      }
    });
  },

  saveAutoPO: function(productId) {
    var p=DB.getProducts().find(function(x){ return x.id===productId; }); if(!p) return;
    var suppId=(Utils.get('auto-po-supp')||{value:''}).value;
    var qty=parseInt((Utils.get('auto-po-qty')||{value:'0'}).value)||0;
    var cost=parseFloat((Utils.get('auto-po-cost')||{value:'0'}).value)||0;
    if(!suppId){ Toast.show('Select a supplier','err'); return; }
    if(qty<1){ Toast.show('Enter quantity','err'); return; }
    var supp=DB.getSuppliers().find(function(s){ return s.id===suppId; });
    DB.addPurchaseOrder({
      supplier: supp?supp.name:'Unknown',
      supplierId: suppId,
      items:[{id:productId,name:p.name,qty:qty,costPrice:cost,orderedQty:qty}],
      total: qty*cost,
      date: Utils.today(),
      status:'Sent',
      autoGenerated:true,
    });
    // Save default supplier for next time
    DB.updateProduct(productId,{defaultSupplierId:suppId,reorderQty:qty});
    Toast.show('Purchase Order created ✓','ok');
    Modal.close();
    Supply.render();
  },

  openSetReorderLevels: function(id) {
    var p=DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    var suppliers=DB.getSuppliers();
    // suppOpts via QuickCreate
    Modal.open({
      title:'Reorder Settings', sub:Utils.esc(p.name), barColor:'var(--in)',
      body:'<div class="form-row">'
          +'<div class="fg"><label class="fl">Reorder Point</label>'
          +'<input class="fi" id="rl-point" type="number" value="'+(p.reorderPoint||p.lowLevel||5)+'" min="0">'
          +'<div style="font-size:10px;color:var(--t3);margin-top:3px">Alert when stock reaches this level</div></div>'
          +'<div class="fg"><label class="fl">Reorder Quantity</label>'
          +'<input class="fi" id="rl-qty" type="number" value="'+(p.reorderQty||20)+'" min="1">'
          +'<div style="font-size:10px;color:var(--t3);margin-top:3px">How many to order each time</div></div>'
          +'</div>'
          +'<div class="fg"><label class="fl">Default Supplier</label>'
          +'<select class="fi" id="rl-supp" onchange="Supply._onRLSuppChange(this)">'+QuickCreate.supplierOptions(p.defaultSupplierId,'— none —')+'</select></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.saveReorderSettings(\''+id+'\')">💾 Save</button>',
    });
  },

  _onRLSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var rlSel = Utils.get('rl-supp');
      if (rlSel) {
        rlSel.innerHTML = QuickCreate.supplierOptions(newSupp.id, '— none —');
        rlSel.value = newSupp.id;
      }
    });
  },

  saveReorderSettings: function(id) {
    DB.updateProduct(id,{
      reorderPoint: parseInt(Utils.val('rl-point')||5),
      reorderQty:   parseInt(Utils.val('rl-qty')||20),
      defaultSupplierId: (Utils.get('rl-supp')||{value:''}).value||null,
    });
    Toast.show('Reorder settings saved ✓','ok');
    Modal.close();
    Supply.render();
  },
};
