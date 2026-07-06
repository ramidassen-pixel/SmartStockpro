/* === salary.js === */
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
            + '<button class="btn-ghost btn-sm" onclick="Salary.viewHistory(\''+e.id+'\')" style="color:var(--in)">📋 History</button>'
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
    // Saved statements viewer button
    var stmtBtn = '<div style="padding:0 0 12px;display:flex;justify-content:flex-end">'
      + '<button class="btn-ghost btn-sm" onclick="Salary.openStatementsFolder()" style="color:var(--in)">📁 Monthly Folder</button>'
      + '</div>';

    if (!payroll.length) {
      el.innerHTML = stmtBtn + '<div class="empty"><div class="empty-icon">💰</div>'
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

  viewHistory: function(empId) {
    var e       = DB.getEmployees().find(function(x){ return x.id===empId; });
    if (!e) return;
    var cur     = DB.getSettings().currency||'$';
    var month   = Utils.today().slice(0,7);   // current month only

    // Payroll records for this month
    var payRecords = (DB.getPayroll()||[]).filter(function(p){
      return p.employeeId===empId && p.month===month;
    });

    // All credits for this employee
    var allCredits = (DB.get('employeeLoans')||[]).filter(function(l){
      return l.employeeId===empId;
    });
    var activeCredits = allCredits.filter(function(l){ return l.status==='active'; });

    // ── Figures ──────────────────────────────────────────────────────────────
    var grossPaid     = payRecords.reduce(function(a,p){ return a+(parseFloat(p.baseSalary)||0)+(parseFloat(p.bonus)||0); },0);
    var totalDeducted = payRecords.reduce(function(a,p){ return a+(parseFloat(p.loanDeduction)||0)+(parseFloat(p.deduction)||0); },0);
    var loanDeducted  = payRecords.reduce(function(a,p){ return a+(parseFloat(p.loanDeduction)||0); },0);
    var netPaid       = payRecords.reduce(function(a,p){ return a+(parseFloat(p.netPay||p.amount)||0); },0);
    var totalCreditBal= activeCredits.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);
    var totalCreditTaken = allCredits.reduce(function(a,l){ return a+(parseFloat(l.amount)||0); },0);

    // Running balance: Salary earned − Credits taken = true net
    var runningBalance = grossPaid - totalCreditTaken;
    var isPositive     = runningBalance >= 0;

    var monthLabel = new Date(month+'-01').toLocaleDateString('en-US',{year:'numeric',month:'long'});

    // ── Build credit rows ────────────────────────────────────────────────────
    var creditRows = '';
    if (!allCredits.length) {
      creditRows = '<div style="text-align:center;padding:12px;color:var(--t3);font-size:13px">No credits recorded this month</div>';
    } else {
      creditRows = allCredits.map(function(l){
        var typeColor = l.type==='Store Credit'?'var(--in)':l.type==='Salary Advance'?'#7B7FF5':'var(--wa)';
        var typeIcon  = l.type==='Store Credit'?'🛒':l.type==='Salary Advance'?'⏩':'💵';
        var isPaid    = l.status==='paid';
        var pct       = l.amount>0?Math.min(100,Math.round(((l.paid||0)/l.amount)*100)):100;
        return '<div style="background:var(--bg3);border:1px solid var(--bd);border-radius:var(--r10);padding:12px;margin-bottom:8px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
          + '<div><div style="font-size:13px;font-weight:700;color:var(--t1)">'+typeIcon+' '+Utils.esc(l.description||l.type)+'</div>'
          + '<div style="font-size:11px;color:'+typeColor+';margin-top:2px">'+l.type+' · Taken: '+Utils.date(l.date)+'</div>'
          + '</div>'
          + '<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:99px;background:'+(isPaid?'var(--okb)':'var(--wab)')+';color:'+(isPaid?'var(--ok)':'var(--wa)')+';">'+(isPaid?'CLEARED':'ACTIVE')+'</span>'
          + '</div>'
          // Three-column stats
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">'
          + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">'
          + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:3px">Original</div>'
          + '<div style="font-size:14px;font-weight:800;color:var(--er)">'+Utils.cur(l.amount,cur)+'</div>'
          + '</div>'
          + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">'
          + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:3px">Deducted</div>'
          + '<div style="font-size:14px;font-weight:800;color:var(--ok)">'+Utils.cur(l.paid||0,cur)+'</div>'
          + '</div>'
          + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">'
          + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:3px">Balance</div>'
          + '<div style="font-size:14px;font-weight:800;color:'+(isPaid?'var(--ok)':'var(--wa)')+'">'+Utils.cur(l.balance||0,cur)+'</div>'
          + '</div>'
          + '</div>'
          // Progress bar
          + '<div style="background:var(--bd);border-radius:99px;height:5px;margin-bottom:4px">'
          + '<div style="background:'+(isPaid?'var(--g)':'var(--ok)')+';border-radius:99px;height:5px;width:'+pct+'%"></div>'
          + '</div>'
          + '<div style="font-size:10px;color:var(--t3)">'+pct+'% repaid</div>'
          + '</div>';
      }).join('');
    }

    // ── Build salary row ─────────────────────────────────────────────────────
    var salaryRow = payRecords.length
      ? payRecords.map(function(p){
          return '<div style="background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r10);padding:12px;margin-bottom:8px">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
            + '<div><div style="font-size:13px;font-weight:700;color:var(--t1)">Salary Payment</div>'
            + '<div style="font-size:11px;color:var(--t2)">'+Utils.date(p.date)+' · '+Utils.esc(p.method||'Cash')+'</div>'
            + '</div>'
            + '<span class="badge badge-ok">PAID</span>'
            + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px">'
            + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:3px">Gross</div><div style="font-size:13px;font-weight:800">'+Utils.cur((parseFloat(p.baseSalary)||0)+(parseFloat(p.bonus)||0),cur)+'</div></div>'
            + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:3px">Credit Ded.</div><div style="font-size:13px;font-weight:800;color:var(--er)">'+Utils.cur(p.loanDeduction||0,cur)+'</div></div>'
            + '<div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:3px">Other Ded.</div><div style="font-size:13px;font-weight:800;color:var(--er)">'+Utils.cur(p.deduction||0,cur)+'</div></div>'
            + '<div style="background:#111;border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:#aaa;text-transform:uppercase;margin-bottom:3px">Net Paid</div><div style="font-size:13px;font-weight:800;color:var(--ok)">'+Utils.cur(p.netPay||p.amount||0,cur)+'</div></div>'
            + '</div>'
            + (p.loanDeductions&&p.loanDeductions.length?
                '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--okbd)">'
                +'<div style="font-size:10px;font-weight:700;color:var(--t2);margin-bottom:4px">Credit deductions this paycheck:</div>'
                +p.loanDeductions.map(function(ld){
                  return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;color:var(--t2)">'
                    +'<span>'+Utils.esc(ld.desc||ld.type)+'</span>'
                    +'<span style="color:var(--er);font-weight:600">−'+Utils.cur(ld.amount,cur)+'</span>'
                    +'</div>';
                }).join('')
                +'</div>' : '')
            + '</div>';
        }).join('')
      : '<div style="text-align:center;padding:12px;color:var(--t3);font-size:13px">No salary paid this month yet</div>';

    // ── Running balance card ──────────────────────────────────────────────────
    var runCard = '<div style="background:'+(isPositive?'var(--okb)':'var(--erb)')+';border:1.5px solid '+(isPositive?'var(--okbd)':'var(--erbd)')+';border-radius:var(--r14);padding:16px;margin-bottom:16px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--t2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Running Balance — '+monthLabel+'</div>'
      // Row: Gross Earned
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">Gross Salary Earned</span>'
      + '<span style="font-size:15px;font-weight:700;color:var(--g)">+'+Utils.cur(grossPaid,cur)+'</span>'
      + '</div>'
      // Row: Credits taken
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">Total Credits Taken</span>'
      + '<span style="font-size:15px;font-weight:700;color:var(--er)">−'+Utils.cur(totalCreditTaken,cur)+'</span>'
      + '</div>'
      // Row: Credits already deducted from salary
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">Deducted from Salary</span>'
      + '<span style="font-size:15px;font-weight:700;color:var(--ok)">'+Utils.cur(loanDeducted,cur)+' recovered</span>'
      + '</div>'
      // Row: Still outstanding
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">Credit Balance Outstanding</span>'
      + '<span style="font-size:15px;font-weight:700;color:'+(totalCreditBal>0?'var(--wa)':'var(--ok)')+'">'+Utils.cur(totalCreditBal,cur)+'</span>'
      + '</div>'
      // Divider
      + '<div style="height:1px;background:var(--bd2);margin:10px 0"></div>'
      // Net paid out
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd)">'
      + '<span style="font-size:13px;color:var(--t2)">Net Actually Paid Out</span>'
      + '<span style="font-size:16px;font-weight:800;color:var(--ok)">'+Utils.cur(netPaid,cur)+'</span>'
      + '</div>'
      // Running balance = salary − all credits
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 0">'
      + '<span style="font-size:14px;font-weight:800;color:var(--t1)">RUNNING BALANCE</span>'
      + '<span style="font-size:22px;font-weight:900;color:'+(isPositive?'var(--ok)':'var(--er)')+'">'+(isPositive ? '+' : '-')+Utils.cur(Math.abs(runningBalance),cur)+(isPositive?' ahead':' owed')+'</span>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t2);margin-top:6px">'
      + (isPositive
          ? '✅ Employee earned more than credited. Business has paid out '+Utils.cur(runningBalance,cur)+' more than credits taken.'
          : '⚠️ Employee has taken '+Utils.cur(Math.abs(runningBalance),cur)+' more in credit than earned so far. Will be recovered from future salaries.')
      + '</div>'
      + '</div>';

    Modal.open({
      title: '📋 '+Utils.esc(e.name), sub: monthLabel+' · Salary vs Credit', barColor:'var(--in)',
      body:  runCard
           + '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">💰 Salary This Month</div>'
           + salaryRow
           + '<div style="font-size:11px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.1em;margin:14px 0 10px">🏦 Credits & Loans</div>'
           + creditRows,
      footer:'<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            +'<button class="btn-ghost btn-sm" onclick="Modal.close();Salary.openAddCredit(\''+empId+'\')" style="color:var(--wa)">＋ Add Credit</button>'
            +'<button class="btn-primary btn-sm" onclick="Modal.close();Salary.openPayEmployee(\''+empId+'\')">💰 Process Pay</button>',
    });
  },


  openStatementsFolder: function() {
    var stmts = DB.getMonthlyStatements ? DB.getMonthlyStatements() : [];
    var cur   = DB.getSettings().currency||'$';

    // Group by month
    var byMonth = {};
    stmts.forEach(function(s){
      if (!byMonth[s.month]) byMonth[s.month]=[];
      byMonth[s.month].push(s);
    });

    var months = Object.keys(byMonth).sort().reverse();

    var body = months.length === 0
      ? '<div class="empty" style="padding:30px 0"><div class="empty-icon">📁</div><div class="empty-title">No saved statements yet</div><div class="empty-sub">Process a salary payment to save a statement</div></div>'
      : months.map(function(m){
          var mLabel = new Date(m+'-01').toLocaleDateString('en-US',{year:'numeric',month:'long'});
          var mStmts = byMonth[m];
          var mTotal = mStmts.reduce(function(a,s){ return a+(parseFloat(s.netSalary)||0); },0);
          return '<div style="margin-bottom:16px">'
            +'<div style="font-size:12px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;padding:8px 12px;background:var(--gb3);border-radius:var(--r8) var(--r8) 0 0;border:1px solid rgba(212,168,67,.2)">📅 '+mLabel+' · Total: '+Utils.cur(mTotal,cur)+'</div>'
            +'<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:0 0 var(--r10) var(--r10);overflow:hidden">'
            +mStmts.map(function(s,i){
                return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;'+(i>0?'border-top:1px solid var(--bd)':'')+'">'
                  +'<div style="flex:1">'
                  +'<div style="font-size:13px;font-weight:700;color:var(--t1)">'+Utils.esc(s.empName||'Employee')+'</div>'
                  +'<div style="font-size:11px;color:var(--t2)">Deducted: '+Utils.cur(s.totalDeductions||0,cur)+' · Ref: <span style="font-family:monospace">'+s.id+'</span></div>'
                  +'</div>'
                  +'<div style="text-align:right">'
                  +'<div style="font-size:15px;font-weight:800;color:var(--ok)">'+Utils.cur(s.netSalary||0,cur)+'</div>'
                  +'<div style="font-size:10px;color:var(--t3)">'+Utils.esc(s.method||'Cash')+'</div>'
                  +'</div>'
                  +'<button class="btn-ghost btn-sm btn-icon" onclick="Salary._reprintStatement(\''+s.id+'\')" title="Reprint">🖨</button>'
                  +'</div>';
              }).join('')
            +'</div></div>';
        }).join('');

    Modal.open({
      title:'📁 Monthly Statement Folder', barColor:'var(--g)',
      sub: stmts.length+' statements saved',
      body: body,
      footer:'<button class="btn-primary btn-full" onclick="Modal.close()">Close</button>',
    });
  },

  _reprintStatement: function(stmtId) {
    var stmts = DB.getMonthlyStatements ? DB.getMonthlyStatements() : [];
    var s = stmts.find(function(x){ return x.id===stmtId; });
    if (!s || !s.html) { Toast.show('Statement not found','err'); return; }
    Sales._printHtml(s.html, 'payslip-frame');
  },

  printPayslip: function(empId, recordOrId, saveOnly) {
    var e        = DB.getEmployees().find(function(x){ return x.id===empId; });
    if (!e) return;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var bizAddr  = settings.bizAddress|| '';
    var bizPhone = settings.bizPhone  || '';
    var bizLogo  = settings.bizLogo   || '';
    var month    = Utils.today().slice(0,7);
    var now      = new Date();

    // Get payroll record
    var rec = null;
    if (recordOrId && typeof recordOrId === 'object') { rec = recordOrId; }
    else if (recordOrId) { rec = (DB.getPayroll()||[]).find(function(p){ return p.id === recordOrId; }); }
    if (!rec) {
      var rs = (DB.getPayroll()||[]).filter(function(p){ return p.employeeId===empId && p.month===month; });
      rec = rs[rs.length-1] || null;
    }

    var payMonth     = rec ? (rec.month||month) : month;
    var paidDate     = rec ? Utils.date(rec.date) : Utils.today();
    var baseSal      = rec ? (parseFloat(rec.baseSalary)||0) : (parseFloat(e.salary)||0);
    var bonus        = rec ? (parseFloat(rec.bonus)||0)      : 0;
    var otherDed     = rec ? (parseFloat(rec.deduction)||0)  : 0;
    var method       = rec ? (rec.method||'Cash')            : 'Cash';
    var notes        = rec ? (rec.notes||'')                 : '';
    var payMonthFull = new Date(payMonth+'-01').toLocaleDateString('en-US',{year:'numeric',month:'long'});
    var refCode      = 'SS-'+e.id.slice(-4).toUpperCase()+'-'+payMonth;
    var user         = Auth.currentUser || {};
    var preparedBy   = user.name || user.username || '';

    // Loans / credits
    var allLoans    = DB.get('employeeLoans') || [];
    var monthLoans  = allLoans.filter(function(l){ return l.employeeId===empId && l.month===payMonth; });
    var activeLoans = allLoans.filter(function(l){ return l.employeeId===empId && l.status==='active'; });
    var pendingBal  = activeLoans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); }, 0);
    var thisMonthDed= rec ? (parseFloat(rec.loanDeduction)||0) : 0;
    var prevPendBal = pendingBal + thisMonthDed;

    // Build all deduction line items
    var rows = [];

    // Credits taken this month
    monthLoans.forEach(function(l){
      rows.push({
        date:   Utils.date(l.date),
        cat:    l.type === 'Store Credit' ? 'Material' : l.type === 'Salary Advance' ? 'Advance' : 'Loan',
        detail: Utils.esc(l.description || l.type),
        amount: parseFloat(l.amount) || 0,
      });
    });

    // Loan deductions processed in payroll (pending deduction)
    if (rec && rec.loanDeductions && rec.loanDeductions.length) {
      rec.loanDeductions.forEach(function(ld){
        rows.push({
          date:   paidDate,
          cat:    'Pending Deduction',
          detail: Utils.esc(ld.desc || ld.type || ''),
          amount: parseFloat(ld.amount) || 0,
        });
      });
    }

    // Other manual deductions
    if (otherDed > 0) {
      rows.push({ date: paidDate, cat: 'Other Deduction', detail: Utils.esc(notes||''), amount: otherDed });
    }

    var totalDed  = rows.reduce(function(a,r){ return a+r.amount; }, 0);
    var netSalary = Math.max(0, baseSal + bonus - totalDed);

    // Group rows by category for the summary section at top
    var cats = {};
    rows.forEach(function(r){
      if (!cats[r.cat]) cats[r.cat] = [];
      cats[r.cat].push(r);
    });

    // Logo (base64 safe)
    var logoHtml = bizLogo
      ? '<img src="'+bizLogo+'" style="width:56px;height:56px;object-fit:contain;border-radius:10px;display:block" onerror="this.style.display=\'none\'">'
      : '';

    /* ── CSS ────────────────────────────────────────────────────────────── */
    var css = [
      '@page { size: A4; margin: 10mm; }',
      '* { margin:0; padding:0; box-sizing:border-box; }',
      'body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 12px; color: #1a202c; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '.page { max-width: 680px; margin: 0 auto; padding: 0; }',

      /* Header band */
      '.header { display:flex; align-items:flex-start; justify-content:space-between; background:#1a1a2e; color:#fff; padding:18px 22px; border-radius:0; }',
      '.header-left { display:flex; gap:14px; align-items:flex-start; }',
      '.biz-name { font-size:18px; font-weight:900; letter-spacing:.04em; color:#F0C866; margin-bottom:3px; }',
      '.biz-sub { font-size:10px; color:rgba(255,255,255,.65); line-height:1.5; }',
      '.header-right { text-align:right; }',
      '.doc-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:#F0C866; }',
      '.doc-ref { font-size:10px; color:rgba(255,255,255,.5); margin-top:3px; font-family:monospace; }',

      /* Employee band */
      '.emp-band { background:#F0C866; padding:12px 22px; display:flex; justify-content:space-between; align-items:center; }',
      '.emp-name { font-size:20px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; color:#1a1a2e; }',
      '.emp-meta { font-size:11px; color:#4a3800; margin-top:2px; }',
      '.emp-right { text-align:right; }',
      '.emp-month { font-size:12px; font-weight:700; color:#1a1a2e; }',
      '.emp-sal { font-size:11px; color:#4a3800; margin-top:2px; }',

      /* Body */
      '.body { padding:16px 22px; }',

      /* Credit summary section */
      '.section-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#718096; margin:12px 0 5px; }',
      '.credit-item { display:flex; justify-content:space-between; align-items:baseline; font-size:11px; padding:2px 0; color:#2d3748; }',
      '.credit-date { color:#718096; min-width:84px; }',
      '.credit-detail { flex:1; padding:0 8px; color:#4a5568; }',
      '.credit-amount { font-weight:700; color:#e53e3e; white-space:nowrap; }',

      /* Pending balance box */
      '.pending-box { border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; margin:10px 0; }',
      '.pending-row { display:flex; justify-content:space-between; padding:7px 12px; font-size:12px; border-bottom:1px solid #e2e8f0; }',
      '.pending-row:last-child { border-bottom:none; font-weight:800; }',
      '.pending-row.total { background:#fff8e1; }',

      /* Deduction table */
      '.ded-table { width:100%; border-collapse:collapse; margin:10px 0; font-size:11px; }',
      '.ded-table thead tr { background:#1a1a2e; color:#fff; }',
      '.ded-table th { padding:8px 10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; text-align:left; }',
      '.ded-table th:last-child { text-align:right; }',
      '.ded-table td { padding:7px 10px; border-bottom:1px solid #f0f0f0; vertical-align:top; }',
      '.ded-table td:last-child { text-align:right; font-weight:600; color:#e53e3e; white-space:nowrap; }',
      '.ded-table tr:nth-child(even) td { background:#f9fafb; }',
      '.ded-table .sub { font-size:10px; color:#718096; font-weight:400; }',
      '.ded-total { background:#1a1a2e !important; }',
      '.ded-total td { color:#fff !important; font-weight:800 !important; font-size:12px; padding:9px 10px; border:none; }',

      /* Summary box */
      '.summary { border:1.5px solid #e2e8f0; border-radius:8px; overflow:hidden; margin:10px 0; }',
      '.sum-row { display:flex; justify-content:space-between; align-items:center; padding:9px 14px; border-bottom:1px solid #f0f0f0; font-size:12px; }',
      '.sum-row:last-child { border-bottom:none; background:#f0fff4; padding:12px 14px; }',
      '.sum-label { color:#4a5568; }',
      '.sum-val { font-weight:700; }',
      '.net-label { font-size:14px; font-weight:900; color:#276749; }',
      '.net-val { font-size:20px; font-weight:900; color:#276749; }',

      /* Footer */
      '.footer-band { background:#f7fafc; border-top:1px solid #e2e8f0; padding:12px 22px; display:flex; justify-content:space-between; align-items:flex-end; margin-top:10px; }',
      '.sig-block { text-align:center; }',
      '.sig-line { border-bottom:1.5px solid #1a1a2e; width:160px; margin:0 auto 5px; height:28px; }',
      '.sig-name { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#1a1a2e; }',
      '.sig-role { font-size:10px; color:#718096; margin-top:2px; }',
      '.doc-info { text-align:right; font-size:9px; color:#a0aec0; line-height:1.7; }',

      /* Print optimisation */
      '@media print {',
      '  .page { max-width:100%; }',
      '  .header { -webkit-print-color-adjust:exact; print-color-adjust:exact; }',
      '  .emp-band { -webkit-print-color-adjust:exact; print-color-adjust:exact; }',
      '  .ded-total { -webkit-print-color-adjust:exact; print-color-adjust:exact; }',
      '  .sum-row:last-child { -webkit-print-color-adjust:exact; print-color-adjust:exact; }',
      '}',
    ].join('\n');

    /* ── CREDIT SUMMARY (top section) ─────────────────────────────────── */
    var summaryHtml = '';
    Object.keys(cats).forEach(function(cat){
      summaryHtml += '<div class="section-title">'+cat+'</div>';
      cats[cat].forEach(function(r){
        summaryHtml += '<div class="credit-item">'
          +'<span class="credit-date">'+r.date+'</span>'
          +'<span class="credit-detail">'+r.detail+'</span>'
          +'<span class="credit-amount">= '+Utils.cur(r.amount,cur)+'</span>'
          +'</div>';
      });
    });

    /* ── PENDING BALANCE BOX ───────────────────────────────────────────── */
    var pendingHtml = '';
    if (prevPendBal > 0 || thisMonthDed > 0) {
      pendingHtml = '<div class="section-title">Pending balance</div>'
        +'<div class="pending-box">'
        +'<div class="pending-row"><span>Pending balance</span><span style="font-weight:600">'+Utils.cur(prevPendBal,cur)+'</span></div>'
        +'<div class="pending-row"><span>This month deduction</span><span style="color:#e53e3e;font-weight:600">'+Utils.cur(thisMonthDed,cur)+'</span></div>'
        +'<div class="pending-row total"><span>Balance</span><span style="color:#d97706">'+Utils.cur(pendingBal,cur)+'</span></div>'
        +'</div>';
    }

    /* ── DEDUCTION TABLE ROWS ──────────────────────────────────────────── */
    var tableRows = rows.map(function(r, i){
      return '<tr>'
        +'<td style="color:#718096">'+r.date+'</td>'
        +'<td><span style="font-weight:600;color:#2d3748">'+r.cat+'</span>'
        +(r.detail ? '<br><span class="sub">'+r.detail+'</span>' : '')
        +'</td>'
        +'<td>'+Utils.cur(r.amount,cur)+'</td>'
        +'</tr>';
    }).join('');

    /* ── FULL HTML ─────────────────────────────────────────────────────── */
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      +'<title>'+Utils.esc(e.name)+' Payslip — '+payMonthFull+'</title>'
      +'<style>'+css+'</style></head><body>'
      +'<div class="page">'

      /* ── HEADER BAND ── */
      +'<div class="header">'
      +'<div class="header-left">'
      +(logoHtml ? '<div>'+logoHtml+'</div>' : '')
      +'<div>'
      +'<div class="biz-name">'+Utils.esc(bizName)+'</div>'
      +(bizAddr  ? '<div class="biz-sub">'+Utils.esc(bizAddr)+'</div>' : '')
      +(bizPhone ? '<div class="biz-sub">'+Utils.esc(bizPhone)+'</div>' : '')
      +'</div></div>'
      +'<div class="header-right">'
      +'<div class="doc-title">Salary Payslip</div>'
      +'<div class="doc-ref">'+refCode+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:3px">'+paidDate+'</div>'
      +'</div></div>'

      /* ── EMPLOYEE BAND ── */
      +'<div class="emp-band">'
      +'<div>'
      +'<div class="emp-name">'+Utils.esc(e.name)+'</div>'
      +'<div class="emp-meta">'+Utils.esc(e.role||'Employee')+(e.bank?' · '+Utils.esc(e.bank):'')+'</div>'
      +'</div>'
      +'<div class="emp-right">'
      +'<div class="emp-month">'+payMonthFull+'</div>'
      +'<div class="emp-sal">Base salary: <strong>'+Utils.cur(baseSal,cur)+'</strong>'+(bonus>0?' + Bonus: '+Utils.cur(bonus,cur):'')+'</div>'
      +'</div></div>'

      /* ── BODY ── */
      +'<div class="body">'

      /* Credit/Material/Advance summary */
      +(summaryHtml ? summaryHtml : '')

      /* Pending balance */
      +pendingHtml

      /* Deduction table */
      +'<div class="section-title" style="margin-top:14px">Monthly salary for '+payMonthFull+' — Deduction Summary</div>'
      +'<table class="ded-table">'
      +'<thead><tr><th>Date</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>'
      +'<tbody>'+tableRows+'</tbody>'
      +'<tbody>'
      +'<tr class="ded-total"><td colspan="2">Total Deductions</td><td style="text-align:right">'+Utils.cur(totalDed,cur)+'</td></tr>'
      +'</tbody></table>'

      /* Summary box */
      +'<div class="summary">'
      +'<div class="sum-row"><span class="sum-label">Base Salary</span><span class="sum-val">'+Utils.cur(baseSal,cur)+'</span></div>'
      +(bonus>0?'<div class="sum-row"><span class="sum-label">Bonus / Allowance</span><span class="sum-val" style="color:#276749">+'+Utils.cur(bonus,cur)+'</span></div>':'')
      +'<div class="sum-row"><span class="sum-label">Total Deductions</span><span class="sum-val" style="color:#e53e3e">−'+Utils.cur(totalDed,cur)+'</span></div>'
      +(pendingBal>0?'<div class="sum-row"><span class="sum-label">Remaining Credit Balance</span><span class="sum-val" style="color:#d97706">'+Utils.cur(pendingBal,cur)+'</span></div>':'')
      +(notes?'<div class="sum-row"><span class="sum-label">Notes</span><span class="sum-val" style="color:#718096;font-weight:400">'+Utils.esc(notes)+'</span></div>':'')
      +'<div class="sum-row"><span class="net-label">NET SALARY</span><span class="net-val">'+Utils.cur(netSalary,cur)+'</span></div>'
      +'</div>'

      +'</div>'/* end body */

      /* ── FOOTER BAND ── */
      +'<div class="footer-band">'
      +'<div class="sig-block">'
      +'<div style="font-size:9px;color:#a0aec0;margin-bottom:8px;text-align:center">Employee Signature</div>'
      +'<div class="sig-line"></div>'
      +'<div class="sig-name">'+Utils.esc(e.name)+'</div>'
      +(e.role?'<div class="sig-role">'+Utils.esc(e.role)+'</div>':'')
      +'</div>'
      +'<div class="sig-block">'
      +'<div style="font-size:9px;color:#a0aec0;margin-bottom:8px;text-align:center">Authorised By</div>'
      +'<div class="sig-line"></div>'
      +'<div class="sig-name">'+Utils.esc(preparedBy||bizName)+'</div>'
      +'<div class="sig-role">Management</div>'
      +'</div>'
      +'<div class="doc-info">'
      +'<div>'+Utils.esc(bizName)+'</div>'
      +'<div>'+payMonthFull+'</div>'
      +'<div style="font-family:monospace">'+refCode+'</div>'
      +'<div>Payment: '+Utils.esc(method)+'</div>'
      +'</div>'
      +'</div>'

      +'</div>'/* end page */
      +'</body></html>';

    /* ── SAVE TO MONTHLY FOLDER ────────────────────────────────────────── */
    var stmt = {
      id: refCode, empId: empId, empName: e.name,
      month: payMonth, baseSalary: baseSal,
      totalDeductions: totalDed, netSalary: netSalary,
      method: method, createdAt: now.toISOString(), html: html,
    };
    try { if (DB.saveMonthlyStatement) DB.saveMonthlyStatement(stmt); } catch(ex) {}

    if (!saveOnly) { Sales._printHtml(html, 'payslip-frame'); }
    return stmt;
  },

};
