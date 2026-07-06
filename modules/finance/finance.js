/* === finance.js === */
var Finance = {
  render: function() {
    var pg = Utils.get('pg-finance');
    if (!pg) return;
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';
    var user        = Auth.currentUser || {};
    var role        = (user.role || 'owner').toLowerCase();
    var canSeeMoney = (role==='owner'||role==='admin'||role==='primary_admin'||role==='primary admin'||role==='manager'||role==='store_manager'||role==='accountant');
    var mask        = '— — —';
    function showM(v) { return canSeeMoney ? Utils.cur(v, cur) : mask; }
    function showPct(v) { return canSeeMoney ? (parseFloat(v)||0).toFixed(1)+'%' : mask; }
    var sales     = DB.getSales();
    var expenses  = DB.getExpenses();
    var payroll   = DB.getPayroll();
    var suppliers = DB.getSuppliers();
    var allocs    = DB.getAllocatedDaily();
    var allocTot  = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);

    // ── A. TOTAL SALES ───────────────────────────────────────────────────────
    // All sales regardless of payment status
    var totalSales = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);

    // ── B. COGS — Quantity Sold × Cost Price per product ────────────────────
    var totalCOGS = sales.reduce(function(a,s){
      return a + (s.items||[]).reduce(function(b,item){
        return b + (parseFloat(item.cost)||0) * (parseInt(item.qty)||1);
      }, 0);
    }, 0);

    // ── C. GROSS PROFIT ──────────────────────────────────────────────────────
    var grossProfit = totalSales - totalCOGS;
    var grossMargin = totalSales > 0 ? (grossProfit/totalSales*100).toFixed(1) : '0.0';

    // ── D. TOTAL EXPENSES ────────────────────────────────────────────────────
    // Manual expenses (all time)
    var manualExp = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    // Allocated expenses daily total
    var totalExp  = manualExp + allocTot;

    // ── E. NET PROFIT ────────────────────────────────────────────────────────
    var netProfit  = grossProfit - totalExp;
    var netMargin  = totalSales > 0 ? (netProfit/totalSales*100).toFixed(1) : '0.0';

    // ── F. CASH AVAILABLE ────────────────────────────────────────────────────
    // Only count ACTUALLY PAID sales — exclude unpaid credit
    var cashFromSales = sales.filter(function(s){ return s.status==='Paid'; })
      .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);

    // Partial payments collected
    var cashFromPartial = sales.filter(function(s){ return s.status==='Partial'; })
      .reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); }, 0);

    // Payment method breakdown (only from collected money)
    var payMethods = { Cash:0, 'Mobile Money':0, 'Bank Transfer':0, Other:0 };
    sales.forEach(function(s){
      if (s.status === 'Paid' || s.status === 'Partial') {
        var collected = s.status==='Paid' ? (parseFloat(s.total)||0) : (parseFloat(s.amountPaid)||0);
        var method    = s.payment || 'Cash';
        if (payMethods[method] !== undefined) payMethods[method] += collected;
        else payMethods['Other'] = (payMethods['Other']||0) + collected;
      }
    });

    // Debt collections (balance payments recorded in payments table)
    var payments     = DB.getPayments ? DB.getPayments() : [];
    var debtCollected= payments.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); }, 0);

    // Cash out: expenses paid
    var expCashOut = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // Cash out: salary paid
    var salaryPaid = payroll.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); }, 0);

    // Cash out: supplier payments (amounts paid to suppliers — tracked as reduced balance)
    // We don't have a supplier payment ledger, so we note this as a placeholder
    var supplierPaid = 0; // Would come from supplier payment records if tracked

    var totalCashIn  = cashFromSales + cashFromPartial + debtCollected;
    var totalCashOut = expCashOut + salaryPaid + supplierPaid;
    var cashAvailable= totalCashIn - totalCashOut;

    // Outstanding debt (credit still owed)
    var creditOutstanding = sales.filter(function(s){ return s.status!=='Paid'; })
      .reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);

    // This month data
    var month     = Utils.today().slice(0,7);
    var monthSales= sales.filter(function(s){ return s.date&&s.date.startsWith(month); });
    var monthRev  = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var monthExp  = expenses.filter(function(e){ return e.date&&e.date.startsWith(month); })
                     .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // ── HERO CARDS (4 big cards) ─────────────────────────────────────────────
    var heroCards = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 14px;margin-bottom:16px">'
      // Total Sales — Gold
      + Finance._heroCard('💰','TOTAL SALES',Utils.cur(totalSales,cur),sales.length+' invoices','var(--g)','var(--gb)','var(--g)')
      // Cash Available — Blue
      + Finance._heroCard('💵','CASH AVAILABLE',Utils.cur(cashAvailable,cur),'Actual cash on hand','var(--in)','var(--inb)','var(--in)')
      // Gross Profit — Green
      + Finance._heroCard('📈','GROSS PROFIT',Utils.cur(grossProfit,cur),grossMargin+'% margin',grossProfit>=0?'var(--ok)':'var(--er)',grossProfit>=0?'var(--okb)':'var(--erb)',grossProfit>=0?'var(--ok)':'var(--er)')
      // Net Profit — Green or Red
      + Finance._heroCard(netProfit>=0?'✅':'📉','NET PROFIT',Utils.cur(netProfit,cur),netMargin+'% margin',netProfit>=0?'var(--ok)':'var(--er)',netProfit>=0?'var(--okb)':'var(--erb)',netProfit>=0?'var(--ok)':'var(--er)')
      + '</div>';

    // ── FULL P&L STATEMENT ───────────────────────────────────────────────────
    function plRow(label, val, color, isBold, isBig) {
      var borderTop = isBold ? ';border-top:2px solid var(--bd2);padding-top:10px;margin-top:6px' : '';
      var fontSize  = isBig  ? 'font-size:17px' : 'font-size:13px';
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd)'+borderTop+'">'
        + '<span style="'+fontSize+';color:'+(isBold?'var(--t1)':'var(--t2)')+';font-weight:'+(isBold?'800':'500')+'">'+label+'</span>'
        + '<span style="'+fontSize+';font-weight:'+(isBold?'900':'700')+';color:'+color+';font-family:var(--fm)">'+val+'</span>'
        + '</div>';
    }

    var plHtml = '<div class="sec">'
      + '<div class="sec-title">📊 Profit &amp; Loss Statement</div>'
      + '<div class="card card-body">'
      + plRow('Total Sales Revenue',          Utils.cur(totalSales,cur),  'var(--g)')
      + plRow('Cost of Goods Sold (COGS)',    '('+Utils.cur(totalCOGS,cur)+')',   'var(--er)')
      + plRow('GROSS PROFIT',                 Utils.cur(grossProfit,cur)+' ('+grossMargin+'%)', grossProfit>=0?'var(--ok)':'var(--er)', true, true)
      + plRow('Manual Expenses',              '('+Utils.cur(manualExp,cur)+')',  'var(--er)')
      + (allocTot>0 ? plRow('Allocated Expenses (daily)', '('+Utils.cur(allocTot,cur)+')', 'var(--wa)') : '')
      + plRow('Total Expenses',               '('+Utils.cur(totalExp,cur)+')',   'var(--er)')
      + plRow('NET PROFIT',                   Utils.cur(netProfit,cur)+' ('+netMargin+'%)', netProfit>=0?'var(--ok)':'var(--er)', true, true)
      + '</div></div>';

    // ── COGS BREAKDOWN ───────────────────────────────────────────────────────
    var prodCOGS = {};
    sales.forEach(function(s){
      (s.items||[]).forEach(function(item){
        if (!prodCOGS[item.name]) prodCOGS[item.name]={sold:0,cost:0,rev:0,costPrice:parseFloat(item.cost)||0};
        prodCOGS[item.name].sold += parseInt(item.qty)||1;
        prodCOGS[item.name].cost += (parseFloat(item.cost)||0)*(parseInt(item.qty)||1);
        prodCOGS[item.name].rev  += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var cogsKeys = Object.keys(prodCOGS).sort(function(a,b){ return prodCOGS[b].cost-prodCOGS[a].cost; }).slice(0,10);

    var cogsHtml = cogsKeys.length ? '<div class="sec">'
      + '<div class="sec-title">🏷️ COGS Breakdown by Product</div>'
      + '<div class="card">'
      + '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px;padding:8px 14px;border-bottom:1px solid var(--bd);font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.08em">'
      + '<span>Product</span><span style="text-align:right">Sold</span><span style="text-align:right">Cost/unit</span><span style="text-align:right">Total Cost</span></div>'
      + cogsKeys.map(function(k){
          var p=prodCOGS[k];
          var margin = p.rev>0 ? ((p.rev-p.cost)/p.rev*100).toFixed(0) : '0';
          return '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px;padding:9px 14px;border-bottom:1px solid var(--bd);align-items:center">'
            + '<div><div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(k)+'</div>'
            + '<div style="font-size:10px;color:var(--ok)">'+margin+'% margin</div></div>'
            + '<div style="text-align:right;font-size:12px;color:var(--t2)">×'+p.sold+'</div>'
            + '<div style="text-align:right;font-size:12px;color:var(--t2)">'+Utils.cur(p.costPrice,cur)+'</div>'
            + '<div style="text-align:right;font-size:13px;font-weight:700;color:var(--er)">'+Utils.cur(p.cost,cur)+'</div>'
            + '</div>';
        }).join('')
      + '<div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg3);font-weight:800;font-size:13px">'
      + '<span style="color:var(--t1)">TOTAL COGS</span><span style="color:var(--er);font-family:var(--fm)">'+Utils.cur(totalCOGS,cur)+'</span></div>'
      + '</div></div>' : '';

    // ── CASH AVAILABLE BREAKDOWN ─────────────────────────────────────────────
    function cashRow(label, val, color, note) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">'
        + '<div><span style="font-size:13px;color:var(--t2)">'+label+'</span>'+(note?'<div style="font-size:10px;color:var(--t3);margin-top:1px">'+note+'</div>':'')+'</div>'
        + '<span style="font-size:14px;font-weight:700;color:'+color+';font-family:var(--fm)">'+val+'</span>'
        + '</div>';
    }

    var cashHtml = '<div class="sec">'
      + '<div class="sec-title">💵 Cash Available Calculation</div>'
      + '<div class="card card-body">'
      + '<div style="font-size:10px;font-weight:800;color:var(--ok);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--bd)">CASH IN</div>'
      + cashRow('Cash Sales (Paid invoices)', Utils.cur(cashFromSales,cur), 'var(--ok)')
      + cashRow('Partial Payments Collected', Utils.cur(cashFromPartial,cur), 'var(--ok)', 'From partial/installment sales')
      + (debtCollected>0 ? cashRow('Debt Collections', Utils.cur(debtCollected,cur), 'var(--ok)', 'Balance payments from customers') : '')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;font-size:14px;border-top:1px solid var(--bd2);margin-top:4px">'
      + '<span style="color:var(--t1)">Total Cash In</span><span style="color:var(--ok);font-family:var(--fm)">'+Utils.cur(totalCashIn,cur)+'</span></div>'
      + '<div style="font-size:10px;font-weight:800;color:var(--er);text-transform:uppercase;letter-spacing:.1em;margin:14px 0 8px;padding-top:10px;border-top:1px solid var(--bd)">CASH OUT</div>'
      + cashRow('Expenses Paid', Utils.cur(expCashOut,cur), 'var(--er)')
      + (salaryPaid>0 ? cashRow('Salary Payments', Utils.cur(salaryPaid,cur), 'var(--er)') : '')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;font-size:14px;border-top:1px solid var(--bd2);margin-top:4px">'
      + '<span style="color:var(--t1)">Total Cash Out</span><span style="color:var(--er);font-family:var(--fm)">'+Utils.cur(totalCashOut,cur)+'</span></div>'
      + '<div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:900;font-size:18px;border-top:2px solid var(--in);margin-top:6px">'
      + '<span style="color:var(--t1)">CASH AVAILABLE</span><span style="color:var(--in);font-family:var(--fm)">'+Utils.cur(cashAvailable,cur)+'</span></div>'
      + (creditOutstanding>0 ? '<div style="font-size:11px;color:var(--wa);font-weight:600;margin-top:4px">⚠️ '+Utils.cur(creditOutstanding,cur)+' still owed by customers (not included in cash)</div>' : '')
      + '</div></div>';

    // ── PAYMENT METHOD BREAKDOWN ─────────────────────────────────────────────
    var payMax = Math.max.apply(null, Object.values(payMethods).concat([1]));
    var payHtml = '<div class="sec">'
      + '<div class="sec-title">💳 Collections by Payment Method</div>'
      + '<div class="card card-body">'
      + Object.keys(payMethods).filter(function(m){ return payMethods[m]>0; }).map(function(m){
          var pct = totalCashIn>0 ? Math.round((payMethods[m]/totalCashIn)*100) : 0;
          return '<div style="margin-bottom:12px">'
            + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
            + '<span style="color:var(--t2)">'+Utils.esc(m)+'</span>'
            + '<span style="color:var(--ok);font-weight:700">'+Utils.cur(payMethods[m],cur)+' · '+pct+'%</span></div>'
            + '<div class="progress" style="height:7px"><div class="progress-fill" style="width:'+pct+'%;background:var(--ok)"></div></div>'
            + '</div>';
        }).join('')
      + '</div></div>';

    // ── EXPENSE BREAKDOWN ────────────────────────────────────────────────────
    var expCats = {};
    expenses.forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });
    var expMax = Math.max.apply(null, Object.values(expCats).concat([1]));

    var expHtml = Object.keys(expCats).length ? '<div class="sec">'
      + '<div class="sec-title">💸 Expense Breakdown</div>'
      + '<div class="card card-body">'
      + Object.keys(expCats).sort(function(a,b){ return expCats[b]-expCats[a]; }).map(function(cat){
          var pct = manualExp>0 ? Math.round((expCats[cat]/manualExp)*100) : 0;
          return '<div style="margin-bottom:12px">'
            + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
            + '<span style="color:var(--t2)">'+Utils.esc(cat)+'</span>'
            + '<span style="color:var(--er);font-weight:700">'+Utils.cur(expCats[cat],cur)+' · '+pct+'%</span></div>'
            + '<div class="progress" style="height:7px"><div class="progress-fill" style="width:'+pct+'%;background:var(--er)"></div></div>'
            + '</div>';
        }).join('')
      + (allocTot>0 ? '<div style="border-top:1px solid var(--bd);padding-top:10px;margin-top:4px">'
          +'<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
          +'<span style="color:var(--wa)">Allocated (recurring daily)</span>'
          +'<span style="color:var(--wa);font-weight:700">'+Utils.cur(allocTot,cur)+'/day</span></div>'
          +'</div>' : '')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:6px;border-top:2px solid var(--bd2);font-weight:800;font-size:14px">'
      + '<span style="color:var(--t1)">Grand Total Expenses</span>'
      + '<span style="color:var(--er);font-family:var(--fm)">'+Utils.cur(totalExp,cur)+'</span></div>'
      + '</div></div>' : '';

    // ── REVENUE TREND ────────────────────────────────────────────────────────
    var chartHtml = '<div class="sec"><div class="chart-wrap">'
      + '<div class="chart-title">Revenue Trend (6 Months)</div>'
      + '<div class="chart-sub">'+cur+' monthly breakdown</div>'
      + Charts.monthBars(sales,'gold')+'</div></div>';

    // ── SALARY SUMMARY ───────────────────────────────────────────────────────
    var salHtml = '';
    if (salaryPaid > 0) {
      var emps = DB.getEmployees();
      salHtml = '<div class="sec">'
        + '<div class="sec-title">👔 Salary Summary</div>'
        + '<div class="card card-body">'
        + '<div class="report-row"><span class="report-label">Total Salary Paid</span><span class="report-val err">'+Utils.cur(salaryPaid,cur)+'</span></div>'
        + '<div class="report-row"><span class="report-label">Employees</span><span class="report-val">'+emps.length+'</span></div>'
        + '<div class="report-row"><span class="report-label">Monthly Payroll Budget</span><span class="report-val gold">'+Utils.cur(emps.reduce(function(a,e){ return a+(parseFloat(e.salary)||0); },0),cur)+'</span></div>'
        + '</div></div>';
    }

    // ── SUMMARY STATS ROW ────────────────────────────────────────────────────
    var statsHtml = '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">📦</div><div class="kpi-label">Invoices</div><div class="kpi-value">'+sales.length+'</div></div>'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">💳</div><div class="kpi-label">Avg Sale</div><div class="kpi-value">'+Utils.cur(sales.length?totalSales/sales.length:0,cur)+'</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">⏳</div><div class="kpi-label">Outstanding</div><div class="kpi-value">'+Utils.cur(creditOutstanding,cur)+'</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">👥</div><div class="kpi-label">Customers</div><div class="kpi-value">'+DB.getCustomers().length+'</div></div>'
      + '</div></div>';

    // ── ASSEMBLE ─────────────────────────────────────────────────────────────
    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Finance</div><div class="page-sub">Cash &amp; Profit Summary · All time</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Finance.printSummary()">🖨 Print</button></div>'
      + '</div>'
      + heroCards
      + plHtml
      + cogsHtml
      + cashHtml
      + payHtml
      + expHtml
      + chartHtml
      + salHtml
      + statsHtml;
  },

  // ── HERO CARD HELPER ───────────────────────────────────────────────────────
  _heroCard: function(icon, label, value, sub, color, bg, textColor) {
    return '<div style="background:'+bg+';border:1px solid '+color+'28;border-radius:var(--r14);padding:15px 13px;position:relative;overflow:hidden">'
      + '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'+color+'"></div>'
      + '<div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;font-family:var(--fm)">'+label+'</div>'
      + '<div style="font-size:20px;font-weight:900;color:'+textColor+';letter-spacing:-.02em;line-height:1">'+value+'</div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:5px">'+sub+'</div>'
      + '</div>';
  },

  // ── PRINT CASH & PROFIT SUMMARY ───────────────────────────────────────────
  printSummary: function() {
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var now      = new Date();
    var sales    = DB.getSales();
    var expenses = DB.getExpenses();
    var payroll  = DB.getPayroll();
    var allocs   = DB.getAllocatedDaily();
    var allocTot = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);

    var totalSales = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var totalCOGS  = sales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0); }, 0);
    var grossProfit= totalSales - totalCOGS;
    var manualExp  = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var totalExp   = manualExp + allocTot;
    var netProfit  = grossProfit - totalExp;
    var cashFromSales  = sales.filter(function(s){ return s.status==='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var cashFromPart   = sales.filter(function(s){ return s.status==='Partial'; }).reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); }, 0);
    var salaryPaid     = payroll.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); }, 0);
    var cashAvailable  = cashFromSales + cashFromPart - manualExp - salaryPaid;

    var css = 'body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:20px;max-width:700px;margin:0 auto}'
      + 'h1{font-size:22px;font-weight:900;margin:0 0 2px}h2{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #111;padding-bottom:4px;margin:18px 0 8px}'
      + '.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}'
      + '.card{background:#f9f9f9;border:1px solid #ddd;padding:14px;border-radius:4px;border-top:3px solid #ccc}'
      + '.card-gold{border-top-color:#c9a84c}.card-green{border-top-color:#16a34a}.card-blue{border-top-color:#2563eb}.card-er{border-top-color:#dc2626}'
      + '.card label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#666;display:block;margin-bottom:4px}'
      + '.card .val{font-size:20px;font-weight:900}.card .sub{font-size:11px;color:#888;margin-top:2px}'
      + 'table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#f0f0f0;border:1px solid #ccc;padding:7px;text-align:left;font-size:12px}'
      + 'td{border:1px solid #ddd;padding:7px;font-size:12px}.right{text-align:right}.bold{font-weight:700}'
      + '.total-row{background:#f5f5f5;font-weight:700}.green{color:#16a34a}.red{color:#dc2626}.gold{color:#c9a84c}.blue{color:#2563eb}'
      + '.sig-line{display:flex;justify-content:space-between;margin-top:36px}'
      + '.sig{flex:1;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#444;margin-right:20px}'
      + '@media print{@page{size:A4;margin:12mm}}';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Finance Summary</title><style>'+css+'</style></head><body>'
      + '<div style="text-align:center;margin-bottom:10px">'
      + (settings.bizLogo?'<img src="'+settings.bizLogo+'" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #ddd;margin-bottom:6px"><br>':'')
      + '<strong style="font-size:20px">'+Utils.esc(bizName)+'</strong><br>'
      + (settings.bizAddress?'<span style="font-size:11px;color:#555">'+Utils.esc(settings.bizAddress)+'</span><br>':'')
      + (settings.bizPhone?'<span style="font-size:11px;color:#555">Tel: '+Utils.esc(settings.bizPhone)+'</span><br>':'')
      + '</div>'
      + '<div style="text-align:center;color:#555;font-size:12px">Cash &amp; Profit Summary</div>'
      + '<div style="color:#666;font-size:11px">Generated: '+now.toLocaleString()+'</div>'
      + '<h2>Key Numbers</h2>'
      + '<div class="summary">'
      + '<div class="card card-gold"><label>Total Sales</label><div class="val gold">'+Utils.cur(totalSales,cur)+'</div><div class="sub">'+sales.length+' invoices</div></div>'
      + '<div class="card card-blue"><label>Cash Available</label><div class="val blue">'+Utils.cur(cashAvailable,cur)+'</div><div class="sub">Actual cash</div></div>'
      + '<div class="card card-green"><label>Gross Profit</label><div class="val green">'+Utils.cur(grossProfit,cur)+'</div><div class="sub">After COGS</div></div>'
      + '<div class="card '+(netProfit>=0?'card-green':'card-er')+'"><label>Net Profit</label><div class="val '+(netProfit>=0?'green':'red')+'">'+Utils.cur(netProfit,cur)+'</div><div class="sub">After all expenses</div></div>'
      + '</div>'
      + '<h2>Profit &amp; Loss</h2>'
      + '<table><thead><tr><th>Description</th><th class="right">Amount</th></tr></thead><tbody>'
      + '<tr><td>Total Sales Revenue</td><td class="right bold green">'+Utils.cur(totalSales,cur)+'</td></tr>'
      + '<tr><td>Less: Cost of Goods Sold</td><td class="right red">('+Utils.cur(totalCOGS,cur)+')</td></tr>'
      + '<tr class="total-row"><td>Gross Profit</td><td class="right green">'+Utils.cur(grossProfit,cur)+'</td></tr>'
      + '<tr><td>Less: Manual Expenses</td><td class="right red">('+Utils.cur(manualExp,cur)+')</td></tr>'
      + (allocTot>0?'<tr><td>Less: Allocated Expenses</td><td class="right" style="color:#b45309">('+Utils.cur(allocTot,cur)+')</td></tr>':'')
      + '<tr class="total-row"><td class="bold">NET PROFIT</td><td class="right bold '+(netProfit>=0?'green':'red')+'">'+Utils.cur(netProfit,cur)+'</td></tr>'
      + '</tbody></table>'
      + '<h2>Cash Available</h2>'
      + '<table><thead><tr><th>Description</th><th class="right">Amount</th></tr></thead><tbody>'
      + '<tr><td>Cash Sales Collected</td><td class="right green">'+Utils.cur(cashFromSales,cur)+'</td></tr>'
      + (cashFromPart>0?'<tr><td>Partial Payments Collected</td><td class="right green">'+Utils.cur(cashFromPart,cur)+'</td></tr>':'')
      + '<tr><td>Less: Expenses Paid</td><td class="right red">('+Utils.cur(manualExp,cur)+')</td></tr>'
      + (salaryPaid>0?'<tr><td>Less: Salary Paid</td><td class="right red">('+Utils.cur(salaryPaid,cur)+')</td></tr>':'')
      + '<tr class="total-row"><td class="bold">Cash Available</td><td class="right bold blue">'+Utils.cur(cashAvailable,cur)+'</td></tr>'
      + '</tbody></table>'
      + '<div class="sig-line">'
      + '<div class="sig">Prepared by: _________________________&nbsp;&nbsp;Date: ___________</div>'
      + '<div class="sig">Approved by: _________________________&nbsp;&nbsp;Date: ___________</div>'
      + '</div>'
      + '<div style="text-align:center;font-size:10px;color:#888;margin-top:20px;border-top:1px solid #ddd;padding-top:10px">SmartStock Pro · '+Utils.esc(bizName)+' · '+now.toLocaleDateString()+'</div>'
      + '</body></html>';

    if (typeof Sales !== 'undefined' && Sales._printHtml) {
      Sales._printHtml(html, 'finance-print-frame');
    } else {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
      setTimeout(function(){ try{f.contentWindow.print();}catch(e){ window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank'); } }, 600);
    }
  },
};
