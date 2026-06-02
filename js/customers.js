function renderCustomers(){
  const b=biz();
  if(!b){ var cw=el('custlist'); if(cw) cw.innerHTML='<div style="padding:30px;text-align:center;color:var(--t3)"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-weight:700">Loading...</div></div>'; return; }
  const q=(gv('custq')||'').toLowerCase();
  const sales=(b.sales||[]).filter(s=>s.status!=='cancelled');
  const spendMap={};
  sales.forEach(s=>{const k=(s.customer||'').toLowerCase();spendMap[k]=(spendMap[k]||0)+sTotal(s);});
  let custs=(b.customers||[]);
  if(q)custs=custs.filter(c=>c.name.toLowerCase().includes(q)||(c.phone||'').includes(q));
  const totalSpend=Object.values(spendMap).reduce((a,v)=>a+v,0);
  const sumEl=el('cust-summary');
  if(sumEl)sumEl.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">'+
    '<div class="cust-stat"><div class="cust-stat-l">Total</div><div class="cust-stat-v c-g">'+((b.customers||[]).length)+'</div></div>'+
    '<div class="cust-stat"><div class="cust-stat-l">Revenue</div><div class="cust-stat-v c-ok">'+f$(totalSpend)+'</div></div>'+
    '<div class="cust-stat"><div class="cust-stat-l">Avg Spend</div><div class="cust-stat-v c-in">'+
    ((b.customers||[]).length>0?f$(totalSpend/(b.customers||[]).length):f$(0))+'</div></div></div>';
  const wrap=el('custlist');if(!wrap)return;
  if(!custs.length){
    wrap.innerHTML=q?
      emS('🔍','No Customers Found','Try a different search term.'):
      emS('👤','No Customers Yet','Build your customer database to track purchase history and lifetime value.','<button type="button" class="btn bg bsm" onclick="openAddCustomer()">+ Add Customer</button>');
    return;
  }
  wrap.innerHTML=custs.map(c=>{
    const spent=spendMap[(c.name||'').toLowerCase()]||0;
    const custSales=sales.filter(s=>s.customer.toLowerCase()===(c.name||'').toLowerCase());
    const outstanding=custSales.reduce((a,s)=>a+sDue(s),0);
    return '<div class="cust-card" onclick="openCustDetail('+c.id+')">'+
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">'+
      '<div class="cust-av">'+mkInit(c.name)+'</div>'+
      '<div style="flex:1;min-width:0">'+
      '<div style="font-size:14px;font-weight:700;color:var(--t1)">'+esc(c.name)+'</div>'+
      '<div style="font-size:11px;color:var(--t3);margin-top:2px">'+(c.phone?'📞 '+esc(c.phone):'')+(c.notes?' · '+esc(c.notes):'')+'</div></div>'+
      (outstanding>0?'<span class="bdg ber0">Owes '+f$(outstanding)+'</span>':'')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'+
      '<div class="cust-stat"><div class="cust-stat-l">Spent</div><div class="cust-stat-v c-g">'+f$(spent)+'</div></div>'+
      '<div class="cust-stat"><div class="cust-stat-l">Orders</div><div class="cust-stat-v c-in">'+custSales.length+'</div></div>'+
      '<div class="cust-stat"><div class="cust-stat-l">Balance</div><div class="cust-stat-v" style="color:'+(outstanding>0?'var(--er)':'var(--ok)')+'">'+f$(outstanding)+'</div></div></div></div>';
  }).join('');
}
function openAddCustomer(){
  editingCustId = null;
  el('cust-dr-ttl').textContent = 'Add Customer';
  el('cust-dr-sub').textContent = 'Add to your customer database';
  el('cust-save-btn').textContent = '💾 Save Customer';
  ['cust-name','cust-phone','cust-email','cust-addr','cust-notes'].forEach(function(id){ sv(id,''); });
  var statsWrap = document.getElementById('cust-stats-wrap');
  if(statsWrap) statsWrap.style.display = 'none';
  var preview = document.getElementById('cust-preview');
  if(preview) preview.style.display = 'none';
  openD('d-customer');
  setTimeout(function(){ var n = el('cust-name'); if(n) n.focus(); }, 300);
}
function editCurrentCustomer(){if(viewingCustId)openEditCustomer(viewingCustId);}
function openEditCustomer(id){
  var b = biz(); if(!b) return;
  var c = (b.customers||[]).find(function(x){return x.id===id;});
  if(!c) return;
  editingCustId = id;
  el('cust-dr-ttl').textContent = 'Edit Customer';
  el('cust-dr-sub').textContent = 'Update customer details';
  el('cust-save-btn').textContent = '✔ Update Customer';
  sv('cust-name',  c.name || '');
  sv('cust-phone', c.phone || '');
  sv('cust-email', c.email || '');
  sv('cust-addr',  c.address || '');
  sv('cust-notes', c.notes || '');

  // Compute activity stats
  var custSales = (b.sales||[]).filter(function(s){
    return s.status !== 'cancelled' && (s.customer||'').toLowerCase() === (c.name||'').toLowerCase();
  });
  var totalRev  = custSales.reduce(function(a,s){return a + sTotal(s);}, 0);
  var totalOwed = custSales.reduce(function(a,s){return a + sDue(s);}, 0);

  var sEl = document.getElementById('cust-stat-sales');
  var rEl = document.getElementById('cust-stat-rev');
  var oEl = document.getElementById('cust-stat-owed');
  var wrap= document.getElementById('cust-stats-wrap');
  if(sEl) sEl.textContent = custSales.length;
  if(rEl) rEl.textContent = f$(totalRev);
  if(oEl) oEl.textContent = f$(totalOwed);
  if(wrap) wrap.style.display = '';

  openD('d-customer');
  updateCustPreview();
}
function saveCustomer(_saveMode){const b=biz();if(!b)return;const name=gv('cust-name');if(!name){toast('Name required','er');return;}if(!b.customers)b.customers=[];if(!b.nextCustId)b.nextCustId=1;const now=Date.now();if(editingCustId!==null){const i=b.customers.findIndex(x=>x.id===editingCustId);if(i>-1)b.customers[i]={...b.customers[i],name,phone:gv('cust-phone'),email:gv('cust-email'),address:gv('cust-addr'),notes:gv('cust-notes'),updatedAt:now};toast('Customer updated!');}else{b.customers.push({id:b.nextCustId++,name,phone:gv('cust-phone'),email:gv('cust-email'),address:gv('cust-addr'),notes:gv('cust-notes'),createdAt:now});addNotif('customer','👤 New customer: '+name);toast('Customer added!','gd');}dbSave();renderCustomers();
  if(_saveMode==='addnew'&&!editingCustId){ setTimeout(function(){openAddCustomer();},150); }
  else { closeD('d-customer'); }
}
function openCustDetail(id){
  const b=biz();const c=(b.customers||[]).find(x=>x.id===id);if(!c)return;viewingCustId=id;
  el('cdet-name').textContent=c.name;el('cdet-sub').textContent=(c.phone?'📞 '+c.phone:'')+(c.email?' · '+c.email:'');
  const sales=(b.sales||[]).filter(s=>s.customer.toLowerCase()===(c.name||'').toLowerCase()&&s.status!=='cancelled');
  const spent=sales.reduce((a,s)=>a+sTotal(s),0),outstanding=sales.reduce((a,s)=>a+sDue(s),0),avgOrder=sales.length>0?spent/sales.length:0;
  el('cdet-stats').innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
    '<div class="cust-stat"><div class="cust-stat-l">Lifetime Value</div><div class="cust-stat-v c-g">'+f$(spent)+'</div></div>'+
    '<div class="cust-stat"><div class="cust-stat-l">Total Orders</div><div class="cust-stat-v c-in">'+sales.length+'</div></div>'+
    '<div class="cust-stat"><div class="cust-stat-l">Avg Order</div><div class="cust-stat-v">'+f$(avgOrder)+'</div></div>'+
    '<div class="cust-stat"><div class="cust-stat-l">Outstanding</div><div class="cust-stat-v" style="color:'+(outstanding>0?'var(--er)':'var(--ok)')+'">'+f$(outstanding)+'</div></div></div>'+
    (c.address?'<div style="margin-top:8px;font-size:12px;color:var(--t2)">📍 '+esc(c.address)+'</div>':'')+
    (c.notes?'<div style="margin-top:4px"><span class="bdg bdf">'+esc(c.notes)+'</span></div>':'');
  const hist=el('cdet-history');
  if(hist)hist.innerHTML=sales.length?
    '<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;padding:9px 14px 5px;letter-spacing:.1em">Purchase History ('+sales.length+')</div>'+
    '<div class="card" style="border-radius:0;border:none">'+
    [...sales].sort((a,b)=>b.id-a.id).map(s=>
      '<div class="cr cl" onclick="viewReceipt('+s.id+')">'+
      '<div class="ci" style="background:var(--gd)">🧾</div>'+
      '<div class="cb"><div class="ct">'+esc(s.inv||'—')+'</div>'+
      '<div class="cs">'+s.date+' · '+s.items.map(i=>esc(i.name)+' ×'+i.qty).join(', ')+'</div></div>'+
      '<div style="text-align:right"><div class="cv c-g">'+f$(sTotal(s))+'</div>'+
      '<div class="cm">'+payBadge(sSt(s))+'</div></div></div>').join('')+'</div>':
    emS('🧾','No Purchases Yet','No sales recorded for this customer.');
  openD('d-cust-detail');
}
function newSaleForCustomer(){const b=biz();const c=(b.customers||[]).find(x=>x.id===viewingCustId);closeD('d-cust-detail');openNewSale();if(c)setTimeout(()=>{sv('scust',c.name);sv('scont',c.phone||'');},300);}
function custAutoComplete(){
  const b=biz();const q=(gv('scust')||'').toLowerCase();const listEl=el('cust-ac-list');if(!listEl)return;
  if(!q||q.length<1){listEl.style.display='none';return;}
  const matches=(b.customers||[]).filter(c=>c.name.toLowerCase().includes(q)).slice(0,5);
  if(!matches.length){listEl.style.display='none';return;}
  listEl.innerHTML='<div class="autocomplete-list">'+matches.map(c=>
    '<div class="autocomplete-item" onclick="selectCust('+c.id+')">'+
    '<div class="autocomplete-name">'+esc(c.name)+'</div>'+
    '<div class="autocomplete-sub">'+(c.phone?'📞 '+esc(c.phone):'No phone')+'</div></div>').join('')+'</div>';
  listEl.style.display='';
}
function selectCust(id){const b=biz();const c=(b.customers||[]).find(x=>x.id===id);if(!c)return;sv('scust',c.name);sv('scont',c.phone||'');const l=el('cust-ac-list');if(l)l.style.display='none';}
document.addEventListener('click',e=>{if(!e.target.closest('#scust')&&!e.target.closest('#cust-ac-list')){const l=el('cust-ac-list');if(l)l.style.display='none';}});

// ── QUICK PRODUCT GRID ──
function renderQuickProdGrid() {
  const b = biz(); if (!b) return;
  const grid = el('quick-prod-grid'); if (!grid) return;
  const prods = (b.products || []).slice(0, 24);
  if (!prods.length) {
    grid.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:8px 0;grid-column:1/-1;text-align:center">No products added yet — add products first</div>';
    return;
  }
  const cartIds = new Set(cartItems.map(c => c.prodId));
  grid.innerHTML = prods.map(function(p) {
    var oos    = p.qty <= 0;
    var inCart = cartIds.has(p.id);
    var cls    = 'qpi-v2' + (oos ? ' oos' : '') + (inCart ? ' in-cart' : '');
    var img    = p.imgData
      ? '<img src="' + p.imgData + '" alt="' + esc(p.name) + '" style="width:100%;height:100%;object-fit:cover">'
      : (CATI[p.category] || '📦');
    var stockTxt  = oos ? 'OUT' : p.qty + ' ' + p.unit;
    var stockCol  = oos ? 'var(--er)' : 'var(--t3)';
    var clickAttr = oos ? '' : ' onclick="addToCart(' + p.id + ')"';
    return '<div class="' + cls + '"' + clickAttr + ' title="' + esc(p.name) + '">' +
      '<div class="qpi-v2-img">' + img + '</div>' +
      '<div class="qpi-v2-name">' + esc(p.name) + '</div>' +
      '<div class="qpi-v2-price">' + f$(p.price) + '</div>' +
      '<div class="qpi-v2-stock" style="color:' + stockCol + '">' + stockTxt + '</div>' +
      '</div>';
  }).join('');
}

function toggleSaleMode() {
  saleMode = saleMode === 'quick' ? 'search' : 'quick';
  const qg  = el('quick-prod-grid');
  const sw  = el('sale-search-wrap');
  const btn = el('sale-mode-btn');
  if (qg)  qg.style.display = saleMode === 'quick' ? '' : 'none';
  if (sw)  sw.style.display = saleMode === 'search' ? '' : 'none';
  if (btn) btn.textContent  = saleMode === 'quick' ? '🔍 Search' : '⊞ Grid';
  if (saleMode === 'search') setTimeout(() => el('spsq')?.focus(), 150);
  else renderQuickProdGrid();
}

// ── FINANCIAL REPORTS ──
function fillFinMonths(){const sel=el('fin-month');if(!sel)return;sel.innerHTML=months().map(m=>'<option value="'+m+'">'+m+'</option>').join('');sel.value=thisMonth();}

// openNewSale: full logic in rebuilt function above
// completeSale: full logic (incl. auto-customer) in rebuilt function above
// ── PATCH: migrateDB - ensure customers array exists ──
const _baseMigrateDB=migrateDB;
// migrateDB: defined above


function reqDelProdById(id, name) {
  if(!isAdmin()){toast('Admin only','er');return;}
  var b=biz();if(!b)return;
  var p=(b.products||[]).find(function(x){return x.id===id;});
  if(!p)return;
  if(isProdLocked(p)){toast('Product is locked — cannot delete yet','er');return;}
  // Confirm then delete
  showConf(
    '🗑️',
    'Delete Product?',
    '"'+name+'" will be permanently deleted.',
    'Yes, Delete',
    function(){
      b.products=b.products.filter(function(x){return x.id!==id;});
      dbSave();
      renderProducts();
      toast('Product deleted','gd');
    },
    'danger'
  );
}

// renderProducts: unified below

