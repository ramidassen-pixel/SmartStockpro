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
    var e        = DB.getEmployees().find(function(x){ return x.id===empId; }); if(!e) return;
    var settings = DB.getSettings();
    var cur      = settings.currency||'$';
    var bizName  = settings.bizName||'SmartStock Pro';
    var bizAddr  = settings.bizAddress||'';
    var bizPhone = settings.bizPhone||'';
    var bizLogo  = settings.bizLogo||'';
    var month    = Utils.today().slice(0,7);
    var now      = new Date();

    // Get payroll record
    var rec = null;
    if (recordOrId && typeof recordOrId==='object') { rec=recordOrId; }
    else if (recordOrId) { rec=(DB.getPayroll()||[]).find(function(p){ return p.id===recordOrId; }); }
    if (!rec) {
      var rs=(DB.getPayroll()||[]).filter(function(p){ return p.employeeId===empId&&p.month===month; });
      rec=rs[rs.length-1]||null;
    }
    var payMonth  = rec?(rec.month||month):month;
    var paidDate  = rec?Utils.date(rec.date):Utils.today();
    var baseSal   = rec?(parseFloat(rec.baseSalary)||0):(parseFloat(e.salary)||0);
    var bonus     = rec?(parseFloat(rec.bonus)||0):0;
    var method    = rec?(rec.method||'Cash'):'Cash';
    var notes     = rec?(rec.notes||''):'';

    var payMonthFull = new Date(payMonth+'-01').toLocaleDateString('en-US',{year:'numeric',month:'long'});
    var refCode = 'SS-'+empId.slice(-4).toUpperCase()+'-'+payMonth;

    // All credits/loans taken this month (by date taken, not deducted)
    var allLoans   = DB.get('employeeLoans')||[];
    var monthLoans = allLoans.filter(function(l){
      return l.employeeId===empId && l.month===payMonth;
    });
    // Active credit balances (all time)
    var activeLoans = allLoans.filter(function(l){
      return l.employeeId===empId && l.status==='active';
    });
    var pendingBal = activeLoans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); },0);

    // Build deduction rows from payroll record
    var deductionRows = [];

    // Credits taken this month
    monthLoans.forEach(function(l){
      deductionRows.push({
        date:  Utils.date(l.date),
        desc:  l.type==='Store Credit'?'Material':l.type==='Salary Advance'?'Advance':l.type,
        detail:l.description||'',
        amount:parseFloat(l.amount)||0,
        type:  l.type,
      });
    });

    // Absent / manual deductions from payroll record
    if (rec && rec.deduction && parseFloat(rec.deduction)>0) {
      deductionRows.push({
        date:  paidDate,
        desc:  'Other Deductions',
        detail:rec.notes||'',
        amount:parseFloat(rec.deduction)||0,
        type:  'other',
      });
    }

    // Loan deductions already processed this month
    if (rec && rec.loanDeductions && rec.loanDeductions.length) {
      rec.loanDeductions.forEach(function(ld){
        deductionRows.push({
          date:  paidDate,
          desc:  'Pending Deduction',
          detail:ld.desc||ld.type,
          amount:parseFloat(ld.amount)||0,
          type:  'deduction',
        });
      });
    }

    var totalDeductions = deductionRows.reduce(function(a,r){ return a+r.amount; },0);
    var netSalary       = Math.max(0, baseSal + bonus - totalDeductions);

    // Logo
    var logoHtml = bizLogo
      ? '<img src="'+bizLogo+'" style="height:60px;width:60px;object-fit:contain;border-radius:10px;margin:0 auto 6px;display:block" onerror="this.style.display=\'none\'">'
      : '';

    // Group deduction rows by description for the summary at top
    var creditItems  = deductionRows.filter(function(r){ return r.type!=='deduction'&&r.type!=='other'; });
    var dedItems     = deductionRows.filter(function(r){ return r.type==='deduction'||r.type==='other'; });

    // Credit items grouped
    var creditGroups = {};
    creditItems.forEach(function(r){
      var key = r.desc;
      if (!creditGroups[key]) creditGroups[key]=[];
      creditGroups[key].push(r);
    });

    var creditSummaryHtml = Object.keys(creditGroups).map(function(key){
      return '<div style="margin-bottom:14px">'
        +'<div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px">'+key+'</div>'
        +creditGroups[key].map(function(r,i){
          return '<div style="display:flex;gap:6px;font-size:12px;padding:3px 0;color:#2d3748">'
            +'<span style="color:#718096;min-width:90px">'+r.date+'</span>'
            +(r.detail?'<span style="flex:1;color:#4a5568">'+Utils.esc(r.detail)+'</span>':'<span style="flex:1"></span>')
            +'<span style="font-weight:700;color:#e53e3e;min-width:60px;text-align:right">= '+Utils.cur(r.amount,cur)+'</span>'
            +'</div>';
        }).join('')
        +'</div>';
    }).join('');

    // Pending balance box
    var pendingHtml = '';
    if (pendingBal > 0) {
      var thisMonthDed = rec ? (parseFloat(rec.loanDeduction)||0) : 0;
      var remaining    = Math.max(0, pendingBal);
      pendingHtml = '<div style="margin:14px 0">'
        +'<div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:8px">Pending balance</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
        +'<tr style="border:1px solid #e2e8f0"><td style="padding:8px 10px;color:#4a5568">Pending balance</td><td style="padding:8px 10px;text-align:right;font-weight:600">'+Utils.cur(pendingBal+thisMonthDed,cur)+'</td></tr>'
        +'<tr style="border:1px solid #e2e8f0;background:#f7fafc"><td style="padding:8px 10px;color:#4a5568">This month deduction</td><td style="padding:8px 10px;text-align:right;font-weight:600;color:#e53e3e">'+Utils.cur(thisMonthDed,cur)+'</td></tr>'
        +'<tr style="border:1px solid #e2e8f0"><td style="padding:8px 10px;font-weight:700;color:#1a1a2e">Balance</td><td style="padding:8px 10px;text-align:right;font-weight:700;color:#d97706">'+Utils.cur(remaining,cur)+'</td></tr>'
        +'</table></div>';
    }

    // Full deduction table
    var tableRows = deductionRows.map(function(r,i){
      var rowBg = i%2===1?'background:#f7fafc;':'';
      return '<tr style="'+rowBg+'border-bottom:1px solid #e2e8f0">'
        +'<td style="padding:8px 10px;font-size:12px;color:#4a5568">'+r.date+'</td>'
        +'<td style="padding:8px 10px;font-size:12px;font-weight:600;color:#2d3748">'
        +(r.detail ? r.desc+'<br><span style="font-size:10px;color:#718096;font-weight:400">'+Utils.esc(r.detail)+'</span>' : r.desc)
        +'</td>'
        +'<td style="padding:8px 10px;font-size:12px;font-weight:700;text-align:right;color:#e53e3e">'+Utils.cur(r.amount,cur)+'</td>'
        +'</tr>';
    }).join('');

    var css = '*{margin:0;padding:0;box-sizing:border-box}'
      +'body{font-family:"Segoe UI",Arial,sans-serif;background:#fff;color:#1a202c}'
      +'.page{max-width:560px;margin:0 auto;padding:24px}'
      +'.emp-name{font-size:26px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#1a1a2e;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #1a1a2e}'
      +'.section-label{font-size:13px;font-weight:700;color:#2d3748;margin:14px 0 6px}'
      +'.divider{border:none;border-top:1px dashed #cbd5e0;margin:16px 0}'
      +'.biz-footer{text-align:center;padding:14px 0}'
      +'.biz-name{font-size:16px;font-weight:800;color:#1a1a2e}'
      +'.biz-addr{font-size:11px;color:#718096;margin-top:3px}'
      +'.biz-phone{font-size:12px;color:#3182ce;margin-top:3px;font-weight:600}'
      +'.month-header{text-align:center;padding:14px 0 10px;border-top:1px dashed #cbd5e0}'
      +'.month-title{font-size:15px;font-weight:800;color:#2d3748}'
      +'.sal-line{font-size:13px;color:#718096;margin-top:3px}'
      +'table.ded-table{width:100%;border-collapse:collapse;margin-bottom:14px}'
      +'table.ded-table th{background:#1a1a2e;color:#fff;padding:8px 10px;font-size:11px;font-weight:700;text-align:left;letter-spacing:.04em}'
      +'table.ded-table td{padding:8px 10px}'
      +'.total-row td{background:#edf2f7;font-weight:800;font-size:13px;padding:10px}'
      +'.summary-box{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:14px 0;background:#f9fafb}'
      +'.summary-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px}'
      +'.summary-row:last-child{border:none;padding-top:10px;margin-top:4px}'
      +'.net-amount{font-size:22px;font-weight:900;color:#276749}'
      +'.sig-area{margin-top:30px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center}'
      +'.sig-line{border-bottom:1px solid #1a1a2e;width:200px;margin:0 auto 6px}'
      +'.sig-name{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2d3748}'
      +'.footer-note{font-size:10px;color:#a0aec0;margin-top:10px;text-align:center}'
      +'@media print{@page{size:A4;margin:12mm}body{max-width:100%}.page{padding:0;max-width:100%}}';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      +'<title>'+Utils.esc(e.name)+' — '+payMonthFull+'</title>'
      +'<style>'+css+'</style></head><body>'
      +'<div class="page">'

      // Employee name header
      +'<div class="emp-name">'+Utils.esc(e.name)+'</div>'
      +(e.role?'<div style="font-size:12px;color:#718096;margin-bottom:14px">'+Utils.esc(e.role)+'</div>':'')

      // Credit / Material summary at top (like image)
      +(creditSummaryHtml ? creditSummaryHtml : '')

      // Pending balance table
      +pendingHtml

      // Divider with biz info (like image)
      +'<hr class="divider">'
      +'<div class="biz-footer">'
      +(logoHtml)
      +'<div class="biz-name">'+Utils.esc(bizName)+'</div>'
      +(bizAddr?'<div class="biz-addr">'+Utils.esc(bizAddr)+'</div>':'')
      +(bizPhone?'<div class="biz-phone">'+Utils.esc(bizPhone)+'</div>':'')
      +'</div>'

      // Monthly salary header
      +'<div class="month-header">'
      +'<div class="month-title">Monthly salary for '+payMonthFull+'</div>'
      +'<div class="sal-line">salary = '+Utils.cur(baseSal,cur)+(bonus>0?' + bonus '+Utils.cur(bonus,cur):'')+'</div>'
      +'</div>'

      // Full deduction table (like image)
      +'<table class="ded-table">'
      +'<thead><tr><th>Date</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>'
      +'<tbody>'
      +tableRows
      +'</tbody>'
      +'<tfoot>'
      +'<tr class="total-row"><td colspan="2">Total</td><td style="text-align:right;color:#e53e3e">'+Utils.cur(totalDeductions,cur)+'</td></tr>'
      +'</tfoot>'
      +'</table>'

      // Summary box (Base salary / Deduction / Net)
      +'<div class="summary-box">'
      +'<div class="summary-row"><span>Base Salary</span><span style="font-weight:700">'+Utils.cur(baseSal,cur)+'</span></div>'
      +(bonus>0?'<div class="summary-row"><span>Bonus</span><span style="font-weight:700;color:#276749">+'+Utils.cur(bonus,cur)+'</span></div>':'')
      +'<div class="summary-row"><span>Deduction amount</span><span style="font-weight:700;color:#e53e3e">−'+Utils.cur(totalDeductions,cur)+'</span></div>'
      +(pendingBal>0?'<div class="summary-row"><span>Remaining Credit Balance</span><span style="font-weight:600;color:#d97706">'+Utils.cur(pendingBal,cur)+'</span></div>':'')
      +(notes?'<div class="summary-row"><span>Notes</span><span style="color:#718096">'+Utils.esc(notes)+'</span></div>':'')
      +'<div class="summary-row"><span style="font-size:15px;font-weight:800;color:#1a1a2e">Salary</span><span class="net-amount">'+Utils.cur(netSalary,cur)+'</span></div>'
      +'</div>'

      // Payment method
      +'<div style="font-size:12px;color:#718096;margin-bottom:20px">Payment via: <strong>'+Utils.esc(method)+'</strong> · Ref: <span style="font-family:monospace">'+refCode+'</span></div>'

      // Signature (like image)
      +'<div class="sig-area">'
      +'<div style="font-size:11px;color:#a0aec0;margin-bottom:20px">signature:</div>'
      +'<div class="sig-line"></div>'
      +'<div class="sig-name">'+Utils.esc(e.name)+'</div>'
      +'</div>'

      +'<div class="footer-note">'+Utils.esc(bizName)+' · '+payMonthFull+' · '+refCode+'</div>'
      +'</div>'
      +'</body></html>';

    // Save statement to DB for the monthly folder
    var stmt = {
      id:        refCode,
      empId:     empId,
      empName:   e.name,
      month:     payMonth,
      baseSalary:baseSal,
      totalDeductions: totalDeductions,
      netSalary: netSalary,
      method:    method,
      createdAt: now.toISOString(),
      html:      html,
    };
    try { DB.saveMonthlyStatement(stmt); } catch(ex) {}

    if (!saveOnly) {
      Sales._printHtml(html, 'payslip-frame');
    }
    return stmt;
  },

};
