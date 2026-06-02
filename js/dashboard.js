function renderDash(){
  var b=biz();if(!b)return;
  var prods=b.products||[];
  var sales=(b.sales||[]).filter(function(s){ if(s.status==='deleted') return false;return s.status!=='cancelled';});
  var exps=(b.expenses||[]).filter(function(e){return e.status!=='cancelled';});
  var dn=getDailyNet(today());
  var ynDn=getDailyNet(yesterday());
  var low=prods.filter(function(p){return p.qty<=(p.lowLevel||b.lowStock||5);});
  var todaySales=sales.filter(function(s){return isToday(s.date);});
  var todayExps=exps.filter(function(e){return isToday(e.date);});
  var invVal=prods.reduce(function(a,p){return a+(p.qty||0)*(p.price||0);},0);

  // ── Hero Net ──
  var netEl=el('dn');
  if(netEl){
    netEl.textContent=f$(dn.net);
    var netColor=dn.net<0?'var(--er)':dn.net>=dn.gross*0.7?'var(--ok)':dn.net>0?'var(--wa)':'var(--er)';
    netEl.style.color=netColor;
  }
  if(el('dg'))el('dg').textContent=f$(dn.gross);
  if(el('de'))el('de').textContent=f$(dn.exp);

  // Margin pill
  var marginPct=dn.gross>0?Math.round((dn.net/dn.gross)*100):0;  // can be negative
  var mpEl=el('d-margin-pill');
  if(mpEl){
    mpEl.textContent=marginPct+'% margin';
    mpEl.style.color=marginPct>=60?'var(--ok)':marginPct>=30?'var(--wa)':'var(--er)';
  }

  // Profit bar proportions
  if(dn.gross>0){
    var expPct = Math.min((dn.exp/dn.gross)*100, 100);
    var netPct = Math.max(0, (dn.net/dn.gross)*100);
    var grossPct = Math.max(0, 100-expPct-netPct);
    if(el('pb-gross')) el('pb-gross').style.width = grossPct+'%';
    if(el('pb-exp'))   el('pb-exp').style.width   = expPct+'%';
    var netBarEl=el('pb-net');
    if(netBarEl){
      netBarEl.style.width = netPct+'%';
      // Color: green if profit>70%, amber if >30%, red if loss/low
      var nc = dn.net<0?'var(--er)':netPct>=60?'var(--ok)':netPct>=30?'var(--wa)':'var(--er)';
      netBarEl.style.background = nc;
    }
    var pblDot=el('pbl-net-dot');
    if(pblDot) pblDot.style.background = dn.net<0?'var(--er)':netPct>=60?'var(--ok)':netPct>=30?'var(--wa)':'var(--er)';
  } else if(dn.exp>0) {
    // All expenses, no sales — show full red bar
    if(el('pb-gross')) el('pb-gross').style.width='0%';
    if(el('pb-exp'))   el('pb-exp').style.width='100%';
    if(el('pb-net'))   el('pb-net').style.width='0%';
  }

  // ── KPI Cards ──
  // Today Sales: if user lacks see_all_sales, show ONLY their own sales total
  var canSeeAllSales = (typeof hasPerm === 'function') ? hasPerm('see_all_sales') : true;
  var displayedSales, displayedSalesCount;
  if (canSeeAllSales) {
    displayedSales = dn.gross;
    displayedSalesCount = todaySales.length;
  } else {
    // Filter to current user's own sales only
    var mySales = todaySales.filter(function(s){
      return CU && s.createdBy && s.createdBy === CU.id;
    });
    displayedSales = mySales.reduce(function(a,s){ return a + (typeof sTotal==='function' ? sTotal(s) : 0); }, 0);
    displayedSalesCount = mySales.length;
  }
  if(el('ks'))  el('ks').textContent = f$(displayedSales);
  if(el('ke'))  el('ke').textContent = f$(dn.exp);
  // ── Expenses breakdown (actual + allocated) ──
  try {
    var keSubEl = null;
    var keCard = document.getElementById('ke');
    if (keCard) {
      var kcard = keCard.closest('.kcard-v2');
      if (kcard) keSubEl = kcard.querySelector('.kcard-v2-sub');
    }
    // Only show 'allocated' if allocations are actually enabled
    var allocOn = (b.allocationsEnabled !== false);
    var isTodayWD = (typeof isWorkingDay === 'function') ? isWorkingDay(today()) : true;
    if (keSubEl) {
      if (!allocOn) {
        keSubEl.textContent = 'alloc off';
        keSubEl.style.color = '';
      } else if (!isTodayWD) {
        keSubEl.textContent = 'rest day · no allocation';
        keSubEl.style.color = 'var(--t3)';
      } else if (dn.allocExp > 0.01) {
        keSubEl.innerHTML = '<span style="color:var(--t3)">today · </span><span style="color:var(--wa);font-weight:700">' + f$(dn.allocExp) + ' allocated</span>';
        keSubEl.style.color = '';
      } else {
        keSubEl.textContent = 'today';
        keSubEl.style.color = '';
      }
    }
  } catch(e){}
  if(el('kiv')) el('kiv').textContent = f$(invVal);
  if(el('kl'))  el('kl').textContent = low.length;
  if(el('kp'))  el('kp').textContent = prods.length+' SKUs';
  if(el('ksc')) {
    var lbl = canSeeAllSales
      ? (displayedSalesCount + ' order' + (displayedSalesCount!==1?'s':''))
      : ('your ' + displayedSalesCount + ' sale' + (displayedSalesCount!==1?'s':''));
    el('ksc').textContent = lbl;
  }
  // Also retitle the Today Sales card label to "My Sales" when restricted
  try {
    var tsLblEl = document.querySelector('.kcard-v2-lbl');
    // We need the SPECIFIC Today Sales label. Find by walking the kcard that contains #ks
    var ksCard = document.getElementById('ks');
    if (ksCard) {
      var card = ksCard.closest('.kcard-v2');
      if (card) {
        var lblEl = card.querySelector('.kcard-v2-lbl');
        if (lblEl) lblEl.textContent = canSeeAllSales ? 'Today Sales' : 'My Sales';
      }
    }
  } catch(e){}

  // ── Trend indicators ──
  var stTrend=calcTrend(dn.gross,ynDn.gross);
  var exTrend=calcTrend(dn.exp,ynDn.exp);
  if(el('ks-trend'))el('ks-trend').innerHTML=trendHtml(stTrend);
  if(el('ke-trend'))el('ke-trend').innerHTML=trendHtml(exTrend);

  // ── Alerts ──
  var alertEl=el('dalert');
  if(alertEl){
    alertEl.innerHTML=low.length?
      '<div style="display:flex;align-items:center;gap:8px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:var(--r10);padding:9px 13px;margin-bottom:10px;font-size:12px;font-weight:700;color:var(--wa)">'+
        '<span>⚠</span> '+low.length+' item'+(low.length>1?'s':'')+' running low — <span style="cursor:pointer;text-decoration:underline;margin-left:3px" onclick="goTo(\'products\')">View Products</span></div>':
      '';
  }
  var pending=(DB.changeRequests||[]).filter(function(r){return r.bizId===CBI&&r.status==='pending';}).length;
  var reorderEl=el('reorder-banner');
  if(reorderEl){
    if(low.length){
      reorderEl.style.display='';
      reorderEl.innerHTML='<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--r10);padding:10px 14px;margin-bottom:12px">'+
        '<div style="font-size:10px;font-weight:700;color:var(--wa);text-transform:uppercase;letter-spacing:.1em;font-family:var(--fm);margin-bottom:7px">Reorder Suggestions</div>'+
        low.slice(0,4).map(function(p){return(
          '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(245,158,11,.1);color:var(--t2)">'+
            '<span>'+esc(p.name)+'</span>'+
            '<span style="color:var(--wa);font-weight:700;font-family:var(--fm)">'+p.qty+' '+p.unit+' left</span>'+
          '</div>');}).join('')+
      '</div>';
    }else reorderEl.style.display='none';
  }

  // ── Quick Actions ──
  // For admin/primaryAdmin: ALWAYS show ALL 6 quick actions, ignore canAccess.
  // For staff: respect canAccess + hasPerm.
  var qa=[];
  var __isAdminUser = (CU && (CU.role === 'primaryAdmin' || CU.role === 'admin'));
  if(__isAdminUser || canAccess('sales'))     qa.push({i:'🛒',l:'New Sale',    f:'openNewSale()',    bg:'rgba(34,197,94,.12)',  glow:'rgba(34,197,94,.12)'});
  if(__isAdminUser || canAccess('products'))  qa.push({i:'➕',l:'Add Product', f:'openAddProd()',    bg:'var(--gd)',             glow:'rgba(232,160,32,.12)'});
  if(__isAdminUser || canAccess('expenses'))  qa.push({i:'💸',l:'Add Expense', f:'openAddExp()',     bg:'rgba(239,68,68,.12)',  glow:'rgba(239,68,68,.12)'});
  if(__isAdminUser || canAccess('stock'))     qa.push({i:'📥',l:'Stock In',    f:'openStockIn()',    bg:'rgba(79,195,247,.12)', glow:'rgba(79,195,247,.12)'});
  // 5th action: admins ALWAYS get Daily Report (pending admin badge logic only adds to badge)
  qa.push({i:'📊',l:'Daily Report',f:'openDailyReport()',bg:'rgba(168,85,247,.12)',glow:'rgba(168,85,247,.12)',badge:(__isAdminUser&&pending>0?pending:0)});
  qa.push({i:'📐',l:'Tile Calc',   f:"goTo('calc')",      bg:'rgba(245,158,11,.12)',glow:'rgba(245,158,11,.12)'});

  var qgEl=el('qg');
  if(qgEl)qgEl.innerHTML=qa.slice(0,6).map(function(a){
    return '<div class="qa-btn" style="--qa-glow:'+a.glow+'" onclick="'+a.f+'">'+
      (a.badge?'<div class="qa-badge">'+a.badge+'</div>':'')+
      '<div class="qa-icon" style="background:'+a.bg+'">'+a.i+'</div>'+
      '<div class="qa-lbl">'+a.l+'</div>'+
    '</div>';
  }).join('');

  // ── Activity Feed (sales + expenses merged, today only) ──
  var recentSales=[...todaySales].sort(function(a,b){return b.id-a.id;}).slice(0,4);
  var drsEl=el('drs');
  if(drsEl){
    if(recentSales.length){
      drsEl.innerHTML=
        '<div style="padding:4px 0 2px;font-size:9px;font-weight:700;color:var(--g);text-transform:uppercase;letter-spacing:.14em;font-family:var(--fm);padding:8px 16px 4px">Sales</div>'+
        recentSales.map(function(s){
          var due=sDue(s);var st=sSt(s);
          var stDot=st==='PAID'?'var(--ok)':st==='PARTIAL'?'var(--wa)':'var(--er)';
          return '<div class="activity-item" onclick="viewReceipt('+s.id+')">'+
            '<div class="act-dot" style="background:var(--gd)">🧾</div>'+
            '<div class="act-body">'+
              '<div class="act-name">'+esc(s.customer||'Walk-in')+'</div>'+
              '<div class="act-meta">'+esc(s.inv||'')+(s.contact?' · 📞 '+esc(s.contact):'')+'</div>'+
            '</div>'+
            '<div class="act-right">'+
              '<div class="act-amount" style="color:var(--g)">'+f$(sTotal(s))+'</div>'+
              '<div class="act-time"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+stDot+';margin-right:3px;vertical-align:middle"></span>'+st+'</div>'+
            '</div>'+
          '</div>';
        }).join('');
    }else{
      drsEl.innerHTML='<div style="padding:14px 16px;font-size:12px;color:var(--t3);text-align:center">No sales today yet</div>';
    }
  }

  var dreEl=el('dre');
  if(dreEl){
    if(todayExps.slice(0,3).length){
      dreEl.innerHTML=
        '<div style="border-top:1px solid rgba(255,255,255,.04);padding:8px 16px 4px;font-size:9px;font-weight:700;color:var(--er);text-transform:uppercase;letter-spacing:.14em;font-family:var(--fm)">Expenses</div>'+
        todayExps.slice(0,3).map(function(e){
          return '<div class="activity-item">'+
            '<div class="act-dot" style="background:rgba(239,68,68,.12)">💸</div>'+
            '<div class="act-body">'+
              '<div class="act-name">'+esc(e.description)+'</div>'+
              '<div class="act-meta">'+esc(e.category||'General')+'</div>'+
            '</div>'+
            '<div class="act-right">'+
              '<div class="act-amount" style="color:var(--er)">−'+f$(e.amount)+'</div>'+
            '</div>'+
          '</div>';
        }).join('');
    }else{
      dreEl.innerHTML='';
    }
  }

  // ── Chart & topbar ──
  renderWeekChart();
  updateTopbar();

  // ── PERMISSION ENFORCEMENT ──
  if (typeof enforceDashboardPerms === 'function') enforceDashboardPerms();
}


