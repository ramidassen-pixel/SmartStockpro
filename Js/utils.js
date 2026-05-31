/* SmartStock Pro — Utilities */
const Utils = {
  currency(val) {
    return CONFIG.company.currency + (parseFloat(val)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  },
  date(d) { return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'2-digit'}); },
  uid(prefix='ID') { return `${prefix}-${Date.now().toString(36).toUpperCase()}`; },
  debounce(fn,ms=300){ let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}; },
  statusClass(s) {
    const m={'In Stock':'badge-success','Low Stock':'badge-warning','Out of Stock':'badge-error',
             'Active':'badge-success','Inactive':'badge-error','VIP':'badge-gold',
             'Paid':'badge-success','Pending':'badge-warning','Overdue':'badge-error','NEW':'badge-gold'};
    return m[s]||'badge-info';
  },
  esc(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; },
  $(sel,ctx=document)  { return ctx.querySelector(sel); },
  $$(sel,ctx=document) { return [...ctx.querySelectorAll(sel)]; },
  render(el,html){ if(typeof el==='string')el=document.querySelector(el); if(el)el.innerHTML=html; },
  storage:{
    get(k){ try{return JSON.parse(localStorage.getItem(k));}catch{return null;} },
    set(k,v){ localStorage.setItem(k,JSON.stringify(v)); },
    del(k){ localStorage.removeItem(k); },
  },
};
