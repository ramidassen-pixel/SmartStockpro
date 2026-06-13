/* SmartStock Pro V5 — Salary, Payroll & Credit Management */
var Salary = {
  activeTab: 'employees',

  render: function() {
    var pg = Utils.get('pg-salary');
    if (!pg) return;
    var emps     = DB.getEmployees();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var month    = Utils.today().slice(0,7);
    var payroll  = (DB.getPayroll()||[]).filter(function(p){ return p.month===month; });
    var active   = emps.filter(function(e){ return e.status==='active'; });
    var totalBudget = active.reduce(function(a,e){ return a+(parseFloat(e.salary)||0); },0);
    var totalPaid   = payroll.reduce(function(a,p){ return a+(parseFloat(p.netPay||p.amount)||0); },0);
    var allLoans    = DB.get('employeeLoans')||[];
    var totalCredit = allLoans.filter(function(l){ return l.status==='active'; })
                              .reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);

    var tabs = [
      ['employees','👥 Employees'],
      ['payroll',  '💰 Payroll'],
      ['credits',  '🏦 Credits & Loans'],
    ];

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Salary & Payroll</div>'
      + '<div class="page-sub">' + month + '</div></div>'
      + '<div class="page-actions">'
      + '<button class="btn-primary btn-sm" onclick="Salary.openAddEmployee()">＋ Employee</button>'
      + '</div></div>'

      + '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">👥</div><div class="kpi-label">Active Staff</div><div class="kpi-value">'+active.length+'</div><div class="kpi-sub">employees</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📋</div><div class="kpi-label">Monthly Budget</div><div class="kpi-value">'+Utils.cur(totalBudget,cur)+'</div><div class="kpi-sub">this month</div></div>'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">✅</div><div class="kpi-label">Paid Out</div><div class="kpi-value">'+Utils.cur(totalPaid,cur)+'</div><div class="kpi-sub">'+payroll.length+' paid</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">🏦</div><div class="kpi-label">Total Credit</div><div class="kpi-value">'+Utils.cur(totalCredit,cur)+'</div><div class="kpi-sub">outstanding</div></div>'
      + '</div></div>'

      + '<div class="chips">'
      + tabs.map(function(t){
          return '<div class="chip'+(Salary.activeTab===t[0]?' active':'')+'" onclick="Salary.setTab(\''+t[0]+'\')">'+t[1]+'</div>';
        }).join('')
      + '</div>'
      + '<div id="sal-body"></div>';

    Salary._renderTab();
  },

  setTab: function(t) { Salary.activeTab=t; Salary.render(); },

  _renderTab: function() {
    var el = Utils.get('sal-body'); if(!el) return;
    if      (Salary.activeTab==='employees') Salary._renderEmployees(el);
    else if (Salary.activeTab==='payroll')   Salary._renderPayroll(el);
    else if (Salary.activeTab==='credits')   Salary._renderCredits(el);
  },

  /* ══════════════════════════════════════════════════════
     EMPLOYEES
  ══════════════════════════════════════════════════════ */
  _renderEmployees: function(el) {
    var emps  = DB.getEmployees();
    var cur   = DB.getSettings().currency||'$';
    var loans = DB.get('employeeLoans')||[];

    if (!emps.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">👥</div>'
        + '<div class="empty-title">No employees yet</div>'
        + '<div class="empty-action"><button class="btn-primary btn-sm" onclick="Salary.openAddEmployee()">＋ Add Employee</button></div></div>';
      return;
    }

    el.innerHTML = '<div class="sec"><div class="card">'
      + emps.map(function(e){
          var empLoans = loans.filter(function(l){ return l.employeeId===e.id && l.status==='active'; });
          var loanBal  = empLoans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);
          var loanCount= empLoans.length;
          return '<div class="list-item">'
            + '<div class="list-icon" style="background:var(--inb);font-size:18px">👤</div>'
            + '<div class="list-info">'
            + '<div class="list-name">'+Utils.esc(e.name)
            + (e.status!=='active'?' <span style="font-size:9px;background:var(--erb);color:var(--er);padding:2px 6px;border-radius:99px">INACTIVE</span>':'')
            + '</div>'
            + '<div class="list-meta">'+Utils.esc(e.role||'Employee')+(e.phone?' · '+Utils.esc(e.phone):'')+'</div>'
            + (loanBal>0 ? '<div class="list-meta" style="color:var(--wa);font-size:11px">🏦 '+loanCount+' credit'+(loanCount!==1?'s':'')+' · Balance: '+Utils.cur(loanBal,cur)+'</div>' : '')
            + '</div>'
            + '<div class="list-right">'
            + '<div class="list-val">'+Utils.cur(e.salary||0,cur)+'</div>'
            + '<div style="font-size:10px;color:var(--t3)">/ month</div>'
            + '<div class="list-actions">'
            + '<button class="btn-ghost btn-sm btn-icon" onclick="Salary.openEditEmployee(\''+e.id+'\')">✏️</button>'
            + '<button class="btn-ghost btn-sm" onclick="Salary.openAddCredit(\''+e.id+'\')" style="color:var(--wa)">＋ Credit</button>'
            + '<button class="btn-ok btn-sm" onclick="Salary.openPayEmployee(\''+e.id+'\')">💰 Pay</button>'
            + '</div></div></div>';
        }).join('')
      + '</div></div>';
  },

  openAddEmployee: function() {
    Modal.open({
      title:'+ Add Employee', barColor:'var(--in)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Full Name *</label><input class="fi" id="emp-name" placeholder="John Smith"></div>'
          + '<div class="fg"><label class="fl">Role / Position</label><input class="fi" id="emp-role" placeholder="Sales Staff"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Monthly Salary *</label><input class="fi" id="emp-sal" type="number" placeholder="500"></div>'
          + '<div class="fg"><label class="fl">Phone</label><input class="fi" id="emp-phone" type="tel" placeholder="+231 77 000 000"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Bank / Mobile Money No.</label><input class="fi" id="emp-bank" placeholder="Account or MoMo number"></div>'
          + '<div class="fg"><label class="fl">Start Date</label><input class="fi" id="emp-start" type="date" value="'+Utils.today()+'"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Notes</label><input class="fi" id="emp-notes" placeholder="Any notes..."></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.saveEmployee()">✓ Save Employee</button>',
    });
  },

  saveEmployee: function() {
    var name=Utils.val('emp-name').trim(); var sal=parseFloat(Utils.val('emp-sal'))||0;
    if(!name){Toast.show('Name required','err');return;}
    if(!sal){Toast.show('Salary required','err');return;}
    var emp={
      id:Utils.uid('EMP'), name:name, role:Utils.val('emp-role'),
      salary:sal, phone:Utils.val('emp-phone'), bank:Utils.val('emp-bank'),
      startDate:Utils.val('emp-start')||Utils.today(),
      notes:Utils.val('emp-notes'), status:'active', createdAt:Utils.today(),
    };
    DB.addEmployee(emp);
    Toast.show(name+' added ✓','ok'); Modal.close(); Salary.render();
  },

  openEditEmployee: function(id) {
    var e=DB.getEmployees().find(function(x){return x.id===id;}); if(!e) return;
    Modal.open({
      title:'Edit Employee', sub:Utils.esc(e.name), barColor:'var(--in)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Full Name</label><input class="fi" id="ee-name" value="'+Utils.esc(e.name)+'"></div>'
          + '<div class="fg"><label class="fl">Role</label><input class="fi" id="ee-role" value="'+Utils.esc(e.role||'')+'"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Monthly Salary</label><input class="fi" id="ee-sal" type="number" value="'+(e.salary||0)+'"></div>'
          + '<div class="fg"><label class="fl">Phone</label><input class="fi" id="ee-phone" value="'+Utils.esc(e.phone||'')+'"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Bank / MoMo No.</label><input class="fi" id="ee-bank" value="'+Utils.esc(e.bank||'')+'"></div>'
          + '<div class="fg"><label class="fl">Status</label><select class="fi" id="ee-status">'
          + '<option'+(e.status==='active'?' selected':'')+'>active</option>'
          + '<option'+(e.status==='inactive'?' selected':'')+'>inactive</option>'
          + '</select></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.updateEmployee(\''+id+'\')">💾 Save</button>',
    });
  },

  updateEmployee: function(id) {
    var emps=DB.getEmployees(); var idx=emps.findIndex(function(x){return x.id===id;}); if(idx<0) return;
    emps[idx]=Object.assign({},emps[idx],{
      name:Utils.val('ee-name')||emps[idx].name, role:Utils.val('ee-role'),
      salary:parseFloat(Utils.val('ee-sal'))||emps[idx].salary,
      phone:Utils.val('ee-phone'), bank:Utils.val('ee-bank'),
      status:(Utils.get('ee-status')||{value:'active'}).value,
    });
    DB.set('employees',emps);
    Toast.show('Updated ✓','ok'); Modal.close(); Salary.render();
  },

  /* ══════════════════════════════════════════════════════
     ADD CREDIT / LOAN / ADVANCE
  ══════════════════════════════════════════════════════ */
  openAddCredit: function(empId) {
    var emps   = DB.getEmployees();
    var e      = emps.find(function(x){ return x.id===empId; });
    var empOpts= emps.filter(function(x){ return x.status==='active'; }).map(function(x){
      return '<option value="'+x.id+'"'+(x.id===empId?' selected':'')+'>'+Utils.esc(x.name)+'</option>';
    }).join('');
    var cur    = DB.getSettings().currency||'$';
    var existingLoans = (DB.get('employeeLoans')||[]).filter(function(l){
      return l.employeeId===empId && l.status==='active';
    });
    var totalOwed = existingLoans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);

    Modal.open({
      title:'＋ Add Credit / Loan', barColor:'var(--wa)',
      sub: e ? Utils.esc(e.name)+' · Outstanding: '+Utils.cur(totalOwed,cur) : '',
      body: '<div class="fg"><label class="fl">Employee *</label>'
          + '<select class="fi" id="cr-emp">'+empOpts+'</select></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Type *</label>'
          + '<select class="fi" id="cr-type">'
          + '<option value="Loan">💵 Loan (Cash Borrowed)</option>'
          + '<option value="Store Credit">🛒 Store Credit (Goods Taken)</option>'
          + '<option value="Salary Advance">⏩ Salary Advance</option>'
          + '</select></div>'
          + '<div class="fg"><label class="fl">Amount *</label>'
          + '<input class="fi" id="cr-amt" type="number" placeholder="0.00" oninput="Salary._previewCredit()"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Description / What for</label>'
          + '<input class="fi" id="cr-desc" placeholder="e.g. Bought tiles on credit, Emergency loan..."></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Date Taken</label>'
          + '<input class="fi" id="cr-date" type="date" value="'+Utils.today()+'"></div>'
          + '<div class="fg"><label class="fl">Monthly Deduction (optional)</label>'
          + '<input class="fi" id="cr-monthly" type="number" placeholder="Full amount at month end" oninput="Salary._previewCredit()"></div>'
          + '</div>'
          + '<div id="cr-preview" style="display:none;background:var(--wab);border:1px solid var(--wabd);border-radius:var(--r10);padding:12px;margin-top:4px;font-size:12px;line-height:1.8;color:var(--t1)"></div>'
          + '<div style="background:var(--inb);border:1px solid var(--inbd);border-radius:var(--r10);padding:10px 12px;margin-top:10px;font-size:11px;color:var(--in)">'
          + 'ℹ️ If no monthly deduction is set, the <strong>full amount</strong> will be deducted from the salary at the end of the month it was taken.'
          + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.saveCredit()">✓ Record Credit</button>',
    });
  },

  _previewCredit: function() {
    var amt     = parseFloat(Utils.val('cr-amt'))||0;
    var monthly = parseFloat(Utils.val('cr-monthly'))||0;
    var el      = Utils.get('cr-preview');
    if (!el || !amt) { if(el) el.style.display='none'; return; }
    var cur     = DB.getSettings().currency||'$';
    var deduct  = monthly > 0 ? monthly : amt;
    var months  = monthly > 0 && monthly < amt ? Math.ceil(amt/monthly) : 1;
    el.style.display = 'block';
    el.innerHTML = '📋 <strong>Repayment Plan:</strong><br>'
      + '• Total Credit: <strong>'+Utils.cur(amt,cur)+'</strong><br>'
      + (monthly>0 && monthly<amt
          ? '• Monthly deduction: <strong>'+Utils.cur(monthly,cur)+'</strong> for ~'+months+' month'+(months!==1?'s':'')
          : '• Will be <strong>fully deducted</strong> this month end')
      + '<br>• Remaining balance tracked automatically';
  },

  saveCredit: function() {
    var empId   = (Utils.get('cr-emp')||{value:''}).value;
    var type    = (Utils.get('cr-type')||{value:'Loan'}).value;
    var amt     = parseFloat(Utils.val('cr-amt'))||0;
    var monthly = parseFloat(Utils.val('cr-monthly'))||0;
    var desc    = Utils.val('cr-desc').trim();
    var date    = Utils.val('cr-date')||Utils.today();
    if (!empId) { Toast.show('Select employee','err'); return; }
    if (!amt)   { Toast.show('Enter amount','err'); return; }
    if (!desc)  { desc = type; }

    // If no monthly set → full deduction = deduct entire amount at month end
    var monthlyDed = monthly > 0 ? monthly : amt;

    var loan = {
      id:            Utils.uid('CR'),
      employeeId:    empId,
      type:          type,
      amount:        amt,
      balance:       amt,
      paid:          0,
      description:   desc,
      monthlyDeduction: monthlyDed,
      fullDeductMonth: monthly <= 0, // flag: deduct all at end of month
      date:          date,
      month:         date.slice(0,7),
      status:        'active',
      history: [{
        action:    'created',
        amount:    amt,
        date:      date,
        note:      type+' recorded',
      }],
      createdAt: Utils.today(),
    };

    var loans = DB.get('employeeLoans')||[];
    loans.unshift(loan);
    DB.set('employeeLoans', loans);

    var cur = DB.getSettings().currency||'$';
    Toast.show(type+' of '+Utils.cur(amt,cur)+' recorded ✓','ok');
    Modal.close();
    Salary.render();
  },

  /* ══════════════════════════════════════════════════════
     PAY EMPLOYEE  — auto-loads credits for deduction
  ══════════════════════════════════════════════════════ */
  _currentLoans: [],

  openPayEmployee: function(id) {
    var e      = DB.getEmployees().find(function(x){ return x.id===id; }); if(!e) return;
    var cur    = DB.getSettings().currency||'$';
    var month  = Utils.today().slice(0,7);
    var loans  = (DB.get('employeeLoans')||[]).filter(function(l){
      return l.employeeId===id && l.status==='active';
    });
    var loanBal= loans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);
    var ytd    = (DB.getPayroll()||[]).filter(function(p){
      return p.employeeId===id && p.month.startsWith(Utils.today().slice(0,4));
    }).reduce(function(a,p){ return a+(parseFloat(p.netPay||p.amount)||0); },0);

    // Build credit deduction rows — auto-fill monthly deduction amount
    var loanHtml = '';
    if (loans.length) {
      loanHtml = '<div style="margin:14px 0 6px;font-size:11px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.1em">🏦 Credit Deductions This Month</div>'
        + loans.map(function(l){
            var typeColor = l.type==='Store Credit' ? 'var(--in)' : l.type==='Salary Advance' ? 'var(--pu)' : 'var(--wa)';
            var autoAmt   = Math.min(parseFloat(l.monthlyDeduction)||parseFloat(l.balance)||0, parseFloat(l.balance)||0);
            return '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:8px">'
              + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
              + '<div><div style="font-size:13px;font-weight:700;color:var(--t1)">'+Utils.esc(l.description||l.type)+'</div>'
              + '<div style="font-size:11px;color:'+typeColor+';margin-top:2px">'+l.type+' · Taken: '+Utils.date(l.date)+'</div>'
              + '</div>'
              + '<div style="text-align:right"><div style="font-size:12px;font-weight:800;color:var(--wa)">Balance</div>'
              + '<div style="font-size:15px;font-weight:900;color:var(--wa)">'+Utils.cur(l.balance,cur)+'</div>'
              + '</div></div>'
              + '<div style="display:flex;align-items:center;gap:10px">'
              + '<label style="font-size:12px;color:var(--t2);flex:1">Deduct this month:</label>'
              + '<input type="number" id="loan-ded-'+l.id+'" value="'+autoAmt.toFixed(2)+'" min="0" max="'+l.balance+'"'
              + ' oninput="Salary.calcNetPay()"'
              + ' style="width:110px;text-align:right;background:var(--bg2);border:1.5px solid var(--erbd);border-radius:8px;padding:8px 10px;font-size:14px;font-weight:800;color:var(--er)">'
              + '</div></div>';
          }).join('');
    } else {
      loanHtml = '<div style="font-size:12px;color:var(--t3);padding:8px 0">No active credits or loans</div>';
    }

    Modal.open({
      title:'💰 Process Salary', sub:Utils.esc(e.name)+' · '+month, barColor:'var(--ok)',
      body:
        // Summary bar
        '<div style="background:var(--bg3);border-radius:var(--r12);padding:12px 14px;margin-bottom:14px">'
        + '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bd)">'
        + '<span style="font-size:12px;color:var(--t2)">Base Salary</span>'
        + '<span style="font-weight:700;color:var(--g)">'+Utils.cur(e.salary||0,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bd)">'
        + '<span style="font-size:12px;color:var(--t2)">Total Credit Balance</span>'
        + '<span style="font-weight:700;color:var(--wa)">'+Utils.cur(loanBal,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:5px 0">'
        + '<span style="font-size:12px;color:var(--t2)">YTD Paid ('+Utils.today().slice(0,4)+')</span>'
        + '<span style="font-weight:700">'+Utils.cur(ytd,cur)+'</span></div>'
        + '</div>'
        // Earnings
        + '<div class="fg"><label class="fl">Base Salary</label><input class="fi" id="pay-base" type="number" value="'+(e.salary||0)+'" oninput="Salary.calcNetPay()"></div>'
        + '<div class="fg"><label class="fl">Bonus / Allowance</label><input class="fi" id="pay-bonus" type="number" placeholder="" oninput="Salary.calcNetPay()"></div>'
        + '<div class="fg"><label class="fl">Other Deduction (Tax, NASSIT...)</label><input class="fi" id="pay-ded" type="number" placeholder="" oninput="Salary.calcNetPay()"></div>'
        // Credit deductions
        + loanHtml
        // NET PAY display
        + '<div style="background:var(--okb);border:1.5px solid var(--okbd);border-radius:var(--r12);padding:16px;margin-top:14px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:14px;font-weight:800;color:var(--t1)">NET PAY</span>'
        + '<span id="net-pay-display" style="font-size:26px;font-weight:900;color:var(--ok);font-family:var(--fm)">'+Utils.cur(e.salary||0,cur)+'</span>'
        + '</div>'
        + '<div id="pay-breakdown" style="font-size:11px;color:var(--t2);margin-top:6px"></div>'
        + '</div>'
        // Payment
        + '<div class="form-row" style="margin-top:14px">'
        + '<div class="fg"><label class="fl">Payment Method</label>'
        + '<select class="fi" id="pay-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div>'
        + '<div class="fg"><label class="fl">Notes</label><input class="fi" id="pay-notes" placeholder="Notes..."></div>'
        + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-ghost btn-sm" onclick="Salary.printPayslip(\''+id+'\')" style="color:var(--in)">🖨 Payslip</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.processPay(\''+id+'\')">✅ Process Pay</button>',
    });

    Salary._currentLoans = loans;
    setTimeout(function(){ Salary.calcNetPay(); }, 150);
  },

  calcNetPay: function() {
    var base    = parseFloat(Utils.val('pay-base'))||0;
    var bonus   = parseFloat(Utils.val('pay-bonus'))||0;
    var ded     = parseFloat(Utils.val('pay-ded'))||0;
    var loanDed = 0;
    Salary._currentLoans.forEach(function(l){
      var inp = Utils.get('loan-ded-'+l.id);
      loanDed += inp && inp.value.trim() ? (parseFloat(inp.value)||0) : 0;
    });
    var gross = base + bonus;
    var totalDed = ded + loanDed;
    var net = Math.max(0, gross - totalDed);
    var cur = DB.getSettings().currency||'$';
    var dispEl = Utils.get('net-pay-display');
    var brkEl  = Utils.get('pay-breakdown');
    if (dispEl) dispEl.textContent = Utils.cur(net, cur);
    if (brkEl) {
      brkEl.innerHTML = 'Gross: '+Utils.cur(gross,cur)
        + (ded>0 ? ' · Other ded: −'+Utils.cur(ded,cur) : '')
        + (loanDed>0 ? ' · Credit ded: −'+Utils.cur(loanDed,cur) : '');
    }
  },

  processPay: function(id) {
    var e     = DB.getEmployees().find(function(x){ return x.id===id; }); if(!e) return;
    var cur   = DB.getSettings().currency||'$';
    var month = Utils.today().slice(0,7);
    var base  = parseFloat(Utils.val('pay-base'))||0;
    var bonus = parseFloat(Utils.val('pay-bonus'))||0;
    var ded   = parseFloat(Utils.val('pay-ded'))||0;
    var loanDed = 0;
    var loanDeductions = [];

    Salary._currentLoans.forEach(function(l){
      var inp = Utils.get('loan-ded-'+l.id);
      var amt = inp && inp.value.trim() ? (parseFloat(inp.value)||0) : 0;
      if (amt > 0) { loanDed += amt; loanDeductions.push({ loanId:l.id, amount:amt, type:l.type, desc:l.description }); }
    });

    var netPay = Math.max(0, base + bonus - ded - loanDed);
    var method = (Utils.get('pay-method')||{value:'Cash'}).value;
    var notes  = Utils.val('pay-notes');

    var record = {
      id: Utils.uid('PAY'), employeeId: id, month: month,
      baseSalary: base, bonus: bonus, deduction: ded,
      loanDeduction: loanDed, loanDeductions: loanDeductions,
      netPay: netPay, amount: netPay,
      method: method, notes: notes,
      paidAt: new Date().toISOString(), date: Utils.today(),
    };
    DB.addPayroll(record);

    // Update each loan balance & history
    if (loanDeductions.length) {
      var loans = DB.get('employeeLoans')||[];
      loanDeductions.forEach(function(ld){
        var li = loans.findIndex(function(l){ return l.id===ld.loanId; });
        if (li>=0) {
          var newBal = Math.max(0,(parseFloat(loans[li].balance)||0)-ld.amount);
          loans[li].balance = newBal;
          loans[li].paid    = (parseFloat(loans[li].paid)||0)+ld.amount;
          if (!loans[li].history) loans[li].history = [];
          loans[li].history.push({
            action: 'deduction', amount: ld.amount,
            date: Utils.today(), month: month,
            note: 'Deducted from '+month+' salary',
          });
          if (newBal <= 0) {
            loans[li].status  = 'paid';
            loans[li].paidAt  = Utils.today();
            loans[li].history.push({ action:'cleared', amount:0, date:Utils.today(), note:'Fully repaid' });
          }
        }
      });
      DB.set('employeeLoans', loans);
    }

    Toast.show(e.name+' paid '+Utils.cur(netPay,cur)+' ✓','ok');
    Modal.close();
    setTimeout(function(){ Salary.printPayslip(id, record); }, 400);
    Salary.render();
  },

  /* ══════════════════════════════════════════════════════
     PAYROLL TAB
  ══════════════════════════════════════════════════════ */
  _renderPayroll: function(el) {
    var month   = Utils.today().slice(0,7);
    var payroll = (DB.getPayroll()||[]).filter(function(p){ return p.month===month; });
    var emps    = DB.getEmployees();
    var cur     = DB.getSettings().currency||'$';
    if (!payroll.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">💰</div>'
        + '<div class="empty-title">No payroll this month</div>'
        + '<div class="empty-sub">Go to Employees tab and tap 💰 Pay</div></div>';
      return;
    }
    el.innerHTML = '<div class="sec"><div class="card">'
      + payroll.map(function(p){
          var emp = emps.find(function(e){ return e.id===p.employeeId; });
          return '<div class="list-item" onclick="Salary.printPayslip(\''+p.employeeId+'\',\''+p.id+'\')">'
            + '<div class="list-icon" style="background:var(--okb)">💰</div>'
            + '<div class="list-info">'
            + '<div class="list-name">'+Utils.esc(emp?emp.name:'Unknown')+'</div>'
            + '<div class="list-meta">'+Utils.esc(p.method||'Cash')+' · '+Utils.date(p.date)+'</div>'
            + (p.loanDeduction>0?'<div class="list-meta" style="color:var(--wa)">Credit deducted: −'+Utils.cur(p.loanDeduction,cur)+'</div>':'')
            + '</div>'
            + '<div class="list-right">'
            + '<div class="list-val">'+Utils.cur(p.netPay||p.amount,cur)+'</div>'
            + '<span class="badge badge-ok">PAID</span>'
            + '<div class="list-actions"><button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Salary.printPayslip(\''+p.employeeId+'\',\''+p.id+'\')">🖨</button></div>'
            + '</div></div>';
        }).join('')
      + '</div></div>';
  },

  /* ══════════════════════════════════════════════════════
     CREDITS & LOANS TAB — full statement per employee
  ══════════════════════════════════════════════════════ */
  _renderCredits: function(el) {
    var loans  = DB.get('employeeLoans')||[];
    var emps   = DB.getEmployees();
    var cur    = DB.getSettings().currency||'$';

    // Group by employee
    var byEmp = {};
    loans.forEach(function(l){
      if (!byEmp[l.employeeId]) byEmp[l.employeeId] = [];
      byEmp[l.employeeId].push(l);
    });

    var totalOutstanding = loans.filter(function(l){ return l.status==='active'; })
                               .reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);

    if (!loans.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🏦</div>'
        + '<div class="empty-title">No credits recorded</div>'
        + '<div class="empty-sub">Go to Employees tab and tap + Credit</div></div>';
      return;
    }

    el.innerHTML = '<div class="sec">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 0 12px">'
      + '<div style="font-size:13px;color:var(--t2)">Total outstanding: <strong style="color:var(--wa)">'+Utils.cur(totalOutstanding,cur)+'</strong></div>'
      + '<button class="btn-primary btn-sm" onclick="Salary.openAddCredit(\'\')">＋ Add Credit</button>'
      + '</div>'
      // Per-employee cards
      + Object.keys(byEmp).map(function(empId){
          var emp      = emps.find(function(e){ return e.id===empId; });
          var empName  = emp ? emp.name : 'Unknown';
          var empLoans = byEmp[empId];
          var empBal   = empLoans.filter(function(l){ return l.status==='active'; })
                                 .reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);

          var creditRows = empLoans.map(function(l){
            var typeIcon = l.type==='Store Credit'?'🛒':l.type==='Salary Advance'?'⏩':'💵';
            var isPaid   = l.status==='paid';
            var pctPaid  = l.amount>0 ? Math.min(100,Math.round(((l.paid||0)/l.amount)*100)) : 100;

            // History rows
            var histHtml = '';
            if (l.history && l.history.length) {
              histHtml = '<div style="margin-top:8px;padding:8px;background:var(--bg2);border-radius:8px">'
                + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Statement</div>'
                + l.history.map(function(h){
                    var hColor = h.action==='deduction' ? 'var(--ok)' : h.action==='cleared' ? 'var(--g)' : 'var(--er)';
                    var hIcon  = h.action==='deduction' ? '−' : h.action==='cleared' ? '✅' : '＋';
                    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--bd);font-size:11px">'
                      + '<div><span style="color:'+hColor+';font-weight:700">'+hIcon+'</span> '+Utils.esc(h.note||h.action)+'</div>'
                      + '<div style="text-align:right">'
                      + (h.amount>0?'<span style="font-weight:700;color:'+hColor+'">'+Utils.cur(h.amount,cur)+'</span> ':'')
                      + '<span style="color:var(--t3);margin-left:6px">'+Utils.date(h.date)+'</span>'
                      + '</div></div>';
                  }).join('')
                + '</div>';
            }

            return '<div style="background:var(--bg3);border:1px solid var(--bd);border-radius:var(--r10);padding:12px;margin-bottom:8px">'
              // Header row
              + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
              + '<div>'
              + '<div style="font-size:13px;font-weight:700;color:var(--t1)">'+typeIcon+' '+Utils.esc(l.description||l.type)+'</div>'
              + '<div style="font-size:11px;color:var(--t3);margin-top:2px">'+l.type+' · '+Utils.date(l.date)+'</div>'
              + '</div>'
              + '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;background:'+(isPaid?'var(--okb)':'var(--wab)')+';color:'+(isPaid?'var(--ok)':'var(--wa)')+'">'+(isPaid?'CLEARED':'ACTIVE')+'</span>'
              + '</div>'
              // Amounts row
              + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">'
              + '<div style="background:var(--bg2);border-radius:8px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--t3);text-transform:uppercase">Original</div><div style="font-size:13px;font-weight:800">'+Utils.cur(l.amount,cur)+'</div></div>'
              + '<div style="background:var(--bg2);border-radius:8px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--t3);text-transform:uppercase">Paid</div><div style="font-size:13px;font-weight:800;color:var(--ok)">'+Utils.cur(l.paid||0,cur)+'</div></div>'
              + '<div style="background:var(--bg2);border-radius:8px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--t3);text-transform:uppercase">Balance</div><div style="font-size:13px;font-weight:800;color:'+(isPaid?'var(--ok)':'var(--wa)')+'">'+Utils.cur(l.balance||0,cur)+'</div></div>'
              + '</div>'
              // Progress bar
              + '<div style="background:var(--bd);border-radius:99px;height:6px;margin-bottom:6px">'
              + '<div style="background:'+(isPaid?'var(--g)':'var(--ok)')+';border-radius:99px;height:6px;width:'+pctPaid+'%;transition:width .4s"></div>'
              + '</div>'
              + '<div style="font-size:10px;color:var(--t3);margin-bottom:8px">'+pctPaid+'% repaid · Monthly deduction: '+Utils.cur(l.monthlyDeduction||l.amount,cur)+'</div>'
              // History
              + histHtml
              // Actions
              + (!isPaid ? '<div style="display:flex;gap:8px;margin-top:8px">'
                + '<button onclick="Salary.openManualDeduction(\''+l.id+'\')" class="btn-ghost btn-sm" style="flex:1;color:var(--ok)">💳 Manual Deduction</button>'
                + '<button onclick="Salary.clearCredit(\''+l.id+'\')" class="btn-ghost btn-sm" style="color:var(--er)">✓ Mark Cleared</button>'
                + '</div>' : '')
              + '</div>';
          }).join('');

          return '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r14);padding:14px;margin-bottom:14px">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
            + '<div><div style="font-size:15px;font-weight:800;color:var(--t1)">👤 '+Utils.esc(empName)+'</div>'
            + (emp?'<div style="font-size:11px;color:var(--t2)">'+Utils.esc(emp.role||'Employee')+'</div>':'')
            + '</div>'
            + '<div style="text-align:right">'
            + '<div style="font-size:11px;color:var(--t3)">Outstanding</div>'
            + '<div style="font-size:18px;font-weight:900;color:'+(empBal>0?'var(--wa)':'var(--ok)')+'">'+Utils.cur(empBal,cur)+'</div>'
            + '</div></div>'
            + '<button class="btn-ghost btn-sm" style="color:var(--g);border-color:rgba(212,168,67,.3);margin-bottom:10px" onclick="Salary.openAddCredit(\''+empId+'\')">＋ Add Credit</button>'
            + creditRows
            + '</div>';
        }).join('')
      + '</div>';
  },

  openManualDeduction: function(loanId) {
    var loans = DB.get('employeeLoans')||[];
    var l     = loans.find(function(x){ return x.id===loanId; }); if(!l) return;
    var cur   = DB.getSettings().currency||'$';
    Modal.open({
      title:'Manual Deduction', sub:Utils.esc(l.description||l.type), barColor:'var(--ok)',
      body: '<div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg3);border-radius:8px;margin-bottom:12px">'
          + '<span style="font-size:13px;color:var(--t2)">Remaining Balance</span>'
          + '<span style="font-size:16px;font-weight:800;color:var(--wa)">'+Utils.cur(l.balance,cur)+'</span>'
          + '</div>'
          + '<div class="fg"><label class="fl">Amount to Deduct</label>'
          + '<input class="fi" id="md-amt" type="number" placeholder="" min="0" max="'+l.balance+'"></div>'
          + '<div class="fg"><label class="fl">Note</label>'
          + '<input class="fi" id="md-note" placeholder="e.g. Cash repayment, deducted from advance..."></div>'
          + '<div class="fg"><label class="fl">Date</label>'
          + '<input class="fi" id="md-date" type="date" value="'+Utils.today()+'"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.saveManualDeduction(\''+loanId+'\')">✓ Apply Deduction</button>',
    });
  },

  saveManualDeduction: function(loanId) {
    var amt  = parseFloat(Utils.val('md-amt'))||0;
    var note = Utils.val('md-note')||'Manual deduction';
    var date = Utils.val('md-date')||Utils.today();
    if (!amt) { Toast.show('Enter amount','err'); return; }
    var loans = DB.get('employeeLoans')||[];
    var idx   = loans.findIndex(function(x){ return x.id===loanId; }); if(idx<0) return;
    var cur   = DB.getSettings().currency||'$';
    var newBal= Math.max(0,(parseFloat(loans[idx].balance)||0)-amt);
    loans[idx].balance = newBal;
    loans[idx].paid    = (parseFloat(loans[idx].paid)||0)+amt;
    if (!loans[idx].history) loans[idx].history=[];
    loans[idx].history.push({ action:'deduction', amount:amt, date:date, note:note });
    if (newBal<=0) { loans[idx].status='paid'; loans[idx].history.push({ action:'cleared',amount:0,date:date,note:'Fully repaid' }); }
    DB.set('employeeLoans',loans);
    Toast.show('Deduction of '+Utils.cur(amt,cur)+' applied ✓','ok');
    Modal.close();
    Salary.render();
  },

  clearCredit: function(loanId) {
    var loans = DB.get('employeeLoans')||[];
    var idx   = loans.findIndex(function(x){ return x.id===loanId; }); if(idx<0) return;
    loans[idx].status = 'paid';
    loans[idx].paidAt = Utils.today();
    if (!loans[idx].history) loans[idx].history=[];
    loans[idx].history.push({ action:'cleared', amount:loans[idx].balance, date:Utils.today(), note:'Manually marked as cleared' });
    loans[idx].balance = 0;
    DB.set('employeeLoans',loans);
    Toast.show('Credit marked as cleared ✓','ok');
    Salary.render();
  },

  /* ══════════════════════════════════════════════════════
     PROFESSIONAL PAYSLIP PRINT
  ══════════════════════════════════════════════════════ */
  printPayslip: function(empId, recordOrId) {
    var e = DB.getEmployees().find(function(x){ return x.id===empId; }); if(!e) return;
    var settings = DB.getSettings();
    var cur      = settings.currency||'$';
    var bizName  = settings.bizName  ||'SmartStock Pro';
    var bizAddr  = settings.bizAddress||'';
    var bizPhone = settings.bizPhone  ||'';
    var bizEmail = settings.bizEmail  ||'';
    var bizLogo  = settings.bizLogo   ||'';
    var user     = Auth.currentUser   ||{};
    var userName = user.name||user.username||'';
    var month    = Utils.today().slice(0,7);
    var now      = new Date();
    var timeStr  = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

    var rec = null;
    if (recordOrId && typeof recordOrId==='object') { rec=recordOrId; }
    else if (recordOrId) { rec=(DB.getPayroll()||[]).find(function(p){ return p.id===recordOrId; }); }
    if (!rec) { var rs=(DB.getPayroll()||[]).filter(function(p){ return p.employeeId===empId&&p.month===month; }); rec=rs[rs.length-1]||null; }

    var base   = rec?(parseFloat(rec.baseSalary)||0):(parseFloat(e.salary)||0);
    var bonus  = rec?(parseFloat(rec.bonus)||0):0;
    var ded    = rec?(parseFloat(rec.deduction)||0):0;
    var loanD  = rec?(parseFloat(rec.loanDeduction)||0):0;
    var netPay = rec?(parseFloat(rec.netPay||rec.amount)||0):base;
    var method = rec?(rec.method||'Cash'):'Cash';
    var notes  = rec?(rec.notes||''):'';
    var paidDate=rec?Utils.date(rec.date):Utils.today();
    var payMonth=rec?(rec.month||month):month;

    var ytdList=(DB.getPayroll()||[]).filter(function(p){ return p.employeeId===empId&&p.month.startsWith(Utils.today().slice(0,4)); });
    var ytdGross=ytdList.reduce(function(a,p){ return a+(parseFloat(p.baseSalary)||parseFloat(p.amount)||0); },0);
    var ytdNet  =ytdList.reduce(function(a,p){ return a+(parseFloat(p.netPay||p.amount)||0); },0);

    var allLoans=(DB.get('employeeLoans')||[]).filter(function(l){ return l.employeeId===empId; });
    var activeLoans=allLoans.filter(function(l){ return l.status==='active'; });
    var loanBal=activeLoans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);

    var startDate=e.startDate||e.createdAt||Utils.today();
    var monthsWorked=Math.max(1,Math.round((new Date()-new Date(startDate))/(30.44*24*3600*1000)));

    var refCode='PAY-'+empId.slice(-6)+'-'+payMonth;
    var payMonthFull=new Date(payMonth+'-01').toLocaleDateString('en-US',{year:'numeric',month:'long'});
    var logoHtml=bizLogo?'<img src="'+bizLogo+'" style="width:70px;height:70px;object-fit:contain;border-radius:10px" onerror="this.style.display=\'none\'">':'';

    // Credit deduction rows for print
    var loanRowsHtml='';
    if (rec && rec.loanDeductions && rec.loanDeductions.length) {
      loanRowsHtml = rec.loanDeductions.map(function(ld,i){
        return '<tr'+(i%2?' style="background:#f9fafb"':'')+'><td>'+Utils.esc(ld.desc||ld.type||'Credit Deduction')+'</td>'
          +'<td style="text-align:right;color:#dc2626;font-weight:600">−'+Utils.cur(ld.amount,cur)+'</td></tr>';
      }).join('');
    }

    // Credit statement for print
    var creditStatement='';
    if (activeLoans.length) {
      creditStatement='<h2>Active Credits & Loan Balances</h2>'
        +'<table><thead><tr><th>Description</th><th>Type</th><th style="text-align:right">Original</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th></tr></thead><tbody>'
        +activeLoans.map(function(l,i){
          return '<tr'+(i%2?' style="background:#f9fafb"':'')+'>'
            +'<td>'+Utils.esc(l.description||l.type)+'</td><td>'+Utils.esc(l.type)+'</td>'
            +'<td style="text-align:right">'+Utils.cur(l.amount,cur)+'</td>'
            +'<td style="text-align:right;color:#16a34a">'+Utils.cur(l.paid||0,cur)+'</td>'
            +'<td style="text-align:right;color:#d97706;font-weight:700">'+Utils.cur(l.balance||0,cur)+'</td>'
            +'</tr>';
        }).join('')
        +'</tbody></table>';
    }

    var css='*{margin:0;padding:0;box-sizing:border-box}'
      +'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff}'
      +'.page{max-width:210mm;margin:0 auto;padding:12mm}'
      +'.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #111;margin-bottom:16px}'
      +'h2{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;border-bottom:2px solid #111;padding-bottom:4px;margin:16px 0 8px;color:#333}'
      +'.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}'
      +'.box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:11px}'
      +'.bt{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;margin-bottom:7px}'
      +'.br{display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid #f0f0f0}'
      +'table{width:100%;border-collapse:collapse;margin-bottom:12px}'
      +'th{background:#111;color:#fff;padding:7px 9px;font-size:10px;font-weight:700;text-transform:uppercase;text-align:left}'
      +'td{padding:7px 9px;border-bottom:1px solid #e5e7eb}'
      +'.net{background:#111;color:#fff;border-radius:8px;padding:14px;display:flex;justify-content:space-between;align-items:center;margin:12px 0}'
      +'.ytd{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px}'
      +'.yc{text-align:center;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:9px}'
      +'.sig-row{display:flex;gap:20px;margin-top:24px}'
      +'.sig{flex:1;border-top:1px solid #333;padding-top:5px;font-size:10px;color:#555}'
      +'.footer{text-align:center;font-size:10px;color:#888;margin-top:14px;border-top:1px solid #e5e7eb;padding-top:10px}'
      +'@media print{@page{size:A4;margin:10mm}.page{padding:0}}';

    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip — '+Utils.esc(e.name)+'</title><style>'+css+'</style></head><body>'
      +'<div class="page">'
      // Header
      +'<div class="hdr">'
      +'<div style="display:flex;gap:12px;align-items:flex-start">'+logoHtml
      +'<div><div style="font-size:21px;font-weight:900">'+Utils.esc(bizName)+'</div>'
      +(bizAddr?'<div style="font-size:10px;color:#555;margin-top:2px">📍 '+Utils.esc(bizAddr)+'</div>':'')
      +(bizPhone?'<div style="font-size:10px;color:#555">📞 '+Utils.esc(bizPhone)+'</div>':'')
      +(bizEmail?'<div style="font-size:10px;color:#555">✉️ '+Utils.esc(bizEmail)+'</div>':'')
      +'<div style="margin-top:6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em">Salary Payslip</div>'
      +'</div></div>'
      +'<div style="text-align:right"><div style="font-size:10px;color:#555">Ref: <strong>'+refCode+'</strong></div>'
      +'<div style="font-size:16px;font-weight:900;margin-top:4px">'+payMonthFull+'</div>'
      +'<div style="font-size:10px;color:#555;margin-top:4px">Paid: '+paidDate+' · '+timeStr+'</div>'
      +'<div style="font-size:10px;color:#555">By: '+Utils.esc(userName)+'</div>'
      +'</div></div>'
      // Employee & Payment boxes
      +'<div class="grid2">'
      +'<div class="box"><div class="bt">👤 Employee</div>'
      +'<div class="br"><span>Name</span><span style="font-weight:700">'+Utils.esc(e.name)+'</span></div>'
      +'<div class="br"><span>Position</span><span>'+Utils.esc(e.role||'Employee')+'</span></div>'
      +'<div class="br"><span>ID</span><span style="font-family:monospace;font-size:10px">'+e.id.slice(-8)+'</span></div>'
      +(e.bank?'<div class="br"><span>Account</span><span>'+Utils.esc(e.bank)+'</span></div>':'')
      +'<div class="br"><span>Duration</span><span>'+monthsWorked+' months</span></div>'
      +'</div>'
      +'<div class="box"><div class="bt">💳 Payment</div>'
      +'<div class="br"><span>Period</span><span style="font-weight:700">'+payMonthFull+'</span></div>'
      +'<div class="br"><span>Date</span><span>'+paidDate+'</span></div>'
      +'<div class="br"><span>Method</span><span>'+Utils.esc(method)+'</span></div>'
      +(loanBal>0?'<div class="br"><span>Credit Balance</span><span style="color:#d97706;font-weight:700">'+Utils.cur(loanBal,cur)+'</span></div>':'')
      +(notes?'<div class="br"><span>Notes</span><span>'+Utils.esc(notes)+'</span></div>':'')
      +'</div></div>'
      // Earnings
      +'<h2>Earnings</h2>'
      +'<table><thead><tr><th style="width:60%">Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      +'<tr><td>Basic Salary</td><td style="text-align:right">'+Utils.cur(base,cur)+'</td></tr>'
      +(bonus>0?'<tr style="background:#f9fafb"><td>Bonus / Allowance</td><td style="text-align:right;color:#16a34a">'+Utils.cur(bonus,cur)+'</td></tr>':'')
      +'<tr style="background:#d1fae5"><td style="font-weight:700">GROSS PAY</td><td style="text-align:right;font-weight:800;color:#065f46">'+Utils.cur(base+bonus,cur)+'</td></tr>'
      +'</tbody></table>'
      // Deductions
      +'<h2>Deductions</h2>'
      +'<table><thead><tr><th style="width:60%">Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>'
      +(ded>0?'<tr><td>Tax / NASSIT / Other</td><td style="text-align:right;color:#dc2626">−'+Utils.cur(ded,cur)+'</td></tr>':'<tr><td style="color:#9ca3af">No statutory deductions</td><td style="text-align:right;color:#9ca3af">—</td></tr>')
      +loanRowsHtml
      +'<tr style="background:#fee2e2"><td style="font-weight:700">TOTAL DEDUCTIONS</td><td style="text-align:right;font-weight:800;color:#991b1b">−'+Utils.cur(ded+loanD,cur)+'</td></tr>'
      +'</tbody></table>'
      // NET PAY
      +'<div class="net">'
      +'<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af">Net Pay — Take Home</div>'
      +'<div style="font-size:10px;color:#6b7280;margin-top:2px">'+payMonthFull+' · '+Utils.esc(method)+'</div></div>'
      +'<div style="font-size:30px;font-weight:900">'+Utils.cur(netPay,cur)+'</div>'
      +'</div>'
      // YTD
      +'<h2>Year to Date — '+Utils.today().slice(0,4)+'</h2>'
      +'<div class="ytd">'
      +'<div class="yc"><div style="font-size:9px;color:#6b7280;margin-bottom:3px">YTD GROSS</div><div style="font-size:14px;font-weight:700">'+Utils.cur(ytdGross,cur)+'</div></div>'
      +'<div class="yc"><div style="font-size:9px;color:#6b7280;margin-bottom:3px">YTD NET</div><div style="font-size:14px;font-weight:700;color:#16a34a">'+Utils.cur(ytdNet,cur)+'</div></div>'
      +'<div class="yc"><div style="font-size:9px;color:#6b7280;margin-bottom:3px">CREDIT BALANCE</div><div style="font-size:14px;font-weight:700;color:'+(loanBal>0?'#d97706':'#16a34a')+'">'+Utils.cur(loanBal,cur)+'</div></div>'
      +'</div>'
      // Credit statement (if any)
      +creditStatement
      // Confidential + ref
      +'<div style="display:flex;justify-content:space-between;align-items:center;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px;margin-bottom:14px">'
      +'<span style="font-size:11px;color:#6b7280">🔒 CONFIDENTIAL — This payslip contains sensitive employee information.</span>'
      +'<span style="font-size:10px;font-family:monospace;color:#9ca3af">'+refCode+'</span>'
      +'</div>'
      // Signatures
      +'<div class="sig-row">'
      +'<div class="sig">Employee Signature: _________________________ &nbsp; Date: ___________</div>'
      +'<div class="sig">Authorised by: _________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: ___________</div>'
      +'</div>'
      +'<div class="footer">'+Utils.esc(bizName)+' &nbsp;|&nbsp; '+payMonthFull+' Payslip &nbsp;|&nbsp; '+refCode+' &nbsp;|&nbsp; Powered by SmartStock Pro</div>'
      +'</div></body></html>';

    Sales._printHtml(html,'payslip-frame');
  },
};
