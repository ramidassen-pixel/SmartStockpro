var Reports = {
  period: 'month',
  dailyDate: '',
  view: 'financial', // 'financial' or 'daily'

  // ══════════════════════════════════════════════════════════════
  // MAIN RENDER — switches between Financial and Daily Report
  // ══════════════════════════════════════════════════════════════
  render: function() {
    var pg = Utils.get('pg-reports');
    if (!pg) return;
    if (!this.dailyDate) this.dailyDate = Utils.today();
    if (this.view === 'daily') {
      this.renderDailyView(pg);
    } else {
      this.renderFinancialView(pg);
    }
  },

  // ══════════════════════════════════════════════════════════════
  // FINANCIAL REPORT VIEW
  // ══════════════════════════════════════════════════════════════
  renderFinancialView: function(pg) {
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var sales    = DB.getSales();
    var expenses = DB.getExpenses();
    var today    = Utils.today();
    var month    = today.slice(0, 7);
    var weekDate = new Date(); weekDate.setDate(weekDate.getDate() - 6);
    var weekStr  = weekDate.toISOString().slice(0, 10);
    var user     = Auth.currentUser || {};
    var role     = (user.role || 'owner').toLowerCase();
    var canSeeMoney = (role==='owner'||role==='admin'||role==='primary_admin'||role==='primary admin'||role==='manager'||role==='store_manager'||role==='accountant');
    var mask = '— — —';

    // Date range for current period
    var filtered, expFiltered, fromStr, toStr;
    if (this.period === 'today') {
      fromStr = today; toStr = today;
      filtered    = sales.filter(function(s){ return s.date === today; });
      expFiltered = expenses.filter(function(e){ return e.date === today; });
    } else if (this.period === 'week') {
      fromStr = weekStr; toStr = today;
      filtered    = sales.filter(function(s){ return s.date >= weekStr && s.date <= today; });
      expFiltered = expenses.filter(function(e){ return e.date >= weekStr && e.date <= today; });
    } else if (this.period === 'month') {
      fromStr = month + '-01'; toStr = today;
      filtered    = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
      expFiltered = expenses.filter(function(e){ return e.date && e.date.startsWith(month); });
    } else if (this.period === 'year') {
      var yr = today.slice(0,4);
      fromStr = yr + '-01-01'; toStr = today;
      filtered    = sales.filter(function(s){ return s.date && s.date.startsWith(yr); });
      expFiltered = expenses.filter(function(e){ return e.date && e.date.startsWith(yr); });
    } else {
      fromStr = month + '-01'; toStr = today;
      filtered    = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
      expFiltered = expenses.filter(function(e){ return e.date && e.date.startsWith(month); });
    }

    // ── Revenue & Profit ──
    var rev     = filtered.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var cogs    = filtered.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost||0)*parseInt(i.qty||1)); },0); }, 0);
    var gross   = rev - cogs;
    var manExp  = expFiltered.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var allocs  = DB.getAllocatedDaily();
    var allocDay= allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    // Count days in period for total allocation
    var pDays   = Math.max(1, Math.round((new Date(toStr) - new Date(fromStr)) / 86400000) + 1);
    var allocTot= allocDay * pDays;
    var totalExp= manExp + allocTot;
    var net     = rev - totalExp;
    var margin  = rev > 0 ? (net/rev*100).toFixed(1) : '0.0';

    // ── Payment method breakdown ──
    var payMethods = {};
    filtered.forEach(function(s){
      var m = s.payment || 'Cash';
      payMethods[m] = (payMethods[m]||0) + (parseFloat(s.total)||0);
    });

    // ── Top products ──
    var prodMap = {};
    filtered.forEach(function(s){
      (s.items||[]).forEach(function(item){
        if (!prodMap[item.name]) prodMap[item.name] = {qty:0,rev:0};
        prodMap[item.name].qty += parseInt(item.qty)||1;
        prodMap[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var topProds = Object.keys(prodMap).map(function(k){ return {name:k,qty:prodMap[k].qty,rev:prodMap[k].rev}; })
      .sort(function(a,b){ return b.rev-a.rev; }).slice(0,10);

    // ── Top customers ──
    var custMap = {};
    filtered.forEach(function(s){
      var key = s.customer||'Walk-in';
      if (!custMap[key]) custMap[key] = {spent:0,debt:0};
      custMap[key].spent += parseFloat(s.total)||0;
      if (s.status!=='Paid') custMap[key].debt += parseFloat(s.balance)||0;
    });
    var topCusts = Object.keys(custMap).map(function(k){ return {name:k,spent:custMap[k].spent,debt:custMap[k].debt}; })
      .sort(function(a,b){ return b.spent-a.spent; }).slice(0,10);

    // ── Expense breakdown by category ──
    var expCats = {};
    expFiltered.forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });
    var expCatMax = Math.max.apply(null, Object.values(expCats).concat([1]));

    // ── Debtors ──
    var debtSales = sales.filter(function(s){ return s.status!=='Paid'; });
    var debtMap = {};
    debtSales.forEach(function(s){
      var key = s.customer||'Walk-in';
      if (!debtMap[key]) debtMap[key] = {total:0, oldest:s.date};
      debtMap[key].total += parseFloat(s.balance)||0;
      if (s.date < debtMap[key].oldest) debtMap[key].oldest = s.date;
    });
    var debtors = Object.keys(debtMap).map(function(k){ return {name:k,total:debtMap[k].total,oldest:debtMap[key=k].oldest}; })
      .sort(function(a,b){ return b.total-a.total; });
    var totalDebt = debtors.reduce(function(a,d){ return a+d.total; },0);

    // ── Suppliers ──
    var suppliers = DB.getSuppliers();
    var suppDebt = suppliers.filter(function(s){ return (parseFloat(s.balance)||0) > 0; });
    var totalSuppDebt = suppDebt.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    // ── Period chips ──
    var periods = [['today','Today'],['week','This Week'],['month','This Month'],['year','This Year']];
    var chips = periods.map(function(p){
      return '<div class="chip'+(Reports.period===p[0]?' active':'')+'" onclick="Reports.setPeriod(\''+p[0]+'\')">' + p[1] + '</div>';
    }).join('');

    // ── P&L Table ──
    function plRow(label, val, color, bold) {
      var style = 'display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)';
      if (bold) style += ';margin-top:4px;padding-top:10px;border-top:2px solid var(--bd2)';
      return '<div style="'+style+'">'
        + '<span style="font-size:13px;color:var(--t2);'+(bold?'font-weight:800;color:var(--t1)':'')+'">' + label + '</span>'
        + '<span style="font-size:'+(bold?'16':'14')+'px;font-weight:'+(bold?'900':'700')+';color:'+color+';font-family:var(--fm)">'+(canSeeMoney?val:mask)+'</span>'
        + '</div>';
    }

    var plHtml = '<div class="sec">'
      + '<div class="sec-title">📊 Profit &amp; Loss</div>'
      + '<div class="card card-body">'
      + plRow('Gross Revenue', Utils.cur(rev,cur), 'var(--ok)')
      + plRow('Cost of Goods Sold', '('+Utils.cur(cogs,cur)+')', 'var(--er)')
      + plRow('GROSS PROFIT', Utils.cur(gross,cur), gross>=0?'var(--ok)':'var(--er)', true)
      + plRow('Manual Expenses', '('+Utils.cur(manExp,cur)+')', 'var(--er)')
      + plRow('Allocated Expenses', '('+Utils.cur(allocTot,cur)+')', 'var(--wa)')
      + plRow('Total Expenses', '('+Utils.cur(totalExp,cur)+')', 'var(--er)')
      + plRow('NET PROFIT', Utils.cur(net,cur)+' ('+margin+'%)', net>=0?'var(--g)':'var(--er)', true)
      + '</div></div>';

    // ── KPI Cards ──
    var kpis = '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">💰</div><div class="kpi-label">Revenue</div><div class="kpi-value">'+(canSeeMoney?Utils.cur(rev,cur):mask)+'</div><div class="kpi-sub">'+filtered.length+' sales</div></div>'
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)"><div class="kpi-icon">💸</div><div class="kpi-label">Expenses</div><div class="kpi-value">'+(canSeeMoney?Utils.cur(totalExp,cur):mask)+'</div></div>'
      + '<div class="kpi" style="--kc:'+(net>=0?'var(--ok)':'var(--er)')+';--kibg:'+(net>=0?'var(--okb)':'var(--erb)')+'"><div class="kpi-icon">'+(net>=0?'📈':'📉')+'</div><div class="kpi-label">Net Profit</div><div class="kpi-value">'+(canSeeMoney?Utils.cur(net,cur):mask)+'</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📊</div><div class="kpi-label">Margin</div><div class="kpi-value">'+(canSeeMoney?margin+'%':mask)+'</div></div>'
      + '</div></div>';

    // ── Revenue chart ──
    var chartHtml = '<div class="sec"><div class="chart-wrap">'
      + '<div class="chart-title">Revenue Trend</div>'
      + '<div class="chart-sub">'+cur+' breakdown</div>'
      + Charts.weekBars(sales)
      + '</div></div>';

    // ── Payment methods ──
    var payTotal = Object.values(payMethods).reduce(function(a,v){ return a+v; }, 0) || 1;
    var payHtml = '<div class="sec"><div class="sec-title">💳 Sales by Payment Method</div>'
      + '<div class="card card-body">'
      + Object.keys(payMethods).map(function(m){
          var pct = Math.round((payMethods[m]/payTotal)*100);
          return '<div style="margin-bottom:10px">'
            + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
            + '<span style="color:var(--t2)">'+Utils.esc(m)+'</span>'
            + '<span style="color:var(--t1);font-weight:700">'+(canSeeMoney?Utils.cur(payMethods[m],cur):mask)+' · '+pct+'%</span></div>'
            + '<div class="progress" style="height:6px"><div class="progress-fill" style="width:'+pct+'%;background:var(--g)"></div></div>'
            + '</div>';
        }).join('')
      + '</div></div>';

    // ── Top products ──
    var topProdHtml = '<div class="sec"><div class="sec-title">🏆 Top Products</div>'
      + (topProds.length ? '<div class="card card-body">'
          + topProds.map(function(p,i){
              var medals=['🥇','🥈','🥉'];
              return '<div class="report-row"><span class="report-label">'+(medals[i]||((i+1)+'.'))+' '+Utils.esc(p.name)+'<span style="font-size:10px;color:var(--t3);margin-left:6px">'+p.qty+' units</span></span>'
                + '<span class="report-val gold">'+(canSeeMoney?Utils.cur(p.rev,cur):mask)+'</span></div>';
            }).join('')
          + '</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon">📦</div><div class="empty-title">No sales this period</div></div>')
      + '</div>';

    // ── Top customers ──
    var topCustHtml = '<div class="sec"><div class="sec-title">👥 Top Customers</div>'
      + (topCusts.length ? '<div class="card card-body">'
          + topCusts.map(function(c,i){
              return '<div class="report-row">'
                + '<span class="report-label">'+(i+1)+'. '+Utils.esc(c.name)
                + (c.debt>0?'<span style="font-size:10px;color:var(--wa);margin-left:6px">Owes '+Utils.cur(c.debt,cur)+'</span>':'')
                +'</span>'
                + '<span class="report-val gold">'+(canSeeMoney?Utils.cur(c.spent,cur):mask)+'</span></div>';
            }).join('')
          + '</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon">👥</div><div class="empty-title">No customers this period</div></div>')
      + '</div>';

    // ── Expense breakdown ──
    var expBreakHtml = canSeeMoney ? '<div class="sec"><div class="sec-title">💸 Expense Breakdown</div>'
      + (Object.keys(expCats).length ? '<div class="card card-body">'
          + Object.keys(expCats).sort(function(a,b){ return expCats[b]-expCats[a]; }).map(function(cat){
              var pct = Math.round((expCats[cat]/manExp)*100) || 0;
              return '<div style="margin-bottom:10px">'
                + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
                + '<span style="color:var(--t2)">'+Utils.esc(cat)+'</span>'
                + '<span style="color:var(--er);font-weight:700">'+Utils.cur(expCats[cat],cur)+' · '+pct+'%</span></div>'
                + '<div class="progress" style="height:5px"><div class="progress-fill" style="width:'+pct+'%;background:var(--er)"></div></div>'
                + '</div>';
            }).join('')
          + (allocTot>0?'<div style="border-top:1px solid var(--bd);padding-top:8px;margin-top:4px">'
              + '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--wa)">Allocated (recurring)</span><span style="color:var(--wa);font-weight:700">'+Utils.cur(allocTot,cur)+'</span></div>'
              + '</div>':'')
          + '</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon">💸</div><div class="empty-title">No expenses this period</div></div>')
      + '</div>' : '';

    // ── Debtors ──
    var now = new Date();
    var debtHtml = canSeeMoney ? '<div class="sec"><div class="sec-title">💳 Outstanding Debts <span style="color:var(--t3);font-weight:400;font-size:11px">'+debtors.length+' customers · '+Utils.cur(totalDebt,cur)+'</span></div>'
      + (debtors.length ? '<div class="card">'
          + debtors.map(function(d){
              var days = Math.round((now - new Date(d.oldest)) / 86400000);
              var dc = days > 30 ? 'var(--er)' : days > 7 ? 'var(--wa)' : 'var(--in)';
              return '<div class="list-item">'
                + '<div class="list-info"><div class="list-name">'+Utils.esc(d.name)+'</div>'
                + '<div class="list-meta">Oldest: '+Utils.date(d.oldest)+' · '+days+' days ago</div></div>'
                + '<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(d.total,cur)+'</div>'
                + '<span style="font-size:9px;padding:2px 7px;border-radius:99px;background:'+dc+'18;color:'+dc+';border:1px solid '+dc+'40;font-weight:700">'+(days>30?'OVERDUE':days>7?'FOLLOW UP':'RECENT')+'</span>'
                + '</div></div>';
            }).join('')
          + '</div>'
        : '<div style="padding:12px 14px;color:var(--ok);font-weight:600;font-size:13px;background:var(--okb);border-radius:var(--r10)">✓ No outstanding debts</div>')
      + '</div>' : '';

    // ── Suppliers ──
    var suppHtml = canSeeMoney && suppDebt.length ? '<div class="sec"><div class="sec-title">🏭 Supplier Payables · '+Utils.cur(totalSuppDebt,cur)+'</div>'
      + '<div class="card">'
      + suppDebt.map(function(s){
          return '<div class="list-item"><div class="list-info"><div class="list-name">'+Utils.esc(s.name)+'</div>'
            +'<div class="list-meta">'+(s.dueDate?'Due: '+Utils.date(s.dueDate):'No due date')+'</div></div>'
            +'<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(s.balance,cur)+'</div></div></div>';
        }).join('')
      + '</div></div>' : '';

    // ── Export buttons ──
    var exportHtml = canSeeMoney ? '<div class="sec" style="display:flex;gap:8px">'
      + '<button class="btn-ghost" style="flex:1;font-size:12px" onclick="Reports.exportCSV()">📥 Export CSV</button>'
      + '<button class="btn-ghost" style="flex:1;font-size:12px" onclick="Reports.switchToDaily()">📅 Daily Report</button>'
      + '</div>' : '';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Reports</div><div class="page-sub">Financial performance</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Reports.switchToDaily()">📅 Daily</button></div>'
      + '</div>'
      + '<div class="chips">'+chips+'</div>'
      + kpis + plHtml + chartHtml + payHtml + topProdHtml + topCustHtml + expBreakHtml + debtHtml + suppHtml + exportHtml;
  },

  // ══════════════════════════════════════════════════════════════
  // DAILY REPORT VIEW — in-app viewer with date picker
  // ══════════════════════════════════════════════════════════════
  renderDailyView: function(pg) {
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var d        = this.dailyDate;
    var user     = Auth.currentUser || {};
    var sales    = DB.getSales().filter(function(s){ return s.date === d; });
    var expenses = DB.getExpenses().filter(function(e){ return e.date === d; });
    var allocs   = DB.getAllocatedDaily();
    var allocDay = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    var rev      = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var manExp   = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var net      = rev - manExp - allocDay;
    var hasData  = sales.length > 0 || expenses.length > 0;

    // Payment method totals
    var payTotals = {};
    sales.forEach(function(s){ var m=s.payment||'Cash'; payTotals[m]=(payTotals[m]||0)+(parseFloat(s.total)||0); });

    // Credit sales
    var creditSales = sales.filter(function(s){ return s.status!=='Paid'; });
    var creditAmt   = creditSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);
    var allCustomers= DB.getCustomers();

    // Products sold summary
    var prodSold = {};
    sales.forEach(function(s){
      (s.items||[]).forEach(function(item){
        if (!prodSold[item.name]) prodSold[item.name] = {qty:0,rev:0,price:item.price,cat:''};
        prodSold[item.name].qty += parseInt(item.qty)||1;
        prodSold[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });

    // Low stock
    var products  = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var lowStock  = products.filter(function(p){ return p.qty<=(p.lowLevel||5); });

    // Navigation dates
    var prevDate = new Date(d); prevDate.setDate(prevDate.getDate()-1);
    var nextDate = new Date(d); nextDate.setDate(nextDate.getDate()+1);
    var prevStr  = prevDate.toISOString().slice(0,10);
    var nextStr  = nextDate.toISOString().slice(0,10);
    var today    = Utils.today();
    var isToday  = d === today;

    // Full date label
    var dateObj  = new Date(d + 'T12:00:00');
    var fullDate = dateObj.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

    // ── Date picker bar ──
    var pickerHtml = '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px 0">'
      + '<button class="btn-ghost btn-sm" onclick="Reports.shiftDay(-1)">← Prev</button>'
      + '<input type="date" value="'+d+'" onchange="Reports.setDailyDate(this.value)"'
      + ' style="flex:1;background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r8);padding:8px 10px;font-size:13px;color:var(--t1);text-align:center">'
      + '<button class="btn-ghost btn-sm" '+(isToday?'disabled style="opacity:.4"':'')+' onclick="Reports.shiftDay(1)">Next →</button>'
      + '</div>'
      + '<div style="text-align:center;font-size:12px;color:var(--t2);padding:6px 14px 0">'+fullDate+'</div>';

    if (!hasData) {
      pg.innerHTML = '<div class="page-header">'
        + '<div><div class="page-title">Daily Report</div><div class="page-sub">'+fullDate+'</div></div>'
        + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Reports.switchToFinancial()">← Financial</button></div>'
        + '</div>'
        + pickerHtml
        + '<div class="empty" style="padding:48px 24px"><div class="empty-icon">📋</div>'
        + '<div class="empty-title">No data for this date</div>'
        + '<div class="empty-sub">No sales or expenses were recorded on '+fullDate+'</div></div>';
      return;
    }

    // ── Section: Profit Summary ──
    var summaryRows = '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd);font-size:13px">'
      + '<span style="color:var(--t2)">Gross Sales</span><span style="color:var(--ok);font-weight:700">'+Utils.cur(rev,cur)+'</span></div>'
      + (manExp>0?'<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd);font-size:13px">'
        + '<span style="color:var(--t2)">Manual Expenses</span><span style="color:var(--er);font-weight:700">-'+Utils.cur(manExp,cur)+'</span></div>':'')
      + (allocDay>0?'<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd);font-size:13px">'
        + '<span style="color:var(--wa)">Allocated Expenses</span><span style="color:var(--wa);font-weight:700">-'+Utils.cur(allocDay,cur)+'/day</span></div>':'')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:900;border-top:2px solid var(--bd2);margin-top:4px">'
      + '<span style="color:var(--t1)">NET PROFIT</span><span style="color:'+(net>=0?'var(--g)':'var(--er)')+'">'+Utils.cur(net,cur)+'</span></div>';

    var summaryStats = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">'
      + '<div style="background:var(--bg3);border-radius:var(--r8);padding:10px;text-align:center">'
      + '<div style="font-size:18px;font-weight:800;color:var(--in)">'+sales.length+'</div><div style="font-size:10px;color:var(--t3)">TRANSACTIONS</div></div>'
      + '<div style="background:var(--bg3);border-radius:var(--r8);padding:10px;text-align:center">'
      + '<div style="font-size:14px;font-weight:800;color:var(--g)">'+(sales.length>0?Utils.cur(rev/sales.length,cur):'—')+'</div><div style="font-size:10px;color:var(--t3)">AVG SALE</div></div>'
      + '</div>'
      + '<div style="margin-top:8px">'
      + Object.keys(payTotals).map(function(m){
          return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">'
            + '<span style="color:var(--t3)">'+Utils.esc(m)+'</span><span style="color:var(--t2);font-weight:600">'+Utils.cur(payTotals[m],cur)+'</span></div>';
        }).join('')
      + (creditAmt>0?'<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">'
        +'<span style="color:var(--wa)">Credit (not yet paid)</span><span style="color:var(--wa);font-weight:600">'+Utils.cur(creditAmt,cur)+'</span></div>':'')
      + '</div>';

    var profSec = '<div class="sec"><div class="sec-title">💰 Daily Profit Summary</div>'
      + '<div class="card card-body">'+summaryRows+summaryStats+'</div></div>';

    // ── Section: Sales list ──
    var salesRows = sales.map(function(s){
      var itemNames = (s.items||[]).map(function(i){ return Utils.esc(i.name)+' ×'+i.qty; }).join(', ');
      if (itemNames.length > 50) itemNames = itemNames.slice(0,48)+'…';
      var bc = s.status==='Paid'?'var(--ok)':s.status==='Partial'?'var(--wa)':'var(--er)';
      return '<div class="list-item">'
        + '<div class="list-icon" style="background:var(--gb3)">🧾</div>'
        + '<div class="list-info"><div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
        + '<div class="list-meta" style="font-family:var(--fm)">'+s.id+'</div>'
        + (itemNames?'<div class="list-meta" style="font-size:10px">'+itemNames+'</div>':'')
        + '</div>'
        + '<div class="list-right"><div class="list-val">'+Utils.cur(s.total,cur)+'</div>'
        + '<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+bc+'18;color:'+bc+';border:1px solid '+bc+'40;font-weight:700">'+((s.status||'PAID').toUpperCase())+'</span>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'+Utils.esc(s.payment||'Cash')+'</div>'
        + '</div></div>';
    }).join('');

    var salesSec = '<div class="sec"><div class="sec-title">🧾 Sales Transactions ('+sales.length+')</div>'
      + (sales.length ? '<div class="card">'+salesRows+'</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon">🧾</div><div class="empty-title">No sales today</div></div>')
      + '</div>';

    // ── Section: Products sold ──
    var prodKeys = Object.keys(prodSold).sort(function(a,b){ return prodSold[b].rev-prodSold[a].rev; });
    var totalUnits = prodKeys.reduce(function(a,k){ return a+prodSold[k].qty; }, 0);
    var prodSec = '<div class="sec"><div class="sec-title">📦 Products Sold ('+totalUnits+' units)</div>'
      + (prodKeys.length ? '<div class="card card-body">'
          + prodKeys.map(function(k){
              var p = prodSold[k];
              return '<div class="report-row"><span class="report-label">'+Utils.esc(k)+'<span style="font-size:10px;color:var(--t3);margin-left:6px">×'+p.qty+'</span></span>'
                + '<span class="report-val gold">'+Utils.cur(p.rev,cur)+'</span></div>';
            }).join('')
          + '</div>'
        : '<div class="empty" style="padding:16px"><div class="empty-title" style="font-size:13px">No products sold</div></div>')
      + '</div>';

    // ── Section: Expenses ──
    var expRows = expenses.map(function(e){
      return '<div class="list-item"><div class="list-icon" style="background:var(--erb)">💸</div>'
        + '<div class="list-info"><div class="list-name">'+Utils.esc(e.description||e.category)+'</div>'
        + '<div class="list-meta">'+Utils.esc(e.category)+'</div></div>'
        + '<div class="list-right"><div class="list-val" style="color:var(--er)">'+Utils.cur(e.amount,cur)+'</div></div></div>';
    }).join('');

    var allocRows = allocs.map(function(a){
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(245,158,11,.1)">'
        + '<span style="font-size:16px">🔒</span>'
        + '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(a.name)+'</div>'
        + '<div style="font-size:11px;color:var(--wa)">'+Utils.esc(a.periodLabel||'Allocated')+'</div></div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--wa)">'+Utils.cur(a.daily,cur)+'/day</div></div>';
    }).join('');

    var expSec = '<div class="sec"><div class="sec-title">💸 Expenses</div>'
      + (expenses.length?'<div class="card">'+expRows+'</div>':'')
      + (manExp>0?'<div style="display:flex;justify-content:space-between;padding:8px 14px;font-weight:700;font-size:13px"><span style="color:var(--t2)">Manual Total</span><span style="color:var(--er)">'+Utils.cur(manExp,cur)+'</span></div>':'')
      + (allocs.length?'<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;color:var(--wa);text-transform:uppercase;letter-spacing:.1em;padding:0 2px 6px">🔒 Allocated (daily share)</div>'
        +'<div style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.18);border-radius:var(--r10);overflow:hidden">'+allocRows+'</div>'
        +'<div style="display:flex;justify-content:space-between;padding:8px 2px;font-weight:700;font-size:13px"><span style="color:var(--wa)">Allocated Total</span><span style="color:var(--wa)">'+Utils.cur(allocDay,cur)+'</span></div>'
        +'</div>':'')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;font-size:14px;border-top:2px solid var(--bd2);margin-top:4px"><span style="color:var(--t1)">Grand Total</span><span style="color:var(--er)">'+Utils.cur(manExp+allocDay,cur)+'</span></div>'
      + '</div>';

    // ── Section: Credit summary ──
    var creditSec = creditSales.length ? '<div class="sec"><div class="sec-title">💳 Credit Sales Today</div>'
      + '<div class="card">'
      + creditSales.map(function(s){
          var cust = allCustomers.find(function(c){ return c.id===s.customerId; });
          var totalOwed = cust ? cust.totalSpent - DB.getSales().filter(function(x){ return x.customerId===cust.id&&x.status==='Paid'; }).reduce(function(a,x){ return a+(parseFloat(x.total)||0); },0) : (parseFloat(s.balance)||0);
          return '<div class="list-item"><div class="list-icon" style="background:var(--wab)">👤</div>'
            + '<div class="list-info"><div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
            + '<div class="list-meta">'+s.id+' · Balance: '+Utils.cur(s.balance||0,cur)+'</div></div>'
            + '<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(s.total,cur)+'</div>'
            + '<div style="font-size:10px;color:var(--er);margin-top:2px">Owes: '+Utils.cur(s.balance||0,cur)+'</div></div></div>';
        }).join('')
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:13px"><span style="color:var(--t2)">New credit today</span><span style="color:var(--wa)">'+Utils.cur(creditAmt,cur)+'</span></div>'
      + '</div>' : '';

    // ── Section: Low stock warning ──
    var lowSec = lowStock.length ? '<div class="sec">'
      + '<div style="padding:12px 14px;background:var(--wab);border:1px solid var(--wabd);border-radius:var(--r10);font-size:13px;color:var(--wa);font-weight:600">'
      + '⚠️ '+lowStock.length+' product'+(lowStock.length!==1?'s':'')+' need reordering — '
      + '<span style="cursor:pointer;text-decoration:underline" onclick="Router.go(\'products\')">view stock list</span>'
      + '</div></div>' : '';

    // ── Action buttons ──
    var actionHtml = '<div class="sec" style="display:flex;gap:8px">'
      + '<button class="btn-ghost" style="flex:1;font-size:12px" onclick="Reports.switchToFinancial()">← Financial</button>'
      + '<button class="btn-primary" style="flex:1;font-size:12px" onclick="Reports.printDailyReport()">🖨 Print Report</button>'
      + '</div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Daily Report</div><div class="page-sub">'+fullDate+'</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Reports.switchToFinancial()">← Back</button></div>'
      + '</div>'
      + pickerHtml
      + profSec + salesSec + prodSec + expSec + creditSec + lowSec + actionHtml;
  },

  // ══════════════════════════════════════════════════════════════
  // PRINT — Full professional daily report
  // ══════════════════════════════════════════════════════════════
  printDailyReport: function() {
    var d        = this.dailyDate || Utils.today();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var user     = Auth.currentUser || {};
    var userName = user.name || user.username || 'User';
    var now      = new Date();
    var dateObj  = new Date(d + 'T12:00:00');
    var fullDate = dateObj.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    var timeStr  = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

    var sales    = DB.getSales().filter(function(s){ return s.date === d; });
    var expenses = DB.getExpenses().filter(function(e){ return e.date === d; });
    var allocs   = DB.getAllocatedDaily();
    var allocDay = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    var rev      = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var manExp   = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var net      = rev - manExp - allocDay;
    var products = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var lowStock = products.filter(function(p){ return p.qty<=(p.lowLevel||5); });

    var payTotals = {};
    sales.forEach(function(s){ var m=s.payment||'Cash'; payTotals[m]=(payTotals[m]||0)+(parseFloat(s.total)||0); });
    var creditSales = sales.filter(function(s){ return s.status!=='Paid'; });
    var creditAmt   = creditSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    var prodSold = {};
    sales.forEach(function(s){
      (s.items||[]).forEach(function(item){
        if (!prodSold[item.name]) prodSold[item.name] = {qty:0,rev:0,price:parseFloat(item.price)||0};
        prodSold[item.name].qty += parseInt(item.qty)||1;
        prodSold[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var totalUnits = Object.values(prodSold).reduce(function(a,p){ return a+p.qty; },0);

    var css = '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
      + 'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff;margin:0;padding:0}'
      + '.page{max-width:210mm;margin:0 auto;padding:15mm}'
      + 'h1{font-size:22px;font-weight:900;margin:0 0 2px}'
      + 'h2{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #111;padding-bottom:4px;margin:18px 0 8px}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}'
      + 'th{background:#f0f0f0;border:1px solid #ccc;padding:6px 8px;text-align:left;font-weight:700}'
      + 'td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}'
      + '.right{text-align:right}.bold{font-weight:700}.total-row{background:#f9f9f9;font-weight:700}'
      + '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:16px}'
      + '.biz-name{font-size:24px;font-weight:900;letter-spacing:-.02em}'
      + '.report-title{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#444;margin-top:4px}'
      + '.meta{font-size:10px;color:#666;margin-top:2px}'
      + '.summary-box{background:#f9f9f9;border:1px solid #ddd;padding:12px;margin-bottom:14px}'
      + '.sum-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee}'
      + '.sum-row.total{font-weight:900;font-size:14px;border-top:2px solid #111;border-bottom:none;padding-top:8px;margin-top:4px}'
      + '.badge{padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700}'
      + '.badge-paid{background:#d1fae5;color:#065f46}'
      + '.badge-credit{background:#fee2e2;color:#991b1b}'
      + '.badge-partial{background:#fef3c7;color:#92400e}'
      + '.sig-line{display:flex;justify-content:space-between;margin-top:32px}'
      + '.sig{flex:1;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#444;margin-right:20px}'
      + '.footer{text-align:center;font-size:10px;color:#888;margin-top:24px;border-top:1px solid #ddd;padding-top:10px}'
      + '@media print{@page{size:A4 portrait;margin:10mm} body{margin:0;padding:0} .page{padding:0;max-width:100%} .no-print{display:none}}'
      + '@page{@bottom-right{content:counter(page) " of " counter(pages);font-size:10px}}';

    var salesTableRows = sales.map(function(s){
      var items = (s.items||[]).map(function(i){ return i.name+' \xD7'+i.qty; }).join(', ');
      if (items.length>60) items=items.slice(0,58)+'\u2026';
      var badge = s.status==='Paid'?'badge-paid':s.status==='Partial'?'badge-partial':'badge-credit';
      return '<tr><td style="font-family:monospace">'+Utils.esc(s.id)+'</td>'
        +'<td>'+Utils.esc(s.customer||'Walk-in')+'</td>'
        +'<td>'+Utils.esc(items)+'</td>'
        +'<td class="right bold">'+Utils.cur(s.total,cur)+'</td>'
        +'<td>'+Utils.esc(s.payment||'Cash')+'</td>'
        +'<td><span class="badge '+badge+'">'+(s.status||'PAID').toUpperCase()+'</span></td></tr>';
    }).join('');

    var prodTableRows = Object.keys(prodSold).sort(function(a,b){ return prodSold[b].rev-prodSold[a].rev; }).map(function(k){
      var p=prodSold[k];
      return '<tr><td>'+Utils.esc(k)+'</td><td class="right">'+p.qty+'</td>'
        +'<td class="right">'+Utils.cur(p.price,cur)+'</td>'
        +'<td class="right bold">'+Utils.cur(p.rev,cur)+'</td></tr>';
    }).join('');

    var expTableRows = expenses.map(function(e){
      return '<tr><td>'+Utils.esc(e.description||e.category)+'</td>'
        +'<td>'+Utils.esc(e.category)+'</td>'
        +'<td>'+Utils.esc(e.payment||'Cash')+'</td>'
        +'<td class="right bold">'+Utils.cur(e.amount,cur)+'</td></tr>';
    }).join('');

    var allocTableRows = allocs.map(function(a){
      return '<tr><td>'+Utils.esc(a.name)+'</td>'
        +'<td>'+Utils.esc(a.periodLabel||'Recurring')+'</td>'
        +'<td class="right bold">'+Utils.cur(a.daily,cur)+'</td></tr>';
    }).join('');

    var creditTableRows = creditSales.map(function(s){
      return '<tr><td>'+Utils.esc(s.customer||'Walk-in')+'</td>'
        +'<td style="font-family:monospace">'+Utils.esc(s.id)+'</td>'
        +'<td class="right">'+Utils.cur(s.total,cur)+'</td>'
        +'<td class="right bold" style="color:#b45309">'+Utils.cur(s.balance||0,cur)+'</td></tr>';
    }).join('');

    var payRows = Object.keys(payTotals).map(function(m){
      return '<div class="sum-row"><span>'+Utils.esc(m)+'</span><span class="bold">'+Utils.cur(payTotals[m],cur)+'</span></div>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Report — '+Utils.esc(bizName)+'</title><style>'+css+'</style></head><body>'
      + '<div class="page">'
      // Header
      + '<div class="header">'
      + '<div style="display:flex;align-items:flex-start;gap:14px">'
      + (settings.bizLogo?'<img src="'+settings.bizLogo+'" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #ddd;flex-shrink:0">':'')
      + '<div>'
      + '<div class="biz-name">'+Utils.esc(bizName)+'</div>'
      + (settings.bizAddress?'<div class="meta">📍 '+Utils.esc(settings.bizAddress)+'</div>':'')
      + (settings.bizPhone  ?'<div class="meta">📞 '+Utils.esc(settings.bizPhone)+'</div>':'')
      + (settings.bizEmail  ?'<div class="meta">✉️ '+Utils.esc(settings.bizEmail)+'</div>':'')
      + '<div class="report-title">Daily Business Report</div>'
      + '<div class="meta">'+fullDate+'</div>'
      + '</div></div>'
      + '<div style="text-align:right">'
      + '<div class="meta">Generated by: '+Utils.esc(userName)+'</div>'
      + '<div class="meta">Printed at: '+timeStr+'</div>'
      + '<div class="meta">'+now.toLocaleDateString()+'</div>'
      + '</div>'
      + '</div>'
      // Section 1 — Profit Summary
      + '<h2>1. Daily Profit Summary</h2>'
      + '<div class="summary-box">'
      + '<div class="sum-row"><span>Gross Sales Today</span><span class="bold">'+Utils.cur(rev,cur)+'</span></div>'
      + (manExp>0?'<div class="sum-row"><span>Less: Manual Expenses</span><span class="bold" style="color:#dc2626">-'+Utils.cur(manExp,cur)+'</span></div>':'')
      + (allocDay>0?'<div class="sum-row"><span>Less: Allocated Expenses</span><span class="bold" style="color:#d97706">-'+Utils.cur(allocDay,cur)+'</span></div>':'')
      + '<div class="sum-row total"><span>NET PROFIT TODAY</span><span style="color:'+(net>=0?'#065f46':'#dc2626')+'">'+Utils.cur(net,cur)+'</span></div>'
      + '</div>'
      + '<table><thead><tr><th>Metric</th><th class="right">Value</th></tr></thead><tbody>'
      + '<tr><td>Total transactions</td><td class="right">'+sales.length+'</td></tr>'
      + '<tr><td>Average sale value</td><td class="right">'+(sales.length>0?Utils.cur(rev/sales.length,cur):'—')+'</td></tr>'
      + Object.keys(payTotals).map(function(m){ return '<tr><td>'+Utils.esc(m)+' collected</td><td class="right">'+Utils.cur(payTotals[m],cur)+'</td></tr>'; }).join('')
      + (creditAmt>0?'<tr><td style="color:#b45309">Credit sales (not yet paid)</td><td class="right" style="color:#b45309">'+Utils.cur(creditAmt,cur)+'</td></tr>':'')
      + '</tbody></table>'
      // Section 2 — Sales List
      + '<h2>2. Sales Transactions</h2>'
      + (sales.length?
          '<table><thead><tr><th>Invoice</th><th>Customer</th><th>Products</th><th class="right">Amount</th><th>Payment</th><th>Status</th></tr></thead>'
          +'<tbody>'+salesTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td colspan="3">TOTAL SALES</td><td class="right">'+Utils.cur(rev,cur)+'</td><td colspan="2">'+sales.length+' transactions</td></tr></tfoot>'
          +'</table>'
        : '<p style="color:#888">No sales recorded for this date.</p>')
      // Section 3 — Products
      + '<h2>3. Products Sold</h2>'
      + (Object.keys(prodSold).length?
          '<table><thead><tr><th>Product</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead>'
          +'<tbody>'+prodTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td>TOTALS</td><td class="right">'+totalUnits+' units</td><td></td><td class="right">'+Utils.cur(rev,cur)+'</td></tr></tfoot>'
          +'</table>'
        : '<p style="color:#888">No products sold this date.</p>')
      // Section 4 — Expenses
      + '<h2>4. Expenses</h2>'
      + (expenses.length?
          '<p style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px">Manual Expenses</p>'
          +'<table><thead><tr><th>Description</th><th>Category</th><th>Payment</th><th class="right">Amount</th></tr></thead>'
          +'<tbody>'+expTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td colspan="3">TOTAL MANUAL EXPENSES</td><td class="right">'+Utils.cur(manExp,cur)+'</td></tr></tfoot>'
          +'</table>'
        : '<p style="font-size:11px;color:#888">No manual expenses recorded.</p>')
      + (allocs.length?
          '<p style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px;margin-top:10px">Allocated Expenses (Daily Share)</p>'
          +'<table><thead><tr><th>Name</th><th>Basis</th><th class="right">Today\'s Amount</th></tr></thead>'
          +'<tbody>'+allocTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td colspan="2">TOTAL ALLOCATED EXPENSES</td><td class="right">'+Utils.cur(allocDay,cur)+'</td></tr></tfoot>'
          +'</table>'
        :'')
      + '<p style="font-weight:800;font-size:13px">Grand Total Expenses: '+Utils.cur(manExp+allocDay,cur)+'</p>'
      // Section 5 — Credit Summary
      + (creditSales.length?
          '<h2>5. Credit Sales</h2>'
          +'<table><thead><tr><th>Customer</th><th>Invoice</th><th class="right">Sale Amount</th><th class="right">Balance Due</th></tr></thead>'
          +'<tbody>'+creditTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td colspan="3">TOTAL NEW CREDIT</td><td class="right" style="color:#b45309">'+Utils.cur(creditAmt,cur)+'</td></tr></tfoot>'
          +'</table>'
        :'')
      // Section 6 — Payment summary
      + '<h2>'+(creditSales.length?'6':'5')+'. Cash &amp; Payment Summary</h2>'
      + '<div class="summary-box">'
      + payRows
      + (creditAmt>0?'<div class="sum-row"><span style="color:#b45309">Less: Credit sales</span><span class="bold" style="color:#b45309">-'+Utils.cur(creditAmt,cur)+'</span></div>':'')
      + '<div class="sum-row total"><span>Total Collected (Cash &amp; Transfers)</span><span>'+Utils.cur(rev-creditAmt,cur)+'</span></div>'
      + '</div>'
      // Low stock warning
      + (lowStock.length?'<p style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:4px;font-size:12px;font-weight:600;color:#92400e">'
        +'&#9888; '+lowStock.length+' product'+(lowStock.length!==1?'s':'')+' are below minimum stock level and need reordering.</p>':'')
      // Signatures
      + '<div class="sig-line">'
      + '<div class="sig">Prepared by: _________________________ &nbsp;&nbsp; Date: ___________</div>'
      + '<div class="sig">Approved by: _________________________ &nbsp;&nbsp; Date: ___________</div>'
      + '</div>'
      // Footer
      + '<div class="footer">Report generated by SmartStock Pro &nbsp;|&nbsp; '+Utils.esc(bizName)+' &nbsp;|&nbsp; '+fullDate+'</div>'
      + '</div>'
      + '</body></html>';

    if (typeof Sales !== 'undefined' && Sales._printHtml) {
      Sales._printHtml(html, 'daily-report-frame');
    } else {
      var f=document.createElement('iframe');
      f.id='daily-report-frame';
      f.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
      setTimeout(function(){ try{f.contentWindow.print();}catch(e){window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank');} },600);
    }
  },

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════
  setPeriod:         function(p) { this.period=p; this.view='financial'; this.render(); },
  switchToDaily:     function()  { this.view='daily'; this.dailyDate=this.dailyDate||Utils.today(); this.render(); },
  switchToFinancial: function()  { this.view='financial'; this.render(); },
  setDailyDate:      function(d) { this.dailyDate=d; this.render(); },
  shiftDay: function(n) {
    var d=new Date(this.dailyDate+'T12:00:00'); d.setDate(d.getDate()+n);
    var nd=d.toISOString().slice(0,10);
    if (nd<=Utils.today()) { this.dailyDate=nd; this.render(); }
  },

  exportCSV: function() {
    var sales  = DB.getSales();
    var header = ['ID','Date','Customer','Total','Status','Items'];
    var rows   = sales.map(function(s){
      return [s.id||'',s.date||'',s.customer||'',s.total||0,s.status||'',(s.items||[]).length];
    });
    var lines = [header].concat(rows).map(function(row){
      return row.map(function(cell){ return '"'+String(cell).replace(/"/g,'""')+'"'; }).join(',');
    });
    var csv = lines.join('\r\n');
    var a=document.createElement('a');
    a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    a.download='smartstock_reports_'+Utils.today()+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    Toast.show('CSV exported \u2713','ok');
  },
};
