/* SmartStock Pro — Payroll Page */
const Payroll = {
  async render() {
    const list = await DB.getEmployees();
    const total = list.reduce((a,e)=>a+e.salary,0);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Payroll</h1>
          <p class="page-subtitle">${list.length} employees · May 2024</p></div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm">${Components.icon('download',13)} Report</button>
          <button class="btn btn-primary btn-sm" onclick="Toast.show('Payroll processed','success')">${Components.icon('check',13)} Process All</button>
        </div>
      </div>
      <div class="grid g-4 mb-4">
        ${[
          {label:'Total Payroll',val:Utils.currency(total),           color:'var(--color-gold)'   },
          {label:'Employees',    val:list.length,                      color:'var(--color-info)'   },
          {label:'Pending',      val:list.filter(e=>e.status==='Pending').length,color:'var(--color-warning)'},
          {label:'Paid',         val:list.filter(e=>e.status==='Paid').length,   color:'var(--color-success)'},
        ].map(k=>`<div class="kpi-card animate-in" style="--kpi-color:${k.color};--kpi-bg:${k.color}22">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value" style="color:${k.color};font-size:22px">${k.val}</div></div>`).join('')}
      </div>
      <div class="card animate-in" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Employee</th><th>Role</th><th>Department</th><th>Salary</th><th>Attendance</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${list.map(e=>`<tr>
            <td><span class="font-mono text-gold text-xs">${e.id}</span></td>
            <td style="font-weight:600">${Utils.esc(e.name)}</td>
            <td class="text-sec text-sm">${e.role}</td>
            <td><span class="badge badge-info">${e.dept}</span></td>
            <td class="text-gold font-bold">${Utils.currency(e.salary)}</td>
            <td>${e.attendance}</td>
            <td>${Components.badge(e.status)}</td>
            <td><button class="btn btn-success btn-sm" onclick="Toast.show('${e.name} marked as paid','success')">Pay</button></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  },
};