// ── UPGRADED viewReceipt with business logo ──
function viewReceipt(saleId){
  var b=biz();
  var s=(b.sales||[]).find(function(x){return x.id===saleId;});
  if(!s)return;
  var paid=s.paid||0;
  var tot=s.total||sTotal(s);
  var due=Math.max(0,tot-paid);
  var st=sSt(s);
  var hasLogo=b.logoType==='image'&&b.logoData;

  // Build receipt HTML
  var items='';
  (s.items||[]).forEach(function(i){
    items+=
      '<tr>'+
        '<td style="padding:5px 0;font-size:13px;color:#222;vertical-align:top">'+esc(i.name)+'</td>'+
        '<td style="padding:5px 0;font-size:12px;color:#555;text-align:center;white-space:nowrap">'+i.qty+' &times; '+f$(i.unitPrice)+'</td>'+
        '<td style="padding:5px 0;font-size:13px;font-weight:700;color:#111;text-align:right;white-space:nowrap">'+f$(i.qty*i.unitPrice)+'</td>'+
      '</tr>';
  });

  var stColor = st==='PAID'?'#16a34a':st==='PARTIAL'?'#d97706':'#dc2626';
  var stLabel = st==='PAID'?'&#10003; PAID':st==='PARTIAL'?'&#9681; PARTIAL':'&#9675; CREDIT';

  var rcptHtml =
    '<div style="font-family:Georgia,serif;max-width:340px;margin:0 auto;padding:20px 24px;background:#fff;color:#111">'+

      // Header
      '<div style="text-align:center;margin-bottom:16px">'+
        (hasLogo
          ? '<div style="width:64px;height:64px;border-radius:12px;overflow:hidden;margin:0 auto 10px;border:1.5px solid #e5e7eb"><img src="'+b.logoData+'" style="width:100%;height:100%;object-fit:cover"></div>'
          : '<div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#D4A520,#A07810);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:24px;font-weight:900;color:#fff;font-family:Georgia,serif">'+mkInit(b.name)+'</div>')+
        '<div style="font-size:20px;font-weight:900;color:#111;letter-spacing:.02em">'+esc(b.name)+'</div>'+
        (b.address?'<div style="font-size:11px;color:#6b7280;margin-top:3px">'+esc(b.address)+'</div>':'')+
        (b.phone?'<div style="font-size:11px;color:#6b7280">'+esc(b.phone)+'</div>':'')+
      '</div>'+

      // Divider
      '<div style="border-top:2px dashed #d1d5db;margin:12px 0"></div>'+

      // Invoice meta
      '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px">'+
        '<tr><td style="color:#6b7280;padding:3px 0">Invoice</td><td style="text-align:right;font-weight:700;font-family:monospace;color:#111">'+esc(s.inv||'—')+'</td></tr>'+
        '<tr><td style="color:#6b7280;padding:3px 0">Date</td><td style="text-align:right;color:#111">'+s.date+'</td></tr>'+
        '<tr><td style="color:#6b7280;padding:3px 0">Customer</td><td style="text-align:right;font-weight:700;color:#111">'+esc(s.customer||'Walk-in')+'</td></tr>'+
        (s.contact?'<tr><td style="color:#6b7280;padding:3px 0">Phone</td><td style="text-align:right;color:#111">'+esc(s.contact)+'</td></tr>':'')+
        '<tr><td style="color:#6b7280;padding:3px 0">Payment</td><td style="text-align:right;color:#111">'+esc(s.paymode||'')+'</td></tr>'+
      '</table>'+

      // Divider
      '<div style="border-top:1px dashed #d1d5db;margin:12px 0"></div>'+

      // Items header
      '<table style="width:100%;border-collapse:collapse">'+
        '<thead>'+
          '<tr style="border-bottom:1px solid #e5e7eb">'+
            '<th style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;padding:4px 0;text-align:left">Item</th>'+
            '<th style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;padding:4px 0;text-align:center">Qty/Price</th>'+
            '<th style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;padding:4px 0;text-align:right">Total</th>'+
          '</tr>'+
        '</thead>'+
        '<tbody>'+items+'</tbody>'+
      '</table>'+

      // Divider
      '<div style="border-top:1px dashed #d1d5db;margin:10px 0"></div>'+

      // Totals
      '<table style="width:100%;border-collapse:collapse;font-size:13px">'+
        '<tr><td style="padding:3px 0;color:#6b7280">Subtotal</td><td style="text-align:right">'+f$(s.subtotal||tot)+'</td></tr>'+
        ((s.discount||0)>0?'<tr><td style="padding:3px 0;color:#6b7280">Discount</td><td style="text-align:right;color:#dc2626">-'+f$(s.discount)+'</td></tr>':'')+
        '<tr style="border-top:2px solid #111"><td style="padding:6px 0;font-size:16px;font-weight:900">TOTAL</td><td style="text-align:right;font-size:16px;font-weight:900">'+f$(tot)+'</td></tr>'+
        '<tr><td style="padding:3px 0;color:#6b7280">Paid ('+esc(s.paymode||'')+')</td><td style="text-align:right;color:#16a34a;font-weight:700">'+f$(paid)+'</td></tr>'+
        (due>0?'<tr><td style="padding:3px 0;font-weight:700;color:#dc2626">Balance Due</td><td style="text-align:right;font-weight:900;color:#dc2626">'+f$(due)+'</td></tr>':'')+
      '</table>'+

      // Status badge
      '<div style="text-align:center;margin:14px 0">'+
        '<span style="display:inline-block;padding:5px 20px;border-radius:99px;font-size:13px;font-weight:800;background:'+stColor+';color:#fff;letter-spacing:.05em">'+stLabel+'</span>'+
      '</div>'+

      // Divider
      '<div style="border-top:2px dashed #d1d5db;margin:12px 0"></div>'+

      // Footer
      '<div style="text-align:center;font-size:11px;color:#9ca3af;line-height:1.8">'+
        '<div style="font-size:13px;font-weight:700;color:#D4A520;margin-bottom:4px">Thank you for your business!</div>'+
        esc(b.name)+' &bull; Powered by SmartStock Pro'+
        (b.address?'<br>'+esc(b.address):'')+
      '</div>'+

    '</div>';

  // Set drawer content
  if(el('rcptttl')) el('rcptttl').textContent='Receipt \u00b7 '+s.inv;
  // Append fulfillment status
  var fulAppend='';
  if((s.fulfillments||[]).length>0){
    var allOrd=(s.items||[]).reduce(function(a,i){return a+i.qty;},0);
    var allSup=(s.fulfillments||[]).reduce(function(acc,f){return acc+(f.items||[]).reduce(function(a2,i){return a2+i.qtySupplied;},0);},0);
    var fpct=allOrd>0?Math.round(allSup/allOrd*100):0;
    var fc2=s.fulStatus==='Completed'||s.fulStatus==='Fulfilled'?'#16a34a':s.fulStatus==='Partially Fulfilled'?'#d97706':'#6b7280';
    fulAppend='<div style="padding:10px 0;border-top:1px dashed #ddd;margin-top:10px;font-size:11px">'+
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong>Delivery Status</strong>'+
      '<span style="font-weight:700;color:'+fc2+'">'+(s.fulStatus||'Pending')+'</span></div>'+
      '<div style="height:5px;background:#eee;border-radius:3px;overflow:hidden;margin-bottom:4px">'+
      '<div style="height:100%;background:'+fc2+';width:'+fpct+'%;border-radius:3px"></div></div>'+
      (s.assignedStaff?'<div>Handled by: <strong>'+esc(s.assignedStaff)+'</strong></div>':'')+
    '</div>';
  }
  if(el('rcptbody')) el('rcptbody').innerHTML=rcptHtml+fulAppend;

  // Store receipt HTML for print/share
  window._lastReceiptHtml   = rcptHtml;
  window._lastReceiptInv    = s.inv;
  window._lastReceiptSale   = s;
  window._lastReceiptBiz    = b;

  openD('d-rcpt');
}

function printReceipt(){
  var html = window._lastReceiptHtml;
  if(!html) return;
  var win = window.open('','_blank','width=400,height=700,toolbar=no,menubar=no,scrollbars=yes');
  if(!win){ alert('Please allow popups to print receipts'); return; }
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<title>Receipt</title>'+
    '<style>'+
      'body{margin:0;padding:16px;background:#fff}'+
      '@media print{body{padding:0}@page{margin:8mm;size:80mm auto}}'+
    '</style>'+
    '</head><body>'+html+'</bo'+'dy></ht'+'ml>'
  );
  win.document.close();
  setTimeout(function(){ win.focus(); win.print(); }, 500);
}

function shareReceiptWhatsApp(directToCustomer) {
  var s = window._lastReceiptSale;
  var b = window._lastReceiptBiz;
  if (!s || !b) return;

  var tot   = s.total || sTotal(s);
  var paid  = s.paid  || 0;
  var due   = Math.max(0, tot - paid);
  var st    = sSt(s);
  var stEmoji = st === 'PAID' ? '✅' : st === 'PARTIAL' ? '🔶' : '🔴';
  var now   = new Date().toLocaleDateString('en-US',{day:'2-digit',month:'short',year:'numeric'});

  // Format items list
  var items = (s.items || []).map(function(i) {
    return '  • ' + i.name + '\n' +
           '    ' + i.qty + ' × ' + f$(i.unitPrice) + ' = *' + f$(i.qty * i.unitPrice) + '*';
  }).join('\n');

  // Build professional WhatsApp message
  var msg =
    '🏪 *' + b.name.toUpperCase() + '*\n' +
    (b.address ? '📍 ' + b.address + '\n' : '') +
    (b.phone   ? '📞 ' + b.phone   + '\n' : '') +
    '━━━━━━━━━━━━━━━━\n' +
    '🧾 *INVOICE ' + s.inv + '*\n' +
    '📅 Date: ' + s.date + '\n' +
    '👤 Customer: *' + (s.customer || 'Walk-in') + '*\n' +
    (s.contact ? '📱 Phone: ' + s.contact + '\n' : '') +
    '💳 Payment: ' + (s.paymode || 'Cash') + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '*ITEMS:*\n' + items + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    (s.discount > 0 ? '🏷 Discount:  -' + f$(s.discount) + '\n' : '') +
    '💰 *TOTAL:    ' + f$(tot) + '*\n' +
    '✅  Paid:     ' + f$(paid) + '\n' +
    (due > 0 ? '🔴 *Balance:  ' + f$(due) + '*\n' : '') +
    stEmoji + ' Status: *' + st + '*\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '_Thank you for choosing ' + b.name + '!_\n' +
    '_Powered by SmartStock Pro_';

  // If customer has a phone number, send directly to them
  var customerPhone = '';
  if (directToCustomer && s.contact) {
    // Clean phone number — remove spaces, dashes, parentheses
    customerPhone = s.contact.replace(/[\s\-\(\)]/g, '');
    // Add country code if missing (default Liberia +231)
    if (customerPhone && !customerPhone.startsWith('+') && !customerPhone.startsWith('00')) {
      if (customerPhone.startsWith('0')) {
        customerPhone = '+231' + customerPhone.slice(1);
      } else {
        customerPhone = '+231' + customerPhone;
      }
    }
  }

  var waBase = customerPhone
    ? 'https://wa.me/' + customerPhone + '?text='
    : 'https://wa.me/?text=';

  window.open(waBase + encodeURIComponent(msg), '_blank');
}

function toggleTheme(){curTheme=curTheme==='dark'?'light':'dark';applyTheme(curTheme);toast(curTheme==='light'?'☀ Light mode':'🌙 Dark mode','gd');}

// ════ END v5 FEATURES ════

function buildSaleCard(s) {
  const tot = sTotal(s);
  const due = sDue(s);
  const st  = sSt(s);
  const locked = isRecordLocked(s);
  const hasPending = hasPendingCR('sale', s.id);
  const adminUser  = isAdmin();

  // Status badge
  const stBadge = st === 'PAID'
    ? '<span class="sb-paid">✓ PAID</span>'
    : st === 'PARTIAL'
    ? '<span class="sb-partial">◑ PARTIAL</span>'
    : '<span class="sb-credit">○ CREDIT</span>';

  // Lock indicator
  const lockInfo = locked && !adminUser
    ? '<span class="bdg bwa0" style="font-size:9px">⏳ >3h</span>'
    : '';

  // Action buttons
  let actions = '';
  if (adminUser) {
    actions = `
      <button type="button" class="act-btn" onclick="openEditSale(${s.id})" title="Edit">✏ Edit</button>
      <button type="button" class="act-btn danger" onclick="deleteSale(${s.id})" title="Delete">🗑 Del</button>`;
  } else if (locked) {
    if (hasPending) {
      actions = `<span class="act-btn pending" style="pointer-events:none">⏳ Pending</span>`;
    } else {
      actions = `
        <button type="button" class="act-btn pending" onclick="openRecordChangeRequest('sale',${s.id},'${esc(s.inv || 'Sale #' + s.id).replace(/'/g, '')}')">⏳ Request</button>`;
    }
  } else {
    actions = `
      <button type="button" class="act-btn" onclick="openEditSale(${s.id})" title="Edit">✏ Edit</button>
      <button type="button" class="act-btn danger" onclick="deleteSale(${s.id})" title="Delete">🗑 Del</button>`;
  }

  // Edit log badge
  const editBadge = (s.editLog || []).length
    ? `<span class="bdg bin0" style="font-size:9px">✏×${s.editLog.length}</span>`
    : '';

  // Line items
  const lines = (s.items || []).map(i =>
    `<div class="sale-line">
      <span class="sale-line-name">${esc(i.name)} <span style="color:var(--t3)">×${i.qty}</span></span>
      <span style="color:var(--t3);font-size:11px;margin-right:6px">${f$(i.unitPrice)} each</span>
      <span class="sale-line-price">${f$(i.qty * i.unitPrice)}</span>
    </div>`
  ).join('');

  return `
    <div class="sale-item">
      <div class="sale-item-head">
        <div class="sale-item-icon">🧾</div>
        <div class="sale-item-info">
          <div class="sale-item-cust">
            ${esc(s.customer || 'Walk-in')}
            ${stBadge} ${editBadge} ${lockInfo}
          </div>
          <div class="sale-item-meta">
            <span class="mono" style="font-size:10px;color:var(--g)">${esc(s.inv || '')}</span>
            <span>·</span>
            <span>${s.date}</span>
            ${s.contact ? `<span>· 📞 ${esc(s.contact)}</span>` : ''}
            ${s.paymode ? `<span>· ${esc(s.paymode)}</span>` : ''}
          </div>
        </div>
        <div class="sale-item-right">
          <div class="sale-item-total">${f$(tot)}</div>
          <div class="sale-item-actions">
            <button type="button" class="act-btn neutral" onclick="viewReceipt(${s.id})">🧾</button>
            <button type="button" class="act-btn" style="background:rgba(8,145,178,.15);color:#0891b2;border:1px solid rgba(8,145,178,.3)" onclick="openFulfillment(${s.id})" title="Fulfill Order">📦</button>
            ${actions}
          </div>
        </div>
      </div>
      <div class="sale-lines">${lines}</div>
      <div class="sale-footer">
        <span style="color:var(--t2)">Paid: <strong style="color:var(--ok)">${f$(s.paid || 0)}</strong></span>
        ${(function(){ var fs2=s.fulStatus||'Pending'; var fc={'Pending':'var(--t3)','Assigned':'#3b82f6','In Progress':'var(--wa)','Partially Fulfilled':'var(--wa)','Fulfilled':'var(--ok)','Completed':'var(--ok)'}[fs2]||'var(--t3)'; return '<span style="color:var(--t2)">Delivery: <strong style="color:'+fc+'">'+fs2+'</strong></span>'; })()}
        ${(function(){ var p = calcProfitForSale(s); return p.profit !== 0 ? '<span style="color:var(--t2)">Profit: <strong style="color:' + (p.profit >= 0 ? 'var(--ok)' : 'var(--er)') + '">' + f$(p.profit) + ' (' + p.margin.toFixed(1) + '%)</strong></span>' : ''; })()}
        <span style="color:${due > 0 ? 'var(--er)' : 'var(--ok)'}">
          ${due > 0 ? 'Due: <strong>' + f$(due) + '</strong>' : '✓ Settled'}
        </span>
      </div>
    </div>`;
}

// ── DELETE SALE ──

function selectPayMode(btnEl) {
  currentPayMode = btnEl.dataset.pay;
  sv('spay', currentPayMode);
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('on'));
  btnEl.classList.add('on');

  // Hide paid amount field for full Credit
  const wrap = el('paid-amount-wrap');
  if (wrap) wrap.style.display = currentPayMode === 'Credit' ? 'none' : '';

  if (currentPayMode === 'Credit') sv('spaid', '0');
  updateCart();
}

