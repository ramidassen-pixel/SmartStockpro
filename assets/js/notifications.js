var Notifs = {
  check() {
    const list = [];
    const stats = DB.stats();
    stats.lowStock.forEach(p => list.push({ type:'warn', title:`Low stock: ${p.name}`, body:`Only ${p.qty} left`, time: Utils.today() }));
    stats.outStock.forEach(p => list.push({ type:'err', title:`Out of stock: ${p.name}`, body:'Reorder needed', time: Utils.today() }));
    // Salary due
    const emps = DB.getEmployees();
    const paid = DB.getPayroll().filter(p=>p.month===Utils.today().slice(0,7)).map(p=>p.employeeId);
    const unpaid = emps.filter(e=>!paid.includes(e.id)&&e.status==='active');
    if (unpaid.length > 0) list.push({ type:'info', title:`${unpaid.length} salary payment(s) due`, body:'This month', time:Utils.today() });
    const badge = Utils.get('notif-badge');
    if (badge) {
      if (list.length > 0) { badge.classList.remove('hidden'); badge.textContent = list.length > 9 ? '9+' : list.length; }
      else badge.classList.add('hidden');
    }
    Utils.set('notif-list', list.length > 0 ? list.map(n => `
      <div class="notif-item">
        <div class="notif-item-title">${Utils.esc(n.title)}</div>
        <div style="font-size:12px;color:var(--text2)">${Utils.esc(n.body||'')}</div>
        <div class="notif-item-time">${n.time}</div>
      </div>`).join('') : '<div class="notif-empty">All caught up! 🎉</div>');
    return list;
  },
};