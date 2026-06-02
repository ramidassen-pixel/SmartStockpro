function renderFinReports() {
  var b = biz();
  if (!b) {var _fw=el('fin-body');if(_fw)_fw.innerHTML='<div style="padding:30px;text-align:center"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-weight:700;color:var(--t1)">Loading data...</div><div style="font-size:12px;color:var(--t3);margin-top:6px">If stuck: tap More → Sync → Reconnect</div></div>';return;}
  var wrap = el('fin-body');
  if (!wrap) return;

  // Apply active filter
  var allSales = applyFinFilterToSales(b.sales || []);
  var allExps  = applyFinFilterToExpenses(b.expenses || []);

  var grossRev   = allSales.reduce(function(a,s){ return a + sTotal(s); }, 0);
  var actualExp  = allExps.reduce(function(a,e){ return a + (parseFloat(e.amount) || 0); }, 0);
  var totalProfit= allSales.reduce(function(a,s){ return a + calcProfitForSale(s).profit; }, 0);

  // ── Add doc + salary allocations across filter period (if enabled) ──
  var allocEnabled = (b.allocationsEnabled !== false);
  var allocExp = 0;
  if (allocEnabled && typeof getFinFilterDateRange === 'function') {
    var range = getFinFilterDateRange();
    if (range && range.start && range.end) {
      var cur = new Date(range.start + 'T00:00:00');
      var endD = new Date(range.end + 'T00:00:00');
      while (cur <= endD) {
        var iso = cur.toISOString().split('T')[0];
        if (typeof getDayAllocations === 'function') {
          var a = getDayAllocations(iso);
          allocExp += (a && a.total) || 0;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  var totalExp   = actualExp + allocExp;
  var netProfit  = totalProfit - totalExp;
  var totalMargin= grossRev > 0 ? (totalProfit / grossRev * 100) : 0;

  // Build the page based on tab
  var html = '';

  if (finTab === 'profit') {
    // Dedicated profit analysis tab
    html += renderProfitBreakdownSection(allSales) ||
      '<div class="card" style="padding:30px;text-align:center;color:var(--t3)">No sales in this period. Add cost prices to products to track profit.</div>';
  }
  else if (finTab === 'pl') {
    // P&L tab — show profit breakdown at top, then traditional P&L
    var profitSection = renderProfitBreakdownSection(allSales);
    if (profitSection) html += profitSection;

    html += '<div class="card">' +
      '<div class="pl-row"><span>Gross Revenue</span><span class="c-ok fw7">' + f$(grossRev) + '</span></div>' +
      '<div class="pl-row"><span>Product Cost</span><span class="c-er fw7">' + f$(grossRev - totalProfit) + '</span></div>' +
      '<div class="pl-row"><span>Gross Profit</span><span class="c-ok fw7">' + f$(totalProfit) + ' (' + totalMargin.toFixed(1) + '%)</span></div>' +
      (allocExp > 0.01
        ? ('<div class="pl-row" style="font-size:12px;color:var(--t3)"><span style="padding-left:10px">↳ Cash Expenses</span><span>' + f$(actualExp) + '</span></div>' +
           '<div class="pl-row" style="font-size:12px;color:var(--wa)"><span style="padding-left:10px">↳ 📋 Allocated (docs + salaries)</span><span>' + f$(allocExp) + '</span></div>')
        : '') +
      '<div class="pl-row"><span>Operating Expenses</span><span class="c-er fw7">' + f$(totalExp) + '</span></div>' +
      '<div class="pl-row total"><span>NET PROFIT</span><span style="color:' + (netProfit >= 0 ? 'var(--ok)' : 'var(--er)') + '">' + (netProfit >= 0 ? '+' : '') + f$(netProfit) + '</span></div>' +
    '</div>';

    html += '<div class="card" style="margin-top:10px;padding:14px">' +
      '<div class="sh" style="margin-bottom:8px">Transactions (' + allSales.length + ')</div>' +
      (allSales.length
        ? allSales.slice(0, 8).map(function(s){
            return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bd);font-size:12px;color:var(--t2)">' +
              '<span>' + esc(s.customer || 'Walk-in') + ' · ' + esc(s.inv || '') + '</span>' +
              '<span class="fw7 c-g">' + f$(sTotal(s)) + '</span>' +
            '</div>';
          }).join('') + (allSales.length > 8 ? '<div style="text-align:center;padding:8px 0;font-size:11px;color:var(--t3)">+' + (allSales.length - 8) + ' more</div>' : '')
        : '<div style="text-align:center;padding:20px;color:var(--t3);font-size:12px">No transactions in this period</div>') +
    '</div>';
  }
  else if (finTab === 'cat') {
    // Sales by category
    var byCat = {};
    allSales.forEach(function(s){
      (s.items || []).forEach(function(it){
        var prod = (b.products || []).find(function(p){ return p.id === it.prodId; });
        var c = prod ? (prod.category || 'Other') : 'Unknown';
        if (!byCat[c]) byCat[c] = { rev: 0, profit: 0, qty: 0 };
        var p = calcProfitForItem(it);
        byCat[c].rev    += p.price * p.qty;
        byCat[c].profit += p.total;
        byCat[c].qty    += p.qty;
      });
    });
    var cats = Object.keys(byCat).sort(function(a,b){ return byCat[b].rev - byCat[a].rev; });
    if (!cats.length) {
      html += '<div class="card" style="padding:30px;text-align:center;color:var(--t3)">No sales by category yet</div>';
    } else {
      html += '<div class="card" style="padding:0;overflow:hidden">' +
        '<div style="padding:11px 14px;background:var(--s2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--fm)">Sales by Category</div>';
      html += cats.map(function(c){
        var pct = grossRev > 0 ? (byCat[c].rev / grossRev * 100) : 0;
        return '<div style="padding:12px 14px;border-bottom:1px solid var(--bd)">' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
            '<span style="font-size:13px;font-weight:700;color:var(--t1)">' + esc(c) + '</span>' +
            '<span style="font-size:13px;font-weight:800;color:var(--g);font-family:var(--fm)">' + f$(byCat[c].rev) + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-bottom:5px">' +
            '<span>' + byCat[c].qty + ' sold · ' + pct.toFixed(1) + '%</span>' +
            '<span class="c-ok">Profit: ' + f$(byCat[c].profit) + '</span>' +
          '</div>' +
          '<div style="height:5px;background:var(--s2);border-radius:99px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--g),var(--g3))"></div>' +
          '</div>' +
        '</div>';
      }).join('');
      html += '</div>';
    }
  }
  else if (finTab === 'cust') {
    // Top customers
    var byCust = {};
    allSales.forEach(function(s){
      var name = s.customer || 'Walk-in';
      if (!byCust[name]) byCust[name] = { rev: 0, count: 0, profit: 0 };
      byCust[name].rev    += sTotal(s);
      byCust[name].count++;
      byCust[name].profit += calcProfitForSale(s).profit;
    });
    var customers = Object.keys(byCust).sort(function(a,b){ return byCust[b].rev - byCust[a].rev; });
    if (!customers.length) {
      html += '<div class="card" style="padding:30px;text-align:center;color:var(--t3)">No customer sales yet</div>';
    } else {
      html += '<div class="card" style="padding:0;overflow:hidden">' +
        '<div style="padding:11px 14px;background:var(--s2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--fm)">Top Customers</div>';
      html += customers.slice(0, 20).map(function(name, i){
        return '<div style="padding:11px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:11px">' +
          '<div class="av" style="width:34px;height:34px;font-size:12px;flex-shrink:0">' + esc(mkInit(name)) + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:13px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(name) + '</div>' +
            '<div style="font-size:11px;color:var(--t3)">' + byCust[name].count + ' orders · profit ' + f$(byCust[name].profit) + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            '<div style="font-size:13px;font-weight:800;color:var(--g);font-family:var(--fm)">' + f$(byCust[name].rev) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      html += '</div>';
    }
  }

  wrap.innerHTML = html;
}

// Switch between tabs
function switchFinTab(tab) {
  finTab = tab;
  ['pl','cat','cust','profit'].forEach(function(t){
    var c = el('rpt-tab-' + t);
    if (c) c.classList.toggle('on', t === tab);
  });
  renderFinReports();
}

// ═══════════════════════════════════════════════════════════
// EXPORT FILTERED RESULTS TO EXCEL
// ═══════════════════════════════════════════════════════════
function exportFilteredReport_protected() {
  protectedExport(function(){ exportFilteredReport_raw(); }, 'Financial Report Export');
}
function exportFilteredReport_raw() {
  if (typeof XLSX === 'undefined') { toast('Excel library not loaded', 'er'); return; }
  var b = biz();
  if (!b) return;
  var sales = applyFinFilterToSales(b.sales || []);
  if (!sales.length) { toast('No data to export with current filter', 'er'); return; }

  // Sheet 1: Sales
  var salesData = sales.map(function(s){
    var p = calcProfitForSale(s);
    return {
      Invoice: s.inv || '',
      Date: s.date || '',
      Customer: s.customer || 'Walk-in',
      Contact: s.contact || '',
      Items: (s.items || []).map(function(i){ return i.name + ' x' + i.qty; }).join(' | '),
      Discount: s.discount || 0,
      Total: sTotal(s),
      Paid: s.paid || 0,
      Due: sDue(s),
      PayMode: s.paymode || '',
      Status: sSt(s),
      Profit: p.profit.toFixed(2),
      Margin_Pct: p.margin.toFixed(1)
    };
  });

  // Sheet 2: Profit Breakdown by Product
  var breakdown = buildProfitBreakdown(sales);
  var breakdownData = breakdown.map(function(p){
    return {
      Product: p.name,
      Unit_Cost: p.unitCost.toFixed(2),
      Unit_Price: p.unitPrice.toFixed(2),
      Profit_Per_Unit: (p.unitPrice - p.unitCost).toFixed(2),
      Qty_Sold: p.qty,
      Revenue: p.revenue.toFixed(2),
      Total_Cost: p.cost.toFixed(2),
      Total_Profit: p.profit.toFixed(2),
      Margin_Pct: (p.revenue > 0 ? (p.profit/p.revenue*100) : 0).toFixed(1)
    };
  });

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), 'Sales');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breakdownData), 'Profit Breakdown');

  var filterDesc = describeActiveFilter(finActiveFilter).replace(/[^a-z0-9]/gi, '_').slice(0, 30);
  XLSX.writeFile(wb, 'report_' + filterDesc + '_' + today() + '.xlsx');
  toast('Report exported (' + salesData.length + ' sales)', 'gd');
}

// ═══════════════════════════════════════════════════════════
// PRINT FILTERED RESULTS
// ═══════════════════════════════════════════════════════════
function printFilteredReport() {
  var b = biz();
  if (!b) return;
  var sales = applyFinFilterToSales(b.sales || []);
  var exps  = applyFinFilterToExpenses(b.expenses || []);
  if (!sales.length && !exps.length) { toast('No data to print', 'er'); return; }

  var grossRev    = sales.reduce(function(a,s){ return a + sTotal(s); }, 0);
  var totalExp    = exps.reduce(function(a,e){ return a + (parseFloat(e.amount) || 0); }, 0);
  var totalProfit = sales.reduce(function(a,s){ return a + calcProfitForSale(s).profit; }, 0);
  var netProfit   = totalProfit - totalExp;
  var breakdown   = buildProfitBreakdown(sales);

  var filterLbl = describeActiveFilter(finActiveFilter) || 'All Records';

  var overlay = document.getElementById('print-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'print-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML =
    '<style>' +
      '@media print { body > *:not(#print-overlay) { display:none !important; } #print-overlay { display:block !important; position:static !important; } @page { margin: 14mm; size: A4; } }' +
      '#print-overlay { position:fixed;inset:0;z-index:9999;background:#fff;color:#000;overflow:auto;font-family:Arial,sans-serif;padding:18px }' +
      '.rp-hdr { text-align:center;border-bottom:3px double #000;padding-bottom:10px;margin-bottom:14px }' +
      '.rp-hdr h1 { margin:0;font-size:20px;letter-spacing:.05em }' +
      '.rp-meta { font-size:11px;color:#444;margin-top:4px }' +
      '.rp-section { margin-bottom:16px }' +
      '.rp-section h2 { font-size:13px;margin:0 0 6px;background:#000;color:#fff;padding:4px 8px;letter-spacing:.05em }' +
      '.rp-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px }' +
      '.rp-kpi { border:1px solid #000;padding:7px 10px }' +
      '.rp-kpi-lbl { font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#555 }' +
      '.rp-kpi-val { font-size:15px;font-weight:bold;margin-top:2px }' +
      '.rp-tbl { width:100%;border-collapse:collapse;font-size:11px;margin-top:5px }' +
      '.rp-tbl th, .rp-tbl td { border:1px solid #999;padding:5px 7px;text-align:left }' +
      '.rp-tbl th { background:#eee;font-weight:bold;text-transform:uppercase;font-size:9px;letter-spacing:.05em }' +
      '.rp-tbl tfoot td { font-weight:bold;background:#f3f3f3 }' +
      '.rp-tbl .num { text-align:right;font-family:Courier,monospace }' +
      '.print-close { position:fixed;top:14px;right:14px;background:#000;color:#fff;border:none;padding:8px 14px;cursor:pointer;font-size:12px;border-radius:5px;z-index:10000 }' +
      '@media print { .print-close, .print-action { display:none !important; } }' +
    '</style>' +
    '<button type="button" class="print-close" onclick="closePrintOverlay()">✕ Close</button>' +
    '<button type="button" class="print-action" onclick="window.print()" style="position:fixed;top:14px;right:90px;background:#1a73e8;color:#fff;border:none;padding:8px 14px;cursor:pointer;font-size:12px;border-radius:5px;z-index:10000">🖨 Print</button>' +
    '<div class="rp-hdr">' +
      '<h1>' + esc(b.name || 'Business') + '</h1>' +
      '<div class="rp-meta">Financial Report &middot; Filter: ' + esc(filterLbl) + '</div>' +
      '<div class="rp-meta">Generated: ' + new Date().toLocaleString() + '</div>' +
    '</div>' +

    '<div class="rp-section">' +
      '<h2>SUMMARY</h2>' +
      '<div class="rp-grid">' +
        '<div class="rp-kpi"><div class="rp-kpi-lbl">Revenue</div><div class="rp-kpi-val">' + f$(grossRev) + '</div></div>' +
        '<div class="rp-kpi"><div class="rp-kpi-lbl">Gross Profit</div><div class="rp-kpi-val">' + f$(totalProfit) + '</div></div>' +
        '<div class="rp-kpi"><div class="rp-kpi-lbl">Expenses</div><div class="rp-kpi-val">' + f$(totalExp) + '</div></div>' +
        '<div class="rp-kpi"><div class="rp-kpi-lbl">Net Profit</div><div class="rp-kpi-val">' + f$(netProfit) + '</div></div>' +
      '</div>' +
    '</div>' +

    (breakdown.length
      ? '<div class="rp-section">' +
          '<h2>PROFIT BREAKDOWN BY PRODUCT</h2>' +
          '<table class="rp-tbl">' +
            '<thead><tr><th>Product</th><th class="num">Cost</th><th class="num">Price</th><th class="num">Per Unit</th><th class="num">Qty</th><th class="num">Total Profit</th><th class="num">Margin %</th></tr></thead>' +
            '<tbody>' +
              breakdown.map(function(p){
                var marg = p.revenue > 0 ? (p.profit / p.revenue * 100) : 0;
                return '<tr>' +
                  '<td>' + esc(p.name) + '</td>' +
                  '<td class="num">' + f$(p.unitCost) + '</td>' +
                  '<td class="num">' + f$(p.unitPrice) + '</td>' +
                  '<td class="num">' + f$(p.unitPrice - p.unitCost) + '</td>' +
                  '<td class="num">' + p.qty + '</td>' +
                  '<td class="num">' + f$(p.profit) + '</td>' +
                  '<td class="num">' + marg.toFixed(1) + '%</td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
            '<tfoot><tr><td colspan="5">TOTAL</td><td class="num">' + f$(totalProfit) + '</td><td class="num">' + (grossRev > 0 ? (totalProfit/grossRev*100).toFixed(1) : 0) + '%</td></tr></tfoot>' +
          '</table>' +
        '</div>'
      : '') +

    (sales.length
      ? '<div class="rp-section">' +
          '<h2>SALES (' + sales.length + ')</h2>' +
          '<table class="rp-tbl">' +
            '<thead><tr><th>#</th><th>Date</th><th>Invoice</th><th>Customer</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Profit</th><th>Mode</th></tr></thead>' +
            '<tbody>' +
              sales.map(function(s,i){
                var p = calcProfitForSale(s);
                return '<tr>' +
                  '<td>' + (i+1) + '</td>' +
                  '<td>' + esc(s.date || '') + '</td>' +
                  '<td>' + esc(s.inv || '') + '</td>' +
                  '<td>' + esc(s.customer || 'Walk-in') + '</td>' +
                  '<td class="num">' + f$(sTotal(s)) + '</td>' +
                  '<td class="num">' + f$(s.paid || 0) + '</td>' +
                  '<td class="num">' + f$(p.profit) + '</td>' +
                  '<td>' + esc(s.paymode || '') + '</td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>'
      : '') +

    (exps.length
      ? '<div class="rp-section">' +
          '<h2>EXPENSES (' + exps.length + ')</h2>' +
          '<table class="rp-tbl">' +
            '<thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="num">Amount</th></tr></thead>' +
            '<tbody>' +
              exps.map(function(e){
                return '<tr>' +
                  '<td>' + esc(e.date || '') + '</td>' +
                  '<td>' + esc(e.category || '') + '</td>' +
                  '<td>' + esc(e.desc || e.description || '') + '</td>' +
                  '<td class="num">' + f$(parseFloat(e.amount) || 0) + '</td>' +
                '</tr>';
              }).join('') +
              '<tr><td colspan="3" style="text-align:right;font-weight:bold">TOTAL EXPENSES</td><td class="num" style="font-weight:bold">' + f$(totalExp) + '</td></tr>' +
            '</tbody>' +
          '</table>' +
        '</div>'
      : '');

  overlay.style.display = 'block';
  setTimeout(function(){ window.print(); }, 400);
}

function closePrintOverlay() {
  var o = document.getElementById('print-overlay');
  if (o) o.style.display = 'none';
}



// ═══════════════════════════════════════════════════════════
// STAGE 2: PERMISSION GATES
// Apply visual locks (greyed-out + 🔒) when user lacks permission
// ═══════════════════════════════════════════════════════════

function enforceDashboardPerms() {
  if (!CU) return;

  // ── ADMIN SHORT-CIRCUIT ──
  // Primary admin and admin role ALWAYS see EVERYTHING. No gating, ever.
  // We aggressively restore display on every dashboard element that might
  // have had display:none applied by a previous non-admin login.
  if (CU.role === 'primaryAdmin' || CU.role === 'admin') {
    var pg = document.getElementById('pg-dash');
    if (pg) {
      // Restore the kcard-v2 cards explicitly
      ['ks','ke','kiv','kl'].forEach(function(id){
        var elx = document.getElementById(id);
        if (elx) {
          var card = elx.closest('.kcard-v2');
          if (card) card.style.display = '';
        }
      });
      // Strip display:none from EVERY element inside the dashboard page.
      // This guarantees nothing stays hidden from previous gating.
      pg.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(function(el){
        // Don't unhide elements that should be hidden for OTHER reasons (modals, etc.)
        // Only restore elements that are part of the dashboard layout, not popups.
        var keepHidden =
          el.classList.contains('dov')      ||  // drawer overlay
          el.classList.contains('modal')    ||  // modal
          el.id === 'print-overlay'         ||
          el.id === 'sidebar-overlay'       ||
          el.id === 'sidebar-menu'          ||
          el.classList.contains('ndot');         // notification dots
        if (!keepHidden) {
          el.style.display = '';
        }
      });
    }
    // Remove any restrictive body classes
    document.body.classList.remove('no-net-profit', 'no-expenses-card',
      'no-inventory-value', 'no-weekly-revenue', 'no-product-price', 'no-all-sales');
    return;
  }

  // ── BELOW: only runs for non-admin roles (staff, sell agents, viewers) ──

  // ── 1. HERO NET PROFIT STRIP ──
  var hero = document.querySelector('.hero-net');
  if (hero) {
    hero.style.display = hasPerm('see_net_profit') ? '' : 'none';
  }

  // ── 2. DASHBOARD CARDS GRID ──
  // Inventory Value card — hide if user lacks see_inventory_value
  try {
    var kivEl = document.getElementById('kiv');
    if (kivEl) {
      var ivCard = kivEl.closest('.kcard-v2');
      if (ivCard) ivCard.style.display = hasPerm('see_inventory_value') ? '' : 'none';
    }
  } catch(e){}
  // Expenses card — hide if user lacks see_expenses_card
  try {
    var keEl = document.getElementById('ke');
    if (keEl) {
      var expCard = keEl.closest('.kcard-v2');
      if (expCard) expCard.style.display = hasPerm('see_expenses_card') ? '' : 'none';
    }
  } catch(e){}
  // Legacy .stat-card fallback for any older markup
  document.querySelectorAll('.stat-card').forEach(function(card){
    var lbl = card.querySelector('.stat-card-label, .sc-lbl, .stat-label, .sc-l');
    var lblText = lbl ? (lbl.textContent || '').toUpperCase() : (card.textContent || '').toUpperCase();
    if (lblText.indexOf('EXPENSE') >= 0) {
      card.style.display = hasPerm('see_expenses_card') ? '' : 'none';
    } else if (lblText.indexOf('INVENTORY VALUE') >= 0) {
      card.style.display = hasPerm('see_inventory_value') ? '' : 'none';
    }
  });

  // ── 3. WEEKLY REVENUE CHART ──
  var weekly = document.getElementById('week-chart');
  // Hide the parent .sec block, not just the bars
  if (weekly) {
    var section = weekly.closest('.sec') || weekly.parentElement;
    if (section) {
      section.style.display = hasPerm('see_weekly_revenue') ? '' : 'none';
    }
  }

  // ── 4. DAILY REPORT QUICK ACTION ──
  document.querySelectorAll('[onclick*="openDailyReport"]').forEach(function(b){
    // The qa buttons are .qa-btn — hide just the button itself, not its container
    var qaBtn = b.classList && b.classList.contains('qa-btn') ? b : b.closest('.qa-btn');
    var target = qaBtn || b;
    target.style.display = hasPerm('print_daily_report') ? '' : 'none';
  });

  // ── 5. ADD EXPENSE QUICK ACTION ──
  document.querySelectorAll('[onclick*="openExp"], [onclick*="goTo(\'expenses\')"]').forEach(function(b){
    var qaBtn = b.classList && b.classList.contains('qa-btn') ? b : b.closest('.qa-btn');
    var target = qaBtn || b;
    target.style.display = hasPerm('see_expenses') ? '' : 'none';
  });

  // ── 6. CSS body classes for sweeping styles ──
  document.body.classList.toggle('no-net-profit',     !hasPerm('see_net_profit'));
  document.body.classList.toggle('no-expenses-card',  !hasPerm('see_expenses_card'));
  document.body.classList.toggle('no-inventory-value',!hasPerm('see_inventory_value'));
  document.body.classList.toggle('no-weekly-revenue', !hasPerm('see_weekly_revenue'));
  document.body.classList.toggle('no-product-price',  !hasPerm('see_product_price'));
  document.body.classList.toggle('no-all-sales',      !hasPerm('see_all_sales'));
}

// ─── Helper: mask a number element when locked ───
function maskIfNoPerm(elementId, permKey) {
  var elx = document.getElementById(elementId);
  if (!elx) return;
  if (!hasPerm(permKey)) {
    elx.textContent = '🔒 Locked';
    elx.style.color = 'var(--t3)';
    elx.style.fontSize = '12px';
  }
}

// ─── Hide entire page/section by permission ───
function gatePageByPerm(pageId, permKey) {
  if (hasPerm(permKey)) return true;  // Allowed
  var pg = document.getElementById(pageId);
  if (pg) {
    pg.innerHTML = '<div class="sec">' +
      '<div class="perm-lock-card" style="padding:40px 20px;text-align:center">' +
        '<div class="perm-lock-icon">🔒</div>' +
        '<div class="perm-lock-title">Access restricted</div>' +
        '<div class="perm-lock-sub">' + (PERM_LABELS[permKey] || permKey) + ' — ask admin to enable</div>' +
      '</div>' +
    '</div>';
  }
  return false;
}

// ─── Add a lock badge to a button (visually only — click still fires) ───
function addLockToButton(button, permKey) {
  if (!button) return;
  if (hasPerm(permKey)) {
    // Restore button if it was locked
    button.classList.remove('perm-locked');
    button.style.opacity = '';
    return;
  }
  if (button.classList.contains('perm-locked')) return;
  button.classList.add('perm-locked');
  button.style.opacity = '.55';
  // Add lock icon if not present
  if (button.textContent.indexOf('🔒') < 0) {
    var orig = button.textContent;
    button.dataset.origText = orig;
    button.innerHTML = '🔒 ' + orig;
  }
}

// ─── Override key functions to check permissions ───
// Wrap exportFilteredReport
(function(){
  if (typeof window.exportFilteredReport === 'function') {
    var orig = window.exportFilteredReport;
    window.exportFilteredReport = function() {
      if (!hasPerm('export_reports')) {
        permDenied('export_reports');
        return;
      }
      // Require password for sensitive action
      requirePassword('Export Reports', function(){
        orig.apply(this, arguments);
      });
    };
  }
  if (typeof window.printFilteredReport === 'function') {
    var origP = window.printFilteredReport;
    window.printFilteredReport = function() {
      if (!hasPerm('print_daily_report')) {
        permDenied('print_daily_report');
        return;
      }
      origP.apply(this, arguments);
    };
  }
  if (typeof window.exportProductsToExcel === 'function') {
    var origE = window.exportProductsToExcel;
    window.exportProductsToExcel = function() {
      if (!hasPerm('export_reports')) {
        permDenied('export_reports');
        return;
      }
      requirePassword('Export Products', function(){
        origE.apply(this, arguments);
      });
    };
  }
  if (typeof window.exportSalesToExcel === 'function') {
    var origS = window.exportSalesToExcel;
    window.exportSalesToExcel = function() {
      if (!hasPerm('export_reports')) {
        permDenied('export_reports');
        return;
      }
      requirePassword('Export Sales', function(){
        origS.apply(this, arguments);
      });
    };
  }
  if (typeof window.openDailyReport === 'function') {
    var origD = window.openDailyReport;
    window.openDailyReport = function() {
      if (!hasPerm('print_daily_report')) {
        permDenied('print_daily_report');
        return;
      }
      origD.apply(this, arguments);
    };
  }
})();

// Gate Reports page when user navigates to it
(function(){
  var origGoTo = window.goTo;
  if (typeof origGoTo !== 'function') return;
  window.goTo = function(p) {
    // Check page-level permissions BEFORE navigating
    if (p === 'reports' && !hasPerm('see_financial_reports')) {
      permDenied('see_financial_reports');
      return;
    }
    if (p === 'expenses' && !hasPerm('see_expenses')) {
      permDenied('see_expenses');
      return;
    }
    if (p === 'salary' && !isAdmin() && !hasPerm('see_salary_management')) {
      permDenied('see_salary_management');
      return;
    }
    if (p === 'docexp' && !isAdmin()) {
      permDenied('Documentation Expense (admins only)');
      return;
    }
    return origGoTo.apply(this, arguments);
  };
})();

// Gate "Manage Team" + "Business Settings" via their open functions
(function(){
  if (typeof window.openTeam === 'function') {
    var origT = window.openTeam;
    window.openTeam = function() {
      if (!isAdmin()) { toast('Admins only', 'er'); return; }
      // Non-primary admin needs manage_team permission
      if (!isPrimary() && !hasPerm('manage_team')) {
        permDenied('manage_team');
        return;
      }
      return origT.apply(this, arguments);
    };
  }
  if (typeof window.openBizSettings === 'function') {
    var origB = window.openBizSettings;
    window.openBizSettings = function() {
      if (!isAdmin()) { toast('Admins only', 'er'); return; }
      if (!isPrimary() && !hasPerm('manage_settings')) {
        permDenied('manage_settings');
        return;
      }
      return origB.apply(this, arguments);
    };
  }
})();

// Sales totals: gate "see_sales_totals" by hiding due column / total amounts when staff
// We'll re-style this in renderSales render but simpler approach: add CSS class
function applySalesPermStyles() {
  if (hasPerm('see_sales_totals')) {
    document.body.classList.remove('no-sales-totals');
  } else {
    document.body.classList.add('no-sales-totals');
  }
  if (hasPerm('see_product_cost')) {
    document.body.classList.remove('no-product-cost');
  } else {
    document.body.classList.add('no-product-cost');
  }
}

// Call this on every login + after each render



// ═══════════════════════════════════════════════════════════
// STAGE 3: USER PERMISSIONS UI
// ═══════════════════════════════════════════════════════════
let _editingPermsUserId = null;

function openUserPerms(userId) {
  if (!isPrimary()) {
    toast('Only primary admin can change permissions', 'er');
    return;
  }
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) { toast('User not found', 'er'); return; }
  if (u.role === 'primaryAdmin') {
    toast('Primary admin has all permissions', 'gd');
    return;
  }
  _editingPermsUserId = userId;
  // Make sure user has perms
  if (!u.perms) u.perms = defaultPermsFor(u.role);

  // Fill drawer header
  var avEl = document.getElementById('up-avatar');
  var nmEl = document.getElementById('up-name');
  var rlEl = document.getElementById('up-role');
  if (avEl) avEl.textContent = mkInit(u.name);
  if (nmEl) nmEl.textContent = u.name + ' (@' + u.username + ')';
  if (rlEl) rlEl.textContent = (RLBL[u.role] || u.role) + ' • ' + (u.email || 'no email');

  renderUserPerms();
  openD('d-user-perms');
}

function renderUserPerms() {
  if (!_editingPermsUserId) return;
  var u = (DB.users || []).find(function(x){ return x.id === _editingPermsUserId; });
  if (!u) return;
  u.perms = u.perms || defaultPermsFor(u.role);
  var html = '';
  PERM_KEYS.forEach(function(key){
    var on = !!u.perms[key];
    html += '<div class="up-toggle-row' + (on ? ' on' : '') + '" onclick="togglePerm(\'' + key + '\')">' +
      '<div class="up-toggle-icon">' + (PERM_ICONS[key] || '🔒') + '</div>' +
      '<div class="up-toggle-info">' +
        '<div class="up-toggle-name">' + esc(PERM_LABELS[key]) + '</div>' +
        '<div class="up-toggle-key">' + (on ? '✓ Granted' : '✗ Locked') + '</div>' +
      '</div>' +
      '<div class="up-toggle-switch"></div>' +
    '</div>';
  });
  var listEl = document.getElementById('up-perms-list');
  if (listEl) listEl.innerHTML = html;
}

function togglePerm(permKey) {
  if (!_editingPermsUserId) return;
  var u = (DB.users || []).find(function(x){ return x.id === _editingPermsUserId; });
  if (!u) return;
  u.perms = u.perms || defaultPermsFor(u.role);
  var newVal = !u.perms[permKey];
  setUserPerm(_editingPermsUserId, permKey, newVal);
  renderUserPerms();
  toast((newVal ? '✓ Granted: ' : '🚫 Revoked: ') + PERM_LABELS[permKey], newVal ? 'gd' : 'er');
}

function applyPermPreset(preset) {
  if (!_editingPermsUserId) return;
  var u = (DB.users || []).find(function(x){ return x.id === _editingPermsUserId; });
  if (!u) return;
  var newPerms = {};
  if (preset === 'none') {
    PERM_KEYS.forEach(function(k){ newPerms[k] = false; });
  } else if (preset === 'cashier') {
    PERM_KEYS.forEach(function(k){ newPerms[k] = false; });
    newPerms.see_product_price = true;  // need price to ring up sales
    newPerms.see_all_sales = true;      // cashier reconciles end-of-day, sees business total
  } else if (preset === 'sell_agent') {
    // Sell Agent: their own sales only, product names + qty (no prices/costs),
    // shortage alerts allowed. NO net profit, NO expenses, NO weekly revenue.
    PERM_KEYS.forEach(function(k){ newPerms[k] = false; });
    newPerms.see_dashboard_cards    = true;  // general dashboard (own sales card, low stock card)
    newPerms.see_product_price      = true;  // need to sell items
    // Everything else stays off (net profit, expenses card, inventory value, weekly revenue,
    // all sales, financial reports, exports, daily report, etc.)
  } else if (preset === 'manager') {
    newPerms = {
      see_dashboard_cards: true,
      see_net_profit: true,
      see_expenses_card: true,
      see_inventory_value: true,
      see_weekly_revenue: true,
      see_all_sales: true,
      see_product_price: true,
      see_financial_reports: true,
      see_sales_totals: true,
      see_product_cost: true,
      see_expenses: true,
      see_salary_management: true,
      export_reports: false,
      print_daily_report: true,
      manage_team: false,
      manage_settings: false
    };
  } else if (preset === 'all') {
    PERM_KEYS.forEach(function(k){ newPerms[k] = true; });
  }
  u.perms = newPerms;
  if (typeof addAdminLog === 'function') {
    addAdminLog('perm_preset', 'Applied "' + preset + '" preset to ' + u.name, CU.name);
  }
  dbSave();
  if (typeof fbPush === 'function') try { fbPush(); } catch(e){}
  renderUserPerms();
  toast('Applied "' + preset + '" preset', 'gd');
}



// ═══════════════════════════════════════════════════════════
// STAGE 4+5: FIREBASE CONFIG SECURITY
// ═══════════════════════════════════════════════════════════

// Helper: mask Firebase config so admins (non-primary) see ***
function getMaskedFBConfig() {
  try {
    var raw = localStorage.getItem('ss_fb_config');
    if (!raw) return '';
    var cfg = JSON.parse(raw);
    var masked = {};
    Object.keys(cfg).forEach(function(k){
      var v = cfg[k] || '';
      // Keep domain visible, mask keys/IDs
      if (k === 'apiKey' || k === 'appId' || k === 'messagingSenderId') {
        masked[k] = (v.length > 6) ? '••••••••••••' + v.slice(-4) : '••••••••';
      } else if (k === 'projectId' || k === 'authDomain' || k === 'storageBucket' || k === 'databaseURL') {
        // Show partial - just the project name
        var match = v.match(/([a-z0-9-]+)/i);
        masked[k] = match ? '••••' + match[1].slice(-4) + '••••' : '••••••';
      } else {
        masked[k] = '••••••••';
      }
    });
    return JSON.stringify(masked, null, 2);
  } catch(e) { return ''; }
}

// Override openFBSetup to mask config from non-primary admins
(function(){
  var origOpen = window.openFBSetup;
  if (typeof origOpen !== 'function') return;
  window.openFBSetup = function() {
    // Let the original function open and render normally
    origOpen.apply(this, arguments);
    // Then apply masking after a short delay (so DOM is ready)
    setTimeout(applyFBConfigMask, 100);
  };
})();

function applyFBConfigMask() {
  var textarea = document.getElementById('fb-config-input');
  if (!textarea) return;

  if (isPrimary()) {
    // Primary admin sees real config
    return;
  }

  // Non-primary admin: show masked version, disable edits
  var masked = getMaskedFBConfig();
  if (masked) {
    textarea.value = masked;
    textarea.readOnly = true;
    textarea.style.opacity = '.6';
    textarea.style.cursor = 'not-allowed';
    // Add lock indicator at top
    if (!document.getElementById('fb-mask-notice')) {
      var notice = document.createElement('div');
      notice.id = 'fb-mask-notice';
      notice.style.cssText = 'background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:var(--r10);padding:11px 13px;margin-bottom:10px;font-size:11px;color:var(--wa);line-height:1.6';
      notice.innerHTML = '🔒 <strong>Firebase keys are hidden</strong> — only the primary admin can view or change the database configuration.';
      textarea.parentNode.insertBefore(notice, textarea);
    }
  }

  // Hide / disable the Connect button for non-primary
  var connectBtns = document.querySelectorAll('#d-fbsetup button');
  connectBtns.forEach(function(btn){
    var txt = (btn.textContent || '').trim();
    if (txt.indexOf('Connect') >= 0 || txt.indexOf('Disconnect') >= 0) {
      if (!isPrimary()) {
        btn.disabled = true;
        btn.style.opacity = '.4';
        btn.style.cursor = 'not-allowed';
        btn.title = 'Only primary admin can change Firebase config';
        // Replace handler to show toast
        btn.onclick = function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          toast('🔒 Only primary admin can change Firebase config', 'er');
        };
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// PASSWORD GATES FOR SENSITIVE ACTIONS (every time)
// ═══════════════════════════════════════════════════════════

// Wrap disconnect Firebase
(function(){
  var orig = window.disconnectFirebase;
  if (typeof orig !== 'function') return;
  window.disconnectFirebase = function() {
    if (!isPrimary()) {
      toast('🔒 Only primary admin can disconnect Firebase', 'er');
      return;
    }
    requirePassword('Disconnect Firebase Database', function(){
      orig.apply(this, arguments);
    });
  };
})();

// Wrap saveFBConfig
(function(){
  var orig = window.saveFBConfig;
  if (typeof orig !== 'function') return;
  window.saveFBConfig = function() {
    if (!isPrimary()) {
      toast('🔒 Only primary admin can change Firebase config', 'er');
      return;
    }
    requirePassword('Save Firebase Configuration', function(){
      orig.apply(this, arguments);
    });
  };
})();

// Wrap exportBackup
(function(){
  var orig = window.exportBackup;
  if (typeof orig !== 'function') return;
  window.exportBackup = function() {
    if (!isAdmin()) {
      toast('🔒 Admins only', 'er');
      return;
    }
    requirePassword('Download Full Database Backup', function(){
      orig.apply(this, arguments);
    });
  };
})();

// Wrap deleteSale, deleteProduct, deleteExpense  
['deleteSale', 'deleteProduct', 'deleteExpense', 'removeUser'].forEach(function(fnName){
  if (typeof window[fnName] === 'function') {
    var orig = window[fnName];
    window[fnName] = function() {
      var args = arguments;
      if (!isAdmin()) {
        // Non-admin: create a delete request through change request system
        if (typeof openRecordChangeRequest === 'function' && fnName !== 'removeUser') {
          var type = fnName.replace('delete', '').toLowerCase();
          toast('🔒 Sending delete request to admin', 'gd');
          openRecordChangeRequest(type, args[0], type + ' #' + args[0]);
          return;
        }
        toast('🔒 Admins only', 'er');
        return;
      }
      requirePassword('Delete ' + fnName.replace('delete','').replace('removeUser','User'), function(){
        orig.apply(this, args);
      });
    };
  }
});

// Notify primary admin when staff sends a delete request (already exists in CR system,
// but we ensure a notification fires too)
(function(){
  var orig = window.openRecordChangeRequest;
  if (typeof orig !== 'function') return;
  window.openRecordChangeRequest = function() {
    orig.apply(this, arguments);
    // After 800ms, push a notification too so admin gets both
    setTimeout(function(){
      if (typeof addNotif === 'function' && CU && !isAdmin()) {
        try {
          addNotif('change_request', '🔔 ' + (CU.name || 'Staff') + ' requested a record change/delete — review in Admin Panel');
        } catch(e){}
      }
    }, 800);
  };
})();



// ═══════════════════════════════════════════════════════════
// APP LOADING SCREEN HIDE
// Hide the loader once the app has finished initializing
// Minimum show time: 800ms (so it doesn't flash)
// Maximum wait: 4 seconds (in case something hangs)
// ═══════════════════════════════════════════════════════════
(function(){
  // ── INSTANT RESTORE: if user has a session, remove loader immediately ──
  if (window._instantRestore) {
    var loader = document.getElementById('ss-loader');
    if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    return;
  }

  // First-time visitor / signed-out — show normal loader briefly
  var loaderStart = Date.now();
  var MIN_SHOW = 600;   // Reduced from 3s — only show briefly on first visit
  var MAX_WAIT = 4000;  // Safety net

  function hideLoader() {
    var elapsed = Date.now() - loaderStart;
    var wait = Math.max(0, MIN_SHOW - elapsed);
    setTimeout(function(){
      var loader = document.getElementById('ss-loader');
      if (!loader) return;
      loader.classList.add('fade-out');
      setTimeout(function(){
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 550);
    }, wait);
  }

  function tryHide() {
    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader, { once: true });
    }
  }

  setTimeout(function(){
    var loader = document.getElementById('ss-loader');
    if (loader && !loader.classList.contains('fade-out')) {
      hideLoader();
    }
  }, MAX_WAIT);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryHide, { once: true });
  } else {
    tryHide();
  }
})();



// ═══════════════════════════════════════════════════════════
// SERVICE WORKER REGISTRATION
// Enables "Install App" prompt + offline support
// Requires HTTPS (Netlify provides this automatically)
// ═══════════════════════════════════════════════════════════
(function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Not supported by this browser');
    return;
  }
  // Only register over HTTPS (or localhost for dev)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    console.log('[SW] Skipped — requires HTTPS (you are on ' + location.protocol + ')');
    return;
  }
  // Register after page load to avoid blocking initial render
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function(reg) {
        console.log('[SW] Registered:', reg.scope);
        // Watch for updates
        reg.addEventListener('updatefound', function() {
          var newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                console.log('[SW] New version available — refresh to update');
                if (typeof toast === 'function') {
                  toast('🔄 New version ready — refresh to apply', 'gd');
                }
              }
            });
          }
        });
      })
      .catch(function(err) {
        console.log('[SW] Registration failed:', err.message);
      });
  });
})();