// ── QUICK FULL PAY ──

function setFullPay() {
  const tot = cartItems.reduce((a, b) => a + b.qty * b.unitPrice, 0);
  const disc = parseFloat(el('sdisc')?.value) || 0;
  sv('spaid', Math.max(0, tot - disc).toFixed(2));
  updateCart();
}

// ══════════════════════════════════════════════════════════
//  PRODUCT GRID + SEARCH
// ══════════════════════════════════════════════════════════

// ── KEYBOARD + INIT ──
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.dov.on').forEach(d=>d.classList.remove('on'));closeModal();}});

// ════════════════════════════════════════════════════
//  PWA — INSTALL + SERVICE WORKER
// ════════════════════════════════════════════════════
(function() {
  'use strict';

  // ── 1. Service Worker (skipped on file:// — works when hosted) ──
  // SW registration is only needed for Play Store / hosted PWA
  // The app works fully offline via localStorage without SW

  // ── 2. Capture install prompt ──
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
    console.log('[PWA] Install prompt captured');
  });

  window.addEventListener('appinstalled', function() {
    hideInstallBanner();
    deferredPrompt = null;
    console.log('[PWA] App installed!');
    if (typeof toast === 'function') toast('SmartStock Pro installed as app!', 'gd');
  });

  // ── 3. Install banner ──
  function showInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'flex';
    var tbBtn = document.getElementById('pwa-topbar-btn');
    if (tbBtn) tbBtn.style.display = 'flex';
  }

  function hideInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
  }

  // ── 4. Global install trigger (called by button) ──
  window.triggerPWAInstall = function() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(result) {
        if (result.outcome === 'accepted') {
          console.log('[PWA] User accepted install');
          hideInstallBanner();
        } else {
          console.log('[PWA] User dismissed install');
        }
        deferredPrompt = null;
      });
    } else {
      // Manual instructions for browsers that don't fire beforeinstallprompt
      showManualInstallGuide();
    }
  };

  // ── 5. Manual install guide (fallback) ──
  window.showManualInstallGuide = function() {
    var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    var msg = isIOS
      ? 'To install:\n1. Tap the Share button (box with arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add"'
      : 'To install:\n1. Tap the 3-dot menu (⋮) in Chrome\n2. Tap "Add to Home screen"\n3. Tap "Add"';
    if (typeof toast === 'function') {
      toast('Tap ⋮ menu → "Add to Home Screen"', 'gd');
    }
    alert(msg);
  };

  // ── 6. Check if already running as installed PWA ──
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (isStandalone) {
    console.log('[PWA] Running in standalone mode');
    // Hide install banner if already installed
    document.addEventListener('DOMContentLoaded', hideInstallBanner);
  }

})();




function updateCustPreview() {
  var name  = gv('cust-name');
  var phone = gv('cust-phone');
  var email = gv('cust-email');
  var addr  = gv('cust-addr');
  var notes = gv('cust-notes');

  var preview = document.getElementById('cust-preview');
  if(!preview) return;

  var hasContent = name || phone || email || addr || notes;
  preview.style.display = hasContent ? '' : 'none';
  if(!hasContent) return;

  // Avatar = first letter
  var av = document.getElementById('cust-prev-av');
  if(av) av.textContent = name ? name.charAt(0).toUpperCase() : '?';

  var nameEl = document.getElementById('cust-prev-name');
  if(nameEl) nameEl.textContent = name || 'New Customer';

  // Meta line: phone / email / notes
  var metaBits = [];
  if(phone) metaBits.push('📞 ' + phone);
  if(email) metaBits.push('✉ ' + email);
  if(notes) metaBits.push('🏷 ' + notes);
  var metaEl = document.getElementById('cust-prev-meta');
  if(metaEl) metaEl.textContent = metaBits.join(' · ');
}



// ── RESTORED HELPERS (saveProd, customer add, print) ──
function getProdImgData(){return(el('pimg-cam')?.dataset.img)||(el('pimg-gal')?.dataset.img)||'';}

function getProdCat(){
  const v=el('pcat')?.value;if(v==='__custom__')return(gv('pcat-custom')||'Other');
  return v||'Other';
}

function onPcatChange(){
  const v=el('pcat')?.value;const ci=el('pcat-custom');
  if(!ci)return;ci.style.display=v==='__custom__'?'':'none';if(v==='__custom__')ci.focus();
}

function emS(icon, title, sub, actionHtml){
  return '<div style="padding:40px 20px;text-align:center">'+
    '<div style="font-size:44px;margin-bottom:12px;opacity:.25">'+icon+'</div>'+
    '<div style="font-family:var(--fd);font-size:16px;font-weight:700;color:var(--t3);margin-bottom:6px">'+title+'</div>'+
    '<div style="font-size:12px;color:var(--t4);margin-bottom:14px">'+sub+'</div>'+
    (actionHtml||'')+
  '</div>';
}

function setEC(cat){
  expCat = cat;
  renderExpenses();
}


function approveStaffSignup(userId) {
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) { toast('User not found', 'er'); return; }
  if (u.status !== 'pending') { toast('User is already active', 'er'); return; }
  u.status      = 'active';
  u.approvedAt  = Date.now();
  u.approvedBy  = (typeof CU !== 'undefined' && CU) ? CU.name : 'Admin';
  // Remove the pending signup notification(s)
  DB.notifications = (DB.notifications || []).filter(function(n){
    return !(n.type === 'user_signup' && n.pendingUserId === userId);
  });
  // Add a business-level notification log entry
  if (typeof DB.nextNotifId !== 'number' || isNaN(DB.nextNotifId)) DB.nextNotifId = 1;
  DB.notifications.unshift({
    id:        DB.nextNotifId++,
    type:      'user',
    msg:       '✓ Approved staff signup: ' + u.name + ' (@' + u.username + ')',
    bizId:     u.businessIds && u.businessIds[0] ? u.businessIds[0] : (CBI || 1),
    read:      false,
    ts:        Date.now()
  });
  // Audit log
  if (typeof addAdminLog === 'function') {
    addAdminLog('approve_signup', 'Approved staff signup: ' + u.name + ' (' + u.username + ')', (typeof CU !== 'undefined' && CU ? CU.name : 'Admin'));
  }
  dbSave();
  // Try to create Firebase Auth account for approved staff (if not done at signup)
  // Note: we don't have the plain password here, so this is best-effort
  // The user will get Firebase Auth account on their next successful login
  if (typeof fbPushUsers === 'function') fbPushUsers();
  if (typeof renderTeam === 'function') renderTeam();
  if (typeof checkNotif === 'function') checkNotif();
  toast('Approved ' + u.name + '. They can now log in.', 'gd');
}

function rejectStaffSignup(userId) {
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) { toast('User not found', 'er'); return; }
  if (u.status !== 'pending') { toast('User is already active', 'er'); return; }
  // Per your design: account stays pending so staff can try again
  // Just mark as rejected (they can re-sign-up to update)
  u.rejectedAt = Date.now();
  u.rejectedBy = (typeof CU !== 'undefined' && CU) ? CU.name : 'Admin';
  // Remove the pending signup notification
  DB.notifications = (DB.notifications || []).filter(function(n){
    return !(n.type === 'user_signup' && n.pendingUserId === userId);
  });
  if (typeof addAdminLog === 'function') {
    addAdminLog('reject_signup', 'Rejected staff signup: ' + u.name + ' (' + u.username + ')', (typeof CU !== 'undefined' && CU ? CU.name : 'Admin'));
  }
  dbSave();
  if (typeof renderTeam === 'function') renderTeam();
  if (typeof checkNotif === 'function') checkNotif();
  toast('Rejected ' + u.name + '. They can sign up again to retry.', 'gd');
}

function promoteToAdmin(userId) {
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) { toast('User not found', 'er'); return; }
  if (u.role === 'primaryAdmin') { toast('User is already Primary Admin', 'er'); return; }
  if (u.role === 'admin') { toast('User is already Admin', 'er'); return; }
  u.role = 'admin';
  u.allowedModules = (typeof MODS !== 'undefined' ? MODS : ['products','sales','stock','expenses','customers','salary','reports']);
  if (typeof addAdminLog === 'function') {
    addAdminLog('promote_user', 'Promoted ' + u.name + ' to Admin', (typeof CU !== 'undefined' && CU ? CU.name : 'Admin'));
  }
  dbSave();
  if (typeof renderTeam === 'function') renderTeam();
  toast(u.name + ' is now an Admin', 'gd');
}

function demoteFromAdmin(userId) {
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) { toast('User not found', 'er'); return; }
  if (u.role === 'primaryAdmin') { toast('Cannot demote Primary Admin', 'er'); return; }
  if (u.role !== 'admin') { toast('User is not an Admin', 'er'); return; }
  u.role = 'dataOperator';
  u.allowedModules = ['products','sales','stock','expenses','customers'];
  if (typeof addAdminLog === 'function') {
    addAdminLog('demote_user', 'Demoted ' + u.name + ' to Data Operator', (typeof CU !== 'undefined' && CU ? CU.name : 'Admin'));
  }
  dbSave();
  if (typeof renderTeam === 'function') renderTeam();
  toast(u.name + ' is now Data Operator', 'gd');
}

// Helper: get pending signups for current business (used by Team page)
function getPendingSignups() {
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b) return [];
  return (DB.users || []).filter(function(u){
    return u.status === 'pending'
      && u.businessIds
      && u.businessIds.indexOf(b.id) >= 0;
  });
}

// Helper: pending count for current admin (used by topbar badge)
function getPendingSignupCount() {
  if (typeof CU === 'undefined' || !CU) return 0;
  if (CU.role !== 'primaryAdmin' && CU.role !== 'admin') return 0;
  return getPendingSignups().length;
}



// ─────────────────────────────────────────────────────
// FORGOT PASSWORD / RECOVERY CODE FLOW
// ─────────────────────────────────────────────────────
function generateRecoveryCode() {
  // Format: SS-XXXX-YYYY (8 random alphanumeric)
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/I/1
  var part1 = '', part2 = '';
  for (var i = 0; i < 4; i++) part1 += chars.charAt(Math.floor(Math.random()*chars.length));
  for (var j = 0; j < 4; j++) part2 += chars.charAt(Math.floor(Math.random()*chars.length));
  return 'SS-' + part1 + '-' + part2;
}

function openForgotPw() {
  // Close login any error message
  var errEl = document.getElementById('login-err');
  if (errEl) errEl.style.display = 'none';
  openD('d-forgot-pw');
  switchFpTab('code');
}

function switchFpTab(tab) {
  var tabs = {
    code:  { btn: document.getElementById('fp-tab-code'),  panel: document.getElementById('fp-panel-code')  },
    admin: { btn: document.getElementById('fp-tab-admin'), panel: document.getElementById('fp-panel-admin') },
    email: { btn: document.getElementById('fp-tab-email'), panel: document.getElementById('fp-panel-email') }
  };
  var active = 'linear-gradient(135deg,#D4A520,#A07810)';
  Object.keys(tabs).forEach(function(key) {
    var t = tabs[key];
    if (!t) return;
    var isActive = (key === tab);
    if (t.btn) {
      t.btn.style.background = isActive ? active : 'transparent';
      t.btn.style.color      = isActive ? '#060810' : 'var(--t3)';
    }
    if (t.panel) t.panel.style.display = isActive ? '' : 'none';
  });

  // Pre-fill email field when switching to email tab
  if (tab === 'email') {
    var loginVal = el('lu') ? el('lu').value.trim() : '';
    var emailInput = el('forgot-email');
    if (emailInput && loginVal.includes('@') && !emailInput.value) {
      emailInput.value = loginVal;
    }
  }
}

async function resetPasswordWithCode() {
  var un  = gv('fp-username');
  var code= gv('fp-code').toUpperCase().trim();
  var npw = document.getElementById('fp-newpw') ? document.getElementById('fp-newpw').value : '';
  var errEl = document.getElementById('fp-err');

  function showErr(msg){ if(errEl){ errEl.textContent = msg; errEl.style.display=''; } }

  if (!un)  return showErr('Enter your username');
  if (!code) return showErr('Enter your recovery code');
  if (!npw || npw.length < 6) return showErr('New password must be at least 6 characters');

  var user = (DB.users || []).find(function(u){
    return (u.username || '').toLowerCase() === un.toLowerCase();
  });
  if (!user) return showErr('No account found with that username');
  if (user.role !== 'primaryAdmin') {
    return showErr('Recovery codes are only for business owners. Use "Ask Admin" tab instead.');
  }
  if (!user.recoveryCode) {
    return showErr('No recovery code set for this account. Contact support.');
  }
  if (user.recoveryCode !== code) {
    return showErr('Recovery code does not match. Check capitals and dashes (e.g. SS-A1B2-C3D4)');
  }

  // Reset password — hash it first, then save
  var hashedNewPw = npw;
  try { hashedNewPw = await hashPassword(npw); } catch(e) { hashedNewPw = npw; }
  user.password = hashedNewPw;
  user.recoveryCode = generateRecoveryCode();
  user.passwordResetAt = Date.now();
  dbSave();
  if (typeof fbPushUsers === 'function') try { fbPushUsers(); } catch(e){}
  if (typeof fbPush === 'function') setTimeout(function(){ try { fbPush(); } catch(e){} }, 500);

  // Clear login lockout so user can log in immediately
  try { localStorage.removeItem('ss_login_attempts'); } catch(e){}
  closeD('d-forgot-pw');
  toast('✅ Password reset! Your new recovery code is: ' + user.recoveryCode + '. WRITE IT DOWN.', 'gd');

  // Show new recovery code
  setTimeout(function(){
    var rc = document.getElementById('recovery-code-display');
    if (rc) rc.textContent = user.recoveryCode;
    openD('d-recovery-code');
  }, 200);

  // Pre-fill the login form
  var luEl = document.getElementById('lu');
  if (luEl) luEl.value = user.username;
}

function requestAdminReset() {
  var un  = gv('fp-staff-username');
  var biz = gv('fp-staff-biz');
  var errEl = document.getElementById('fp-staff-err');

  function showErr(msg){ if(errEl){ errEl.textContent = msg; errEl.style.display=''; } }

  if (!un)  return showErr('Enter your username');
  if (!biz) return showErr('Enter your business name');

  // Find matching business
  var bizNameLower = biz.toLowerCase().trim();
  var matchedBiz = (DB.businesses || []).find(function(b){
    return (b.name || '').toLowerCase().trim() === bizNameLower;
  });
  if (!matchedBiz) return showErr('Business "' + biz + '" not found. Ask your admin for the exact name.');

  // Find the user
  var user = (DB.users || []).find(function(u){
    return (u.username || '').toLowerCase() === un.toLowerCase()
      && u.businessIds && u.businessIds.indexOf(matchedBiz.id) >= 0;
  });
  if (!user) return showErr('No staff account found with that username in that business');

  // Create notification for admins
  if (typeof DB.nextNotifId !== 'number' || isNaN(DB.nextNotifId)) DB.nextNotifId = 1;
  DB.notifications = DB.notifications || [];
  DB.notifications.unshift({
    id:        DB.nextNotifId++,
    type:      'user',
    msg:       '🔑 ' + user.name + ' (@' + user.username + ') requested a password reset. Go to Team Management to reset it.',
    bizId:     matchedBiz.id,
    pendingResetUserId: user.id,
    read:      false,
    ts:        Date.now()
  });
  dbSave();
  if (typeof fbPush === 'function') try { fbPush(); } catch(e){}

  closeD('d-forgot-pw');
  toast('Reset request sent! Wait for your admin to contact you with the new password.', 'gd');
}

