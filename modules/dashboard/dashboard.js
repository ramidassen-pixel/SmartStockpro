/* === dashboard.js === */
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
    var dow       = now.getDay(); // 0=Sun

    // ── Role visibility ───────────────────────────────────────────────────
    var canSeeMoney = (role==='owner'||role==='admin'||role==='primary_admin'||role==='primary admin'||role==='manager'||role==='store_manager'||role==='accountant');
    var mask = '— — —';
    function showMoney(val) { return canSeeMoney ? Utils.cur(val, cur) : mask; }

    // ── Read toggles from settings ────────────────────────────────────────
    // allocEnabled: default ON  (false only when explicitly set false)
    // cogsEnabled:  default ON
    var allocEnabled = settings.allocEnabled !== false;
    var cogsEnabled  = settings.cogsEnabled  !== false;

    // ── TODAY calculations ─────────────────────────────────────────────────
    var allExpenses  = DB.getExpenses();
    var allPayroll   = DB.getPayroll();

    var todaySales   = sales.filter(function(s){ return s.date === today; });
    var todayRev     = todaySales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var todayManExp  = allExpenses.filter(function(e){ return e.date===today; })
                        .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // COGS today — only if cogsEnabled
    var rawTodayCOGS = todaySales.reduce(function(a,s){
      return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0);
    }, 0);
    var todayCOGS = cogsEnabled ? rawTodayCOGS : 0;

    // Allocated today — Mon–Sat only, only if allocEnabled
    var rawAllocDay = s.allocatedDaily || 0;
    var todayAlloc  = (allocEnabled && dow !== 0) ? rawAllocDay : 0;

    // Gross Profit today = Sales − COGS
    var todayGross = todayRev - todayCOGS;
    // Net Profit today = Gross − ManExp − Alloc
    var todayNet   = todayGross - todayManExp - todayAlloc;

    // ── THIS MONTH calculations ────────────────────────────────────────────
    var monthSales   = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
    var monthRev     = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var rawMonthCOGS = monthSales.reduce(function(a,s){
      return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0);
    }, 0);
    var monthCOGS    = cogsEnabled ? rawMonthCOGS : 0;
    var monthManExp  = allExpenses.filter(function(e){ return e.date && e.date.startsWith(month); })
                        .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // Working days Mon–Sat so far this month
    var workDays = 0;
    var d = new Date(now.getFullYear(), now.getMonth(), 1);
    while (d <= now) { if (d.getDay() !== 0) workDays++; d.setDate(d.getDate()+1); }
    var monthAlloc = (allocEnabled) ? rawAllocDay * workDays : 0;

    var monthGross = monthRev - monthCOGS;
    var monthNet   = monthGross - monthManExp - monthAlloc;
    var monthGrossMargin = monthRev > 0 ? ((monthGross/monthRev)*100).toFixed(1) : '0.0';
    var monthNetMargin   = monthRev > 0 ? ((monthNet/monthRev)*100).toFixed(1)   : '0.0';
    var todayGrossMargin = todayRev  > 0 ? ((todayGross/todayRev)*100).toFixed(1) : '0.0';
    var todayNetMargin   = todayRev  > 0 ? ((todayNet/todayRev)*100).toFixed(1)   : '0.0';

    // ── Yesterday comparison ──────────────────────────────────────────────
    var yest      = new Date(now); yest.setDate(yest.getDate()-1);
    var yestStr   = yest.toISOString().slice(0,10);
    var yestDow   = yest.getDay();
    var yestSales = sales.filter(function(s){ return s.date===yestStr; });
    var yestRev   = yestSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
    var yestCOGS  = cogsEnabled ? yestSales.reduce(function(a,s){
      return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0);
    }, 0) : 0;
    var yestManExp = allExpenses.filter(function(e){ return e.date===yestStr; })
                      .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
    var yestAlloc  = (allocEnabled && yestDow !== 0) ? rawAllocDay : 0;
    var yestNet    = (yestRev-yestCOGS) - yestManExp - yestAlloc;
    var netDiff    = todayNet - yestNet;

    var compHtml = '';
    if (canSeeMoney) {
      if      (Math.abs(netDiff) < 0.01) compHtml = '<span style="color:var(--t3);font-size:12px;font-weight:600">→ Same as yesterday</span>';
      else if (netDiff > 0)              compHtml = '<span style="color:var(--ok);font-size:12px;font-weight:700">↑ '+Utils.cur(netDiff,cur)+' more than yesterday</span>';
      else                               compHtml = '<span style="color:var(--er);font-size:12px;font-weight:700">↓ '+Utils.cur(Math.abs(netDiff),cur)+' less than yesterday</span>';
    }

    // ── Outstanding debt ──────────────────────────────────────────────────
    var debtSales = sales.filter(function(s){ return s.status!=='Paid'; });
    var totalDebt = debtSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    // ── Low stock ─────────────────────────────────────────────────────────
    var lowStockCount = s.lowStock.length + s.outStock.length;
    var lowPulse = lowStockCount > 0
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--er);margin-left:6px;animation:pulse 1.5s ease-in-out infinite"></span>'
      : '';

    // ════════════════════════════════════════════════════════════════════
    // AREA 1 — GREETING
    // ════════════════════════════════════════════════════════════════════
    var greet       = hour<12?'Good Morning':hour<17?'Good Afternoon':'Good Evening';
    var displayName = user.name ? user.name.split(' ')[0] : (user.username||'Ramie');
    var fullDate    = now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

    var greetHtml = '<div style="background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(201,168,76,.02));border:1px solid rgba(201,168,76,.15);border-radius:var(--r16);padding:18px 16px;margin:0 14px 14px">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'
      + '<div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);letter-spacing:-.02em">'+greet+', '+Utils.esc(displayName)+' 👋</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:4px">'+fullDate+'</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px">SmartStock Store · Monrovia, Liberia</div>'
      + '</div>'
      + '<div style="font-size:32px;flex-shrink:0">'+(hour<12?'🌅':hour<17?'☀️':'🌙')+'</div>'
      + '</div></div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 2 — HERO: TODAY'S NET PROFIT
    // ════════════════════════════════════════════════════════════════════
    var heroColor = todayNet>=0?'var(--ok)':'var(--er)';
    var heroBg    = todayNet>=0?'rgba(16,185,129,.06)':'rgba(239,68,68,.06)';
    var heroBd    = todayNet>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)';

    var heroHtml = '<div style="background:'+heroBg+';border:1px solid '+heroBd+';border-radius:var(--r16);padding:18px 16px;margin:0 14px 10px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.14em;margin-bottom:10px;font-family:var(--fm)">Today\'s Net Profit</div>'
      + '<div style="font-size:36px;font-weight:900;color:'+heroColor+';letter-spacing:-.03em;line-height:1;margin-bottom:10px">'+(canSeeMoney?Utils.cur(todayNet,cur):mask)+'</div>'
      + (compHtml?'<div style="margin-bottom:8px">'+compHtml+'</div>':'')
      + '</div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 3 — 4 STAT CARDS  (with toggles on COGS and Allocated)
    // ════════════════════════════════════════════════════════════════════

    // Helper: small inline toggle switch
    function miniToggle(fnName, isOn) {
      var bg  = isOn ? 'var(--ok)' : 'var(--bd2)';
      var lft = isOn ? '14px'      : '2px';
      return '<div onclick="Dashboard.'+fnName+'()" style="display:flex;align-items:center;cursor:pointer;padding:2px">'
        + '<div style="width:28px;height:16px;border-radius:8px;background:'+bg+';position:relative;transition:background .2s;flex-shrink:0">'
        + '<div style="width:12px;height:12px;border-radius:50%;background:#fff;position:absolute;top:2px;left:'+lft+';transition:left .2s;box-shadow:0 1px 2px rgba(0,0,0,.3)"></div>'
        + '</div></div>';
    }

    var todayNetC  = todayNet>=0?'var(--ok)':'var(--er)';
    var todayNetBg = todayNet>=0?'var(--okb)':'var(--erb)';

    var statCards = '<div class="kpi-grid" style="grid-template-columns:1fr 1fr;gap:10px;padding:0 14px;margin-bottom:10px">'

      // Card 1 — Today Sales (gold)
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">'
      + '<div class="kpi-icon">💰</div>'
      + '<div class="kpi-label">Today Sales</div>'
      + '<div class="kpi-value">'+showMoney(todayRev)+'</div>'
      + '<div class="kpi-sub">'+todaySales.length+' transaction'+(todaySales.length!==1?'s':'')+'</div></div>'

      // Card 2 — Today Manual Expenses (red)
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)">'
      + '<div class="kpi-icon">💸</div>'
      + '<div class="kpi-label">Today Expenses</div>'
      + '<div class="kpi-value">'+showMoney(todayManExp)+'</div>'
      + '<div class="kpi-sub">Manual expenses</div></div>'

      // Card 3 — COGS with toggle (amber)
      + '<div class="kpi" style="--kc:var(--wa);--kibg:'+(cogsEnabled?'var(--wab)':'var(--bg3)')+';opacity:'+(cogsEnabled?'1':'.65')+'">'
      + '<div class="kpi-icon">🏷️</div>'
      + '<div class="kpi-label" style="display:flex;align-items:center;justify-content:space-between">'
      + 'COGS'
      + miniToggle('toggleCOGS', cogsEnabled)
      + '</div>'
      + '<div class="kpi-value" style="color:'+(cogsEnabled?'var(--wa)':'var(--t3)')+'">'+showMoney(todayCOGS)+'</div>'
      + '<div class="kpi-sub">'+(cogsEnabled?'Cost of goods · ON':'Paused · OFF')+'</div></div>'

      // Card 4 — Allocated with toggle (amber/grey)
      + '<div class="kpi" style="--kc:var(--wa);--kibg:'+(allocEnabled?'var(--wab)':'var(--bg3)')+';opacity:'+(allocEnabled?'1':'.65')+'">'
      + '<div class="kpi-icon">📅</div>'
      + '<div class="kpi-label" style="display:flex;align-items:center;justify-content:space-between">'
      + 'Allocated'
      + miniToggle('toggleAlloc', allocEnabled)
      + '</div>'
      + '<div class="kpi-value" style="color:'+(allocEnabled?'var(--wa)':'var(--t3)')+'">'+showMoney(todayAlloc)+'</div>'
      + '<div class="kpi-sub">'+(allocEnabled?(dow===0?'Sunday — $0':'$'+rawAllocDay.toFixed(2)+'/day · ON'):'Paused · OFF')+'</div></div>'

      + '</div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 4 — DETAIL BREAKDOWN CARD (always visible)
    // ════════════════════════════════════════════════════════════════════

    // Row builder helpers
    function dRow(label, todayVal, monthVal, tc, mc, subLabel) {
      return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:'+(subLabel?'flex-start':'center')+';padding:8px 0;border-bottom:1px solid var(--bd)">'
        + '<div><div style="font-size:12px;color:var(--t2)">'+label+'</div>'+(subLabel?'<div style="font-size:10px;color:var(--t3);margin-top:2px">'+subLabel+'</div>':'')+'</div>'
        + '<span style="font-size:13px;font-weight:700;color:'+tc+';font-family:var(--fm);text-align:right;white-space:nowrap">'+todayVal+'</span>'
        + '<span style="font-size:13px;font-weight:700;color:'+mc+';font-family:var(--fm);text-align:right;white-space:nowrap;min-width:82px">'+monthVal+'</span>'
        + '</div>';
    }
    function dBigRow(label, todayVal, monthVal, tc, mc) {
      return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;padding:10px 0;border-top:2px solid var(--bd2);margin-top:3px">'
        + '<span style="font-size:13px;font-weight:800;color:var(--t1)">'+label+'</span>'
        + '<span style="font-size:16px;font-weight:900;color:'+tc+';font-family:var(--fm);text-align:right;white-space:nowrap">'+todayVal+'</span>'
        + '<span style="font-size:16px;font-weight:900;color:'+mc+';font-family:var(--fm);text-align:right;white-space:nowrap;min-width:82px">'+monthVal+'</span>'
        + '</div>';
    }

    var allocSubLabel = !allocEnabled
      ? 'Toggle is OFF — not counted'
      : (dow===0
          ? 'Sunday — not charged today'
          : 'Mon–Sat · '+Utils.cur(rawAllocDay,cur)+'/day ×'+workDays+' days');

    var cogsSubLabel = !cogsEnabled ? 'Toggle is OFF — not counted' : '';

    var tGrossC  = todayGross>=0?'var(--ok)':'var(--er)';
    var mGrossC  = monthGross>=0?'var(--ok)':'var(--er)';
    var tNetC    = todayNet>=0?'var(--ok)':'var(--er)';
    var mNetC    = monthNet>=0?'var(--ok)':'var(--er)';

    var detailHtml = canSeeMoney ? ''
      + '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r14);padding:14px 14px 10px;margin:0 14px 14px">'

      // Header: title + column labels
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--bd)">'
      + '<div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em">Breakdown</div>'
      + '<div style="display:flex;gap:0">'
      + '<div style="font-size:9px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.08em;text-align:right;min-width:72px">TODAY</div>'
      + '<div style="font-size:9px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.08em;text-align:right;min-width:82px">THIS MONTH</div>'
      + '</div>'
      + '</div>'

      // Gross Sales row
      + dRow('Gross Sales', showMoney(todayRev), showMoney(monthRev), 'var(--g)', 'var(--g)')

      // COGS row — dims when OFF
      + dRow(
          'Cost of Goods (COGS)',
          cogsEnabled ? showMoney(todayCOGS) : '<span style="color:var(--t3);font-style:italic">OFF</span>',
          cogsEnabled ? showMoney(monthCOGS) : '<span style="color:var(--t3);font-style:italic">OFF</span>',
          'var(--wa)', 'var(--wa)',
          cogsSubLabel
        )

      // Gross Profit bold row
      + dBigRow('GROSS PROFIT', showMoney(todayGross), showMoney(monthGross), tGrossC, mGrossC)

      // Manual Expenses
      + dRow('Manual Expenses', showMoney(todayManExp), showMoney(monthManExp), 'var(--er)', 'var(--er)')

      // Allocated Expenses — dims when OFF
      + dRow(
          'Allocated Expenses',
          allocEnabled ? showMoney(todayAlloc) : '<span style="color:var(--t3);font-style:italic">OFF</span>',
          allocEnabled ? showMoney(monthAlloc) : '<span style="color:var(--t3);font-style:italic">OFF</span>',
          'var(--wa)', 'var(--wa)',
          allocSubLabel
        )

      // NET PROFIT bold row
      + dBigRow('NET PROFIT', showMoney(todayNet), showMoney(monthNet), tNetC, mNetC)

      // Margin row
      + '<div style="display:flex;justify-content:flex-end;gap:18px;margin-top:8px;padding-top:6px;border-top:1px solid var(--bd)">'
      + '<div style="text-align:right">'
      + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Today Margin</div>'
      + '<div style="font-size:12px;font-weight:800;color:'+tNetC+'">'+todayNetMargin+'%</div>'
      + '</div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Month Margin</div>'
      + '<div style="font-size:12px;font-weight:800;color:'+mNetC+'">'+monthNetMargin+'%</div>'
      + '</div>'
      + '</div>'

      + '</div>' : '';

    // ════════════════════════════════════════════════════════════════════
    // AREA 5 — RECENT SALES
    // ════════════════════════════════════════════════════════════════════
    function timeAgo(dateStr) {
      if (!dateStr) return '';
      var diff = Math.floor((now - new Date(dateStr)) / 60000);
      if (diff < 1)   return 'Just now';
      if (diff < 60)  return diff+' min ago';
      var h = Math.floor(diff/60);
      if (h < 24)     return h+' hr ago';
      if (h < 48)     return 'Yesterday';
      return Math.floor(h/24)+' days ago';
    }

    var recentRows = sales.slice(0,10).map(function(sale) {
      var items = (sale.items||[]).map(function(i){ return i.name; }).join(', ');
      if (items.length>40) items=items.slice(0,38)+'…';
      var bc = sale.status==='Paid'?'var(--ok)':sale.status==='Partial'?'var(--wa)':'var(--er)';
      return '<div class="list-item" onclick="Sales.viewInvoice(\''+sale.id+'\')">'
        + '<div class="list-icon" style="background:var(--gb3);font-size:18px">🧾</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(sale.customer||'Walk-in')+'</div>'
        + '<div class="list-meta" style="font-family:var(--fm)">'+sale.id+'</div>'
        + (items?'<div class="list-meta" style="font-size:10px;color:var(--t3)">'+Utils.esc(items)+'</div>':'')
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val" style="font-size:14px">'+showMoney(sale.total)+'</div>'
        + '<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+bc+'18;border:1px solid '+bc+'40;color:'+bc+'">'+(sale.status||'PAID').toUpperCase()+'</span>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'+timeAgo(sale.date)+'</div>'
        + '</div></div>';
    }).join('');

    var recentHtml = '<div class="sec">'
      + '<div class="sec-title">Recent Sales <span class="sec-link" onclick="Router.go(\'sales\')">View All →</span></div>'
      + (sales.length>0 ? '<div class="card">'+recentRows+'</div>'
        : '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No sales yet</div><div class="empty-sub">Tap "+ New Sale" to get started</div></div>')
      + '</div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 6 — LOW STOCK ALERTS
    // ════════════════════════════════════════════════════════════════════
    var alertsHtml = '';
    var allAlerts = s.outStock.concat(s.lowStock);
    if (allAlerts.length > 0) {
      var alertRows = allAlerts.slice(0,6).map(function(p) {
        var isOut  = p.qty===0, isCrit = p.qty<=1;
        var label  = isOut?'OUT':isCrit?'CRITICAL':'LOW';
        var lc = isOut||isCrit?'var(--er)':'var(--wa)';
        var lb = isOut||isCrit?'var(--erb)':'var(--wab)';
        var pct = Math.min(100,Math.max(2,Math.round((p.qty/Math.max(p.lowLevel||5,1))*100)));
        return '<div class="list-item" onclick="Router.go(\'products\')">'
          + '<div class="list-icon" style="background:'+lb+'">'+(isOut?'🚫':isCrit?'🔴':'⚠️')+'</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(p.name)+'</div>'
          + '<div class="list-meta">Qty: <strong>'+p.qty+'</strong> · Min: '+(p.lowLevel||5)+'</div>'
          + '<div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:'+pct+'%;background:'+lc+'"></div></div></div>'
          + '</div>'
          + '<div class="list-right"><span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+lb+';border:1px solid '+lc+'40;color:'+lc+'">'+label+'</span></div>'
          + '</div>';
      }).join('');
      alertsHtml = '<div class="sec">'
        + '<div class="sec-title">⚠️ Low Stock Alert '
        + '<span style="background:var(--er);color:#fff;font-size:9px;font-weight:800;padding:1px 7px;border-radius:99px;margin-left:4px">'+allAlerts.length+'</span>'
        + '<span class="sec-link" onclick="Router.go(\'products\')">View All</span></div>'
        + '<div class="card">'+alertRows+'</div>'
        + '<div style="padding:10px 14px 0"><button class="btn-ghost" style="width:100%;font-size:12px" onclick="Router.go(\'products\')">📋 View All Stock</button></div>'
        + '</div>';
    }

    // ════════════════════════════════════════════════════════════════════
    // AREA 7 — TOP PRODUCTS TODAY
    // ════════════════════════════════════════════════════════════════════
    var prodMap = {};
    todaySales.forEach(function(sale) {
      (sale.items||[]).forEach(function(item) {
        if (!prodMap[item.name]) prodMap[item.name]={qty:0,rev:0};
        prodMap[item.name].qty += parseInt(item.qty)||1;
        prodMap[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var topProds = Object.keys(prodMap).map(function(n){ return {name:n,qty:prodMap[n].qty,rev:prodMap[n].rev}; })
      .sort(function(a,b){ return b.qty-a.qty; }).slice(0,5);

    var topProdsHtml = '<div class="sec"><div class="sec-title">🏆 Top Products Today</div>'
      + (topProds.length>0 ? '<div class="card card-body">'
          + topProds.map(function(p,i) {
              var medals=['🥇','🥈','🥉','4️⃣','5️⃣'];
              return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bd)">'
                + '<span style="font-size:16px;flex-shrink:0">'+(medals[i]||'·')+'</span>'
                + '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+Utils.esc(p.name)+'</div>'
                + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+p.qty+' units sold</div></div>'
                + '<div style="text-align:right;flex-shrink:0"><div style="font-size:13px;font-weight:700;color:var(--g)">'+showMoney(p.rev)+'</div></div>'
                + '</div>';
            }).join('')+'</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon" style="font-size:28px">📦</div><div class="empty-title" style="font-size:13px">No sales today yet</div></div>')
      + '</div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 8 — SUPPLIER PAYMENTS
    // ════════════════════════════════════════════════════════════════════
    var suppHtml = '';
    if (canSeeMoney) {
      var suppDebt = suppliers.filter(function(sup){ return (parseFloat(sup.balance)||0)>0; });
      var sevenStr = new Date(now.getTime()+7*86400000).toISOString().slice(0,10);
      if (suppDebt.length>0) {
        var suppRows = suppDebt.slice(0,5).map(function(sup) {
          var bal=parseFloat(sup.balance)||0, due=sup.dueDate||'';
          var st,sc,sb;
          if (due&&due<today)         {st='OVERDUE'; sc='var(--er)';sb='var(--erb)';}
          else if (due&&due<=sevenStr){st='DUE SOON';sc='var(--wa)';sb='var(--wab)';}
          else                        {st='PENDING'; sc='var(--in)';sb='var(--inb)';}
          return '<div class="list-item">'
            +'<div class="list-icon" style="background:var(--wab)">🏭</div>'
            +'<div class="list-info"><div class="list-name">'+Utils.esc(sup.name)+'</div>'
            +'<div class="list-meta">'+(due?'Due: '+Utils.date(due):'No due date')+'</div></div>'
            +'<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(bal,cur)+'</div>'
            +'<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+sb+';border:1px solid '+sc+'40;color:'+sc+'">'+st+'</span>'
            +'</div></div>';
        }).join('');
        suppHtml = '<div class="sec"><div class="sec-title">🏭 Supplier Payments Due <span class="sec-link" onclick="Router.go(\'suppliers\')">View All →</span></div>'
          + '<div class="card">'+suppRows+'</div></div>';
      } else {
        suppHtml = '<div class="sec"><div class="sec-title">🏭 Supplier Payments</div>'
          + '<div style="padding:12px 14px;background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r10);text-align:center;font-size:13px;font-weight:600;color:var(--ok)">✓ All suppliers paid</div></div>';
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // AREA 9 — QUICK ACTIONS
    // ════════════════════════════════════════════════════════════════════
    var qaHtml = '<div class="sec"><div class="sec-title">Quick Actions</div>'
      + '<div class="qa-grid" style="grid-template-columns:repeat(3,1fr)">'
      + '<div class="qa-btn" onclick="Sales.openNewSale()"><div class="qa-icon" style="background:var(--okb)">💵</div><div class="qa-label">New Sale</div></div>'
      + '<div class="qa-btn" onclick="Products.openAddModal()"><div class="qa-icon" style="background:var(--gb)">📦</div><div class="qa-label">Add Stock</div></div>'
      + '<div class="qa-btn" onclick="Expenses.openAddModal()"><div class="qa-icon" style="background:var(--erb)">💸</div><div class="qa-label">Add Expense</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'suppliers\')"><div class="qa-icon" style="background:var(--wab)">🚛</div><div class="qa-label">Suppliers</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'reports\')"><div class="qa-icon" style="background:var(--inb)">📊</div><div class="qa-label">Reports</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'ai\')"><div class="qa-icon" style="background:var(--gb)">🤖</div><div class="qa-label">AI Assistant</div></div>'
      + '</div></div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 10 — DAILY SUMMARY STRIP
    // ════════════════════════════════════════════════════════════════════
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

  // ── TOGGLE: Allocated Expenses ON / OFF ───────────────────────────────────
  toggleAlloc: function() {
    var on = DB.getSettings().allocEnabled !== false;
    DB.saveSettings({ allocEnabled: !on });
    Toast.show(!on ? '📅 Allocated expenses ON' : '📅 Allocated expenses OFF', !on ? 'ok' : 'warn');
    Dashboard.render();
  },

  // ── TOGGLE: Cost of Goods (COGS) ON / OFF ────────────────────────────────
  toggleCOGS: function() {
    var on = DB.getSettings().cogsEnabled !== false;
    DB.saveSettings({ cogsEnabled: !on });
    Toast.show(!on ? '🏷️ COGS ON — deducted from profit' : '🏷️ COGS OFF — not counted', !on ? 'ok' : 'warn');
    Dashboard.render();
  },

  // ── COUNT-UP ANIMATION ────────────────────────────────────────────────────
  animateCountUp: function() {
    var els = document.querySelectorAll('.kpi-value');
    els.forEach(function(el) {
      var text = el.textContent.trim();
      var match = text.match(/[\d,\.]+/);
      if (!match) return;
      var target = parseFloat(match[0].replace(/,/g,''));
      if (isNaN(target)||target===0) return;
      var prefix = text.slice(0,text.indexOf(match[0]));
      var suffix = text.slice(text.indexOf(match[0])+match[0].length);
      var st = null;
      function step(ts) {
        if (!st) st=ts;
        var p = Math.min((ts-st)/900,1);
        var e = 1-Math.pow(1-p,3);
        var v = target*e;
        var f = target>=1000 ? v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}) : (target%1!==0?v.toFixed(2):Math.round(v).toString());
        el.textContent = prefix+f+suffix;
        if (p<1) requestAnimationFrame(step); else el.textContent=text;
      }
      requestAnimationFrame(step);
    });
  },

  // ── PRINT DAILY REPORT ────────────────────────────────────────────────────
  printDailyReport: function() {
    Reports.dailyDate = Utils.today();
    Reports.view = 'daily';
    Router.go('reports');
  },
};

// ── ANALYTICS SECTION (real data charts) ─────────────────────────────────
function analyticsSection() {
  var allSales    = DB.getSales();
  var allExpenses = DB.getExpenses();
  var cur         = DB.getSettings().currency || '$';

  // ── 7-day revenue bars
  var weekHtml = Charts.weekBars(allSales, cur);

  // ── Revenue vs Expenses (6 months)
  var revExpHtml = Charts.revenueVsExpenses(allSales, allExpenses, cur);

  // ── Top 5 products
  var topProdHtml = Charts.topProducts(allSales, cur);

  // ── Quick summary numbers for charts
  var today = Utils.today();
  var month = today.slice(0,7);
  var weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
  var weekAgoStr = weekAgo.toISOString().slice(0,10);

  var weekTotal = allSales.filter(function(s){ return s.date >= weekAgoStr; })
                          .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
  var monthTotal= allSales.filter(function(s){ return s.date&&s.date.startsWith(month); })
                          .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);

  // Last week for comparison
  var lastWeekStart = new Date(); lastWeekStart.setDate(lastWeekStart.getDate()-14);
  var lastWeekEnd   = new Date(); lastWeekEnd.setDate(lastWeekEnd.getDate()-7);
  var lastWeekStartStr = lastWeekStart.toISOString().slice(0,10);
  var lastWeekEndStr   = lastWeekEnd.toISOString().slice(0,10);
  var lastWeekTotal = allSales.filter(function(s){ return s.date>=lastWeekStartStr && s.date<lastWeekEndStr; })
                              .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
  var weekChange = lastWeekTotal > 0 ? Math.round(((weekTotal-lastWeekTotal)/lastWeekTotal)*100) : 0;
  var weekTrend  = weekChange >= 0
    ? '<span style="color:var(--ok);font-size:11px;font-weight:700">▲ '+weekChange+'%</span>'
    : '<span style="color:var(--er);font-size:11px;font-weight:700">▼ '+Math.abs(weekChange)+'%</span>';

  return '<div class="sec">'
    // ── WEEK REVENUE CHART ──────────────────────────────────────────────
    + '<div class="card card-body" style="margin-bottom:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
    + '<div><div class="chart-title">📈 This Week Revenue</div>'
    + '<div class="chart-sub">'+cur+' daily breakdown · 7-day total: <strong>'+Utils.cur(weekTotal,cur)+'</strong></div>'
    + '</div>'
    + weekTrend
    + '</div>'
    + weekHtml
    + '</div>'

    // ── REVENUE vs EXPENSES ─────────────────────────────────────────────
    + '<div class="card card-body" style="margin-bottom:12px">'
    + '<div style="margin-bottom:12px"><div class="chart-title">📊 Revenue vs Expenses</div>'
    + '<div class="chart-sub">Last 6 months comparison</div>'
    + '</div>'
    + revExpHtml
    + '</div>'

    // ── TOP PRODUCTS ────────────────────────────────────────────────────
    + '<div class="card card-body">'
    + '<div style="margin-bottom:14px"><div class="chart-title">🏆 Top Products</div>'
    + '<div class="chart-sub">By revenue — all time</div>'
    + '</div>'
    + topProdHtml
    + '</div>'
    + '</div>';
}

// Keep old weekChart for compatibility
function weekChart() { return analyticsSection(); }
