/* SmartStock Pro — Shared Component Builders */
const Components = {
  badge(label){ return `<span class="badge ${Utils.statusClass(label)}">${Utils.esc(label)}</span>`; },

  kpiCard({label,value,change,up,icon,color,bg}){
    return `<div class="kpi-card animate-in" style="--kpi-color:${color};--kpi-bg:${bg}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" style="color:${color}">${value}</div>
      <div class="kpi-change ${up?'up':'down'}"><span>${up?'▲':'▼'}</span> ${change} this month</div>
      <div class="kpi-icon">${icon}</div></div>`;
  },

  barChart(data, labels, color='var(--color-gold)'){
    const max=Math.max(...data);
    const bars=data.map((v,i)=>`<div class="chart-bar" style="height:${Math.max(4,(v/max)*85)}%;background:linear-gradient(180deg,${color},${color}88)" data-val="${labels[i]}: ${v}" title="${labels[i]}: ${v}"></div>`).join('');
    return `<div class="chart-area">${bars}</div><div class="chart-labels">${labels.map(l=>`<span>${l}</span>`).join('')}</div>`;
  },

  lineChart(data, labels, color='var(--color-gold)'){
    const h=180,max=Math.max(...data),min=Math.min(...data);
    const pts=data.map((v,i)=>{
      const x=(i/(data.length-1))*96+2;
      const y=h-((v-min)/(max-min||1))*(h-24)-8;
      return `${x},${y}`;
    });
    const area=`M${pts.join('L')} L${96+2},${h} L2,${h} Z`;
    const id='lg'+Math.random().toString(36).slice(2,7);
    return `<div class="chart-line-wrap"><svg viewBox="0 0 100 ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${id})"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="0.8"/>
      ${pts.map(p=>`<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="1.5" fill="${color}"/>`).join('')}
    </svg></div>`;
  },

  modal({id='ssp-modal',title,body,footer}){
    return `<div class="modal-overlay" id="${id}" onclick="if(event.target===this)Components.closeModal('${id}')">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title font-display">${title}</span>
          <button class="btn btn-icon btn-ghost" onclick="Components.closeModal('${id}')">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer?`<div class="modal-footer">${footer}</div>`:''}
      </div></div>`;
  },
  openModal(html){ const w=document.createElement('div');w.innerHTML=html;document.body.appendChild(w.firstElementChild); },
  closeModal(id='ssp-modal'){ const el=document.getElementById(id);if(el)el.remove(); },

  progressBar(pct,color='var(--color-gold)'){
    return `<div class="progress-bar"><div class="progress-fill" style="width:${Math.max(0,Math.min(100,pct))}%;background:${color}"></div></div>`;
  },

  icon(name,size=16,color='currentColor'){
    const icons={
      menu:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>`,
      plus:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
      edit:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      trash:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,
      eye:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
      check:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
      download:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
      send:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4z"/></svg>`,
      search:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
      bell:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`,
      filter:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
      refresh:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`,
      print:`<svg width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
    };
    return icons[name]||'';
  },
};