// ── SALES ──
function fillSalesSummary() {
  const b = biz(); if (!b) return;
  // SELL AGENT FILTER — only own sales count when user lacks see_all_sales
  const restrictToOwn = typeof hasPerm === 'function' && CU && !hasPerm('see_all_sales');
  const s = (b.sales || []).filter(x => {
    if (x.status === 'cancelled') return false;
    if (restrictToOwn && CU && x.createdBy && x.createdBy !== CU.id) return false;
    return true;
  });
  const ts = arr => arr.reduce((a, s) => a + sTotal(s), 0);
  const td = s.filter(x => isToday(x.date));
  const tw = s.filter(x => isWeek(x.date));
  const tm = s.filter(x => isMon(x.date));
  el('sst').textContent  = f$(ts(td));
  el('ssw').textContent  = f$(ts(tw));
  el('ssm').textContent  = f$(ts(tm));
  el('sst-c').textContent = td.length + ' order' + (td.length !== 1 ? 's' : '');
  el('ssw-c').textContent = tw.length + ' order' + (tw.length !== 1 ? 's' : '');
  el('ssm-c').textContent = tm.length + ' order' + (tm.length !== 1 ? 's' : '');
}

// ── FILTER TABS ──

function setSF(f, e) {
  saleFilter = f;
  document.querySelectorAll('.stab').forEach(c => c.classList.remove('on'));
  if (e) e.classList.add('on');
  renderSales();
}

