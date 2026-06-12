var Utils = {
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
  esc(s) { const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; },
  get(id) { return document.getElementById(id); },
  val(id) { const e=document.getElementById(id); return e ? e.value.trim() : ''; },
  set(id, html) { const e=document.getElementById(id); if(e) e.innerHTML = html; },
  show(id) { const e=document.getElementById(id); if(e) e.classList.remove('hidden'); },
  hide(id) { const e=document.getElementById(id); if(e) e.classList.add('hidden'); },
  toggle(id) { const e=document.getElementById(id); if(e) e.classList.toggle('hidden'); },
  q(sel, ctx) { return (ctx||document).querySelector(sel); },
  qq(sel, ctx) { return [...(ctx||document).querySelectorAll(sel)]; },
  debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms||300); }; },
  fmt(n, dec) { return (parseFloat(n)||0).toFixed(dec||2); },
  pct(a, b) { return b ? Math.round((a/b)*100) : 0; },
  storage: {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k,v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  },
  statusBadge(s) {
    const m = {
      'Active':'badge-ok','Inactive':'badge-err','VIP':'badge-gold',
      'Paid':'badge-ok','Partial':'badge-warn','Credit':'badge-err','Pending':'badge-warn','Overdue':'badge-err',
      'In Stock':'badge-ok','Low Stock':'badge-warn','Out of Stock':'badge-err',
      'Approved':'badge-ok','Pending':'badge-warn','Rejected':'badge-err',
    };
    return `<span class="badge ${m[s]||'badge-info'}">${Utils.esc(s)}</span>`;
  },
};

// Toast system
var Toast = {
  show(msg, type, dur) {
    const id = 'toast-' + Date.now();
    const icons = {ok:'✅',err:'❌',warn:'⚠️',info:'ℹ️',gold:'💡'};
    const el = document.createElement('div');
    el.id = id;
    el.className = `toast toast-${type||'info'}`;
    el.innerHTML = `<span>${icons[type||'info']||'ℹ️'}</span><span>${Utils.esc(msg)}</span>`;
    const c = Utils.get('toast-container');
    if (c) c.appendChild(el);
    setTimeout(() => { const e=Utils.get(id); if(e) e.remove(); }, dur||3500);
  },
};

// Modal system
var Modal = {
  open({ title, sub, body, footer, barColor }) {
    const ov = Utils.get('modal-overlay');
    if (!ov) return;
    ov.innerHTML = `
      <div class="modal">
        <div class="modal-bar" style="${barColor?`background:${barColor}`:''}"></div>
        <div class="modal-head">
          <div><div class="modal-title">${title||''}</div>${sub?`<div class="modal-sub">${sub}</div>`:''}</div>
          <button class="modal-close" onclick="Modal.close()">✕</button>
        </div>
        <div class="modal-body">${body||''}</div>
        ${footer?`<div class="modal-foot">${footer}</div>`:''}
      </div>`;
    ov.classList.remove('hidden');
    ov.onclick = e => { if(e.target===ov) Modal.close(); };
  },
  close() {
    const ov = Utils.get('modal-overlay');
    if (ov) { ov.classList.add('hidden'); ov.innerHTML = ''; }
  },
};

// Confirm dialog
function confirmDel(msg, onConfirm) {
  Modal.open({
    title: 'Confirm Delete',
    sub: msg,
    barColor: 'var(--err)',
    body: `<p style="font-size:13px;color:var(--text2);line-height:1.6">${Utils.esc(msg)}</p>`,
    footer: `<button class="btn-ghost btn-full" onclick="Modal.close()">Cancel</button>
             <button class="btn-danger btn-full" id="confirm-del-btn">Delete</button>`,
  });
  setTimeout(() => {
    const btn = Utils.get('confirm-del-btn');
    if (btn) btn.onclick = () => { Modal.close(); onConfirm(); };
  }, 50);
}