// ─── PWA Install Prompt (Add to Home Screen) ───
var deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  // Prevent the default mini-info bar
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('[PWA] Install prompt ready');
  // Optional: show a toast to remind user they can install
  setTimeout(function() {
    if (typeof toast === 'function' && deferredInstallPrompt) {
      toast('📱 Install SmartStock for offline use — tap menu ⋮ → Install', 'gd');
    }
  }, 5000);
});

window.addEventListener('appinstalled', function() {
  console.log('[PWA] App installed');
  deferredInstallPrompt = null;
  if (typeof toast === 'function') {
    toast('✓ SmartStock Pro installed!', 'gd');
  }
});

// Optional helper: trigger install from a button somewhere
function triggerPWAInstall() {
  if (!deferredInstallPrompt) {
    if (typeof toast === 'function') {
      toast('Tap Chrome menu ⋮ → "Install app" instead', 'er');
    }
    return;
  }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(function(result) {
    console.log('[PWA] Install choice:', result.outcome);
    deferredInstallPrompt = null;
  });
}



// ═══════════════════════════════════════════════════════════
// CONNECTED STATUS (for non-primary admins)
// Shows a simple confirmation that Firebase is connected,
// without exposing any config or controls
// ═══════════════════════════════════════════════════════════
function showConnectedStatus() {
  // Check if connected
  var hasConfig = false;
  try {
    var raw = localStorage.getItem('ss_fb_config');
    hasConfig = !!raw;
  } catch(e){}

  // Build a simple status drawer if not already in DOM
  var d = document.getElementById('d-fb-status');
  if (!d) {
    d = document.createElement('div');
    d.id = 'd-fb-status';
    d.className = 'dov';
    d.innerHTML =
      '<div class="dbox" style="max-width:420px"><div class="dh2"></div>' +
        '<div class="dhead">' +
          '<div>' +
            '<div class="dtitle">🔗 Database Sync</div>' +
            '<div class="dsub">Auto-managed</div>' +
          '</div>' +
          '<button type="button" class="dclose" onclick="closeD(\'d-fb-status\')">&#10005;</button>' +
        '</div>' +
        '<div class="dbnp"><div class="dbody">' +
          '<div style="background:rgba(34,197,94,.08);border:1.5px solid rgba(34,197,94,.3);border-radius:var(--r12);padding:24px 18px;text-align:center;margin-bottom:14px">' +
            '<div style="font-size:42px;margin-bottom:10px">✅</div>' +
            '<div style="font-size:16px;font-weight:800;color:var(--ok);margin-bottom:6px">Connected</div>' +
            '<div style="font-size:12px;color:var(--t2);line-height:1.6">Your business data syncs automatically across all devices. No setup needed.</div>' +
          '</div>' +
          '<div style="background:rgba(79,195,247,.06);border:1px solid rgba(79,195,247,.18);border-radius:var(--r10);padding:13px 14px">' +
            '<div style="font-size:11px;color:var(--in);font-weight:700;margin-bottom:6px;letter-spacing:.03em">ℹ How it works</div>' +
            '<div style="font-size:11px;color:var(--t2);line-height:1.7">' +
              '• Changes appear on every staff phone within 1 second<br>' +
              '• Works offline — syncs back when internet returns<br>' +
              '• Only your primary admin can change sync settings' +
            '</div>' +
          '</div>' +
        '</div></div>' +
      '</div>';
    document.body.appendChild(d);
  }
  if (typeof openD === 'function') openD('d-fb-status');
}