// ── RENDER SALES LIST ──

function renderSales() {
  const b = biz(); if (!b) return;
  fillSalesSummary();
  const q = (gv('sq') || '').toLowerCase();
  // SELL AGENT FILTER — restrict to own sales when user lacks see_all_sales
  const restrictToOwn = typeof hasPerm === 'function' && CU && !hasPerm('see_all_sales');
  let sales = (b.sales || []).filter(s => {
    if (s.status === 'cancelled') return false;
    if (restrictToOwn && CU && s.createdBy && s.createdBy !== CU.id) return false;
    const mq = !q ||
      (s.customer || '').toLowerCase().includes(q) ||
      (s.inv || '').toLowerCase().includes(q) ||
      (s.contact || '').includes(q) ||
      (s.items || []).some(i => i.name.toLowerCase().includes(q));
    const mf =
      saleFilter === 'all' ||
      (saleFilter === 'today'  && isToday(s.date)) ||
      (saleFilter === 'week'   && isWeek(s.date)) ||
      (saleFilter === 'month'  && isMon(s.date)) ||
      (saleFilter === 'credit' && sSt(s) !== 'PAID');
    return mq && mf;
  }).sort((a, b) => b.id - a.id);

  const wrap = el('slist'); if (!wrap) return;

  if (!sales.length) {
    wrap.innerHTML = emS(
      '🛒', 'No Sales Yet',
      saleFilter === 'all'
        ? 'Tap the cart button below to create your first sale.'
        : 'No sales match this filter.',
      saleFilter === 'all'
        ? '<button type="button" class="btn bg bsm" onclick="openNewSale()">+ New Sale</button>'
        : ''
    );
    return;
  }

  wrap.innerHTML = sales.map(s => buildSaleCard(s)).join('');
}

