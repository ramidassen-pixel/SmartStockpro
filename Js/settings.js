/* SmartStock Pro — Settings Page */
const Settings = {
  activeTab: 'company',

  render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Settings</h1>
          <p class="page-subtitle">System configuration & preferences</p></div>
        <button class="btn btn-primary btn-sm" onclick="Toast.show('Settings saved','success')">${Components.icon('check',13)} Save Changes</button>
      </div>
      <div class="tabs mb-4" style="width:fit-content">
        ${[['company','Company'],['users','Users'],['security','Security'],['backup','Backup']].map(([k,l])=>`
        <div class="tab${this.activeTab===k?' active':''}" onclick="Settings.switchTab('${k}')">${l}</div>`).join('')}
      </div>
      <div id="settings-tab"></div>`;
    this.renderTab();
  },

  switchTab(tab) {
    this.activeTab = tab;
    Utils.$$('.tab').forEach(el => el.classList.toggle('active', el.textContent.toLowerCase()===tab));
    this.renderTab();
  },

  renderTab() {
    const panels = {
      company: `<div class="card animate-in">
        <div class="font-display mb-4" style="font-size:13px;font-weight:600">Company Profile</div>
        <div class="flex flex-col gap-3">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Company Name</label><input class="form-input" value="Demo Store"/></div>
            <div class="form-group"><label class="form-label">Industry</label>
              <select class="form-select"><option>Tile Store</option><option>Hardware Store</option><option>Wholesale</option><option>Retail</option><option>Supermarket</option></select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" value="admin@smartstock.pro"/></div>
            <div class="form-group"><label class="form-label">Phone</label><input class="form-input" value="+1 555-0000"/></div>
          </div>
          <div class="form-group"><label class="form-label">Address</label><input class="form-input" value="123 Business Avenue, Suite 400"/></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Currency</label>
              <select class="form-select"><option>USD ($)</option><option>EUR (€)</option><option>GBP (£)</option><option>AED (د.إ)</option></select></div>
            <div class="form-group"><label class="form-label">Tax Rate %</label><input class="form-input" type="number" value="8"/></div>
          </div>
        </div></div>`,

      users: `<div class="card animate-in">
        <div class="flex items-center justify-between mb-4">
          <div class="font-display" style="font-size:13px;font-weight:600">User Management</div>
          <button class="btn btn-primary btn-sm" onclick="Toast.show('Invite sent','info')">${Components.icon('plus',13)} Invite User</button>
        </div>
        ${[{name:'Admin User',email:'admin@store.com',role:'Administrator',active:true},{name:'Sales Manager',email:'sales@store.com',role:'Manager',active:true},{name:'Inventory Clerk',email:'stock@store.com',role:'Staff',active:false}].map(u=>`
        <div class="flex items-center gap-3" style="padding:10px 0;border-bottom:1px solid var(--color-border)">
          <div class="avatar" style="width:34px;height:34px;border-radius:8px;font-size:12px">${u.name[0]}</div>
          <div style="flex:1"><div style="font-size:13px;font-weight:600">${u.name}</div><div class="text-sec text-xs">${u.email}</div></div>
          <span class="badge badge-gold">${u.role}</span>
          ${Components.badge(u.active?'Active':'Inactive')}
        </div>`).join('')}
      </div>`,

      security: `<div class="card animate-in">
        <div class="font-display mb-4" style="font-size:13px;font-weight:600">Security Settings</div>
        <div class="flex flex-col gap-3">
          <div class="form-group"><label class="form-label">Current Password</label><input class="form-input" type="password" placeholder="Enter current password"/></div>
          <div class="form-group"><label class="form-label">New Password</label><input class="form-input" type="password" placeholder="New password (8+ characters)"/></div>
          <div class="form-group"><label class="form-label">Confirm Password</label><input class="form-input" type="password" placeholder="Confirm new password"/></div>
          <div class="divider"></div>
          ${['Enable Two-Factor Authentication','Login notifications via email','Audit log all user actions','Session timeout after 30 minutes'].map((opt,i)=>`
          <div class="flex items-center justify-between" style="padding:8px 0">
            <span style="font-size:13px">${opt}</span>
            <div style="width:40px;height:22px;border-radius:11px;background:${i<2?'var(--color-gold)':'var(--color-border)'};cursor:pointer;position:relative;transition:background 0.2s" onclick="Toast.show('Updated','success')">
              <div style="width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${i<2?20:3}px;transition:left 0.2s"></div>
            </div>
          </div>`).join('')}
        </div></div>`,

      backup: `<div class="card animate-in">
        <div class="font-display mb-4" style="font-size:13px;font-weight:600">Backup & Restore</div>
        <div class="flex flex-col gap-3">
          ${[{label:'Last Backup',val:'2024-05-30 02:00 AM',icon:'✅'},{label:'Backup Size',val:'12.4 MB',icon:'💾'},{label:'Auto Backup',val:'Daily at 2:00 AM',icon:'⏰'},{label:'Retention',val:'30 days',icon:'📅'}].map(item=>`
          <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--color-bg);border-radius:8px;border:1px solid var(--color-border)">
            <span style="font-size:18px">${item.icon}</span>
            <div><div class="text-sec text-xs">${item.label}</div><div style="font-size:13px;font-weight:500">${item.val}</div></div>
          </div>`).join('')}
          <div class="flex gap-3 mt-2">
            <button class="btn btn-primary" onclick="Toast.show('Backup started','info')">${Components.icon('download',13)} Create Backup</button>
            <button class="btn btn-ghost" onclick="Toast.show('Select backup file','warning')">${Components.icon('refresh',13)} Restore</button>
          </div>
        </div></div>`,
    };
    Utils.render('#settings-tab', panels[this.activeTab]||'');
  },
};
