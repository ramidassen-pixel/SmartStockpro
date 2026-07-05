/* === utils.js === */
var Utils = {
  // Dual-currency: format a USD-based price in both USD and LRD using the saved exchange rate
  curDual: function(usdAmount, opts) {
    opts = opts || {};
    var n = parseFloat(usdAmount) || 0;
    var settings = {};
    try { settings = DB.getSettings(); } catch(e) {}
    var rate = parseFloat(settings.lrdRate) || 0;
    var usdStr = Utils.cur(n, '$');
    if (!rate) return usdStr;
    var lrd = n * rate;
    var lrdStr = 'L$' + lrd.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0});
    if (opts.lrdOnly) return lrdStr;
    if (opts.stacked) return usdStr + '<br><span style="font-size:0.8em;color:var(--t3)">' + lrdStr + '</span>';
    return usdStr + ' <span style="color:var(--t3)">(' + lrdStr + ')</span>';
  },

  // Convert an amount FROM one currency basis TO the other using saved rate
  convert: function(amount, fromCur, toCur) {
    var settings = {};
    try { settings = DB.getSettings(); } catch(e) {}
    var rate = parseFloat(settings.lrdRate) || 0;
    var n = parseFloat(amount) || 0;
    if (!rate || fromCur === toCur) return n;
    if (fromCur === 'USD' && toCur === 'LRD') return n * rate;
    if (fromCur === 'LRD' && toCur === 'USD') return n / rate;
    return n;
  },

  // Plain whole-number formatter with thousands separators (e.g. 5000 -> "5,000")
  num: function(v) {
    var n = Math.round(parseFloat(v) || 0);
    return n.toLocaleString('en-US');
  },

  cur: function(v, sym) {
    try { if (!sym) { try { sym = DB.getSettings().currency || '$'; } catch(e2) { sym = '$'; } } } catch(e) { sym = '$'; }
    try {
      var n = parseFloat(v) || 0;
      var fixed = n.toFixed(2);
      var parts = fixed.split('.');
      var intPart = parts[0];
      var result = '';
      var count = 0;
      for (var i = intPart.length - 1; i >= 0; i--) {
        if (count > 0 && count % 3 === 0) result = ',' + result;
        result = intPart[i] + result;
        count++;
      }
      return sym + result + '.' + parts[1];
    } catch(e) { return (sym||'$') + '0.00'; }
  },
  date(d) { return d ? new Date(d).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'2-digit'}) : '—'; },
  today() { return new Date().toISOString().slice(0,10); },
  uid(p) { return (p||'ID') + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase(); },
  esc(s) { var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; },
  get(id) { return document.getElementById(id); },
  val(id) { var e=document.getElementById(id); return e ? e.value.trim() : ''; },
  set(id, html) { var e=document.getElementById(id); if(e) e.innerHTML = html; },
  show(id) { var e=document.getElementById(id); if(e) e.classList.remove('hidden'); },
  hide(id) { var e=document.getElementById(id); if(e) e.classList.add('hidden'); },
  toggle(id) { var e=document.getElementById(id); if(e) e.classList.toggle('hidden'); },
  q(sel, ctx) { return (ctx||document).querySelector(sel); },
  qq(sel, ctx) { return [...(ctx||document).querySelectorAll(sel)]; },
  debounce(fn, ms) { var t; return (/*...a*/) => { clearTimeout(t); t = setTimeout(() => fn(/*...a*/), ms||300); }; },
  fmt(n, dec) { return (parseFloat(n)||0).toFixed(dec||2); },
  pct(a, b) { return b ? Math.round((a/b)*100) : 0; },
  storage: {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k,v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  },
  statusBadge(s) {
    var m = {
      'Active':'badge-ok','Inactive':'badge-err','VIP':'badge-gold',
      'Paid':'badge-ok','Partial':'badge-warn','Credit':'badge-err','Pending':'badge-warn','Overdue':'badge-err',
      'In Stock':'badge-ok','Low Stock':'badge-warn','Out of Stock':'badge-err',
      'Approved':'badge-ok','Pending':'badge-warn','Rejected':'badge-err',
    };
    return '<span class="badge ' + (m[s]||'badge-info') + '">' + (Utils.esc(s)) + '</span>';
  },
};

// Toast system
var Toast = {
  show(msg, type, dur) {
    var id = 'toast-' + Date.now();
    var icons = {ok:'✅',err:'❌',warn:'⚠️',info:'ℹ️',gold:'💡'};
    var el = document.createElement('div');
    el.id = id;
    el.className = 'toast toast-' + (type||'info');
    el.innerHTML = '<span>' + (icons[type||'info']||'ℹ️') + '</span><span>' + (Utils.esc(msg)) + '</span>';
    var c = Utils.get('toast-container');
    if (c) c.appendChild(el);
    setTimeout(function() { var e=Utils.get(id); if(e) e.remove(); }, dur||3500);
  },
};

// Modal system
var Modal = {
  open({ title, sub, body, footer, barColor }) {
    var ov = Utils.get('modal-overlay');
    if (!ov) return;
    ov.innerHTML = '\n      <div class="modal">\n        <div class="modal-bar" style="' + (barColor?`background:${barColor}`:'') + '"></div>\n        <div class="modal-head">\n          <div><div class="modal-title">' + (title||'') + '</div>' + (sub?`<div class="modal-sub">${sub}</div>`:'') + '</div>\n          <button class="modal-close" onclick="Modal.close()">✕</button>\n        </div>\n        <div class="modal-body">' + (body||'') + '</div>\n        ' + (footer?`<div class="modal-foot">${footer}</div>`:'') + '\n      </div>';
    ov.classList.remove('hidden');
    ov.onclick = function(e) { if(e.target===ov) Modal.close(); };
  },
  close() {
    var ov = Utils.get('modal-overlay');
    if (ov) { ov.classList.add('hidden'); ov.innerHTML = ''; }
  },
};

// Confirm dialog
function confirmDel(msg, onConfirm) {
  Modal.open({
    title: 'Confirm Delete',
    sub: msg,
    barColor: 'var(--err)',
    body: '<p style="font-size:13px;color:var(--text2);line-height:1.6">' + (Utils.esc(msg)) + '</p>',
    footer: '<button class="btn-ghost btn-full" onclick="Modal.close()">Cancel</button>\n             <button class="btn-danger btn-full" id="confirm-del-btn">Delete</button>',
  });
  setTimeout(function() {
    var btn = Utils.get('confirm-del-btn');
    if (btn) btn.onclick = function() { Modal.close(); onConfirm(); };
  }, 50);
}