function openEditSale(saleId) {
  const b = biz();
  const s = (b.sales || []).find(x => x.id === saleId);
  if (!s) return;
  if (isRecordLocked(s) && !isAdmin() && !s.adminUnlocked) {
    openRecordChangeRequest('sale', saleId, s.inv || 'Sale #' + saleId);
    return;
  }
  if (!isAdmin()) { toast('Admin access required to edit sales', 'er'); return; }

  // ── OPEN NEW SALE DRAWER pre-loaded with this sale's data ──
  function doOpenEdit() {
    editingSaleId = saleId;

    // Load cart items from the existing sale
    cartItems = (s.items || []).map(function(it) {
      return {
        prodId:    it.prodId,
        name:      it.name,
        qty:       it.qty,
        unitPrice: it.unitPrice,
        cost:      it.cost || 0,
        unit:      it.unit || 'Box',
        maxQty:    it.maxQty || 9999,
        category:  it.category || ''
      };
    });

    // Pre-fill header fields
    sv('sinv',  s.inv  || '');
    sv('sdate', s.date || today());
    sv('scust', s.customer || '');
    sv('scont', s.contact  || '');
    sv('sdisc', s.discount || '0');
    sv('spaid', s.paid     || '');

    // Set payment mode
    currentPayMode = s.paymode || 'Cash';
    var payBtns = document.querySelectorAll('.pay-mode-btn');
    payBtns.forEach(function(btn) {
      btn.classList.toggle('on', btn.dataset.mode === currentPayMode);
    });

    // Update the drawer title and subtitle
    var titleEl = document.querySelector('#d-sale .dtitle');
    var subEl   = document.querySelector('#d-sale .dsub');
    if (titleEl) titleEl.textContent = 'Edit Sale';
    if (subEl)   subEl.textContent   = (s.inv || 'Sale') + ' · ' + (s.customer || 'Walk-in') + ' — Admin Edit';

    // Change Complete Sale button to "Save Changes"
    var completeBtn = document.getElementById('complete-sale-btn');
    if (completeBtn) {
      completeBtn.textContent = '💾 Save Changes';
      completeBtn.style.background = '';
    }

    // Render cart and product grid
    renderCart();
    renderQuickProdGrid();
    updateCart();

    openD('d-sale');
  }

  // Skip PIN if within 3-hour grace window
  if (isAdmin() && !isRecordLocked(s)) {
    doOpenEdit();
    setTimeout(() => el('es-reason')?.focus(), 300);
    return;
  }
  requireAdminPin(
    () => { openD('d-editsale'); setTimeout(() => el('es-reason')?.focus(), 300); },
    null,
    `Edit Sale ${s.inv} — enter admin password (locked: older than ${RECORD_LOCK_HRS}h)`
  );
}

// ── SAVE EDITED SALE ──

