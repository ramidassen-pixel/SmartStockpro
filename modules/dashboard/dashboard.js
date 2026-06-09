var Dashboard = {

  render: function() {
    var pg = Utils.get('pg-dashboard');
    if (!pg) return;

    var s        = DB.stats();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var user     = Auth.currentUser || {};
    var role     = (user.role || 'owner').toLowerCase();
    var sales    = DB.getSales();
    var products = DB.getProducts().filter(function(p){ return p.status !== 'inactive'; });
    var suppliers = DB.getSuppliers();
    var today    = Utils.today();
    var month    = today.slice(0, 7);
    var now      = new Date();
    var hour     = now.getHours();

    // ── Role-based visibility ──────────────────────────────────────────────
    var canSeeMoney  = (role==='owner'||role==='admin'||role==='primary admin'||role==='manager');
    var canSeeProfit = canSeeMoney;
    var mask = '— — —';
    function showMoney(val) { return canSeeMoney ? Utils.cur(val, cur) : mask; }

    // ── Greeting ──────────────────────────────────────────────────────────
    var greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    var displayName = user.name ? user.name.split(' ')[0] : (user.username || 'Ramie');
    var fullDate = now.toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'});

    // ── Today's data ──────────────────────────────────────────────────────
    var todaySales  = sales.filter(function(s){ return s.date === today; });
    var todayRev    = todaySales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var monthSales  = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
    var monthRev    = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var todayManExp = DB.getExpenses().filter(function(e){ return e.date===today; })
                        .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var todayAlloc  = s.allocatedDaily || 0;
    var todayNet    = todayRev - todayManExp - todayAlloc;

    // Yesterday comparison
    var yest       = new Date(now); yest.setDate(yest.getDate()-1);
    var yesterdayStr = yest.toISOString().slice(0,10);
    var yesterdaySales = sales.filter(function(s){ return s.date === yesterdayStr; });
    var yesterdayRev   = yesterdaySales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var yesterdayExp   = DB.getExpenses().filter(function(e){ return e.date===yesterdayStr; })
                           .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var yesterdayNet   = yesterdayRev - yesterdayExp - todayAlloc;
    var netDiff        = todayNet - yesterdayNet;
    var compHtml = '';
    if (canSeeProfit) {
      if (Math.abs(netDiff) < 0.01) {
        compHtml = '<span style="color:var(--t3);font-size:12px;font-weight:600">→ Same as yesterday</span>';
      } else if (netDiff > 0) {
        compHtml = '<span style="color:var(--ok);font-size:12px;font-weight:700">↑ ' + Utils.cur(netDiff,cur) + ' more than yesterday</span>';
      } else {
        compHtml = '<span style="color:var(--er);font-size:12px;font-weight:700">↓ ' + Utils.cur(Math.abs(netDiff),cur) + ' less than yesterday</span>';
      }
    }

    // Outstanding customer debt
    var debtSales    = sales.filter(function(s){ return s.status !== 'Paid'; });
    var totalDebt    = debtSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);
    var debtCusts    = new Set(debtSales.map(function(s){ return s.customerId||s.customer; })).size;

    // ── AREA 1: Greeting Header ────────────────────────────────────────────
    var greetHtml = '<div style="background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(201,168,76,.02));border:1px solid rgba(201,168,76,.15);border-radius:var(--r16);padding:18px 16px;margin:0 14px 14px">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'
      + '<div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);letter-spacing:-.02em">' + greet + ', ' + Utils.esc(displayName) + ' 👋</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:4px">' + fullDate + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px">SmartStock Store · Monrovia, Liberia</div>'
      + '</div>'
      + '<div style="font-size:32px;flex-shrink:0">' + (hour<12?'🌅':hour<17?'☀️':'🌙') + '</div>'
      + '</div>'
      + '</div>';

    // ── AREA 2: Hero Net Profit Card ───────────────────────────────────────
    var heroColor = todayNet >= 0 ? 'var(--ok)' : 'var(--er)';
    var heroBg    = todayNet >= 0 ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)';
    var heroBd    = todayNet >= 0 ? 'rgba(16,185,129,.2)'  : 'rgba(239,68,68,.2)';

    var heroHtml = '<div style="background:' + heroBg + ';border:1px solid ' + heroBd + ';border-radius:var(--r16);padding:18px 16px;margin:0 14px 14px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.14em;margin-bottom:10px;font-family:var(--fm)">Today\'s Net Profit</div>'
      + '<div style="font-size:36px;font-weight:900;color:' + heroColor + ';letter-spacing:-.03em;line-height:1;margin-bottom:10px">'
      + (canSeeProfit ? Utils.cur(todayNet, cur) : mask) + '</div>'
      + (compHtml ? '<div style="margin-bottom:14px">' + compHtml + '</div>' : '')
      + (canSeeProfit ? '<div style="border-top:1px solid ' + heroBd + ';padding-top:12px;display:flex;flex-direction:column;gap:5px">'
        + '<div style="display:flex;justify-content:space-between;font-size:13px">'
        + '<span style="color:var(--t2)">Gross Sales</span>'
        + '<span style="color:var(--ok);font-weight:700">' + Utils.cur(todayRev,cur) + '</span></div>'
        + (todayManExp > 0 ? '<div style="display:flex;justify-content:space-between;font-size:13px">'
          + '<span style="color:var(--t2)">Manual Expenses</span>'
          + '<span style="color:var(--er);font-weight:700">-' + Utils.cur(todayManExp,cur) + '</span></div>' : '')
        + (todayAlloc > 0 ? '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:3px 7px;margin:2px -7px;border-radius:8px;cursor:pointer;transition:background .15s" onclick="Allocations.render()" title="Tap to manage allocations">'
          + '<span style="color:var(--wa);display:flex;align-items:center;gap:5px">📅 Allocated Expenses <span style="font-size:10px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);border-radius:4px;padding:1px 5px;color:var(--wa)">tap to manage</span></span>'
          + '<span style="color:var(--wa);font-weight:700">-' + Utils.cur(todayAlloc,cur) + '/day</span></div>' : '')
        + '<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;padding-top:6px;border-top:1px solid ' + heroBd + ';margin-top:3px">'
        + '<span style="color:var(--t1)">Net Profit</span>'
        + '<span style="color:' + heroColor + '">' + Utils.cur(todayNet,cur) + '</span></div>'
        + '</div>' : '')
      + '</div>';

    // ── AREA 3: 4 Stat Cards ───────────────────────────────────────────────
    var lowStockCount = s.lowStock.length + s.outStock.length;
    var lowPulse = lowStockCount > 0
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--er);margin-left:6px;animation:pulse 1.5s ease-in-out infinite"></span>'
      : '';

    // ── Cash & Profit Calculations for Hero Cards ──────────────────────────
    var _allS   = DB.getSales();
    var _allE   = DB.getExpenses();
    var _allPay = DB.getPayroll();
    var _totSal = _allS.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
    var _totCog = _allS.reduce(function(a,s){ return a+(_s=s,(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0)); },0);
    var _gross  = _totSal - _totCog;
    var _manE   = _allE.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
    var _net    = _gross - _manE - (s.allocatedDaily||0);
    var _cashIn = _allS.filter(function(x){ return x.status==='Paid'; }).reduce(function(a,x){ return a+(parseFloat(x.total)||0); },0)
                + _allS.filter(function(x){ return x.status==='Partial'; }).reduce(function(a,x){ return a+(parseFloat(x.amountPaid)||0); },0);
    var _cashOut= _manE + _allPay.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); },0);
    var _cash   = _cashIn - _cashOut;

    var grossC  = _gross>=0 ? 'var(--ok)' : 'var(--er)';
    var grossBg = _gross>=0 ? 'var(--okb)' : 'var(--erb)';
    var netC    = _net>=0   ? 'var(--ok)' : 'var(--er)';
    var netBg   = _net>=0   ? 'var(--okb)' : 'var(--erb)';

    var statCards = '<div class="kpi-grid" style="grid-template-columns:1fr 1fr;gap:10px;padding:0 14px;margin-bottom:14px">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">'
      + '<div class="kpi-icon">💰</div><div class="kpi-label">Total Sales</div>'
      + '<div class="kpi-value" style="font-size:20px">' + showMoney(_totSal) + '</div>'
      + '<div class="kpi-sub">' + _allS.length + ' invoices</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab);cursor:pointer" onclick="Allocations.render()">'
      + '<div class="kpi-icon">📅</div><div class="kpi-label">Allocated Expenses</div>'
      + '<div class="kpi-value" style="font-size:20px">' + showMoney(todayAlloc) + '</div>'
      + '<div class="kpi-sub">' + (todayAlloc > 0 ? Utils.cur(todayAlloc,cur) + '/day · tap to manage' : 'None set · tap to add') + '</div></div>'
      + '<div class="kpi" style="--kc:' + grossC + ';--kibg:' + grossBg + '">'
      + '<div class="kpi-icon">📈</div><div class="kpi-label">Gross Profit</div>'
      + '<div class="kpi-value" style="font-size:20px">' + showMoney(_gross) + '</div>'
      + '<div class="kpi-sub">Sales minus COGS</div></div>'
      + '<div class="kpi" style="--kc:' + netC + ';--kibg:' + netBg + '">'
      + '<div class="kpi-icon">' + (_net>=0?'✅':'📉') + '</div><div class="kpi-label">Net Profit</div>'
      + '<div class="kpi-value" style="font-size:20px">' + showMoney(_net) + '</div>'
      + '<div class="kpi-sub">After all expenses</div></div>'
      + '</div>';

    // ── AREA 4: Recent Sales (last 10) ────────────────────────────────────
    function timeAgo(dateStr) {
      if (!dateStr) return '';
      var d = new Date(dateStr);
      var diffMs = now - d;
      var diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1)  return 'Just now';
      if (diffMin < 60) return diffMin + ' min ago';
      var diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24)  return diffHr + ' hr ago';
      if (diffHr < 48)  return 'Yesterday';
      return Math.floor(diffHr/24) + ' days ago';
    }

    var recentRows = sales.slice(0, 10).map(function(sale) {
      var itemNames = (sale.items||[]).map(function(i){ return i.name; }).join(', ');
      if (itemNames.length > 40) itemNames = itemNames.slice(0,38) + '…';
      var badgeColor = sale.status==='Paid'?'var(--ok)':sale.status==='Partial'?'var(--wa)':'var(--er)';
      return '<div class="list-item" onclick="Sales.viewInvoice(\'' + sale.id + '\')">'
        + '<div class="list-icon" style="background:var(--gb3);font-size:18px">🧾</div>'
        + '<div class="list-info">'
        + '<div class="list-name">' + Utils.esc(sale.customer||'Walk-in') + '</div>'
        + '<div class="list-meta" style="font-family:var(--fm)">' + sale.id + '</div>'
        + (itemNames ? '<div class="list-meta" style="font-size:10px;color:var(--t3)">' + Utils.esc(itemNames) + '</div>' : '')
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val" style="font-size:14px">' + showMoney(sale.total) + '</div>'
        + '<div style="margin-top:3px"><span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:' + badgeColor + '18;border:1px solid ' + badgeColor + '40;color:' + badgeColor + '">' + (sale.status||'PAID').toUpperCase() + '</span></div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">' + timeAgo(sale.date) + '</div>'
        + '</div></div>';
    }).join('');

    var recentHtml = '<div class="sec">'
      + '<div class="sec-title">Recent Sales <span class="sec-link" onclick="Router.go(\'sales\')">View All →</span></div>'
      + (sales.length > 0
        ? '<div class="card">' + recentRows + '</div>'
        : '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No sales yet</div><div class="empty-sub">Tap "New Sale" to get started</div></div>')
      + '</div>';

    // ── AREA 5: Low Stock Alerts ──────────────────────────────────────────
    var alertsHtml = '';
    var allAlerts = s.outStock.concat(s.lowStock);
    if (allAlerts.length > 0) {
      var alertRows = allAlerts.slice(0,6).map(function(p) {
        var isOut   = p.qty === 0;
        var isCrit  = p.qty <= 1;
        var label   = isOut ? 'OUT' : isCrit ? 'CRITICAL' : 'LOW';
        var lColor  = isOut||isCrit ? 'var(--er)' : 'var(--wa)';
        var lBg     = isOut||isCrit ? 'var(--erb)' : 'var(--wab)';
        var pct     = Math.min(100, Math.max(2, Math.round((p.qty / Math.max(p.lowLevel||5, 1)) * 100)));
        return '<div class="list-item" onclick="Router.go(\'products\')">'
          + '<div class="list-icon" style="background:' + lBg + '">' + (isOut?'🚫':isCrit?'🔴':'⚠️') + '</div>'
          + '<div class="list-info">'
          + '<div class="list-name">' + Utils.esc(p.name) + '</div>'
          + '<div class="list-meta">Qty: <strong>' + p.qty + '</strong> · Min: ' + (p.lowLevel||5) + '</div>'
          + '<div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:' + pct + '%;background:' + lColor + '"></div></div></div>'
          + '</div>'
          + '<div class="list-right">'
          + '<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:' + lBg + ';border:1px solid ' + lColor + '40;color:' + lColor + '">' + label + '</span>'
          + '</div></div>';
      }).join('');
      alertsHtml = '<div class="sec">'
        + '<div class="sec-title">'
        + '⚠️ Low Stock Alert '
        + '<span style="background:var(--er);color:#fff;font-size:9px;font-weight:800;padding:1px 7px;border-radius:99px;margin-left:4px">' + allAlerts.length + '</span>'
        + '<span class="sec-link" onclick="Router.go(\'products\')">View All</span></div>'
        + '<div class="card">' + alertRows + '</div>'
        + '<div style="padding:10px 14px 0">'
        + '<button class="btn-ghost" style="width:100%;font-size:12px" onclick="Router.go(\'products\')">📋 View All Stock</button>'
        + '</div>'
        + '</div>';
    }

    // ── AREA 6: Top Selling Products Today ────────────────────────────────
    var prodMap = {};
    todaySales.forEach(function(sale) {
      (sale.items||[]).forEach(function(item) {
        if (!prodMap[item.name]) prodMap[item.name] = { qty:0, rev:0 };
        prodMap[item.name].qty += parseInt(item.qty)||1;
        prodMap[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var topProds = Object.keys(prodMap).map(function(n){ return {name:n, qty:prodMap[n].qty, rev:prodMap[n].rev}; })
      .sort(function(a,b){ return b.qty-a.qty; }).slice(0,5);

    var topProdsHtml = '<div class="sec">'
      + '<div class="sec-title">🏆 Top Products Today</div>'
      + (topProds.length > 0 ? '<div class="card card-body">'
          + topProds.map(function(p,i) {
              var medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
              return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bd)">'
                + '<span style="font-size:16px;flex-shrink:0">' + (medals[i]||'·') + '</span>'
                + '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + Utils.esc(p.name) + '</div>'
                + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">' + p.qty + ' units sold</div></div>'
                + '<div style="text-align:right;flex-shrink:0"><div style="font-size:13px;font-weight:700;color:var(--g)">' + showMoney(p.rev) + '</div></div>'
                + '</div>';
            }).join('')
          + '</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon" style="font-size:28px">📦</div><div class="empty-title" style="font-size:13px">No sales recorded today yet</div></div>')
      + '</div>';

    // ── AREA 7: Supplier Payments Due ─────────────────────────────────────
    var suppHtml = '';
    if (canSeeMoney) {
      var suppWithDebt = suppliers.filter(function(s){ return (parseFloat(s.balance)||0) > 0; });
      var sevenDays = new Date(now); sevenDays.setDate(sevenDays.getDate()+7);
      var sevenStr  = sevenDays.toISOString().slice(0,10);

      if (suppWithDebt.length > 0) {
        var suppRows = suppWithDebt.slice(0,5).map(function(sup) {
          var bal = parseFloat(sup.balance)||0;
          var due = sup.dueDate || '';
          var st, sc, sb;
          if (due && due < today)         { st='OVERDUE';  sc='var(--er)'; sb='var(--erb)'; }
          else if (due && due <= sevenStr) { st='DUE SOON'; sc='var(--wa)'; sb='var(--wab)'; }
          else                             { st='PENDING';  sc='var(--in)'; sb='var(--inb)'; }
          return '<div class="list-item">'
            + '<div class="list-icon" style="background:var(--wab)">🏭</div>'
            + '<div class="list-info">'
            + '<div class="list-name">' + Utils.esc(sup.name) + '</div>'
            + '<div class="list-meta">' + (due ? 'Due: ' + Utils.date(due) : 'No due date') + '</div>'
            + '</div>'
            + '<div class="list-right">'
            + '<div class="list-val" style="color:var(--wa)">' + Utils.cur(bal,cur) + '</div>'
            + '<div style="margin-top:3px"><span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:' + sb + ';border:1px solid ' + sc + '40;color:' + sc + '">' + st + '</span></div>'
            + '</div></div>';
        }).join('');
        suppHtml = '<div class="sec">'
          + '<div class="sec-title">🏭 Supplier Payments Due <span class="sec-link" onclick="Router.go(\'suppliers\')">View All →</span></div>'
          + '<div class="card">' + suppRows + '</div></div>';
      } else {
        suppHtml = '<div class="sec">'
          + '<div class="sec-title">🏭 Supplier Payments</div>'
          + '<div style="padding:12px 14px;background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r10);text-align:center;font-size:13px;font-weight:600;color:var(--ok)">✓ All suppliers paid</div>'
          + '</div>';
      }
    }

    // ── AREA 8: Quick Actions ─────────────────────────────────────────────
    var qaHtml = '<div class="sec">'
      + '<div class="sec-title">Quick Actions</div>'
      + '<div class="qa-grid" style="grid-template-columns:repeat(3,1fr)">'
      + '<div class="qa-btn" onclick="Sales.openNewSale()"><div class="qa-icon" style="background:var(--okb)">💵</div><div class="qa-label">New Sale</div></div>'
      + '<div class="qa-btn" onclick="Products.openAddModal()"><div class="qa-icon" style="background:var(--gb)">📦</div><div class="qa-label">Add Stock</div></div>'
      + '<div class="qa-btn" onclick="Expenses.openAddModal()"><div class="qa-icon" style="background:var(--erb)">💸</div><div class="qa-label">Add Expense</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'suppliers\')"><div class="qa-icon" style="background:var(--wab)">🚛</div><div class="qa-label">Suppliers</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'reports\')"><div class="qa-icon" style="background:var(--inb)">📊</div><div class="qa-label">Reports</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'ai\')"><div class="qa-icon" style="background:var(--gb)">🤖</div><div class="qa-label">AI Assistant</div></div>'
      + '</div></div>';

    // ── AREA 9: Daily Summary Strip ────────────────────────────────────────
    var stripHtml = '<div style="margin:0 14px 14px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r12);padding:13px 14px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px;font-family:var(--fm)">Daily Summary</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
      + '<div style="text-align:center">'
      + '<div style="font-size:10px;color:var(--t3);margin-bottom:3px">Gross</div>'
      + '<div style="font-size:14px;font-weight:800;color:var(--ok)">' + showMoney(todayRev) + '</div></div>'
      + '<div style="text-align:center;cursor:pointer" onclick="Allocations.render()" title="Tap to manage allocations">'
      + '<div style="font-size:10px;color:var(--t3);margin-bottom:3px">Expenses 📅</div>'
      + '<div style="font-size:14px;font-weight:800;color:var(--er)">' + showMoney(todayManExp+todayAlloc) + '</div>'
      + '<div style="font-size:9px;color:var(--wa);margin-top:2px;font-weight:600">' + (todayAlloc>0?Utils.cur(todayAlloc,cur)+' alloc.':'no alloc') + '</div></div>'
      + '<div style="text-align:center">'
      + '<div style="font-size:10px;color:var(--t3);margin-bottom:3px">Net</div>'
      + '<div style="font-size:14px;font-weight:800;color:' + (todayNet>=0?'var(--g)':'var(--er)') + '">' + showMoney(todayNet) + '</div></div>'
      + '<div style="text-align:center">'
      + '<div style="font-size:10px;color:var(--t3);margin-bottom:3px">Sales</div>'
      + '<div style="font-size:14px;font-weight:800;color:var(--in)">' + todaySales.length + '</div></div>'
      + '</div>'
      + (canSeeMoney ? '<button class="btn-ghost" style="width:100%;font-size:12px" onclick="Dashboard.printDailyReport()">🖨 Print Daily Report</button>' : '')
      + '</div>';

    // ── ASSEMBLE PAGE ──────────────────────────────────────────────────────
    pg.innerHTML = '<div style="padding-top:6px">'
      + greetHtml
      + heroHtml
      + statCards
      + recentHtml
      + alertsHtml
      + topProdsHtml
      + suppHtml
      + qaHtml
      + weekChart()
      + stripHtml
      + '</div>';

    // Count-up animation on numbers
    Dashboard.animateCountUp();
  },

  // ── Week bar chart ────────────────────────────────────────────────────────
  // (defined as inline call to avoid variable capture issues)

  // ── Count-up animation ────────────────────────────────────────────────────
  animateCountUp: function() {
    var els = document.querySelectorAll('.kpi-value');
    els.forEach(function(el) {
      var text = el.textContent.trim();
      var match = text.match(/[\d,\.]+/);
      if (!match) return;
      var target = parseFloat(match[0].replace(/,/g,''));
      if (isNaN(target) || target === 0) return;
      var prefix = text.slice(0, text.indexOf(match[0]));
      var suffix = text.slice(text.indexOf(match[0]) + match[0].length);
      var start = 0;
      var duration = 900;
      var startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        var ease = 1 - Math.pow(1 - progress, 3);
        var current = start + (target - start) * ease;
        var formatted = target >= 1000
          ? current.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0})
          : (target % 1 !== 0 ? current.toFixed(2) : Math.round(current).toString());
        el.textContent = prefix + formatted + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = text;
      }
      requestAnimationFrame(step);
    });
  },

  // ── Print Daily Report ──────────────────────────────────────────────────
  printDailyReport: function() {
    // Open the daily report view in Reports module
    Reports.dailyDate = Utils.today();
    Reports.view = 'daily';
    Router.go('reports');
  },

};

// Weekly chart helper (called inline from render)
function weekChart() {
  var sales = DB.getSales();
  var cur   = DB.getSettings().currency || '$';
  return '<div class="sec"><div class="chart-wrap">'
    + '<div class="chart-title">This Week\'s Revenue</div>'
    + '<div class="chart-sub">' + cur + ' daily breakdown</div>'
    + Charts.weekBars(sales)
    + '</div></div>';
}
