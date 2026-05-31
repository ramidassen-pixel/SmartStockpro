/* SmartStock Pro — Toast Notifications */
const Toast = {
  show(msg, type='info', duration=3500) {
    const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    const id = 'toast-'+Date.now();
    const el = document.createElement('div');
    el.className = `toast ${type}`; el.id = id;
    el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${Utils.esc(msg)}</span>`;
    document.getElementById('toast-container')?.appendChild(el);
    setTimeout(()=>document.getElementById(id)?.remove(), duration);
  },
};
