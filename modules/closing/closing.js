/* SmartStock Pro V5 — Daily Closing Report */
var ClosingReport = {
  _usdBills: [100, 50, 20, 10, 5, 1],
  _lrdBills: [500, 100, 50, 20, 10, 5],

  /* ══════════════════════════════════════════════════════════════
     RENDER
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
    var lrdRate  = parseFloat(settings.lrdRate) || 198;

    // ── DATA ────────────────────────────────────────────────────
    var sales    = DB.getSales().filter(function(s){ return s.date === d; });
    var expenses = DB.getExpenses().filter(function(e){ return e.date === d; });
    var allocs   = DB.getAllocatedDaily ? DB.getAllocatedDaily() : [];
    var allocDay = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    var allSales = DB.getSales();

    var grossSales  = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var manExp      = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var totalExp    = manExp + allocDay;
    var netProfit   = grossSales - totalExp;
    var margin      = grossSales > 0 ? (netProfit/grossSales*100).toFixed(1) : '0.0';
    var isProfit    = netProfit >= 0;

    var payMethods  = {};
    sales.forEach(function(s){ var m=s.payment||'Cash'; payMethods[m]=(payMethods[m]||0)+(parseFloat(s.total)||0); });
    var cashSales   = payMethods['Cash']||0;
    var momoSales   = (payMethods['Mobile Money']||0)+(payMethods['MoMo']||0);
    var bankSales   = payMethods['Bank Transfer']||0;
    var creditAmt   = sales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    var expCats = {};
    expenses.forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });

    var creditGiven = sales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
    var totalDebt   = allSales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    var marginN = parseFloat(margin);
    var statusIcon, statusLabel, statusColor;
    if (isProfit && marginN >= 20)     { statusIcon='🟢'; statusLabel='Excellent';        statusColor='var(--ok)'; }
    else if (isProfit && marginN >= 5)  { statusIcon='🟡'; statusLabel='Fair';             statusColor='var(--wa)'; }
    else                                { statusIcon='🔴'; statusLabel='Needs Attention';  statusColor='var(--er)'; }

    pg.innerHTML =
      '<div class="page-header">'
      + '<div><div class="page-title">Daily Closing</div><div class="page-sub">' + fullDate + '</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="ClosingReport.print()">🖨 Print</button></div>'
      + '</div>'

      // ── 1. PROFIT SUMMARY ─────────────────────────────────────
      + '<div class="sec"><div class="sec-title">1. Profit Summary</div>'
      + '<div class="card card-body">'
      + ClosingReport._row('Gross Sales',   Utils.cur(grossSales,cur), 'var(--g)', true)
      + ClosingReport._row('Total Expenses','− '+Utils.cur(totalExp,cur), 'var(--er)', false)
      + '<div style="height:1px;background:var(--bd2);margin:10px 0"></div>'
      + ClosingReport._row('NET PROFIT', Utils.cur(netProfit,cur), isProfit?'var(--ok)':'var(--er)', true, '18px')
      + ClosingReport._row('Profit Margin', margin+'%', isProfit?'var(--ok)':'var(--er)', false)
      + '<div style="text-align:center;margin-top:14px;padding:12px;background:'+(isProfit?'var(--okb)':'var(--erb)')+';border:1.5px solid '+(isProfit?'var(--okbd)':'var(--erbd)')+';border-radius:var(--r12)">'
      + '<div style="font-size:22px;font-weight:900;color:'+(isProfit?'var(--ok)':'var(--er)') + '">' + (isProfit?'✅ PROFIT':'❌ LOSS') + '</div>'
      + '</div></div></div>'

      // ── 2. SALES SUMMARY ──────────────────────────────────────
      + '<div class="sec"><div class="sec-title">2. Sales Summary</div>'
      + '<div class="card card-body">'
      + ClosingReport._row('Gross Sales',       Utils.cur(grossSales,cur))
      + ClosingReport._row('Cash Sales',         Utils.cur(cashSales,cur))
      + ClosingReport._row('Mobile Money',       Utils.cur(momoSales,cur))
      + ClosingReport._row('Bank Transfer',      Utils.cur(bankSales,cur))
      + (creditAmt>0 ? ClosingReport._row('Credit (Unpaid)',Utils.cur(creditAmt,cur),'var(--wa)') : '')
      + '<div style="height:1px;background:var(--bd2);margin:8px 0"></div>'
      + ClosingReport._row('Total Transactions', sales.length+' sales','var(--t1)',true)
      + '</div></div>'

      // ── 3. EXPENSE SUMMARY ────────────────────────────────────
      + '<div class="sec"><div class="sec-title">3. Expense Summary</div>'
      + '<div class="card card-body">'
      + ['Salary','Transportation','Rent','Utilities','Fuel','Internet','Marketing','Maintenance'].map(function(cat){
          var a=expCats[cat]||0;
          return ClosingReport._row(cat, a>0?Utils.cur(a,cur):'—', a>0?'var(--er)':'var(--t3)');
        }).join('')
      + ((expCats['Other']||0)+(expCats['Miscellaneous']||0)>0 ? ClosingReport._row('Other',Utils.cur((expCats['Other']||0)+(expCats['Miscellaneous']||0),cur),'var(--er)') : '')
      + (allocDay>0 ? ClosingReport._row('Allocated (Daily)',Utils.cur(allocDay,cur),'var(--wa)') : '')
      + '<div style="height:1px;background:var(--bd2);margin:8px 0"></div>'
      + ClosingReport._row('TOTAL EXPENSES', Utils.cur(totalExp,cur),'var(--er)',true)
      + '</div></div>'

      // ── 4. CASH COUNT RECONCILIATION ──────────────────────────
      + '<div class="sec"><div class="sec-title">4. Cash Count Reconciliation</div>'

      // Rate setter
      + '<div style="background:var(--gb3);border:1px solid rgba(212,168,67,.2);border-radius:var(--r12);padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px">'
      + '<span style="font-size:13px;color:var(--t1);font-weight:600;white-space:nowrap">🇱🇷 Exchange Rate:</span>'
      + '<span style="font-size:12px;color:var(--t2);white-space:nowrap">L$</span>'
      + '<input type="number" id="cl-rate" value="'+lrdRate+'" min="1" placeholder="'+lrdRate+'"'
      + ' oninput="ClosingReport.calcCash()"'
      + ' style="width:90px;text-align:center;background:var(--bg3);border:1.5px solid rgba(212,168,67,.3);border-radius:8px;padding:7px;font-size:15px;font-weight:800;color:var(--g)">'
      + '<span style="font-size:12px;color:var(--t2)">per $1 USD</span>'
      + '<button onclick="ClosingReport.saveRate()" class="btn-ghost btn-sm" style="margin-left:auto;color:var(--g);border-color:rgba(212,168,67,.3)">💾 Save</button>'
      + '</div>'

      // USD bills
      + '<div class="card card-body" style="margin-bottom:12px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">🇺🇸 US Dollar Cash</div>'
      + '<div style="display:grid;grid-template-columns:2fr 2fr 2fr;gap:6px;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;padding-bottom:8px;border-bottom:1px solid var(--bd)">'
      + '<span>Bill</span><span style="text-align:center">Qty</span><span style="text-align:right">Amount</span></div>'
      + ClosingReport._usdBills.map(function(b){
          return '<div style="display:grid;grid-template-columns:2fr 2fr 2fr;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd)">'
            + '<div style="font-size:14px;font-weight:700;color:var(--t1)">$'+b+'</div>'
            + '<input type="number" id="usd-'+b+'" min="0" placeholder=""'
            + ' oninput="ClosingReport.calcCash()"'
            + ' style="text-align:center;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:8px;padding:8px;font-size:15px;font-weight:700;color:var(--t1);-webkit-appearance:none;width:100%">'
            + '<div id="usd-amt-'+b+'" style="text-align:right;font-size:13px;font-weight:700;color:var(--g);font-family:var(--fm)"></div>'
            + '</div>';
        }).join('')
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;margin-top:4px;border-top:2px solid var(--bd2)">'
      + '<span style="font-size:13px;font-weight:800">TOTAL USD CASH</span>'
      + '<span id="total-usd" style="font-size:20px;font-weight:900;color:var(--g);font-family:var(--fm)">—</span>'
      + '</div></div>'

      // LRD bills
      + '<div class="card card-body" style="margin-bottom:12px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">🇱🇷 Liberian Dollar Cash</div>'
      + '<div style="display:grid;grid-template-columns:2fr 2fr 2fr;gap:6px;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;padding-bottom:8px;border-bottom:1px solid var(--bd)">'
      + '<span>Bill</span><span style="text-align:center">Qty</span><span style="text-align:right">Amount</span></div>'
      + ClosingReport._lrdBills.map(function(b){
          return '<div style="display:grid;grid-template-columns:2fr 2fr 2fr;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd)">'
            + '<div style="font-size:14px;font-weight:700;color:var(--t1)">L$'+b+'</div>'
            + '<input type="number" id="lrd-'+b+'" min="0" placeholder=""'
            + ' oninput="ClosingReport.calcCash()"'
            + ' style="text-align:center;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:8px;padding:8px;font-size:15px;font-weight:700;color:var(--t1);-webkit-appearance:none;width:100%">'
            + '<div id="lrd-amt-'+b+'" style="text-align:right;font-size:13px;font-weight:700;color:var(--in);font-family:var(--fm)"></div>'
            + '</div>';
        }).join('')
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;margin-top:4px;border-top:2px solid var(--bd2)">'
      + '<span style="font-size:13px;font-weight:800">TOTAL LRD CASH</span>'
      + '<span id="total-lrd" style="font-size:20px;font-weight:900;color:var(--in);font-family:var(--fm)">—</span>'
      + '</div>'
      // LRD converted to USD
      + '<div style="margin-top:10px;background:var(--inb);border-radius:var(--r8);padding:10px 14px;display:flex;justify-content:space-between;align-items:center">'
      + '<span style="font-size:12px;color:var(--in)">LRD converted to USD</span>'
      + '<span id="lrd-usd" style="font-size:15px;font-weight:800;color:var(--in);font-family:var(--fm)">$0.00</span>'
      + '</div></div>'

      // Combined total cash
      + '<div class="card card-body" style="background:var(--gb3);border-color:rgba(212,168,67,.25)">'
      + '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">💰 Total Cash (USD + LRD converted)</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">USD Cash</span>'
      + '<span id="comb-usd" style="font-size:14px;font-weight:700;color:var(--g);font-family:var(--fm)">—</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">LRD Cash (in USD)</span>'
      + '<span id="comb-lrd" style="font-size:14px;font-weight:700;color:var(--in);font-family:var(--fm)">—</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 0">'
      + '<span style="font-size:15px;font-weight:800;color:var(--t1)">TOTAL CASH (USD)</span>'
      + '<span id="total-cash-usd" style="font-size:22px;font-weight:900;color:var(--g);font-family:var(--fm)">—</span>'
      + '</div></div></div>'

      // ── 5. RECONCILIATION ─────────────────────────────────────
      + '<div class="sec"><div class="sec-title">5. Net Profit vs Cash Reconciliation</div>'
      + '<div class="card card-body">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">Net Profit Today</span>'
      + '<span style="font-size:16px;font-weight:800;color:'+(isProfit?'var(--ok)':'var(--er)')+';font-family:var(--fm)">'+Utils.cur(netProfit,cur)+'</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">Total Cash Counted (USD)</span>'
      + '<span id="recon-cash" style="font-size:16px;font-weight:800;color:var(--g);font-family:var(--fm)">—</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px">'
      + '<span style="font-size:14px;font-weight:800;color:var(--t1)">Difference</span>'
      + '<span id="recon-diff" style="font-size:20px;font-weight:900;font-family:var(--fm)">—</span>'
      + '</div>'
      + '<div id="recon-status" style="margin-top:10px;text-align:center;padding:12px;border-radius:var(--r12);font-size:16px;font-weight:800">Count your cash above</div>'
      + '<div id="recon-detail" style="display:none;font-size:12px;color:var(--t2);margin-top:8px;padding:8px 10px;background:var(--bg3);border-radius:var(--r8);line-height:1.7"></div>'
      + '</div></div>'

      // ── 6. CUSTOMER DEBT ──────────────────────────────────────
      + '<div class="sec"><div class="sec-title">6. Customer Debt Summary</div>'
      + '<div class="card card-body">'
      + ClosingReport._row('New Credit Given Today',    Utils.cur(creditGiven,cur), creditGiven>0?'var(--wa)':'var(--ok)')
      + ClosingReport._row('Total Outstanding Debt',    Utils.cur(totalDebt,cur),   totalDebt>0?'var(--er)':'var(--ok)')
      + (totalDebt>0 ? '<div style="font-size:11px;color:var(--wa);margin-top:8px;padding:8px 10px;background:var(--wab);border-radius:var(--r8)">⚠️ Follow up on outstanding debts to improve cash flow.</div>' : '')
      + '</div></div>'

      // ── FINAL SUMMARY ─────────────────────────────────────────
      + '<div class="sec"><div class="sec-title">Final Management Summary</div>'
      + '<div class="card card-body">'
      + ClosingReport._row('Gross Sales',     Utils.cur(grossSales,cur), 'var(--g)', true)
      + ClosingReport._row('Total Expenses',  Utils.cur(totalExp,cur),   'var(--er)')
      + ClosingReport._row('Net Profit',      Utils.cur(netProfit,cur),  isProfit?'var(--ok)':'var(--er)', true)
      + ClosingReport._row('Profit Margin',   margin+'%',                isProfit?'var(--ok)':'var(--er)')
      + ClosingReport._row('Cash Counted',    '<span id="sum-cash">Count cash above</span>', 'var(--g)')
      + ClosingReport._row('Customer Debt',   Utils.cur(totalDebt,cur),  totalDebt>0?'var(--er)':'var(--ok)')
      + '<div style="margin-top:14px;padding:14px;text-align:center;background:var(--bg3);border-radius:var(--r12);border:1px solid var(--bd)">'
      + '<div style="font-size:24px;margin-bottom:6px">'+statusIcon+'</div>'
      + '<div style="font-size:17px;font-weight:800;color:'+statusColor+'">'+statusLabel+'</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:4px">'+fullDate+'</div>'
      + '</div>'
      + '</div>'

      // AI Comment
      + '<div style="margin-top:12px;background:var(--gb3);border:1px solid rgba(212,168,67,.25);border-radius:var(--r14);padding:16px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🤖 Accountant Comment</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.75">'
      + ClosingReport._autoComment(grossSales,netProfit,totalExp,totalDebt,isProfit,marginN,sales.length,cur)
      + '</div></div></div>'

      + '<div style="height:40px"></div>';

    // Store netProfit for reconciliation
    ClosingReport._netProfit = netProfit;
    ClosingReport._cur = cur;
  },

  /* ══════════════════════════════════════════════════════════════
     LIVE CASH CALCULATOR — updates every keystroke
  ══════════════════════════════════════════════════════════════ */
  _netProfit: 0,
  _cur: '$',

  calcCash: function() {
    var rate = parseFloat((Utils.get('cl-rate')||{value:'198'}).value) || 198;

    // Count USD
    var usdTotal = 0;
    ClosingReport._usdBills.forEach(function(b){
      var inp = Utils.get('usd-'+b);
      var qty = inp && inp.value.trim() !== '' ? (parseInt(inp.value)||0) : 0;
      var amt = qty * b;
      usdTotal += amt;
      var el = Utils.get('usd-amt-'+b);
      if (el) el.textContent = qty > 0 ? '$'+amt.toFixed(2) : '';
    });

    // Count LRD
    var lrdTotal = 0;
    ClosingReport._lrdBills.forEach(function(b){
      var inp = Utils.get('lrd-'+b);
      var qty = inp && inp.value.trim() !== '' ? (parseInt(inp.value)||0) : 0;
      var amt = qty * b;
      lrdTotal += amt;
      var el = Utils.get('lrd-amt-'+b);
      if (el) el.textContent = qty > 0 ? 'L$'+amt.toFixed(2) : '';
    });

    // Convert LRD to USD
    var lrdInUsd    = rate > 0 ? lrdTotal / rate : 0;
    var totalCashUsd = usdTotal + lrdInUsd;

    // Update totals
    var fmt = function(n){ return '$'+n.toFixed(2); };
    var fmtL= function(n){ return 'L$'+n.toFixed(2); };

    var totalUsdEl = Utils.get('total-usd');
    var totalLrdEl = Utils.get('total-lrd');
    var lrdUsdEl   = Utils.get('lrd-usd');
    var combUsdEl  = Utils.get('comb-usd');
    var combLrdEl  = Utils.get('comb-lrd');
    var totalCashEl= Utils.get('total-cash-usd');
    var reconCash  = Utils.get('recon-cash');
    var sumCash    = Utils.get('sum-cash');

    if (totalUsdEl) totalUsdEl.textContent = usdTotal > 0   ? fmt(usdTotal)    : '—';
    if (totalLrdEl) totalLrdEl.textContent = lrdTotal > 0   ? fmtL(lrdTotal)   : '—';
    if (lrdUsdEl)   lrdUsdEl.textContent   = lrdTotal > 0   ? fmt(lrdInUsd)    : '$0.00';
    if (combUsdEl)  combUsdEl.textContent  = usdTotal > 0   ? fmt(usdTotal)    : '—';
    if (combLrdEl)  combLrdEl.textContent  = lrdTotal > 0   ? fmt(lrdInUsd)    : '—';
    if (totalCashEl)totalCashEl.textContent= totalCashUsd > 0 ? fmt(totalCashUsd) : '—';
    if (reconCash)  reconCash.textContent  = totalCashUsd > 0 ? fmt(totalCashUsd) : '—';
    if (sumCash)    sumCash.textContent    = totalCashUsd > 0 ? fmt(totalCashUsd) : 'Count cash above';

    // ── Reconciliation comparison ────────────────────────────────
    var net  = ClosingReport._netProfit;
    var diff = totalCashUsd - net;
    var cur  = ClosingReport._cur;

    var reconDiff   = Utils.get('recon-diff');
    var reconStatus = Utils.get('recon-status');
    var reconDetail = Utils.get('recon-detail');

    if (totalCashUsd === 0 && usdTotal === 0 && lrdTotal === 0) {
      if (reconDiff)   reconDiff.textContent   = '—';
      if (reconStatus) { reconStatus.textContent='Count your cash above'; reconStatus.style.background='var(--bg3)'; reconStatus.style.color='var(--t3)'; }
      if (reconDetail) reconDetail.style.display='none';
      return;
    }

    var diffAbs = Math.abs(diff);
    var tolerance = 0.50; // $0.50 tolerance for rounding

    if (reconDiff) {
      reconDiff.textContent = (diff >= 0 ? '+' : '-') + '$' + diffAbs.toFixed(2);
      reconDiff.style.color = Math.abs(diff) <= tolerance ? 'var(--ok)' : diff > 0 ? 'var(--wa)' : 'var(--er)';
    }

    var msg, bg, detailMsg;
    if (Math.abs(diff) <= tolerance) {
      msg       = '✅ BALANCED';
      bg        = 'var(--okb)';
      detailMsg = 'Cash counted matches net profit perfectly. All transactions are accounted for.';
    } else if (diff > 0) {
      msg       = '⚠️ OVER  +$' + diffAbs.toFixed(2);
      bg        = 'var(--wab)';
      detailMsg = 'Cash counted is $'+diffAbs.toFixed(2)+' MORE than net profit. Check for: unrecorded expenses, advance payments, or counting errors.';
    } else {
      msg       = '❌ SHORT  −$' + diffAbs.toFixed(2);
      bg        = 'var(--erb)';
      detailMsg = 'Cash counted is $'+diffAbs.toFixed(2)+' LESS than net profit. Check for: unrecorded sales, petty cash used, or theft/loss.';
    }

    if (reconStatus) {
      reconStatus.textContent  = msg;
      reconStatus.style.background = bg;
      reconStatus.style.color  = Math.abs(diff)<=tolerance ? 'var(--ok)' : diff>0 ? 'var(--wa)' : 'var(--er)';
    }
    if (reconDetail) {
      reconDetail.textContent    = 'Net Profit: '+Utils.cur(net,cur)+'  |  Cash Counted: $'+totalCashUsd.toFixed(2)+'  |  '+detailMsg;
      reconDetail.style.display  = 'block';
    }
  },

  saveRate: function() {
    var rate = parseFloat((Utils.get('cl-rate')||{value:'198'}).value)||198;
    var s = DB.getSettings();
    s.lrdRate = rate;
    DB.saveSettings(s);
    Toast.show('Exchange rate saved: L$'+rate+' = $1 ✓', 'ok');
  },

  /* ══════════════════════════════════════════════════════════════
     PRINT
  ══════════════════════════════════════════════════════════════ */
  print: function() {
    var d        = Utils.today();
    var dateObj  = new Date(d+'T12:00:00');
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
    var rate     = parseFloat((Utils.get('cl-rate')||{value:settings.lrdRate||'198'}).value)||198;

    var sales    = DB.getSales().filter(function(s){ return s.date===d; });
    var expenses = DB.getExpenses().filter(function(e){ return e.date===d; });
    var allocs   = DB.getAllocatedDaily ? DB.getAllocatedDaily() : [];
    var allocDay = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); },0);
    var allSales = DB.getSales();

    var grossSales = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
    var manExp     = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
    var totalExp   = manExp + allocDay;
    var netProfit  = grossSales - totalExp;
    var margin     = grossSales>0 ? (netProfit/grossSales*100).toFixed(1) : '0.0';
    var isProfit   = netProfit >= 0;
    var marginN    = parseFloat(margin);

    var payMethods = {};
    sales.forEach(function(s){ var m=s.payment||'Cash'; payMethods[m]=(payMethods[m]||0)+(parseFloat(s.total)||0); });
    var expCats = {};
    expenses.forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });
    var creditGiven = sales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
    var totalDebt   = allSales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    // Get counted cash from inputs
    var usdTotal = 0;
    ClosingReport._usdBills.forEach(function(b){
      var el = Utils.get('usd-'+b);
      usdTotal += (el && el.value.trim()!=='' ? parseInt(el.value)||0 : 0)*b;
    });
    var lrdTotal = 0;
    ClosingReport._lrdBills.forEach(function(b){
      var el = Utils.get('lrd-'+b);
      lrdTotal += (el && el.value.trim()!=='' ? parseInt(el.value)||0 : 0)*b;
    });
    var lrdInUsd     = rate>0 ? lrdTotal/rate : 0;
    var totalCashUsd = usdTotal + lrdInUsd;
    var diff         = totalCashUsd - netProfit;
    var diffAbs      = Math.abs(diff);
    var tolerance    = 0.50;
    var reconMsg     = Math.abs(diff)<=tolerance ? 'BALANCED' : diff>0 ? 'OVER +$'+diffAbs.toFixed(2) : 'SHORT −$'+diffAbs.toFixed(2);

    var statusIcon = isProfit&&marginN>=20?'🟢':isProfit&&marginN>=5?'🟡':'🔴';
    var statusLabel= isProfit&&marginN>=20?'EXCELLENT':isProfit&&marginN>=5?'FAIR':'NEEDS ATTENTION';

    var logoHtml = bizLogo ? '<img src="'+bizLogo+'" style="width:60px;height:60px;object-fit:contain;border-radius:8px">' : '';

    // Build cash count table rows
    var usdRows = ClosingReport._usdBills.map(function(b){
      var el  = Utils.get('usd-'+b);
      var qty = el && el.value.trim()!=='' ? parseInt(el.value)||0 : 0;
      return qty>0 ? '<tr><td>$'+b+'</td><td style="text-align:center">'+qty+'</td><td style="text-align:right;font-weight:700">$'+(qty*b).toFixed(2)+'</td></tr>' : '';
    }).join('');
    var lrdRows = ClosingReport._lrdBills.map(function(b){
      var el  = Utils.get('lrd-'+b);
      var qty = el && el.value.trim()!=='' ? parseInt(el.value)||0 : 0;
      return qty>0 ? '<tr><td>L$'+b+'</td><td style="text-align:center">'+qty+'</td><td style="text-align:right;font-weight:700">L$'+(qty*b).toFixed(2)+'</td></tr>' : '';
    }).join('');

    var reconColor = Math.abs(diff)<=tolerance?'#16a34a':diff>0?'#d97706':'#dc2626';
    var reconBg    = Math.abs(diff)<=tolerance?'#d1fae5':diff>0?'#fef3c7':'#fee2e2';

    var css = '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff}'
      + '.page{max-width:210mm;margin:0 auto;padding:14mm}'
      + 'h2{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;border-bottom:2px solid #111;padding-bottom:4px;margin:18px 0 10px;color:#333}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:12px}'
      + 'th{background:#111;color:#fff;padding:7px 10px;font-size:10px;font-weight:700;text-transform:uppercase}'
      + 'td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px}'
      + '.tr{background:#f9fafb}'
      + '.sr{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e5e7eb}'
      + '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:18px}'
      + '.recon-box{padding:16px;border-radius:8px;text-align:center;margin:12px 0}'
      + '.footer{text-align:center;font-size:10px;color:#888;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px}'
      + '.sig-line{display:flex;gap:20px;margin-top:30px}'
      + '.sig{flex:1;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#555}'
      + '@media print{@page{size:A4;margin:10mm}.page{padding:0}}';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<title>Daily Closing — '+Utils.esc(bizName)+'</title><style>'+css+'</style></head><body>'
      + '<div class="page">'

      // Header
      + '<div class="hdr">'
      + '<div style="display:flex;gap:14px;align-items:flex-start">'+logoHtml
      + '<div><div style="font-size:22px;font-weight:900">'+Utils.esc(bizName)+'</div>'
      + (bizAddr?'<div style="font-size:10px;color:#555;margin-top:2px">📍 '+Utils.esc(bizAddr)+'</div>':'')
      + (bizPhone?'<div style="font-size:10px;color:#555;margin-top:2px">📞 '+Utils.esc(bizPhone)+'</div>':'')
      + '<div style="font-size:13px;font-weight:800;margin-top:6px;text-transform:uppercase;letter-spacing:.06em">Daily Closing Report</div>'
      + '<div style="font-size:11px;color:#555">'+fullDate+'</div>'
      + '</div></div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:10px;color:#555">Prepared by: '+Utils.esc(userName)+'</div>'
      + '<div style="font-size:10px;color:#555">Time: '+timeStr+'</div>'
      + '<div style="font-size:16px;font-weight:900;margin-top:8px">'+statusIcon+' '+statusLabel+'</div>'
      + '</div></div>'

      // S1 Profit
      + '<h2>1. Profit Summary</h2>'
      + '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:12px">'
      + '<div class="sr"><span>Gross Sales</span><span style="font-weight:700">'+Utils.cur(grossSales,cur)+'</span></div>'
      + '<div class="sr"><span>Total Expenses</span><span style="font-weight:700;color:#dc2626">− '+Utils.cur(totalExp,cur)+'</span></div>'
      + '<div class="sr" style="border:none;padding-top:10px"><span style="font-size:15px;font-weight:900">NET PROFIT</span><span style="font-size:18px;font-weight:900;color:'+(isProfit?'#16a34a':'#dc2626')+'">'+Utils.cur(netProfit,cur)+'</span></div>'
      + '<div class="sr" style="border:none;padding-top:4px"><span>Profit Margin</span><span style="font-weight:700">'+margin+'%</span></div>'
      + '</div>'
      + '<div style="text-align:center;padding:12px;background:'+(isProfit?'#d1fae5':'#fee2e2')+';border-radius:8px;font-size:18px;font-weight:900;color:'+(isProfit?'#065f46':'#991b1b')+'">'+(isProfit?'✅ PROFIT':'❌ LOSS')+'</div>'

      // S2 Sales
      + '<h2>2. Sales Summary</h2>'
      + '<table><thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + '<tr><td>Gross Sales</td><td style="text-align:right;font-weight:700">'+Utils.cur(grossSales,cur)+'</td></tr>'
      + Object.keys(payMethods).map(function(m,i){ return '<tr'+(i%2?' class="tr"':'')+'><td>'+Utils.esc(m)+'</td><td style="text-align:right">'+Utils.cur(payMethods[m],cur)+'</td></tr>'; }).join('')
      + '<tr style="background:#111;color:#fff"><td style="font-weight:700">Total Transactions</td><td style="text-align:right;font-weight:700">'+sales.length+' sales</td></tr>'
      + '</tbody></table>'

      // S3 Expenses
      + '<h2>3. Expense Summary</h2>'
      + '<table><thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + ['Salary','Transportation','Rent','Utilities','Fuel','Internet','Marketing','Maintenance'].map(function(cat,i){
          var a=expCats[cat]||0;
          return '<tr'+(i%2?' class="tr"':'')+'><td>'+cat+'</td><td style="text-align:right">'+(a>0?Utils.cur(a,cur):'—')+'</td></tr>';
        }).join('')
      + (allocDay>0?'<tr><td>Allocated (Daily)</td><td style="text-align:right">'+Utils.cur(allocDay,cur)+'</td></tr>':'')
      + '<tr style="background:#111;color:#fff"><td style="font-weight:700">TOTAL EXPENSES</td><td style="text-align:right;font-weight:700">'+Utils.cur(totalExp,cur)+'</td></tr>'
      + '</tbody></table>'

      // S4 Cash Count
      + '<h2>4. Cash Count (Exchange Rate: L$'+rate+' = $1 USD)</h2>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">'
      + '<div><div style="font-weight:700;margin-bottom:6px;font-size:11px">🇺🇸 US Dollar</div>'
      + '<table><thead><tr><th>Bill</th><th>Qty</th><th>Amount</th></tr></thead><tbody>'
      + (usdRows||'<tr><td colspan="3" style="color:#888;text-align:center">No USD counted</td></tr>')
      + '</tbody><tfoot><tr style="background:#111;color:#fff"><td colspan="2">TOTAL USD</td><td style="text-align:right;font-weight:700">$'+usdTotal.toFixed(2)+'</td></tr></tfoot></table></div>'
      + '<div><div style="font-weight:700;margin-bottom:6px;font-size:11px">🇱🇷 Liberian Dollar</div>'
      + '<table><thead><tr><th>Bill</th><th>Qty</th><th>Amount</th></tr></thead><tbody>'
      + (lrdRows||'<tr><td colspan="3" style="color:#888;text-align:center">No LRD counted</td></tr>')
      + '</tbody><tfoot><tr style="background:#111;color:#fff"><td colspan="2">TOTAL LRD</td><td style="text-align:right;font-weight:700">L$'+lrdTotal.toFixed(2)+'</td></tr></tfoot></table></div>'
      + '</div>'
      + '<div style="background:#f9f3e3;border:1px solid #D4A843;border-radius:8px;padding:12px">'
      + '<div class="sr"><span>USD Cash</span><span style="font-weight:700">$'+usdTotal.toFixed(2)+'</span></div>'
      + '<div class="sr"><span>LRD Cash ÷ '+rate+' = USD</span><span style="font-weight:700">$'+lrdInUsd.toFixed(2)+'</span></div>'
      + '<div class="sr" style="border:none;padding-top:8px"><span style="font-size:15px;font-weight:900">TOTAL CASH (USD)</span><span style="font-size:18px;font-weight:900;color:#8C6A18">$'+totalCashUsd.toFixed(2)+'</span></div>'
      + '</div>'

      // S5 Reconciliation
      + '<h2>5. Net Profit vs Cash Reconciliation</h2>'
      + '<table><thead><tr><th>Metric</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + '<tr><td style="font-weight:700">Net Profit Today</td><td style="text-align:right;font-weight:800;color:'+(isProfit?'#16a34a':'#dc2626')+'">'+Utils.cur(netProfit,cur)+'</td></tr>'
      + '<tr class="tr"><td style="font-weight:700">Total Cash Counted (USD)</td><td style="text-align:right;font-weight:800">$'+totalCashUsd.toFixed(2)+'</td></tr>'
      + '<tr><td style="font-weight:700">Difference</td><td style="text-align:right;font-weight:900;color:'+reconColor+'">'+(diff>=0?'+':'')+diff.toFixed(2)+'</td></tr>'
      + '</tbody></table>'
      + '<div class="recon-box" style="background:'+reconBg+';border:2px solid '+reconColor+'">'
      + '<div style="font-size:18px;font-weight:900;color:'+reconColor+'">'+reconMsg+'</div>'
      + (Math.abs(diff)>tolerance?'<div style="font-size:11px;color:'+reconColor+';margin-top:4px">'+(diff>0?'Cash is MORE than profit — check unrecorded expenses':'Cash is LESS than profit — check missing collections')+'</div>':'')
      + '</div>'

      // S6 Debt
      + '<h2>6. Customer Debt</h2>'
      + '<table><thead><tr><th>Metric</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + '<tr><td>New Credit Given Today</td><td style="text-align:right;color:#d97706;font-weight:700">'+Utils.cur(creditGiven,cur)+'</td></tr>'
      + '<tr class="tr"><td>Total Outstanding Debt</td><td style="text-align:right;color:#dc2626;font-weight:700">'+Utils.cur(totalDebt,cur)+'</td></tr>'
      + '</tbody></table>'

      // Final Table
      + '<h2>Final Management Summary</h2>'
      + '<table><thead><tr><th>Metric</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      + '<tr><td>Gross Sales</td><td style="text-align:right;font-weight:700">'+Utils.cur(grossSales,cur)+'</td></tr>'
      + '<tr class="tr"><td>Total Expenses</td><td style="text-align:right;font-weight:700;color:#dc2626">'+Utils.cur(totalExp,cur)+'</td></tr>'
      + '<tr><td style="font-weight:800">Net Profit</td><td style="text-align:right;font-weight:900;color:'+(isProfit?'#16a34a':'#dc2626')+'">'+Utils.cur(netProfit,cur)+'</td></tr>'
      + '<tr class="tr"><td>Profit Margin</td><td style="text-align:right;font-weight:700">'+margin+'%</td></tr>'
      + '<tr><td>Cash Counted (USD Total)</td><td style="text-align:right;font-weight:700">$'+totalCashUsd.toFixed(2)+'</td></tr>'
      + '<tr class="tr"><td>Reconciliation</td><td style="text-align:right;font-weight:800;color:'+reconColor+'">'+reconMsg+'</td></tr>'
      + '<tr><td>Outstanding Customer Debt</td><td style="text-align:right;font-weight:700;color:#dc2626">'+Utils.cur(totalDebt,cur)+'</td></tr>'
      + '</tbody></table>'

      + '<div style="text-align:center;padding:14px;background:'+(isProfit&&marginN>=20?'#d1fae5':isProfit?'#fef3c7':'#fee2e2')+';border-radius:8px;margin:12px 0">'
      + '<div style="font-size:20px;font-weight:900">'+statusIcon+' '+statusLabel+'</div></div>'

      + '<div style="background:#f9f3e3;border:1.5px solid #D4A843;border-radius:8px;padding:14px;margin:12px 0">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#8C6A18;margin-bottom:6px">🤖 Accountant Comment</div>'
      + '<div style="font-size:12px;color:#111;line-height:1.75">'
      + ClosingReport._autoComment(grossSales,netProfit,totalExp,totalDebt,isProfit,marginN,sales.length,cur)
      + '</div></div>'

      + '<div class="sig-line">'
      + '<div class="sig">Cashier: _________________________ &nbsp; Date: ___________</div>'
      + '<div class="sig">Manager: _________________________ &nbsp; Date: ___________</div>'
      + '</div>'
      + '<div class="footer">SmartStock Pro &nbsp;|&nbsp; '+Utils.esc(bizName)+' &nbsp;|&nbsp; '+fullDate+'</div>'
      + '</div></body></html>';

    if (typeof Sales !== 'undefined' && Sales._printHtml) {
      Sales._printHtml(html, 'closing-print-frame');
    } else {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
      setTimeout(function(){ try{f.contentWindow.print();}catch(e){window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank');} }, 600);
    }
  },

  /* ── Helpers ────────────────────────────────────────────────── */
  _autoComment: function(rev, net, exp, debt, isProfit, margin, txCount, cur) {
    if (rev === 0) return 'No sales recorded today. Verify all transactions were properly saved. Focus on sales activity tomorrow.';
    var lines = [];
    if (isProfit) {
      lines.push('The business made a profit of '+Utils.cur(net,cur)+' today ('+margin+'% margin) from '+txCount+' transaction'+(txCount!==1?'s':'')+' — a positive result.');
    } else {
      lines.push('The business recorded a loss of '+Utils.cur(Math.abs(net),cur)+' today. Expenses exceeded revenue and require immediate review.');
    }
    if (exp > rev * 0.5) {
      lines.push('Expenses represent over 50% of revenue — cost control should be a priority tomorrow.');
    } else {
      lines.push('Expenses are at '+(rev>0?(exp/rev*100).toFixed(0):0)+'% of revenue — within acceptable range.');
    }
    if (debt > 0) {
      lines.push('Outstanding customer debt of '+Utils.cur(debt,cur)+' needs follow-up — contact top debtors first thing tomorrow.');
    } else {
      lines.push('No outstanding customer debts — excellent collections performance.');
    }
    return lines.join(' ');
  },

  _row: function(label, value, color, bold, fontSize) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">'+label+'</span>'
      + '<span style="font-size:'+(fontSize||bold?'15px':'13px')+';font-weight:'+(bold?'800':'600')+';color:'+(color||'var(--t1)')+';font-family:var(--fm)">'+value+'</span>'
      + '</div>';
  },
};
