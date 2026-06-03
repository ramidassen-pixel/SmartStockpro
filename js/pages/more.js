const MorePage = {
  render() {
    const items = [
      {icon:'💰',label:'Payroll',   sub:'Staff salaries & attendance', action:"Toast.show('Payroll module — coming soon','wa')",  bg:'var(--okb)'},
      {icon:'🏭',label:'Suppliers', sub:'Vendor management',           action:"Toast.show('Suppliers module — coming soon','wa')", bg:'var(--pub)'},
      {icon:'📋',label:'Quotations',sub:'Create & convert quotes',     action:"Toast.show('Quotations — coming soon','wa')",       bg:'var(--inb)'},
      {icon:'📈',label:'Analytics', sub:'Charts & business trends',    action:"Toast.show('Analytics — coming soon','wa')",        bg:'var(--teb)'},
      {icon:'🔔',label:'Notifications',sub:'Alerts & reminders',      action:"Toast.show('All caught up!','ok')",                 bg:'var(--wab)'},
      {icon:'⚙️',label:'Settings',  sub:'App & company settings',     action:"MorePage.openSettings()",                          bg:'var(--gd)'},
    ];
    const html = `
<div class="sec">
  <div class="sh">More Features</div>
  <div class="act-card" style="margin-bottom:14px">
    ${items.map(item=>`
    <div class="sb-item" onclick="${item.action}">
      <div class="sb-icon" style="background:${item.bg}">${item.icon}</div>
      <div class="sb-text"><div class="sb-t">${item.label}</div><div class="sb-s">${item.sub}</div></div>
      <div class="sb-arrow">›</div>
    </div>`).join('')}
  </div>
  <!-- App info -->
  <div class="card" style="padding:16px;text-align:center">
    <div style="font-size:36px;margin-bottom:8px">📦</div>
    <div style="font-size:16px;font-weight:800;color:var(--g)">SmartStock Pro</div>
    <div style="font-size:11px;color:var(--t3);font-family:var(--fm);margin-top:4px">v2.0 · Business Management</div>
    <div style="font-size:11px;color:var(--t4);margin-top:8px;line-height:1.6">Built for tile stores, hardware shops,<br>wholesale & retail businesses</div>
  </div>
</div>`;
    Utils.set('pg-more', html);
  },

  openSettings() {
    const html = `
<div class="sec">
  <div class="sh">Settings</div>
  <div class="act-card" style="margin-bottom:12px">
    <div style="padding:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px">Company Profile</div>
      <div class="fg"><label class="fl">Business Name</label><input class="fi" value="SmartStock Pro" id="set-biz-name"></div>
      <div class="fr2">
        <div class="fg"><label class="fl">Currency</label>
          <select class="fi"><option>USD ($)</option><option>EUR (€)</option><option>GBP (£)</option><option>AED (د.إ)</option></select></div>
        <div class="fg"><label class="fl">Tax Rate %</label><input class="fi" type="number" value="8"></div>
      </div>
      <div class="fg"><label class="fl">Industry</label>
        <select class="fi"><option>Tile Store</option><option>Hardware Store</option><option>Wholesale</option><option>Retail</option><option>Supermarket</option></select></div>
      <button class="btn bg bbl" style="margin-top:4px" onclick="Toast.show('Settings saved ✓','ok')">💾 Save Settings</button>
    </div>
  </div>
  <div class="act-card">
    <div style="padding:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px">AI Assistant</div>
      <div class="fg"><label class="fl">Anthropic API Key</label><input class="fi" id="set-api-key" type="password" placeholder="sk-ant-..." value="${CONFIG.api.anthropicKey==='YOUR_ANTHROPIC_API_KEY'?'':CONFIG.api.anthropicKey}"></div>
      <button class="btn bgh bbl" style="margin-top:4px" onclick="const k=Utils.val('set-api-key');if(k){CONFIG.api.anthropicKey=k;Utils.storage.set('ssp_api_key',k);Toast.show('API key saved ✓','ok');}else{Toast.show('Enter your API key','er');}">🔑 Save API Key</button>
    </div>
  </div>
</div>`;
    Utils.set('pg-more', html);
    // Load saved key
    const saved = Utils.storage.get('ssp_api_key');
    if (saved) CONFIG.api.anthropicKey = saved;
  },
};