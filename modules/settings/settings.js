var Settings = {

  render: function() {
    var pg   = Utils.get('pg-settings');
    if (!pg) return;
    var s    = DB.getSettings();
    var user = Auth.currentUser || {};

    // Stored pictures
    var bizLogo = s.bizLogo  || '';
    var userPic = user.photo || '';

    // Business logo avatar HTML
    var bizLogoHtml = bizLogo
      ? '<img src="' + bizLogo + '" alt="Logo" style="width:56px;height:56px;border-radius:var(--r12);object-fit:cover;border:2px solid rgba(201,168,76,.3)">'
      : '<div style="width:56px;height:56px;border-radius:var(--r12);background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#07080D;border:2px solid rgba(201,168,76,.3)">'
        + (s.bizName ? s.bizName[0].toUpperCase() : 'S') + '</div>';

    // User photo avatar HTML
    var userInitial = user.name ? user.name[0].toUpperCase() : (user.username ? user.username[0].toUpperCase() : 'U');
    var userPicHtml = userPic
      ? '<img src="' + userPic + '" alt="Photo" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,.3)">'
      : '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#07080D;border:2px solid rgba(201,168,76,.3)">'
        + userInitial + '</div>';

    pg.innerHTML = ''

      // ── PAGE HEADER ─────────────────────────────────────────────────────
      + '<div class="page-header">'
      + '<div><div class="page-title">Settings</div><div class="page-sub">App configuration</div></div>'
      + '</div>'

      // ── SECTION: PROFILE PICTURES ────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Profile Pictures</div>'
      + '<div class="card">'

      // Business Logo row
      + '<div class="settings-item" style="align-items:flex-start;gap:12px;padding:14px">'
      + '<div style="flex-shrink:0;margin-top:2px">' + bizLogoHtml + '</div>'
      + '<div class="settings-info" style="flex:1">'
      + '<div class="settings-name">Business Logo</div>'
      + '<div class="settings-desc">' + Utils.esc(s.bizName||'SmartStock Pro') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px">Appears in receipts, reports &amp; topbar</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
      + '<button class="btn-ghost btn-sm" onclick="Settings.pickBizLogo()" style="font-size:11px;white-space:nowrap">📷 Change</button>'
      + (bizLogo ? '<button class="btn-danger btn-sm" onclick="Settings.removeBizLogo()" style="font-size:11px">✕ Remove</button>' : '')
      + '</div>'
      + '</div>'
      + '<input type="file" id="biz-logo-input" accept="image/*" style="display:none" onchange="Settings.onBizLogoSelected(this)">'

      // User Photo row
      + '<div class="settings-item" style="align-items:flex-start;gap:12px;padding:14px;border-top:1px solid var(--bd)">'
      + '<div style="flex-shrink:0;margin-top:2px">' + userPicHtml + '</div>'
      + '<div class="settings-info" style="flex:1">'
      + '<div class="settings-name">My Profile Photo</div>'
      + '<div class="settings-desc">' + Utils.esc(user.name||user.username||'User') + ' · ' + Utils.esc(user.role||'Owner') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px">Shown in the topbar &amp; account section</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
      + '<button class="btn-ghost btn-sm" onclick="Settings.pickUserPhoto()" style="font-size:11px;white-space:nowrap">📷 Change</button>'
      + (userPic ? '<button class="btn-danger btn-sm" onclick="Settings.removeUserPhoto()" style="font-size:11px">✕ Remove</button>' : '')
      + '</div>'
      + '</div>'
      + '<input type="file" id="user-photo-input" accept="image/*" style="display:none" onchange="Settings.onUserPhotoSelected(this)">'

      + '</div></div>'

      // ── SECTION: COMPANY ─────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Company</div>'
      + '<div class="card">'
      + '<div class="settings-item" onclick="Settings.openBizModal()">'
      + '<div class="settings-icon" style="background:var(--gb)">🏢</div>'
      + '<div class="settings-info"><div class="settings-name">Business Name</div>'
      + '<div class="settings-desc">' + Utils.esc(s.bizName||'SmartStock Pro') + '</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item" onclick="Settings.openCurrencyModal()">'
      + '<div class="settings-icon" style="background:var(--gb)">💱</div>'
      + '<div class="settings-info"><div class="settings-name">Currency</div>'
      + '<div class="settings-desc">' + Utils.esc(s.currency||'$') + '</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item" onclick="Settings.openLowStockModal()">'
      + '<div class="settings-icon" style="background:var(--wab)">⚠️</div>'
      + '<div class="settings-info"><div class="settings-name">Low Stock Alert Level</div>'
      + '<div class="settings-desc">Alert when stock ≤ ' + (s.lowStock||5) + '</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '</div></div>'

      // ── SECTION: APPEARANCE ──────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Appearance</div>'
      + '<div class="card">'
      + '<div class="settings-item">'
      + '<div class="settings-icon" style="background:var(--bg3)">🌙</div>'
      + '<div class="settings-info"><div class="settings-name">Dark Mode</div>'
      + '<div class="settings-desc">Premium dark theme</div></div>'
      + '<div class="toggle ' + (s.theme!=='light'?'on':'') + '" onclick="Settings.toggleTheme()"></div>'
      + '</div></div></div>'

      // ── SECTION: ACCOUNT ─────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Account</div>'
      + '<div class="card">'
      + '<div class="settings-item">'
      + '<div style="flex-shrink:0">'
      + (userPic
          ? '<img src="' + userPic + '" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover">'
          : '<div class="settings-icon" style="background:var(--inb)">👤</div>')
      + '</div>'
      + '<div class="settings-info"><div class="settings-name">' + Utils.esc(user.name||'User') + '</div>'
      + '<div class="settings-desc">' + Utils.esc(user.username||'') + ' · ' + Utils.esc(user.role||'Owner') + '</div></div>'
      + '</div>'
      + '<div class="settings-item" onclick="Settings.openPasswordModal()">'
      + '<div class="settings-icon" style="background:var(--wab)">🔑</div>'
      + '<div class="settings-info"><div class="settings-name">Change Password</div>'
      + '<div class="settings-desc">Update your password</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '</div></div>'

      // ── SECTION: DATA ────────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Data</div>'
      + '<div class="card">'
      + '<div class="settings-item" onclick="Settings.exportData()">'
      + '<div class="settings-icon" style="background:var(--okb)">📥</div>'
      + '<div class="settings-info"><div class="settings-name">Export Backup</div>'
      + '<div class="settings-desc">Download all data as JSON</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item" onclick="Settings.openImportModal()">'
      + '<div class="settings-icon" style="background:var(--inb)">📤</div>'
      + '<div class="settings-info"><div class="settings-name">Import Backup</div>'
      + '<div class="settings-desc">Restore from backup file</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '</div></div>'

      + '<div class="sec" style="padding-top:0">'
      + '<button class="btn-danger btn-full" onclick="Auth.logout()">🚪 Sign Out</button>'
      + '</div>';
  },

  // ═══════════════════════════════════════════════════════════════
  // BUSINESS LOGO UPLOAD
  // ═══════════════════════════════════════════════════════════════

  pickBizLogo: function() {
    var el = Utils.get('biz-logo-input');
    if (el) el.click();
  },

  onBizLogoSelected: function(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    // 2MB limit
    if (file.size > 2 * 1024 * 1024) {
      Toast.show('Image too large — max 2MB', 'err');
      input.value = '';
      return;
    }
    Toast.show('Processing logo…', 'ok');
    var reader = new FileReader();
    reader.onload = function(e) {
      Settings._resizeImage(e.target.result, 400, 400, function(resized) {
        DB.saveSettings({ bizLogo: resized });
        Settings._applyBizLogo(resized);
        Toast.show('Business logo updated ✓', 'ok');
        Settings.render();
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  },

  removeBizLogo: function() {
    DB.saveSettings({ bizLogo: '' });
    Settings._applyBizLogo('');
    Toast.show('Logo removed', 'warn');
    Settings.render();
  },

  // Update the topbar logo instantly after save
  _applyBizLogo: function(src) {
    var imgEl   = Utils.get('tb-logo-img');
    var emojiEl = Utils.get('tb-logo-emoji');
    if (src) {
      if (imgEl)   { imgEl.src = src; imgEl.style.display = 'block'; }
      if (emojiEl) { emojiEl.style.display = 'none'; }
    } else {
      if (imgEl)   { imgEl.style.display = 'none'; }
      if (emojiEl) { emojiEl.style.display = 'block'; }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // USER PROFILE PHOTO UPLOAD
  // ═══════════════════════════════════════════════════════════════

  pickUserPhoto: function() {
    var el = Utils.get('user-photo-input');
    if (el) el.click();
  },

  onUserPhotoSelected: function(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      Toast.show('Image too large — max 2MB', 'err');
      input.value = '';
      return;
    }
    Toast.show('Processing photo…', 'ok');
    var reader = new FileReader();
    reader.onload = function(e) {
      Settings._resizeImage(e.target.result, 300, 300, function(resized) {
        // Save to the user record in DB
        var users = DB.get('users') || [];
        var user  = Auth.currentUser;
        if (user) {
          var idx = -1;
          for (var i = 0; i < users.length; i++) {
            if (users[i].id === user.id) { idx = i; break; }
          }
          if (idx > -1) {
            users[idx].photo = resized;
            DB.set('users', users);
            Auth.currentUser.photo = resized;
          }
        }
        Settings._applyUserPhoto(resized, user);
        Toast.show('Profile photo updated ✓', 'ok');
        Settings.render();
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  },

  removeUserPhoto: function() {
    var users = DB.get('users') || [];
    var user  = Auth.currentUser;
    if (user) {
      for (var i = 0; i < users.length; i++) {
        if (users[i].id === user.id) {
          delete users[i].photo;
          break;
        }
      }
      DB.set('users', users);
      delete Auth.currentUser.photo;
    }
    Settings._applyUserPhoto('', user);
    Toast.show('Photo removed', 'warn');
    Settings.render();
  },

  // Update the topbar avatar instantly after save
  _applyUserPhoto: function(src, user) {
    var el = Utils.get('tb-avatar');
    if (!el) return;
    if (src) {
      el.innerHTML = '<img src="' + src + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    } else {
      var initial = user && user.name ? user.name[0].toUpperCase()
                  : (user && user.username ? user.username[0].toUpperCase() : 'U');
      el.innerHTML = initial;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SHARED IMAGE RESIZE UTILITY
  // Resizes image using canvas, compresses as JPEG 80% quality
  // ═══════════════════════════════════════════════════════════════
  _resizeImage: function(src, maxW, maxH, callback) {
    var img = new Image();
    img.onload = function() {
      var w = img.width;
      var h = img.height;
      // Maintain aspect ratio
      if (w > maxW || h > maxH) {
        var ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      var canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // 80% quality JPEG — keeps file size small for localStorage
      var result = canvas.toDataURL('image/jpeg', 0.8);
      callback(result);
    };
    img.onerror = function() { callback(src); }; // fallback: use original
    img.src = src;
  },

  // ═══════════════════════════════════════════════════════════════
  // BUSINESS NAME
  // ═══════════════════════════════════════════════════════════════
  openBizModal: function() {
    var s = DB.getSettings();
    Modal.open({
      title: 'Business Name',
      body: '<div class="fg"><label class="fl">Business Name</label>'
          + '<input class="fi" id="set-biz" value="' + Utils.esc(s.bizName||'') + '"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Settings.saveBiz()">Save</button>',
    });
  },

  saveBiz: function() {
    var v = Utils.val('set-biz');
    if (!v) { Toast.show('Enter a name','err'); return; }
    DB.saveSettings({ bizName: v });
    var el = Utils.get('tb-biz-name'); if (el) el.textContent = v;
    Toast.show('Updated ✓','ok');
    Modal.close();
    Settings.render();
  },

  // ═══════════════════════════════════════════════════════════════
  // CURRENCY
  // ═══════════════════════════════════════════════════════════════
  openCurrencyModal: function() {
    var s = DB.getSettings();
    var currencies = [
      ['$','USD — Dollar'],['€','EUR — Euro'],['£','GBP — Pound'],
      ['L$','LRD — Liberian Dollar'],['₦','NGN — Naira'],
      ['₵','GHS — Cedi'],['R','ZAR — Rand'],['Ksh','KES — Shilling'],
    ];
    Modal.open({
      title: 'Currency',
      body: '<div class="fg"><label class="fl">Select Currency</label>'
          + '<select class="fi" id="set-cur">'
          + currencies.map(function(c){ return '<option value="' + c[0] + '"' + (s.currency===c[0]?' selected':'') + '>' + c[1] + ' (' + c[0] + ')</option>'; }).join('')
          + '</select></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Settings.saveCurrency()">Save</button>',
    });
  },

  saveCurrency: function() {
    var el = Utils.get('set-cur');
    DB.saveSettings({ currency: el ? el.value : '$' });
    Toast.show('Currency updated ✓','ok');
    Modal.close();
    Settings.render();
  },

  // ═══════════════════════════════════════════════════════════════
  // LOW STOCK ALERT
  // ═══════════════════════════════════════════════════════════════
  openLowStockModal: function() {
    var s = DB.getSettings();
    Modal.open({
      title: 'Low Stock Alert',
      body: '<div class="fg"><label class="fl">Alert when stock is at or below</label>'
          + '<input class="fi" id="set-low" type="number" value="' + (s.lowStock||5) + '" min="1"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Settings.saveLowStock()">Save</button>',
    });
  },

  saveLowStock: function() {
    DB.saveSettings({ lowStock: parseInt(Utils.val('set-low')||5) });
    Toast.show('Updated ✓','ok');
    Modal.close();
    Settings.render();
    Notifs.check();
  },

  // ═══════════════════════════════════════════════════════════════
  // THEME
  // ═══════════════════════════════════════════════════════════════
  toggleTheme: function() {
    var s    = DB.getSettings();
    var next = s.theme === 'light' ? 'dark' : 'light';
    DB.saveSettings({ theme: next });
    UI.applyTheme(next);
    Settings.render();
  },

  // ═══════════════════════════════════════════════════════════════
  // PASSWORD
  // ═══════════════════════════════════════════════════════════════
  openPasswordModal: function() {
    Modal.open({
      title: 'Change Password', barColor: 'var(--wa)',
      body: '<div class="fg"><label class="fl">Current Password</label><input class="fi" id="pw-old" type="password"></div>'
          + '<div class="fg"><label class="fl">New Password (min 6)</label><input class="fi" id="pw-new" type="password"></div>'
          + '<div class="fg"><label class="fl">Confirm New Password</label><input class="fi" id="pw-conf" type="password"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Settings.changePassword()">Update</button>',
    });
  },

  changePassword: async function() {
    var oldPw = Utils.val('pw-old');
    var newPw = Utils.val('pw-new');
    var conf  = Utils.val('pw-conf');
    if (!oldPw || !newPw) { Toast.show('All fields required','err'); return; }
    if (newPw.length < 6) { Toast.show('Min 6 characters','err'); return; }
    if (newPw !== conf)   { Toast.show('Passwords do not match','err'); return; }
    var user   = Auth.currentUser;
    var ok     = await Auth._verifyPw(oldPw, user.password);
    if (!ok) { Toast.show('Current password is wrong','err'); return; }
    var hashed = await Auth._hashPw(newPw);
    var users  = DB.get('users');
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === user.id) { users[i].password = hashed; break; }
    }
    DB.set('users', users);
    Toast.show('Password updated ✓','ok');
    Modal.close();
  },

  // ═══════════════════════════════════════════════════════════════
  // EXPORT / IMPORT
  // ═══════════════════════════════════════════════════════════════
  exportData: function() {
    var json = JSON.stringify(DB._data, null, 2);
    var a    = document.createElement('a');
    a.href   = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    a.download = 'smartstock_backup_' + Utils.today() + '.json';
    a.click();
    Toast.show('Backup downloaded ✓','ok');
  },

  openImportModal: function() {
    Modal.open({
      title: 'Import Backup',
      body: '<p style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6">Select a SmartStock backup JSON file. This will REPLACE all current data.</p>'
          + '<input type="file" id="import-file" accept=".json" class="fi">',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Settings.importData()">Import</button>',
    });
  },

  importData: function() {
    var fileEl = Utils.get('import-file');
    var file   = fileEl && fileEl.files && fileEl.files[0];
    if (!file) { Toast.show('Select a file','err'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        DB._data = JSON.parse(e.target.result);
        DB.save();
        Toast.show('Data imported ✓','ok');
        Modal.close();
        location.reload();
      } catch(err) {
        Toast.show('Invalid backup file','err');
      }
    };
    reader.readAsText(file);
  },
};