function copyRecoveryCode() {
  var rc = document.getElementById('recovery-code-display');
  if (!rc) return;
  var code = rc.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(function(){
      toast('Recovery code copied to clipboard', 'gd');
    }).catch(function(){
      toast('Tap and hold the code to copy it', 'er');
    });
  } else {
    toast('Code: ' + code + ' (tap and hold to copy)', 'gd');
  }
}

function confirmSavedCode() {
  closeD('d-recovery-code');
  // If there is a pending login from owner-signup, do it now
  if (window._pendingLoginUser) {
    var u = window._pendingLoginUser;
    var bn = window._pendingBizName || 'your business';
    window._pendingLoginUser = null;
    window._pendingBizName = null;
    if (typeof loginAs === 'function') loginAs(u);
    if (typeof toast === 'function') toast('Welcome ' + u.name + '! "' + bn + '" is ready.', 'gd');
  }
}

// Admin function: reset a staff member's password directly
function adminResetUserPassword(userId, newPwOverride) {
  // Legacy entrypoint — kept for backwards compatibility
  // New flow uses openAdminPwReset (drawer) which calls this with override
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) { toast('User not found', 'er'); return; }
  var newPw = newPwOverride;
  if (!newPw) {
    // Fall back to prompt only if not called from drawer
    newPw = prompt('Set new password for ' + u.name + ' (min 6 chars):');
  }
  if (!newPw) return;
  if (newPw.length < 6) { toast('New password must be at least 6 characters', 'er'); return; }
  // Hash the new password before storing
  hashPassword(newPw).then(function(hashed){
    u.password = hashed;
    u.passwordResetAt = Date.now();
    u.passwordResetBy = (typeof CU !== 'undefined' && CU) ? CU.name : 'Admin';
    dbSave();
    try{if(typeof fbPush==='function')fbPush();}catch(e){}
  }).catch(function(){
    u.password = newPw;
  });
  // (continuing synchronously — hashing happens in background)
  u.passwordResetAt = Date.now();
  u.passwordResetBy = (typeof CU !== 'undefined' && CU) ? CU.name : 'Admin';

  // Remove any pending reset notifications for this user
  DB.notifications = (DB.notifications || []).filter(function(n){
    return n.pendingResetUserId !== userId;
  });

  if (typeof addAdminLog === 'function') {
    addAdminLog('reset_password', 'Reset password for ' + u.name, (typeof CU !== 'undefined' && CU ? CU.name : 'Admin'));
  }
  dbSave();
  if (typeof fbPush === 'function') try { fbPush(); } catch(e){}
  if (typeof checkNotif === 'function') checkNotif();
  toast('Password reset for ' + u.name + '. New password: ' + newPw, 'gd');
}



// ─────────────────────────────────────────────────────
// SIDEBAR MENU FUNCTIONS
// ─────────────────────────────────────────────────────
function openSidebarMenu(){
  try {
    refreshSidebar();
    var ov = document.getElementById('sidebar-overlay');
    var sb = document.getElementById('sidebar-menu');
    var btn = document.querySelector('.tb-menu-btn');
    if(ov) ov.classList.add('on');
    if(sb) sb.classList.add('on');
    if(btn) btn.classList.add('open');
    // Prevent body scroll while sidebar is open
    document.body.style.overflow = 'hidden';
  } catch(e){
    console.error('[openSidebarMenu]', e);
  }
}

function closeSidebarMenu(){
  var ov = document.getElementById('sidebar-overlay');
  var sb = document.getElementById('sidebar-menu');
  var btn = document.querySelector('.tb-menu-btn');
  if(ov) ov.classList.remove('on');
  if(sb) sb.classList.remove('on');
  if(btn) btn.classList.remove('open');
  document.body.style.overflow = '';
}

function refreshSidebar(){
  try {
    // Update user info
    if(typeof CU !== 'undefined' && CU){
      var avEl = document.getElementById('sb-uav');
      var unEl = document.getElementById('sb-uname');
      var urEl = document.getElementById('sb-urole');
      if(avEl){
        if(CU.profilePhoto){
          avEl.style.backgroundImage = 'url("' + CU.profilePhoto + '")';
          avEl.style.backgroundSize = 'cover';
          avEl.style.backgroundPosition = 'center';
          avEl.textContent = '';
        } else {
          avEl.style.backgroundImage = '';
          avEl.textContent = mkInit(CU.name);
        }
      }
      if(unEl) unEl.textContent = CU.name || 'User';
      if(urEl) urEl.textContent = (typeof RLBL !== 'undefined' && RLBL[CU.role]) ? RLBL[CU.role] : 'User';
    }
    // Update business info
    var b = (typeof biz === 'function') ? biz() : null;
    if(b){
      var bnEl = document.getElementById('sb-bizname');
      var blEl = document.getElementById('sb-tbl');
      if(bnEl) bnEl.textContent = b.name || 'My Business';
      if(blEl){
        if(b.logoType === 'image' && b.logoData){
          blEl.innerHTML = '<img src="' + b.logoData + '" alt="">';
        } else {
          blEl.textContent = mkInit(b.name);
        }
      }
    }
    // Show/hide admin section
    var adminLbl  = document.getElementById('sb-admin-lbl');
    var adminTool = document.getElementById('sb-admin-tools');
    if(typeof isAdmin === 'function' && isAdmin()){
      if(adminLbl)  adminLbl.style.display = '';
      if(adminTool) adminTool.style.display = '';
    } else {
      if(adminLbl)  adminLbl.style.display = 'none';
      if(adminTool) adminTool.style.display = 'none';
    }
    // Sync dot mirror
    var sdMain = document.getElementById('sync-dot');
    var sdSb   = document.getElementById('sync-dot-sb');
    if(sdMain && sdSb) sdSb.style.background = sdMain.style.background || '#6B7280';

    // ── DATA BACKUP: only primary admin can see this menu item ──
    var backupItem = document.getElementById('sb-backup-item');
    if(backupItem){
      var canSeeBackup = (typeof isPrimary === 'function' && isPrimary());
      backupItem.style.display = canSeeBackup ? '' : 'none';
    }
    // ── SALARY MANAGEMENT: admins always see, others need see_salary_management permission ──
    var salaryItem = document.getElementById('sb-salary-item');
    if(salaryItem){
      var canSeeSalary;
      if (typeof isAdmin === 'function' && isAdmin()) {
        canSeeSalary = true;  // Admin & primary admin always see
      } else {
        canSeeSalary = (typeof hasPerm === 'function') ? hasPerm('see_salary_management') : false;
      }
      salaryItem.style.display = canSeeSalary ? '' : 'none';
    }
    // ── DOCUMENTATION EXPENSE: admins always see ──
    var docExpItem = document.getElementById('sb-docexp-item');
    if(docExpItem){
      var canSeeDoc = (typeof isAdmin === 'function' && isAdmin());
      docExpItem.style.display = canSeeDoc ? '' : 'none';
    }

    // Install button visibility
    var installItem = document.getElementById('sb-install-item');
    var installTopBtn = document.getElementById('pwa-topbar-btn');
    if(installItem){
      installItem.style.display = (installTopBtn && installTopBtn.style.display !== 'none') ? '' : 'none';
    }

    // Admin pending badge — show count of pending signups + change requests
    var menuDot = document.getElementById('menu-dot');
    var adminReqBadge = document.getElementById('sb-admin-req-badge');
    var teamBadge = document.getElementById('sb-team-badge');
    var pendingCount = 0;
    try {
      if(typeof isAdmin === 'function' && isAdmin()){
        if(typeof getPendingSignups === 'function'){
          pendingCount += getPendingSignups().length;
        }
        var crCount = (DB.changeRequests || []).filter(function(r){
          return r.bizId === CBI && r.status === 'pending';
        }).length;
        pendingCount += crCount;

        if(teamBadge){
          var sCount = (typeof getPendingSignups === 'function') ? getPendingSignups().length : 0;
          if(sCount > 0){
            teamBadge.innerHTML = '<span style="background:var(--er);color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:99px;font-family:var(--fm)">' + sCount + '</span>';
          } else {
            teamBadge.innerHTML = '&#8250;';
          }
        }
        if(adminReqBadge){
          if(crCount > 0){
            adminReqBadge.innerHTML = '<span style="background:var(--er);color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:99px;font-family:var(--fm)">' + crCount + '</span>';
          } else {
            adminReqBadge.innerHTML = '&#8250;';
          }
        }
      }
    } catch(e){}

    if(menuDot){
      menuDot.style.display = pendingCount > 0 ? '' : 'none';
    }
  } catch(e){
    console.error('[refreshSidebar]', e);
  }
}

// Close sidebar on escape key
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    var sb = document.getElementById('sidebar-menu');
    if(sb && sb.classList.contains('on')) closeSidebarMenu();
  }
});



// ═══════════════════════════════════════════════════════════
// SMART IMPORT SYSTEM
// Excel + CSV + PDF, with Claude AI or offline detection
// ═══════════════════════════════════════════════════════════

let impState = {
  type: 'products',       // 'products' or 'sales'
  mode: 'ai',             // 'ai' or 'offline'
  mergeMode: 'merge',     // 'merge' or 'append'
  rawRows: [],            // parsed rows from file
  previewRows: [],        // edited rows ready to import
  fileName: '',
  fileType: ''
};

function openSmartImport(type) {
  impState = {
    type: type,
    mode: getApiKey() ? 'ai' : 'offline',
    mergeMode: 'merge',
    rawRows: [],
    previewRows: [],
    fileName: '',
    fileType: ''
  };

  el('imp-title').textContent = type === 'products' ? '📥 Import Products' : '📥 Import Sales';
  el('imp-sub').textContent   = type === 'products'
    ? 'Excel, CSV, or PDF — AI detects columns automatically'
    : 'Bring in historical sales records';

  // Reset to upload step
  showImpStep('upload');
  updateApiStatus();
  setMergeMode('merge');

  // Clear file input
  var fi = el('imp-file');
  if (fi) fi.value = '';

  openD('d-import');
}

function showImpStep(step) {
  ['upload', 'process', 'preview', 'done'].forEach(function(s){
    var el2 = document.getElementById('imp-step-' + s);
    if (el2) el2.style.display = s === step ? '' : 'none';
  });
}

// ─── API KEY MANAGEMENT ───
function getApiKey() {
  try { return localStorage.getItem('ss_claude_api_key') || ''; } catch(e) { return ''; }
}
function saveApiKey() {
  var k = (el('imp-api-key').value || '').trim();
  if (!k) { toast('Enter a valid API key', 'er'); return; }
  if (!k.startsWith('sk-ant-')) {
    if (!confirm('This does not look like an Anthropic Claude key (should start with "sk-ant-"). Save anyway?')) return;
  }
  try { localStorage.setItem('ss_claude_api_key', k); } catch(e) {}
  impState.mode = 'ai';
  updateApiStatus();
  el('imp-api-input').style.display = 'none';
  toast('API key saved on this device', 'gd');
}
function clearApiKey() {
  try { localStorage.removeItem('ss_claude_api_key'); } catch(e) {}
  impState.mode = 'offline';
  updateApiStatus();
  toast('API key removed', 'gd');
}
function toggleApiInput() {
  var i = el('imp-api-input');
  i.style.display = i.style.display === 'none' ? '' : 'none';
}
function updateApiStatus() {
  var k = getApiKey();
  var s = el('imp-api-status');
  var clearBtn = el('imp-clear-api');
  if (k) {
    var masked = '••••••••' + k.slice(-4);
    s.innerHTML = '<span style="color:var(--ok)">✓ Claude AI ready</span> · <span style="font-family:var(--fm);color:var(--t3)">' + masked + '</span>';
    if (clearBtn) clearBtn.style.display = '';
    impState.mode = 'ai';
  } else {
    s.innerHTML = '<span style="color:var(--wa)">⚠ No API key</span> · <span style="color:var(--t3);font-size:11px">Offline smart-detect will be used</span>';
    if (clearBtn) clearBtn.style.display = 'none';
    impState.mode = 'offline';
  }
}
function setImportMode(m) {
  impState.mode = m;
  toast(m === 'offline' ? 'Will use offline smart-detect' : 'Will use Claude AI', 'gd');
}
function setMergeMode(m) {
  impState.mergeMode = m;
  var mEl = el('imp-mode-merge'), aEl = el('imp-mode-append');
  if (mEl) mEl.classList.toggle('on', m === 'merge');
  if (aEl) aEl.classList.toggle('on', m === 'append');
  var help = el('imp-mode-help');
  if (help) {
    help.innerHTML = m === 'merge'
      ? '<strong>Smart Merge:</strong> Updates existing items if SKU/name matches, adds new ones.'
      : '<strong>Add New Only:</strong> Skips items that already exist. No updates to existing.';
  }
}

// ─── FILE HANDLING ───
function handleImportDrop(ev) {
  if (!ev.dataTransfer || !ev.dataTransfer.files.length) return;
  processImportFile(ev.dataTransfer.files[0]);
}
function handleImportFile(ev) {
  if (!ev.target.files.length) return;
  processImportFile(ev.target.files[0]);
}

function processImportFile(file) {
  impState.fileName = file.name;
  var nameLower = file.name.toLowerCase();

  if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
    impState.fileType = 'excel';
    parseExcelFile(file);
  } else if (nameLower.endsWith('.csv')) {
    impState.fileType = 'csv';
    parseCsvFile(file);
  } else if (nameLower.endsWith('.pdf')) {
    impState.fileType = 'pdf';
    parsePdfFile(file);
  } else {
    toast('Unsupported file. Use .xlsx, .csv or .pdf', 'er');
  }
}

// ─── EXCEL PARSER ───
function parseExcelFile(file) {
  showImpStep('process');
  setProgress(10, 'Reading Excel file...');

  if (typeof XLSX === 'undefined') {
    toast('Excel library failed to load. Check your internet connection.', 'er');
    showImpStep('upload');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      setProgress(40, 'Parsing spreadsheet...');
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var firstSheet = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
      if (!rows.length) {
        toast('No data found in spreadsheet', 'er');
        showImpStep('upload');
        return;
      }
      setProgress(60, 'Detecting columns...');
      mapRowsToFields(rows);
    } catch(err) {
      console.error('[parseExcel]', err);
      toast('Could not read Excel file: ' + err.message, 'er');
      showImpStep('upload');
    }
  };
  reader.onerror = function() {
    toast('Failed to read file', 'er');
    showImpStep('upload');
  };
  reader.readAsArrayBuffer(file);
}

// ─── CSV PARSER ───
function parseCsvFile(file) {
  showImpStep('process');
  setProgress(20, 'Reading CSV...');

  if (typeof XLSX === 'undefined') {
    toast('CSV library failed to load.', 'er');
    showImpStep('upload');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      setProgress(50, 'Parsing rows...');
      var wb = XLSX.read(e.target.result, { type: 'string' });
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      if (!rows.length) {
        toast('No data in CSV', 'er');
        showImpStep('upload');
        return;
      }
      mapRowsToFields(rows);
    } catch(err) {
      console.error('[parseCsv]', err);
      toast('Could not read CSV: ' + err.message, 'er');
      showImpStep('upload');
    }
  };
  reader.readAsText(file);
}