function saveEditSale() {
  if (!isAdmin()) { toast('Admin access required', 'er'); return; }
  const b = biz();
  const s = (b.sales || []).find(x => x.id === editingSaleId);
  if (!s) return;
  const reason = gv('es-reason');
  if (!reason) { toast('Reason for edit is required', 'er'); return; }
  const before = { customer: s.customer, contact: s.contact, paymode: s.paymode, paid: s.paid, discount: s.discount };
  s.customer = gv('es-cust') || s.customer;
  s.contact  = gv('es-contact');
  s.paymode  = el('es-paymode')?.value || s.paymode;
  s.paid     = parseFloat(el('es-paid')?.value) || s.paid;
  s.discount = parseFloat(el('es-disc')?.value) || 0;
  s.due      = Math.max(0, sTotal(s) - (s.paid || 0));
  s.payStatus = sSt(s);
  s.updatedAt = Date.now();
  if (!s.editLog) s.editLog = [];
  s.editLog.push({ by: CU.name, at: Date.now(), reason, before });
  addAdminLog('edit_sale', `Edited Sale ${s.inv}: ${reason}`, CU.name);
  dbSave();
  closeD('d-editsale');
  renderSales();
  renderDash();
  toast('Sale updated', 'ok');
}

// ══════════════════════════════════════════════════════════
//  NEW SALE — OPEN
// ══════════════════════════════════════════════════════════

function deleteSale(saleId) {
  const b = biz();
  const s = (b.sales || []).find(x => x.id === saleId);
  if (!s) return;

  if (isRecordLocked(s) && !isAdmin() && !s.adminUnlocked) {
    openRecordChangeRequest('sale', saleId, s.inv || 'Sale #' + saleId);
    const a = el('rec-cr-action'); if (a) a.value = 'delete';
    return;
  }
  if (!canAccess('sales') && !isAdmin()) { toast('No access', 'er'); return; }

  // Require admin PIN before deleting
  requireAdminPin(function(){
    showConf('🗑️', 'Delete Sale?',
    'Delete ' + esc(s.inv || 'Sale #' + saleId) + ' — ' + esc(s.customer || 'Walk-in') + ' — ' + f$(sTotal(s)) + '? Stock quantities will be restored.',
    function(){
      // Soft delete — moves to recycle bin for 30 days
      var saleToDelete = (b.sales || []).find(function(x){ return x.id === saleId; });
      if (saleToDelete) { softDelete(saleToDelete); }
      (s.items || []).forEach(function(item) {
        var p = (b.products || []).find(function(x){ return x.id === item.prodId; });
        if (p) p.qty += item.qty;
      });
      addAdminLog('del_sale', 'Deleted Sale ' + (s.inv || saleId) + ' · ' + s.customer + ' · ' + f$(sTotal(s)), CU.name);
      dbSave();
      renderSales();
      renderProducts();
      renderDash();
      toast('Sale deleted');
    }
  );
  }, null, 'Delete Sale — enter admin PIN to confirm');
}

// ── OPEN EDIT SALE (admin) ──

function openNewSale() {
  if (!canAccess('sales')) { toast('No access to sales', 'er'); return; }
  const b = biz(); if (!b) return;

  // Reset state
  cartItems = [];
  currentPayMode = 'Cash';
  editingSaleId = null;

  // Set invoice number and date
  sv('sinv', 'INV-' + String(b.nextSaleId || 1).padStart(4, '0'));
  sv('sdate', today());

  // Clear fields
  ['scust', 'scont', 'spaid'].forEach(id => sv(id, ''));
  sv('sdisc', '0');
  sv('spay', 'Cash');

  // Reset payment mode buttons
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.pay === 'Cash');
  });
  var padw = el('paid-amount-wrap'); if (padw) padw.style.display = '';

  // Set title
  el('sale-dr-ttl').textContent = 'New Sale';

  // Start in quick grid mode
  saleMode = 'quick';
  const qg  = el('quick-prod-grid');
  const sw  = el('sale-search-wrap');
  const btn = el('sale-mode-btn');
  if (qg)  qg.style.display  = '';
  if (sw)  sw.style.display  = 'none';
  if (btn) btn.textContent   = '🔍 Search';

  // Render components
  renderCart();
  renderQuickProdGrid();
  updateCart();

  openD('d-sale');
  setTimeout(() => el('scust')?.focus(), 300);
}

// ── PAYMENT MODE SELECTION ──

