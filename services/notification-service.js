/* SmartStock Pro — Notification Service */
const Notifications = {
  items: [],
  dropdownOpen: false,

  init() {
    // Build initial notifications from stock alerts + overdue
    this.items = [
      ...MockData.inventory.filter(p=>p.status!=='In Stock').map(p=>({
        id:Utils.uid('N'), type:'stock', text:`${p.status}: ${p.name}`, time:'Just now', icon:'⚠️', read:false,
      })),
      ...MockData.sales.filter(s=>s.status==='Overdue').map(s=>({
        id:Utils.uid('N'), type:'payment', text:`Overdue: ${s.customer} — ${Utils.currency(s.total)}`, time:'1 day ago', icon:'💳', read:false,
      })),
    ];
    this.updateDot();
  },

  updateDot() {
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = this.items.some(n=>!n.read) ? 'block' : 'none';
  },

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
    const existing = document.getElementById('notif-dropdown');
    if (existing) { existing.remove(); this.dropdownOpen=false; return; }
    const html = `<div class="notif-dropdown" id="notif-dropdown">
      <div class="notif-header">
        <span class="font-display" style="font-size:13px;font-weight:600">Notifications</span>
        <button class="btn btn-icon btn-ghost btn-sm" onclick="Notifications.toggleDropdown()">✕</button>
      </div>
      ${this.items.slice(0,6).map(n=>`
        <div class="notif-item">
          <span style="font-size:16px;flex-shrink:0">${n.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px" class="truncate">${n.text}</div>
            <div class="text-xs text-sec">${n.time}</div>
          </div>
        </div>`).join('')}
    </div>`;
    const w=document.createElement('div');w.innerHTML=html;
    document.body.appendChild(w.firstElementChild);
    this.items.forEach(n=>n.read=true);
    this.updateDot();
  },
};