// ─── PDF PARSER ───
function parsePdfFile(file) {
  showImpStep('process');
  setProgress(15, 'Reading PDF...');

  if (typeof pdfjsLib === 'undefined') {
    toast('PDF library failed to load. Check your internet connection.', 'er');
    showImpStep('upload');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    pdfjsLib.getDocument({ data: e.target.result }).promise.then(function(pdf) {
      setProgress(35, 'Extracting ' + pdf.numPages + ' page(s)...');
      var pagePromises = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        pagePromises.push(pdf.getPage(i).then(function(page) {
          return page.getTextContent().then(function(content) {
            return content.items.map(function(it) { return it.str; }).join(' ');
          });
        }));
      }
      return Promise.all(pagePromises);
    }).then(function(pageTexts) {
      var fullText = pageTexts.join('\n\n');
      setProgress(55, 'Understanding content...');
      // PDFs almost always need AI to parse the text into rows
      if (impState.mode === 'ai' && getApiKey()) {
        callClaudeForPDF(fullText);
      } else {
        // Fallback: try to split lines into rows
        var lines = fullText.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length>3;});
        var rows = lines.map(function(line){ return { raw: line }; });
        toast('PDF parsing without AI is limited. Add a Claude API key for better results.', 'er');
        mapRowsToFields(rows);
      }
    }).catch(function(err) {
      console.error('[parsePdf]', err);
      toast('Could not read PDF: ' + err.message, 'er');
      showImpStep('upload');
    });
  };
  reader.readAsArrayBuffer(file);
}

function setProgress(pct, msg) {
  var bar = el('imp-progress-bar');
  var title = el('imp-progress-title');
  if (bar) bar.style.width = pct + '%';
  if (title && msg) title.textContent = msg;
}

// ─── MAP ROWS TO FIELDS ───
// Smart column detection (offline mode)
function mapRowsToFields(rows) {
  if (impState.mode === 'ai' && getApiKey() && impState.fileType !== 'pdf') {
    setProgress(75, 'Using AI to understand data...');
    callClaudeForMapping(rows);
  } else if (impState.fileType !== 'pdf') {
    setProgress(80, 'Smart-detecting columns...');
    var mapped = offlineSmartMap(rows);
    finishMapping(mapped);
  } else {
    // PDF already handled above
    finishMapping(rows);
  }
}

// Offline smart column detection
function offlineSmartMap(rows) {
  if (!rows.length) return [];
  var firstKeys = Object.keys(rows[0]);

  // Build a column-name → field-name mapping
  var fieldMap = {};
  var fieldPatterns;

  if (impState.type === 'products') {
    fieldPatterns = {
      name:     /^(name|product|item|description|product\s*name|item\s*name|product_name)$/i,
      sku:      /^(sku|code|product\s*code|item\s*code|barcode|ref)$/i,
      category: /^(category|cat|type|group|class)$/i,
      cost:     /^(cost|buy(ing)?\s*price|wholesale|cost\s*price|purchase)$/i,
      price:    /^(price|sell(ing)?\s*price|retail|sale\s*price|unit\s*price|sell)$/i,
      qty:      /^(qty|quantity|stock|in\s*stock|on\s*hand|count|amount)$/i,
      unit:     /^(unit|uom|measure|per)$/i,
      desc:     /^(desc(ription)?|notes|details|info)$/i,
      size:     /^(size|dimension(s)?)$/i,
      lowLevel: /^(low|low.*level|reorder|min(imum)?)$/i
    };
  } else {
    fieldPatterns = {
      date:     /^(date|sale\s*date|invoice\s*date|day)$/i,
      customer: /^(customer|client|name|buyer|customer\s*name)$/i,
      contact:  /^(phone|contact|tel|mobile)$/i,
      inv:      /^(invoice|inv|inv\s*#|invoice\s*no)$/i,
      items:    /^(item(s)?|product(s)?|description)$/i,
      qty:      /^(qty|quantity|count)$/i,
      unitPrice:/^(unit\s*price|price|rate)$/i,
      total:    /^(total|amount|grand\s*total)$/i,
      paid:     /^(paid|payment|received)$/i,
      paymode:  /^(payment\s*mode|method|pay\s*method|paymode)$/i,
      status:   /^(status|state)$/i,
      discount: /^(discount|disc)$/i
    };
  }

  // Match each spreadsheet key to a field
  for (var fkey in fieldPatterns) {
    var pattern = fieldPatterns[fkey];
    for (var i = 0; i < firstKeys.length; i++) {
      if (pattern.test(firstKeys[i].trim())) {
        fieldMap[fkey] = firstKeys[i];
        break;
      }
    }
  }

  // Convert rows using the map
  return rows.map(function(row) {
    var mapped = { _raw: row };
    for (var fkey in fieldMap) {
      mapped[fkey] = row[fieldMap[fkey]];
    }
    return mapped;
  });
}

// ─── CLAUDE AI MAPPING ───
async function callClaudeForMapping(rows) {
  setProgress(80, 'AI reading your data...');
  var apiKey = getApiKey();
  if (!apiKey) {
    toast('No API key. Using offline detection.', 'er');
    finishMapping(offlineSmartMap(rows));
    return;
  }

  // Limit sent rows to keep tokens manageable
  var sample = rows.slice(0, 100);
  var fieldList = impState.type === 'products'
    ? 'name (required), sku, category, cost (number), price (number), qty (number), unit, desc, size, lowLevel (number)'
    : 'date (YYYY-MM-DD), customer, contact, inv, items (array of {name, qty, unitPrice}), discount (number), paid (number), paymode (Cash/Card/Mobile/Credit), status (active/cancelled)';

  var prompt = 'You are a data import assistant. The user uploaded a file with these rows:\n\n' +
    JSON.stringify(sample, null, 2) +
    '\n\nConvert each row into a clean JSON object with these fields: ' + fieldList +
    '\n\nRules:\n- Return ONLY a JSON array, no commentary\n- Skip header/empty rows\n- Convert prices/quantities to numbers (no $, commas, etc.)\n- If a field is missing, use empty string "" or 0 for numbers\n- Standardize categories to one of: Tiles, Cement, Tools, Paint, Plumbing, Electrical, Accessories, Other\n\nReturn the JSON array now:';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      var errBody = await response.text();
      throw new Error('API error ' + response.status + ': ' + errBody.slice(0, 200));
    }
    var data = await response.json();
    var text = data.content && data.content[0] && data.content[0].text ? data.content[0].text : '';
    // Extract JSON array from response
    var jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON. Falling back to offline mode.');
    }
    var parsed = JSON.parse(jsonMatch[0]);
    finishMapping(parsed);
  } catch(err) {
    console.error('[Claude]', err);
    toast('AI failed: ' + (err.message || 'unknown') + '. Using offline mode.', 'er');
    finishMapping(offlineSmartMap(rows));
  }
}

// Claude for PDF text — slightly different prompt
async function callClaudeForPDF(text) {
  var apiKey = getApiKey();
  if (!apiKey) {
    toast('PDFs need a Claude API key for reliable parsing', 'er');
    showImpStep('upload');
    return;
  }
  var fieldList = impState.type === 'products'
    ? 'name (required), sku, category, cost (number), price (number), qty (number), unit'
    : 'date (YYYY-MM-DD), customer, contact, inv, items (array), paid, paymode';

  var prompt = 'You are a data import assistant. The user uploaded a PDF with this text content:\n\n' +
    text.slice(0, 12000) +
    '\n\nExtract all ' + impState.type + ' rows you can find and return as a JSON array. Each row must have these fields where possible: ' + fieldList +
    '\n\nRules:\n- Return ONLY a JSON array, no commentary\n- Convert prices/quantities to numbers\n- If a field is missing, use "" or 0\n- For products, standardize category to: Tiles, Cement, Tools, Paint, Plumbing, Electrical, Accessories, Other\n\nReturn the JSON array now:';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      var errBody = await response.text();
      throw new Error('API ' + response.status + ': ' + errBody.slice(0, 200));
    }
    var data = await response.json();
    var txt = data.content && data.content[0] && data.content[0].text ? data.content[0].text : '';
    var jsonMatch = txt.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI did not return valid JSON');
    var parsed = JSON.parse(jsonMatch[0]);
    finishMapping(parsed);
  } catch(err) {
    console.error('[Claude PDF]', err);
    toast('PDF parsing failed: ' + (err.message || 'unknown'), 'er');
    showImpStep('upload');
  }
}

// ─── FINISH MAPPING — sanitize and show preview ───
function finishMapping(rows) {
  setProgress(95, 'Preparing preview...');

  // Sanitize and normalize
  var clean = rows.map(function(r) {
    if (impState.type === 'products') {
      return {
        name:     String(r.name || r.Name || '').trim(),
        sku:      String(r.sku || r.SKU || '').trim(),
        category: String(r.category || r.Category || 'Other').trim(),
        cost:     parseFloat(r.cost || r.Cost || 0) || 0,
        price:    parseFloat(r.price || r.Price || 0) || 0,
        qty:      parseFloat(r.qty || r.Qty || r.quantity || r.Quantity || 0) || 0,
        unit:     String(r.unit || r.Unit || 'Piece').trim(),
        desc:     String(r.desc || r.description || r.Description || '').trim(),
        size:     String(r.size || r.Size || '').trim(),
        lowLevel: parseFloat(r.lowLevel || r.low || 5) || 5
      };
    } else {
      // Sales
      var items = Array.isArray(r.items) ? r.items : [];
      return {
        date:      String(r.date || today()).trim(),
        customer:  String(r.customer || r.Customer || 'Walk-in').trim(),
        contact:   String(r.contact || r.phone || '').trim(),
        inv:       String(r.inv || r.invoice || '').trim(),
        items:     items,
        discount:  parseFloat(r.discount || 0) || 0,
        paid:      parseFloat(r.paid || r.Paid || 0) || 0,
        total:     parseFloat(r.total || r.Total || 0) || 0,
        paymode:   String(r.paymode || r.paymentMode || 'Cash').trim(),
        status:    String(r.status || 'active').trim()
      };
    }
  });

  // Remove empty rows
  clean = clean.filter(function(r) {
    if (impState.type === 'products') return r.name && r.name.length > 0;
    return r.customer || r.inv || (r.items && r.items.length);
  });

  impState.previewRows = clean;
  setProgress(100, 'Done!');
  setTimeout(function(){ showPreview(); }, 200);
}

// ─── SHOW PREVIEW ───
function showPreview() {
  showImpStep('preview');
  renderPreview();
}

function renderPreview() {
  var rows = impState.previewRows;
  var b = biz();
  var existing = impState.type === 'products' ? (b.products || []) : [];

  // Categorize: new vs updates
  var newCount = 0, updateCount = 0;
  rows.forEach(function(r){
    if (impState.type === 'products') {
      var match = existing.find(function(p){
        return (r.sku && p.sku && p.sku.toLowerCase() === r.sku.toLowerCase()) ||
               (r.name && p.name.toLowerCase() === r.name.toLowerCase());
      });
      r._isUpdate = !!match;
      r._existingId = match ? match.id : null;
      if (match) updateCount++;
      else newCount++;
    } else {
      r._isUpdate = false;
      newCount++;
    }
  });

  el('imp-preview-title').textContent = '📋 Review ' + rows.length + ' ' + impState.type;
  el('imp-preview-meta').textContent = rows.length + ' rows · ' + newCount + ' new · ' + updateCount + ' updates';
  el('imp-confirm-count').textContent = '(' + rows.length + ')';

  var html;
  if (impState.type === 'products') {
    html = '<div class="imp-row-header">' +
      '<div>Name</div><div>SKU / Category</div><div>Price</div><div>Qty</div><div></div>' +
    '</div>';
    rows.forEach(function(r, idx) {
      var cls = r._isUpdate ? 'imp-updates' : 'imp-new';
      var badge = r._isUpdate
        ? '<span class="imp-badge" style="background:var(--wab);color:var(--wa)">UPDATE</span>'
        : '<span class="imp-badge" style="background:var(--okb);color:var(--ok)">NEW</span>';
      html += '<div class="imp-row ' + cls + '">' +
        '<div>' +
          '<input type="text" value="' + esc(r.name) + '" oninput="updatePreview(' + idx + ',\'name\',this.value)">' +
          '<div style="margin-top:3px">' + badge + '</div>' +
        '</div>' +
        '<div>' +
          '<input type="text" value="' + esc(r.sku) + '" placeholder="SKU" oninput="updatePreview(' + idx + ',\'sku\',this.value)">' +
          '<input type="text" value="' + esc(r.category) + '" placeholder="Category" oninput="updatePreview(' + idx + ',\'category\',this.value)" style="margin-top:3px">' +
        '</div>' +
        '<div><input type="number" value="' + r.price + '" step="0.01" oninput="updatePreview(' + idx + ',\'price\',this.value)"></div>' +
        '<div><input type="number" value="' + r.qty + '" oninput="updatePreview(' + idx + ',\'qty\',this.value)"></div>' +
        '<div><button type="button" class="imp-rm" onclick="removePreviewRow(' + idx + ')" title="Remove">×</button></div>' +
      '</div>';
    });
  } else {
    // Sales preview
    html = '<div class="imp-row-header">' +
      '<div>Date / Customer</div><div>Invoice / Items</div><div>Total</div><div>Paid</div><div></div>' +
    '</div>';
    rows.forEach(function(r, idx) {
      var status = (r.paid >= r.total - 0.01) ? 'PAID' : (r.paid > 0 ? 'PARTIAL' : 'CREDIT');
      var statusColor = status === 'PAID' ? 'var(--ok)' : status === 'PARTIAL' ? 'var(--wa)' : 'var(--er)';
      html += '<div class="imp-row imp-new">' +
        '<div>' +
          '<input type="date" value="' + esc(r.date) + '" oninput="updatePreview(' + idx + ',\'date\',this.value)">' +
          '<input type="text" value="' + esc(r.customer) + '" placeholder="Customer" oninput="updatePreview(' + idx + ',\'customer\',this.value)" style="margin-top:3px">' +
        '</div>' +
        '<div>' +
          '<input type="text" value="' + esc(r.inv) + '" placeholder="Invoice" oninput="updatePreview(' + idx + ',\'inv\',this.value)">' +
          '<div style="font-size:10px;color:var(--t3);margin-top:3px">' + (r.items.length || 0) + ' item(s) · ' + esc(r.paymode) + '</div>' +
        '</div>' +
        '<div><input type="number" value="' + r.total + '" step="0.01" oninput="updatePreview(' + idx + ',\'total\',this.value)"></div>' +
        '<div>' +
          '<input type="number" value="' + r.paid + '" step="0.01" oninput="updatePreview(' + idx + ',\'paid\',this.value)">' +
          '<div style="font-size:9px;font-weight:800;color:' + statusColor + ';margin-top:3px;text-align:center">' + status + '</div>' +
        '</div>' +
        '<div><button type="button" class="imp-rm" onclick="removePreviewRow(' + idx + ')">×</button></div>' +
      '</div>';
    });
  }

  el('imp-preview-rows').innerHTML = html;
}

function updatePreview(idx, field, value) {
  if (!impState.previewRows[idx]) return;
  var row = impState.previewRows[idx];
  if (['price','qty','total','paid','cost','discount'].indexOf(field) >= 0) {
    row[field] = parseFloat(value) || 0;
  } else {
    row[field] = value;
  }
}

function removePreviewRow(idx) {
  impState.previewRows.splice(idx, 1);
  renderPreview();
}

function cancelImport() {
  if (confirm('Cancel import? No data will be saved.')) {
    closeD('d-import');
  }
}

