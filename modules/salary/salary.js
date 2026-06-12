/* SmartStock Pro V5 — Salary & Payroll Module */
var Salary = {
  activeTab: 'employees',

  render: function() {
    var pg = Utils.get('pg-salary');
    if (!pg) return;
    var emps     = DB.getEmployees();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var month    = Utils.today().slice(0,7);
    var payroll  = DB.getPayroll().filter(function(p){ return p.month === month; });
    var paidIds  = payroll.map(function(p){ return p.employeeId; });
    var active   = emps.filter(function(e){ return e.status === 'active'; });
    var totalBudget = active.reduce(function(a,e){ return a+(parseFloat(e.salary)||0); }, 0);
    var totalPaid   = payroll.reduce(function(a,p){ return a+(parseFloat(p.netPay||p.amount)||0); }, 0);

    var tabs = [['employees','👥 Employees'],['payroll','💰 Payroll'],['loans','🏦 Loans']];

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Salary & Payroll</div><div class="page-sub">' + month + '</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Salary.openAddEmployee()">＋ Employee</button></div>'
      + '</div>'
      + '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">👥</div><div class="kpi-label">Active Staff</div><div class="kpi-value">' + active.length + '</div><div class="kpi-sub">employees</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📋</div><div class="kpi-label">Salary Budget</div><div class="kpi-value">' + Utils.cur(totalBudget,cur) + '</div><div class="kpi-sub">this month</div></div>'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">✅</div><div class="kpi-label">Paid</div><div class="kpi-value">' + paidIds.length + '</div><div class="kpi-sub">' + Utils.cur(totalPaid,cur) + '</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">⏳</div><div class="kpi-label">Pending</div><div class="kpi-value">' + (active.length - paidIds.length) + '</div><div class="kpi-sub">unpaid</div></div>'
      + '</div></div>'
      + '<div class="chips">' + tabs.map(function(t){ return '<div class="chip' + (Salary.activeTab===t[0]?' active':'') + '" onclick="Salary.setTab(\'' + t[0] + '\')">' + t[1] + '</div>'; }).join('') + '</div>'
      + '<div id="sal-body"></div>';

    Salary._renderTab();
  },

  setTab: function(t) { Salary.activeTab = t; Salary.render(); },

  _renderTab: function() {
    var el = Utils.get('sal-body'); if (!el) return;
    if (Salary.activeTab === 'employees') Salary._renderEmployees(el);
    else if (Salary.activeTab === 'payroll')   Salary._renderPayroll(el);
    else if (Salary.activeTab === 'loans')     Salary._renderLoans(el);
  },

  /* ══════════════════════════════════════════════════════════════
     EMPLOYEES TAB
  ══════════════════════════════════════════════════════════════ */
  _renderEmployees: function(el) {
    var emps = DB.getEmployees();
    var cur  = DB.getSettings().currency || '$';
    if (!emps.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">👥</div><div class="empty-title">No employees yet</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="Salary.openAddEmployee()">＋ Add Employee</button></div></div>';
      return;
    }
    el.innerHTML = '<div class="sec"><div class="card">'
      + emps.map(function(e) {
          var loans = (DB.get('employeeLoans')||[]).filter(function(l){ return l.employeeId===e.id && l.status==='active'; });
          var loanBal = loans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); }, 0);
          return '<div class="list-item">'
            + '<div class="list-icon" style="background:var(--inb);font-size:18px">👤</div>'
            + '<div class="list-info">'
            + '<div class="list-name">' + Utils.esc(e.name) + (e.status!=='active'?' <span style="font-size:9px;background:var(--erb);color:var(--er);padding:2px 6px;border-radius:99px">INACTIVE</span>':'') + '</div>'
            + '<div class="list-meta">' + Utils.esc(e.role||'Employee') + ' · ' + Utils.esc(e.phone||'') + '</div>'
            + (loanBal>0 ? '<div class="list-meta" style="color:var(--wa)">🏦 Loan balance: ' + Utils.cur(loanBal,cur) + '</div>' : '')
            + '</div>'
            + '<div class="list-right">'
            + '<div class="list-val">' + Utils.cur(e.salary||0,cur) + '</div>'
            + '<div style="font-size:10px;color:var(--t3)">/ month</div>'
            + '<div class="list-actions">'
            + '<button class="btn-ghost btn-sm" onclick="Salary.openEditEmployee(\'' + e.id + '\')">✏️</button>'
            + '<button class="btn-ok btn-sm" onclick="Salary.openPayEmployee(\'' + e.id + '\')">💰 Pay</button>'
            + '</div></div></div>';
        }).join('')
      + '</div></div>';
  },

  openAddEmployee: function() {
    Modal.open({
      title: '+ Add Employee', barColor: 'var(--in)',
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
          + '<div class="fg"><label class="fl">Start Date</label><input class="fi" id="emp-start" type="date" value="' + Utils.today() + '"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Notes</label><input class="fi" id="emp-notes" placeholder="Any notes..."></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.saveEmployee()">✓ Save Employee</button>',
    });
  },

  saveEmployee: function() {
    var name = Utils.val('emp-name').trim();
    var sal  = parseFloat(Utils.val('emp-sal'))||0;
    if (!name) { Toast.show('Name required','err'); return; }
    if (!sal)  { Toast.show('Salary required','err'); return; }
    var emp = {
      id: Utils.uid('EMP'), name: name,
      role:  Utils.val('emp-role'),
      salary: sal,
      phone:  Utils.val('emp-phone'),
      bank:   Utils.val('emp-bank'),
      startDate: Utils.val('emp-start') || Utils.today(),
      notes:  Utils.val('emp-notes'),
      status: 'active',
      createdAt: Utils.today(),
    };
    DB.addEmployee(emp);
    Toast.show(name + ' added ✓','ok');
    Modal.close();
    Salary.render();
  },

  openEditEmployee: function(id) {
    var e = DB.getEmployees().find(function(x){ return x.id===id; }); if(!e) return;
    Modal.open({
      title: 'Edit Employee', sub: Utils.esc(e.name), barColor: 'var(--in)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Full Name</label><input class="fi" id="ee-name" value="' + Utils.esc(e.name) + '"></div>'
          + '<div class="fg"><label class="fl">Role</label><input class="fi" id="ee-role" value="' + Utils.esc(e.role||'') + '"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Monthly Salary</label><input class="fi" id="ee-sal" type="number" value="' + (e.salary||0) + '"></div>'
          + '<div class="fg"><label class="fl">Phone</label><input class="fi" id="ee-phone" value="' + Utils.esc(e.phone||'') + '"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Bank / MoMo No.</label><input class="fi" id="ee-bank" value="' + Utils.esc(e.bank||'') + '"></div>'
          + '<div class="fg"><label class="fl">Status</label><select class="fi" id="ee-status"><option' + (e.status==='active'?' selected':'') + '>active</option><option' + (e.status==='inactive'?' selected':'') + '>inactive</option></select></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.updateEmployee(\'' + id + '\')">💾 Save</button>',
    });
  },

  updateEmployee: function(id) {
    var emps = DB.getEmployees();
    var idx  = emps.findIndex(function(x){ return x.id===id; }); if(idx<0) return;
    emps[idx] = Object.assign({}, emps[idx], {
      name:   Utils.val('ee-name')  || emps[idx].name,
      role:   Utils.val('ee-role'),
      salary: parseFloat(Utils.val('ee-sal'))||emps[idx].salary,
      phone:  Utils.val('ee-phone'),
      bank:   Utils.val('ee-bank'),
      status: (Utils.get('ee-status')||{value:'active'}).value,
    });
    DB.set('employees', emps);
    Toast.show('Updated ✓','ok'); Modal.close(); Salary.render();
  },

  /* ══════════════════════════════════════════════════════════════
     PAY EMPLOYEE
  ══════════════════════════════════════════════════════════════ */
  openPayEmployee: function(id) {
    var e      = DB.getEmployees().find(function(x){ return x.id===id; }); if(!e) return;
    var cur    = DB.getSettings().currency || '$';
    var month  = Utils.today().slice(0,7);
    var loans  = (DB.get('employeeLoans')||[]).filter(function(l){ return l.employeeId===id && l.status==='active'; });
    var loanBal= loans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); }, 0);
    var ytd    = (DB.getPayroll()||[]).filter(function(p){ return p.employeeId===id && p.month.startsWith(Utils.today().slice(0,4)); }).reduce(function(a,p){ return a+(parseFloat(p.netPay||p.amount)||0); }, 0);

    var loanHtml = loans.length
      ? loans.map(function(l,i){
          return '<div style="background:var(--wab);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:12px">'
            + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t1);font-weight:600">' + Utils.esc(l.description||'Loan') + '</span>'
            + '<span style="color:var(--wa);font-weight:700">Balance: ' + Utils.cur(l.balance,cur) + '</span></div>'
            + '<div style="margin-top:4px;display:flex;align-items:center;gap:8px">'
            + '<label style="font-size:11px;color:var(--t2)">Deduct this month:</label>'
            + '<input type="number" id="loan-ded-' + l.id + '" placeholder="0" min="0" max="' + l.balance + '"'
            + ' style="width:100px;background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:5px 8px;font-size:13px;font-weight:700;color:var(--er)">'
            + '</div></div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--t3)">No active loans</div>';

    Modal.open({
      title: 'Pay Salary', sub: Utils.esc(e.name) + ' · ' + month, barColor: 'var(--ok)',
      body: '<div style="background:var(--bg3);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
          + '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span style="color:var(--t2)">Base Salary</span><span style="font-weight:700;color:var(--g)">' + Utils.cur(e.salary||0,cur) + '</span></div>'
          + '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span style="color:var(--t2)">Loan Balance</span><span style="font-weight:700;color:var(--wa)">' + Utils.cur(loanBal,cur) + '</span></div>'
          + '<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--t2)">YTD Paid (this year)</span><span style="font-weight:700">' + Utils.cur(ytd,cur) + '</span></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Base Salary</label><input class="fi" id="pay-base" type="number" value="' + (e.salary||0) + '" oninput="Salary.calcNetPay()"></div>'
          + '<div class="fg"><label class="fl">Bonus / Allowance</label><input class="fi" id="pay-bonus" type="number" placeholder="0" oninput="Salary.calcNetPay()"></div>'
          + '<div class="fg"><label class="fl">Manual Deduction (Tax, NASSIT, etc.)</label><input class="fi" id="pay-ded" type="number" placeholder="0" oninput="Salary.calcNetPay()"></div>'
          + '<div style="font-size:11px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.1em;margin:12px 0 8px">🏦 Loan Deductions This Month</div>'
          + loanHtml
          + '<div style="background:var(--okb);border:1.5px solid var(--okbd);border-radius:var(--r12);padding:14px;margin-top:14px">'
          + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<span style="font-size:14px;font-weight:800;color:var(--t1)">NET PAY</span>'
          + '<span id="net-pay-display" style="font-size:22px;font-weight:900;color:var(--ok);font-family:var(--fm)">' + Utils.cur(e.salary||0,cur) + '</span>'
          + '</div></div>'
          + '<div class="fg" style="margin-top:14px"><label class="fl">Payment Method</label>'
          + '<select class="fi" id="pay-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div>'
          + '<div class="fg"><label class="fl">Notes</label><input class="fi" id="pay-notes" placeholder="Any notes for this paycheck..."></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-ghost btn-sm" onclick="Salary.printPayslip(\'' + id + '\')" style="color:var(--in)">🖨 Preview Payslip</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.processPay(\'' + id + '\')">✅ Process Pay</button>',
    });

    Salary._currentLoans = loans;
    setTimeout(function(){ Salary.calcNetPay(); }, 100);
  },

  _currentLoans: [],

  calcNetPay: function() {
    var base  = parseFloat(Utils.val('pay-base'))||0;
    var bonus = parseFloat(Utils.val('pay-bonus'))||0;
    var ded   = parseFloat(Utils.val('pay-ded'))||0;
    var loanDed = 0;
    Salary._currentLoans.forEach(function(l){
      var inp = Utils.get('loan-ded-' + l.id);
      loanDed += inp && inp.value.trim() ? (parseFloat(inp.value)||0) : 0;
    });
    var net = base + bonus - ded - loanDed;
    var cur = DB.getSettings().currency || '$';
    var el  = Utils.get('net-pay-display');
    if (el) el.textContent = Utils.cur(Math.max(0,net),cur);
  },

  processPay: function(id) {
    var e    = DB.getEmployees().find(function(x){ return x.id===id; }); if(!e) return;
    var cur  = DB.getSettings().currency||'$';
    var month= Utils.today().slice(0,7);
    var base = parseFloat(Utils.val('pay-base'))||0;
    var bonus= parseFloat(Utils.val('pay-bonus'))||0;
    var ded  = parseFloat(Utils.val('pay-ded'))||0;
    var loanDed = 0;
    var loanDeductions = [];

    Salary._currentLoans.forEach(function(l){
      var inp = Utils.get('loan-ded-' + l.id);
      var amt = inp && inp.value.trim() ? (parseFloat(inp.value)||0) : 0;
      if (amt > 0) {
        loanDed += amt;
        loanDeductions.push({ loanId: l.id, amount: amt });
      }
    });

    var netPay = Math.max(0, base + bonus - ded - loanDed);
    var method = (Utils.get('pay-method')||{value:'Cash'}).value;
    var notes  = Utils.val('pay-notes');

    // Save payroll record
    var record = {
      id: Utils.uid('PAY'), employeeId: id, month: month,
      baseSalary: base, bonus: bonus, deduction: ded,
      loanDeduction: loanDed, loanDeductions: loanDeductions,
      netPay: netPay, amount: netPay,
      method: method, notes: notes,
      paidAt: new Date().toISOString(), date: Utils.today(),
    };
    DB.addPayroll(record);

    // Update loan balances
    if (loanDeductions.length) {
      var loans = DB.get('employeeLoans') || [];
      loanDeductions.forEach(function(ld){
        var li = loans.findIndex(function(l){ return l.id===ld.loanId; });
        if (li >= 0) {
          loans[li].balance = Math.max(0, (parseFloat(loans[li].balance)||0) - ld.amount);
          loans[li].paid    = (parseFloat(loans[li].paid)||0) + ld.amount;
          if (loans[li].balance <= 0) loans[li].status = 'paid';
        }
      });
      DB.set('employeeLoans', loans);
    }

    Toast.show(e.name + ' paid ' + Utils.cur(netPay,cur) + ' ✓','ok');
    Modal.close();
    // Print payslip
    setTimeout(function(){ Salary.printPayslip(id, record); }, 400);
    Salary.render();
  },

  /* ══════════════════════════════════════════════════════════════
     PAYROLL TAB
  ══════════════════════════════════════════════════════════════ */
  _renderPayroll: function(el) {
    var month   = Utils.today().slice(0,7);
    var payroll = DB.getPayroll().filter(function(p){ return p.month===month; });
    var emps    = DB.getEmployees();
    var cur     = DB.getSettings().currency || '$';
    if (!payroll.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">💰</div><div class="empty-title">No payroll this month</div><div class="empty-sub">Go to Employees tab and tap 💰 Pay</div></div>';
      return;
    }
    el.innerHTML = '<div class="sec"><div class="card">'
      + payroll.map(function(p){
          var emp = emps.find(function(e){ return e.id===p.employeeId; });
          return '<div class="list-item" onclick="Salary.printPayslip(\'' + p.employeeId + '\',\'' + p.id + '\')">'
            + '<div class="list-icon" style="background:var(--okb)">💰</div>'
            + '<div class="list-info">'
            + '<div class="list-name">' + Utils.esc(emp?emp.name:'Unknown') + '</div>'
            + '<div class="list-meta">' + Utils.esc(p.method||'Cash') + ' · ' + Utils.date(p.date) + '</div>'
            + (p.loanDeduction>0 ? '<div class="list-meta" style="color:var(--wa)">Loan deducted: ' + Utils.cur(p.loanDeduction,cur) + '</div>' : '')
            + '</div>'
            + '<div class="list-right">'
            + '<div class="list-val">' + Utils.cur(p.netPay||p.amount,cur) + '</div>'
            + '<span class="badge badge-ok">PAID</span>'
            + '<div class="list-actions"><button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Salary.printPayslip(\'' + p.employeeId + '\',\'' + p.id + '\')">🖨</button></div>'
            + '</div></div>';
        }).join('')
      + '</div></div>';
  },

  /* ══════════════════════════════════════════════════════════════
     LOANS TAB
  ══════════════════════════════════════════════════════════════ */
  _renderLoans: function(el) {
    var loans= DB.get('employeeLoans') || [];
    var emps = DB.getEmployees();
    var cur  = DB.getSettings().currency || '$';

    var totalActive  = loans.filter(function(l){ return l.status==='active'; }).reduce(function(a,l){ return a+(parseFloat(l.balance)||0); }, 0);

    el.innerHTML = '<div class="sec">'
      + '<div style="padding:0 0 12px;display:flex;justify-content:space-between;align-items:center">'
      + '<div style="font-size:13px;color:var(--t2)">Outstanding: <strong style="color:var(--wa)">' + Utils.cur(totalActive,cur) + '</strong></div>'
      + '<button class="btn-primary btn-sm" onclick="Salary.openAddLoan()">＋ Add Loan</button>'
      + '</div>'
      + (loans.length ? '<div class="card">'
        + loans.map(function(l){
            var emp = emps.find(function(e){ return e.id===l.employeeId; });
            var isPaid = l.status === 'paid';
            return '<div class="list-item">'
              + '<div class="list-icon" style="background:' + (isPaid?'var(--okb)':'var(--wab)') + '">' + (isPaid?'✅':'🏦') + '</div>'
              + '<div class="list-info">'
              + '<div class="list-name">' + Utils.esc(emp?emp.name:'Unknown') + '</div>'
              + '<div class="list-meta">' + Utils.esc(l.description||'Loan') + ' · ' + Utils.date(l.date) + '</div>'
              + '<div class="list-meta">Original: ' + Utils.cur(l.amount,cur) + ' · Paid: ' + Utils.cur(l.paid||0,cur) + '</div>'
              + '</div>'
              + '<div class="list-right">'
              + '<div class="list-val" style="color:' + (isPaid?'var(--ok)':'var(--wa)') + '">' + Utils.cur(l.balance||0,cur) + '</div>'
              + '<span class="badge ' + (isPaid?'badge-ok':'badge-warn') + '">' + (isPaid?'PAID':'ACTIVE') + '</span>'
              + '</div></div>';
          }).join('')
        + '</div>'
      : '<div class="empty"><div class="empty-icon">🏦</div><div class="empty-title">No loans recorded</div></div>')
      + '</div>';
  },

  openAddLoan: function() {
    var emps    = DB.getEmployees().filter(function(e){ return e.status==='active'; });
    var empOpts = emps.map(function(e){ return '<option value="' + e.id + '">' + Utils.esc(e.name) + '</option>'; }).join('');
    Modal.open({
      title: '+ Add Loan / Advance', barColor: 'var(--wa)',
      body: '<div class="fg"><label class="fl">Employee *</label><select class="fi" id="ln-emp">' + empOpts + '</select></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Type</label><select class="fi" id="ln-type"><option value="Loan">Loan</option><option value="Advance">Salary Advance</option><option value="Credit">Store Credit</option></select></div>'
          + '<div class="fg"><label class="fl">Amount *</label><input class="fi" id="ln-amt" type="number" placeholder="0.00"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Description / Reason</label><input class="fi" id="ln-desc" placeholder="e.g. Emergency medical loan"></div>'
          + '<div class="fg"><label class="fl">Date</label><input class="fi" id="ln-date" type="date" value="' + Utils.today() + '"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Salary.saveLoan()">✓ Save Loan</button>',
    });
  },

  saveLoan: function() {
    var empId = (Utils.get('ln-emp')||{value:''}).value;
    var amt   = parseFloat(Utils.val('ln-amt'))||0;
    var type  = (Utils.get('ln-type')||{value:'Loan'}).value;
    if (!empId) { Toast.show('Select employee','err'); return; }
    if (!amt)   { Toast.show('Enter amount','err'); return; }
    var loan = {
      id: Utils.uid('LN'), employeeId: empId,
      type: type, amount: amt, balance: amt, paid: 0,
      description: Utils.val('ln-desc') || type,
      date: Utils.val('ln-date') || Utils.today(),
      status: 'active', createdAt: Utils.today(),
    };
    var loans = DB.get('employeeLoans') || [];
    loans.unshift(loan);
    DB.set('employeeLoans', loans);
    Toast.show(type + ' of ' + Utils.cur(amt, DB.getSettings().currency||'$') + ' recorded ✓','ok');
    Modal.close();
    Salary.render();
  },

  /* ══════════════════════════════════════════════════════════════
     PROFESSIONAL PAYSLIP PRINT
  ══════════════════════════════════════════════════════════════ */
  printPayslip: function(empId, recordOrId) {
    var e    = DB.getEmployees().find(function(x){ return x.id===empId; }); if(!e) return;
    var settings = DB.getSettings();
    var cur  = settings.currency || '$';
    var bizName = settings.bizName  || 'SmartStock Pro';
    var bizAddr = settings.bizAddress|| '';
    var bizPhone= settings.bizPhone  || '';
    var bizEmail= settings.bizEmail  || '';
    var bizLogo = settings.bizLogo   || '';
    var month   = Utils.today().slice(0,7);

    // Get payroll record
    var rec = null;
    if (recordOrId && typeof recordOrId === 'object') {
      rec = recordOrId;
    } else if (recordOrId) {
      rec = (DB.getPayroll()||[]).find(function(p){ return p.id===recordOrId; });
    }
    if (!rec) {
      // Get latest record for this employee this month
      var recs = (DB.getPayroll()||[]).filter(function(p){ return p.employeeId===empId && p.month===month; });
      rec = recs[recs.length-1] || null;
    }

    // Data
    var base   = rec ? (parseFloat(rec.baseSalary)||0) : (parseFloat(e.salary)||0);
    var bonus  = rec ? (parseFloat(rec.bonus)||0) : 0;
    var ded    = rec ? (parseFloat(rec.deduction)||0) : 0;
    var loanD  = rec ? (parseFloat(rec.loanDeduction)||0) : 0;
    var netPay = rec ? (parseFloat(rec.netPay||rec.amount)||0) : base;
    var method = rec ? (rec.method||'Cash') : 'Cash';
    var notes  = rec ? (rec.notes||'') : '';
    var paidDate = rec ? Utils.date(rec.date) : Utils.today();
    var payMonth = rec ? (rec.month||month) : month;

    // YTD — all payments this year
    var ytdPayments = (DB.getPayroll()||[]).filter(function(p){
      return p.employeeId===empId && p.month.startsWith(Utils.today().slice(0,4));
    });
    var ytdGross = ytdPayments.reduce(function(a,p){ return a+(parseFloat(p.baseSalary)||parseFloat(p.amount)||0); }, 0);
    var ytdNet   = ytdPayments.reduce(function(a,p){ return a+(parseFloat(p.netPay||p.amount)||0); }, 0);

    // Loan balance
    var loans   = (DB.get('employeeLoans')||[]).filter(function(l){ return l.employeeId===empId && l.status==='active'; });
    var loanBal = loans.reduce(function(a,l){ return a+(parseFloat(l.balance)||0); }, 0);

    // Start date → months worked
    var startDate = e.startDate || e.createdAt || Utils.today();
    var monthsWorked = Math.max(1, Math.round((new Date() - new Date(startDate)) / (30.44 * 24 * 3600 * 1000)));

    // Simple QR code using text (date+employee+amount) as a data URI SVG
    var qrText = 'PAY-' + empId.slice(-6) + '-' + payMonth + '-' + netPay.toFixed(0);

    var logoHtml = bizLogo
      ? '<img src="' + bizLogo + '" style="width:70px;height:70px;object-fit:contain;border-radius:10px" onerror="this.style.display=\'none\'">'
      : '<div style="width:70px;height:70px;background:#f0f0f0;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px">📦</div>';

    var css = '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff}'
      + '.page{max-width:210mm;margin:0 auto;padding:12mm}'
      + '.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #111;margin-bottom:16px}'
      + '.biz{font-size:21px;font-weight:900;letter-spacing:-.02em;margin-bottom:3px}'
      + '.meta{font-size:10px;color:#555;margin-top:2px;line-height:1.5}'
      + '.slip-title{font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#555;text-align:right}'
      + '.slip-num{font-size:20px;font-weight:900;color:#111;text-align:right;margin-top:4px}'
      + '.section{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}'
      + '.box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px}'
      + '.box-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;margin-bottom:8px}'
      + '.box-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid #f0f0f0}'
      + '.box-row:last-child{border:none}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:12px}'
      + 'th{background:#111;color:#fff;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;text-align:left}'
      + 'td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px}'
      + '.tr{background:#f9fafb}'
      + '.net-box{background:#111;color:#fff;border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center;margin:14px 0}'
      + '.ytd{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}'
      + '.ytd-cell{text-align:center;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px}'
      + '.sig-row{display:flex;gap:20px;margin-top:24px}'
      + '.sig{flex:1;border-top:1px solid #333;padding-top:6px;font-size:10px;color:#555}'
      + '.footer{text-align:center;font-size:10px;color:#888;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px}'
      + '.conf{display:flex;justify-content:space-between;align-items:center;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:14px}'
      + '@media print{@page{size:A4;margin:10mm}.page{padding:0}}';

    var payMonthFull = new Date(payMonth + '-01').toLocaleDateString('en-US',{year:'numeric',month:'long'});

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<title>Payslip — ' + Utils.esc(e.name) + '</title><style>' + css + '</style></head><body>'
      + '<div class="page">'

      // Header
      + '<div class="hdr">'
      + '<div style="display:flex;gap:14px;align-items:flex-start">' + logoHtml
      + '<div><div class="biz">' + Utils.esc(bizName) + '</div>'
      + (bizAddr  ? '<div class="meta">📍 ' + Utils.esc(bizAddr)  + '</div>' : '')
      + (bizPhone ? '<div class="meta">📞 ' + Utils.esc(bizPhone) + '</div>' : '')
      + (bizEmail ? '<div class="meta">✉️ ' + Utils.esc(bizEmail) + '</div>' : '')
      + '</div></div>'
      + '<div><div class="slip-title">Pay Slip</div>'
      + '<div class="slip-num">' + Utils.esc(qrText) + '</div>'
      + '<div class="meta" style="text-align:right;margin-top:6px">Pay Period: <strong>' + payMonthFull + '</strong></div>'
      + '<div class="meta" style="text-align:right">Paid: ' + paidDate + '</div>'
      + '</div></div>'

      // Employee + Payment info
      + '<div class="section">'
      + '<div class="box"><div class="box-title">👤 Employee Details</div>'
      + '<div class="box-row"><span>Name</span><span style="font-weight:700">' + Utils.esc(e.name) + '</span></div>'
      + '<div class="box-row"><span>Position</span><span>' + Utils.esc(e.role||'Employee') + '</span></div>'
      + '<div class="box-row"><span>Employee ID</span><span style="font-family:monospace">' + e.id.slice(-8) + '</span></div>'
      + (e.bank ? '<div class="box-row"><span>Bank / MoMo</span><span>' + Utils.esc(e.bank) + '</span></div>' : '')
      + '<div class="box-row"><span>Months Worked</span><span>' + monthsWorked + ' months</span></div>'
      + '</div>'
      + '<div class="box"><div class="box-title">💳 Payment Details</div>'
      + '<div class="box-row"><span>Pay Period</span><span style="font-weight:700">' + payMonthFull + '</span></div>'
      + '<div class="box-row"><span>Payment Date</span><span>' + paidDate + '</span></div>'
      + '<div class="box-row"><span>Method</span><span>' + Utils.esc(method) + '</span></div>'
      + (loanBal>0 ? '<div class="box-row"><span>Loan Balance</span><span style="color:#d97706;font-weight:700">' + Utils.cur(loanBal,cur) + '</span></div>' : '')
      + (notes ? '<div class="box-row"><span>Notes</span><span>' + Utils.esc(notes) + '</span></div>' : '')
      + '</div></div>'

      // Earnings table
      + '<table><thead><tr><th style="width:50%">Earnings</th><th style="text-align:right">Amount</th><th style="text-align:right"></th></tr></thead><tbody>'
      + '<tr><td>Basic Salary</td><td style="text-align:right">' + Utils.cur(base,cur) + '</td><td></td></tr>'
      + (bonus>0 ? '<tr class="tr"><td>Bonus / Allowance</td><td style="text-align:right;color:#16a34a">' + Utils.cur(bonus,cur) + '</td><td></td></tr>' : '')
      + '<tr style="background:#d1fae5"><td style="font-weight:700">GROSS PAY</td><td style="text-align:right;font-weight:800;color:#065f46">' + Utils.cur(base+bonus,cur) + '</td><td></td></tr>'
      + '</tbody></table>'

      // Deductions table
      + '<table><thead><tr><th style="width:50%">Deductions</th><th style="text-align:right">Amount</th><th style="text-align:right"></th></tr></thead><tbody>'
      + (ded>0 ? '<tr><td>Tax / NASSIT / Other</td><td style="text-align:right;color:#dc2626">' + Utils.cur(ded,cur) + '</td><td></td></tr>' : '<tr><td style="color:#9ca3af">No tax/statutory deductions</td><td style="text-align:right;color:#9ca3af">—</td><td></td></tr>')
      + (loanD>0 ? '<tr class="tr"><td>Loan Repayment (this month)</td><td style="text-align:right;color:#dc2626">' + Utils.cur(loanD,cur) + '</td><td></td></tr>' : '')
      + '<tr style="background:#fee2e2"><td style="font-weight:700">TOTAL DEDUCTIONS</td><td style="text-align:right;font-weight:800;color:#991b1b">' + Utils.cur(ded+loanD,cur) + '</td><td></td></tr>'
      + '</tbody></table>'

      // Net Pay box
      + '<div class="net-box">'
      + '<div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af">Net Pay (Take Home)</div>'
      + '<div style="font-size:11px;color:#6b7280;margin-top:2px">' + payMonthFull + ' · ' + Utils.esc(method) + '</div>'
      + '</div>'
      + '<div style="font-size:28px;font-weight:900;color:#fff">' + Utils.cur(netPay,cur) + '</div>'
      + '</div>'

      // YTD Summary
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:8px">Year to Date Summary (' + Utils.today().slice(0,4) + ')</div>'
      + '<div class="ytd">'
      + '<div class="ytd-cell"><div style="font-size:10px;color:#6b7280;margin-bottom:4px">YTD Gross</div><div style="font-size:15px;font-weight:700">' + Utils.cur(ytdGross,cur) + '</div></div>'
      + '<div class="ytd-cell"><div style="font-size:10px;color:#6b7280;margin-bottom:4px">YTD Net Pay</div><div style="font-size:15px;font-weight:700;color:#16a34a">' + Utils.cur(ytdNet,cur) + '</div></div>'
      + '<div class="ytd-cell"><div style="font-size:10px;color:#6b7280;margin-bottom:4px">Loan Balance</div><div style="font-size:15px;font-weight:700;color:' + (loanBal>0?'#d97706':'#16a34a') + '">' + Utils.cur(loanBal,cur) + '</div></div>'
      + '</div>'

      // Confidentiality
      + '<div class="conf">'
      + '<span style="font-size:11px;color:#6b7280">🔒 CONFIDENTIAL — This payslip contains sensitive employee information.</span>'
      + '<span style="font-size:10px;font-family:monospace;color:#9ca3af">' + Utils.esc(qrText) + '</span>'
      + '</div>'

      // Signatures
      + '<div class="sig-row">'
      + '<div class="sig">Employee Signature: _______________________ &nbsp;&nbsp; Date: ___________</div>'
      + '<div class="sig">Authorised by: _______________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: ___________</div>'
      + '</div>'

      + '<div class="footer">' + Utils.esc(bizName) + ' &nbsp;|&nbsp; ' + payMonthFull + ' Payslip &nbsp;|&nbsp; Powered by SmartStock Pro</div>'
      + '</div></body></html>';

    Sales._printHtml(html, 'payslip-frame');
  },
};
