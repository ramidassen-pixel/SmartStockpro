var Settings = {
  render() {
    const pg = Utils.get('pg-settings');
    if (!pg) return;
    const s = DB.getSettings();
    const user = Auth.currentUser || {};
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Settings</div>
          <div class="page-sub">App configuration</div></div>
      </div>
      <div class="settings-section">
        <div class="settings-title">Company</div>
        <div class="card">
          <div class="settings-item" onclick="Settings.openBizModal()">
            <div class="settings-icon" style="background:var(--goldbg)">🏢</div>
            <div class="settings-info">
              <div class="settings-name">Business Name</div>
              <div class="settings-desc">${Utils.esc(s.bizName||'SmartStock Pro')}</div>
            </div>
            <div class="settings-arrow">›</div>
          </div>
          <div class="settings-item" onclick="Settings.openCurrencyModal()">
            <div class="settings-icon" style="background:var(--goldbg)">💱</div>
            <div class="settings-info">
              <div class="settings-name">Currency</div>
              <div class="settings-desc">${Utils.esc(s.currency||'$')}</div>
            </div>
            <div class="settings-arrow">›</div>
          </div>
          <div class="settings-item" onclick="Settings.openLowStockModal()">
            <div class="settings-icon" style="background:var(--warnbg)">⚠️</div>
            <div class="settings-info">
              <div class="settings-name">Low Stock Alert Level</div>
              <div class="settings-desc">Alert when stock ≤ ${s.lowStock||5}</div>
            </div>
            <div class="settings-arrow">›</div>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-title">Appearance</div>
        <div class="card">
          <div class="settings-item">
            <div class="settings-icon" style="background:var(--bg3)">🌙</div>
            <div class="settings-info">
              <div class="settings-name">Dark Mode</div>
              <div class="settings-desc">Premium dark theme</div>
            </div>
            <div class="toggle ${s.theme!=='light'?'on':''}" id="theme-toggle" onclick="Settings.toggleTheme()"></div>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-title">Account</div>
        <div class="card">
          <div class="settings-item">
            <div class="settings-icon" style="background:var(--infobg)">👤</div>
            <div class="settings-info">
              <div class="settings-name">${Utils.esc(user?.name||'User')}</div>
              <div class="settings-desc">${Utils.esc(user?.username||'')} · ${Utils.esc(user?.role||'Owner')}</div>
            </div>
          </div>
          <div class="settings-item" onclick="Settings.openPasswordModal()">
            <div class="settings-icon" style="background:var(--warnbg)">🔑</div>
            <div class="settings-info">
              <div class="settings-name">Change Password</div>
              <div class="settings-desc">Update your password</div>
            </div>
            <div class="settings-arrow">›</div>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-title">Data</div>
        <div class="card">
          <div class="settings-item" onclick="Settings.exportData()">
            <div class="settings-icon" style="background:var(--okbg)">📥</div>
            <div class="settings-info">
              <div class="settings-name">Export Backup</div>
              <div class="settings-desc">Download all data as JSON</div>
            </div>
            <div class="settings-arrow">›</div>
          </div>
          <div class="settings-item" onclick="Settings.openImportModal()">
            <div class="settings-icon" style="background:var(--infobg)">📤</div>
            <div class="settings-info">
              <div class="settings-name">Import Backup</div>
              <div class="settings-desc">Restore from backup file</div>
            </div>
            <div class="settings-arrow">›</div>
          </div>
        </div>
      </div>
      <div class="sec" style="padding-top:0">
        <button class="btn-danger btn-full" onclick="Auth.logout()">🚪 Sign Out</button>
      </div>`;
  },

  openBizModal() {
    const s = DB.getSettings();
    Modal.open({ title:'Business Name', body:`
      <div class="fg"><label class="fl">Business Name</label><input class="fi" id="set-biz" value="${Utils.esc(s.bizName||'')}"></div>`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Settings.saveBiz()">Save</button>` });
  },
  saveBiz() {
    const v = Utils.val('set-biz'); if(!v){Toast.show('Enter a name','err');return;}
    DB.saveSettings({bizName:v});
    Utils.set('tb-biz-name', Utils.esc(v));
    Utils.set('sb-biz-name', Utils.esc(v));
    Toast.show('Updated ✓','ok'); Modal.close(); this.render();
  },

  openCurrencyModal() {
    const s = DB.getSettings();
    const currencies = [['$','USD — Dollar'],['€','EUR — Euro'],['£','GBP — Pound'],['L$','LRD — Liberian Dollar'],['₦','NGN — Naira'],['₵','GHS — Cedi'],['R','ZAR — Rand'],['Ksh','KES — Shilling']];
    Modal.open({ title:'Currency', body:`
      <div class="fg"><label class="fl">Select Currency</label>
        <select class="fi" id="set-cur">${currencies.map(([v,l])=>`<option value="${v}"${s.currency===v?' selected':''}>${l} (${v})</option>`).join('')}</select></div>`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Settings.saveCurrency()">Save</button>` });
  },
  saveCurrency() {
    DB.saveSettings({currency:Utils.get('set-cur')?.value||'$'});
    Toast.show('Currency updated ✓','ok'); Modal.close(); this.render();
  },

  openLowStockModal() {
    const s = DB.getSettings();
    Modal.open({ title:'Low Stock Alert', body:`
      <div class="fg"><label class="fl">Alert when stock is at or below</label>
        <input class="fi" id="set-low" type="number" value="${s.lowStock||5}" min="1"></div>`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Settings.saveLowStock()">Save</button>` });
  },
  saveLowStock() {
    DB.saveSettings({lowStock:parseInt(Utils.val('set-low')||5)});
    Toast.show('Updated ✓','ok'); Modal.close(); this.render(); Notifs.check();
  },

  toggleTheme() {
    const s = DB.getSettings();
    const next = s.theme==='light' ? 'dark' : 'light';
    DB.saveSettings({theme:next}); UI.applyTheme(next);
    this.render();
  },

  openPasswordModal() {
    Modal.open({ title:'Change Password', barColor:'var(--warn)', body:`
      <div class="fg"><label class="fl">Current Password</label><input class="fi" id="pw-old" type="password"></div>
      <div class="fg"><label class="fl">New Password (min 6)</label><input class="fi" id="pw-new" type="password"></div>
      <div class="fg"><label class="fl">Confirm New Password</label><input class="fi" id="pw-conf" type="password"></div>`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Settings.changePassword()">Update</button>` });
  },
  async changePassword() {
    const oldPw = Utils.val('pw-old'); const newPw = Utils.val('pw-new'); const conf = Utils.val('pw-conf');
    if (!oldPw||!newPw) { Toast.show('All fields required','err'); return; }
    if (newPw.length < 6) { Toast.show('Min 6 characters','err'); return; }
    if (newPw !== conf) { Toast.show('Passwords do not match','err'); return; }
    const user = Auth.currentUser;
    const ok = await Auth._verifyPw(oldPw, user.password);
    if (!ok) { Toast.show('Current password is wrong','err'); return; }
    const hashed = await Auth._hashPw(newPw);
    const users = DB.get('users');
    const i = users.findIndex(u=>u.id===user.id);
    if (i>-1) { users[i].password = hashed; DB.set('users', users); }
    Toast.show('Password updated ✓','ok'); Modal.close();
  },

  exportData() {
    const json = JSON.stringify(DB._data, null, 2);
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    a.download = 'smartstock_backup_' + Utils.today() + '.json';
    a.click();
    Toast.show('Backup downloaded ✓','ok');
  },

  openImportModal() {
    Modal.open({ title:'Import Backup', body:`
      <p style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6">Select a SmartStock backup JSON file. This will REPLACE all current data.</p>
      <input type="file" id="import-file" accept=".json" class="fi">`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Settings.importData()">Import</button>` });
  },
  importData() {
    const file = Utils.get('import-file')?.files[0];
    if (!file) { Toast.show('Select a file','err'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        DB._data = data; DB.save();
        Toast.show('Data imported ✓','ok'); Modal.close();
        location.reload();
      } catch { Toast.show('Invalid backup file','err'); }
    };
    reader.readAsText(file);
  },
};