// ─── CONFIRM IMPORT — SMART MERGE ───
function confirmImport() {
  var rows = impState.previewRows;
  if (!rows.length) { toast('Nothing to import', 'er'); return; }

  var b = biz();
  if (!b) { toast('No business selected', 'er'); return; }

  var added = 0, updated = 0, skipped = 0;

  if (impState.type === 'products') {
    b.products = b.products || [];
    rows.forEach(function(r) {
      if (!r.name) { skipped++; return; }
      var existing = null;
      if (r._existingId) {
        existing = b.products.find(function(p){ return p.id === r._existingId; });
      } else if (r.sku) {
        existing = b.products.find(function(p){ return p.sku && p.sku.toLowerCase() === r.sku.toLowerCase(); });
      }
      if (existing && impState.mergeMode === 'merge') {
        // Update existing
        existing.name     = r.name;
        existing.sku      = r.sku || existing.sku;
        existing.category = r.category || existing.category;
        existing.cost     = r.cost > 0 ? r.cost : existing.cost;
        existing.price    = r.price > 0 ? r.price : existing.price;
        existing.qty      = parseFloat(r.qty) || 0;
        existing.unit     = r.unit || existing.unit;
        existing.desc     = r.desc || existing.desc;
        existing.size     = r.size || existing.size;
        existing.lowLevel = r.lowLevel || existing.lowLevel;
        existing.updatedAt= Date.now();
        existing.adminUnlocked = true;
        updated++;
      } else if (!existing || impState.mergeMode === 'append-all') {
        // Add new
        b.products.push({
          id:         b.nextProdId++,
          name:       r.name,
          sku:        r.sku || '',
          category:   r.category || 'Other',
          cost:       r.cost || 0,
          price:      r.price || 0,
          qty:        parseFloat(r.qty) || 0,
          unit:       r.unit || 'Piece',
          desc:       r.desc || '',
          size:       r.size || '',
          lowLevel:   r.lowLevel || 5,
          imgData:    '',
          createdAt:  Date.now() - 9 * 3600000,  // unlocked
          updatedAt:  Date.now(),
          status:     'active'
        });
        added++;
      } else {
        skipped++;
      }
    });
  } else {
    // Sales import
    b.sales = b.sales || [];
    rows.forEach(function(r) {
      if (!r.customer && !r.inv) { skipped++; return; }
      var items = Array.isArray(r.items) && r.items.length
        ? r.items.map(function(i){
            return {
              prodId:    0,
              name:      String(i.name || 'Item'),
              qty:       parseFloat(i.qty) || 1,
              unitPrice: parseFloat(i.unitPrice || i.price || 0) || 0,
              cost:      parseFloat(i.cost) || 0
            };
          })
        : [{
            prodId: 0,
            name: 'Imported item',
            qty: 1,
            unitPrice: r.total || 0,
            cost: 0
          }];
      var invNum = r.inv || ('INV-' + String(b.nextSaleId || 1).padStart(4, '0'));
      b.sales.unshift({
        id:         b.nextSaleId++,
        inv:        invNum,
        date:       r.date || today(),
        customer:   r.customer || 'Walk-in',
        contact:    r.contact || '',
        items:      items,
        discount:   r.discount || 0,
        paid:       r.paid || 0,
        total:      r.total || items.reduce(function(a,i){return a + i.qty * i.unitPrice;}, 0),
        paymode:    r.paymode || 'Cash',
        status:     r.status || 'active',
        createdAt:  Date.now() - 9 * 3600000,
        updatedAt:  Date.now(),
        editLog:    []
      });
      added++;
    });
  }

  dbSave();
  if (typeof fbPush === 'function') try { fbPush(); } catch(e){}

  // Show done screen
  var msg = '';
  if (impState.type === 'products') {
    msg = added + ' new product' + (added !== 1 ? 's' : '') +
          (updated > 0 ? ', ' + updated + ' updated' : '') +
          (skipped > 0 ? ', ' + skipped + ' skipped' : '');
  } else {
    msg = added + ' sale' + (added !== 1 ? 's' : '') + ' imported' +
          (skipped > 0 ? ', ' + skipped + ' skipped' : '');
  }
  el('imp-done-msg').textContent = msg;
  showImpStep('done');

  // Re-render views
  if (impState.type === 'products') {
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderGallery === 'function') renderGallery();
  } else {
    if (typeof renderSales === 'function') renderSales();
    if (typeof fillSalesSummary === 'function') fillSalesSummary();
  }
  if (typeof renderDash === 'function') renderDash();

  if (typeof addAdminLog === 'function') {
    addAdminLog('import_' + impState.type, msg, CU ? CU.name : 'User');
  }
}

// ─── EXPORT ───
function exportProductsToExcel_protected(){ protectedExport(function(){ exportProductsToExcel_raw(); }, "exportProductsToExcel Export"); }
function exportProductsToExcel_raw() {
  if (typeof XLSX === 'undefined') { toast('Excel library not loaded', 'er'); return; }
  var b = biz();
  if (!b || !(b.products || []).length) { toast('No products to export', 'er'); return; }
  var data = b.products.map(function(p){
    return {
      Name:     p.name,
      SKU:      p.sku || '',
      Category: p.category || '',
      Cost:     p.cost || 0,
      Price:    p.price || 0,
      Qty:      p.qty || 0,
      Unit:     p.unit || '',
      Size:     p.size || '',
      Description: p.desc || '',
      LowLevel: p.lowLevel || 0
    };
  });
  var ws = XLSX.utils.json_to_sheet(data);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'products_' + today() + '.xlsx');
  toast('Exported ' + data.length + ' products', 'gd');
}

function exportSalesToExcel_protected(){ protectedExport(function(){ exportSalesToExcel_raw(); }, "exportSalesToExcel Export"); }
function exportSalesToExcel_raw() {
  if (typeof XLSX === 'undefined') { toast('Excel library not loaded', 'er'); return; }
  var b = biz();
  if (!b || !(b.sales || []).length) { toast('No sales to export', 'er'); return; }
  var data = b.sales.filter(function(s){return s.status !== 'cancelled';}).map(function(s){
    return {
      Invoice:  s.inv,
      Date:     s.date,
      Customer: s.customer,
      Contact:  s.contact || '',
      Items:    (s.items || []).map(function(i){ return i.name + ' x' + i.qty + ' @' + i.unitPrice;}).join(' | '),
      Discount: s.discount || 0,
      Total:    sTotal(s),
      Paid:     s.paid || 0,
      Due:      sDue(s),
      PayMode:  s.paymode,
      Status:   sSt(s)
    };
  });
  var ws = XLSX.utils.json_to_sheet(data);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  XLSX.writeFile(wb, 'sales_' + today() + '.xlsx');
  toast('Exported ' + data.length + ' sales', 'gd');
}



// ═══════════════════════════════════════════════════════════
// PROFILE / USERNAME / VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════

function isValidEmail(em) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(em || '').trim());
}

function isValidUsername(un) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(String(un || '').trim());
}

function isAdult(dob) {
  if (!dob) return false;
  var d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  var age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600000);
  return age >= 13 && age <= 120;
}

function daysSinceUsernameChange(user) {
  if (!user || !user.usernameChangedAt) return Infinity;
  return (Date.now() - user.usernameChangedAt) / (24 * 3600000);
}

function isProfileComplete(user) {
  if (!user) return false;
  return !!(user.email && user.dob && user.location && user.profileComplete);
}

// ═══════════════════════════════════════════════════════════
// FORCE PROFILE COMPLETION FOR EXISTING USERS
// Called from loginAs(). If user is missing email/dob/location,
// open the Complete Profile drawer and block app access.
// ═══════════════════════════════════════════════════════════
function checkProfileComplete() {
  try {
    if (!CU) return true;
    if (isProfileComplete(CU)) return true;

    // Open mandatory profile completion
    setTimeout(function(){
      openCompleteProfileDrawer();
    }, 600);
    return false;
  } catch(e) {
    console.error('[checkProfileComplete]', e);
    return true;
  }
}

function openCompleteProfileDrawer() {
  if (!CU) return;
  // Pre-fill anything we have
  var em = el('cp-email');     if (em) em.value = CU.email || '';
  var db = el('cp-dob');       if (db) db.value = CU.dob || '';
  var lc = el('cp-location');  if (lc) lc.value = CU.location || '';
  openD('d-complete-profile');
}

function saveCompleteProfile() {
  if (!CU) { toast('Not logged in', 'er'); return; }
  var em = gv('cp-email');
  var db = gv('cp-dob');
  var lc = gv('cp-location');
  var errEl = el('cp-err');
  function showErr(msg){ if(errEl){errEl.textContent=msg;errEl.style.display='';} }
  if (!em) return showErr('Email is required');
  if (!isValidEmail(em)) return showErr('Please enter a valid email address');
  if (!db) return showErr('Date of birth is required');
  if (!isAdult(db)) return showErr('You must be at least 13 years old');
  if (!lc) return showErr('Location is required');

  // Check email isn't used by another user
  var emLower = em.toLowerCase().trim();
  for (var i = 0; i < DB.users.length; i++) {
    var u = DB.users[i];
    if (u.id !== CU.id && (u.email || '').toLowerCase() === emLower) {
      return showErr('That email is already used by another user');
    }
  }

  // Save
  CU.email           = emLower;
  CU.dob             = db;
  CU.location        = lc.trim();
  CU.profileComplete = true;
  CU.updatedAt       = Date.now();

  // Persist in DB.users too
  var idx = DB.users.findIndex(function(x){ return x.id === CU.id; });
  if (idx >= 0) DB.users[idx] = CU;

  dbSave();
  if (typeof fbPush === 'function') try { fbPush(); } catch(e){}

  closeD('d-complete-profile');
  toast('Profile saved. Welcome!', 'gd');
}

// ═══════════════════════════════════════════════════════════
// PROFILE EDIT DRAWER (for changing username, etc)
// ═══════════════════════════════════════════════════════════
function openProfileEdit() {
  if (!CU) return;
  var u = el('pe-username');   if (u) u.value = CU.username || '';
  var n = el('pe-name');       if (n) n.value = CU.name || '';
  var e = el('pe-email');      if (e) e.value = CU.email || '';
  var d = el('pe-dob');        if (d) d.value = CU.dob || '';
  var l = el('pe-location');   if (l) l.value = CU.location || '';
  var p = el('pe-phone');      if (p) p.value = CU.phone || '';

  // Show username change cooldown info
  var daysLeft = 30 - daysSinceUsernameChange(CU);
  var unInfo = el('pe-un-info');
  var unInput = el('pe-username');
  if (unInfo) {
    if (CU.usernameChangedAt && daysLeft > 0) {
      unInfo.innerHTML = '🔒 Locked — you can change again in <strong>' + Math.ceil(daysLeft) + ' day' + (Math.ceil(daysLeft) !== 1 ? 's' : '') + '</strong>';
      unInfo.style.color = 'var(--wa)';
      if (unInput) { unInput.disabled = true; unInput.style.opacity = '.5'; }
    } else {
      unInfo.innerHTML = 'You can change your username (once every 30 days)';
      unInfo.style.color = 'var(--t3)';
      if (unInput) { unInput.disabled = false; unInput.style.opacity = '1'; }
    }
  }

  closeSidebarMenu();
  openD('d-profile-edit');
}

function saveProfileEdit() {
  if (!CU) return;
  var oldUn = CU.username;
  var newUn = gv('pe-username');
  var name  = gv('pe-name');
  var email = gv('pe-email');
  var dob   = gv('pe-dob');
  var loc   = gv('pe-location');
  var phone = gv('pe-phone');
  var errEl = el('pe-err');
  function showErr(msg){ if(errEl){errEl.textContent=msg;errEl.style.display='';} }

  if (!name)  return showErr('Name is required');
  if (!email) return showErr('Email is required');
  if (!isValidEmail(email)) return showErr('Please enter a valid email');
  if (!dob)   return showErr('Date of birth is required');
  if (!isAdult(dob)) return showErr('You must be at least 13 years old');
  if (!loc)   return showErr('Location is required');

  // Username change rules
  if (newUn !== oldUn) {
    if (!isValidUsername(newUn)) return showErr('Username: 3-20 letters, numbers or underscores');
    var daysLeft = 30 - daysSinceUsernameChange(CU);
    if (CU.usernameChangedAt && daysLeft > 0) {
      return showErr('Username locked for ' + Math.ceil(daysLeft) + ' more day(s)');
    }
    // Check uniqueness
    var unLower = newUn.toLowerCase();
    for (var i = 0; i < DB.users.length; i++) {
      if (DB.users[i].id !== CU.id && (DB.users[i].username || '').toLowerCase() === unLower) {
        return showErr('Username already taken');
      }
    }
    CU.username = newUn;
    CU.usernameChangedAt = Date.now();
  }

  // Email uniqueness check
  var emLower = email.toLowerCase().trim();
  for (var j = 0; j < DB.users.length; j++) {
    if (DB.users[j].id !== CU.id && (DB.users[j].email || '').toLowerCase() === emLower) {
      return showErr('That email is already used by another user');
    }
  }

  CU.name           = name;
  CU.email          = emLower;
  CU.dob            = dob;
  CU.location       = loc.trim();
  CU.phone          = phone;
  CU.profileComplete= true;
  CU.updatedAt      = Date.now();

  // Update in DB.users
  var idx = DB.users.findIndex(function(x){ return x.id === CU.id; });
  if (idx >= 0) DB.users[idx] = CU;

  dbSave();
  if (typeof fbPush === 'function') try { fbPush(); } catch(e){}

  closeD('d-profile-edit');
  toast('Profile updated', 'gd');

  // Refresh sidebar avatar/name
  if (typeof refreshSidebar === 'function') refreshSidebar();
}



// ═══════════════════════════════════════════════════════════
// SUPPORT / ABOUT / TERMS PAGES
// ═══════════════════════════════════════════════════════════
function openSupportPage() { openD('d-support'); }
function openAboutPage()   { openD('d-about'); }
function openTermsPage()   { openD('d-terms'); }



// ═══════════════════════════════════════════════════════════
// STAFF CHAT SYSTEM (Group + DM + Photos)
// ═══════════════════════════════════════════════════════════
let chatState = {
  tab:         'group',    // 'group' | 'dm-list' | 'dm-conv'
  activePeer:  null,       // user object when in dm-conv
  unsubGroup:  null,       // Firebase listener
  unsubDm:     null
};

function ensureChatStorage() {
  if (!DB) return;
  DB.chatMessages = DB.chatMessages || [];
  DB.nextChatId   = typeof DB.nextChatId === 'number' ? DB.nextChatId : 1;
}

function chatConvId(userId1, userId2) {
  var a = Math.min(userId1, userId2);
  var b = Math.max(userId1, userId2);
  return 'dm-' + a + '-' + b;
}

function renderChat() {
  ensureChatStorage();
  if (chatState.tab === 'group') {
    switchChatTab('group');
  } else if (chatState.tab === 'dm-conv' && chatState.activePeer) {
    renderDmConversation();
  } else {
    switchChatTab('dm');
  }
  markChatMessagesRead();
}

function switchChatTab(tab) {
  chatState.tab = tab === 'dm' ? 'dm-list' : tab;

  // Tab pills — highlight active tab
  ['group','dm','ai'].forEach(function(t) {
    var btn = el('chat-tab-' + t);
    if (btn) btn.classList.toggle('on', t === tab);
  });

  // Views — show active, hide others
  var vg  = el('chat-view-group');
  var vdl = el('chat-view-dm-list');
  var vdc = el('chat-view-dm-conv');
  var vai = el('chat-view-ai');

  // Use hidden class so CSS flex is not overridden
  if (vg)  vg.classList.toggle('hidden',  tab !== 'group');
  if (vdl) vdl.classList.toggle('hidden', tab !== 'dm');
  if (vdc) vdc.classList.add('hidden');
  if (vai) vai.classList.toggle('hidden', tab !== 'ai');

  // Render appropriate content
  if (tab === 'group') {
    renderGroupChat();
  } else if (tab === 'dm') {
    renderDmList();
  } else if (tab === 'ai') {
    setTimeout(scrollAIToBottom, 100);
  }
}

