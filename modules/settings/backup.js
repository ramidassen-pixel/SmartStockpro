/* === backup.js === */
/* SmartStock Pro V5 — Data Backup & Restore */
var Backup = {

  /* ══════════════════════════════════════════════════════════════
     RENDER — backup page in Settings → More
  ══════════════════════════════════════════════════════════════ */
  renderPanel: function(container) {
    var settings = DB.getSettings();
    var lastBackup = Utils.storage.get('lastBackupDate') || null;
    var bizName  = settings.bizName || 'SmartStock';
    var today    = Utils.today();
    var dataSize = Backup._getDataSize();

    var sinceHtml = lastBackup
      ? '<span style="color:var(--ok)">✅ Last backup: ' + lastBackup + '</span>'
      : '<span style="color:var(--wa)">⚠️ Never backed up</span>';

    container.innerHTML = '<div class="sec">'

      // ── WARNING BANNER if no backup ──────────────────────────────────────
      + (!lastBackup ? '<div style="background:var(--wab);border:1.5px solid var(--wabd);border-radius:var(--r12);padding:14px 16px;margin-bottom:14px;display:flex;gap:10px">'
        + '<div style="font-size:24px;flex-shrink:0">⚠️</div>'
        + '<div><div style="font-size:13px;font-weight:700;color:var(--wa);margin-bottom:3px">No backup found!</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.6">If you clear your browser or change phones, all your data will be permanently lost. Back up now!</div>'
        + '</div></div>' : '')

      // ── INFO CARD ────────────────────────────────────────────────────────
      + '<div class="card card-body" style="margin-bottom:12px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div><div style="font-size:15px;font-weight:800;color:var(--t1)">💾 Your Data</div>'
      + '<div style="font-size:11px;color:var(--t2);margin-top:2px">' + sinceHtml + '</div>'
      + '</div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:18px;font-weight:900;color:var(--g)">' + dataSize.label + '</div>'
      + '<div style="font-size:10px;color:var(--t3)">data stored</div>'
      + '</div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
      + Backup._statPill('🧾', dataSize.sales, 'Sales')
      + Backup._statPill('📦', dataSize.products, 'Products')
      + Backup._statPill('👥', dataSize.customers, 'Customers')
      + '</div>'
      + '<button class="btn-primary btn-full" onclick="Backup.exportData()" style="margin-bottom:8px">⬇️ Download Backup File</button>'
      + '<div style="font-size:10px;color:var(--t3);text-align:center">Saves a .json file to your phone Downloads folder</div>'
      + '</div>'

      // ── RESTORE CARD ─────────────────────────────────────────────────────
      + '<div class="card card-body">'
      + '<div style="font-size:15px;font-weight:800;color:var(--t1);margin-bottom:4px">📂 Restore from Backup</div>'
      + '<div style="font-size:11px;color:var(--t2);margin-bottom:14px;line-height:1.6">Select a backup file (.json) previously downloaded from SmartStock Pro</div>'
      + '<input type="file" id="backup-file-input" accept=".json" onchange="Backup.previewRestore(this)" style="display:none">'
      + '<button class="btn-ghost btn-full" onclick="Utils.get(\'backup-file-input\').click()" style="margin-bottom:8px">📁 Choose Backup File</button>'
      + '<div id="restore-preview" style="display:none"></div>'
      + '</div>'

      // ── AUTO BACKUP REMINDER ─────────────────────────────────────────────
      + '<div style="background:var(--inb);border:1px solid var(--inbd);border-radius:var(--r12);padding:12px 14px;margin-top:4px">'
      + '<div style="font-size:12px;font-weight:700;color:var(--in);margin-bottom:4px">💡 Backup Tips</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.7">'
      + '• Back up <strong>every week</strong> or after a big sale<br>'
      + '• Save the file to Google Drive or WhatsApp yourself<br>'
      + '• Backup before updating the app or changing phones'
      + '</div></div>'
      + '</div>';
  },

  _statPill: function(icon, count, label) {
    return '<div style="background:var(--bg3);border-radius:var(--r8);padding:8px;text-align:center">'
      + '<div style="font-size:16px">' + icon + '</div>'
      + '<div style="font-size:14px;font-weight:800;color:var(--t1)">' + count + '</div>'
      + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em">' + label + '</div>'
      + '</div>';
  },

  _getDataSize: function() {
    var sales     = DB.getSales();
    var products  = DB.getProducts();
    var customers = DB.getCustomers();
    var raw       = JSON.stringify(localStorage).length;
    var kb        = (raw/1024).toFixed(1);
    var label     = raw > 1024000 ? (raw/1048576).toFixed(1)+'MB' : kb+'KB';
    return { sales: sales.length, products: products.length, customers: customers.length, label: label };
  },

  /* ══════════════════════════════════════════════════════════════
     EXPORT — download full backup as JSON
  ══════════════════════════════════════════════════════════════ */
  exportData: function() {
    try {
      var settings  = DB.getSettings();
      var bizName   = (settings.bizName || 'SmartStock').replace(/[^a-zA-Z0-9]/g,'_');
      var today     = Utils.today();

      // Collect ALL data keys
      var data = {
        _meta: {
          version:     'SmartStock Pro V5',
          exportedAt:  new Date().toISOString(),
          exportedBy:  (Auth.currentUser||{}).name || '',
          bizName:     settings.bizName || '',
          date:        today,
        },
      };

      // Export every key from localStorage
      var keys = [
        'settings','users','products','sales','customers','suppliers',
        'expenses','employees','payroll','notifications','payments',
        'allocations','purchaseOrders','grns','supplierBills','quotations',
        'employeeLoans','monthlyStatements','support_tickets','support_messages',
        'businesses','branches','customRoles','auditLogs','activityLogs',
      ];

      keys.forEach(function(key) {
        try {
          var val = DB.get(key);
          if (val !== null && val !== undefined) data[key] = val;
        } catch(e) {}
      });

      // Also grab any other SS keys in localStorage
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith('ssp_') && !data[k]) {
          try { data[k] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
        }
      }

      var json     = JSON.stringify(data, null, 2);
      var blob     = new Blob([json], {type:'application/json'});
      var url      = URL.createObjectURL(blob);
      var filename = bizName + '_backup_' + today + '.json';

      var a = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);

      // Record last backup date
      Utils.storage.set('lastBackupDate', today);
      Toast.show('Backup downloaded: ' + filename + ' ✓', 'ok');

      // Refresh the panel
      setTimeout(function(){
        var el = Utils.get('backup-container');
        if (el) Backup.renderPanel(el);
      }, 500);

    } catch(e) {
      Toast.show('Backup failed: ' + e.message, 'err');
    }
  },

  /* ══════════════════════════════════════════════════════════════
     RESTORE — preview then confirm
  ══════════════════════════════════════════════════════════════ */
  previewRestore: function(input) {
    var file = input.files[0];
    if (!file) return;

    var preview = Utils.get('restore-preview');
    if (!preview) return;

    preview.style.display = 'block';
    preview.innerHTML = '<div style="text-align:center;padding:12px;color:var(--t3)">Reading file...</div>';

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        var meta = data._meta || {};

        if (!meta.version || !meta.version.includes('SmartStock')) {
          preview.innerHTML = '<div style="color:var(--er);padding:10px;font-size:12px">❌ Invalid backup file. Only SmartStock Pro backups are supported.</div>';
          return;
        }

        var salesCount    = (data.sales||[]).length;
        var prodCount     = (data.products||[]).length;
        var custCount     = (data.customers||[]).length;
        var expCount      = (data.expenses||[]).length;

        Backup._pendingRestore = data;

        preview.innerHTML = '<div style="background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r10);padding:14px;margin-top:10px">'
          + '<div style="font-size:13px;font-weight:700;color:var(--ok);margin-bottom:10px">✅ Valid Backup Found</div>'
          + '<div style="font-size:11px;color:var(--t2);margin-bottom:10px;line-height:1.8">'
          + '📅 Exported: <strong>' + (meta.date||'Unknown') + '</strong><br>'
          + '🏢 Business: <strong>' + Utils.esc(meta.bizName||'Unknown') + '</strong><br>'
          + '🧾 Sales: <strong>' + salesCount + '</strong> · '
          + '📦 Products: <strong>' + prodCount + '</strong> · '
          + '👥 Customers: <strong>' + custCount + '</strong>'
          + '</div>'
          + '<div style="background:var(--wab);border-radius:var(--r8);padding:10px;margin-bottom:12px;font-size:11px;color:var(--wa)">'
          + '⚠️ <strong>Warning:</strong> This will replace ALL current data. Your existing data will be overwritten.'
          + '</div>'
          + '<button class="btn-primary btn-full" onclick="Backup.confirmRestore()" style="background:var(--ok)">🔄 Restore This Backup</button>'
          + '</div>';

      } catch(err) {
        preview.innerHTML = '<div style="color:var(--er);padding:10px;font-size:12px">❌ Could not read file: ' + Utils.esc(err.message) + '</div>';
      }
    };
    reader.readAsText(file);
  },

  _pendingRestore: null,

  confirmRestore: function() {
    var data = Backup._pendingRestore;
    if (!data) { Toast.show('No backup loaded','err'); return; }

    Modal.open({
      title: '⚠️ Confirm Restore', barColor: 'var(--er)',
      body:  '<div style="text-align:center;padding:16px 0">'
           + '<div style="font-size:48px;margin-bottom:14px">🔄</div>'
           + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:8px">Are you absolutely sure?</div>'
           + '<div style="font-size:12px;color:var(--t2);line-height:1.7;max-width:280px;margin:0 auto">'
           + 'All current data on this device will be permanently replaced with the backup from <strong>' + (data._meta&&data._meta.date||'unknown date') + '</strong>.'
           + '</div></div>',
      footer: '<button class="btn-ghost" style="flex:1" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1;background:var(--er)" onclick="Backup.executeRestore()">🔄 Yes, Restore</button>',
    });
  },

  executeRestore: function() {
    var data = Backup._pendingRestore;
    if (!data) return;

    try {
      var meta = data._meta || {};
      var count = 0;

      // Restore all data keys
      var keys = [
        'settings','users','products','sales','customers','suppliers',
        'expenses','employees','payroll','notifications','payments',
        'allocations','purchaseOrders','grns','supplierBills','quotations',
        'employeeLoans','monthlyStatements','support_tickets',
        'businesses','branches','customRoles','auditLogs',
      ];

      keys.forEach(function(key) {
        if (data[key] !== undefined) {
          try {
            DB.set(key, data[key]);
            count++;
          } catch(e) {}
        }
      });

      // Restore any ssp_ prefixed keys
      Object.keys(data).forEach(function(key) {
        if (key.startsWith('ssp_')) {
          try {
            localStorage.setItem(key, JSON.stringify(data[key]));
            count++;
          } catch(e) {}
        }
      });

      Backup._pendingRestore = null;
      Toast.show('✅ Restore complete — ' + count + ' data categories restored', 'ok');
      Modal.close();

      // Reload the app
      setTimeout(function() { location.reload(); }, 1500);

    } catch(e) {
      Toast.show('Restore failed: ' + e.message, 'err');
    }
  },

  /* ── Quick modal triggered from More menu ─────────────────────────────── */
  _openBackupModal: function() {
    Modal.open({
      title: '💾 Data Backup & Restore', barColor: 'var(--ok)',
      body:   '<div id="backup-container" style="min-height:200px"></div>',
      footer: '<button class="btn-primary btn-full" onclick="Modal.close()">Close</button>',
    });
    setTimeout(function() {
      var el = Utils.get('backup-container');
      if (el) Backup.renderPanel(el);
    }, 150);
  },
};
