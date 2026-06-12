/* SmartStock Pro V5 — Daily Closing Report Module */
var ClosingReport = {
  _usdBills:  [100, 50, 20, 10, 5, 1],
  _lrdBills:  [500, 100, 50, 20, 10, 5],

  /* ══════════════════════════════════════════════════════════════
     RENDER — On-screen closing report page
  ══════════════════════════════════════════════════════════════ */
  render: function() {
    var pg = Utils.get('pg-closing');
    if (!pg) return;

    var d        = Utils.today();
    var dateObj  = new Date(d + 'T12:00:00');
    var fullDate = dateObj.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';

    // ── DATA ────────────────────────────────────────────────────
    var sales    = DB.getSales().filter(function(s){ return s.date === d; });
    var expenses = DB.getExpenses().filter(function(e){ return e.date === d; });
    var allocs   = DB.getAllocatedDaily ? DB.getAllocatedDaily() : [];
    var allocDay = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    var allSales = DB.getSales();

    // Revenue
    var grossSales = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);

    // Payment methods
    var payMethods = {};
    sales.forEach(function(s){
      var m = (s.payment||'Cash');
      payMethods[m] = (payMethods[m]||0) + (parseFloat(s.total)||0);
    });
    var cashSales   = payMethods['Cash'] || 0;
    var momoSales   = (payMethods['Mobile Money']||0) + (payMethods['MoMo']||0);
    var bankSales   = payMethods['Bank Transfer'] || 0;
    var creditSales = sales.filter(function(s){ return s.status!=='Paid'; })
                           .reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);

    // Expenses by category
    var expCats = {};
    expenses.forEach(function(e){
      var cat = (e.category||'Other');
      expCats[cat] = (expCats[cat]||0) + (parseFloat(e.amount)||0);
    });
    var manExp   = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var totalExp = manExp + allocDay;
    var netProfit= grossSales - totalExp;
    var margin   = grossSales > 0 ? (netProfit/grossSales*100).toFixed(1) : 0;
    var isProfit = netProfit >= 0;

    // Customer debts
    var creditGiven = sales.filter(function(s){ return s.status!=='Paid'; })
                          .reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);
    var totalDebt   = allSales.filter(function(s){ return s.status!=='Paid'; })
                              .reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);

    // Business status
    var marginN = parseFloat(margin);
    var statusIcon, statusLabel, statusColor;
    if (isProfit && marginN >= 20) {
      statusIcon='🟢'; statusLabel='Excellent'; statusColor='var(--ok)';
    } else if (isProfit && marginN >= 5) {
      statusIcon='🟡'; statusLabel='Fair'; statusColor='var(--wa)';
    } else {
      statusIcon='🔴'; statusLabel='Needs Attention'; statusColor='var(--er)';
    }

    // ── HTML ────────────────────────────────────────────────────
    pg.innerHTML =
      '<div class="page-header">'
      + '<div><div class="page-title">Daily Closing</div><div class="page-sub">' + fullDate + '</div></div>'
      + '<div class="page-actions">'
      + '<button class="btn-primary btn-sm" onclick="ClosingReport.print()">🖨 Print</button>'
      + '</div></div>'

      // ── SECTION 1: PROFIT SUMMARY ──────────────────────────────
      + '<div class="sec">'
      + '<div class="sec-title">1. Profit Summary</div>'
      + '<div class="card card-body">'
      + ClosingReport._summaryRow('Gross Sales', Utils.cur(grossSales,cur), 'var(--g)', true)
      + ClosingReport._summaryRow('Total Expenses', '− ' + Utils.cur(totalExp,cur), 'var(--er)', false)
      + '<div style="height:1px;background:var(--bd2);margin:10px 0"></div>'
      + ClosingReport._summaryRow('NET PROFIT', Utils.cur(netProfit,cur), isProfit?'var(--ok)':'var(--er)', true, '18px')
      + ClosingReport._summaryRow('Profit Margin', margin + '%', isProfit?'var(--ok)':'var(--er)', false)
      + '<div style="text-align:center;margin-top:16px;padding:12px;background:' + (isProfit?'var(--okb)':'var(--erb)') + ';border:1.5px solid ' + (isProfit?'var(--okbd)':'var(--erbd)') + ';border-radius:var(--r12)">'
      + '<div style="font-size:22px;font-weight:900;color:' + (isProfit?'var(--ok)':'var(--er)') + '">'
      + (isProfit ? '✅ PROFIT' : '❌ LOSS') + '</div>'
      + '</div>'
      + '</div></div>'

      // ── SECTION 2: SALES SUMMARY ──────────────────────────────
      + '<div class="sec">'
      + '<div class="sec-title">2. Sales Summary</div>'
      + '<div class="card card-body">'
      + ClosingReport._row('Gross Sales', Utils.cur(grossSales,cur))
      + ClosingReport._row('Cash Sales', Utils.cur(cashSales,cur))
      + ClosingReport._row('Mobile Money', Utils.cur(momoSales,cur))
      + ClosingReport._row('Bank Transfer', Utils.cur(bankSales,cur))
      + (creditSales>0 ? ClosingReport._row('Credit Sales (Unpaid)', Utils.cur(creditSales,cur), 'var(--wa)') : '')
      + '<div style="height:1px;background:var(--bd2);margin:8px 0"></div>'
      + ClosingReport._row('Total Transactions', sales.length + ' sales', 'var(--t1)', true)
      + '</div></div>'

      // ── SECTION 3: EXPENSE SUMMARY ────────────────────────────
      + '<div class="sec">'
      + '<div class="sec-title">3. Expense Summary</div>'
      + '<div class="card card-body">'
      + ['Salary','Transportation','Rent','Utilities','Fuel','Internet','Marketing','Maintenance'].map(function(cat){
          var amt = expCats[cat] || 0;
          return ClosingReport._row(cat, amt > 0 ? Utils.cur(amt,cur) : '—', amt>0?'var(--er)':'var(--t3)');
        }).join('')
      + (expCats['Other'] || expCats['Miscellaneous'] ? ClosingReport._row('Other', Utils.cur((expCats['Other']||0)+(expCats['Miscellaneous']||0),cur), 'var(--er)') : '')
      + (allocDay > 0 ? ClosingReport._row('Allocated (Daily Share)', Utils.cur(allocDay,cur), 'var(--wa)') : '')
      + '<div style="height:1px;background:var(--bd2);margin:8px 0"></div>'
      + ClosingReport._row('TOTAL EXPENSES', Utils.cur(totalExp,cur), 'var(--er)', true)
      + '</div></div>'

      // ── SECTION 4: CASH COUNT RECONCILIATION ──────────────────
      + '<div class="sec">'
      + '<div class="sec-title">4. Cash Count Reconciliation</div>'

      // USD
      + '<div class="card card-body" style="margin-bottom:12px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">🇺🇸 US Dollar (USD)</div>'
      + '<div style="display:grid;grid-template-columns:2fr 2fr 2fr;gap:6px;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">'
      + '<span>Bill</span><span style="text-align:center">Qty</span><span style="text-align:right">Amount</span></div>'
      + ClosingReport._usdBills.map(function(b){
          return '<div style="display:grid;grid-template-columns:2fr 2fr 2fr;gap:6px;align-items:center;margin-bottom:8px">'
            + '<div style="font-size:13px;font-weight:600;color:var(--t1)">$' + b + '</div>'
            + '<input type="number" min="0" value="0" id="usd-' + b + '" oninput="ClosingReport.calcCash()"'
            + ' style="text-align:center;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:8px;padding:8px;font-size:14px;font-weight:700;color:var(--t1);-webkit-appearance:none">'
            + '<div id="usd-amt-' + b + '" style="text-align:right;font-size:13px;font-weight:700;color:var(--g);font-family:var(--fm)">$0.00</div>'
            + '</div>';
        }).join('')
      + '<div style="border-top:2px solid var(--bd2);padding-top:10px;margin-top:4px;display:flex;justify-content:space-between;align-items:center">'
      + '<span style="font-size:13px;font-weight:800;color:var(--t1)">TOTAL USD CASH</span>'
      + '<span id="total-usd" style="font-size:18px;font-weight:900;color:var(--g);font-family:var(--fm)">$0.00</span>'
      + '</div></div>'

      // LRD
      + '<div class="card card-body">'
      + '<div style="font-size:11px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">🇱🇷 Liberian Dollar (LRD)</div>'
      + '<div style="display:grid;grid-template-columns:2fr 2fr 2fr;gap:6px;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">'
      + '<span>Bill</span><span style="text-align:center">Qty</span><span style="text-align:right">Amount</span></div>'
      + ClosingReport._lrdBills.map(function(b){
          return '<div style="display:grid;grid-template-columns:2fr 2fr 2fr;gap:6px;align-items:center;margin-bottom:8px">'
            + '<div style="font-size:13px;font-weight:600;color:var(--t1)">L$' + b + '</div>'
            + '<input type="number" min="0" value="0" id="lrd-' + b + '" oninput="ClosingReport.calcCash()"'
            + ' style="text-align:center;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:8px;padding:8px;font-size:14px;font-weight:700;color:var(--t1);-webkit-appearance:none">'
            + '<div id="lrd-amt-' + b + '" style="text-align:right;font-size:13px;font-weight:700;color:var(--in);font-family:var(--fm)">L$0.00</div>'
            + '</div>';
        }).join('')
      + '<div style="border-top:2px solid var(--bd2);padding-top:10px;margin-top:4px;display:flex;justify-content:space-between;align-items:center">'
      + '<span style="font-size:13px;font-weight:800;color:var(--t1)">TOTAL LRD CASH</span>'
      + '<span id="total-lrd" style="font-size:18px;font-weight:900;color:var(--in);font-family:var(--fm)">L$0.00</span>'
      + '</div></div></div>'

      // ── SECTION 5: CUSTOMER DEBT SUMMARY ──────────────────────
      + '<div class="sec">'
      + '<div class="sec-title">5. Customer Debt Summary</div>'
      + '<div class="card card-body">'
      + ClosingReport._row('New Credit Given Today', Utils.cur(creditGiven,cur), creditGiven>0?'var(--wa)':'var(--ok)')
      + ClosingReport._row('Outstanding Customer Debt', Utils.cur(totalDebt,cur), totalDebt>0?'var(--er)':'var(--ok)')
      + (totalDebt > 0 ? '<div style="font-size:11px;color:var(--wa);margin-top:8px;padding:8px 10px;background:var(--wab);border-radius:var(--r8)">⚠️ Follow up on outstanding debts to improve cash flow.</div>' : '')
      + '</div></div>'

      // ── FINAL SUMMARY TABLE ────────────────────────────────────
      + '<div class="sec">'
      + '<div class="sec-title">Final Management Summary</div>'
      + '<div class="card card-body">'
      + ClosingReport._row('Gross Sales', Utils.cur(grossSales,cur), 'var(--g)', true)
      + ClosingReport._row('Total Expenses', Utils.cur(totalExp,cur), 'var(--er)', false)
      + ClosingReport._row('Net Profit', Utils.cur(netProfit,cur), isProfit?'var(--ok)':'var(--er)', true)
      + ClosingReport._row('Profit Margin', margin + '%', isProfit?'var(--ok)':'var(--er)', false)
      + ClosingReport._row('Cash USD', '<span id="sum-usd">$0.00</span>', 'var(--g)', false)
      + ClosingReport._row('Cash LRD', '<span id="sum-lrd">L$0.00</span>', 'var(--in)', false)
      + ClosingReport._row('Customer Debt', Utils.cur(totalDebt,cur), totalDebt>0?'var(--er)':'var(--ok)', false)
      + '<div style="margin-top:14px;padding:14px;text-align:center;background:var(--bg3);border-radius:var(--r12);border:1px solid var(--bd)">'
      + '<div style="font-size:22px;margin-bottom:8px">' + statusIcon + '</div>'
      + '<div style="font-size:16px;font-weight:800;color:' + statusColor + '">' + statusLabel + '</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:4px">Business Status for ' + fullDate + '</div>'
      + '</div>'
      + '</div>'

      // AI Comment
      + '<div style="margin-top:12px;background:var(--gb);border:1px solid rgba(212,168,67,.25);border-radius:var(--r14);padding:16px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🤖 AI Accountant Comment</div>'
      + '<div id="ai-closing-comment" style="font-size:13px;color:var(--t1);line-height:1.7">'
      + ClosingReport._autoComment(grossSales, netProfit, totalExp, totalDebt, isProfit, marginN, sales.length, cur)
      + '</div>'
      + '</div></div>'

      + '<div style="height:40px"></div>';
  },

  /* ── Live cash calculator ───────────────────────────────────── */
  calcCash: function() {
    var usdTotal = 0;
    ClosingReport._usdBills.forEach(function(b){
      var qty = parseInt((Utils.get('usd-'+b)||{value:'0'}).value)||0;
      var amt = qty * b;
      usdTotal += amt;
      var el = Utils.get('usd-amt-'+b);
      if (el) el.textContent = '$' + amt.toFixed(2);
    });
    var lrdTotal = 0;
    ClosingReport._lrdBills.forEach(function(b){
      var qty = parseInt((Utils.get('lrd-'+b)||{value:'0'}).value)||0;
      var amt = qty * b;
      lrdTotal += amt;
      var el = Utils.get('lrd-amt-'+b);
      if (el) el.textContent = 'L$' + amt.toFixed(2);
    });
    var usdEl = Utils.get('total-usd');
    var lrdEl = Utils.get('total-lrd');
    var sumU  = Utils.get('sum-usd');
    var sumL  = Utils.get('sum-lrd');
    if (usdEl) usdEl.textContent = '$' + usdTotal.toFixed(2);
    if (lrdEl) lrdEl.textContent = 'L$' + lrdTotal.toFixed(2);
    if (sumU) sumU.textContent = '$' + usdTotal.toFixed(2);
    if (sumL) sumL.textContent = 'L$' + lrdTotal.toFixed(2);
  },

  /* ── Auto comment ───────────────────────────────────────────── */
  _autoComment: function(rev, net, exp, debt, isProfit, margin, txCount, cur) {
    var lines = [];
    if (rev === 0) {
      return 'No sales were recorded today. If this is unexpected, verify that transactions were properly saved. Focus on sales activity tomorrow.';
    }
    if (isProfit) {
      lines.push('The business made a profit of ' + Utils.cur(net,cur) + ' today (' + margin + '% margin) from ' + txCount + ' transaction' + (txCount!==1?'s':'') + ' — a positive result.');
    } else {
      lines.push('The business recorded a loss of ' + Utils.cur(Math.abs(net),cur) + ' today. Expenses exceeded revenue and require immediate review.');
    }
    if (exp > rev * 0.5 && rev > 0) {
      lines.push('Expenses represent over 50% of revenue — cost control should be a priority tomorrow.');
    } else if (exp > 0) {
      lines.push('Expenses are within acceptable range at ' + (rev>0?(exp/rev*100).toFixed(0):0) + '% of revenue.');
    }
    if (debt > 0) {
      lines.push('Outstanding customer debt of ' + Utils.cur(debt,cur) + ' needs follow-up — contact top debtors first thing tomorrow.');
    } else {
      lines.push('No outstanding customer debts — excellent collections performance.');
    }
    return lines.join(' ');
  },

  /* ── HTML helpers ───────────────────────────────────────────── */
  _row: function(label, value, color, bold) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">' + label + '</span>'
      + '<span style="font-size:' + (bold?'15px':'13px') + ';font-weight:' + (bold?'800':'600') + ';color:' + (color||'var(--t1)') + ';font-family:var(--fm)">' + value + '</span>'
      + '</div>';
  },

  _summaryRow: function(label, value, color, bold, fontSize) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;font-weight:' + (bold?'700':'400') + ';color:var(--t1)">' + label + '</span>'
      + '<span style="font-size:' + (fontSize||'14px') + ';font-weight:800;color:' + (color||'var(--t1)') + ';font-family:var(--fm)">' + value + '</span>'
      + '</div>';
  },

  /* ══════════════════════════════════════════════════════════════
     PRINT — Professional A4 Closing Report
  ══════════════════════════════════════════════════════════════ */
  print: function() {
    var d        = Utils.today();
    var dateObj  = new Date(d + 'T12:00:00');
    var fullDate = dateObj.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var bizAddr  = settings.bizAddress|| '';
    var bizPhone = settings.bizPhone  || '';
    var bizLogo  = settings.bizLogo   || '';
    var user     = Auth.currentUser   || {};
    var userName = user.name || user.username || '';
    var now      = new Date();
    var timeStr  = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

    // Data
    var sales    = DB.getSales().filter(function(s){ return s.date === d; });
    var expenses = DB.getExpenses().filter(function(e){ return e.date === d; });
    var allocs   = DB.getAllocatedDaily ? DB.getAllocatedDaily() : [];
    var allocDay = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    var allSales = DB.getSales();

    var grossSales = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var payMethods = {};
    sales.forEach(function(s){ var m=s.payment||'Cash'; payMethods[m]=(payMethods[m]||0)+(parseFloat(s.total)||0); });
    var cashSales = payMethods['Cash']||0;
    var momoSales = (payMethods['Mobile Money']||0)+(payMethods['MoMo']||0);
    var bankSales = payMethods['Bank Transfer']||0;
    var creditSalesAmt = sales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
    var expCats  = {};
    expenses.forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });
    var manExp   = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var totalExp = manExp + allocDay;
    var netProfit= grossSales - totalExp;
    var margin   = grossSales > 0 ? (netProfit/grossSales*100).toFixed(1) : '0.0';
    var isProfit = netProfit >= 0;
    var totalDebt= allSales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
    var creditGiven = sales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    // Get cash count from inputs
    var usdTotal = 0;
    ClosingReport._usdBills.forEach(function(b){
      var el = Utils.get('usd-'+b);
      usdTotal += (el ? parseInt(el.value)||0 : 0) * b;
    });
    var lrdTotal = 0;
    ClosingReport._lrdBills.forEach(function(b){
      var el = Utils.get('lrd-'+b);
      lrdTotal += (el ? parseInt(el.value)||0 : 0) * b;
    });

    var marginN = parseFloat(margin);
    var statusIcon, statusLabel;
    if (isProfit && marginN >= 20) { statusIcon='🟢'; statusLabel='EXCELLENT'; }
    else if (isProfit && marginN >= 5) { statusIcon='🟡'; statusLabel='FAIR'; }
    else { statusIcon='🔴'; statusLabel='NEEDS ATTENTION'; }

    var logoHtml = bizLogo
      ? '<img src="'+bizLogo+'" style="width:64px;height:64px;object-fit:contain;border-radius:10px" onerror="this.style.display=\'none\'">'
      : '';

    // Cash count rows
    var usdRows = ClosingReport._usdBills.map(function(b){
      var el = Utils.get('usd-'+b);
      var qty = el ? parseInt(el.value)||0 : 0;
      return '<tr><td>$'+b+'</td><td style="text-align:center">'+qty+'</td><td style="text-align:right;font-weight:700">$'+(qty*b).toFixed(2)+'</td></tr>';
    }).join('');
    var lrdRows = ClosingReport._lrdBills.map(function(b){
      var el = Utils.get('lrd-'+b);
      var qty = el ? parseInt(el.value)||0 : 0;
      return '<tr><td>L$'+b+'</td><td style="text-align:center">'+qty+'</td><td style="text-align:right;font-weight:700">L$'+(qty*b).toFixed(2)+'</td></tr>';
    }).join('');

    var css = '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff}'
      + '.page{max-width:210mm;margin:0 auto;padding:14mm}'
      + '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:18px}'
      + '.biz{font-size:22px;font-weight:900;letter-spacing:-.02em;margin-bottom:3px}'
      + '.meta{font-size:10px;color:#555;margin-top:2px}'
      + 'h2{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#333;border-bottom:2px solid #111;padding-bottom:4px;margin:18px 0 10px}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:12px}'
      + 'th{background:#111;color:#fff;padding:7px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;text-align:left}'
      + 'td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px}'
      + '.tr{background:#f9fafb}'
      + '.sum-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e5e7eb;font-size:12px}'
      + '.sum-total{font-size:16px;font-weight:900;border-top:2px solid #111;border-bottom:none;padding-top:10px;margin-top:4px}'
      + '.profit-box{text-align:center;padding:14px;border-radius:8px;margin:12px 0}'
      + '.badge-ok{background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700}'
      + '.badge-er{background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700}'
      + '.badge-wa{background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700}'
      + '.sig-line{display:flex;gap:20px;margin-top:30px}'
      + '.sig{flex:1;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#555}'
      + '.footer{text-align:center;font-size:10px;color:#888;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px}'
      + '@media print{@page{size:A4;margin:10mm}.page{padding:0}}';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Closing — '+Utils.esc(bizName)+'</title><style>'+css+'</style></head><body>'
      + '<div class="page">'

      // Header
      + '<div class="header">'
      + '<div style="display:flex;gap:14px;align-items:flex-start">'
      + logoHtml
      + '<div>'
      + '<div class="biz">'+Utils.esc(bizName)+'</div>'
      + (bizAddr ? '<div class="meta">📍 '+Utils.esc(bizAddr)+'</div>' : '')
      + (bizPhone? '<div class="meta">📞 '+Utils.esc(bizPhone)+'</div>' : '')
      + '<div class="meta" style="font-size:12px;font-weight:700;margin-top:6px;text-transform:uppercase;letter-spacing:.08em;color:#333">Daily Closing Report</div>'
      + '<div class="meta">'+fullDate+'</div>'
      + '</div></div>'
      + '<div style="text-align:right">'
      + '<div class="meta">Prepared by: '+Utils.esc(userName)+'</div>'
      + '<div class="meta">Time: '+timeStr+'</div>'
      + '<div style="margin-top:8px;font-size:14px;font-weight:900">'+statusIcon+' '+statusLabel+'</div>'
      + '</div></div>'

      // Section 1 — Profit
      + '<h2>1. Profit Summary</h2>'
      + '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:12px">'
      + '<div class="sum-row"><span>Gross Sales</span><span style="font-weight:700">'+Utils.cur(grossSales,cur)+'</span></div>'
      + '<div class="sum-row"><span>Less: Expenses</span><span style="font-weight:700;color:#dc2626">− '+Utils.cur(totalExp,cur)+'</span></div>'
      + '<div class="sum-row sum-total"><span>NET PROFIT</span><span style="color:'+(isProfit?'#16a34a':'#dc2626')+'">'+Utils.cur(netProfit,cur)+'</span></div>'
      + '<div class="sum-row" style="border:none;padding-top:6px"><span>Profit Margin</span><span style="font-weight:700">'+margin+'%</span></div>'
      + '</div>'
      + '<div class="profit-box" style="background:'+(isProfit?'#d1fae5':'#fee2e2')+';border:1.5px solid '+(isProfit?'#16a34a':'#dc2626')+'">'
      + '<div style="font-size:20px;font-weight:900;color:'+(isProfit?'#065f46':'#991b1b')+'">'+(isProfit?'✅ PROFIT':'❌ LOSS')+'</div>'
      + '</div>'

      // Section 2 — Sales
      + '<h2>2. Sales Summary</h2>'
      + '<table><thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + '<tr><td>Gross Sales</td><td style="text-align:right;font-weight:700">'+Utils.cur(grossSales,cur)+'</td></tr>'
      + '<tr class="tr"><td>Cash Sales</td><td style="text-align:right">'+Utils.cur(cashSales,cur)+'</td></tr>'
      + '<tr><td>Mobile Money Sales</td><td style="text-align:right">'+Utils.cur(momoSales,cur)+'</td></tr>'
      + '<tr class="tr"><td>Bank Transfer Sales</td><td style="text-align:right">'+Utils.cur(bankSales,cur)+'</td></tr>'
      + (creditSalesAmt>0 ? '<tr><td style="color:#d97706">Credit Sales (Unpaid Balance)</td><td style="text-align:right;color:#d97706">'+Utils.cur(creditSalesAmt,cur)+'</td></tr>' : '')
      + '<tr style="background:#111;color:#fff"><td style="font-weight:700">Total Transactions</td><td style="text-align:right;font-weight:700">'+sales.length+' sales</td></tr>'
      + '</tbody></table>'

      // Section 3 — Expenses
      + '<h2>3. Expense Summary</h2>'
      + '<table><thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + ['Salary','Transportation','Rent','Utilities','Fuel','Internet','Marketing','Maintenance'].map(function(cat,i){
          var amt = expCats[cat]||0;
          return '<tr'+(i%2?' class="tr"':'')+'><td>'+cat+'</td><td style="text-align:right">'+(amt>0?Utils.cur(amt,cur):'—')+'</td></tr>';
        }).join('')
      + ((expCats['Other']||0)+(expCats['Miscellaneous']||0)>0 ? '<tr><td>Other / Miscellaneous</td><td style="text-align:right">'+Utils.cur((expCats['Other']||0)+(expCats['Miscellaneous']||0),cur)+'</td></tr>' : '')
      + (allocDay>0 ? '<tr class="tr"><td>Allocated (Daily Share)</td><td style="text-align:right">'+Utils.cur(allocDay,cur)+'</td></tr>' : '')
      + '<tr style="background:#111;color:#fff"><td style="font-weight:700">TOTAL EXPENSES</td><td style="text-align:right;font-weight:700">'+Utils.cur(totalExp,cur)+'</td></tr>'
      + '</tbody></table>'

      // Section 4 — Cash Count
      + '<h2>4. Cash Count Reconciliation</h2>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">'
      // USD
      + '<div><div style="font-size:11px;font-weight:700;margin-bottom:6px">🇺🇸 US Dollar (USD)</div>'
      + '<table><thead><tr><th>Bill</th><th>Qty</th><th>Amount</th></tr></thead><tbody>'
      + usdRows
      + '</tbody><tfoot><tr style="background:#111;color:#fff"><td colspan="2" style="font-weight:700">TOTAL USD</td><td style="text-align:right;font-weight:700">$'+usdTotal.toFixed(2)+'</td></tr></tfoot></table></div>'
      // LRD
      + '<div><div style="font-size:11px;font-weight:700;margin-bottom:6px">🇱🇷 Liberian Dollar (LRD)</div>'
      + '<table><thead><tr><th>Bill</th><th>Qty</th><th>Amount</th></tr></thead><tbody>'
      + lrdRows
      + '</tbody><tfoot><tr style="background:#111;color:#fff"><td colspan="2" style="font-weight:700">TOTAL LRD</td><td style="text-align:right;font-weight:700">L$'+lrdTotal.toFixed(2)+'</td></tr></tfoot></table></div>'
      + '</div>'

      // Section 5 — Customer Debt
      + '<h2>5. Customer Debt Summary</h2>'
      + '<table><thead><tr><th>Metric</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + '<tr><td>New Credit Given Today</td><td style="text-align:right;color:#d97706;font-weight:700">'+Utils.cur(creditGiven,cur)+'</td></tr>'
      + '<tr class="tr"><td>Outstanding Customer Debt (Total)</td><td style="text-align:right;color:#dc2626;font-weight:700">'+Utils.cur(totalDebt,cur)+'</td></tr>'
      + '</tbody></table>'

      // Final Summary
      + '<h2>Final Management Summary</h2>'
      + '<table><thead><tr><th>Metric</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + '<tr><td>Gross Sales</td><td style="text-align:right;font-weight:700">'+Utils.cur(grossSales,cur)+'</td></tr>'
      + '<tr class="tr"><td>Total Expenses</td><td style="text-align:right;font-weight:700;color:#dc2626">'+Utils.cur(totalExp,cur)+'</td></tr>'
      + '<tr><td style="font-weight:700">Net Profit</td><td style="text-align:right;font-weight:900;color:'+(isProfit?'#16a34a':'#dc2626')+'">'+Utils.cur(netProfit,cur)+'</td></tr>'
      + '<tr class="tr"><td>Profit Margin</td><td style="text-align:right;font-weight:700">'+margin+'%</td></tr>'
      + '<tr><td>USD Cash Counted</td><td style="text-align:right;font-weight:700">$'+usdTotal.toFixed(2)+'</td></tr>'
      + '<tr class="tr"><td>LRD Cash Counted</td><td style="text-align:right;font-weight:700">L$'+lrdTotal.toFixed(2)+'</td></tr>'
      + '<tr><td>Customer Debt Outstanding</td><td style="text-align:right;font-weight:700;color:#dc2626">'+Utils.cur(totalDebt,cur)+'</td></tr>'
      + '</tbody></table>'

      // Status
      + '<div style="text-align:center;padding:14px;background:'+(isProfit&&marginN>=20?'#d1fae5':isProfit?'#fef3c7':'#fee2e2')+';border-radius:8px;margin:12px 0">'
      + '<div style="font-size:20px;font-weight:900">'+statusIcon+' '+statusLabel+'</div>'
      + '</div>'

      // AI Comment
      + '<div style="background:#f9f3e3;border:1.5px solid #D4A843;border-radius:8px;padding:14px;margin:12px 0">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#8C6A18;margin-bottom:6px">🤖 AI Accountant Comment</div>'
      + '<div style="font-size:12px;color:#111;line-height:1.75">'
      + ClosingReport._autoComment(grossSales, netProfit, totalExp, totalDebt, isProfit, marginN, sales.length, cur)
      + '</div></div>'

      // Signatures
      + '<div class="sig-line">'
      + '<div class="sig">Cashier / Prepared by: _______________________ &nbsp; Date: ___________</div>'
      + '<div class="sig">Manager / Approved by: _______________________ &nbsp; Date: ___________</div>'
      + '</div>'
      + '<div class="footer">SmartStock Pro &nbsp;|&nbsp; '+Utils.esc(bizName)+' &nbsp;|&nbsp; '+fullDate+'</div>'
      + '</div></body></html>';

    if (typeof Sales !== 'undefined' && Sales._printHtml) {
      Sales._printHtml(html, 'closing-print-frame');
    } else {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
      document.body.appendChild(f);
      f.contentDocument.open();
      f.contentDocument.write(html);
      f.contentDocument.close();
      setTimeout(function(){ try{f.contentWindow.print();}catch(e){window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank');} }, 600);
    }
  },
};
