const Toast = {
  _t: null,
  show(msg, type='ok', dur=3000) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(this._t);
    const icons = {ok:'✅',er:'❌',wa:'⚠️',gd:'💛'};
    el.className = type;
    el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${Utils.esc(msg)}</span>`;
    this._t = setTimeout(() => { el.className=''; el.innerHTML=''; }, dur);
  }
};