function backToDmList() {
  chatState.tab = 'dm-list';
  chatState.activePeer = null;
  var vdl= el('chat-view-dm-list');
  var vdc= el('chat-view-dm-conv');
  if (vdl) vdl.style.display = '';
  if (vdc) vdc.style.display = 'none';
  renderDmList();
}

// ─── GROUP CHAT ───
function renderGroupChat() {
  ensureChatStorage();
  if (!CU || !CBI) return;
  var msgs = (DB.chatMessages || []).filter(function(m){
    return m.bizId === CBI && m.conv === 'group';
  }).sort(function(a,b){ return a.ts - b.ts; });

  var container = el('chat-group-msgs');
  if (!container) return;

  if (!msgs.length) {
    container.innerHTML =
      '<div class="chat-empty">' +
        '<div class="chat-empty-icon">👋</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--t2);margin-bottom:5px">No messages yet</div>' +
        '<div style="font-size:12px">Be the first to say hello to your team!</div>' +
      '</div>';
    return;
  }

  var html = '';
  var lastDay = '';
  msgs.forEach(function(m){
    var dayLabel = formatChatDay(m.ts);
    if (dayLabel !== lastDay) {
      html += '<div class="chat-day-divider">' + dayLabel + '</div>';
      lastDay = dayLabel;
    }
    html += buildChatBubble(m);
  });
  container.innerHTML = html;
  // Scroll to bottom
  setTimeout(function(){ container.scrollTop = container.scrollHeight; }, 50);
}

