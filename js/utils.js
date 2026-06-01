const Utils = {
  cur(v){ return CONFIG.company.currency+(parseFloat(v)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); },
  date(d){ return d ? new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'2-digit'}) : '—'; },
  uid(p='ID'){ return p+'-'+Date.now().toString(36).toUpperCase(); },
  esc(s){ const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; },
  $(s,c=document){ return c.querySelector(s); },
  $$(s,c=document){ return [...c.querySelectorAll(s)]; },
  set(id,html){ const e=document.getElementById(id);if(e)e.innerHTML=html; },
  val(id){ const e=document.getElementById(id);return e?e.value.trim():''; },
  today(){ return new Date().toISOString().slice(0,10); },
  storage:{ get(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}}, set(k,v){localStorage.setItem(k,JSON.stringify(v));}, del(k){localStorage.removeItem(k);} },
  statusBadge(s){
    const m={
      'In Stock':'sb sb-paid','Low Stock':'sb sb-partial','Out of Stock':'sb sb-credit',
      'Active':'sb sb-paid','VIP':'sb sb-info','Inactive':'sb sb-credit',
      'Paid':'sb sb-paid','Partial':'sb sb-partial','Credit':'sb sb-credit','Pending':'sb sb-partial','Overdue':'sb sb-credit',
    };
    return `<span class="${m[s]||'sb sb-info'}">${Utils.esc(s)}</span>`;
  },
  debounce(fn,ms=300){ let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}; },
};
function closeD(id){ const el=document.getElementById(id);if(el)el.classList.remove('on'); }
function openD(id){ const el=document.getElementById(id);if(el)el.classList.add('on'); }