// ═══════════════════════════════════════════════════════════════════
//  DOCUMENTATION EXPENSE — UI logic
// ═══════════════════════════════════════════════════════════════════

let editDocId = null;
let docFileData = null;
let docFileType = null;

function openDocExpAdd(){
  editDocId = null;
  docFileData = null;
  docFileType = null;
  el('docexp-dtitle').textContent = '📋 Add Document';
  sv('doc-name','');
  sv('doc-cost','');
  sv('doc-start', today());
  sv('doc-expiry','');
  sv('doc-notes','');
  if(el('doc-type')) el('doc-type').value = 'License';
  if(el('doc-preview')) el('doc-preview').style.display = 'none';
  if(el('doc-file-preview')) {
    el('doc-file-preview').style.display = 'none';
    el('doc-file-preview').innerHTML = '';
  }
  if(el('doc-file-btn')) el('doc-file-btn').innerHTML = '📎 Choose Photo or PDF';
  openD('d-docexp');
}

function openDocExpEdit(id){
  var b = biz(); if(!b) return;
  var doc = (b.docExpenses || []).find(function(d){return d.id === id;});
  if(!doc) return;
  editDocId = id;
  docFileData = doc.fileData || null;
  docFileType = doc.fileType || null;
  el('docexp-dtitle').textContent = '📋 Edit Document';
  sv('doc-name', doc.name || '');
  sv('doc-cost', doc.cost || '');
  sv('doc-start', doc.startDate || '');
  sv('doc-expiry', doc.expiryDate || '');
  sv('doc-notes', doc.notes || '');
  if(el('doc-type')) el('doc-type').value = doc.type || 'License';
  updateDocPreview();
  showDocFilePreview();
  openD('d-docexp');
}

