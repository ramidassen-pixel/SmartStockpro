/* === notifications.js ===
   Alerts built from live business data. Opening a notification (or tapping ×) marks it read
   and removes it; it only comes back if the situation changes (e.g. stock drops further). */
var Notifs = {
  _list: [],

  _readKey: function() {
    var biz = (typeof DB !== 'undefined' && DB._bizId) || 'local';
    var uid = (typeof Auth !== 'undefined' && Auth.currentUser && Auth.currentUser.id) || 'user';
    return 'ssp_notif_read_' + biz + '_' + uid;
  },
  _getRead: function() {
    try { return JSON.parse(localStorage.getItem(this._readKey()) || '[]'); } catch (e) { return []; }
  },
  _setRead: function(keys) {
    try { localStorage.setItem(this._readKey(), JSON.stringify(keys)); } catch (e) {}
  },

  // Build every current alert. Each has a key that changes when the situation changes.
  _build: function() {
    var list = [];
    var today = Utils.today(), month = today.slice(0, 7);
    var cur = (DB.getSettings().currency) || '$';
    var stats = DB.stats();
    stats.outStock.forEach(function(p) {
      list.push({ key: 'out:' + p.id + ':' + (p.updatedAt || p.createdAt || ''), type: 'err', icon: 'box',
        title: 'Out of stock: ' + p.name, body: 'Reorder now — customers can\'t buy it.', go: 'products' });
    });
    var outIds = stats.outStock.map(function(p) { return p.id; });
    stats.lowStock.forEach(function(p) {
      if (outIds.indexOf(p.id) >= 0 || (parseFloat(p.qty) || 0) <= 0) return; // already shown as out of stock
      list.push({ key: 'low:' + p.id + ':' + p.qty, type: 'warn', icon: 'alert-triangle',
        title: 'Low stock: ' + p.name, body: 'Only ' + p.qty + ' left (minimum ' + (p.lowLevel || 5) + ').', go: 'products' });
    });
    // Supplier bills overdue or due within 3 days
    var soon = new Date(); soon.setDate(soon.getDate() + 3);
    var soonStr = soon.toISOString().slice(0, 10);
    DB.getSuppliers().forEach(function(s) {
      var bal = parseFloat(s.balance) || 0;
      if (bal > 0 && s.dueDate && s.dueDate <= soonStr) {
        var overdue = s.dueDate < today;
        list.push({ key: 'supp:' + s.id + ':' + s.dueDate + ':' + bal, type: overdue ? 'err' : 'warn', icon: 'building-warehouse',
          title: (overdue ? 'Supplier payment overdue: ' : 'Supplier payment due: ') + s.name,
          body: Utils.cur(bal, cur) + ' · due ' + Utils.date(s.dueDate), go: 'suppliers' });
      }
    });
    // Customer invoices unpaid for more than 30 days
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    var cutStr = cutoff.toISOString().slice(0, 10);
    var old = DB.getSales().filter(function(s) { return s.status !== 'Paid' && (parseFloat(s.balance) || 0) > 0 && s.date && s.date < cutStr; });
    if (old.length) {
      var owed = old.reduce(function(a, s) { return a + (parseFloat(s.balance) || 0); }, 0);
      list.push({ key: 'debt:' + today + ':' + old.length, type: 'warn', icon: 'receipt',
        title: old.length + ' invoice' + (old.length > 1 ? 's' : '') + ' unpaid for 30+ days',
        body: Utils.cur(owed, cur) + ' still owed by customers.', go: 'customers' });
    }
    // Salaries not yet paid this month
    var paid = DB.getPayroll().filter(function(p) { return p.month === month; }).map(function(p) { return p.employeeId; });
    var unpaid = DB.getEmployees().filter(function(e) { return paid.indexOf(e.id) < 0 && e.status === 'active'; });
    if (unpaid.length) {
      list.push({ key: 'salary:' + month + ':' + unpaid.length, type: 'info', icon: 'coins',
        title: unpaid.length + ' salary payment' + (unpaid.length > 1 ? 's' : '') + ' due',
        body: 'For ' + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + '.', go: 'salary' });
    }
    return list;
  },

  check: function() {
    var all = this._build();
    var read = this._getRead();
    // Forget read-marks for alerts that no longer exist (keeps storage small)
    var keys = all.map(function(n) { return n.key; });
    var keep = read.filter(function(k) { return keys.indexOf(k) >= 0; });
    if (keep.length !== read.length) this._setRead(keep);
    this._list = all.filter(function(n) { return keep.indexOf(n.key) < 0; });
    this._renderBadge();
    this._renderPanel();
    return this._list;
  },

  _renderBadge: function() {
    var badge = Utils.get('notif-badge');
    if (!badge) return;
    var n = this._list.length;
    if (n > 0) { badge.classList.remove('hidden'); badge.textContent = n > 9 ? '9+' : String(n); }
    else { badge.classList.add('hidden'); badge.textContent = ''; }
    var btn = Utils.get('notif-btn');
    if (btn) btn.setAttribute('aria-label', n ? 'Notifications, ' + n + ' unread' : 'Notifications');
  },

  _renderPanel: function() {
    var panel = Utils.get('notif-panel');
    if (!panel) return;
    var n = this._list.length;
    var ico = function(name, size) { return (typeof Icons !== 'undefined') ? Icons.svg(name, size) : ''; };
    var head = '<div class="notif-head">'
      + '<div><span class="nh-title">Notifications</span>' + (n ? '<span class="nh-count">' + n + '</span>' : '') + '</div>'
      + '<div class="nh-actions">'
      + (n ? '<button class="nh-btn" onclick="Notifs.markAllRead()">Mark all as read</button>' : '')
      + '<button class="nh-close" onclick="Notifs.close()" aria-label="Close notifications">' + ico('plus', 18) + '</button>'
      + '</div></div>';
    var body = n
      ? this._list.map(function(item, i) {
          return '<div class="notif-item n-' + item.type + '" role="button" tabindex="0" onclick="Notifs.open(' + i + ')" onkeydown="if(event.key===\'Enter\')Notifs.open(' + i + ')">'
            + '<div class="ni-icon">' + ico(item.icon, 18) + '</div>'
            + '<div class="ni-text"><div class="notif-item-title">' + Utils.esc(item.title) + '</div>'
            + '<div class="ni-body">' + Utils.esc(item.body || '') + '</div></div>'
            + '<button class="ni-dismiss" onclick="event.stopPropagation();Notifs.dismiss(' + i + ')" aria-label="Mark as read">' + ico('plus', 16) + '</button>'
            + '</div>';
        }).join('')
      : '<div class="notif-empty"><div class="ne-icon">' + ico('bell', 26) + '</div><div class="ne-title">You\'re all caught up</div><div class="ne-sub">New alerts about stock, payments and salaries will appear here.</div></div>';
    panel.innerHTML = head + '<div class="notif-list" id="notif-list">' + body + '</div>';
  },

  _markRead: function(key) {
    var read = this._getRead();
    if (read.indexOf(key) < 0) { read.push(key); this._setRead(read); }
  },

  // Open = mark read, remove, and go to the page that fixes it
  open: function(i) {
    var item = this._list[i]; if (!item) return;
    this._markRead(item.key);
    this.close();
    this.check();
    if (item.go && typeof Router !== 'undefined') Router.go(item.go);
  },

  dismiss: function(i) {
    var item = this._list[i]; if (!item) return;
    var el = document.querySelectorAll('#notif-list .notif-item')[i];
    var self = this;
    var done = function() { self._markRead(item.key); self.check(); };
    if (el && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('ni-out'); setTimeout(done, 180); }
    else done();
  },

  markAllRead: function() {
    var read = this._getRead();
    this._list.forEach(function(n) { if (read.indexOf(n.key) < 0) read.push(n.key); });
    this._setRead(read);
    this.check();
    if (typeof Toast !== 'undefined') Toast.show('All notifications marked as read', 'ok');
  },

  close: function() {
    var p = Utils.get('notif-panel');
    if (p) p.classList.add('hidden');
  },
};

// Close the panel when clicking anywhere outside it
document.addEventListener('click', function(e) {
  var p = document.getElementById('notif-panel');
  if (!p || p.classList.contains('hidden')) return;
  if (!document.contains(e.target)) return; // the panel re-rendered under the click
  if (p.contains(e.target) || (e.target.closest && e.target.closest('#notif-btn'))) return;
  p.classList.add('hidden');
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') Notifs.close(); });
