/* === settings.js === */
var Settings = {


  // ═══ SHARED RECEIPT/REPORT HEADER BUILDER ════════════════════════════════
  // Used by sales receipts, daily reports, and finance summaries
  // Returns HTML string for the top of any printed document
  _buildReceiptHeader: function(settings) {
    var bizName    = settings.bizName    || 'SmartStock Pro';
    var bizAddress = settings.bizAddress || '';
    var bizPhone   = settings.bizPhone   || '';
    var bizEmail   = settings.bizEmail   || '';
    var bizLogo    = settings.bizLogo    || '';

    var logoHtml = bizLogo
      ? '<div style="text-align:center;margin-bottom:8px"><img src="'+bizLogo+'" alt="Logo" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #ddd"></div>'
      : '';

    return logoHtml
      + '<div class="center bold lg">'+bizName+'</div>'
      + (bizAddress ? '<div class="center sm">'+bizAddress+'</div>' : '')
      + (bizPhone   ? '<div class="center sm">Tel: '+bizPhone+'</div>' : '')
      + (bizEmail   ? '<div class="center sm">'+bizEmail+'</div>'    : '');
  },

  render: function() {
    var pg   = Utils.get('pg-settings');
    if (!pg) return;
    var s    = DB.getSettings();
    var user = Auth.currentUser || {};

    var bizLogo  = s.bizLogo  || '';
    var userPic  = user.photo || '';

    var bizLogoHtml = bizLogo
      ? '<img src="'+bizLogo+'" alt="Logo" style="width:56px;height:56px;border-radius:var(--r12);object-fit:cover;border:2px solid rgba(201,168,76,.3)">'
      : '<div style="width:56px;height:56px;border-radius:var(--r12);background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#07080D;border:2px solid rgba(201,168,76,.3)">'+(s.bizName?s.bizName[0].toUpperCase():'S')+'</div>';

    var userInitial = user.name?user.name[0].toUpperCase():(user.username?user.username[0].toUpperCase():'U');
    var userPicHtml = userPic
      ? '<img src="'+userPic+'" alt="Photo" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,.3)">'
      : '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#07080D;border:2px solid rgba(201,168,76,.3)">'+userInitial+'</div>';

    pg.innerHTML = ''

      + '<div class="page-header">'
      + '<div><div class="page-title">Settings</div><div class="page-sub">App configuration</div></div>'
      + '</div>'

      // ── PROFILE PICTURES ──────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Profile Pictures</div>'
      + '<div class="card">'

      + '<div class="settings-item" style="align-items:flex-start;gap:12px;padding:14px">'
      + '<div style="flex-shrink:0;margin-top:2px">'+bizLogoHtml+'</div>'
      + '<div class="settings-info" style="flex:1">'
      + '<div class="settings-name">Business Logo</div>'
      + '<div class="settings-desc">'+Utils.esc(s.bizName||'SmartStock Pro')+'</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px">Shown on receipts, reports &amp; topbar</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
      + '<button class="btn-ghost btn-sm" onclick="Settings.pickBizLogo()" style="font-size:11px;white-space:nowrap">📷 Change</button>'
      + (bizLogo?'<button class="btn-danger btn-sm" onclick="Settings.removeBizLogo()" style="font-size:11px">✕ Remove</button>':'')
      + '</div>'
      + '</div>'
      + '<input type="file" id="biz-logo-input" accept="image/*" style="display:none" onchange="Settings.onBizLogoSelected(this)">'

      + '<div class="settings-item" style="align-items:flex-start;gap:12px;padding:14px;border-top:1px solid var(--bd)">'
      + '<div style="flex-shrink:0;margin-top:2px">'+userPicHtml+'</div>'
      + '<div class="settings-info" style="flex:1">'
      + '<div class="settings-name">My Profile Photo</div>'
      + '<div class="settings-desc">'+Utils.esc(user.name||user.username||'User')+' · '+Utils.esc(user.role||'Owner')+'</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px">Shown in the topbar top-right corner</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
      + '<button class="btn-ghost btn-sm" onclick="Settings.pickUserPhoto()" style="font-size:11px;white-space:nowrap">📷 Change</button>'
      + (userPic?'<button class="btn-danger btn-sm" onclick="Settings.removeUserPhoto()" style="font-size:11px">✕ Remove</button>':'')
      + '</div>'
      + '</div>'
      + '<input type="file" id="user-photo-input" accept="image/*" style="display:none" onchange="Settings.onUserPhotoSelected(this)">'

      + '</div></div>'

      // ── BUSINESS INFORMATION ──────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Business Information</div>'
      + '<div class="card">'
      + '<div class="settings-item" onclick="Settings.openBizModal()">'
      + '<div class="settings-icon" style="background:var(--gb)">🏢</div>'
      + '<div class="settings-info">'
      + '<div class="settings-name">'+Utils.esc(s.bizName||'SmartStock Pro')+'</div>'
      + (s.bizAddress?'<div style="font-size:11px;color:var(--t2);margin-top:2px">📍 '+Utils.esc(s.bizAddress)+'</div>':'<div style="font-size:11px;color:var(--t3);margin-top:2px">No address set</div>')
      + (s.bizPhone  ?'<div style="font-size:11px;color:var(--t2);margin-top:1px">📞 '+Utils.esc(s.bizPhone)+'</div>':'')
      + (s.bizEmail  ?'<div style="font-size:11px;color:var(--t2);margin-top:1px">✉️ '+Utils.esc(s.bizEmail)+'</div>':'')
      + '</div>'
      + '<div class="settings-arrow">›</div></div>'
      + '</div></div>'

      // ── SETTINGS ─────────────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Settings</div>'
      + '<div class="card">'
      + '<div class="settings-item" onclick="Settings.openCurrencyModal()">'
      + '<div class="settings-icon" style="background:var(--gb)">💱</div>'
      + '<div class="settings-info"><div class="settings-name">Currency</div>'
      + '<div class="settings-desc">'+Utils.esc(s.currency||'$')+'</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item" onclick="Settings.openExchangeRateModal()">'
      + '<div class="settings-icon" style="background:var(--gb)">💵</div>'
      + '<div class="settings-info"><div class="settings-name">LRD Exchange Rate</div>'
      + '<div class="settings-desc">'+(s.lrdRate?'1 USD = L$'+s.lrdRate:'Tap to set rate for dual currency')+'</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item" onclick="Settings.openLowStockModal()">'
      + '<div class="settings-icon" style="background:var(--wab)">⚠️</div>'
      + '<div class="settings-info"><div class="settings-name">Low Stock Alert Level</div>'
      + '<div class="settings-desc">Alert when stock ≤ '+(s.lowStock||5)+'</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item">'
      + '<div class="settings-icon" style="background:var(--bg3)">🌙</div>'
      + '<div class="settings-info"><div class="settings-name">Dark Mode</div>'
      + '<div class="settings-desc">Premium dark theme</div></div>'
      + '<div class="toggle '+(s.theme!=='light'?'on':'')+'" onclick="Settings.toggleTheme()"></div>'
      + '</div></div></div>'

      // ── ACCOUNT ───────────────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Account</div>'
      + '<div class="card">'
      + '<div class="settings-item">'
      + '<div style="flex-shrink:0">'
      + (userPic?'<img src="'+userPic+'" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover">':'<div class="settings-icon" style="background:var(--inb)">👤</div>')
      + '</div>'
      + '<div class="settings-info"><div class="settings-name">'+Utils.esc(user.name||'User')+'</div>'
      + '<div class="settings-desc">'+Utils.esc(user.username||'')+' · '+Utils.esc(user.role||'Owner')+'</div></div>'
      + '</div>'
      + '<div class="settings-item" onclick="Settings.openPasswordModal()">'
      + '<div class="settings-icon" style="background:var(--wab)">🔑</div>'
      + '<div class="settings-info"><div class="settings-name">Change Password</div>'
      + '<div class="settings-desc">Update your password</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '</div></div>'

      // ── DATA ──────────────────────────────────────────────────────────────
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

  // ═══ BUSINESS LOGO ═══════════════════════════════════════════════════════
  pickBizLogo: function() { var el=Utils.get('biz-logo-input'); if(el) el.click(); },

  onBizLogoSelected: function(input) {
    var file=input.files&&input.files[0]; if(!file) return;
    if(file.size>2*1024*1024){ Toast.show('Max 2MB','err'); input.value=''; return; }
    Toast.show('Processing…','ok');
    var reader=new FileReader();
    reader.onload=function(e){
      Settings._resizeImage(e.target.result,400,400,function(resized){
        DB.saveSettings({bizLogo:resized});
        Settings._applyBizLogo(resized);
        Toast.show('Business logo updated ✓','ok');
        Settings.render();
      });
    };
    reader.readAsDataURL(file); input.value='';
  },

  removeBizLogo: function() {
    DB.saveSettings({bizLogo:''});
    Settings._applyBizLogo('');
    Toast.show('Logo removed','warn');
    Settings.render();
  },

  _applyBizLogo: function(src) {
    var imgEl=Utils.get('tb-logo-img');
    var emojiEl=Utils.get('tb-logo-emoji');
    if(src){
      if(imgEl){ imgEl.src=src; imgEl.style.display='block'; }
      if(emojiEl) emojiEl.style.display='none';
    } else {
      if(imgEl) imgEl.style.display='none';
      if(emojiEl) emojiEl.style.display='block';
    }
  },

  // ═══ USER PHOTO ══════════════════════════════════════════════════════════
  pickUserPhoto: function() { var el=Utils.get('user-photo-input'); if(el) el.click(); },

  onUserPhotoSelected: function(input) {
    var file=input.files&&input.files[0]; if(!file) return;
    if(file.size>2*1024*1024){ Toast.show('Max 2MB','err'); input.value=''; return; }
    Toast.show('Processing…','ok');
    var reader=new FileReader();
    reader.onload=function(e){
      Settings._resizeImage(e.target.result,300,300,function(resized){
        var users=DB.get('users')||[];
        var user=Auth.currentUser;
        if(user){
          for(var i=0;i<users.length;i++){
            if(users[i].id===user.id){ users[i].photo=resized; break; }
          }
          DB.set('users',users);
          Auth.currentUser.photo=resized;
        }
        Settings._applyUserPhoto(resized,user);
        Toast.show('Profile photo updated ✓','ok');
        Settings.render();
      });
    };
    reader.readAsDataURL(file); input.value='';
  },

  removeUserPhoto: function() {
    var users=DB.get('users')||[];
    var user=Auth.currentUser;
    if(user){
      for(var i=0;i<users.length;i++){
        if(users[i].id===user.id){ delete users[i].photo; break; }
      }
      DB.set('users',users);
      delete Auth.currentUser.photo;
    }
    Settings._applyUserPhoto('',user);
    Toast.show('Photo removed','warn');
    Settings.render();
  },

  _applyUserPhoto: function(src,user) {
    var el=Utils.get('tb-avatar'); if(!el) return;
    if(src){
      el.innerHTML='<img src="'+src+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    } else {
      var init=user&&user.name?user.name[0].toUpperCase():(user&&user.username?user.username[0].toUpperCase():'U');
      el.innerHTML=init;
    }
  },

  // ═══ IMAGE RESIZE ════════════════════════════════════════════════════════
  _resizeImage: function(src,maxW,maxH,callback){
    var img=new Image();
    img.onload=function(){
      var w=img.width,h=img.height;
      if(w>maxW||h>maxH){ var r=Math.min(maxW/w,maxH/h); w=Math.round(w*r); h=Math.round(h*r); }
      var c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      callback(c.toDataURL('image/jpeg',0.8));
    };
    img.onerror=function(){ callback(src); };
    img.src=src;
  },

  // ═══ BUSINESS INFO MODAL ═════════════════════════════════════════════════
  openBizModal: function() {
    var s=DB.getSettings();
    Modal.open({
      title:'Business Information',
      sub:'Appears on all receipts, reports and documents',
      barColor:'var(--g)',
      body:'<div class="fg"><label class="fl">Business Name *</label>'
          +'<input class="fi" id="set-biz" value="'+Utils.esc(s.bizName||'')+'" placeholder="e.g. Rock Stone"></div>'
          +'<div class="fg"><label class="fl">Address</label>'
          +'<input class="fi" id="set-addr" value="'+Utils.esc(s.bizAddress||'')+'" placeholder="e.g. Broad Street, Monrovia, Liberia"></div>'
          +'<div class="form-row">'
          +'<div class="fg"><label class="fl">Phone Number</label>'
          +'<input class="fi" id="set-phone" type="tel" value="'+Utils.esc(s.bizPhone||'')+'" placeholder="+231 77 000 000"></div>'
          +'<div class="fg"><label class="fl">Email</label>'
          +'<input class="fi" id="set-email" type="email" value="'+Utils.esc(s.bizEmail||'')+'" placeholder="info@business.com"></div>'
          +'</div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.saveBiz()">💾 Save</button>',
    });
  },

  saveBiz: function() {
    var name=Utils.val('set-biz');
    if(!name){ Toast.show('Business name is required','err'); return; }
    DB.saveSettings({
      bizName:name,
      bizAddress:Utils.val('set-addr'),
      bizPhone:Utils.val('set-phone'),
      bizEmail:Utils.val('set-email'),
    });
    var el=Utils.get('tb-biz-name'); if(el) el.textContent=name;
    var sub=Utils.get('tb-biz-sub');
    if(sub){ var s2=DB.getSettings(); sub.textContent=s2.bizPhone||s2.bizAddress||'Business Manager'; }
    Toast.show('Business info updated ✓','ok');
    Modal.close();
    Settings.render();
  },

  // ═══ CURRENCY ════════════════════════════════════════════════════════════
  openCurrencyModal: function() {
    var s=DB.getSettings();
    var currencies=[['$','USD — Dollar'],['€','EUR — Euro'],['£','GBP — Pound'],
      ['L$','LRD — Liberian Dollar'],['₦','NGN — Naira'],['₵','GHS — Cedi'],['R','ZAR — Rand'],['Ksh','KES — Shilling']];
    Modal.open({
      title:'Currency',
      body:'<div class="fg"><label class="fl">Select Currency</label>'
          +'<select class="fi" id="set-cur">'
          +currencies.map(function(c){ return '<option value="'+c[0]+'"'+(s.currency===c[0]?' selected':'')+'>'+c[1]+' ('+c[0]+')</option>'; }).join('')
          +'</select></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.saveCurrency()">Save</button>',
    });
  },

  saveCurrency: function() {
    var el=Utils.get('set-cur');
    DB.saveSettings({currency:el?el.value:'$'});
    Toast.show('Currency updated ✓','ok');
    Modal.close();
    Settings.render();
  },

  // ═══ EXCHANGE RATE (dual currency: LRD ↔ USD) ════════════════════════════
  openExchangeRateModal: function() {
    var s = DB.getSettings();
    Modal.open({
      title: '💵 LRD Exchange Rate', barColor: 'var(--g)',
      body:
        '<div style="background:var(--gb3);border:1px solid rgba(212,168,67,.2);border-radius:var(--r12);padding:14px 16px;margin-bottom:16px">'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7">Set how many <strong>Liberian Dollars (LRD)</strong> equal <strong>1 US Dollar</strong>. Products stay priced in USD — customers can pay in either currency, and the sales screen will show the LRD equivalent.</div>'
        + '</div>'
        + '<div class="fg"><label class="fl">1 USD ($) equals how many LRD (L$)? *</label>'
        + '<input class="fi" id="set-rate" type="number" step="0.01" min="0" placeholder="e.g. 198" value="'+(s.lrdRate||'')+'" style="font-size:18px;font-weight:700;text-align:center"></div>'
        + '<div style="text-align:center;font-size:11px;color:var(--t3);margin-top:-6px;margin-bottom:14px">Check today\'s rate with your bank or money changer</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Settings.saveExchangeRate()">💾 Save Rate</button>',
    });
  },

  saveExchangeRate: function() {
    var rate = parseFloat(Utils.val('set-rate'));
    if (!rate || rate <= 0) { Toast.show('Enter a valid exchange rate','err'); return; }
    DB.saveSettings({ lrdRate: rate });
    Toast.show('Exchange rate saved — 1 USD = L$'+rate+' ✓','ok');
    Modal.close();
    Settings.render();
  },

  // ═══ LOW STOCK ═══════════════════════════════════════════════════════════
  openLowStockModal: function() {
    var s=DB.getSettings();
    Modal.open({
      title:'Low Stock Alert',
      body:'<div class="fg"><label class="fl">Alert when stock is at or below</label>'
          +'<input class="fi" id="set-low" type="number" value="'+(s.lowStock||5)+'" min="1"></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.saveLowStock()">Save</button>',
    });
  },

  saveLowStock: function() {
    DB.saveSettings({lowStock:parseInt(Utils.val('set-low')||5)});
    Toast.show('Updated ✓','ok');
    Modal.close();
    Settings.render();
    Notifs.check();
  },

  // ═══ THEME ═══════════════════════════════════════════════════════════════
  toggleTheme: function() {
    var s=DB.getSettings();
    var next=s.theme==='light'?'dark':'light';
    DB.saveSettings({theme:next});
    UI.applyTheme(next);
    Settings.render();
  },

  // ═══ PASSWORD ════════════════════════════════════════════════════════════
  openPasswordModal: function() {
    Modal.open({
      title:'Change Password', barColor:'var(--wa)',
      body:'<div class="fg"><label class="fl">Current Password</label><input class="fi" id="pw-old" type="password"></div>'
          +'<div class="fg"><label class="fl">New Password (min 8, with upper/lower/number)</label><input class="fi" id="pw-new" type="password"></div>'
          +'<div class="fg"><label class="fl">Confirm New Password</label><input class="fi" id="pw-conf" type="password"></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.changePassword()">Update</button>',
    });
  },

  changePassword: function() {
    var oldPw=Utils.val('pw-old'), newPw=Utils.val('pw-new'), conf=Utils.val('pw-conf');
    if(!oldPw||!newPw){ Toast.show('All fields required','err'); return; }
    if(newPw.length<8){ Toast.show('Min 8 characters','err'); return; }
    if(newPw!==conf){ Toast.show('Passwords do not match','err'); return; }
    if(!Auth._strongPw(newPw)){ Toast.show('Password needs uppercase, lowercase and a number','err'); return; }

    var session = Auth._session;
    if (!session || !session.access_token) { Toast.show('Session expired — please sign in again','err'); return; }

    // Re-verify identity by attempting a fresh login with the OLD password —
    // this confirms the person changing the password actually knows the
    // current one, without SmartStock Pro ever storing or hashing it itself.
    fetch(SUPABASE_AUTH_URL + '/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email: Auth.currentUser.email, password: oldPw }),
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(verify) {
      if (!verify.ok) { Toast.show('Current password is wrong','err'); return; }

      fetch(SUPABASE_AUTH_URL + '/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ password: newPw }),
      })
      .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
      .then(function(result) {
        if (!result.ok) {
          Toast.show('Could not update password: ' + ((result.data && result.data.msg) || 'Unknown error'), 'err');
          return;
        }
        Toast.show('Password updated ✓','ok');
        Modal.close();
      })
      .catch(function(err) { Toast.show('Network error: ' + err.message, 'err'); });
    })
    .catch(function(err) { Toast.show('Network error: ' + err.message, 'err'); });
  },

  // ═══ EXPORT / IMPORT ═════════════════════════════════════════════════════
  exportData: function() {
    var json=JSON.stringify(DB._data,null,2);
    var a=document.createElement('a');
    a.href='data:application/json;charset=utf-8,'+encodeURIComponent(json);
    a.download='smartstock_backup_'+Utils.today()+'.json';
    a.click();
    Toast.show('Backup downloaded ✓','ok');
  },

  openImportModal: function() {
    Modal.open({
      title:'Import Backup',
      body:'<p style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6">Select a SmartStock backup JSON file. This will REPLACE all current data.</p>'
          +'<input type="file" id="import-file" accept=".json" class="fi">',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.importData()">Import</button>',
    });
  },

  importData: function() {
    var fileEl=Utils.get('import-file');
    var file=fileEl&&fileEl.files&&fileEl.files[0];
    if(!file){ Toast.show('Select a file','err'); return; }
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        DB._data=JSON.parse(e.target.result);
        DB.save();
        Toast.show('Data imported ✓','ok');
        Modal.close();
        location.reload();
      } catch(err){ Toast.show('Invalid backup file','err'); }
    };
    reader.readAsText(file);
  },
};