function onDocFile(event){
  var file = event.target.files[0];
  if(!file) return;
  // Limit size: 5MB
  if(file.size > 5*1024*1024){
    toast('File too large (max 5MB)','er');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e){
    docFileData = e.target.result;
    docFileType = file.type;
    showDocFilePreview();
  };
  reader.readAsDataURL(file);
}

function showDocFilePreview(){
  var box = el('doc-file-preview');
  if(!box) return;
  if(!docFileData){
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  box.style.display = 'block';
  if(docFileType && docFileType.indexOf('image') === 0){
    box.innerHTML = '<img src="' + docFileData + '" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--bd)">' +
                    '<button type="button" class="btn btn-gh btn-block" style="margin-top:6px;font-size:11px" onclick="clearDocFile()">✕ Remove</button>';
  } else {
    box.innerHTML = '<div style="padding:14px;background:rgba(79,195,247,.08);border:1px solid rgba(79,195,247,.25);border-radius:8px;text-align:center"><div style="font-size:24px">📄</div><div style="font-size:11px;color:var(--t2);margin-top:4px">PDF Attached</div></div>' +
                    '<button type="button" class="btn btn-gh btn-block" style="margin-top:6px;font-size:11px" onclick="clearDocFile()">✕ Remove</button>';
  }
  if(el('doc-file-btn')) el('doc-file-btn').innerHTML = '🔄 Replace File';
}

function clearDocFile(){
  docFileData = null;
  docFileType = null;
  if(el('doc-file')) el('doc-file').value = '';
  showDocFilePreview();
  if(el('doc-file-btn')) el('doc-file-btn').innerHTML = '📎 Choose Photo or PDF';
}

function updateDocPreview(){
  var cost = parseFloat(gv('doc-cost'));
  var start = gv('doc-start');
  var expiry = gv('doc-expiry');
  if(!cost || !start || !expiry){
    if(el('doc-preview')) el('doc-preview').style.display = 'none';
    return;
  }
  var wd = countWorkingDays(start, expiry);
  if(wd <= 0){
    if(el('doc-preview')) el('doc-preview').style.display = 'none';
    return;
  }
  var daily = cost / wd;
  // Calculate duration in months
  var dur = daysBetween(start, expiry);
  var durText;
  if(dur >= 365) {
    durText = Math.round(dur/365 * 10)/10 + ' yr';
  } else if(dur >= 30) {
    durText = Math.round(dur/30) + ' mo';
  } else {
    durText = dur + ' days';
  }
  if(el('doc-preview')) el('doc-preview').style.display = '';
  if(el('doc-wd')) el('doc-wd').textContent = wd;
  if(el('doc-dd')) el('doc-dd').textContent = f$(daily);
  if(el('doc-dur')) el('doc-dur').textContent = durText;
  if(el('doc-formula')) el('doc-formula').innerHTML = f$(cost) + ' &divide; ' + wd + ' working days = <strong style="color:var(--ok)">' + f$(daily) + '/day</strong>';
}

function saveDocExp(){
  var b = biz(); if(!b){toast('No business','er');return;}
  var name = gv('doc-name').trim();
  var cost = parseFloat(gv('doc-cost'));
  var start = gv('doc-start');
  var expiry = gv('doc-expiry');
  var type = el('doc-type') ? el('doc-type').value : 'License';
  var notes = gv('doc-notes').trim();
  if(!name){toast('Name required','er');return;}
  if(!cost || cost <= 0){toast('Cost required','er');return;}
  if(!start){toast('Start date required','er');return;}
  if(!expiry){toast('Expiry date required','er');return;}
  if(start >= expiry){toast('Expiry must be after start','er');return;}
  if(!b.docExpenses) b.docExpenses = [];
  if(!b.nextDocId) b.nextDocId = 1;
  if(editDocId !== null){
    var i = b.docExpenses.findIndex(function(d){return d.id === editDocId;});
    if(i > -1){
      b.docExpenses[i] = {
        ...b.docExpenses[i],
        name: name, type: type, cost: cost,
        startDate: start, expiryDate: expiry,
        notes: notes,
        fileData: docFileData, fileType: docFileType,
        updatedAt: Date.now()
      };
      toast('Document updated','gd');
    }
  } else {
    b.docExpenses.push({
      id: b.nextDocId++,
      name: name, type: type, cost: cost,
      startDate: start, expiryDate: expiry,
      notes: notes,
      fileData: docFileData, fileType: docFileType,
      status: 'active',
      createdAt: Date.now(), updatedAt: Date.now(),
      createdBy: CU ? CU.id : null
    });
    toast('Document added','gd');
  }
  dbSave();
  try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
  closeD('d-docexp');
  renderDocExp();
  try { renderDash(); } catch(e){}
}

function delDocExp(id){
  var b = biz(); if(!b) return;
  var doc = (b.docExpenses || []).find(function(d){return d.id === id;});
  if (!doc) return;
  // Beautiful confirmation drawer (not browser confirm)
  if (typeof confirmDelete === 'function') {
    confirmDelete({
      title: 'Delete Document?',
      message: '<strong>' + esc(doc.name) + '</strong><br><br>This document and its daily allocation will be removed permanently. Any cost already accrued stays on your books.',
      onYes: function(){
        b.docExpenses = b.docExpenses.filter(function(d){return d.id !== id;});
        dbSave();
        try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
        toast('Document deleted','gd');
        renderDocExp();
        try { renderDash(); } catch(e){}
      }
    });
  } else {
    // Fallback if helper not available
    if(!confirm('Delete this document? This will stop daily allocation.')) return;
    b.docExpenses = b.docExpenses.filter(function(d){return d.id !== id;});
    dbSave();
    try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
    toast('Document deleted','gd');
    renderDocExp();
    try { renderDash(); } catch(e){}
  }
}

function viewDocFile(id){
  var b = biz(); if(!b) return;
  var doc = (b.docExpenses || []).find(function(d){return d.id === id;});
  if(!doc || !doc.fileData){toast('No file attached','er');return;}
  // Open in new tab/window
  var w = window.open('','_blank');
  if(!w){toast('Popup blocked - allow popups','er');return;}
  if(doc.fileType && doc.fileType.indexOf('image') === 0){
    w.document.write('<html><head><title>'+esc(doc.name)+'</title></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="'+doc.fileData+'" style="max-width:100%;max-height:100vh"></body></html>');
  } else {
    w.document.write('<iframe src="'+doc.fileData+'" style="width:100vw;height:100vh;border:0"></iframe>');
  }
}

function renderDocExp(){
  var b = biz(); if(!b){
    if(el('docexp-list')) el('docexp-list').innerHTML = em('No business loaded');
    return;
  }
  var docs = (b.docExpenses || []).slice().sort(function(a,b){
    return (a.expiryDate || '').localeCompare(b.expiryDate || '');
  });
  // Summary
  if(el('docexp-count')) el('docexp-count').textContent = docs.length;
  // Show today's allocation directly
  var todayAlloc = getDayAllocations(today());
  var docExpTodayEl = el('docexp-today');
  if(docExpTodayEl) docExpTodayEl.textContent = f$(todayAlloc.docs);
  // Expiring within 30 days
  var soonExp = 0;
  var now = today();
  docs.forEach(function(d){
    if(!d.expiryDate) return;
    var daysLeft = daysBetween(now, d.expiryDate);
    if(daysLeft >= 0 && daysLeft <= 30) soonExp++;
  });
  if(el('docexp-warn')) el('docexp-warn').textContent = soonExp;
  // List
  var list = el('docexp-list'); if(!list) return;
  if(!docs.length){
    list.innerHTML = em('No documents tracked yet. Tap + Add Document to begin.');
    return;
  }
  list.innerHTML = docs.map(function(d){
    var daily = getDocDailyAmount(d);
    var accrued = getDocAccruedAmount(d, today());
    var wd = countWorkingDays(d.startDate, d.expiryDate);
    var daysLeft = daysBetween(today(), d.expiryDate);
    var expired = daysLeft < 0;
    var soon = !expired && daysLeft <= 30;
    var statusBadge = expired ?
      '<span class="bdg ber0" style="background:rgba(239,68,68,.15);color:var(--er)">EXPIRED ' + Math.abs(daysLeft) + 'd ago</span>' :
      soon ?
      '<span class="bdg" style="background:rgba(245,158,11,.15);color:var(--wa)">⚠ Expires in ' + daysLeft + 'd</span>' :
      '<span class="bdg" style="background:rgba(34,197,94,.12);color:var(--ok)">Active · ' + daysLeft + 'd left</span>';
    var typeBadge = '<span class="bdg" style="background:var(--s3);color:var(--t2);font-size:9px">' + esc(d.type || 'License') + '</span>';
    var fileBtn = d.fileData ?
      '<button class="btn btn-gh btn-xs" onclick="viewDocFile(' + d.id + ')" style="font-size:10px">📎 View</button>' : '';
    return '<div class="ecard" style="margin-bottom:10px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:3px">' + esc(d.name) + '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px">' + typeBadge + statusBadge + '</div>' +
          '<div style="font-size:10px;color:var(--t3);font-family:var(--fm)">' + esc(d.startDate) + ' → ' + esc(d.expiryDate) + '</div>' +
          (d.notes ? '<div style="font-size:11px;color:var(--t3);margin-top:4px">' + esc(d.notes) + '</div>' : '') +
        '</div>' +
        '<div style="text-align:right">' +
          '<div style="font-family:var(--fd);font-size:18px;font-weight:800;color:var(--g)">' + f$(d.cost) + '</div>' +
          '<div style="font-size:10px;color:var(--t3);margin-top:2px">total</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:10px;background:rgba(232,160,32,.06);border:1px solid rgba(232,160,32,.2);border-radius:8px;margin-bottom:10px">' +
        '<div><div style="font-size:9px;color:var(--t3);font-family:var(--fm);letter-spacing:.05em">WORKING DAYS</div><div style="font-weight:700;color:var(--t1);font-size:13px">' + wd + '</div></div>' +
        '<div><div style="font-size:9px;color:var(--t3);font-family:var(--fm);letter-spacing:.05em">DAILY</div><div style="font-weight:700;color:var(--g);font-size:13px">' + f$(daily) + '</div></div>' +
        '<div><div style="font-size:9px;color:var(--t3);font-family:var(--fm);letter-spacing:.05em">ACCRUED</div><div style="font-weight:700;color:var(--er);font-size:13px">' + f$(accrued) + '</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;padding-top:10px;border-top:1px solid var(--bd);margin-top:6px">' +
        fileBtn +
        '<button type="button" class="btn bgh bsm" onclick="openDocExpEdit(' + d.id + ')" style="flex:1;font-size:11px;font-weight:700">✎ Edit</button>' +
        '<button type="button" class="btn ber bsm" onclick="delDocExp(' + d.id + ')" style="font-size:11px;font-weight:700;min-width:40px" title="Delete">🗑</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function daysBetween(d1, d2){
  // d2 - d1 in days. Negative if d2 is before d1.
  if(!d1 || !d2) return 0;
  var t1 = new Date(d1 + 'T00:00:00').getTime();
  var t2 = new Date(d2 + 'T00:00:00').getTime();
  return Math.floor((t2 - t1) / (1000*60*60*24));
}

// ─── Document expiration warnings (called on login/dashboard render) ───
function checkDocExpirations(){
  var b = biz(); if(!b) return;
  var docs = (b.docExpenses || []);
  var now = today();
  var warnings = [];
  docs.forEach(function(d){
    if(!d.expiryDate) return;
    var daysLeft = daysBetween(now, d.expiryDate);
    if(daysLeft === 30 || daysLeft === 14 || daysLeft === 7 || daysLeft === 1){
      warnings.push({doc:d, daysLeft:daysLeft});
    }
  });
  // Only show once per day
  var lastKey = 'docexp_warn_' + now;
  var alreadyShown = false;
  try { alreadyShown = !!localStorage.getItem(lastKey); } catch(e){}
  if(!alreadyShown && warnings.length){
    setTimeout(function(){
      warnings.forEach(function(w, i){
        setTimeout(function(){
          toast('⚠ "' + w.doc.name + '" expires in ' + w.daysLeft + ' day' + (w.daysLeft!==1?'s':''), 'wa');
        }, i * 1500);
      });
      try { localStorage.setItem(lastKey, '1'); } catch(e){}
    }, 1500);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SALARY ALLOCATION (per-employee toggle in d-emp drawer)
// ═══════════════════════════════════════════════════════════════════

function toggleSalaryAlloc(){
  var t = el('emp-alloc-toggle');
  var fields = el('emp-alloc-fields');
  if(!t || !fields) return;
  fields.style.display = t.checked ? '' : 'none';
  if(t.checked) updateSalaryAllocPreview();
}

function updateSalaryAllocPreview(){
  // Auto-calculate from monthly salary × months in period
  var monthlySalary = parseFloat(gv('esal')) || 0;
  var s = gv('emp-alloc-start');
  var e = gv('emp-alloc-end');
  var box = el('emp-alloc-preview');

  // Show date error if end <= start
  if (s && e && e <= s) {
    if(box) {
      box.style.display = '';
      box.style.background = 'rgba(239,68,68,.08)';
      box.style.borderColor = 'rgba(239,68,68,.3)';
      var prevText = el('emp-alloc-prev-text');
      if(prevText) prevText.innerHTML = '<span style="color:var(--er);font-weight:700">⚠ End date must be after start date</span>';
      if(el('emp-alloc-wd')) el('emp-alloc-wd').textContent = '—';
      if(el('emp-alloc-dd')) el('emp-alloc-dd').textContent = '—';
      if(el('emp-alloc-tt')) el('emp-alloc-tt').textContent = '—';
    }
    return;
  }

  if(!monthlySalary || !s || !e){
    if(box) box.style.display = 'none';
    return;
  }
  // Reset colors
  if(box) { box.style.background = ''; box.style.borderColor = ''; }
  var wd = countWorkingDays(s, e);
  if(wd <= 0){
    if(box) box.style.display = 'none';
    return;
  }
  // Compute calendar months between dates (more accurate than days/30)
  var sD = new Date(s + 'T00:00:00');
  var eD = new Date(e + 'T00:00:00');
  var months = (eD.getFullYear() - sD.getFullYear()) * 12 + (eD.getMonth() - sD.getMonth());
  // Add partial month: count remaining days as fraction of month
  var lastMonthStart = new Date(eD.getFullYear(), eD.getMonth(), 1);
  var daysIntoLastMonth = Math.floor((eD - lastMonthStart) / (1000*60*60*24)) + 1;
  var daysInLastMonth = new Date(eD.getFullYear(), eD.getMonth()+1, 0).getDate();
  months += daysIntoLastMonth / daysInLastMonth;
  // Subtract the partial start month
  var firstMonthDay = sD.getDate();
  var daysInFirstMonth = new Date(sD.getFullYear(), sD.getMonth()+1, 0).getDate();
  months -= (firstMonthDay - 1) / daysInFirstMonth;
  // Round to 2 decimal places for clean display
  months = Math.round(months * 100) / 100;
  if (months < 0.01) months = 0.01;
  var totalCost = monthlySalary * months;
  var daily = totalCost / wd;
  if(box){
    box.style.display = '';
    if(el('emp-alloc-wd')) el('emp-alloc-wd').textContent = wd;
    if(el('emp-alloc-dd')) el('emp-alloc-dd').textContent = f$(daily);
    if(el('emp-alloc-tt')) el('emp-alloc-tt').textContent = f$(totalCost);
    var monthsLbl = months < 1.05 ? months.toFixed(2) + ' months' : Math.round(months*10)/10 + ' months';
    if(el('emp-alloc-prev-text')) el('emp-alloc-prev-text').innerHTML =
      f$(monthlySalary) + '/mo &times; ' + monthsLbl + ' = <strong style="color:var(--in)">' + f$(totalCost) + '</strong> &divide; ' + wd + ' days';
  }
}

// ─── Hook into existing openEmp to populate the new fields ───
// (We don't replace openEmp — we just monkeypatch saveEmployee for the new data,
// and reset the toggle when drawer opens)

(function(){
  // Patch openEmp / openEmployeeDrawer if exists, to fill new fields
  var origOpenEmp = typeof openEmp === 'function' ? openEmp : null;
  if(origOpenEmp){
    window.openEmp = function(){
      try { origOpenEmp.apply(this, arguments); } catch(e){}
      // Reset alloc fields
      setTimeout(function(){
        if(el('emp-alloc-toggle')) el('emp-alloc-toggle').checked = false;
        if(el('emp-alloc-fields')) el('emp-alloc-fields').style.display = 'none';
        if(el('emp-alloc-preview')) el('emp-alloc-preview').style.display = 'none';
        sv('emp-alloc-start','');
        sv('emp-alloc-end','');
        // If editing, populate from emp record
        if(typeof editEmpId !== 'undefined' && editEmpId !== null){
          var b = biz();
          if(b){
            var emp = (b.employees || []).find(function(x){return x.id === editEmpId;});
            if(emp && (emp.allocStart || emp.allocEnd)){
              if(el('emp-alloc-toggle')) el('emp-alloc-toggle').checked = true;
              if(el('emp-alloc-fields')) el('emp-alloc-fields').style.display = '';
              sv('emp-alloc-start', emp.allocStart || '');
              sv('emp-alloc-end', emp.allocEnd || '');
              updateSalaryAllocPreview();
            }
          }
        }
      }, 50);
    };
  }

  // Wrap saveEmployee to also save allocation fields
  var origSaveEmployee = typeof saveEmployee === 'function' ? saveEmployee : null;
  if(origSaveEmployee){
    window.saveEmployee = function(){
      // Get allocation fields BEFORE original save
      var allocToggle = el('emp-alloc-toggle');
      var allocOn = allocToggle && allocToggle.checked;
      var allocStart = allocOn ? gv('emp-alloc-start') : '';
      var allocEnd = allocOn ? gv('emp-alloc-end') : '';
      // Auto-calculate total cost from monthly salary × months
      var allocCost = 0;
      if (allocOn && allocStart && allocEnd) {
        // Validate dates — end must be after start
        if (allocEnd <= allocStart) {
          toast('⚠ End date must be after start date for allocation', 'er');
          return;  // Stop save and prompt user to fix dates
        }
        var monthlySal = parseFloat(gv('esal')) || 0;
        var sD = new Date(allocStart + 'T00:00:00');
        var eD = new Date(allocEnd + 'T00:00:00');
        var months = (eD.getFullYear() - sD.getFullYear()) * 12 + (eD.getMonth() - sD.getMonth());
        var lastMonthStart = new Date(eD.getFullYear(), eD.getMonth(), 1);
        var daysIntoLast = Math.floor((eD - lastMonthStart) / (1000*60*60*24)) + 1;
        var daysInLast = new Date(eD.getFullYear(), eD.getMonth()+1, 0).getDate();
        months += daysIntoLast / daysInLast;
        var firstMonthDay = sD.getDate();
        var daysInFirst = new Date(sD.getFullYear(), sD.getMonth()+1, 0).getDate();
        months -= (firstMonthDay - 1) / daysInFirst;
        if (months < 0.01) months = 0.01;
        allocCost = monthlySal * months;
      }
      // Track which emp ID will be edited or new
      var editingId = (typeof editEmpId !== 'undefined') ? editEmpId : null;
      // Call original
      try { origSaveEmployee.apply(this, arguments); } catch(e){ console.warn(e); }
      // After save, attach alloc fields to the just-saved employee
      var b = biz();
      if(!b || !b.employees) return;
      if(editingId !== null){
        var emp = b.employees.find(function(x){return x.id === editingId;});
        if(emp){
          emp.allocCost = allocOn ? allocCost : 0;
          emp.allocStart = allocStart;
          emp.allocEnd = allocEnd;
          dbSave();
          try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
        }
      } else {
        // For new emp, attach to the most recently added
        var last = b.employees[b.employees.length-1];
        if(last){
          last.allocCost = allocOn ? allocCost : 0;
          last.allocStart = allocStart;
          last.allocEnd = allocEnd;
          dbSave();
          try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
        }
      }
      // Force re-render everywhere
      try { renderDash(); } catch(e){}
      try { if(typeof renderProfitCard==='function') renderProfitCard(); } catch(e){}
      try { if(typeof renderCoverage==='function') renderCoverage(); } catch(e){}
      try { if(typeof updateAllocToggleUI==='function') updateAllocToggleUI(); } catch(e){}
      // Show success confirmation
      if(allocOn && allocCost > 0){
        var wd = countWorkingDays(allocStart, allocEnd);
        var daily = wd > 0 ? (allocCost/wd) : 0;
        toast('✅ Allocation active: ' + f$(daily) + '/day will appear in Expenses', 'gd');
      }
    };
  }
})();




// ─── handleProdImg (legacy product image handler) ───
// Generic file-to-base64 handler for product image upload
function handleProdImg(inputEl){
  // Reads the uploaded image, compresses it, stores it on both #pimg-cam and #pimg-gal
  // dataset.img (so getProdImgData() can find it), and shows the preview.
  try {
    if(!inputEl || !inputEl.files || !inputEl.files[0]) return;
    var file = inputEl.files[0];
    if(file.size > 10*1024*1024){
      if(typeof toast === 'function') toast('Image too large (max 10MB)','er');
      inputEl.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e){
      // Compress the image via canvas (max 1000px on long side, JPEG 80%)
      var img = new Image();
      img.onload = function(){
        try {
          var MAX = 1000;
          var w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
            else        { w = Math.round(w * MAX / h); h = MAX; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          // Store on BOTH cam + gal inputs (getProdImgData reads either)
          ['pimg-cam','pimg-gal'].forEach(function(id){
            var t = document.getElementById(id);
            if (t) t.dataset.img = dataUrl;
          });
          // Update preview thumb
          var thumb = document.getElementById('pimgthumb');
          var wrap = document.getElementById('pimg-prev-wrap');
          var uploadArea = document.getElementById('pimg-upload-area');
          if (thumb) thumb.src = dataUrl;
          if (wrap) wrap.style.display = '';
          if (uploadArea) uploadArea.style.display = 'none';
          if(typeof toast === 'function') toast('Image attached','gd');
        } catch(err){
          console.warn('handleProdImg compress error:', err);
          if(typeof toast === 'function') toast('Could not process image','er');
        }
      };
      img.onerror = function(){
        if(typeof toast === 'function') toast('Invalid image file','er');
      };
      img.src = e.target.result;
    };
    reader.onerror = function(){
      if(typeof toast === 'function') toast('Could not read file','er');
    };
    reader.readAsDataURL(file);
  } catch(err){
    console.warn('handleProdImg error:', err);
  }
}

// ─── Also ensure openProdEdit loads image into preview ───
(function(){
  // Hook into the function that opens the product drawer
  // We can\'t edit openProdEdit (not found by name), but we CAN watch for prod-d open
  // and populate the image from editProdId if it exists.
  // Instead: provide a helper that other code can call
  window.restoreProdImg = function(imgData){
    if (!imgData) return;
    ['pimg-cam','pimg-gal'].forEach(function(id){
      var t = document.getElementById(id);
      if (t) t.dataset.img = imgData;
    });
    var thumb = document.getElementById('pimgthumb');
    var wrap = document.getElementById('pimg-prev-wrap');
    var uploadArea = document.getElementById('pimg-upload-area');
    if (thumb) thumb.src = imgData;
    if (wrap) wrap.style.display = '';
    if (uploadArea) uploadArea.style.display = 'none';
  };
})();



// ═══════════════════════════════════════════════════════════════════
//  COVERAGE STATUS — sales vs expenses (including allocations)
// ═══════════════════════════════════════════════════════════════════

let covTab = 'day';  // 'day' | 'week' | 'month'

function switchCovTab(tab){
  covTab = tab;
  // Update tab buttons
  ['day','week','month'].forEach(function(t){
    var btn = document.getElementById('cov-tab-' + t);
    if(!btn) return;
    if(t === tab){
      btn.classList.add('on');
      btn.style.background = 'var(--g)';
      btn.style.color = '#000';
      btn.style.fontWeight = '700';
    } else {
      btn.classList.remove('on');
      btn.style.background = 'var(--s2)';
      btn.style.color = 'var(--t2)';
      btn.style.fontWeight = '600';
    }
  });
  renderCoverage();
}

function getCoverageData(period){
  // Returns {sales, actualExp, allocExp, totalExp, surplus, periodLabel}
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b) return null;

  var now = today();
  var startDateStr, endDateStr, label;

  if (period === 'day') {
    startDateStr = endDateStr = now;
    label = 'Today';
  } else if (period === 'week') {
    // Last 7 days including today
    var d = new Date(now + 'T00:00:00');
    var weekAgo = new Date(d);
    weekAgo.setDate(d.getDate() - 6);
    startDateStr = weekAgo.toISOString().split('T')[0];
    endDateStr = now;
    label = 'Last 7 Days';
  } else {
    // Current month (1st to today)
    var d2 = new Date(now + 'T00:00:00');
    var first = new Date(d2.getFullYear(), d2.getMonth(), 1);
    startDateStr = first.toISOString().split('T')[0];
    endDateStr = now;
    label = d2.toLocaleString('default',{month:'long'}) + ' ' + d2.getFullYear();
  }

  // Aggregate sales
  var sales = 0;
  (b.sales || []).forEach(function(s){
    if (!s || s.status === 'cancelled') return;
    if (s.date >= startDateStr && s.date <= endDateStr) {
      sales += (typeof sTotal === 'function') ? sTotal(s) : 0;
    }
  });

  // Aggregate actual expenses (cash)
  var actualExp = 0;
  (b.expenses || []).forEach(function(e){
    if (!e || e.status === 'cancelled') return;
    if (e.date >= startDateStr && e.date <= endDateStr) {
      actualExp += (e.amount || 0);
    }
  });

  // Aggregate allocations across the period — only if toggle ON
  var allocExp = 0;
  var allocEnabled2 = (b.allocationsEnabled !== false);
  if (allocEnabled2 && typeof getDayAllocations === 'function') {
    var cursor = new Date(startDateStr + 'T00:00:00');
    var endD = new Date(endDateStr + 'T00:00:00');
    while (cursor <= endD) {
      var iso = cursor.toISOString().split('T')[0];
      var a = getDayAllocations(iso);
      allocExp += (a && a.total) || 0;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  var totalExp = actualExp + allocExp;
  var surplus = sales - totalExp;

  return {
    sales: sales,
    actualExp: actualExp,
    allocExp: allocExp,
    totalExp: totalExp,
    surplus: surplus,
    periodLabel: label,
    startDate: startDateStr,
    endDate: endDateStr
  };
}

function renderCoverage(){
  var data = getCoverageData(covTab);
  if (!data) return;

  // Subtitle
  var subEl = document.getElementById('cov-sub');
  if (subEl) {
    var isWD = (typeof isWorkingDay === 'function') ? isWorkingDay(today()) : true;
    var sfx = (covTab === 'day' && !isWD) ? ' · rest day · no allocation' : ' · sales vs total expenses';
    subEl.textContent = data.periodLabel + sfx;
  }

  // Sales + expenses
  if (typeof f$ !== 'function') return;
  var fmt = f$;
  var sEl = document.getElementById('cov-sales');
  if (sEl) sEl.textContent = fmt(data.sales);
  var eEl = document.getElementById('cov-exp');
  if (eEl) eEl.textContent = fmt(data.totalExp);

  // Breakdown chip — respect allocation toggle
  var bdEl = document.getElementById('cov-breakdown');
  var b2 = (typeof biz === 'function') ? biz() : null;
  var allocOn2 = b2 && (b2.allocationsEnabled !== false);
  if (bdEl) {
    if (allocOn2 && data.allocExp > 0.01) {
      bdEl.style.display = '';
      bdEl.innerHTML = '💵 ' + fmt(data.actualExp) + ' actual + 📋 ' + fmt(data.allocExp) + ' allocated';
    } else {
      bdEl.style.display = 'none';
    }
  }

  // Result + badge + color
  var badgeEl = document.getElementById('cov-badge');
  var lblEl = document.getElementById('cov-result-lbl');
  var resEl = document.getElementById('cov-result');
  var msgEl = document.getElementById('cov-msg');

  var isCovered = data.surplus >= 0;
  var amt = Math.abs(data.surplus);

  if (isCovered) {
    if (badgeEl) {
      badgeEl.textContent = data.surplus > 0.01 ? 'COVERED ✓' : 'BREAK EVEN';
      badgeEl.style.background = 'var(--okb)';
      badgeEl.style.color = 'var(--ok)';
    }
    if (lblEl) {
      lblEl.textContent = 'SURPLUS';
      lblEl.style.color = 'var(--ok)';
    }
    if (resEl) {
      resEl.textContent = '+' + fmt(amt);
      resEl.style.color = 'var(--ok)';
    }
    if (msgEl) {
      if (data.surplus > 0.01) {
        msgEl.textContent = 'Sales covered all expenses';
        msgEl.style.color = 'var(--ok)';
      } else {
        msgEl.textContent = 'Sales matched expenses exactly';
        msgEl.style.color = 'var(--t2)';
      }
    }
  } else {
    if (badgeEl) {
      badgeEl.textContent = 'DEFICIT';
      badgeEl.style.background = 'rgba(239,68,68,.15)';
      badgeEl.style.color = 'var(--er)';
    }
    if (lblEl) {
      lblEl.textContent = 'DEFICIT';
      lblEl.style.color = 'var(--er)';
    }
    if (resEl) {
      resEl.textContent = '-' + fmt(amt);
      resEl.style.color = 'var(--er)';
    }
    if (msgEl) {
      msgEl.textContent = 'Short by ' + fmt(amt);
      msgEl.style.color = 'var(--er)';
    }
  }

  // Hide entire card if user lacks permission to see net profit
  // (because that means they shouldn't see business-wide financial data)
  try {
    var cardEl = document.getElementById('cov-card');
    if (cardEl) {
      var canSee = (typeof isAdmin === 'function' && isAdmin()) ||
                   (typeof hasPerm === 'function' && hasPerm('see_net_profit'));
      cardEl.style.display = canSee ? '' : 'none';
    }
  } catch(e){}
}

// Hook renderCoverage into renderDash
(function(){
  if (typeof renderDash === 'function') {
    var origRD = renderDash;
    window.renderDash = function(){
      try { origRD.apply(this, arguments); } catch(e) { console.warn(e); }
      try { renderCoverage(); } catch(e) { console.warn('renderCoverage:', e); }
    };
  }
})();




// ═══════════════════════════════════════════════════════════════════
//  PASSWORD RESET DRAWER (replaces ugly browser prompt)
// ═══════════════════════════════════════════════════════════════════

let _pwResetUserId = null;

function openAdminPwReset(userId){
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if(!u){ toast('User not found','er'); return; }
  _pwResetUserId = userId;
  // Populate user card
  if(el('pwreset-name')) el('pwreset-name').textContent = u.name || '--';
  if(el('pwreset-username')) el('pwreset-username').textContent = '@' + (u.username || u.name || '');
  if(el('pwreset-av')) el('pwreset-av').textContent = (typeof mkInit === 'function') ? mkInit(u.name) : (u.name||'?').slice(0,2).toUpperCase();
  if(el('pwreset-sub')) el('pwreset-sub').textContent = 'Set a new password for ' + u.name;
  // Reset fields
  if(el('pwreset-input')) el('pwreset-input').value = '';
  if(el('pwreset-input')) el('pwreset-input').type = 'password';
  if(el('pwreset-toggle')) el('pwreset-toggle').textContent = '👁';
  if(el('pwreset-strength')) el('pwreset-strength').style.display = 'none';
  openD('d-pwreset');
  setTimeout(function(){
    var inp = el('pwreset-input');
    if(inp) inp.focus();
  }, 220);
}

function togglePwResetVisibility(){
  var inp = el('pwreset-input');
  var btn = el('pwreset-toggle');
  if(!inp || !btn) return;
  if(inp.type === 'password'){
    inp.type = 'text';
    btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    btn.textContent = '👁';
  }
}

function checkPwStrength(){
  var inp = el('pwreset-input');
  if(!inp) return;
  var pw = inp.value || '';
  var box = el('pwreset-strength');
  if(!pw) {
    if(box) box.style.display = 'none';
    return;
  }
  if(box) box.style.display = '';
  // Score: 0-4 (length, mixed case, digit, special)
  var score = 0;
  if(pw.length >= 4) score++;
  if(pw.length >= 8) score++;
  if(/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if(/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  var colors = ['var(--er)','var(--wa)','var(--in)','var(--ok)'];
  var labels = ['Weak','Fair','Good','Strong'];
  for(var i=1; i<=4; i++){
    var seg = el('pwstr-' + i);
    if(seg) seg.style.background = (i <= score) ? colors[Math.min(score-1, 3)] : 'var(--s3)';
  }
  var lbl = el('pwstr-label');
  if(lbl){
    if(score === 0) { lbl.textContent = '--'; lbl.style.color = 'var(--t3)'; }
    else {
      lbl.textContent = labels[score-1] + ' password';
      lbl.style.color = colors[Math.min(score-1, 3)];
    }
  }
}

function generatePwReset(){
  // Generate a memorable strong password: AdjNounDigits (e.g., BlueOcean42)
  var adjectives = ['Quick','Bright','Bold','Calm','Strong','Smart','Swift','Lucky','Cool','Sharp'];
  var nouns = ['Tiger','Falcon','Mango','River','Mountain','Ocean','Forest','Eagle','Star','Lion'];
  var adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  var noun = nouns[Math.floor(Math.random() * nouns.length)];
  var num = Math.floor(10 + Math.random() * 90);
  var generated = adj + noun + num;
  var inp = el('pwreset-input');
  if(inp){
    inp.value = generated;
    inp.type = 'text';
    var btn = el('pwreset-toggle');
    if(btn) btn.textContent = '🙈';
    checkPwStrength();
    toast('Generated: ' + generated, 'gd');
  }
}

function confirmPwReset(){
  var pw = gv('pwreset-input');
  if(!pw || pw.length < 4){ toast('Password must be at least 4 characters','er'); return; }
  if(!_pwResetUserId){ toast('No user selected','er'); return; }
  var btn = el('pwreset-confirm-btn');
  if(btn) btn.disabled = true;
  try {
    adminResetUserPassword(_pwResetUserId, pw);
    closeD('d-pwreset');
    _pwResetUserId = null;
  } catch(e){
    console.warn('PW reset error:', e);
    toast('Reset failed','er');
  }
  if(btn) btn.disabled = false;
}

// ─── Track last login for inline stats ───
(function(){
  var origLoginAs = typeof loginAs === 'function' ? loginAs : null;
  if(origLoginAs){
    window.loginAs = function(user){
      try {
        if(user && DB.users){
          var u = DB.users.find(function(x){ return x.id === user.id; });
          if(u){
            u.lastLoginAt = Date.now();
          }
        }
      } catch(e){}
      return origLoginAs.apply(this, arguments);
    };
  }
})();



// ═══════════════════════════════════════════════════════════════════
//  ALLOCATION TOGGLE (dashboard Expense card + Business Settings)
// ═══════════════════════════════════════════════════════════════════

function toggleAllocations(){
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b) { toast('No business','er'); return; }
  if (typeof isAdmin === 'function' && !isAdmin()) {
    toast('Admin only','er');
    return;
  }
  b.allocationsEnabled = (b.allocationsEnabled === false);  // flip
  dbSave();
  try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
  updateAllocToggleUI();
  // Re-render dashboard so Expense card updates
  try { renderDash(); } catch(e){}
  try { renderCoverage(); } catch(e){}
  toast(b.allocationsEnabled ? '⚖️ Allocations ON' : '⚖️ Allocations OFF', 'gd');
}

function updateAllocToggleUI(){
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b) return;
  var enabled = (b.allocationsEnabled !== false);
  var sw = document.getElementById('alloc-toggle-switch');
  var knob = document.getElementById('alloc-toggle-knob');
  var lbl = document.getElementById('alloc-toggle-lbl');
  if (sw) sw.style.background = enabled ? 'var(--ok)' : 'var(--t4)';
  if (knob) knob.style.left = enabled ? '13px' : '1px';
  if (lbl) {
    lbl.style.color = enabled ? 'var(--ok)' : 'var(--t3)';
    lbl.textContent = enabled ? 'ALLOC' : 'OFF';
  }
  // Hide toggle for non-admins (they shouldn't touch it)
  var wrap = document.getElementById('alloc-toggle-wrap');
  if (wrap) {
    var canToggle = (typeof isAdmin === 'function' && isAdmin());
    wrap.style.display = canToggle ? '' : 'none';
  }
}

// Hook into renderDash to keep toggle UI in sync
(function(){
  if (typeof renderDash === 'function') {
    var prev = renderDash;
    window.renderDash = function(){
      try { prev.apply(this, arguments); } catch(e){}
      try { updateAllocToggleUI(); } catch(e){}
    };
  }
})();




// ═══════════════════════════════════════════════════════════════════
//  PROFILE PHOTOS — upload, store on user, display everywhere
// ═══════════════════════════════════════════════════════════════════

function handleProfilePhoto(inputEl){
  if(!inputEl || !inputEl.files || !inputEl.files[0]) return;
  var file = inputEl.files[0];
  if(file.size > 10*1024*1024){ toast('Photo too large (max 10MB)','er'); inputEl.value=''; return; }
  var reader = new FileReader();
  reader.onload = function(e){
    var img = new Image();
    img.onload = function(){
      try {
        var MAX = 400;  // Profile photos compressed to 400px
        var w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h*MAX/w); w = MAX; }
          else        { w = Math.round(w*MAX/h); h = MAX; }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        // Show in drawer preview
        var disp = document.getElementById('pe-photo-display');
        if (disp) {
          disp.style.backgroundImage = 'url("' + dataUrl + '")';
          var ini = document.getElementById('pe-photo-initials');
          if (ini) ini.style.display = 'none';
        }
        var removeBtn = document.getElementById('pe-photo-remove-btn');
        if (removeBtn) removeBtn.style.display = '';
        // Stash on a global so saveProfileEdit picks it up
        window._pendingProfilePhoto = dataUrl;
        toast('Photo ready — tap Save to apply','gd');
      } catch(err){
        console.warn('Profile photo error:', err);
        toast('Could not process photo','er');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeProfilePhoto(){
  window._pendingProfilePhoto = '_REMOVE_';
  var disp = document.getElementById('pe-photo-display');
  if (disp) {
    disp.style.backgroundImage = '';
    var ini = document.getElementById('pe-photo-initials');
    if (ini) ini.style.display = '';
  }
  var removeBtn = document.getElementById('pe-photo-remove-btn');
  if (removeBtn) removeBtn.style.display = 'none';
  toast('Photo will be removed on save','gd');
}

// Hook openProfileEdit to load existing photo
(function(){
  var origOpen = typeof openProfileEdit === 'function' ? openProfileEdit : null;
  if(origOpen){
    window.openProfileEdit = function(){
      try { origOpen.apply(this, arguments); } catch(e){}
      // Clear stash
      window._pendingProfilePhoto = null;
      // Populate photo preview
      var disp = document.getElementById('pe-photo-display');
      var ini = document.getElementById('pe-photo-initials');
      var removeBtn = document.getElementById('pe-photo-remove-btn');
      if (disp && CU) {
        if (ini) ini.textContent = (typeof mkInit === 'function') ? mkInit(CU.name) : (CU.name||'?').slice(0,2).toUpperCase();
        if (CU.profilePhoto) {
          disp.style.backgroundImage = 'url("' + CU.profilePhoto + '")';
          if (ini) ini.style.display = 'none';
          if (removeBtn) removeBtn.style.display = '';
        } else {
          disp.style.backgroundImage = '';
          if (ini) ini.style.display = '';
          if (removeBtn) removeBtn.style.display = 'none';
        }
      }
    };
  }
})();

// Hook saveProfileEdit to persist photo
(function(){
  var origSave = typeof saveProfileEdit === 'function' ? saveProfileEdit : null;
  if(origSave){
    window.saveProfileEdit = function(){
      // Apply photo first (so user record has latest)
      if (window._pendingProfilePhoto && CU) {
        if (window._pendingProfilePhoto === '_REMOVE_') {
          delete CU.profilePhoto;
          var u = (DB.users||[]).find(function(x){return x.id===CU.id;});
          if (u) delete u.profilePhoto;
        } else {
          CU.profilePhoto = window._pendingProfilePhoto;
          var u2 = (DB.users||[]).find(function(x){return x.id===CU.id;});
          if (u2) u2.profilePhoto = window._pendingProfilePhoto;
        }
        window._pendingProfilePhoto = null;
      }
      try { origSave.apply(this, arguments); } catch(e){}
      // Refresh sidebar avatar + topbar immediately with new photo
      try { if(typeof refreshSidebar === 'function') refreshSidebar(); } catch(e){}
      try { if(typeof updateTopbar === 'function') updateTopbar(); } catch(e){}
      // Also sync photo to Firebase so it shows in other users' chat
      try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
    };
  }
})();

// Helper: get the profile photo data URL for a user
function getUserPhoto(userId){
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  return u ? (u.profilePhoto || '') : '';
}

// Apply photo to an avatar element (or fall back to initials)
function applyAvatarPhoto(elId, userId){
  var avEl = document.getElementById(elId);
  if (!avEl) return;
  var photo = getUserPhoto(userId);
  if (photo) {
    avEl.style.backgroundImage = 'url("' + photo + '")';
    avEl.style.backgroundSize = 'cover';
    avEl.style.backgroundPosition = 'center';
    avEl.textContent = '';
  }
}


// ═══════════════════════════════════════════════════════════════════
//  CHAT COMPOSER — toggle mic vs send based on input
// ═══════════════════════════════════════════════════════════════════

function onChatInputChange(mode){
  var inp = document.getElementById(mode === 'group' ? 'chat-group-input' : 'chat-dm-input');
  if (!inp) return;
  var hasText = (inp.value || '').trim().length > 0;
  var mic  = document.getElementById('chat-mic-' + mode);
  var send = document.getElementById('chat-send-' + mode);
  if (mic)  mic.style.display  = hasText ? 'none' : '';
  if (send) send.style.display = hasText ? '' : 'none';
}


// ═══════════════════════════════════════════════════════════════════
//  VOICE RECORDER (hold to record, release to send, max 3 min)
// ═══════════════════════════════════════════════════════════════════

let _voiceRec = {
  recorder: null,
  chunks: [],
  startTime: 0,
  mode: null,
  timer: null,
  stream: null,
  cancelled: false,
  MAX_SECONDS: 180  // 3 minutes
};

async function startVoiceRecord(ev, mode){
  if (ev) { try { ev.preventDefault(); } catch(e){} }
  if (_voiceRec.recorder) return;  // already recording
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Voice not supported on this device','er');
    return;
  }
  try {
    _voiceRec.stream = await navigator.mediaDevices.getUserMedia({audio: true});
    _voiceRec.chunks = [];
    _voiceRec.cancelled = false;
    _voiceRec.mode = mode;
    _voiceRec.startTime = Date.now();

    // Use compatible mime type
    var mimeType = '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
    else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';

    _voiceRec.recorder = mimeType ? new MediaRecorder(_voiceRec.stream, {mimeType:mimeType, audioBitsPerSecond: 32000})
                                  : new MediaRecorder(_voiceRec.stream);
    _voiceRec.recorder.ondataavailable = function(e){
      if (e.data && e.data.size > 0) _voiceRec.chunks.push(e.data);
    };
    _voiceRec.recorder.onstop = function(){
      if (_voiceRec.cancelled) {
        cleanupVoiceRec();
        return;
      }
      var blob = new Blob(_voiceRec.chunks, {type: _voiceRec.recorder.mimeType || 'audio/webm'});
      var duration = Math.round((Date.now() - _voiceRec.startTime) / 1000);
      // Convert blob to base64 data URL
      var reader = new FileReader();
      reader.onload = function(e){
        sendVoiceMessage(_voiceRec.mode, e.target.result, duration);
        cleanupVoiceRec();
      };
      reader.readAsDataURL(blob);
    };
    _voiceRec.recorder.start();

    // Show overlay + indicate
    var ov = document.getElementById('voice-overlay');
    if (ov) ov.classList.add('on');
    var mic = document.getElementById('chat-mic-' + mode);
    if (mic) mic.classList.add('recording');

    // Timer
    _voiceRec.timer = setInterval(function(){
      var elapsed = Math.floor((Date.now() - _voiceRec.startTime) / 1000);
      var min = Math.floor(elapsed / 60);
      var sec = elapsed % 60;
      var t = document.getElementById('voice-overlay-time');
      if (t) t.textContent = min + ':' + (sec < 10 ? '0' : '') + sec;
      // Auto-stop at MAX
      if (elapsed >= _voiceRec.MAX_SECONDS) {
        var hint = document.getElementById('voice-overlay-hint');
        if (hint) hint.textContent = 'Max length reached — sending...';
        endVoiceRecord(null, _voiceRec.mode);
      }
    }, 200);
  } catch(err){
    console.warn('Voice record error:', err);
    if (err.name === 'NotAllowedError') {
      toast('Microphone access denied','er');
    } else {
      toast('Could not start recording','er');
    }
    cleanupVoiceRec();
  }
}

function endVoiceRecord(ev, mode){
  if (ev) { try { ev.preventDefault(); } catch(e){} }
  if (!_voiceRec.recorder || _voiceRec.cancelled) return;
  var elapsed = Math.floor((Date.now() - _voiceRec.startTime) / 1000);
  if (elapsed < 1) {
    // Too short — cancel
    cancelVoiceRecord(mode);
    toast('Hold longer to record','er');
    return;
  }
  try { _voiceRec.recorder.stop(); } catch(e){ console.warn(e); }
}

function cancelVoiceRecord(mode){
  if (!_voiceRec.recorder) return;
  _voiceRec.cancelled = true;
  try { _voiceRec.recorder.stop(); } catch(e){}
  cleanupVoiceRec();
  toast('Recording cancelled','er');
}

function cleanupVoiceRec(){
  if (_voiceRec.timer) clearInterval(_voiceRec.timer);
  if (_voiceRec.stream) {
    _voiceRec.stream.getTracks().forEach(function(t){ try{ t.stop(); }catch(e){} });
  }
  var ov = document.getElementById('voice-overlay');
  if (ov) ov.classList.remove('on');
  ['group','dm'].forEach(function(m){
    var mic = document.getElementById('chat-mic-' + m);
    if (mic) mic.classList.remove('recording');
  });
  _voiceRec = { recorder:null, chunks:[], startTime:0, mode:null, timer:null, stream:null, cancelled:false, MAX_SECONDS:180 };
}

function sendVoiceMessage(mode, dataUrl, durationSec){
  if (!CU || !CBI) { toast('Not signed in','er'); return; }
  if (!dataUrl) { toast('Empty recording','er'); return; }
  var convId = (mode === 'group') ? 'group' : chatConvId(CU.id, chatState.activePeer.id);

  if (!DB.chatMessages) DB.chatMessages = [];
  if (!DB.nextChatId) DB.nextChatId = 1;

  DB.chatMessages.push({
    id: DB.nextChatId++,
    bizId: CBI,
    conv: convId,
    from: CU.id,
    fromName: CU.name,
    text: '',
    photo: null,
    voice: dataUrl,
    voiceDur: durationSec,
    ts: Date.now(),
    readBy: [CU.id]
  });
  dbSave();
  try { if (typeof fbPush === 'function') fbPush(); } catch(e){}
  if (mode === 'group' && typeof renderGroupChat === 'function') renderGroupChat();
  else if (typeof renderDmConversation === 'function') renderDmConversation();
  toast('Voice sent','gd');
}


// ═══════════════════════════════════════════════════════════════════
//  CHAT BUBBLE — extended to render voice + use profile photo
// ═══════════════════════════════════════════════════════════════════

(function(){
  var origBuild = typeof buildChatBubble === 'function' ? buildChatBubble : null;
  // We override entirely to support voice + author avatar
  window.buildChatBubble = function(m, hideAuthor){
    var isMe = m.from === CU.id;
    var fromUser = (DB.users || []).find(function(u){ return u.id === m.from; });
    var fromName = fromUser ? (fromUser.name || fromUser.username) : (m.fromName || 'Unknown');
    var photoUrl = fromUser ? (fromUser.profilePhoto || '') : '';

    var photoHtml = m.photo ? '<img src="' + m.photo + '" alt="photo" onclick="viewChatPhoto(\'' + m.id + '\')">' : '';
    var textHtml  = m.text  ? esc(m.text) : '';
    var voiceHtml = '';
    if (m.voice) {
      var dur = m.voiceDur || 0;
      var min = Math.floor(dur / 60);
      var sec = dur % 60;
      var durLbl = min + ':' + (sec < 10 ? '0' : '') + sec;
      var bars = '';
      for (var i=0; i<18; i++){
        var hVal = 30 + (Math.sin(i*1.7) + Math.cos(i*0.5)) * 35;
        if (hVal < 20) hVal = 20;
        if (hVal > 100) hVal = 100;
        bars += '<div class="chat-voice-bar" style="height:' + Math.round(hVal*0.24) + 'px"></div>';
      }
      voiceHtml = '<div class="chat-voice">' +
        '<button type="button" class="chat-voice-play" onclick="playVoiceMsg(' + m.id + ', this)">▶</button>' +
        '<div class="chat-voice-bars">' + bars + '</div>' +
        '<div class="chat-voice-dur">' + durLbl + '</div>' +
        '<audio id="voice-audio-' + m.id + '" src="' + m.voice + '" preload="none" style="display:none"></audio>' +
      '</div>';
    }

    // Optional author avatar mini
    var avHtml = '';
    if (!isMe && !hideAuthor) {
      var bgStyle = photoUrl
        ? 'background-image:url(\'' + photoUrl + '\');background-size:cover;background-position:center'
        : 'background:linear-gradient(135deg,#64748b,#334155);color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:800';
      avHtml = '<div style="' + bgStyle + ';width:16px;height:16px;border-radius:50%;display:inline-block;vertical-align:middle;margin-right:6px;flex-shrink:0"></div>';
    }

    return '<div class="chat-msg ' + (isMe ? 'chat-msg-me' : 'chat-msg-them') + '">' +
      (isMe || hideAuthor ? '' : '<div class="chat-msg-author">' + avHtml + esc(fromName) + '</div>') +
      textHtml +
      photoHtml +
      voiceHtml +
      '<div class="chat-msg-meta">' + formatChatTime(m.ts) + '</div>' +
    '</div>';
  };
})();

// ─── Play voice message ───
function playVoiceMsg(msgId, btnEl){
  var audio = document.getElementById('voice-audio-' + msgId);
  if (!audio) return;
  // Stop all other audios
  document.querySelectorAll('audio[id^="voice-audio-"]').forEach(function(a){
    if (a !== audio) { try { a.pause(); a.currentTime = 0; } catch(e){} }
    // Reset their buttons
    var aid = a.id.replace('voice-audio-','');
    var bd = a.parentElement ? a.parentElement.querySelector('.chat-voice-play') : null;
    if (bd && a !== audio) bd.textContent = '▶';
  });
  if (audio.paused) {
    audio.play().then(function(){
      if (btnEl) btnEl.textContent = '⏸';
    }).catch(function(err){ console.warn(err); toast('Cannot play','er'); });
    audio.onended = function(){ if (btnEl) btnEl.textContent = '▶'; };
  } else {
    audio.pause();
    if (btnEl) btnEl.textContent = '▶';
  }
}

// ─── View chat photo full screen ───
function viewChatPhoto(msgId){
  var msg = (DB.chatMessages || []).find(function(m){ return String(m.id) === String(msgId); });
  if (!msg || !msg.photo) return;
  var w = window.open('','_blank');
  if (!w) { toast('Allow popups to view','er'); return; }
  w.document.write('<html><head><title>Photo</title></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="' + msg.photo + '" style="max-width:100%;max-height:100vh"></body></html>');
}




// ═══════════════════════════════════════════════════════════════════
//  REUSABLE BEAUTIFUL DELETE CONFIRMATION
//  Usage: confirmDelete({title, message, onYes})
// ═══════════════════════════════════════════════════════════════════

var _confirmDelCallback = null;

function confirmDelete(opts){
  if (!opts) return;
  _confirmDelCallback = opts.onYes || null;
  var t = document.getElementById('conf-title');
  var m = document.getElementById('conf-msg');
  if (t) t.textContent = opts.title || '⚠ Confirm Delete';
  if (m) m.innerHTML = opts.message || 'Are you sure you want to delete this?';
  openD('d-confirm-del');
}

function runConfirmDelete(){
  closeD('d-confirm-del');
  var cb = _confirmDelCallback;
  _confirmDelCallback = null;
  if (typeof cb === 'function') {
    try { cb(); } catch(e){ console.warn('confirmDelete callback error:', e); }
  }
}



// ─── Helper: get the active financial filter date range as {start, end} ───
function getFinFilterDateRange(){
  if (typeof finFilter === 'undefined' || !finFilter) return null;
  var today_ = (typeof today === 'function') ? today() : new Date().toISOString().split('T')[0];
  var ft = finFilter.dateMode || 'all';
  var start = '', end = today_;
  if (ft === 'today') {
    start = end = today_;
  } else if (ft === 'yesterday') {
    var y = new Date(today_ + 'T00:00:00');
    y.setDate(y.getDate() - 1);
    start = end = y.toISOString().split('T')[0];
  } else if (ft === 'thismonth') {
    var d1 = new Date(today_ + 'T00:00:00');
    start = new Date(d1.getFullYear(), d1.getMonth(), 1).toISOString().split('T')[0];
    end = today_;
  } else if (ft === 'lastmonth') {
    var d2 = new Date(today_ + 'T00:00:00');
    var lmFirst = new Date(d2.getFullYear(), d2.getMonth()-1, 1);
    var lmLast = new Date(d2.getFullYear(), d2.getMonth(), 0);
    start = lmFirst.toISOString().split('T')[0];
    end = lmLast.toISOString().split('T')[0];
  } else if (ft === 'single' && finFilter.singleDate) {
    start = end = finFilter.singleDate;
  } else if (ft === 'range' && finFilter.rangeStart && finFilter.rangeEnd) {
    start = finFilter.rangeStart;
    end = finFilter.rangeEnd;
  } else {
    // 'all' — find earliest/latest date from sales+expenses
    var b = biz();
    if (!b) return null;
    var allDates = [];
    (b.sales || []).forEach(function(s){ if(s.date) allDates.push(s.date); });
    (b.expenses || []).forEach(function(e){ if(e.date) allDates.push(e.date); });
    if (!allDates.length) return {start: today_, end: today_};
    allDates.sort();
    start = allDates[0];
    end = today_;
  }
  return {start: start, end: end};
}




// ═══════════════════════════════════════════════════════════════════
//  PROFIT BREAKDOWN — Gross + Net profit with Today/7Days/Month tabs
// ═══════════════════════════════════════════════════════════════════

let profitTab = 'day';

function switchProfitTab(tab){
  profitTab = tab;
  ['day','week','month'].forEach(function(t){
    var btn = document.getElementById('profit-tab-' + t);
    if(!btn) return;
    if(t === tab){
      btn.classList.add('on');
      btn.style.background = 'var(--g)';
      btn.style.color = '#000';
      btn.style.fontWeight = '700';
    } else {
      btn.classList.remove('on');
      btn.style.background = 'var(--s2)';
      btn.style.color = 'var(--t2)';
      btn.style.fontWeight = '600';
    }
  });
  renderProfitCard();
}

function getProfitData(period){
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b) return null;
  var now = today();
  var startDateStr, endDateStr, label;

  if (period === 'day') {
    startDateStr = endDateStr = now;
    label = 'Today';
  } else if (period === 'week') {
    var d = new Date(now + 'T00:00:00');
    var weekAgo = new Date(d);
    weekAgo.setDate(d.getDate() - 6);
    startDateStr = weekAgo.toISOString().split('T')[0];
    endDateStr = now;
    label = 'Last 7 Days';
  } else {
    var d2 = new Date(now + 'T00:00:00');
    startDateStr = new Date(d2.getFullYear(), d2.getMonth(), 1).toISOString().split('T')[0];
    endDateStr = now;
    label = d2.toLocaleString('default',{month:'long'}) + ' ' + d2.getFullYear();
  }

  // Revenue, product cost, gross profit
  var revenue = 0, productCost = 0, grossProfit = 0;
  (b.sales || []).forEach(function(s){
    if (!s || s.status === 'cancelled') return;
    if (s.date < startDateStr || s.date > endDateStr) return;
    var p = calcProfitForSale(s);
    revenue     += p.revenue;
    productCost += p.cost;
    grossProfit += p.profit;  // already discount-adjusted
  });

  // Cash expenses
  var actualExp = 0;
  (b.expenses || []).forEach(function(e){
    if (!e || e.status === 'cancelled') return;
    if (e.date < startDateStr || e.date > endDateStr) return;
    actualExp += (e.amount || 0);
  });

  // Allocations (respect toggle)
  var allocEnabled = (b.allocationsEnabled !== false);
  var allocExp = 0;
  if (allocEnabled) {
    var cur = new Date(startDateStr + 'T00:00:00');
    var endD = new Date(endDateStr + 'T00:00:00');
    while (cur <= endD) {
      var iso = cur.toISOString().split('T')[0];
      if (typeof getDayAllocations === 'function') {
        var a = getDayAllocations(iso);
        allocExp += (a && a.total) || 0;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  var totalExp = actualExp + allocExp;
  var netProfit = grossProfit - totalExp;
  var grossMargin = revenue > 0 ? (grossProfit / revenue * 100) : 0;
  var netMargin   = revenue > 0 ? (netProfit / revenue * 100) : 0;

  return {
    revenue: revenue,
    productCost: productCost,
    grossProfit: grossProfit,
    grossMargin: grossMargin,
    actualExp: actualExp,
    allocExp: allocExp,
    totalExp: totalExp,
    netProfit: netProfit,
    netMargin: netMargin,
    periodLabel: label
  };
}

function renderProfitCard(){
  var data = getProfitData(profitTab);
  if (!data) return;
  if (typeof f$ !== 'function') return;
  var fmt = f$;

  // Subtitle
  var subEl = document.getElementById('profit-sub');
  if (subEl) subEl.textContent = data.periodLabel + ' · gross profit vs net profit';

  // Gross side
  var gEl = document.getElementById('profit-gross');
  var gmEl = document.getElementById('profit-gross-margin');
  if (gEl)  {
    gEl.textContent = (data.grossProfit >= 0 ? '' : '-') + fmt(Math.abs(data.grossProfit));
    gEl.style.color = data.grossProfit >= 0 ? 'var(--in)' : 'var(--er)';
  }
  if (gmEl) gmEl.textContent = data.grossMargin.toFixed(1) + '% margin';

  // Net side
  var nEl = document.getElementById('profit-net');
  var nmEl = document.getElementById('profit-net-margin');
  if (nEl)  {
    nEl.textContent = (data.netProfit >= 0 ? '' : '-') + fmt(Math.abs(data.netProfit));
    nEl.style.color = data.netProfit >= 0 ? 'var(--ok)' : 'var(--er)';
  }
  if (nmEl) nmEl.textContent = data.netMargin.toFixed(1) + '% margin';

  // Badge
  var badgeEl = document.getElementById('profit-badge');
  if (badgeEl) {
    if (data.netProfit >= 0) {
      badgeEl.textContent = data.netProfit > 0.01 ? 'PROFITABLE' : 'BREAK EVEN';
      badgeEl.style.background = 'var(--okb)';
      badgeEl.style.color = 'var(--ok)';
    } else {
      badgeEl.textContent = 'LOSS';
      badgeEl.style.background = 'rgba(239,68,68,.15)';
      badgeEl.style.color = 'var(--er)';
    }
  }

  // Breakdown chip
  var bdEl = document.getElementById('profit-breakdown');
  if (bdEl) {
    var chips = ['Revenue ' + fmt(data.revenue)];
    if (data.productCost > 0.01) chips.push('Cost ' + fmt(data.productCost));
    if (data.totalExp > 0.01) chips.push('Expenses ' + fmt(data.totalExp));
    bdEl.innerHTML = chips.join(' · ');
  }

  // Hide if user lacks see_net_profit permission
  try {
    var cardEl = document.getElementById('profit-card');
    if (cardEl) {
      var canSee = (typeof isAdmin === 'function' && isAdmin()) ||
                   (typeof hasPerm === 'function' && hasPerm('see_net_profit'));
      cardEl.style.display = canSee ? '' : 'none';
    }
  } catch(e){}
}

// Hook renderProfitCard into renderDash
(function(){
  if (typeof renderDash === 'function') {
    var prev = renderDash;
    window.renderDash = function(){
      try { prev.apply(this, arguments); } catch(e){}
      try { renderProfitCard(); } catch(e){ console.warn('renderProfitCard:', e); }
    };
  }
})();




// ═══════════════════════════════════════════════════════════════════
//  PASSWORD HASHING  — SHA-256 via Web Crypto API
//  All passwords stored as "sha256:hexstring"
//  Plain-text passwords are auto-upgraded on first login
// ═══════════════════════════════════════════════════════════════════

const PW_PREFIX = 'sha256:';