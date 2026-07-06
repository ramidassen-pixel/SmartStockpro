/* === expenses.js === */
var Expenses = {

  // ── RENDER ─────────────────────────────────────────────────────────────────
  render: function() {
    var pg = Utils.get('pg-expenses');
    if (!pg) return;
    var list     = DB.getExpenses();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var month    = Utils.today().slice(0, 7);
    var thisMonth = list.filter(function(e){ return e.date && e.date.startsWith(month); });
    var total     = thisMonth.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // Category breakdown
    var cats = {};
    thisMonth.forEach(function(e){ cats[e.category]=(cats[e.category]||0)+(parseFloat(e.amount)||0); });

    // Allocated expenses
    var allocs     = DB.getAllocations();
    var allocToday = DB.getAllocatedDaily();
    var allocTotal = allocToday.reduce(function(a,x){ return a+x.daily; }, 0);

    // Regular expense rows
    var expRows = list.length ? list.map(function(e){
      return '<div class="list-item">'
        + '<div class="list-icon" style="background:var(--erb)">💸</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(e.description||e.category)+'</div>'
        + '<div class="list-meta">'+Utils.esc(e.category)+' · '+Utils.date(e.date)+(e.recurring?' · 🔄':'')+'</div>'
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val" style="color:var(--er)">'+Utils.cur(e.amount,cur)+'</div>'
        + '<div class="list-actions"><button class="btn-danger btn-sm btn-icon" onclick="Expenses.del(\''+e.id+'\')">🗑</button></div>'
        + '</div></div>';
    }).join('') : '<div class="empty" style="padding:20px"><div class="empty-icon">💸</div><div class="empty-title">No manual expenses yet</div></div>';

    // Allocated expense rows (amber/orange, read-only)
    var allocRows = allocToday.length ? allocToday.map(function(a){
      return '<div style="display:flex;align-items:center;gap:11px;padding:12px 14px;border-bottom:1px solid rgba(245,158,11,.12);cursor:pointer" onclick="Allocations.render()">'
        + '<div style="width:40px;height:40px;border-radius:var(--r10);background:rgba(245,158,11,.12);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">🔒</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:600;color:var(--t1)">'+Utils.esc(a.name)+'</div>'
        + '<div style="font-size:11px;color:var(--wa);margin-top:2px;font-family:var(--fm)">'+Utils.esc(a.periodLabel)+' · tap to edit in Allocations</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:16px;font-weight:800;color:var(--wa)">'+Utils.cur(a.daily,cur)+'/day</div>'
        + '<div style="font-size:9px;color:var(--t3);font-family:var(--fm);margin-top:2px">ALLOCATED</div>'
        + '</div></div>';
    }).join('') : '<div style="padding:14px;text-align:center;color:var(--t3);font-size:13px">No active allocations. <span style="color:var(--wa);cursor:pointer" onclick="Allocations.render()">Set up allocations →</span></div>';

    var catChartHtml = Object.keys(cats).length
      ? '<div class="chart-wrap"><div class="chart-title">By Category</div><div class="chart-sub">Monthly breakdown</div>'+Charts.bar(Object.values(cats), Object.keys(cats), 'ok')+'</div>'
      : '';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Expenses</div>'
      + '<div class="page-sub">'+thisMonth.length+' manual · '+Utils.cur(total,cur)+' this month</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Expenses.openAddModal()">+ Add</button></div>'
      + '</div>'
      + '<div class="sec">'
      + '<div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)"><div class="kpi-icon">💸</div><div class="kpi-label">Manual (Month)</div><div class="kpi-value">'+Utils.cur(total,cur)+'</div><div class="kpi-sub">'+thisMonth.length+' entries</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">📅</div><div class="kpi-label">Allocated (Daily)</div><div class="kpi-value">'+Utils.cur(allocTotal,cur)+'</div><div class="kpi-sub">'+allocToday.length+' active</div></div>'
      + '</div>'
      + catChartHtml
      + '<div class="sec-title">Manual Expenses <span class="sec-link" onclick="Expenses.openAddModal()">+ Add</span></div>'
      + '<div class="card">'+expRows+'</div>'
      + '</div>'
      // Allocated section
      + '<div class="sec">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<div style="font-size:12px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.1em">🔒 Allocated Expenses</div>'
      + '<span style="font-size:12px;font-weight:600;color:var(--wa);cursor:pointer" onclick="Allocations.render()">Manage →</span>'
      + '</div>'
      + '<div style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.2);border-radius:var(--r14);overflow:hidden">'
      + allocRows
      + (allocToday.length ? '<div style="padding:11px 14px;background:rgba(245,158,11,.08);border-top:1px solid rgba(245,158,11,.15);display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:12px;font-weight:700;color:var(--wa)">Total Allocated Today</span>'
        + '<span style="font-size:16px;font-weight:800;color:var(--wa);font-family:var(--fm)">'+Utils.cur(allocTotal,cur)+'</span>'
        + '</div>' : '')
      + '</div>'
      + '</div>';
  },

  // ── ADD EXPENSE ────────────────────────────────────────────────────────────
  openAddModal: function() {
    Modal.open({
      title: 'Add Expense', barColor: 'var(--er)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Category *</label>'
          + '<select class="fi" id="ef-cat"><option>Rent</option><option>Utilities</option><option>Salaries</option><option>Marketing</option><option>Maintenance</option><option>Transport</option><option>Insurance</option><option>Stock Purchase</option><option>Other</option></select></div>'
          + '<div class="fg"><label class="fl">Amount *</label>'
          + '<input class="fi" id="ef-amt" type="number" step="0.01" placeholder="0.00"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Description</label>'
          + '<input class="fi" id="ef-desc" placeholder="What was this for?"></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Date</label>'
          + '<input class="fi" id="ef-date" type="date" value="'+Utils.today()+'"></div>'
          + '<div class="fg"><label class="fl">Recurring?</label>'
          + '<select class="fi" id="ef-rec"><option value="0">No</option><option value="1">Yes — Monthly</option></select></div>'
          + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Expenses.save()">💾 Save</button>',
    });
  },

  save: function() {
    var amt = parseFloat(Utils.val('ef-amt')||0);
    if (!amt) { Toast.show('Amount is required','err'); return; }
    DB.addExpense({
      category: (Utils.get('ef-cat')||{value:'Other'}).value,
      description: Utils.val('ef-desc'),
      amount: amt,
      date: Utils.val('ef-date') || Utils.today(),
      recurring: !!parseInt(Utils.val('ef-rec')||'0'),
    });
    Toast.show('Expense saved ✓','ok');
    Modal.close();
    this.render();
  },

  del: function(id) {
    confirmDel('Delete this expense?', function(){
      DB.deleteExpense(id);
      Toast.show('Deleted','warn');
      Expenses.render();
    });
  },
};