function renderSaleSearch() {
  const b = biz(); if (!b) return;
  const q   = (gv('spsq') || '').toLowerCase();
  const res = el('spres'); if (!res) return;
  if (!q) { res.style.display = 'none'; return; }

  const prods = (b.products || [])
    .filter(function(p){ return p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q); })
    .slice(0, 8);

  if (!prods.length) {
    res.style.display = '';
    res.innerHTML = '<div style="padding:12px;text-align:center;font-size:12px;color:var(--t3)">No products found</div>';
    return;
  }
  res.style.display = '';
  res.innerHTML = prods.map(function(p) {
    var oos      = p.qty <= 0;
    var _imgSrc  = getProductImgSrc(p); var imgHtml = _imgSrc ? '<img src="' + _imgSrc + '" style="width:100%;height:100%;object-fit:cover">' : (CATI[p.category]||'📦');
    var clickEvt = oos ? '' : ' onclick="addToCart(' + p.id + ')"';
    var stockStr = oos ? 'OUT OF STOCK' : p.qty + ' in stock';
    var stockClr = oos ? 'var(--er)' : 'var(--t3)';
    return '<div class="psearch-item"' + (oos ? ' style="opacity:.5;pointer-events:none"' : '') + clickEvt + '>' +
      '<div class="psearch-thumb">' + imgHtml + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="psearch-name">' + esc(p.name) + '</div>' +
        '<div style="font-size:10px;color:var(--t3)">' + esc(p.category) + ' · ' + esc(p.unit) + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
        '<div class="psearch-price">' + f$(p.price) + '</div>' +
        '<div class="psearch-stock" style="color:' + stockClr + '">' + stockStr + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  CART MANAGEMENT
// ══════════════════════════════════════════════════════════

function addToCart(id) {
  const b = biz();
  const p = (b.products || []).find(x => x.id === id);
  if (!p) return;

  // ── NO STOCK GATE — allow adding even out-of-stock items (qty can go negative) ──
  const existing = cartItems.find(c => c.prodId === id);
  if (existing) {
    existing.qty++;
  } else {
    cartItems.push({
      prodId:    id,
      name:      p.name,
      qty:       1,
      unitPrice: p.price,
      cost:      p.cost || 0,
      unit:      p.unit,
      maxQty:    p.qty,   // kept for reference only
      category:  p.category
    });
  }

  // Clear search and close results
  if (saleMode === 'search') {
    sv('spsq', '');
    var res = el('spres'); if (res) res.style.display = 'none';
  }

  renderCart();
  renderQuickProdGrid(); // update in-cart highlights
  toast(p.name + ' added', 'gd');
}

// ── +/- button helpers — always read CURRENT field value ──
function cartInc(i) {
  var inp = el('qty-' + i);
  var cur = inp ? (parseInt(inp.value) || 1) : (cartItems[i] ? cartItems[i].qty : 1);
  updateCartItemQty(i, cur + 1);
}
function cartDec(i) {
  var inp = el('qty-' + i);
  var cur = inp ? (parseInt(inp.value) || 1) : (cartItems[i] ? cartItems[i].qty : 1);
  if (cur > 1) updateCartItemQty(i, cur - 1);
}

function updateCartItemQty(i, val) {
  const item = cartItems[i]; if (!item) return;
  let q = parseInt(val);
  if (isNaN(q) || q < 1) {
    q = 1;
  }
  // ── NO STOCK LIMIT — allow any quantity; stock will go negative ──
  item.qty = q;
  const inp = el('qty-' + i); if (inp) inp.value = q;
  const totalEl = el('line-total-' + i);
  if (totalEl) totalEl.textContent = f$(item.qty * item.unitPrice);
  updateCart();
  renderQuickProdGrid();
}

function updateCartItemPrice(i, val) {
  const item = cartItems[i]; if (!item) return;
  const p = parseFloat(val);
  if (isNaN(p) || p < 0) return;
  item.unitPrice = p;
  const totalEl = el('line-total-' + i);
  if (totalEl) totalEl.textContent = f$(item.qty * item.unitPrice);
  updateCart();
}

function removeCartItem(i) {
  cartItems.splice(i, 1);
  renderCart();
  renderQuickProdGrid();
  updateCart();
}

function renderCart() {
  const wrap = el('cartitems'); if (!wrap) return;
  const cnt  = el('cart-count');

  if (!cartItems.length) {
    wrap.innerHTML =
      '<div class="cart-empty">' +
      '<div class="cart-empty-icon">🛒</div>' +
      '<div class="cart-empty-txt">Cart is empty</div>' +
      '<div class="cart-empty-sub">Tap a product above to add it</div>' +
      '</div>';
    if (cnt) cnt.textContent = '0 items';
    updateCart();
    return;
  }

  if (cnt) cnt.textContent = cartItems.length + ' item' + (cartItems.length !== 1 ? 's' : '');

  wrap.innerHTML = cartItems.map(function(item, i) {
    var lineTotal = f$(item.qty * item.unitPrice);
    var name = esc(item.name);
    return '<div class="cart-v2-item">' +
      '<div class="cart-v2-left">' +
        '<div class="cart-v2-name">' + name + '</div>' +
        '<div class="cart-v2-unit">' +
          '<span class="cart-unit-lbl">Unit price:</span>' +
          '<input class="cart-price-field" id="price-' + i + '" type="number"' +
            ' value="' + item.unitPrice.toFixed(2) + '" min="0" step="0.01"' +
            ' onchange="updateCartItemPrice(' + i + ',this.value)"' +
            ' oninput="updateCartItemPrice(' + i + ',this.value)"' +
            ' onclick="this.select()">' +
        '</div>' +
      '</div>' +
      '<div class="cart-v2-controls">' +
        '<div class="qty-btn" onclick="cartDec(' + i + ')">−</div>' +
        '<input class="qty-field" id="qty-' + i + '" type="number"' +
          ' value="' + item.qty + '" min="1" inputmode="numeric"' +
          ' onchange="updateCartItemQty(' + i + ',this.value)"' +
          ' oninput="updateCartItemQty(' + i + ',this.value)"' +
          ' onclick="this.select()">' +
        '<div class="qty-btn" onclick="cartInc(' + i + ')">+</div>' +
      '</div>' +
      '<div class="cart-v2-total" id="line-total-' + i + '">' + lineTotal + '</div>' +
      '<div class="cart-v2-del" onclick="removeCartItem(' + i + ')" title="Remove">✕</div>' +
    '</div>';
  }).join('');

  updateCart();
}

function updateCart() {
  var sub  = cartItems.reduce(function(a,b){ return a + b.qty * b.unitPrice; }, 0);
  var disc = parseFloat(el('sdisc') ? el('sdisc').value : 0) || 0;
  var tot  = Math.max(0, sub - disc);
  var paid = currentPayMode === 'Credit' ? 0 : (parseFloat(el('spaid') ? el('spaid').value : 0) || 0);
  var due  = Math.max(0, tot - paid);
  var st   = due <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'CREDIT';

  if (el('csub'))   el('csub').textContent  = f$(sub);
  if (el('ctotal')) el('ctotal').textContent = f$(tot);

  var dueWrap = el('cart-due-wrap');
  var dueEl   = el('cdue');
  var bdgEl   = el('cpbdg');

  // Always show the due row so user can track status
  if (dueWrap) dueWrap.style.display = '';
  if (dueEl) {
    dueEl.textContent = 'Due: ' + f$(due);
    dueEl.style.color = due <= 0 ? 'var(--ok)' : due < tot ? 'var(--wa)' : 'var(--er)';
  }
  if (bdgEl) {
    bdgEl.innerHTML = st === 'PAID'
      ? '<span class="sb-paid">\u2713 PAID</span>'
      : st === 'PARTIAL'
      ? '<span class="sb-partial">&#9681; PARTIAL</span>'
      : '<span class="sb-credit">&#9675; CREDIT</span>';
  }

  // Enable/disable complete button
  var btn = el('complete-sale-btn');
  if (btn) btn.disabled = cartItems.length === 0;
}

// ══════════════════════════════════════════════════════════
//  COMPLETE SALE
// ══════════════════════════════════════════════════════════

function completeSale() {
  const b = biz(); if (!b) return;

  // ── Validation ──
  if (!cartItems.length) { toast('Cart is empty — add products first', 'er'); return; }
  const inv = gv('sinv');
  if (!inv) { toast('Invoice number is required', 'er'); return; }

  // Check for duplicate invoice (skip current sale in edit mode)
  if ((b.sales || []).some(s => s.inv === inv && s.status !== 'cancelled' && s.id !== editingSaleId)) {
    toast('Invoice ' + inv + ' already exists', 'er');
    return;
  }

  // Stock check removed — overselling allowed, stock goes negative

  const customer = (gv('scust') || 'Walk-in').trim();
  const contact  = gv('scont');
  const date     = el('sdate')?.value || today();
  const paymode  = currentPayMode;
  const disc     = parseFloat(el('sdisc')?.value) || 0;
  const sub      = cartItems.reduce((a, b) => a + b.qty * b.unitPrice, 0);
  const total    = Math.max(0, sub - disc);
  const paid     = paymode === 'Credit' ? 0 : (parseFloat(el('spaid')?.value) || total);
  const due      = Math.max(0, total - paid);
  const st       = due <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'CREDIT';
  const now      = Date.now();

  const sale = {
    id:         b.nextSaleId || 1,
    inv,
    date,
    customer,
    contact,
    paymode,
    discount:   disc,
    subtotal:   sub,
    total,
    paid,
    due,
    payStatus:  st,
    items:      cartItems.map(c => ({
      prodId:    c.prodId,
      name:      c.name,
      qty:       c.qty,
      unitPrice: c.unitPrice,
      cost:      c.cost || 0,
      total:     c.qty * c.unitPrice
    })),
    createdAt:  now,
    updatedAt:  now,
    status:     'active',
    editLog:    [],
    createdBy:     (CU ? CU.id : null),
    createdByName: (CU ? (CU.name || CU.username) : 'System'),
    fulfillments:  [],
    fulStatus:     'Pending',
    assignedStaff: ''
  };

  // ── EDIT MODE: update existing sale ──
  if (editingSaleId !== null) {
    var existingSale = (b.sales||[]).find(function(x){ return x.id === editingSaleId; });
    if (existingSale) {
      // Restore old stock first
      (existingSale.items||[]).forEach(function(it){
        var pr=(b.products||[]).find(function(x){return x.id===it.prodId;});
        if(pr){ pr.qty+=it.qty; if(pr.qty>=0) pr.wentNegativeAt=null; }
      });
      // Update sale fields
      existingSale.date=date; existingSale.customer=customer; existingSale.contact=contact;
      existingSale.paymode=paymode; existingSale.discount=disc; existingSale.subtotal=sub;
      existingSale.total=total; existingSale.paid=paid; existingSale.due=due;
      existingSale.payStatus=st; existingSale.updatedAt=now; existingSale.updatedBy=CU?CU.name:'Unknown';
      existingSale.items=sale.items;
      if(!existingSale.editLog) existingSale.editLog=[];
      existingSale.editLog.push({at:now,by:CU?CU.name:'Unknown',action:'full_cart_edit'});
      // Deduct new stock
      sale.items.forEach(function(item){
        var p=(b.products||[]).find(function(x){return x.id===item.prodId;});
        if(p){var prev=p.qty;p.qty-=item.qty;if(p.qty<0&&prev>=0)p.wentNegativeAt=Date.now();if(p.qty>=0)p.wentNegativeAt=null;}
      });
    }
  } else {
    // ── CREATE MODE: new sale ──
    if (!b.sales) b.sales = [];
    b.sales.unshift(sale);
    b.nextSaleId = (b.nextSaleId || 1) + 1;

    // Reduce stock
    sale.items.forEach(item => {
      const p = (b.products || []).find(x => x.id === item.prodId);
      if (p) {
          var prevQty2 = p.qty;
          p.qty = p.qty - item.qty;  // allow negative
          if (p.qty < 0 && prevQty2 >= 0) p.wentNegativeAt = Date.now();
          if (p.qty >= 0) p.wentNegativeAt = null;
        }
      // Stock history
      if (!b.stockHistory) b.stockHistory = [];
      if (!b.nextHistId) b.nextHistId = 1;
      b.stockHistory.unshift({
        id: b.nextHistId++,
        date,
        type:     'SALE',
        prodName: item.name,
        qty:      -item.qty,
        by:       CU?.name || 'unknown',
        ref:      inv,
        notes:    customer,
        ts:       now
      });
    });
  }

  // Auto-create credit record if needed
  if (due > 0) {
    if (!b.credits) b.credits = [];
    const existing = b.credits.find(c => c.name.toLowerCase() === customer.toLowerCase() && c.status !== 'SETTLED');
    if (existing) {
      existing.totalOwed += due;
    } else {
      if (!b.nextCrId) b.nextCrId = 1;
      b.credits.push({ id: b.nextCrId++, name: customer, ref: inv, date, totalOwed: due, totalPaid: 0, paymode, status: 'OPEN', payments: [], contact });
    }
  }

  // Auto-create customer if new
  if (customer !== 'Walk-in' && !(b.customers || []).find(c => c.name.toLowerCase() === customer.toLowerCase())) {
    if (!b.customers)  b.customers  = [];
    if (!b.nextCustId) b.nextCustId = 1;
    b.customers.push({ id: b.nextCustId++, name: customer, phone: contact || '', email: '', address: '', notes: 'Added via sale', createdAt: now });
  }

  addAdminLog('sale', 'Sale ' + inv + ' · ' + customer + ' · ' + f$(total) + ' · ' + st, CU ? CU.name : 'system');

  dbSave();
  // Reset drawer
  var _titleEl = document.querySelector('#d-sale .dtitle');
  var _subEl   = document.querySelector('#d-sale .dsub');
  var _btn     = document.getElementById('complete-sale-btn');
  if(_titleEl) _titleEl.textContent='New Sale';
  if(_subEl)   _subEl.textContent='Add products to cart';
  if(_btn)     _btn.textContent='✓ Complete Sale';
  var _wasEdit = (editingSaleId !== null);
  var _saleId  = _wasEdit ? editingSaleId : (b.sales && b.sales[0] ? b.sales[0].id : null);
  editingSaleId = null;
  cartItems = [];
  closeD('d-sale');
  toast(_wasEdit ? ('✅ Sale ' + inv + ' updated — ' + f$(total)) : ('Sale ' + inv + ' completed — ' + f$(total)), 'gd');
  renderSales();
  renderProducts();
  renderDash();
  // Show receipt
  if(_saleId) setTimeout(function(){ viewReceipt(_saleId); }, 400);
}

// ── PRODUCTS (8-hour lock system) ──