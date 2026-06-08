// ── EXPENSE ALLOCATIONS MODULE ─────────────────────────────────────────────
// Daily amount = Total Amount ÷ Days between Start Date and End Date
// If no end date is set, uses 30 days as the default span

var Allocations = {

  // ── RENDER LIST PAGE ───────────────────────────────────────────────────────
  render: function() {
    Router.go('expenses');
    var pg = Utils.get('pg-expenses');
    if (!pg) return;
    var cur    = DB.getSettings().currency || '$';
    var allocs = DB.getAllocations();
    var today  = Utils.today();
    var daily  = DB.getAllocatedDaily();
    var dayTot = daily.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);

    var rows = allocs.length ? allocs.map(function(a) {
      var active   = a.startDate <= today && (!a.endDate || a.endDate >= today);
      var statusBg = active ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)';
      var statusCl = active ? 'var(--ok)' : 'var(--er)';
      var statusTx = active ? 'Active' : (a.startDate > today ? 'Not Started' : 'Ended');

      // Build the date span label
      var spanDays = Allocations._calcDays(a.startDate, a.endDate);
      var spanLabel = Utils.cur(a.amount, cur) + ' over ' + spanDays + ' day' + (spanDays !== 1 ? 's' : '')
        + ' = ' + Utils.cur(a.daily, cur) + '/day';

      return '<div style="display:flex;align-items:center;gap:11px;padding:13px 14px;border-bottom:1px solid var(--bd)">'
        + '<div style="width:42px;height:42px;border-radius:var(--r10);background:rgba(245,158,11,.12);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">📅</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1)">'+Utils.esc(a.name)+'</div>'
        + '<div style="font-size:11px;color:var(--wa);margin-top:2px;font-family:var(--fm)">'+spanLabel+'</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'
        + 'From: '+Utils.date(a.startDate)+(a.endDate?' · Until: '+Utils.date(a.endDate):' · Ongoing (no end date)')
        + '</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:15px;font-weight:800;color:var(--wa)">'+Utils.cur(a.amount,cur)+'</div>'
        + '<div style="font-size:9px;color:var(--t3);font-family:var(--fm)">'+Utils.esc(a.category||'')+'</div>'
        + '<div style="margin-top:4px;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;background:'+statusBg+';color:'+statusCl+'">'+statusTx+'</div>'
        + '<div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end">'
        + '<button class="btn-ghost btn-sm btn-icon" onclick="Allocations.openEdit(\''+a.id+'\')">✏️</button>'
        + '<button class="btn-danger btn-sm btn-icon" onclick="Allocations.del(\''+a.id+'\',\''+Utils.esc(a.name)+'\')">🗑</button>'
        + '</div></div></div>';
    }).join('')
    : '<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">No allocations yet</div>'
      + '<div class="empty-sub">Add a cost with a start and end date — the daily amount is calculated automatically.</div></div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Expense Allocations</div>'
      + '<div class="page-sub">'+allocs.length+' allocation'+( allocs.length!==1?'s':'')+' · '+Utils.cur(dayTot,cur)+'/day active</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Allocations.openAdd()">+ Add</button></div>'
      + '</div>'
      + '<div class="sec">'
      + '<div class="kpi-grid" style="grid-template-columns:1fr 1fr">'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)">'
      + '<div class="kpi-icon">📅</div><div class="kpi-label">Daily Total</div>'
      + '<div class="kpi-value">'+Utils.cur(dayTot,cur)+'</div>'
      + '<div class="kpi-sub">Deducted each day</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)">'
      + '<div class="kpi-icon">📊</div><div class="kpi-label">Active Now</div>'
      + '<div class="kpi-value">'+daily.length+'</div>'
      + '<div class="kpi-sub">of '+allocs.length+' total</div></div>'
      + '</div>'
      + '<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.18);border-radius:var(--r12);padding:12px 14px;margin-bottom:14px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--wa);margin-bottom:4px">ℹ️ How it works</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.65">'
      + 'Enter the total cost, a start date, and an end date. The system divides the total by the number of days to get the daily rate. '
      + 'That amount is automatically deducted from your net profit each day the allocation is active.'
      + '</div></div>'
      + '<div class="sec-title">All Allocations</div>'
      + '<div class="card">'+rows+'</div>'
      + '</div>'
      + '<div class="sec" style="padding-bottom:8px">'
      + '<button class="btn-ghost" style="width:100%" onclick="Expenses.render()">← Back to Expenses</button>'
      + '</div>';
  },

  // ── FORM ───────────────────────────────────────────────────────────────────
  openAdd:  function() { this._openForm(null); },
  openEdit: function(id) {
    var a = DB.getAllocations().find(function(x){ return x.id===id; });
    if (a) this._openForm(a);
  },

  _openForm: function(existing) {
    var isEdit = !!existing;
    var a      = existing || {};

    Modal.open({
      title:    isEdit ? 'Edit Allocation' : 'Add Allocation',
      sub:      'Cost is divided across the date range automatically',
      barColor: 'var(--wa)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Expense Name *</label>'
          + '<input class="fi" id="al-name" value="'+Utils.esc(a.name||'')+'" placeholder="e.g. Shop Rent"></div>'
          + '<div class="fg"><label class="fl">Category</label>'
          + '<select class="fi" id="al-cat">'
          + ['Rent','Salary','Insurance','Utilities','Fuel','Transport','Other'].map(function(c){
              return '<option'+(a.category===c?' selected':'')+'>'+c+'</option>';
            }).join('')
          + '</select></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Total Amount *</label>'
          + '<input class="fi" id="al-amt" type="number" step="0.01" min="0"'
          + ' value="'+(a.amount||'')+'" placeholder="e.g. 600.00"'
          + ' oninput="Allocations.previewDaily()" style="font-size:18px;font-weight:700"></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Start Date *</label>'
          + '<input class="fi" id="al-start" type="date" value="'+(a.startDate||Utils.today())+'"'
          + ' oninput="Allocations.previewDaily()"></div>'
          + '<div class="fg"><label class="fl">End Date</label>'
          + '<input class="fi" id="al-end" type="date" value="'+(a.endDate||'')+'"'
          + ' placeholder="Leave blank = 30 days" oninput="Allocations.previewDaily()"></div>'
          + '</div>'
          // Live preview box
          + '<div id="al-preview" style="'
          + 'background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);'
          + 'border-radius:var(--r10);padding:13px 14px;min-height:44px;'
          + 'font-size:13px;color:var(--wa);font-weight:600;line-height:1.6'
          + '">Enter amount and dates to see the daily rate</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + (isEdit ? '' : '<button class="btn-ghost" onclick="Allocations.save(\'new\')" style="color:var(--wa);border-color:rgba(245,158,11,.3)">💾 Save &amp; Add New</button>')
            + '<button class="btn-primary" style="flex:1;background:linear-gradient(135deg,var(--wa),#b45309);color:#fff"'
            + ' onclick="Allocations.save(\'close\''+(isEdit?',\''+a.id+'\'':'')+')">💾 Save</button>',
    });
    setTimeout(function(){ Allocations.previewDaily(); }, 60);
  },

  // ── LIVE PREVIEW ───────────────────────────────────────────────────────────
  previewDaily: function() {
    var el  = Utils.get('al-preview'); if (!el) return;
    var amt = parseFloat((Utils.get('al-amt')||{value:'0'}).value||0);
    var cur = DB.getSettings().currency || '$';
    if (!amt) { el.textContent = 'Enter amount and dates to see the daily rate'; return; }

    var start = (Utils.get('al-start')||{value:''}).value;
    var end   = (Utils.get('al-end')||{value:''}).value;
    var days  = Allocations._calcDays(start, end);
    var daily = amt / days;

    el.innerHTML = '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">'
      + '<span>'+Utils.cur(amt,cur)+' ÷ '+days+' day'+(days!==1?'s':'')+'</span>'
      + '<span style="font-size:16px;color:var(--g);font-weight:800">= '+Utils.cur(daily,cur)+' / day</span>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px;font-weight:400">'
      + (end ? 'From '+start+' to '+end : 'No end date — using 30 days as default span')
      + '</div>';
  },

  // ── HELPERS ────────────────────────────────────────────────────────────────
  // Days between start and end. Falls back to 30 if no end date.
  _calcDays: function(start, end) {
    if (!start) return 30;
    if (!end)   return 30; // no end date = 30 day default
    var s = new Date(start);
    var e = new Date(end);
    var diff = Math.round((e - s) / 86400000); // ms per day
    return diff > 0 ? diff : 1; // at least 1 day
  },

  _calcDailyFromDates: function(amount, start, end) {
    var days = Allocations._calcDays(start, end);
    return amount / days;
  },

  // ── SAVE ───────────────────────────────────────────────────────────────────
  save: function(action, editId) {
    var name  = Utils.val('al-name').trim();
    var amt   = parseFloat(Utils.val('al-amt')||0);
    var start = Utils.val('al-start') || Utils.today();
    var end   = Utils.val('al-end')   || '';
    var cat   = (Utils.get('al-cat')||{value:'Other'}).value;

    if (!name) { Toast.show('Name is required','err');   return; }
    if (!amt)  { Toast.show('Amount is required','err'); return; }
    if (!start){ Toast.show('Start date is required','err'); return; }
    if (end && end <= start) { Toast.show('End date must be after start date','err'); return; }

    var days  = Allocations._calcDays(start, end);
    var daily = amt / days;
    var cur   = DB.getSettings().currency || '$';
    var spanLabel = Utils.cur(amt,cur)+' over '+days+' day'+(days!==1?'s':'')+' = '+Utils.cur(daily,cur)+'/day';

    var data = {
      name:        name,
      amount:      amt,
      daily:       daily,
      days:        days,
      periodLabel: spanLabel,
      category:    cat,
      startDate:   start,
      endDate:     end || null,
    };

    if (editId) {
      DB.updateAllocation(editId, data);
      Toast.show('Allocation updated ✓', 'ok');
      Modal.close();
      Allocations.render();
    } else {
      DB.addAllocation(data);
      Toast.show('Allocation saved ✓', 'ok');
      if (action === 'new') {
        // Reset form for next entry
        var amtEl   = Utils.get('al-amt');   if(amtEl)   amtEl.value   = '';
        var endEl   = Utils.get('al-end');   if(endEl)   endEl.value   = '';
        var nameEl  = Utils.get('al-name');  if(nameEl)  nameEl.value  = '';
        var startEl = Utils.get('al-start'); if(startEl) startEl.value = Utils.today();
        Allocations.previewDaily();
        Toast.show('Ready for next allocation', 'ok');
      } else {
        Modal.close();
        Allocations.render();
      }
    }
  },

  // ── DELETE ─────────────────────────────────────────────────────────────────
  del: function(id, name) {
    confirmDel('Remove "'+name+'" allocation?', function(){
      DB.deleteAllocation(id);
      Toast.show('Allocation removed', 'warn');
      Allocations.render();
    });
  },
};
