// ── EXPENSE ALLOCATIONS MODULE ─────────────────────────────────────────────
// Manages recurring expense allocations
// Data lives in DB under allocations array

var Allocations = {

  // Navigate to the allocations page (uses pg-expenses, replaces content)
  render: function() {
    Router.go('expenses');  // ensure page is active
    var pg = Utils.get('pg-expenses');
    if (!pg) return;
    var cur    = DB.getSettings().currency || '$';
    var allocs = DB.getAllocations();
    var today  = Utils.today();

    var rows = allocs.length ? allocs.map(function(a) {
      var active   = (!a.endDate || a.endDate >= today) && a.startDate <= today;
      var statusBg = active ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)';
      var statusCl = active ? 'var(--ok)' : 'var(--er)';
      var statusTx = active ? 'Active' : 'Inactive';
      return '<div style="display:flex;align-items:center;gap:11px;padding:13px 14px;border-bottom:1px solid var(--bd)">'
        + '<div style="width:42px;height:42px;border-radius:var(--r10);background:rgba(245,158,11,.12);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">📅</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1)">'+Utils.esc(a.name)+'</div>'
        + '<div style="font-size:11px;color:var(--t2);margin-top:2px;font-family:var(--fm)">'+Utils.esc(a.periodLabel)+' · '+Utils.cur(a.daily,cur)+'/day</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">From: '+Utils.date(a.startDate)+(a.endDate?' · Until: '+Utils.date(a.endDate):' · No end date')+'</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:15px;font-weight:800;color:var(--wa)">'+Utils.cur(a.amount,cur)+'</div>'
        + '<div style="font-size:9px;color:var(--t3);font-family:var(--fm)">'+Utils.esc(a.period)+'</div>'
        + '<div style="margin-top:4px;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;background:'+statusBg+';color:'+statusCl+'">'+statusTx+'</div>'
        + '<div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end">'
        + '<button class="btn-ghost btn-sm btn-icon" onclick="Allocations.openEdit(\''+a.id+'\')">✏️</button>'
        + '<button class="btn-danger btn-sm btn-icon" onclick="Allocations.del(\''+a.id+'\',\''+Utils.esc(a.name)+'\')">🗑</button>'
        + '</div></div></div>';
    }).join('') : '<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">No allocations yet</div><div class="empty-sub">Set up recurring costs like rent, salaries, and utilities to track your true daily profit.</div></div>';

    var daily  = DB.getAllocatedDaily();
    var dayTot = daily.reduce(function(a,x){ return a+x.daily; }, 0);
    var monTot = dayTot * 30;

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Expense Allocations</div>'
      + '<div class="page-sub">Automatic recurring costs · '+allocs.length+' set up</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Allocations.openAdd()">+ Add</button></div>'
      + '</div>'
      + '<div class="sec">'
      + '<div class="kpi-grid" style="grid-template-columns:1fr 1fr">'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">📅</div><div class="kpi-label">Daily Total</div><div class="kpi-value">'+Utils.cur(dayTot,cur)+'</div><div class="kpi-sub">Auto-deducted daily</div></div>'
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)"><div class="kpi-icon">📆</div><div class="kpi-label">Monthly Est.</div><div class="kpi-value">'+Utils.cur(monTot,cur)+'</div><div class="kpi-sub">×30 days</div></div>'
      + '</div>'
      + '<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.18);border-radius:var(--r12);padding:12px 14px;margin-bottom:14px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--wa);margin-bottom:4px">ℹ️ How allocations work</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.65">Set up your regular monthly or weekly costs once. The system divides them into a daily amount and automatically deducts them from your net profit every day — showing your TRUE profit after all costs.</div>'
      + '</div>'
      + '<div class="sec-title">Active Allocations</div>'
      + '<div class="card">'+rows+'</div>'
      + '</div>'
      + '<div class="sec" style="padding-bottom:8px">'
      + '<button class="btn-ghost" style="width:100%" onclick="Expenses.render()">← Back to Expenses</button>'
      + '</div>';
  },

  // ── OPEN ADD FORM ──────────────────────────────────────────────────────────
  openAdd: function() { this._openForm(null); },
  openEdit: function(id) {
    var a = DB.getAllocations().find(function(x){ return x.id===id; });
    if (a) this._openForm(a);
  },

  _openForm: function(existing) {
    var isEdit = !!existing;
    var a      = existing || {};
    Modal.open({
      title:    isEdit ? 'Edit Allocation' : 'Add Allocation',
      sub:      'Set up a recurring cost',
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
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Total Amount *</label>'
          + '<input class="fi" id="al-amt" type="number" step="0.01" value="'+(a.amount||'')+'" placeholder="0.00" oninput="Allocations.previewDaily()"></div>'
          + '<div class="fg"><label class="fl">Period *</label>'
          + '<select class="fi" id="al-period" onchange="Allocations.previewDaily()">'
          + ['Monthly','Weekly','Daily'].map(function(p){
              return '<option'+(a.period===p?' selected':'')+'>'+p+'</option>';
            }).join('')
          + '</select></div>'
          + '</div>'
          + '<div id="al-preview" style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--r8);padding:10px 12px;margin-bottom:14px;font-size:13px;color:var(--wa);font-weight:600;min-height:36px"></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Start Date *</label>'
          + '<input class="fi" id="al-start" type="date" value="'+(a.startDate||Utils.today())+'"></div>'
          + '<div class="fg"><label class="fl">End Date (optional)</label>'
          + '<input class="fi" id="al-end" type="date" value="'+(a.endDate||'')+'" placeholder="Leave blank = ongoing"></div>'
          + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + (isEdit ? '' : '<button class="btn-ghost" onclick="Allocations.save(\'new\')" style="color:var(--wa);border-color:rgba(245,158,11,.3)">💾 Save &amp; Add New</button>')
            + '<button class="btn-primary" style="flex:1;background:linear-gradient(135deg,var(--wa),#b45309);color:#fff" onclick="Allocations.save(\'close\','+(isEdit?'\''+a.id+'\'':'')+')">💾 Save</button>',
    });
    setTimeout(function(){ Allocations.previewDaily(); }, 50);
  },

  // ── LIVE PREVIEW ───────────────────────────────────────────────────────────
  previewDaily: function() {
    var amt    = parseFloat((Utils.get('al-amt')||{value:'0'}).value||0);
    var period = (Utils.get('al-period')||{value:'Monthly'}).value;
    var daily  = Allocations._calcDaily(amt, period);
    var cur    = DB.getSettings().currency||'$';
    var el     = Utils.get('al-preview');
    if (!el) return;
    if (!amt) { el.textContent = 'Enter amount to see daily rate'; return; }
    el.textContent = Utils.cur(amt,cur)+' '+period.toLowerCase()+' = '+Utils.cur(daily,cur)+' per day (÷'+(period==='Monthly'?'30':period==='Weekly'?'7':'1')+' days)';
  },

  _calcDaily: function(amount, period) {
    if (period === 'Monthly') return amount / 30;
    if (period === 'Weekly')  return amount / 7;
    return amount; // Daily
  },

  // ── SAVE ───────────────────────────────────────────────────────────────────
  save: function(action, editId) {
    var name   = Utils.val('al-name').trim();
    var amt    = parseFloat(Utils.val('al-amt')||0);
    var period = (Utils.get('al-period')||{value:'Monthly'}).value;
    var start  = Utils.val('al-start') || Utils.today();
    var end    = Utils.val('al-end')   || '';
    var cat    = (Utils.get('al-cat')||{value:'Other'}).value;

    if (!name) { Toast.show('Name is required','err');   return; }
    if (!amt)  { Toast.show('Amount is required','err'); return; }

    var daily = Allocations._calcDaily(amt, period);
    var divDays = period==='Monthly'?'30':period==='Weekly'?'7':'1';
    var periodLabel = Utils.cur(amt, DB.getSettings().currency||'$') + '/'+period.toLowerCase()+' (÷'+divDays+' days)';

    var data = { name:name, amount:amt, period:period, periodLabel:periodLabel,
                 daily:daily, category:cat, startDate:start, endDate:end||null };

    if (editId) {
      DB.updateAllocation(editId, data);
      Toast.show('Allocation updated ✓','ok');
    } else {
      DB.addAllocation(data);
      Toast.show('Allocation saved ✓','ok');
    }

    if (action === 'new') {
      // Clear form for next entry
      ['al-name','al-amt','al-end'].forEach(function(id){
        var el = Utils.get(id); if(el) el.value='';
      });
      var startEl = Utils.get('al-start'); if(startEl) startEl.value=Utils.today();
      Allocations.previewDaily();
      Toast.show('Ready for next allocation','ok');
    } else {
      Modal.close();
      Allocations.render();
    }
  },

  del: function(id, name) {
    confirmDel('Remove "'+name+'" allocation?', function(){
      DB.deleteAllocation(id);
      Toast.show('Allocation removed','warn');
      Allocations.render();
    });
  },
};
