'use strict';
const Salary = {
  render() {
    const pg = Utils.get('pg-salary');
    if (!pg) return;
    const emps = DB.getEmployees();
    const settings = DB.getSettings();
    const cur = settings.currency||'$';
    const month = Utils.today().slice(0,7);
    const payroll = DB.getPayroll().filter(p=>p.month===month);
    const paidIds = payroll.map(p=>p.employeeId);
    const totalPayroll = emps.filter(e=>e.status==='active').reduce((a,e)=>a+(parseFloat(e.salary)||0),0);
    const paidAmt = payroll.reduce((a,p)=>a+(parseFloat(p.amount)||0),0);
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Salary</div>
          <div class="page-sub">${emps.length} employees</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Salary.openAddEmp()">+ Add Staff</button>
        </div>
      </div>
      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--gold);--kibg:var(--goldbg)">
            <div class="kpi-icon">💰</div><div class="kpi-label">Monthly Payroll</div>
            <div class="kpi-value">${Utils.cur(totalPayroll,cur)}</div>
          </div>
          <div class="kpi" style="--kc:var(--ok);--kibg:var(--okbg)">
            <div class="kpi-icon">✅</div><div class="kpi-label">Paid This Month</div>
            <div class="kpi-value">${Utils.cur(paidAmt,cur)}</div>
            <div class="kpi-sub">${paidIds.length} of ${emps.length}</div>
          </div>
        </div>
        <div class="sec-title">Staff Members</div>
        ${emps.length ? `<div class="card">${emps.map(e=>{
          const paid = paidIds.includes(e.id);
          return `<div class="sal-row">
            <div>
              <div class="sal-name">${Utils.esc(e.name)}</div>
              <div class="sal-role">${Utils.esc(e.role||'—')} · ${Utils.esc(e.dept||'—')}</div>
            </div>
            <div style="text-align:right">
              <div class="sal-amount">${Utils.cur(e.salary||0,cur)}</div>
              <div style="margin-top:4px;display:flex;gap:6px;justify-content:flex-end">
                ${Utils.statusBadge(paid?'Paid':'Pending')}
                ${!paid?`<button class="btn-ok btn-sm" onclick="Salary.pay('${e.id}')">Pay</button>`:''}
                <button class="btn-danger btn-sm btn-icon" onclick="Salary.delEmp('${e.id}','${Utils.esc(e.name)}')">🗑</button>
              </div>
            </div>
          </div>`;}).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">👔</div><div class="empty-title">No employees yet</div><div class="empty-sub">Add your staff members</div></div>'}
      </div>`;
  },
  openAddEmp() {
    Modal.open({ title:'Add Employee', barColor:'var(--gold)',
      body:`
        <div class="form-row">
          <div class="fg"><label class="fl">Full Name *</label><input class="fi" id="em-name" placeholder="Employee name"></div>
          <div class="fg"><label class="fl">Role</label><input class="fi" id="em-role" placeholder="e.g. Sales Manager"></div>
        </div>
        <div class="form-row">
          <div class="fg"><label class="fl">Department</label><input class="fi" id="em-dept" placeholder="e.g. Sales"></div>
          <div class="fg"><label class="fl">Monthly Salary *</label><input class="fi" id="em-sal" type="number" step="0.01" placeholder="0.00"></div>
        </div>
        <div class="fg"><label class="fl">Phone</label><input class="fi" id="em-phone" type="tel"></div>`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Salary.saveEmp()">💾 Save</button>` });
  },
  saveEmp() {
    const name = Utils.val('em-name'); const sal = parseFloat(Utils.val('em-sal')||0);
    if (!name) { Toast.show('Name is required','err'); return; }
    DB.addEmployee({ name, role:Utils.val('em-role'), dept:Utils.val('em-dept'), salary:sal, phone:Utils.val('em-phone'), status:'active' });
    Toast.show('Employee added ✓','ok'); Modal.close(); this.render();
  },
  pay(id) {
    const e = DB.getEmployees().find(x=>x.id===id);
    if (!e) return;
    DB.addPayroll({ employeeId:id, employeeName:e.name, amount:e.salary, month:Utils.today().slice(0,7) });
    Toast.show(`${e.name} — salary paid ✓`,'ok');
    this.render();
  },
  delEmp(id, name) { confirmDel(`Remove "${name}" from staff?`, ()=>{ DB.deleteEmployee(id); Toast.show('Removed','warn'); this.render(); }); },
};