// ─── DM LIST ───
function renderDmList() {
  ensureChatStorage();
  if (!CU || !CBI) return;
  // List all other users in this business
  var teammates = (DB.users || []).filter(function(u){
    return u.id !== CU.id
      && u.businessIds && u.businessIds.indexOf(CBI) >= 0
      && u.status !== 'pending';
  });

  var listEl = el('chat-dm-list');
  if (!listEl) return;

  if (!teammates.length) {
    listEl.innerHTML =
      '<div class="chat-empty">' +
        '<div class="chat-empty-icon">👥</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--t2);margin-bottom:5px">No teammates yet</div>' +
        '<div style="font-size:12px">Invite staff from More → Team Management</div>' +
      '</div>';
    return;
  }

  var html = teammates.map(function(u){
    var convId = chatConvId(CU.id, u.id);
    var msgs = (DB.chatMessages || []).filter(function(m){
      return m.bizId === CBI && m.conv === convId;
    });
    var lastMsg = msgs.length ? msgs[msgs.length-1] : null;
    var unread = msgs.filter(function(m){
      return m.from !== CU.id && (!m.readBy || m.readBy.indexOf(CU.id) < 0);
    }).length;
    var lastTxt = lastMsg
      ? (lastMsg.photo ? '📷 Photo' : (lastMsg.text || ''))
      : 'No messages yet';
    var lastTime = lastMsg ? formatChatTime(lastMsg.ts) : '';

    return '<div class="chat-dm-item" onclick="openDmConversation(' + u.id + ')">' +
      '<div class="av" style="width:42px;height:42px;font-size:14px;flex-shrink:0">' + esc(mkInit(u.name)) + '</div>' +
      '<div class="chat-dm-info">' +
        '<div class="chat-dm-info-name">' + esc(u.name || u.username) + '</div>' +
        '<div class="chat-dm-info-last">' + esc(lastTxt.slice(0, 50)) + (lastTxt.length > 50 ? '…' : '') + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
        (lastTime ? '<div style="font-size:10px;color:var(--t3);font-family:var(--fm);margin-bottom:3px">' + lastTime + '</div>' : '') +
        (unread > 0 ? '<div class="chat-dm-badge">' + unread + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  listEl.innerHTML = html;
}

function openDmConversation(peerUserId) {
  var peer = (DB.users || []).find(function(u){ return u.id === peerUserId; });
  if (!peer) { toast('User not found', 'er'); return; }
  chatState.activePeer = peer;
  chatState.tab = 'dm-conv';

  var vdl= el('chat-view-dm-list');
  var vdc= el('chat-view-dm-conv');
  if (vdl) vdl.style.display = 'none';
  if (vdc) vdc.style.display = '';

  // Update header
  var av  = el('chat-dm-av');
  var nm  = el('chat-dm-name');
  if (av) av.textContent = mkInit(peer.name);
  if (nm) nm.textContent = peer.name || peer.username;

  renderDmConversation();
}

function renderDmConversation() {
  ensureChatStorage();
  if (!CU || !chatState.activePeer) return;
  var convId = chatConvId(CU.id, chatState.activePeer.id);
  var msgs = (DB.chatMessages || []).filter(function(m){
    return m.bizId === CBI && m.conv === convId;
  }).sort(function(a,b){ return a.ts - b.ts; });

  var container = el('chat-dm-msgs');
  if (!container) return;

  if (!msgs.length) {
    container.innerHTML =
      '<div class="chat-empty">' +
        '<div class="chat-empty-icon">💬</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--t2);margin-bottom:5px">Start the conversation</div>' +
        '<div style="font-size:12px">Send a message to ' + esc(chatState.activePeer.name) + '</div>' +
      '</div>';
  } else {
    var html = '';
    var lastDay = '';
    msgs.forEach(function(m){
      var dayLabel = formatChatDay(m.ts);
      if (dayLabel !== lastDay) {
        html += '<div class="chat-day-divider">' + dayLabel + '</div>';
        lastDay = dayLabel;
      }
      html += buildChatBubble(m, true);
    });
    container.innerHTML = html;
    setTimeout(function(){ container.scrollTop = container.scrollHeight; }, 50);
  }
  // Mark messages from peer as read
  markChatMessagesRead();
}

function buildChatBubble(m, hideAuthor) {
  var isMe = m.from === CU.id;
  var fromUser = (DB.users || []).find(function(u){ return u.id === m.from; });
  var fromName = fromUser ? (fromUser.name || fromUser.username) : 'Unknown';

  var photoHtml = m.photo ? '<img src="' + m.photo + '" alt="photo">' : '';
  var textHtml  = m.text  ? esc(m.text) : '';

  return '<div class="chat-msg ' + (isMe ? 'chat-msg-me' : 'chat-msg-them') + '">' +
    (isMe || hideAuthor ? '' : '<div class="chat-msg-author">' + esc(fromName) + '</div>') +
    textHtml +
    photoHtml +
    '<div class="chat-msg-meta">' + formatChatTime(m.ts) + '</div>' +
  '</div>';
}

// ─── SENDING ───
function sendChatMessage(mode) {
  ensureChatStorage();
  if (!CU || !CBI) { toast('Not signed in', 'er'); return; }

  var inputId, convId;
  if (mode === 'group') {
    inputId = 'chat-group-input';
    convId  = 'group';
  } else {
    inputId = 'chat-dm-input';
    if (!chatState.activePeer) return;
    convId  = chatConvId(CU.id, chatState.activePeer.id);
  }

  var inputEl = el(inputId);
  if (!inputEl) return;
  var text = (inputEl.value || '').trim();
  if (!text) return;

  DB.chatMessages.push({
    id:     DB.nextChatId++,
    bizId:  CBI,
    conv:   convId,
    from:   CU.id,
    fromName: CU.name,
    text:   text,
    photo:  null,
    ts:     Date.now(),
    readBy: [CU.id]
  });

  inputEl.value = '';
  dbSave();
  if (typeof fbPush === 'function') try { fbPush(); } catch(e){}

  // Re-render
  if (mode === 'group') renderGroupChat();
  else renderDmConversation();
}

// ─── PHOTO ATTACH ───
let chatPhotoTarget = 'group';
function attachChatPhoto(mode) {
  chatPhotoTarget = mode;
  var inp = el('chat-photo-input');
  if (inp) { inp.value = ''; inp.click(); }
}

function handleChatPhoto(ev) {
  var file = ev.target.files && ev.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Photo too large (max 5MB)', 'er');
    return;
  }
  // Resize/compress before sending
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      // Compress to max 800px wide, JPEG quality 0.7
      var maxW = 800;
      var w = img.width, hgt = img.height;
      if (w > maxW) { hgt = hgt * (maxW / w); w = maxW; }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = hgt;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, hgt);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.7);

      ensureChatStorage();
      var convId = chatPhotoTarget === 'group' ? 'group'
        : chatConvId(CU.id, chatState.activePeer.id);

      DB.chatMessages.push({
        id:     DB.nextChatId++,
        bizId:  CBI,
        conv:   convId,
        from:   CU.id,
        fromName: CU.name,
        text:   '',
        photo:  dataUrl,
        ts:     Date.now(),
        readBy: [CU.id]
      });

      dbSave();
      if (typeof fbPush === 'function') try { fbPush(); } catch(e){}

      if (chatPhotoTarget === 'group') renderGroupChat();
      else renderDmConversation();

      toast('Photo sent', 'gd');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── MARK AS READ ───
function markChatMessagesRead() {
  if (!CU || !CBI) return;
  ensureChatStorage();
  var changed = false;
  DB.chatMessages.forEach(function(m){
    if (m.bizId !== CBI) return;
    // Decide if this message is in the current view
    var isVisible = false;
    if (chatState.tab === 'group' && m.conv === 'group') isVisible = true;
    if (chatState.tab === 'dm-conv' && chatState.activePeer
        && m.conv === chatConvId(CU.id, chatState.activePeer.id)) isVisible = true;
    if (!isVisible) return;

    m.readBy = m.readBy || [];
    if (m.readBy.indexOf(CU.id) < 0) {
      m.readBy.push(CU.id);
      changed = true;
    }
  });
  if (changed) { dbSave(); checkChatUnread(); }
}

// ─── UNREAD BADGE ───
function checkChatUnread() {
  if (!CU || !CBI) return;
  ensureChatStorage();
  var unread = (DB.chatMessages || []).filter(function(m){
    if (m.bizId !== CBI) return false;
    if (m.from === CU.id) return false;
    return !m.readBy || m.readBy.indexOf(CU.id) < 0;
  }).length;
  var dot = el('chat-dot');
  if (dot) dot.style.display = unread > 0 ? '' : 'none';
}

// ─── FORMATTING HELPERS ───
function formatChatTime(ts) {
  var d = new Date(ts);
  var hh = d.getHours(), mm = String(d.getMinutes()).padStart(2,'0');
  var ap = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12; if (hh === 0) hh = 12;
  return hh + ':' + mm + ' ' + ap;
}

function formatChatDay(ts) {
  var d = new Date(ts);
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var dayDiff = Math.floor((today - msgDate) / (24 * 3600 * 1000));
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Check unread on app start + every 10s
setInterval(function(){
  try { checkChatUnread(); } catch(e){}
}, 10000);



// ═══════════════════════════════════════════════════════════
// FINANCIAL REPORT FILTERS (one at a time, not combined)
// ═══════════════════════════════════════════════════════════
let finActiveFilter = { type: 'date', value: 'all' };  // The ONE active filter
let finFilterDraft  = null;                            // Working filter inside drawer
let finTab          = 'pl';                            // Active tab

const FIN_FILTER_TYPES = {
  date:     { label: 'Date', icon: '📅', emptyLbl: 'All Time' },
  category: { label: 'Category', icon: '🏷', emptyLbl: 'All Categories' },
  payment:  { label: 'Payment Mode', icon: '💳', emptyLbl: 'All Payments' },
  invoice:  { label: 'Invoice / Customer', icon: '📄', emptyLbl: 'Invoice/Customer' },
  staff:    { label: 'Staff Entry', icon: '👤', emptyLbl: 'All Staff' }
};

function openFinFilter(type) {
  finFilterDraft = JSON.parse(JSON.stringify(finActiveFilter));
  if (finFilterDraft.type !== type) {
    finFilterDraft = getDefaultFilterFor(type);
  }
  el('finf-title').textContent = '🔍 ' + FIN_FILTER_TYPES[type].label + ' Filter';
  el('finf-sub').textContent   = 'Pick one option (replaces any current filter)';
  renderFilterBody(type);
  openD('d-fin-filter');
}

function getDefaultFilterFor(type) {
  if (type === 'date')     return { type: 'date',     value: 'all', start: '', end: '', single: '' };
  if (type === 'category') return { type: 'category', value: [] };
  if (type === 'payment')  return { type: 'payment',  value: 'all' };
  if (type === 'invoice')  return { type: 'invoice',  value: '' };
  if (type === 'staff')    return { type: 'staff',    value: 'all' };
  return { type: 'date', value: 'all' };
}

function renderFilterBody(type) {
  var body = el('finf-body');
  if (!body) return;
  var html = '';

  if (type === 'date') {
    var v = finFilterDraft.value || 'all';
    var opts = [
      ['all',       'All Time',     '📊 Show every record'],
      ['today',     'Today',        '☀️ Records from today'],
      ['yesterday', 'Yesterday',    '🌙 Records from yesterday'],
      ['this-mo',   'This Month',   '📅 Current calendar month'],
      ['last-mo',   'Last Month',   '📆 Previous calendar month'],
      ['single',    'Single Day',   '📅 Pick a specific date'],
      ['range',     'Date Range',   '📅 Custom start & end dates']
    ];
    html = opts.map(function(o){
      var act = v === o[0];
      return '<div class="finf-opt' + (act ? ' on' : '') + '" onclick="setDateOpt(\'' + o[0] + '\')">' +
        '<div class="finf-opt-radio">' + (act ? '●' : '○') + '</div>' +
        '<div style="flex:1">' +
          '<div class="finf-opt-name">' + o[1] + '</div>' +
          '<div class="finf-opt-sub">' + o[2] + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // If single or range chosen, show date inputs
    if (v === 'single') {
      html += '<div style="padding:14px;background:var(--s2);border-radius:var(--r10);margin-top:10px">' +
        '<div class="fl">Pick Date</div>' +
        '<input class="fi" type="date" id="finf-single" value="' + (finFilterDraft.single || today()) + '" onchange="finFilterDraft.single=this.value">' +
      '</div>';
    } else if (v === 'range') {
      html += '<div style="padding:14px;background:var(--s2);border-radius:var(--r10);margin-top:10px">' +
        '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<div><div class="fl">From</div><input class="fi" type="date" id="finf-rstart" value="' + (finFilterDraft.start || '') + '" onchange="finFilterDraft.start=this.value"></div>' +
          '<div><div class="fl">To</div><input class="fi" type="date" id="finf-rend" value="' + (finFilterDraft.end || '') + '" onchange="finFilterDraft.end=this.value"></div>' +
        '</div>' +
      '</div>';
    }

  } else if (type === 'category') {
    // Multi-select with checkboxes
    var b = biz();
    var cats = [];
    if (b && b.products) {
      var seen = {};
      b.products.forEach(function(p){
        var c = (p.category || 'Other').trim();
        if (c && !seen[c]) { seen[c] = 1; cats.push(c); }
      });
      cats.sort();
    }
    var selected = Array.isArray(finFilterDraft.value) ? finFilterDraft.value : [];
    html = '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;text-align:center">Tap categories to include them. Empty = all categories.</div>';
    if (!cats.length) {
      html += '<div style="text-align:center;padding:30px;color:var(--t3)">No categories yet. Add products first.</div>';
    } else {
      html += cats.map(function(c){
        var ck = selected.indexOf(c) >= 0;
        return '<div class="finf-opt' + (ck ? ' on' : '') + '" onclick="toggleCatFilter(\'' + esc(c).replace(/\x27/g, "\\'") + '\')">' +
          '<div class="finf-opt-radio" style="font-size:14px">' + (ck ? '☑' : '☐') + '</div>' +
          '<div style="flex:1">' +
            '<div class="finf-opt-name">' + esc(c) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

  } else if (type === 'payment') {
    var v = finFilterDraft.value || 'all';
    var modes = ['all', 'Cash', 'Card', 'Mobile', 'Bank', 'Credit'];
    var icons = { all:'📊', Cash:'💵', Card:'💳', Mobile:'📱', Bank:'🏦', Credit:'📝' };
    html = modes.map(function(m){
      var act = v === m;
      return '<div class="finf-opt' + (act ? ' on' : '') + '" onclick="finFilterDraft.value=\'' + m + '\';renderFilterBody(\'payment\')">' +
        '<div class="finf-opt-radio">' + (act ? '●' : '○') + '</div>' +
        '<div style="flex:1">' +
          '<div class="finf-opt-name">' + icons[m] + ' ' + (m === 'all' ? 'All Payment Modes' : m) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

  } else if (type === 'invoice') {
    html = '<div style="padding:14px">' +
      '<div class="fl">Search by Invoice # or Customer Name / Contact</div>' +
      '<input class="fi" type="text" id="finf-inv-input" value="' + esc(finFilterDraft.value || '') + '" placeholder="e.g. INV-0023 or John or 0770..." oninput="finFilterDraft.value=this.value" autofocus>' +
      '<div style="font-size:11px;color:var(--t3);margin-top:8px;line-height:1.6">Matches invoice number, customer name, OR contact/phone number (case-insensitive).</div>' +
    '</div>';

  } else if (type === 'staff') {
    var v = finFilterDraft.value || 'all';
    var staffUsers = (DB.users || []).filter(function(u){
      return u.businessIds && u.businessIds.indexOf(CBI) >= 0 && u.status !== 'pending';
    });
    html = '<div class="finf-opt' + (v === 'all' ? ' on' : '') + '" onclick="finFilterDraft.value=\'all\';renderFilterBody(\'staff\')">' +
      '<div class="finf-opt-radio">' + (v === 'all' ? '●' : '○') + '</div>' +
      '<div style="flex:1"><div class="finf-opt-name">👥 All Staff Entries</div></div>' +
    '</div>';
    html += staffUsers.map(function(u){
      var act = String(v) === String(u.id);
      return '<div class="finf-opt' + (act ? ' on' : '') + '" onclick="finFilterDraft.value=' + u.id + ';renderFilterBody(\'staff\')">' +
        '<div class="finf-opt-radio">' + (act ? '●' : '○') + '</div>' +
        '<div style="flex:1">' +
          '<div class="finf-opt-name">' + esc(u.name || u.username) + '</div>' +
          '<div class="finf-opt-sub">' + (RLBL[u.role] || u.role) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  body.innerHTML = html;
}

function setDateOpt(val) {
  finFilterDraft.value = val;
  if (val === 'single' && !finFilterDraft.single) finFilterDraft.single = today();
  if (val === 'range') {
    if (!finFilterDraft.start) {
      var d = new Date();
      finFilterDraft.start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
    }
    if (!finFilterDraft.end) finFilterDraft.end = today();
  }
  renderFilterBody('date');
}

function toggleCatFilter(cat) {
  var arr = Array.isArray(finFilterDraft.value) ? finFilterDraft.value : [];
  var idx = arr.indexOf(cat);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(cat);
  finFilterDraft.value = arr;
  renderFilterBody('category');
}

function applyFilter() {
  finActiveFilter = JSON.parse(JSON.stringify(finFilterDraft));
  closeD('d-fin-filter');
  refreshFilterChips();
  renderFinReports();
}

function clearOneFilter() {
  finActiveFilter = { type: 'date', value: 'all' };
  closeD('d-fin-filter');
  refreshFilterChips();
  renderFinReports();
}

function refreshFilterChips() {
  var f = finActiveFilter;
  var dateLbl = el('finf-date-lbl');
  var catLbl  = el('finf-cat-lbl');
  var payLbl  = el('finf-pay-lbl');
  var invLbl  = el('finf-inv-lbl');
  var staffLbl= el('finf-staff-lbl');

  // Reset all
  if (dateLbl)  dateLbl.textContent  = 'All Time';
  if (catLbl)   catLbl.textContent   = 'All Categories';
  if (payLbl)   payLbl.textContent   = 'All Payments';
  if (invLbl)   invLbl.textContent   = 'Invoice/Customer';
  if (staffLbl) staffLbl.textContent = 'All Staff';

  // Set the active one
  if (f.type === 'date') {
    if (dateLbl) dateLbl.textContent = describeDateFilter(f);
  } else if (f.type === 'category' && f.value && f.value.length) {
    if (catLbl) catLbl.textContent = f.value.length === 1 ? f.value[0] : (f.value.length + ' categories');
  } else if (f.type === 'payment' && f.value && f.value !== 'all') {
    if (payLbl) payLbl.textContent = f.value;
  } else if (f.type === 'invoice' && f.value) {
    if (invLbl) invLbl.textContent = '"' + f.value.slice(0, 12) + (f.value.length > 12 ? '…' : '') + '"';
  } else if (f.type === 'staff' && f.value !== 'all') {
    var u = (DB.users || []).find(function(x){ return x.id === f.value; });
    if (staffLbl && u) staffLbl.textContent = u.name || u.username;
  }

  // Active filter chip with X to clear
  var row = el('finf-active-row');
  if (row) {
    if (f.type !== 'date' || f.value !== 'all') {
      var lbl = (FIN_FILTER_TYPES[f.type].icon || '') + ' ' + describeActiveFilter(f);
      row.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 11px;background:rgba(212,165,32,.12);border:1px solid rgba(212,165,32,.3);border-radius:99px;font-size:12px;color:var(--g);font-weight:700;width:fit-content">' +
          '<span>Active: ' + esc(lbl) + '</span>' +
          '<span onclick="clearOneFilter()" style="cursor:pointer;font-size:14px;line-height:1">&#10005;</span>' +
        '</div>';
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  }
}

function describeDateFilter(f) {
  if (f.value === 'all')       return 'All Time';
  if (f.value === 'today')     return 'Today';
  if (f.value === 'yesterday') return 'Yesterday';
  if (f.value === 'this-mo')   return 'This Month';
  if (f.value === 'last-mo')   return 'Last Month';
  if (f.value === 'single')    return f.single || 'Single Day';
  if (f.value === 'range')     return (f.start || '?') + ' → ' + (f.end || '?');
  return 'Custom';
}

function describeActiveFilter(f) {
  if (f.type === 'date')     return describeDateFilter(f);
  if (f.type === 'category') return (f.value || []).join(', ');
  if (f.type === 'payment')  return f.value;
  if (f.type === 'invoice')  return 'Search: "' + f.value + '"';
  if (f.type === 'staff') {
    var u = (DB.users || []).find(function(x){ return x.id === f.value; });
    return u ? (u.name || u.username) : 'Unknown';
  }
  return '';
}

// ─── Apply the filter to sales/expenses ───
function applyFinFilterToSales(sales) {
  var f = finActiveFilter;
  var b = biz();
  return sales.filter(function(s) {
    if (s.status === 'cancelled') return false;

    if (f.type === 'date') {
      if (!dateMatchesFilter(s.date, f)) return false;
    } else if (f.type === 'category') {
      if (f.value && f.value.length) {
        // Sale matches if ANY of its items belong to one of selected categories
        var prods = b ? (b.products || []) : [];
        var saleCats = (s.items || []).map(function(it){
          var prod = prods.find(function(p){ return p.id === it.prodId; });
          return prod ? (prod.category || 'Other') : null;
        }).filter(Boolean);
        var any = saleCats.some(function(c){ return f.value.indexOf(c) >= 0; });
        if (!any) return false;
      }
    } else if (f.type === 'payment') {
      if (f.value !== 'all') {
        if ((s.paymode || '').toLowerCase() !== f.value.toLowerCase()) return false;
      }
    } else if (f.type === 'invoice') {
      if (f.value) {
        var q = f.value.toLowerCase();
        var match =
          (s.inv || '').toLowerCase().indexOf(q) >= 0 ||
          (s.customer || '').toLowerCase().indexOf(q) >= 0 ||
          (s.contact || '').toLowerCase().indexOf(q) >= 0;
        if (!match) return false;
      }
    } else if (f.type === 'staff') {
      if (f.value !== 'all') {
        var creator = s.createdBy || s.staffId || null;
        if (String(creator) !== String(f.value)) return false;
      }
    }
    return true;
  });
}

function applyFinFilterToExpenses(exps) {
  var f = finActiveFilter;
  return exps.filter(function(e) {
    if (e.status === 'cancelled') return false;
    if (f.type === 'date') {
      if (!dateMatchesFilter(e.date, f)) return false;
    } else if (f.type === 'category') {
      // Expenses can have a category field too
      if (f.value && f.value.length) {
        var ec = (e.category || '').trim();
        if (!ec || f.value.indexOf(ec) < 0) return false;
      }
    } else if (f.type === 'staff') {
      if (f.value !== 'all') {
        var creator = e.createdBy || e.staffId || null;
        if (String(creator) !== String(f.value)) return false;
      }
    }
    return true;
  });
}

function dateMatchesFilter(dateStr, f) {
  if (!dateStr) return false;
  if (f.value === 'all') return true;
  var todayStr = today();
  if (f.value === 'today') return dateStr === todayStr;
  if (f.value === 'yesterday') {
    var d = new Date(); d.setDate(d.getDate()-1);
    return dateStr === d.toISOString().slice(0,10);
  }
  if (f.value === 'this-mo') return dateStr.startsWith(thisMonth());
  if (f.value === 'last-mo') {
    var d = new Date(); d.setMonth(d.getMonth()-1);
    var lm = d.toISOString().slice(0,7);
    return dateStr.startsWith(lm);
  }
  if (f.value === 'single') return dateStr === f.single;
  if (f.value === 'range')  return (!f.start || dateStr >= f.start) && (!f.end || dateStr <= f.end);
  return true;
}

// ═══════════════════════════════════════════════════════════
// PROFIT CALCULATION HELPERS
// ═══════════════════════════════════════════════════════════
function calcProfitForItem(item) {
  var qty   = parseFloat(item.qty) || 0;
  var price = parseFloat(item.unitPrice) || 0;
  var cost  = parseFloat(item.cost) || 0;
  var perUnit = price - cost;
  var total   = perUnit * qty;
  var margin  = price > 0 ? (perUnit / price * 100) : 0;
  return { qty: qty, price: price, cost: cost, perUnit: perUnit, total: total, margin: margin };
}

function calcProfitForSale(sale) {
  var items = sale.items || [];
  var totalProfit = 0;
  var totalCost   = 0;
  var totalRev    = 0;
  items.forEach(function(it){
    var p = calcProfitForItem(it);
    totalProfit += p.total;
    totalCost   += p.cost * p.qty;
    totalRev    += p.price * p.qty;
  });
  // Subtract discount from profit
  var discount = parseFloat(sale.discount) || 0;
  totalProfit -= discount;
  var margin = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;
  return { profit: totalProfit, cost: totalCost, revenue: totalRev, margin: margin };
}

function buildProfitBreakdown(sales) {
  // Aggregate by product
  var byProduct = {};
  sales.forEach(function(s){
    (s.items || []).forEach(function(it){
      var key = it.name || ('Product #' + it.prodId);
      if (!byProduct[key]) {
        byProduct[key] = {
          name: key,
          qty: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          unitCost: parseFloat(it.cost) || 0,
          unitPrice: parseFloat(it.unitPrice) || 0
        };
      }
      var p = calcProfitForItem(it);
      byProduct[key].qty     += p.qty;
      byProduct[key].revenue += p.price * p.qty;
      byProduct[key].cost    += p.cost * p.qty;
      byProduct[key].profit  += p.total;
      // Keep latest price/cost
      byProduct[key].unitCost  = p.cost;
      byProduct[key].unitPrice = p.price;
    });
  });
  // Convert to array, sort by total profit desc
  return Object.keys(byProduct)
    .map(function(k){ return byProduct[k]; })
    .sort(function(a,b){ return b.profit - a.profit; });
}

function renderProfitBreakdownSection(sales) {
  var breakdown = buildProfitBreakdown(sales);
  if (!breakdown.length) return '';

  var totalProfit = breakdown.reduce(function(a,b){ return a + b.profit; }, 0);
  var totalRev    = breakdown.reduce(function(a,b){ return a + b.revenue; }, 0);
  var avgMargin   = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;

  var html =
    '<div class="card" style="margin-bottom:12px;padding:0;overflow:hidden">' +
      '<div style="padding:13px 15px;background:linear-gradient(135deg,rgba(34,197,94,.12),rgba(34,197,94,.02));border-bottom:1px solid rgba(34,197,94,.2);display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<div style="font-size:13px;font-weight:800;color:var(--ok);letter-spacing:.02em">💰 Profit Breakdown by Product</div>' +
          '<div style="font-size:10px;color:var(--t3);margin-top:2px;font-family:var(--fm)">' + breakdown.length + ' products · ' + avgMargin.toFixed(1) + '% avg margin</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<div style="font-family:var(--fd);font-size:18px;font-weight:900;color:var(--ok);line-height:1">' + f$(totalProfit) + '</div>' +
          '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--fm)">Total Profit</div>' +
        '</div>' +
      '</div>';

  // Header row
  html += '<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:6px;padding:8px 13px;background:var(--s2);border-bottom:1px solid var(--bd);font-size:9px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--fm)">' +
    '<div>Product</div>' +
    '<div style="text-align:right">Per Unit</div>' +
    '<div style="text-align:right">Qty Sold</div>' +
    '<div style="text-align:right">Total Profit</div>' +
  '</div>';

  // Rows
  html += breakdown.map(function(p){
    var marginPct = p.revenue > 0 ? (p.profit / p.revenue * 100) : 0;
    var marginColor = marginPct >= 20 ? 'var(--ok)' : marginPct >= 10 ? 'var(--wa)' : 'var(--er)';
    return '<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:6px;padding:11px 13px;border-bottom:1px solid var(--bd);align-items:center">' +
      '<div>' +
        '<div style="font-size:12px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</div>' +
        '<div style="font-size:10px;color:var(--t3);margin-top:2px">Cost ' + f$(p.unitCost) + ' → Price ' + f$(p.unitPrice) + '</div>' +
      '</div>' +
      '<div style="text-align:right">' +
        '<div style="font-size:12px;font-weight:800;color:var(--ok);font-family:var(--fm)">' + f$(p.unitPrice - p.unitCost) + '</div>' +
        '<div style="font-size:10px;font-weight:700;color:' + marginColor + ';font-family:var(--fm)">' + marginPct.toFixed(1) + '%</div>' +
      '</div>' +
      '<div style="text-align:right;font-size:13px;font-weight:700;color:var(--t1);font-family:var(--fm)">' + p.qty + '</div>' +
      '<div style="text-align:right;font-size:13px;font-weight:800;color:var(--g);font-family:var(--fm)">' + f$(p.profit) + '</div>' +
    '</div>';
  }).join('');

  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════
// REWIRED renderFinReports() — uses the new filter
// ═══════════════════════════════════════════════════════════