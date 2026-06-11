var Charts = {
  bar(data, labels, color) {
    color = color || 'gold';
    const max = Math.max(...data, 1);
    const bars = data.map((v,i) => `
      <div class="bar-col">
        <div class="bar-fill ${color}" style="height:${Math.max(4,Math.round((v/max)*100))}%" title="${labels[i]}: ${v}"></div>
        <div class="bar-lbl">${labels[i]}</div>
      </div>`).join('');
    return `<div class="bar-chart">${bars}</div>`;
  },

  weekBars(sales) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = new Date();
    const data = Array(7).fill(0);
    const lbls = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(today); d.setDate(d.getDate()-i);
      const ds = d.toISOString().slice(0,10);
      data[6-i] = sales.filter(s=>s.date===ds).reduce((a,s)=>a+(parseFloat(s.total)||0),0);
      lbls.push(days[d.getDay()]);
    }
    return this.bar(data, lbls, 'gold');
  },

  monthBars(sales, type) {
    const today = new Date();
    const data = [], lbls = [];
    for (let i=5; i>=0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
      const m = d.toISOString().slice(0,7);
      const v = sales.filter(s=>s.date&&s.date.startsWith(m)).reduce((a,s)=>a+(parseFloat(s.total)||0),0);
      data.push(v); lbls.push(d.toLocaleString('default',{month:'short'}));
    }
    return this.bar(data, lbls, type||'gold');
  },
};