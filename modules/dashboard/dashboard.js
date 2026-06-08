var Dashboard = {

  render: function() {
    var pg = Utils.get('pg-dashboard');
    if (!pg) return;

    var s         = DB.stats();
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';
    var user      = Auth.currentUser || {};
    var role      = (user.role || 'owner').toLowerCase();
    var sales     = DB.getSales();
    var products  = DB.getProducts().filter(function(p){ return p.status !== 'inactive'; });
    var suppliers = DB.getSuppliers();
    var today     = Utils.today();
    var month     = today.slice(0, 7);
    var now       = new Date();
    var hour      = now.getHours();
    var dayOfWeek = now.getDay(); // 0=Sun,1=Mon,...,6=Sat

    // ── Role-based visibility ─────────────────────────────────────────────
    var canSeeMoney = (role==='owner'||role==='admin'||role==='primary admin'||role==='manager');
    var mask = '— — —';
    function showMoney(val) { return canSeeMoney ? Utils.cur(val, cur) : mask; }

    // ── TODAY data ────────────────────────────────────────────────────────
    var allExpenses   = DB.getExpenses();
    var allPayroll    = DB.getPayroll();
    var todaySales    = sales.filter(function(s){ return s.date === today; });
    var todayRev      = todaySales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var todayManExp   = allExpenses.filter(function(e){ return e.date===today; })
                         .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var todayCOGS     = todaySales.reduce(function(a,s){
      return a + (s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); }, 0);
    }, 0);

    // Allocated: daily rate but only on working days (Mon–Sat, skip Sunday)
    var allocAllActive = DB.getAllocatedDaily();
    var rawAllocDaily  = allocAllActive.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    // If today is Sunday (0), show 0 allocated for today
    var todayAlloc     = (dayOfWeek === 0) ? 0 : rawAllocDaily;

    var todayGross     = todayRev - todayCOGS;          // Gross Profit today
    var todayNet       = todayGross - todayManExp - todayAlloc; // Net Profit today

    // Yesterday comparison
    var yest         = new Date(now); yest.setDate(yest.getDate()-1);
    var yestStr      = yest.toISOString().slice(0,10);
    var yestDow      = yest.getDay();
    var yestSales    = sales.filter(function(s){ return s.date === yestStr; });
    var yestRev      = yestSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var yestCOGS     = yestSales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0); },0);
    var yestManExp   = allExpenses.filter(function(e){ return e.date===yestStr; }).reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
    var yestAlloc    = (yestDow === 0) ? 0 : rawAllocDaily;
    var yestNet      = (yestRev - yestCOGS) - yestManExp - yestAlloc;
    var netDiff      = todayNet - yestNet;

    var compHtml = '';
    if (canSeeMoney) {
      if (Math.abs(netDiff) < 0.01) {
        compHtml = '<span style="color:var(--t3);font-size:12px;font-weight:600">→ Same as yesterday</span>';
      } else if (netDiff > 0) {
        compHtml = '<span style="color:var(--ok);font-size:12px;font-weight:700">↑ '+Utils.cur(netDiff,cur)+' more than yesterday</span>';
      } else {
        compHtml = '<span style="color:var(--er);font-size:12px;font-weight:700">↓ '+Utils.cur(Math.abs(netDiff),cur)+' less than yesterday</span>';
      }
    }

    // ── THIS MONTH data ───────────────────────────────────────────────────
    var monthSales   = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
    var monthRev     = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var monthCOGS    = monthSales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0); },0);
    var monthManExp  = allExpenses.filter(function(e){ return e.date && e.date.startsWith(month); })
                        .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);

    // Working days so far this month (Mon–Sat only)
    var monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);
    var workDaysUsed = 0;
    for (var d = new Date(monthStart); d <= now; d.setDate(d.getDate()+1)) {
      if (d.getDay() !== 0) workDaysUsed++; // skip Sunday
    }
    var monthAlloc   = rawAllocDaily * workDaysUsed;
    var monthGross   = monthRev - monthCOGS;
    var monthNet     = monthGross - monthManExp - monthAlloc;
    var monthGrossM  = monthRev > 0 ? (monthGross/monthRev*100).toFixed(1) : '0.0';
    var monthNetM    = monthRev > 0 ? (monthNet/monthRev*100).toFixed(1) : '0.0';

    // Outstanding debt
    var debtSales  = sales.filter(function(s){ return s.status !== 'Paid'; });
    var totalDebt  = debtSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);
    var debtCusts  = new Set(debtSales.map(function(s){ return s.customerId||s.customer; })).size;

    // Low stock
    var lowStockCount = s.lowStock.length + s.outStock.length;
    var lowPulse = lowStockCount > 0
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--er);margin-left:6px;animation:pulse 1.5s ease-in-out infinite"></span>'
      : '';

    // ── AREA 1: Greeting Header ───────────────────────────────────────────
    var greet       = hour<12?'Good Morning':hour<17?'Good Afternoon':'Good Evening';
    var displayName = user.name ? user.name.split(' ')[0] : (user.username||'Ramie');
    var fullDate    = now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    var weatherIcon = hour<12?'🌅':hour<17?'☀️':'🌙';

    var greetHtml = '<div style="background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(201,168,76,.02));border:1px solid rgba(201,168,76,.15);border-radius:var(--r16);padding:18px 16px;margin:0 14px 14px">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'
      + '<div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);letter-spacing:-.02em">'+greet+', '+Utils.esc(displayName)+' 👋</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:4px">'+fullDate+'</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px">SmartStock Store · Monrovia, Liberia</div>'
      + '</div>'
      + '<div style="font-size:32px;flex-shrink:0">'+weatherIcon+'</div>'
      + '</div></div>';

    // ── AREA 2: TODAY NET PROFIT hero card ────────────────────────────────
    var heroColor = todayNet>=0 ? 'var(--ok)' : 'var(--er)';
    var heroBg    = todayNet>=0 ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)';
    var heroBd    = todayNet>=0 ? 'rgba(16,185,129,.2)'  : 'rgba(239,68,68,.2)';

    var heroHtml = '<div style="background:'+heroBg+';border:1px solid '+heroBd+';border-radius:var(--r16);padding:18px 16px;margin:0 14px 10px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.14em;margin-bottom:10px;font-family:var(--fm)">Today\'s Net Profit</div>'
      + '<div style="font-size:36px;font-weight:900;color:'+heroColor+';letter-spacing:-.03em;line-height:1;margin-bottom:10px">'+(canSeeMoney?Utils.cur(todayNet,cur):mask)+'</div>'
      + (compHtml?'<div style="margin-bottom:12px">'+compHtml+'</div>':'')
      + '</div>';

    // ── AREA 3: TODAY 4 stat cards ────────────────────────────────────────
    // Card 1: Today Total Sales (Gold)
    // Card 2: Today Manual Expense (Red)
    // Card 3: Today COGS (Amber)
    // Card 4: Today Net Profit = Gross - ManExp - Alloc (Green/Red)
    var todayGrossC = todayGross>=0 ? 'var(--ok)' : 'var(--er)';
    var todayGrossBg= todayGross>=0 ? 'var(--okb)' : 'var(--erb)';
    var todayNetC   = todayNet>=0   ? 'var(--ok)' : 'var(--er)';
    var todayNetBg  = todayNet>=0   ? 'var(--okb)' : 'var(--erb)';

    var statCards = '<div class="kpi-grid" style="grid-template-columns:1fr 1fr;gap:10px;padding:0 14px;margin-bottom:10px">'
      // Today Sales — Gold
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">'
      + '<div class="kpi-icon">💰</div>'
      + '<div class="kpi-label">Today Sales</div>'
      + '<div class="kpi-value">'+showMoney(todayRev)+'</div>'
      + '<div class="kpi-sub">'+todaySales.length+' transaction'+(todaySales.length!==1?'s':'')+'</div></div>'
      // Today Manual Expense — Red
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)">'
      + '<div class="kpi-icon">💸</div>'
      + '<div class="kpi-label">Today Expenses</div>'
      + '<div class="kpi-value">'+showMoney(todayManExp)+'</div>'
      + '<div class="kpi-sub">Manual expenses</div></div>'
      // Today COGS — Amber
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)">'
      + '<div class="kpi-icon">🏷️</div>'
      + '<div class="kpi-label">Today COGS</div>'
      + '<div class="kpi-value">'+showMoney(todayCOGS)+'</div>'
      + '<div class="kpi-sub">Cost of goods sold</div></div>'
      // Today Net Profit — Green/Red
      + '<div class="kpi" style="--kc:'+todayNetC+';--kibg:'+todayNetBg+'">'
      + '<div class="kpi-icon">'+(todayNet>=0?'📈':'📉')+'</div>'
      + '<div class="kpi-label">Today Net Profit</div>'
      + '<div class="kpi-value">'+showMoney(todayNet)+'</div>'
      + '<div class="kpi-sub">After all costs</div></div>'
      + '</div>';

    // ── AREA 4: DETAIL BREAKDOWN — always visible, always on screen ───────
    // Shows: Gross Sale, COGS, Gross Profit, Manual Expense,
    //        Allocated Expense (working days), Net Profit
    // Two columns: TODAY  |  THIS MONTH

    function detailRow(label, todayVal, monthVal, todayColor, monthColor) {
      return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--bd)">'
        + '<span style="font-size:12px;color:var(--t2)">'+label+'</span>'
        + '<span style="font-size:13px;font-weight:700;color:'+todayColor+';font-family:var(--fm);text-align:right">'+todayVal+'</span>'
        + '<span style="font-size:13px;font-weight:700;color:'+monthColor+';font-family:var(--fm);text-align:right;min-width:80px">'+monthVal+'</span>'
        + '</div>';
    }

    function detailBigRow(label, todayVal, monthVal, todayColor, monthColor) {
      return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px 0;border-top:2px solid var(--bd2);margin-top:4px">'
        + '<span style="font-size:13px;font-weight:800;color:var(--t1)">'+label+'</span>'
        + '<span style="font-size:15px;font-weight:900;color:'+todayColor+';font-family:var(--fm);text-align:right">'+todayVal+'</span>'
        + '<span style="font-size:15px;font-weight:900;color:'+monthColor+';font-family:var(--fm);text-align:right;min-width:80px">'+monthVal+'</span>'
        + '</div>';
    }

    var allocNote = rawAllocDaily > 0
      ? (dayOfWeek===0 ? ' (Sunday — not charged)' : ' (×'+workDaysUsed+' work days)')
      : '';
    var monthAllocLabel = 'Allocated Expense'+allocNote;

    var detailHtml = canSeeMoney ? '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r14);padding:15px 15px 10px;margin:0 14px 14px;box-shadow:var(--sh)">'
      // Header row
      + '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-bottom:4px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em">Breakdown</div>'
      + '<div style="font-size:9px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.08em;text-align:right">TODAY</div>'
      + '<div style="font-size:9px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.08em;text-align:right;min-width:80px">THIS MONTH</div>'
      + '</div>'
      // Rows
      + detailRow('Gross Sales',       showMoney(todayRev),   showMoney(monthRev),   'var(--g)',  'var(--g)')
      + detailRow('Cost of Goods (COGS)', showMoney(todayCOGS), showMoney(monthCOGS), 'var(--wa)', 'var(--wa)')
      + detailBigRow('Gross Profit',   showMoney(todayGross), showMoney(monthGross), todayGross>=0?'var(--ok)':'var(--er)', monthGross>=0?'var(--ok)':'var(--er)')
      + detailRow('Manual Expenses',   showMoney(todayManExp), showMoney(monthManExp), 'var(--er)', 'var(--er)')
      + '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--bd)">'
      + '<div><div style="font-size:12px;color:var(--t2)">Allocated Expenses</div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'+(rawAllocDaily>0?(dayOfWeek===0?'Sunday — not charged today':'Mon–Sat, '+Utils.cur(rawAllocDaily,cur)+'/working day'):'No active allocations')+'</div></div>'
      + '<span style="font-size:13px;font-weight:700;color:var(--wa);font-family:var(--fm);text-align:right">'+showMoney(todayAlloc)+'</span>'
      + '<span style="font-size:13px;font-weight:700;color:var(--wa);font-family:var(--fm);text-align:right;min-width:80px">'+showMoney(monthAlloc)+'</span>'
      + '</div>'
      // Net Profit — the real bottom line
      + detailBigRow('NET PROFIT', showMoney(todayNet), showMoney(monthNet), todayNet>=0?'var(--ok)':'var(--er)', monthNet>=0?'var(--ok)':'var(--er)')
      // Margin row
      + '<div style="display:flex;justify-content:flex-end;gap:16px;margin-top:6px">'
      + '<div style="text-align:right"><div style="font-size:9px;color:var(--t3);margin-bottom:1px">TODAY MARGIN</div>'
      + '<div style="font-size:11px;font-weight:700;color:'+(todayNet>=0?'var(--ok)':'var(--er)')+'">'+(todayRev>0?((todayNet/todayRev)*100).toFixed(1):'0.0')+'%</div></div>'
      + '<div style="text-align:right"><div style="font-size:9px;color:var(--t3);margin-bottom:1px">MONTH MARGIN</div>'
      + '<div style="font-size:11px;font-weight:700;color:'+(monthNet>=0?'var(--ok)':'var(--er)')+'">'+monthNetM+'%</div></div>'
      + '</div>'
      + '</div>' : '';

    // ── AREA 5: Recent Sales ──────────────────────────────────────────────
    function timeAgo(dateStr) {
      if (!dateStr) return '';
      var diffMin = Math.floor((now - new Date(dateStr)) / 60000);
      if (diffMin < 1)  return 'Just now';
      if (diffMin < 60) return diffMin+' min ago';
      var diffHr = Math.floor(diffMin/60);
      if (diffHr < 24)  return diffHr+' hr ago';
      if (diffHr < 48)  return 'Yesterday';
      return Math.floor(diffHr/24)+' days ago';
    }

    var recentRows = sales.slice(0,10).map(function(sale){
      var items     = (sale.items||[]).map(function(i){ return i.name; }).join(', ');
      if (items.length>40) items=items.slice(0,38)+'…';
      var bc = sale.status==='Paid'?'var(--ok)':sale.status==='Partial'?'var(--wa)':'var(--er)';
      return '<div class="list-item" onclick="Sales.viewInvoice(\''+sale.id+'\') ">'
        + '<div class="list-icon" style="background:var(--gb3);font-size:18px">🧾</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(sale.customer||'Walk-in')+'</div>'
        + '<div class="list-meta" style="font-family:var(--fm)">'+sale.id+'</div>'
        + (items?'<div class="list-meta" style="font-size:10px;color:var(--t3)">'+Utils.esc(items)+'</div>':'')
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val" style="font-size:14px">'+showMoney(sale.total)+'</div>'
        + '<div style="margin-top:3px"><span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+bc+'18;border:1px solid '+bc+'40;color:'+bc+'">'+(sale.status||'PAID').toUpperCase()+'</span></div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'+timeAgo(sale.date)+'</div>'
        + '</div></div>';
    }).join('');

    var recentHtml = '<div class="sec">'
      + '<div class="sec-title">Recent Sales <span class="sec-link" onclick="Router.go(\'sales\')">View All →</span></div>'
      + (sales.length>0 ? '<div class="card">'+recentRows+'</div>'
        : '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No sales yet</div><div class="empty-sub">Tap "New Sale" to get started</div></div>')
      + '</div>';

    // ── AREA 6: Low Stock Alerts ──────────────────────────────────────────
    var alertsHtml = '';
    var allAlerts = s.outStock.concat(s.lowStock);
    if (allAlerts.length > 0) {
      var alertRows = allAlerts.slice(0,6).map(function(p){
        var isOut  = p.qty===0, isCrit = p.qty<=1;
        var label  = isOut?'OUT':isCrit?'CRITICAL':'LOW';
        var lColor = isOut||isCrit?'var(--er)':'var(--wa)';
        var lBg    = isOut||isCrit?'var(--erb)':'var(--wab)';
        var pct    = Math.min(100,Math.max(2,Math.round((p.qty/Math.max(p.lowLevel||5,1))*100)));
        return '<div class="list-item" onclick="Router.go(\'products\')">'
          + '<div class="list-icon" style="background:'+lBg+'">'+(isOut?'🚫':isCrit?'🔴':'⚠️')+'</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(p.name)+'</div>'
          + '<div class="list-meta">Qty: <strong>'+p.qty+'</strong> · Min: '+(p.lowLevel||5)+'</div>'
          + '<div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:'+pct+'%;background:'+lColor+'"></div></div></div>'
          + '</div>'
          + '<div class="list-right"><span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+lBg+';border:1px solid '+lColor+'40;color:'+lColor+'">'+label+'</span></div>'
          + '</div>';
      }).join('');
      alertsHtml = '<div class="sec">'
        + '<div class="sec-title">⚠️ Low Stock Alert <span style="background:var(--er);color:#fff;font-size:9px;font-weight:800;padding:1px 7px;border-radius:99px;margin-left:4px">'+allAlerts.length+'</span>'
        + '<span class="sec-link" onclick="Router.go(\'products\')">View All</span></div>'
        + '<div class="card">'+alertRows+'</div>'
        + '<div style="padding:10px 14px 0"><button class="btn-ghost" style="width:100%;font-size:12px" onclick="Router.go(\'products\')">📋 View All Stock</button></div>'
        + '</div>';
    }

    // ── AREA 7: Top Selling Products Today ───────────────────────────────
    var prodMap = {};
    todaySales.forEach(function(sale){
      (sale.items||[]).forEach(function(item){
        if (!prodMap[item.name]) prodMap[item.name]={qty:0,rev:0};
        prodMap[item.name].qty += parseInt(item.qty)||1;
        prodMap[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var topProds = Object.keys(prodMap).map(function(n){ return {name:n,qty:prodMap[n].qty,rev:prodMap[n].rev}; })
      .sort(function(a,b){ return b.qty-a.qty; }).slice(0,5);

    var topProdsHtml = '<div class="sec">'
      + '<div class="sec-title">🏆 Top Products Today</div>'
      + (topProds.length>0 ? '<div class="card card-body">'
          + topProds.map(function(p,i){
              var medals=['🥇','🥈','🥉','4️⃣','5️⃣'];
              return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bd)">'
                + '<span style="font-size:16px;flex-shrink:0">'+(medals[i]||'·')+'</span>'
                + '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+Utils.esc(p.name)+'</div>'
                + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+p.qty+' units sold</div></div>'
                + '<div style="text-align:right;flex-shrink:0"><div style="font-size:13px;font-weight:700;color:var(--g)">'+showMoney(p.rev)+'</div></div>'
                + '</div>';
            }).join('')
          + '</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon" style="font-size:28px">📦</div><div class="empty-title" style="font-size:13px">No sales recorded today yet</div></div>')
      + '</div>';

    // ── AREA 8: Supplier Payments Due ────────────────────────────────────
    var suppHtml = '';
    if (canSeeMoney) {
      var suppWithDebt = suppliers.filter(function(sup){ return (parseFloat(sup.balance)||0)>0; });
      var sevenDays = new Date(now); sevenDays.setDate(sevenDays.getDate()+7);
      var sevenStr  = sevenDays.toISOString().slice(0,10);
      if (suppWithDebt.length>0) {
        var suppRows = suppWithDebt.slice(0,5).map(function(sup){
          var bal=parseFloat(sup.balance)||0, due=sup.dueDate||'';
          var st,sc,sb;
          if (due&&due<today)        {st='OVERDUE'; sc='var(--er)';sb='var(--erb)';}
          else if (due&&due<=sevenStr){st='DUE SOON';sc='var(--wa)';sb='var(--wab)';}
          else                        {st='PENDING'; sc='var(--in)';sb='var(--inb)';}
          return '<div class="list-item">'
            +'<div class="list-icon" style="background:var(--wab)">🏭</div>'
            +'<div class="list-info"><div class="list-name">'+Utils.esc(sup.name)+'</div>'
            +'<div class="list-meta">'+(due?'Due: '+Utils.date(due):'No due date')+'</div></div>'
            +'<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(bal,cur)+'</div>'
            +'<div style="margin-top:3px"><span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+sb+';border:1px solid '+sc+'40;color:'+sc+'">'+st+'</span></div>'
            +'</div></div>';
        }).join('');
        suppHtml = '<div class="sec"><div class="sec-title">🏭 Supplier Payments Due <span class="sec-link" onclick="Router.go(\'suppliers\')">View All →</span></div>'
          + '<div class="card">'+suppRows+'</div></div>';
      } else {
        suppHtml = '<div class="sec"><div class="sec-title">🏭 Supplier Payments</div>'
          + '<div style="padding:12px 14px;background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r10);text-align:center;font-size:13px;font-weight:600;color:var(--ok)">✓ All suppliers paid</div></div>';
      }
    }

    // ── AREA 9: Quick Actions ─────────────────────────────────────────────
    var qaHtml = '<div class="sec"><div class="sec-title">Quick Actions</div>'
      + '<div class="qa-grid" style="grid-template-columns:repeat(3,1fr)">'
      + '<div class="qa-btn" onclick="Sales.openNewSale()"><div class="qa-icon" style="background:var(--okb)">💵</div><div class="qa-label">New Sale</div></div>'
      + '<div class="qa-btn" onclick="Products.openAddModal()"><div class="qa-icon" style="background:var(--gb)">📦</div><div class="qa-label">Add Stock</div></div>'
      + '<div class="qa-btn" onclick="Expenses.openAddModal()"><div class="qa-icon" style="background:var(--erb)">💸</div><div class="qa-label">Add Expense</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'suppliers\')"><div class="qa-icon" style="background:var(--wab)">🚛</div><div class="qa-label">Suppliers</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'reports\')"><div class="qa-icon" style="background:var(--inb)">📊</div><div class="qa-label">Reports</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'ai\')"><div class="qa-icon" style="background:var(--gb)">🤖</div><div class="qa-label">AI Assistant</div></div>'
      + '</div></div>';

    // ── AREA 10: Daily Summary Strip ──────────────────────────────────────
    var stripHtml = '<div style="margin:0 14px 14px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r12);padding:13px 14px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px;font-family:var(--fm)">Daily Summary</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
      + '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:3px">Gross Sales</div><div style="font-size:13px;font-weight:800;color:var(--g)">'+showMoney(todayRev)+'</div></div>'
      + '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:3px">Expenses</div><div style="font-size:13px;font-weight:800;color:var(--er)">'+showMoney(todayManExp+todayAlloc)+'</div></div>'
      + '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:3px">Net Profit</div><div style="font-size:13px;font-weight:800;color:'+(todayNet>=0?'var(--g)':'var(--er)')+'">'+showMoney(todayNet)+'</div></div>'
      + '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:3px">Transactions</div><div style="font-size:13px;font-weight:800;color:var(--in)">'+todaySales.length+'</div></div>'
      + '</div>'
      + (canSeeMoney?'<button class="btn-ghost" style="width:100%;font-size:12px" onclick="Dashboard.printDailyReport()">🖨 Print Daily Report</button>':'')
      + '</div>';

    // ── ASSEMBLE ──────────────────────────────────────────────────────────
    pg.innerHTML = '<div style="padding-top:6px">'
      + greetHtml
      + heroHtml
      + statCards
      + detailHtml
      + recentHtml
      + alertsHtml
      + topProdsHtml
      + suppHtml
      + qaHtml
      + weekChart()
      + stripHtml
      + '</div>';

    Dashboard.animateCountUp();
  },

  // ── Count-up animation ────────────────────────────────────────────────────
  animateCountUp: function() {
    var els = document.querySelectorAll('.kpi-value');
    els.forEach(function(el) {
      var text = el.textContent.trim();
      var match = text.match(/[\d,\.]+/);
      if (!match) return;
      var target = parseFloat(match[0].replace(/,/g,''));
      if (isNaN(target)||target===0) return;
      var prefix = text.slice(0, text.indexOf(match[0]));
      var suffix = text.slice(text.indexOf(match[0])+match[0].length);
      var startTime = null;
      function step(ts) {
        if (!startTime) startTime=ts;
        var p = Math.min((ts-startTime)/900, 1);
        var ease = 1-Math.pow(1-p,3);
        var cur = target*ease;
        var fmt = target>=1000
          ? cur.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})
          : (target%1!==0?cur.toFixed(2):Math.round(cur).toString());
        el.textContent = prefix+fmt+suffix;
        if (p<1) requestAnimationFrame(step); else el.textContent=text;
      }
      requestAnimationFrame(step);
    });
  },

  // ── Print Daily Report ────────────────────────────────────────────────────
  printDailyReport: function() {
    Reports.dailyDate = Utils.today();
    Reports.view = 'daily';
    Router.go('reports');
  },
};

// Week chart helper
function weekChart() {
  var sales = DB.getSales();
  var cur   = DB.getSettings().currency || '$';
  return '<div class="sec"><div class="chart-wrap">'
    + '<div class="chart-title">This Week\'s Revenue</div>'
    + '<div class="chart-sub">'+cur+' daily breakdown</div>'
    + Charts.weekBars(sales)
    + '</div></div>';
}
