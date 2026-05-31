/* SmartStock Pro — Reports Page */
const Reports = {
  render() {
    const rows = (items) => items.map(i=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--color-border);font-weight:${i.bold?700:400};font-size:${i.bold?14:13}px">
        <span style="color:${i.bold?'var(--color-text)':'var(--color-text-sec)'}">${i.label}</span>
        <span style="color:${i.pos?'var(--color-success)':'var(--color-error)'};font-family:var(--font-mono)">${i.val}</span>
      </div>`).join('');

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Financial Reports</h1>
          <p class="page-subtitle">Business performance summary</p></div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm">${Components.icon('download',13)} Export PDF</button>
          <button class="btn btn-primary btn-sm" onclick="window.print()">${Components.icon('print',13)} Print</button>
        </div>
      </div>
      <div class="grid g-2 mb-4">
        <div class="card animate-in">
          <div class="font-display mb-4" style="font-size:13px;font-weight:600">📊 Profit & Loss — May 2024</div>
          ${rows([
            {label:'Gross Revenue',      val:'$84,320',  pos:true },
            {label:'Cost of Goods',      val:'($45,200)',pos:false},
            {label:'Gross Profit',       val:'$39,120',  pos:true },
            {label:'Operating Expenses', val:'($18,940)',pos:false},
            {label:'Net Profit',         val:'$20,180',  pos:true, bold:true},
          ])}
        </div>
        <div class="card animate-in">
          <div class="font-display mb-4" style="font-size:13px;font-weight:600">💵 Cash Flow — May 2024</div>
          ${rows([
            {label:'Opening Balance',    val:'$32,400',  pos:true },
            {label:'Cash In (Sales)',    val:'$71,280',  pos:true },
            {label:'Cash Out (Expenses)',val:'($18,940)',pos:false},
            {label:'Cash Out (Purchases)',val:'($34,100)',pos:false},
            {label:'Closing Balance',    val:'$50,640',  pos:true, bold:true},
          ])}
        </div>
      </div>
      <div class="card animate-in">
        <div class="font-display mb-4" style="font-size:13px;font-weight:600">📅 Annual Overview 2024</div>
        <div class="grid g-4">
          ${['Q1','Q2','Q3','Q4'].map((q,i)=>`
          <div style="background:var(--color-bg);border-radius:8px;padding:14px;border:1px solid var(--color-border)">
            <div class="text-sec text-xs mb-2">${q} 2024</div>
            <div class="font-display text-gold" style="font-size:20px;font-weight:700">$${[62,78,84,91][i]}K</div>
            <div class="text-success text-xs mt-1">▲ ${[8,12,18,22][i]}% YoY</div>
          </div>`).join('')}
        </div>
      </div>`;
  },
};
