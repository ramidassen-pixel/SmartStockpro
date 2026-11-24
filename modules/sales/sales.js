/* === sales.js === */
var Sales = {
  filter: 'All',
  cart: [],
  discount: 0,

  // Invoice number shown to people (falls back to the internal id for older sales)
  no: function(s) { return (s && (s.invoiceNo || s.id)) || ''; },
  // Next number after e.g. "001" → "002", "INV-0099" → "INV-0100", "RS/2026/7" → "RS/2026/8"
  nextInvoiceNo: function(no) {
    var m = String(no || '').trim().match(/^(.*?)(\d+)(\D*)$/);
    if (!m) return '';
    var n = String(parseInt(m[2], 10) + 1);
    while (n.length < m[2].length) n = '0' + n;
    return m[1] + n + m[3];
  },
  // Discount amount of a saved sale (new sales store discountAmount; older ones only a %)
  discAmt: function(s) {
    if (s.discountAmount != null) return parseFloat(s.discountAmount) || 0;
    return (s.discount || 0) > 0 ? (parseFloat(s.subtotal) || 0) * (s.discount / 100) : 0;
  },
  discLabel: function(s) {
    if (s.discountType === 'amount') return 'Discount';
    var p = s.discountValue != null ? s.discountValue : s.discount;
    return 'Discount (' + (Math.round((parseFloat(p) || 0) * 100) / 100) + '%)';
  },
  // Discount currently entered in the New Sale form, as % or a fixed amount
  _formDisc: function(sub) {
    var v = Math.max(0, parseFloat(Utils.val('s-disc')) || 0);
    var t = (Utils.get('s-disc-type') || {}).value === 'amount' ? 'amount' : 'percent';
    var amt = t === 'amount' ? Math.min(v, sub) : sub * Math.min(v, 100) / 100;
    return { type: t, value: v, amount: Math.round(amt * 100) / 100, pct: sub > 0 ? (amt / sub) * 100 : 0 };
  },

  // ── RENDER SALES LIST ──────────────────────────────────────────────────────
  render() {
    var pg = Utils.get('pg-sales');
    if (!pg) return;
    var everything = DB.getSales();
    var fOn      = this._fCount() > 0;
    var all      = fOn ? this._applyF(everything) : everything;   // totals and chips follow the Filters
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var filtered = this.filter === 'All' ? all : all.filter(function(s){ return s.status === Sales.filter; });
    var totalRev    = all.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var collected   = all.filter(function(s){ return s.status==='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var partPaid    = all.filter(function(s){ return s.status==='Partial'; }).reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); }, 0);
    var outstanding = all.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);

    // Draw only the first rows (drawing all ~2,800 invoices took ~10s on a phone).
    // "Show more" adds more; totals, chips and Select still use the whole list.
    var limit = this._limit || this.PAGE;
    var more  = filtered.length - limit;
    var rows = filtered.slice(0, limit).map(function(s) {
      var progress = s.status==='Partial'
        ? '<div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:'+Math.min(100,Math.round(((parseFloat(s.amountPaid)||0)/(parseFloat(s.total)||1))*100))+'%;background:var(--wa)"></div></div>'
          + '<div style="font-size:10px;color:var(--wa);margin-top:3px;font-family:var(--fm)">Paid '+Utils.cur(s.amountPaid||0,cur)+' · Bal '+Utils.cur(s.balance||0,cur)+'</div></div>'
        : '';
      var payBtn = s.status!=='Paid'
        ? '<button class="btn-ok btn-sm" onclick="event.stopPropagation();Sales.openPayBalance(\''+s.id+'\')">💳 Pay</button>'
        : '';
      var selMode = Sales._selMode, on = !!Sales._sel[s.id];
      return '<div class="list-item'+(selMode?' sel-row'+(on?' sel-on':''):'')+'" data-sid="'+s.id+'" onclick="'+(selMode?'Sales.toggleSel(\''+s.id+'\')':'Sales.viewInvoice(\''+s.id+'\')')+'">'
        + (selMode
            ? '<span class="sel-box" role="checkbox" aria-checked="'+on+'" aria-label="Select invoice '+Utils.esc(Sales.no(s))+'"></span>'
            : '<div class="list-icon" style="background:var(--gb3);border-color:rgba(201,168,76,.15);font-size:20px">🧾</div>')
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
        + '<div class="list-meta">'+Utils.esc(Sales.no(s))+' · '+Utils.date(s.date)+'</div>'
        + progress
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val">'+Utils.cur(s.total,cur)+'</div>'
        + '<div style="margin-top:4px">'+Utils.statusBadge(s.status||'Paid')+'</div>'
        + '<div class="list-actions">'
        + '<button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Sales.printReceipt(\''+s.id+'\')" title="Print">🖨</button>'
        + payBtn
        + '<button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Sales.del(\''+s.id+'\')">🗑</button>'
        + '</div></div></div>';
    }).join('');

    var emptyState = '<div class="empty"><div class="empty-icon">🧾</div>'
      + (fOn
          ? '<div class="empty-title">No sales match these filters</div>'
            + '<div class="empty-action"><button class="btn-ghost btn-sm" onclick="Sales.clearF()">Clear filters</button></div></div>'
          : '<div class="empty-title">No '+(this.filter!=='All'?this.filter+' ':'')+'sales yet</div>'
            + '<div class="empty-sub">Tap "+ New Sale" to get started</div>'
            + '<div class="empty-action"><button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button></div></div>');

    var chips = ['All','Paid','Partial','Credit'].map(function(f){
      var cnt = f==='All' ? all.length : all.filter(function(s){ return s.status===f; }).length;
      return '<div class="chip'+(Sales.filter===f?' active':'')+'" onclick="Sales.setFilter(\''+f+'\')">'+f+' ('+cnt+')</div>';
    }).join('');

    // Privacy lock (same as the dashboard): the money totals show $•••• until unlocked
    var locked = typeof Privacy !== 'undefined' && Privacy.masked();
    function pm(val) { return locked ? cur + '••••' : Utils.cur(val, cur); }
    var eyeBtn = (typeof Privacy !== 'undefined')
      ? '<button class="pv-toggle'+(locked?'':' pv-on')+'" onclick="Privacy.toggle()" title="'+(locked?'Show figures':'Hide figures')+'" aria-label="'+(locked?'Show sales figures':'Hide sales figures')+'" aria-pressed="'+(!locked)+'">'
        + Icons.svg(locked?'eye-off':'eye',20) + '<span>'+(locked?'Show':'Hide')+'</span></button>'
      : '';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Sales</div><div class="page-sub">'+(fOn ? all.length+' of '+everything.length+' invoices' : all.length+' invoices total')+'</div></div>'
      + '<div class="page-actions">'
      + eyeBtn
      + (all.length ? '<button class="btn-ghost btn-sm" onclick="Sales.toggleSelectMode()">'+(this._selMode?'Done':'☑ Select')+'</button>' : '')
      + '<button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button></div>'
      + '</div>'
      + '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">💰</div><div class="kpi-label">Total Revenue</div><div class="kpi-value">'+pm(totalRev)+'</div><div class="kpi-sub">'+all.length+' invoices</div></div>'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">✅</div><div class="kpi-label">Collected</div><div class="kpi-value">'+pm(collected+partPaid)+'</div><div class="kpi-sub">'+all.filter(function(s){return s.status==='Paid';}).length+' paid</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">⏳</div><div class="kpi-label">Outstanding</div><div class="kpi-value">'+pm(outstanding)+'</div><div class="kpi-sub">'+all.filter(function(s){return s.status!=='Paid';}).length+' open</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📊</div><div class="kpi-label">Invoices</div><div class="kpi-value">'+all.length+'</div><div class="kpi-sub">'+(fOn?'Filtered':'All time')+'</div></div>'
      + '</div></div>'
      + this._fBar()
      + '<div class="chips">'+chips+'</div>'
      + (this._selMode ? this._selBar(filtered) : '')
      + '<div class="sec">'+(filtered.length ? '<div class="card">'+rows+'</div>'
          + (more > 0
              ? '<button class="btn-ghost btn-full" style="margin-top:12px" onclick="Sales.showMore()">Show more ('
                + more + ' more invoice' + (more === 1 ? '' : 's') + ')</button>'
                + '<div style="text-align:center;font-size:11px;color:var(--t3);margin-top:8px">Looking for one invoice? Use Filters → Invoice to find it fast.</div>'
              : '')
        : emptyState)+'</div>';
  },

  PAGE: 50,
  _limit: 0,
  showMore: function() { this._limit = (this._limit || this.PAGE) + 100; this.render(); },

  setFilter: function(f) { this.filter=f; this._sel={}; this._limit=0; this.render(); },

  // ── FILTERS (date, payment mode, customer, staff, invoice) ─────────────────
  f: { date: 'all', day: '', from: '', to: '', payment: [], customer: [], staff: [], invoice: '' },
  _fd: null,        // draft while the Filters screen is open
  _fTab: 'date',
  _fCustQ: '',

  _blankF: function() { return { date: 'all', day: '', from: '', to: '', payment: [], customer: [], staff: [], invoice: '' }; },
  _ymd: function(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  _dateRange: function(f) {
    var now = new Date(), t = this._ymd(now);
    switch (f.date) {
      case 'today': return [t, t];
      case 'yesterday': var y = this._ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)); return [y, y];
      case 'month': return [t.slice(0, 7) + '-01', t];
      case 'lastmonth':
        var a = new Date(now.getFullYear(), now.getMonth() - 1, 1), b = new Date(now.getFullYear(), now.getMonth(), 0);
        return [this._ymd(a), this._ymd(b)];
      case 'day': return f.day ? [f.day, f.day] : null;
      case 'range': return (f.from || f.to) ? [f.from || '0000-00-00', f.to || '9999-12-31'] : null;
    }
    return null;
  },
  _fCount: function(f) {
    f = f || this.f;
    return (this._dateRange(f) ? 1 : 0) + (f.payment.length ? 1 : 0) + (f.customer.length ? 1 : 0) + (f.staff.length ? 1 : 0) + (f.invoice.trim() ? 1 : 0);
  },
  _applyF: function(list, f) {
    f = f || this.f;
    var r = this._dateRange(f), inv = f.invoice.trim().toLowerCase();
    var pay = f.payment, cust = f.customer.map(function(c){ return c.toLowerCase(); }), staff = f.staff;
    return list.filter(function(s) {
      if (r && !((s.date || '') >= r[0] && (s.date || '') <= r[1])) return false;
      if (pay.length && pay.indexOf(s.payment || 'Cash') < 0) return false;
      if (cust.length && cust.indexOf(String(s.customer || 'Walk-in Customer').toLowerCase()) < 0) return false;
      if (staff.length && staff.indexOf(s.createdByName || 'Unknown') < 0) return false;
      if (inv && String(Sales.no(s)).toLowerCase().indexOf(inv) < 0) return false;
      return true;
    });
  },
  _dateLabel: function(f) {
    return { all: 'All Time', today: 'Today', yesterday: 'Yesterday', month: 'This Month', lastmonth: 'Last Month',
      day: f.day ? Utils.date(f.day) : 'Single Day', range: (f.from ? Utils.date(f.from) : '…') + ' – ' + (f.to ? Utils.date(f.to) : '…') }[f.date];
  },

  // Active filter pills under the Filters button
  _fBar: function() {
    var f = this.f, n = this._fCount(), pills = [];
    if (this._dateRange(f)) pills.push(['date', '📅 ' + this._dateLabel(f)]);
    if (f.payment.length) pills.push(['payment', '💳 ' + f.payment.join(', ')]);
    if (f.customer.length) pills.push(['customer', '👤 ' + (f.customer.length > 2 ? f.customer.length + ' customers' : f.customer.join(', '))]);
    if (f.staff.length) pills.push(['staff', '🧑‍💼 ' + f.staff.join(', ')]);
    if (f.invoice.trim()) pills.push(['invoice', '🧾 ' + f.invoice.trim()]);
    return '<div class="flt-bar">'
      + '<button class="flt-btn' + (n ? ' on' : '') + '" onclick="Sales.openFilters()" aria-label="Filters' + (n ? ', ' + n + ' active' : '') + '">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>'
      + 'Filters' + (n ? ' <span class="flt-n">' + n + '</span>' : '') + '</button>'
      + pills.map(function(p) {
          return '<span class="flt-pill">' + Utils.esc(p[1]) + '<button onclick="Sales.clearF(\'' + p[0] + '\')" aria-label="Remove filter">✕</button></span>';
        }).join('')
      + (n > 1 ? '<button class="flt-clear" onclick="Sales.clearF()">Clear all</button>' : '')
      + '</div>';
  },
  clearF: function(key) {
    if (!key) this.f = this._blankF();
    else if (key === 'date') { this.f.date = 'all'; this.f.day = ''; this.f.from = ''; this.f.to = ''; }
    else if (key === 'invoice') this.f.invoice = '';
    else this.f[key] = [];
    this._sel = {}; this._limit = 0;
    this.render();
  },

  openFilters: function() {
    this._fd = JSON.parse(JSON.stringify(this.f));
    this._fCustQ = '';
    Modal.open({
      title: 'Filters',
      body: '<div class="flt-wrap"><div class="flt-tabs" role="tablist" id="flt-tabs"></div><div class="flt-opts" id="flt-opts"></div></div>',
      footer: '<button class="btn-ghost" onclick="Sales._fClearDraft()">Clear all</button>'
            + '<button class="btn-primary" style="flex:1" id="flt-apply" onclick="Sales.applyFilters()">Apply</button>',
    });
    var m = document.querySelector('#modal-overlay .modal'); if (m) m.classList.add('flt-modal');
    this._fPaint();
  },
  _fClearDraft: function() { this._fd = this._blankF(); this._fCustQ = ''; this._fPaint(); },
  applyFilters: function() {
    this.f = this._fd; this._fd = null; this._sel = {}; this._limit = 0;
    Modal.close();
    this.render();
    var n = this._applyF(DB.getSales()).length;
    Toast.show(this._fCount() ? n + ' invoice' + (n !== 1 ? 's' : '') + ' match' : 'Filters cleared', 'ok');
  },
  fTab: function(t) { this._fTab = t; this._fPaint(); },

  _fSet: function(k, v) { this._fd[k] = v; this._fPaint(k === 'date' && (v === 'day' || v === 'range')); },
  _fVal: function(k, v) { this._fd[k] = v; this._fPaintCount(); },
  _fToggle: function(k, v) {
    var a = this._fd[k], i = a.indexOf(v);
    if (i < 0) a.push(v); else a.splice(i, 1);
    this._fPaint();
  },
  _fCust: function(q) {
    this._fCustQ = q; this._fPaintList();
  },

  _fPaintCount: function() {
    var btn = Utils.get('flt-apply'); if (!btn) return;
    var n = this._applyF(DB.getSales(), this._fd).length;
    btn.textContent = 'Show ' + n + ' invoice' + (n !== 1 ? 's' : '');
  },
  _fPaint: function(focusDate) {
    var d = this._fd, tab = this._fTab, self = this;
    var tabs = [['date', 'Date', !!this._dateRange(d)], ['payment', 'Payment Mode', d.payment.length], ['customer', 'Customer', d.customer.length],
      ['staff', 'Staff', d.staff.length], ['invoice', 'Invoice', !!d.invoice.trim()]];
    var tEl = Utils.get('flt-tabs'), oEl = Utils.get('flt-opts');
    if (!tEl || !oEl) return;
    tEl.innerHTML = tabs.map(function(t) {
      return '<button role="tab" aria-selected="' + (t[0] === tab) + '" class="flt-tab' + (t[0] === tab ? ' on' : '') + '" onclick="Sales.fTab(\'' + t[0] + '\')">'
        + t[1] + (t[2] ? '<span class="flt-dot" aria-label="(set)"></span>' : '') + '</button>';
    }).join('');

    var radio = function(on) { return '<span class="flt-radio' + (on ? ' on' : '') + '"></span>'; };
    var check = function(on) { return '<span class="flt-check' + (on ? ' on' : '') + '"></span>'; };
    var html = '';
    if (tab === 'date') {
      html = [['all', 'All Time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['month', 'This Month'], ['lastmonth', 'Last Month'], ['day', 'Single Day'], ['range', 'Date Range']]
        .map(function(o) {
          var on = d.date === o[0];
          var extra = '';
          if (on && o[0] === 'day') extra = '<input class="fi flt-in" type="date" id="flt-day" value="' + d.day + '" onclick="event.stopPropagation()" onchange="Sales._fVal(\'day\',this.value)">';
          if (on && o[0] === 'range') extra = '<div class="flt-range" onclick="event.stopPropagation()"><label>From<input class="fi flt-in" type="date" id="flt-from" value="' + d.from + '" onchange="Sales._fVal(\'from\',this.value)"></label>'
            + '<label>To<input class="fi flt-in" type="date" value="' + d.to + '" onchange="Sales._fVal(\'to\',this.value)"></label></div>';
          return '<div class="flt-opt' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" tabindex="0" onclick="Sales._fSet(\'date\',\'' + o[0] + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}">'
            + '<div class="flt-row">' + radio(on) + '<span>' + o[1] + '</span></div>' + extra + '</div>';
        }).join('');
    } else if (tab === 'payment' || tab === 'staff') {
      var key = tab === 'payment' ? 'payment' : 'staff';
      var counts = {};
      DB.getSales().forEach(function(s) { var v = key === 'payment' ? (s.payment || 'Cash') : (s.createdByName || 'Unknown'); counts[v] = (counts[v] || 0) + 1; });
      var vals = Object.keys(counts);
      if (key === 'payment') ['Cash', 'Mobile Money', 'Bank Transfer', 'Credit'].forEach(function(m) { if (vals.indexOf(m) < 0) vals.push(m); });
      vals.sort(function(a, b) { return (counts[b] || 0) - (counts[a] || 0); });
      html = '<div class="flt-hint">Pick one or more</div>' + vals.map(function(v) {
        var on = d[key].indexOf(v) >= 0;
        return '<div class="flt-opt' + (on ? ' on' : '') + '" role="checkbox" aria-checked="' + on + '" tabindex="0" data-v="' + Utils.esc(v) + '" onclick="Sales._fToggle(\'' + key + '\',this.dataset.v)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}">'
          + '<div class="flt-row">' + check(on) + '<span>' + Utils.esc(v) + '</span><span class="flt-cnt">' + (counts[v] || 0) + '</span></div></div>';
      }).join('');
    } else if (tab === 'customer') {
      html = '<input class="fi flt-in" id="flt-cust-q" placeholder="Search customer…" value="' + Utils.esc(this._fCustQ) + '" oninput="Sales._fCust(this.value)" autocomplete="off">'
        + (d.customer.length ? '<div class="flt-hint">' + d.customer.length + ' selected · <button class="flt-link" onclick="Sales._fd.customer=[];Sales._fPaint()">clear</button></div>' : '<div class="flt-hint">Pick one or more</div>')
        + '<div id="flt-cust-list"></div>';
    } else if (tab === 'invoice') {
      html = '<div class="flt-hint">Invoice number (or part of it)</div>'
        + '<input class="fi flt-in" id="flt-inv" placeholder="e.g. 3104 or CB-" value="' + Utils.esc(d.invoice) + '" oninput="Sales._fVal(\'invoice\',this.value)" autocomplete="off">';
    }
    oEl.innerHTML = html;
    if (tab === 'customer') this._fPaintList();
    this._fPaintCount();
    if (focusDate) { var inp = Utils.get(d.date === 'day' ? 'flt-day' : 'flt-from'); if (inp) inp.focus(); }
  },
  _fPaintList: function() {
    var box = Utils.get('flt-cust-list'); if (!box) return;
    var d = this._fd, q = this._fCustQ.trim().toLowerCase(), counts = {}, names = {};
    DB.getSales().forEach(function(s) {
      var n = s.customer || 'Walk-in Customer', k = n.toLowerCase();
      counts[k] = (counts[k] || 0) + 1; if (!names[k]) names[k] = n;
    });
    var sel = d.customer.map(function(c){ return c.toLowerCase(); });
    var keys = Object.keys(counts).filter(function(k) { return !q || k.indexOf(q) >= 0; })
      .sort(function(a, b) { var sa = sel.indexOf(a) >= 0, sb = sel.indexOf(b) >= 0; return sa !== sb ? (sa ? -1 : 1) : counts[b] - counts[a]; });
    var more = keys.length - 60;
    box.innerHTML = keys.slice(0, 60).map(function(k) {
      var on = sel.indexOf(k) >= 0;
      return '<div class="flt-opt' + (on ? ' on' : '') + '" role="checkbox" aria-checked="' + on + '" tabindex="0" data-v="' + Utils.esc(names[k]) + '" onclick="Sales._fToggleCust(this.dataset.v)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}">'
        + '<div class="flt-row"><span class="flt-check' + (on ? ' on' : '') + '"></span><span>' + Utils.esc(names[k]) + '</span><span class="flt-cnt">' + counts[k] + '</span></div></div>';
    }).join('') + (more > 0 ? '<div class="flt-hint">' + more + ' more — type to search</div>' : '') + (!keys.length ? '<div class="flt-hint">No customer matches</div>' : '');
  },
  _fToggleCust: function(name) {
    var a = this._fd.customer, k = name.toLowerCase(), i = -1;
    a.forEach(function(c, j) { if (c.toLowerCase() === k) i = j; });
    if (i < 0) a.push(name); else a.splice(i, 1);
    this._fPaint();   // redraws tabs, hint, list and the Apply count (search text is kept)
  },

  // ── MULTI-SELECT DELETE ────────────────────────────────────────────────────
  _selMode: false,
  _sel: {},
  _selDay: '',
  _selMonth: '',

  toggleSelectMode: function() {
    this._selMode = !this._selMode;
    this._sel = {}; this._selDay = ''; this._selMonth = '';
    this.render();
  },
  _shown: function() {
    var all = this._applyF(DB.getSales());
    return this.filter === 'All' ? all : all.filter(function(s){ return s.status === Sales.filter; });
  },
  _selBar: function(shown) {
    return '<div class="sel-bar" role="region" aria-label="Select invoices">'
      + '<div class="sel-top"><span id="sel-count" aria-live="polite">'+this._selText()+'</span>'
      + '<button class="btn-ghost btn-sm" onclick="Sales.toggleSelectMode()">Done</button></div>'
      + '<div class="sel-quick">'
      + '<button class="chip" onclick="Sales.selectAll()">All shown ('+shown.length+')</button>'
      + '<label class="sel-pick">Day <input type="date" value="'+this._selDay+'" onchange="Sales.selectDay(this.value)"></label>'
      + '<label class="sel-pick">Month <input type="month" value="'+this._selMonth+'" onchange="Sales.selectMonth(this.value)"></label>'
      + '<button class="chip" onclick="Sales.clearSel()">Clear</button>'
      + '</div>'
      + '<button class="btn-danger btn-full" onclick="Sales.deleteSelected()">🗑 Delete selected</button>'
      + '</div>';
  },
  _selText: function() {
    var ids = Object.keys(this._sel), cur = DB.getSettings().currency || '$';
    if (!ids.length) return 'Tap invoices to select them, or pick a day or month';
    var tot = DB.getSales().filter(function(s){ return Sales._sel[s.id]; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
    return ids.length + ' selected · ' + Utils.cur(tot, cur);
  },
  _updateSelBar: function() { var el = Utils.get('sel-count'); if (el) el.textContent = this._selText(); },
  toggleSel: function(id) {
    if (this._sel[id]) delete this._sel[id]; else this._sel[id] = true;
    var row = document.querySelector('[data-sid="'+id+'"]');
    if (row) { row.classList.toggle('sel-on', !!this._sel[id]); var cb = row.querySelector('.sel-box'); if (cb) cb.setAttribute('aria-checked', String(!!this._sel[id])); }
    this._updateSelBar();
  },
  _setSel: function(list, emptyMsg) {
    this._sel = {};
    list.forEach(function(s){ Sales._sel[s.id] = true; });
    this.render();
    if (!list.length && emptyMsg) Toast.show(emptyMsg, 'warn');
  },
  selectAll: function() { this._selDay = ''; this._selMonth = ''; this._setSel(this._shown()); },
  selectDay: function(v) {
    if (!v) return; this._selDay = v; this._selMonth = '';
    this._setSel(this._shown().filter(function(s){ return s.date === v; }), 'No invoices on ' + Utils.date(v));
  },
  selectMonth: function(v) {
    if (!v) return; this._selMonth = v; this._selDay = '';
    this._setSel(this._shown().filter(function(s){ return s.date && s.date.slice(0,7) === v; }), 'No invoices in that month');
  },
  clearSel: function() { this._selDay = ''; this._selMonth = ''; this._setSel([]); },

  deleteSelected: function() {
    var ids = Object.keys(this._sel);
    if (!ids.length) { Toast.show('Select at least one invoice first', 'warn'); return; }
    var cur = DB.getSettings().currency || '$';
    var picked = DB.getSales().filter(function(s){ return Sales._sel[s.id]; });
    var tot = picked.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
    var big = ids.length >= 20;
    Modal.open({
      title: 'Delete ' + ids.length + ' invoice' + (ids.length>1?'s':'') + '?', barColor: 'var(--er)',
      body: '<p style="font-size:14px;color:var(--t1);line-height:1.6;margin:0 0 10px">'
          + '<strong>' + ids.length + '</strong> invoice' + (ids.length>1?'s':'') + ' totalling <strong>' + Utils.cur(tot, cur) + '</strong> will be removed from this app on every device.</p>'
          + '<p style="font-size:12.5px;color:var(--t2);line-height:1.55;margin:0 0 12px">Stock isn\'t returned and payment records stay, the same as deleting one invoice. Your nightly backup keeps a copy for 30 days if you need them back.</p>'
          + (big ? '<div class="fg"><label class="fl" for="del-confirm">Type DELETE to confirm</label><input class="fi" id="del-confirm" autocomplete="off" placeholder="DELETE"></div>' : '')
          + '<div id="del-err" class="form-err hidden"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-danger" style="flex:1" onclick="Sales._confirmBulkDelete('+(big?'true':'false')+')">Delete ' + ids.length + '</button>',
    });
  },
  _confirmBulkDelete: function(big) {
    if (big && ((Utils.val('del-confirm') || '').trim().toUpperCase() !== 'DELETE')) {
      var e = Utils.get('del-err'); if (e) { e.textContent = 'Type DELETE to confirm.'; e.classList.remove('hidden'); }
      return;
    }
    var ids = Object.keys(this._sel);
    DB.deleteSales(ids);
    Modal.close();
    this._sel = {}; this._selMode = false; this._selDay = ''; this._selMonth = '';
    this.render();
    try { Notifs.check(); } catch (e2) {}
    Toast.show(ids.length + ' invoice' + (ids.length>1?'s':'') + ' deleted', 'warn');
  },

  // ── NEW SALE FORM ──────────────────────────────────────────────────────────
  openNewSale: function() {
    this.cart=[]; this.discount=0;
    ReceiptScan.reset();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var lrdRate  = settings.lrdRate  || 198; // LRD per 1 USD

    Modal.open({
      title:'New Sale', sub:'Create invoice', barColor:'var(--ok)',
      body:
        // ── Scan a paper receipt (fills the form below) ──────────
        ReceiptScan.bar()
        // ── Customer ─────────────────────────────────────────────
        + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">👤 Customer</div>'
        + '<div class="form-row" style="margin-bottom:0">'

        // Customer name with smart search
        + '<div class="fg" style="margin:0"><label class="fl">Customer Name</label>'
        + '<div style="position:relative">'
        + '<input class="fi" id="s-cust-name" placeholder="Type name or phone..." '
        + 'oninput="Sales.onCustNameInput(this.value)" autocomplete="off" style="font-weight:600">'
        + '<div id="s-cust-suggestions" style="position:absolute;top:100%;left:0;right:0;'
        + 'background:var(--bg2);border:1px solid var(--bd2);border-radius:0 0 var(--r10) var(--r10);'
        + 'z-index:200;max-height:200px;overflow-y:auto;display:none;box-shadow:var(--sh2)"></div>'
        + '</div>'
        + '<div id="s-cust-tag" style="display:none;font-size:11px;color:var(--ok);font-weight:600;margin-top:5px"></div>'
        + '</div>'

        + '<div class="fg" style="margin:0"><label class="fl">Customer Phone</label>'
        + '<input class="fi" id="s-cust-phone" type="tel" inputmode="tel" placeholder="+231 77 000 0000" autocomplete="off"></div>'
        + '</div>'
        + '<div class="form-row" style="margin:12px 0 0">'
        + '<div class="fg" style="margin:0"><label class="fl">Invoice No.</label>'
        + '<input class="fi" id="s-inv-no" placeholder="e.g. 001" autocomplete="off" value="' + Utils.esc(settings.invoiceNextNo || '') + '" style="font-family:var(--fm);font-weight:700">'
        + '<div id="s-inv-hint" style="font-size:10.5px;color:var(--t3);margin-top:4px">' + (settings.invoiceNextNo ? 'Next number filled in automatically' : 'Enter your first number — the next ones fill in automatically') + '</div></div>'
        + '<div class="fg" style="margin:0"><label class="fl">Date</label>'
        + '<input class="fi" id="s-date" type="date" value="' + Utils.today() + '"></div>'
        + '</div>'
        + '<input type="hidden" id="s-cust-id" value="">'
        + '</div>'

        // ── Products ──────────────────────────────────────────────
        + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📦 Products</div>'
        + '<div class="fg" style="margin-bottom:10px"><label class="fl">Search Products</label>'
        + '<div style="display:flex;gap:6px">'
        + '<div style="position:relative;flex:1">'
        + '<input class="fi" id="s-prod-search" placeholder="Type name, SKU or barcode..." '
        + 'oninput="Sales.onProdSearch(this.value)" autocomplete="off">'
        + '<div id="s-prod-suggestions" style="position:absolute;top:100%;left:0;right:0;'
        + 'background:var(--bg2);border:1px solid var(--bd2);border-radius:0 0 var(--r10) var(--r10);'
        + 'z-index:200;max-height:240px;overflow-y:auto;display:none;box-shadow:var(--sh2)"></div>'
        + '</div>'
        + '<button type="button" class="btn-ghost" onclick="Products.openScanner()" style="padding:0 16px;font-size:18px;flex-shrink:0" title="Scan barcode">📷</button>'
        + '</div></div>'
        + '<div id="s-cart-wrap"><div style="text-align:center;padding:14px 0;color:var(--t3);font-size:13px">No items added — search above</div></div>'
        + '</div>'

        // ── Totals ────────────────────────────────────────────────
        + '<div id="s-totals"></div>'

        // ── Payment ───────────────────────────────────────────────
        + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">💳 Payment</div>'
        + '<div class="form-row" style="margin-bottom:12px">'
        + '<div class="fg" style="margin:0"><label class="fl">Discount</label>'
        + '<div style="display:flex;gap:6px">'
        + '<input class="fi" id="s-disc" type="number" placeholder="0" min="0" step="0.01" oninput="Sales.updateTotals()" style="flex:1;min-width:0">'
        + '<select class="fi" id="s-disc-type" onchange="Sales.updateTotals()" style="width:auto;flex-shrink:0" aria-label="Discount type">'
        + '<option value="percent">%</option><option value="amount">' + Utils.esc(cur) + '</option></select>'
        + '</div></div>'
        + '<div class="fg" style="margin:0"><label class="fl">Payment Method</label>'
        + '<select class="fi" id="s-method">'
        + '<option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Credit</option>'
        + '</select></div>'
        + '</div>'

        // Amount paid — no zero placeholder
        + '<div class="fg" style="margin-bottom:10px"><label class="fl">Amount Paid (USD) — leave blank for full payment</label>'
        + '<input class="fi" id="s-amt-paid" type="number" placeholder="" min="0" step="0.01" '
        + 'oninput="Sales.updateTotals()" style="font-size:16px;font-weight:700;color:var(--ok)"></div>'

        // LRD Converter
        + '<div style="background:var(--inb);border:1px solid var(--inbd);border-radius:var(--r10);padding:12px;margin-bottom:10px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🇱🇷 LRD ↔ USD Converter</div>'
        + '<div class="form-row" style="margin-bottom:8px">'
        + '<div class="fg" style="margin:0"><label class="fl">Rate (LRD per $1)</label>'
        + '<input class="fi" id="s-lrd-rate" type="number" placeholder="' + lrdRate + '" value="' + lrdRate + '" '
        + 'min="1" oninput="Sales.calcLrd()" style="font-weight:700;color:var(--in)"></div>'
        + '<div class="fg" style="margin:0"><label class="fl">Amount in LRD</label>'
        + '<input class="fi" id="s-lrd-amt" type="number" placeholder="Enter LRD amount" min="0" '
        + 'oninput="Sales.calcLrd()" style="font-weight:700;color:var(--in)"></div>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg2);border-radius:var(--r8);padding:10px 14px">'
        + '<span style="font-size:12px;color:var(--t2)">= USD equivalent</span>'
        + '<span id="s-lrd-result" style="font-size:18px;font-weight:800;color:var(--in);font-family:var(--fm)">$0.00</span>'
        + '<button onclick="Sales.useLrdAmount()" class="btn-ghost btn-sm" style="color:var(--in);border-color:var(--inbd)">Use this amount</button>'
        + '</div>'
        + '</div>'

        + '</div>'
        + '<div class="fg"><label class="fl">Notes (optional)</label>'
        + '<input class="fi" id="s-notes" placeholder="Any extra information..."></div>',

      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-ghost" onclick="Sales.saveSale(\'new\')" style="color:var(--g);border-color:rgba(201,168,67,.3)">💾 Save &amp; New</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Sales.saveSale(\'close\')">🧾 Save Invoice</button>',
    });

    // Set default customer
    var nameEl = Utils.get('s-cust-name');
    if (nameEl) nameEl.value = 'Walk-in Customer';
    this.updateTotals();
  },


  // ── CUSTOMER AUTO-SUGGEST + INFO PANEL ────────────────────────────────────
  onCustNameInput: function(val) {
    var sugg = Utils.get('s-cust-suggestions');
    var info = Utils.get('s-cust-info');
    if (!sugg) return;
    // Typing changes the customer, so drop any previously selected record
    var idEl = Utils.get('s-cust-id'); if (idEl) idEl.value = '';
    var tag = Utils.get('s-cust-tag'); if (tag) tag.style.display = 'none';
    var q = (val||'').toLowerCase().trim();
    if (!q) { sugg.style.display='none'; if(info) info.style.display='none'; return; }
    var custs = DB.getCustomers();
    var matches = custs.filter(function(c){
      return (c.name||'').toLowerCase().includes(q)
          || (c.phone && c.phone.includes(q))
          || (c.email && c.email.toLowerCase().includes(q));
    }).slice(0, 8);
    sugg.innerHTML = '';
    if (!matches.length) {
      sugg.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--t3)">No customer found — a new customer record will be created on save</div>'
        + '<div onclick="Sales.selectWalkin()" style="padding:10px 14px;font-size:12px;font-weight:600;color:var(--g);cursor:pointer;border-top:1px solid var(--bd)">＋ Use as walk-in instead</div>';
      sugg.style.display = 'block';
    } else {
      // Build real DOM nodes (outerHTML would discard the click listeners)
      matches.forEach(function(c){
        var debt = '';
        try { if (c.balance>0) debt = ' · Owes: '+Utils.cur(c.balance, DB.getSettings().currency||'$'); } catch(e){}
        var div = document.createElement('div');
        div.style.cssText = 'padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--bd)';
        div.innerHTML = '<div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(c.name)+'</div>'
          + '<div style="font-size:11px;color:var(--t2)">'+Utils.esc(c.phone||'')+debt+'</div>';
        div.addEventListener('click', function(){ Sales.selectCust(c); });
        sugg.appendChild(div);
      });
      sugg.style.display = 'block';
    }
  },

  selectWalkin: function() {
    var nameEl = Utils.get('s-cust-name'); if (nameEl) nameEl.value = 'Walk-in Customer';
    var idEl   = Utils.get('s-cust-id');   if (idEl)   idEl.value   = '';
    var phEl   = Utils.get('s-cust-phone'); if (phEl) phEl.value = '';
    var sugg   = Utils.get('s-cust-suggestions'); if (sugg) sugg.style.display = 'none';
    var tag    = Utils.get('s-cust-tag');  if (tag)    tag.style.display  = 'none';
  },


  selectCust: function(custOrId, name) {
    // Accept either object {name,phone,address,email,id} or (id, name)
    var c_id, c_name, c_phone, c_addr, c_email;
    if (custOrId && typeof custOrId === 'object') {
      c_id = custOrId.id; c_name = custOrId.name;
      c_phone = custOrId.phone; c_addr = custOrId.address; c_email = custOrId.email;
    } else {
      c_id = custOrId; c_name = name;
      var found = DB.getCustomers().find(function(x){ return x.id===c_id; });
      if (found) { c_phone=found.phone; c_addr=found.address; c_email=found.email; }
    }
    var nameEl = Utils.get('s-cust-name');
    var idEl   = Utils.get('s-cust-id');
    var sugg   = Utils.get('s-cust-suggestions');
    if (nameEl) nameEl.value = c_name || '';
    if (idEl)   idEl.value   = c_id   || '';
    var phEl = Utils.get('s-cust-phone'); if (phEl) phEl.value = c_phone || '';
    if (sugg)   sugg.style.display = 'none';
    var tag=Utils.get('s-cust-tag');
    if (!tag) return;
    // Show customer info panel
    var c = DB.getCustomers().find(function(x){ return x.id===c_id; });
    var allSales = DB.getSales().filter(function(s){ return (c_id && s.customerId===c_id)||s.customer===c_name; });
    var openBal  = allSales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
    var cur = DB.getSettings().currency||'$';
    var lastSale = allSales[0];
    tag.style.display='block';
    tag.innerHTML = '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r8);padding:10px 12px;margin-top:6px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--ok);margin-bottom:6px">✓ Customer record found</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">'
      + '<div style="color:var(--t3)">Invoices: <span style="color:var(--t1);font-weight:700">'+allSales.length+'</span></div>'
      + '<div style="color:var(--t3)">Total spent: <span style="color:var(--g);font-weight:700">'+Utils.cur(c?c.totalSpent||0:0,cur)+'</span></div>'
      + '<div style="color:var(--t3)">Outstanding: <span style="color:'+(openBal>0?'var(--wa)':'var(--ok)')+';font-weight:700">'+(openBal>0?Utils.cur(openBal,cur):'Clear')+'</span></div>'
      + '<div style="color:var(--t3)">Last sale: <span style="color:var(--t1);font-weight:700">'+(lastSale?Utils.date(lastSale.date):'None')+'</span></div>'
      + '</div>'
      + (openBal>0?'<div style="font-size:10px;color:var(--wa);margin-top:6px;font-weight:600">⚠️ This customer has an outstanding balance of '+Utils.cur(openBal,cur)+'</div>':'')
      + '</div>';
  },

  // ── CART ───────────────────────────────────────────────────────────────────

  onProdSearch: function(val) {
    var sugg = Utils.get('s-prod-suggestions');
    if (!sugg) return;
    var q = (val||'').toLowerCase().trim();
    if (!q) { sugg.style.display = 'none'; return; }
    var cur   = DB.getSettings().currency || '$';
    var prods = DB.getProducts().filter(function(p){ return p.status !== 'inactive'; });
    var matches = prods.filter(function(p){
      return p.name.toLowerCase().includes(q)
          || (p.sku      && p.sku.toLowerCase().includes(q))
          || (p.barcode  && p.barcode.toLowerCase().includes(q))
          || (p.category && p.category.toLowerCase().includes(q));
    }).slice(0, 12);

    sugg.innerHTML = '';
    sugg.style.display = 'block';

    if (!matches.length) {
      var noRes = document.createElement('div');
      noRes.style.cssText = 'padding:12px 14px;font-size:13px;color:var(--t3)';
      noRes.textContent = 'No product found for "' + val + '"';
      sugg.appendChild(noRes);
      var addNew = document.createElement('div');
      addNew.style.cssText = 'padding:12px 14px;font-size:13px;font-weight:700;color:var(--g);cursor:pointer;border-top:1px solid var(--bd);display:flex;align-items:center;gap:8px';
      addNew.innerHTML = '<span style="font-size:18px">+</span> Add New Product';
      addNew.addEventListener('click', function() {
        sugg.style.display = 'none';
        var s = Utils.get('s-prod-search'); if(s) s.value = '';
        QuickCreate.quickProduct(function(p){ Sales.addToCartById(p.id); });
      });
      sugg.appendChild(addNew);
      return;
    }
    matches.forEach(function(p) {
      var qtyColor = p.qty<=0 ? '#FF4D6A' : p.qty<=(p.lowLevel||5) ? '#FFAD1F' : '#0FD47D';
      var item = document.createElement('div');
      item.style.cssText = 'padding:11px 14px;cursor:pointer;border-bottom:1px solid var(--bd)';
      item.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1)">' + Utils.esc(p.name) + '</div>'
        + '<div style="font-size:15px;font-weight:800;color:#D4A843">' + Utils.cur(p.price,cur) + '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:' + qtyColor + ';margin-top:3px">'
        + p.qty + ' in stock' + (p.sku ? ' · ' + p.sku : '') + '</div>';
      item.addEventListener('click', function(){
        Sales.addToCartById(p.id);
        var s = Utils.get('s-prod-search'); if(s) s.value = '';
        sugg.style.display = 'none';
      });
      sugg.appendChild(item);
    });
  },

  addToCartById: function(id) {
    if (ReceiptScan.takePending(id)) return;   // picked for a scanned line that had no match
    var p = DB.getProducts().find(function(x){ return x.id===id; });
    if (!p) return;
    var existing = this.cart.find(function(i){ return i.id===id; });
    if (existing) { existing.qty++; }
    else { this.cart.push({ id:p.id, name:p.name, qty:1, price:p.price, cost:p.cost||0, unit:p.unit||'Pcs', discount:0 }); }
    this.renderCart();
    this.updateTotals();
    Toast.show(p.name + ' added ✓', 'ok');
  },

  addToCart: function(sel) {
    // Intercept "+ Add New Product"
    if (QuickCreate.onProductChange(sel, function(newProd) {
      var prodSel = Utils.get('s-prod-sel');
      if (prodSel) prodSel.innerHTML = QuickCreate.productOptions();
      Sales.cart.push({id:newProd.id,name:newProd.name,price:newProd.price,cost:newProd.cost||0,qty:1,maxQty:newProd.qty||0});
      Sales.renderCart();
    })) return;
    var id=sel.value; if(!id) return;
    var p=DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    sel.value='';
    var ex=this.cart.find(function(i){ return i.id===id; });
    if(ex) ex.qty++; else this.cart.push({id:p.id,name:p.name,price:p.price,cost:p.cost||0,qty:1,maxQty:p.qty});
    this.renderCart();
  },

  renderCart: function() {
    var el=Utils.get('s-cart-wrap'); if(!el) return;
    var cur=DB.getSettings().currency||'$';
    if(!this.cart.length){
      el.innerHTML='<div style="text-align:center;padding:14px 0;color:var(--t3);font-size:13px">No items added yet</div>';
      this.updateTotals(); return;
    }
    el.innerHTML=this.cart.map(function(item,i){
      // Lines from a scanned receipt show what was written; ones the AI wasn't sure of are highlighted to check
      var sc = item._scan, check = sc && (!sc.sure || (sc.warnings && sc.warnings.length));
      var scanHtml = sc
        ? '<div style="font-size:11px;color:'+(check?'var(--wa)':'var(--t3)')+';margin-top:3px;font-weight:600">'
          + (check?'⚠️ Check: ':'📷 ')+'on receipt "'+Utils.esc(sc.written)+'"'
          + (sc.warnings && sc.warnings.length ? ' — '+sc.warnings.map(Utils.esc).join('; ') : '')
          + '</div>'
        : '';
      return '<div style="background:'+(check?'var(--wab)':'var(--bg2)')+';border:'+(check?'1.5px solid var(--wa)':'1px solid var(--bd2)')+';border-radius:var(--r10);padding:12px 13px;margin-bottom:8px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);flex:1;padding-right:8px">'+Utils.esc(item.name)+scanHtml+'</div>'
        + '<button onclick="Sales.removeItem('+i+')" style="width:22px;height:22px;border-radius:50%;background:var(--erb);border:1px solid var(--erbd);color:var(--er);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end">'
        + '<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Qty</div>'
        + '<div style="display:flex;align-items:center;gap:5px">'
        + '<button onclick="Sales.changeQty('+i+',-1)" style="width:26px;height:26px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd2);color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">−</button>'
        + '<input type="number" value="'+item.qty+'" min="1" oninput="Sales.setQty('+i+',this.value)" style="width:44px;text-align:center;font-size:14px;font-weight:700;color:var(--t1);background:var(--bg3);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 2px;-webkit-appearance:none">'
        + '<button onclick="Sales.changeQty('+i+',1)" style="width:26px;height:26px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd2);color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">+</button>'
        + '</div></div>'
        + '<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Unit Price</div>'
        + '<input type="number" value="'+item.price+'" min="0" step="0.01" oninput="Sales.setPrice('+i+',this.value)" style="width:100%;text-align:right;font-size:14px;font-weight:700;color:var(--g);background:var(--bg3);border:1.5px solid rgba(201,168,76,.3);border-radius:6px;padding:5px 8px;-webkit-appearance:none">'
        + '</div>'
        + '<div style="text-align:right"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Line Total</div>'
        + '<div style="font-size:16px;font-weight:800;color:var(--g)" id="lt-'+i+'">'+Utils.cur(item.price*item.qty,cur)+'</div>'
        + '</div></div></div>';
    }).join('');
    this.updateTotals();
  },

  changeQty: function(i,d){ if(this.cart[i]){this.cart[i].qty=Math.max(1,(this.cart[i].qty||1)+d);this.renderCart();} },

  setQty: function(i,val){
    var n=parseInt(val); if(!this.cart[i]||isNaN(n)||n<1) return;
    this.cart[i].qty=n;
    var cur=DB.getSettings().currency||'$';
    var el=Utils.get('lt-'+i); if(el) el.textContent=Utils.cur(this.cart[i].price*n,cur);
    this.updateTotals();
  },

  setPrice: function(i,val){
    var n=parseFloat(val); if(!this.cart[i]||isNaN(n)||n<0) return;
    this.cart[i].price=n;
    var cur=DB.getSettings().currency||'$';
    var el=Utils.get('lt-'+i); if(el) el.textContent=Utils.cur(n*this.cart[i].qty,cur);
    this.updateTotals();
  },

  removeItem: function(i){ this.cart.splice(i,1); this.renderCart(); },

  // ── TOTALS ─────────────────────────────────────────────────────────────────
  calcLrd: function(){
    var rateEl = Utils.get('s-lrd-rate');
    var amtEl  = Utils.get('s-lrd-amt');
    var resEl  = Utils.get('s-lrd-result');
    if (!rateEl || !amtEl || !resEl) return;
    var rate = parseFloat(rateEl.value) || (DB.getSettings().lrdRate || 198);
    var lrd  = parseFloat(amtEl.value) || 0;
    var usd  = rate > 0 ? lrd / rate : 0;
    resEl.textContent = Utils.cur(usd, '$');
  },

  useLrdAmount: function(){
    var resEl = Utils.get('s-lrd-result');
    if (!resEl) return;
    var usdVal = parseFloat(resEl.textContent.replace(/[^0-9.]/g,'')) || 0;
    if (!usdVal) { Toast.show('Enter an LRD amount first','err'); return; }
    var paidEl = Utils.get('s-amt-paid');
    if (paidEl) paidEl.value = usdVal.toFixed(2);
    Toast.show('Amount applied: '+Utils.cur(usdVal,'$'),'ok');
    Sales.updateTotals();
  },

  //─────────────────────────────────────────────────────────────────────────
  updateTotals: function(){
    ReceiptScan.refresh();
    var totEl=Utils.get('s-totals');
    var cur=DB.getSettings().currency||'$';
    if(!this.cart.length){ if(totEl) totEl.innerHTML=''; return; }
    var sub     = this.cart.reduce(function(a,i){ return a+(parseFloat(i.price)||0)*(parseInt(i.qty)||0); },0);
    var _d      = this._formDisc(sub);
    this.discount = _d.pct;
    var discAmt = _d.amount;
    var total   = sub-discAmt;
    var paidRaw = parseFloat(Utils.val('s-amt-paid')||0);
    var paid    = Math.min(paidRaw, total);
    var balance = Math.max(0, total-paid);
    var method  = (Utils.get('s-method')||{value:'Cash'}).value||'Cash';
    var status  = paid>0&&balance>0?'Partial':(paidRaw<=0&&method==='Credit')?'Credit':'Paid';
    var sc      = {Paid:'var(--ok)',Partial:'var(--wa)',Credit:'var(--er)'}[status];
    var showPartial = paidRaw>0 && balance>0;
    var noteHtml = paidRaw<=0 && method!=='Credit'
      ? '<div style="font-size:11px;color:var(--ok);margin-top:8px;font-weight:600">✓ Full payment assumed on save</div>' : '';
    var progressHtml = showPartial
      ? '<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-bottom:5px"><span>Progress</span><span>'+Math.round((paidRaw/total)*100)+'% paid</span></div>'
        + '<div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">'
        + '<div style="height:100%;width:'+Math.round((paidRaw/total)*100)+'%;background:linear-gradient(90deg,var(--ok),var(--g));border-radius:3px"></div></div></div>' : '';
    var discHtml = discAmt>0
      ? '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--t2)">Subtotal</span><span style="font-size:13px;font-weight:600;font-family:var(--fm)">'+Utils.cur(sub,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--er)">'+(_d.type==='amount'?'Discount':'Discount ('+_d.value+'%)')+'</span><span style="font-size:13px;font-weight:600;color:var(--er);font-family:var(--fm)">−'+Utils.cur(discAmt,cur)+'</span></div>' : '';
    var paidHtml = showPartial
      ? '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--ok);font-weight:600">✓ Amount Paid</span><span style="font-size:14px;font-weight:700;color:var(--ok);font-family:var(--fm)">'+Utils.cur(paidRaw,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--wa);font-weight:600">⏳ Balance Due</span><span style="font-size:14px;font-weight:700;color:var(--wa);font-family:var(--fm)">'+Utils.cur(balance,cur)+'</span></div>' : '';
    var rate    = parseFloat(DB.getSettings().lrdRate)||0;
    var lrdHtml = rate ? '<div style="text-align:right;margin-top:-4px;margin-bottom:6px"><span style="font-size:12px;color:var(--t3);font-family:var(--fm)">≈ L$'+(total*rate).toLocaleString(undefined,{maximumFractionDigits:0})+'</span></div>' : '';
    if(totEl) totEl.innerHTML = '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">🧮 Order Summary</div>'
      + discHtml
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd2)"><span style="font-size:15px;font-weight:800;color:var(--t1)">Total Amount</span><span style="font-size:18px;font-weight:900;color:var(--g);letter-spacing:-.02em;font-family:var(--fm)">'+Utils.cur(total,cur)+'</span></div>'
      + lrdHtml
      + paidHtml + progressHtml
      + '<div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:var(--t3)">Invoice status</span><span style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;background:'+sc+'18;border:1px solid '+sc+'40;color:'+sc+'">'+status+'</span></div>'
      + noteHtml+'</div>';
  },

  // ── SAVE SALE ──────────────────────────────────────────────────────────────
  saveSale: function(action, scanMeta){
    action=action||'close';
    if (this._saving) return;
    if(!this.cart.length){ Toast.show('Add at least one product','err'); return; }
    // A scanned receipt must be confirmed by the staff member; its photo is stored first
    if (ReceiptScan.active() && scanMeta === undefined) {
      var invNo0 = (Utils.val('s-inv-no')||'').trim();
      if (invNo0 && DB.getSales().some(function(x){ return (x.invoiceNo||'') === invNo0; })) {
        Toast.show('Invoice No. '+invNo0+' is already used — change it to save', 'err'); return;
      }
      if (!ReceiptScan.canSave()) return;
      var self0 = this;
      this._setSaving(true);
      ReceiptScan.beforeSave(function(meta) { self0._setSaving(false); self0.saveSale(action, meta || null); });
      return;
    }
    var custName = Utils.val('s-cust-name').trim()||'Walk-in Customer';
    var custId   = Utils.val('s-cust-id')||null;
    var method   = (Utils.get('s-method')||{value:'Cash'}).value||'Cash';
    var sub      = this.cart.reduce(function(a,i){ return a+(parseFloat(i.price)||0)*(parseInt(i.qty)||0); },0);
    var disc     = this._formDisc(sub);
    var discAmt  = disc.amount;
    this.discount = disc.pct;
    var total    = sub-discAmt;
    var invNo    = (Utils.val('s-inv-no')||'').trim();
    if (invNo && DB.getSales().some(function(x){ return (x.invoiceNo||'') === invNo; })) {
      Toast.show('Invoice No. '+invNo+' is already used — change it to save', 'err'); return;
    }
    var custPhone = (Utils.val('s-cust-phone')||'').trim();
    var _amtStr  = Utils.val('s-amt-paid').trim();

    var finalCustId = custId;
    if (!finalCustId && custName && custName.toLowerCase()!=='walk-in customer') {
      var nc = DB.findOrCreateCustomer(custName, custPhone);
      if (nc) finalCustId = nc.id;
    }
    // Save / update the customer's phone number on their record
    if (finalCustId && custPhone) {
      var ex = DB.getCustomers().find(function(c){ return c.id===finalCustId; });
      if (ex && (ex.phone||'') !== custPhone) DB.updateCustomer(finalCustId, { phone: custPhone });
    }

    var form = {
      id: Utils.uid('INV'), invNo: invNo, custName: custName, custId: finalCustId, custPhone: custPhone,
      method: method, sub: sub, disc: disc, total: total, amtStr: _amtStr,
      date: Utils.val('s-date')||Utils.today(), notes: Utils.val('s-notes'),
      items: this.cart.map(function(i){ return {id:i.id,name:i.name,price:i.price,cost:i.cost,qty:parseInt(i.qty)||1}; }),
      scan: scanMeta || null,
    };

    // Online: the server checks stock, reduces it and fixes the invoice number in one step
    if (DB._bizId && DB._token && navigator.onLine !== false && DB.rpc) {
      var self = this;
      this._setSaving(true);
      DB.rpc('record_sale', { p_sale: {
        id: form.id, invoice_no: invNo, date: form.date, customer_id: finalCustId, customer_name: custName,
        customer_phone: custPhone, items: form.items, discount_type: disc.type, discount_value: disc.value,
        payment_method: method, amount_paid: _amtStr === '' ? null : (parseFloat(_amtStr)||0), notes: form.notes,
        created_by_name: (Auth.currentUser && Auth.currentUser.name) || 'Unknown',
        scan: form.scan || undefined,
      }}).then(function(res) {
        self._setSaving(false);
        DB.applyServerSale(res);
        self._afterSave(res.sale, action, form);
      }, function(err) {
        self._setSaving(false);
        if (err && err.network) {
          // No connection (or the server is down): save on this device; it uploads later
          self._saveLocal(action, form);
          Toast.show('Saved offline — stock will be checked when you\'re back online', 'warn');
        } else {
          Toast.show((err && err.message) || 'The sale could not be saved', 'err');
          if (err && /Not enough stock/i.test(err.message||'')) { try { DB.syncFromCloud(); } catch(e){} }
        }
      });
      return;
    }
    this._saveLocal(action, form);
  },

  _setSaving: function(on) {
    this._saving = on;
    var btns = document.querySelectorAll('#modal-overlay .modal-foot button');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = on;
    var main = document.querySelector('#modal-overlay button[onclick*="saveSale(\'close\')"]');
    if (main) main.innerHTML = on ? 'Saving…' : '🧾 Save Invoice';
  },

  // Offline / fallback: the previous on-device behaviour
  _saveLocal: function(action, form) {
    var method = form.method, total = form.total;
    var paidRaw  = form.amtStr === '' ? (method==='Credit' ? 0 : total) : (parseFloat(form.amtStr)||0);
    var paid     = Math.min(paidRaw, total);
    var balance  = Math.max(0, total-paid);
    var status   = paid>0&&balance>0?'Partial':(paid<=0&&method==='Credit')?'Credit':'Paid';
    var sale = DB.addSale({
      id: form.id,
      customer:form.custName, customerId:form.custId||null, customerPhone:form.custPhone||'',
      invoiceNo: form.invNo || undefined,
      items: form.items,
      subtotal:form.sub, discount:Math.round(form.disc.pct*100)/100, discountType:form.disc.type, discountValue:form.disc.value, discountAmount:form.disc.amount, total:total,
      amountPaid:status==='Paid'?total:paid,
      balance:status==='Paid'?0:balance,
      payment:method, status:status,
      date:form.date, notes:form.notes,
      createdBy: (Auth.currentUser && Auth.currentUser.id) || null,
      createdByName: (Auth.currentUser && Auth.currentUser.name) || 'Unknown',
      scan: form.scan ? Object.assign({ source: 'receipt_photo' }, form.scan) : undefined,
    });
    if (paid>0 || status==='Paid') {
      DB.addPayment({ saleId:sale.id, customerId:form.custId||null,
        amount:status==='Paid'?total:paid, method:method,
        note:'Initial payment', invoiceRef:sale.id });
    }
    form.items.forEach(function(item){
      var p=DB.getProducts().find(function(x){ return x.id===item.id; });
      if(p) DB.updateProduct(item.id,{qty:Math.max(0,(p.qty||0)-(parseInt(item.qty)||0))});
    });
    this._afterSave(sale, action, form);
  },

  // Shared finish: customer totals, next invoice number, form reset or print prompt
  _afterSave: function(sale, action, form) {
    var cust = form.custId ? DB.getCustomers().find(function(c){ return c.id===form.custId; }) : null;
    if(cust) DB.updateCustomer(form.custId,{totalSpent:(cust.totalSpent||0)+(parseFloat(sale.total)||0),purchases:(cust.purchases||0)+1});

    // Remember the next invoice number (synced to every device through settings)
    // A number copied from a scanned paper receipt only moves the counter on if it is the number the counter offered
    var used = sale.invoiceNo || form.invNo;
    var fromPaper = form.scan && String(used) !== String(DB.getSettings().invoiceNextNo || '');
    if (used && !fromPaper) { var nxt = Sales.nextInvoiceNo(used); if (nxt) DB.saveSettings({ invoiceNextNo: nxt }); }
    Toast.show('Invoice '+Sales.no(sale)+' saved ✓','ok');
    Notifs.check();
    ReceiptScan.reset();

    if(action==='new'){
      this.cart=[]; this.discount=0;
      var n=Utils.get('s-cust-name'); if(n) n.value='Walk-in Customer';
      var ci=Utils.get('s-cust-id'); if(ci) ci.value='';
      var tg=Utils.get('s-cust-tag'); if(tg) tg.style.display='none';
      var d=Utils.get('s-disc'); if(d) d.value='';
      var dt=Utils.get('s-disc-type'); if(dt) dt.value='percent';
      var ph=Utils.get('s-cust-phone'); if(ph) ph.value='';
      var inv=Utils.get('s-inv-no'); if(inv) inv.value=DB.getSettings().invoiceNextNo||'';
      var ih=Utils.get('s-inv-hint'); if(ih){ ih.textContent='Next number filled in automatically'; ih.style.color=''; }
      var p2=Utils.get('s-amt-paid'); if(p2) p2.value='';
      var nt=Utils.get('s-notes'); if(nt) nt.value='';
      this.renderCart();
      this.updateTotals();
      Toast.show('Ready for next sale','ok');
      this.render();
    } else {
      Modal.close();
      this.render();
      var sid = sale.id;
      setTimeout(function(){ Sales.showPrintPrompt(sid,'invoice'); }, 350);
    }
  },

  // ── VIEW INVOICE + FULL PAYMENT HISTORY ───────────────────────────────────
  viewInvoice: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var payments=DB.getPaymentsForSale(id);
    var settings=DB.getSettings();
    var cur=settings.currency||'$';

    var itemsHtml = (s.items||[]).map(function(item){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd)">'
        + '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(item.name)+'</div>'
        + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+item.qty+' × '+Utils.cur(item.price,cur)+'</div></div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--g)">'+Utils.cur(item.price*item.qty,cur)+'</div></div>';
    }).join('');

    var paymentsHtml = payments.length>0
      ? '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-top:12px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">💳 Payment History ('+payments.length+')</div>'
        + payments.map(function(p,idx){
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">'
              + '<div>'
              + '<div style="font-size:12px;font-weight:700;color:var(--t1)">#'+(idx+1)+' — '+Utils.esc(p.note||'Payment')+'</div>'
              + '<div style="font-size:10px;color:var(--t3);font-family:var(--fm)">'+p.id+' · '+(p.paidAt?new Date(p.paidAt).toLocaleDateString():'')+' · '+(p.method||'Cash')+'</div>'
              + '</div>'
              + '<div style="text-align:right">'
              + '<div style="font-size:14px;font-weight:800;color:var(--ok);font-family:var(--fm)">'+Utils.cur(p.amount,cur)+'</div>'
              + '<button onclick="Sales.printPaymentReceipt(\''+id+'\',\''+p.id+'\','+p.amount+',0)" style="font-size:10px;color:var(--g);background:var(--gb);border:1px solid rgba(201,168,76,.2);border-radius:4px;padding:2px 7px;cursor:pointer;margin-top:3px">🖨 Print</button>'
              + '</div></div>';
          }).join('')
        + '</div>' : '';

    var barColor = s.status==='Paid'?'var(--ok)':s.status==='Partial'?'var(--wa)':'var(--er)';
    var footerPayBtn = s.status!=='Paid'
      ? '<button class="btn-primary" style="flex:1" onclick="Modal.close();Sales.openPayBalance(\''+id+'\')">💳 Pay Balance</button>'
      : '<button class="btn-ok" style="flex:1" disabled>✅ Fully Paid</button>';

    Modal.open({
      title:'Invoice '+Utils.esc(Sales.no(s)), sub:Utils.date(s.date), barColor:barColor,
      body: '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:14px;margin-bottom:12px">'
          + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:3px">'+Utils.esc(s.customer||'Walk-in')+'</div>'
          + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+Utils.esc(Sales.no(s))+' · '+Utils.date(s.date)+' · '+(s.payment||'Cash')+(s.customerPhone?' · '+Utils.esc(s.customerPhone):'')+'</div>'
          + (s.createdByName ? '<div style="font-size:11px;color:var(--t3);margin-top:3px">By '+Utils.esc(s.createdByName)+'</div>' : '')
          + '</div>'
          + Sales._scanInfo(s, cur)
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Items</div>'
          + itemsHtml + '</div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px">'
          + (Sales.discAmt(s)>0?'<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:var(--t2);font-size:13px">'+Sales.discLabel(s)+'</span><span style="color:var(--er);font-family:var(--fm)">−'+Utils.cur(Sales.discAmt(s),cur)+'</span></div>':'')
          + '<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--bd)"><span style="font-size:15px;font-weight:800;color:var(--t1)">Total</span><span style="font-size:17px;font-weight:900;color:var(--g);font-family:var(--fm)">'+Utils.cur(s.total,cur)+'</span></div>'
          + '<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:var(--ok);font-size:13px;font-weight:600">✓ Paid</span><span style="color:var(--ok);font-family:var(--fm);font-weight:700">'+Utils.cur(s.amountPaid||0,cur)+'</span></div>'
          + ((s.balance||0)>0?'<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:var(--wa);font-size:13px;font-weight:600">⏳ Balance</span><span style="color:var(--wa);font-family:var(--fm);font-weight:700">'+Utils.cur(s.balance,cur)+'</span></div>':'')
          + '</div>'
          + paymentsHtml,
      footer: '<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            + '<button class="btn-ghost" onclick="Sales._printById(this)" data-id="'+id+'" style="padding:10px 14px">🖨 Print</button>'
            + footerPayBtn,
    });
  },

  // A sale entered from a scanned paper receipt: its number, written total and stored photo
  _scanInfo: function(s, cur) {
    var sc = s && s.scan; if (!sc) return '';
    var wt = parseFloat(sc.writtenTotal), diff = isFinite(wt) && wt > 0 ? Math.abs(wt - (parseFloat(s.total)||0)) : 0;
    return '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:11px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">'
      + '<div style="flex:1;font-size:12px;color:var(--t2)"><b style="color:var(--t1)">📷 From a scanned paper receipt'+(sc.receiptNo?' #'+Utils.esc(sc.receiptNo):'')+'</b>'
      + (isFinite(wt) && wt > 0 ? '<div style="margin-top:2px;color:'+(diff>0.05?'var(--er)':'var(--ok)')+'">Total written on paper: '+Utils.cur(wt,cur)+(diff>0.05?' — differs by '+Utils.cur(diff,cur):' ✓')+'</div>' : '')
      + '</div>'
      + (/^[A-Za-z0-9_\-]+\/[A-Za-z0-9_\-]+\.(jpg|png|webp)$/.test(sc.photo||'') ? '<button class="btn-ghost btn-sm" onclick="ReceiptScan.openSaved(\''+Utils.esc(sc.photo)+'\')">View photo</button>' : '')
      + '</div>';
  },

  // ── PAY BALANCE ────────────────────────────────────────────────────────────
  openPayBalance: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var cur=DB.getSettings().currency||'$';
    var bal=parseFloat(s.balance)||0;
    var payments=DB.getPaymentsForSale(id);

    var histHtml = payments.length>0
      ? '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r8);padding:10px;margin-bottom:12px">'
        + '<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Previous Payments</div>'
        + payments.map(function(p){
            return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">'
              +'<span style="color:var(--t2)">'+Utils.esc(p.note||'Payment')+' · '+(p.paidAt?new Date(p.paidAt).toLocaleDateString():'')+'</span>'
              +'<span style="color:var(--ok);font-weight:700">'+Utils.cur(p.amount,cur)+'</span></div>';
          }).join('')
        + '</div>' : '';

    Modal.open({
      title:'Pay Balance', sub:'Invoice '+Utils.esc(Sales.no(s))+' · '+Utils.esc(s.customer||'Walk-in'), barColor:'var(--wa)',
      body: histHtml
          + '<div style="background:var(--gb3);border:1px solid rgba(201,168,76,.2);border-radius:var(--r10);padding:14px;margin-bottom:14px">'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;color:var(--t2)">Original Total</span><span style="font-weight:700;font-family:var(--fm)">'+Utils.cur(s.total,cur)+'</span></div>'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;color:var(--ok)">Already Paid</span><span style="font-weight:700;color:var(--ok);font-family:var(--fm)">'+Utils.cur(s.amountPaid||0,cur)+'</span></div>'
          + '<div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(201,168,76,.2)"><span style="font-size:15px;font-weight:800;color:var(--wa)">Outstanding Balance</span><span style="font-size:18px;font-weight:900;color:var(--wa);font-family:var(--fm)">'+Utils.cur(bal,cur)+'</span></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Amount Paying Now *</label>'
          + '<input class="fi" id="pb-amount" type="number" value="'+bal.toFixed(2)+'" min="0.01" max="'+bal.toFixed(2)+'" step="0.01" style="font-size:18px;font-weight:800;color:var(--ok)" oninput="Sales.updateBalancePreview(\''+id+'\',this.value)"></div>'
          + '<div class="fg"><label class="fl">Payment Method</label><select class="fi" id="pb-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div>'
          + '<div class="fg"><label class="fl">Note (optional)</label><input class="fi" id="pb-note" placeholder="e.g. Balance payment"></div>'
          + '<div id="pb-preview"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Sales.saveBalancePayment(\''+id+'\')">💳 Record Payment</button>',
    });
    this.updateBalancePreview(id, bal.toFixed(2));
  },

  updateBalancePreview: function(id,val){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var cur=DB.getSettings().currency||'$';
    var paying=Math.min(parseFloat(val)||0, parseFloat(s.balance)||0);
    var newBal=Math.max(0,(parseFloat(s.balance)||0)-paying);
    var el=Utils.get('pb-preview'); if(!el) return;
    el.innerHTML = '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-top:4px">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;color:var(--ok)">Paying Now</span><span style="font-weight:700;color:var(--ok);font-family:var(--fm)">'+Utils.cur(paying,cur)+'</span></div>'
      + '<div style="display:flex;justify-content:space-between"><span style="font-size:13px;color:'+(newBal<=0?'var(--ok)':'var(--wa)')+';font-weight:700">New Balance</span>'
      + '<span style="font-weight:800;font-family:var(--fm);color:'+(newBal<=0?'var(--ok)':'var(--wa)')+'">'+( newBal<=0?'✅ FULLY PAID':Utils.cur(newBal,cur))+'</span></div></div>';
  },

  saveBalancePayment: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var paying=Math.min(parseFloat(Utils.val('pb-amount'))||0, parseFloat(s.balance)||0);
    if(paying<=0){ Toast.show('Enter a valid amount','err'); return; }
    var method=(Utils.get('pb-method')||{value:'Cash'}).value||'Cash';
    var note=Utils.val('pb-note')||'Balance payment';
    var newBal=Math.max(0,(parseFloat(s.balance)||0)-paying);
    var newPaid=(parseFloat(s.amountPaid)||0)+paying;
    var newStatus=newBal<=0?'Paid':'Partial';
    DB.updateSale(id,{amountPaid:newPaid,balance:newBal,status:newStatus});
    var pmt=DB.addPayment({saleId:id,customerId:s.customerId||null,amount:paying,method:method,note:note,invoiceRef:'PMT-'+id});
    Modal.close();
    Toast.show(newStatus==='Paid'?'Invoice fully paid! ✅':'Payment recorded ✓','ok');
    this.render();
    // Print prompt
    var pid=pmt.id; var nb=newBal;
    setTimeout(function(){ Sales.showPrintPrompt(id,'payment',pid,paying,nb); }, 350);
  },

  markPaid: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    DB.updateSale(id,{status:'Paid',amountPaid:s.total,balance:0});
    DB.addPayment({saleId:id,customerId:s.customerId||null,amount:s.balance||0,method:'Cash',note:'Full settlement'});
    Toast.show('Marked as fully paid ✓','ok'); this.render();
  },

  del: function(id){
    confirmDel('Delete this invoice?',function(){ DB.deleteSale(id); Toast.show('Deleted','warn'); Sales.render(); });
  },

  // ── PRINT PROMPT ───────────────────────────────────────────────────────────
  showPrintPrompt: function(saleId,type,paymentId,amount,newBalance){
    var s=DB.getSales().find(function(x){ return x.id===saleId; }); if(!s) return;
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var isPayment=type==='payment';
    window._printArgs={saleId:saleId,type:type,paymentId:paymentId,amount:amount,newBalance:newBalance};
    Modal.open({
      title:    isPayment?'✅ Payment Recorded!':'✅ Invoice Saved!',
      sub:      isPayment?'Paid '+Utils.cur(amount||0,cur)+' — '+Utils.esc(s.customer||'Customer'):Utils.esc(Sales.no(s))+' · '+Utils.esc(s.customer||'Walk-in')+' · '+Utils.cur(s.total,cur),
      barColor: 'var(--ok)',
      body: '<div style="text-align:center;padding:16px 0 20px">'
          + '<div style="font-size:52px;margin-bottom:14px">'+(isPayment?'💳':'🧾')+'</div>'
          + '<div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:8px">'+(isPayment?'Payment receipt ready':'Invoice saved successfully')+'</div>'
          + '<div style="font-size:13px;color:var(--t2);line-height:1.6">Would you like to print the '+(isPayment?'payment receipt':'customer receipt')+' now?</div></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()" style="flex:1">Not Now</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Sales._doPrint()">🖨 Print Now</button>',
    });
  },

  _doPrint: function(){
    Modal.close();
    var args=window._printArgs; if(!args) return;
    window._printArgs=null;
    if(args.type==='payment') Sales.printPaymentReceipt(args.saleId,args.paymentId,args.amount,args.newBalance);
    else Sales.printReceipt(args.saleId);
  },

  // Print button in the invoice view (button carries data-id)
  _printById: function(btn){
    var id = btn && btn.getAttribute ? btn.getAttribute('data-id') : btn;
    if (!id) return;
    Modal.close();
    setTimeout(function(){ Sales.printReceipt(id); }, 200);
  },

  // ── PRINT RECEIPT ──────────────────────────────────────────────────────────


  /* ── WhatsApp opener — works in PWA + Android Chrome ─────────────────── */
  _openWhatsApp: function(msg, phone) {
    var encoded = encodeURIComponent(msg);
    var url = phone && phone.length > 5
      ? 'https://wa.me/' + phone + '?text=' + encoded
      : 'https://wa.me/?text=' + encoded;

    // Method 1: anchor click (works in PWA where window.open is blocked)
    var a = document.createElement('a');
    a.href   = url;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ document.body.removeChild(a); }, 500);
  },

  shareWhatsApp: function(saleId) {
    var s = DB.getSales().find(function(x){ return x.id===saleId; }); if(!s) return;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var bizPhone = settings.bizPhone || '';

    // Build message
    var nl = '\n';
    var msg = '';
    msg += '🧾 *INVOICE — ' + bizName + '*' + nl;
    msg += '─────────────────────' + nl;
    msg += '📋 *' + Sales.no(s) + '*' + nl;
    msg += '📅 Date: ' + Utils.date(s.date) + nl;
    msg += '👤 ' + Utils.esc(s.customer||'Walk-in Customer') + nl + nl;
    msg += '*Items:*' + nl;
    (s.items||[]).forEach(function(item){
      var total = (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      msg += '• ' + Utils.esc(item.name) + ' x' + item.qty + ' = ' + Utils.cur(total,cur) + nl;
    });
    msg += '─────────────────────' + nl;
    msg += '💰 *TOTAL: ' + Utils.cur(s.total,cur) + '*' + nl;
    msg += '✅ ' + (s.status||'Paid');
    if (parseFloat(s.balance)>0) msg += nl + '⚠️ Balance: ' + Utils.cur(s.balance,cur);
    msg += nl + '💳 ' + (s.payment||'Cash');
    msg += nl + nl + 'Thank you! 🙏';
    if (bizPhone) msg += nl + '📞 ' + bizPhone;

    Sales._openWhatsApp(msg, '');
  },

  shareWhatsAppCustomer: function(saleId) {
    var s = DB.getSales().find(function(x){ return x.id===saleId; }); if(!s) return;
    var customers = DB.getCustomers();
    var cust = customers.find(function(c){ return c.id===s.customerId||c.name===s.customer; });
    var phone = cust ? (cust.phone||'').replace(/[^0-9]/g,'') : '';
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var bizPhone = settings.bizPhone || '';

    var nl = '\n';
    var msg = '';
    msg += '🧾 *INVOICE — ' + bizName + '*' + nl;
    msg += '─────────────────────' + nl;
    msg += '📋 *' + Sales.no(s) + '*' + nl;
    msg += '📅 Date: ' + Utils.date(s.date) + nl + nl;
    msg += '*Items:*' + nl;
    (s.items||[]).forEach(function(item){
      var total = (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      msg += '• ' + Utils.esc(item.name) + ' x' + item.qty + ' = ' + Utils.cur(total,cur) + nl;
    });
    msg += '─────────────────────' + nl;
    msg += '💰 *TOTAL: ' + Utils.cur(s.total,cur) + '*' + nl;
    msg += '✅ ' + (s.status||'Paid');
    if (parseFloat(s.balance)>0) msg += nl + '⚠️ Balance: ' + Utils.cur(s.balance,cur);
    msg += nl + nl + 'Thank you! 🙏';
    if (bizPhone) msg += nl + '📞 ' + bizPhone;

    Sales._openWhatsApp(msg, phone);
  },

  printReceipt: function(id){
    var s = DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var settings = DB.getSettings();
    var cur      = settings.currency   || '$';
    var bizName  = settings.bizName    || 'SmartStock Pro';
    var bizAddr  = settings.bizAddress || '';
    var bizPhone = settings.bizPhone   || '';
    var bizEmail = settings.bizEmail   || '';
    var bizLogo  = settings.bizLogo    || '';
    var now      = new Date();
    var payments = DB.getPaymentsForSale(id);

    // Logo
    var logoHtml = bizLogo
      ? '<img src="'+bizLogo+'" style="width:72px;height:72px;object-fit:contain;border-radius:10px;margin-right:16px;flex-shrink:0" onerror="this.style.display=\'none\'">'
      : '';

    // Status colour
    var statusColor = s.status==='Paid' ? '#16a34a' : s.status==='Partial' ? '#d97706' : '#dc2626';

    // Customer info from customers DB
    var custRec = DB.getCustomers().find(function(c){ return c.id===s.customerId || c.name===s.customer; });
    var custPhone   = custRec ? (custRec.phone||'')   : '';
    var custAddress = custRec ? (custRec.address||'') : '';
    var custEmail   = custRec ? (custRec.email||'')   : '';

    // Items rows — same columns as quotation
    var itemRows = (s.items||[]).map(function(item, i){
      var lineTotal = (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      var bg = i%2===1 ? 'background:#f9fafb;' : '';
      return '<tr style="'+bg+'border-bottom:1px solid #e5e7eb">'
        +'<td style="padding:10px 12px;font-size:12px">'+Utils.esc(item.name||'')+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:center">'+item.qty+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:center">'+(item.unit||'Pcs')+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:right">'+Utils.cur(item.price,cur)+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:right">'+((item.discount||0)>0?(item.discount+'%'):'—')+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;font-weight:700;text-align:right">'+Utils.cur(lineTotal,cur)+'</td>'
        +'</tr>';
    }).join('');

    // Payment history rows
    var payHistHtml = '';
    if (payments.length > 0) {
      payHistHtml = '<div style="margin-top:20px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">'
        +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:10px">Payment History</div>'
        +payments.map(function(p, i){
          return '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid #e5e7eb">'
            +'<span style="color:#555">#'+(i+1)+' · '+Utils.date(p.paidAt||s.date)+' · '+(p.method||'Cash')+'</span>'
            +'<span style="font-weight:700;color:#16a34a">'+Utils.cur(p.amount,cur)+'</span>'
            +'</div>';
        }).join('')
        +'</div>';
    }

    var subtotal  = (s.subtotal||s.total||0);
    var discAmt   = Sales.discAmt(s);
    var total     = parseFloat(s.total)||0;
    var amtPaid   = parseFloat(s.amountPaid||s.total)||0;
    var balance   = parseFloat(s.balance)||0;

    // CSS — identical to quotation template
    var css = '*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
      +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:13px;color:#111;background:#fff}'
      +'.page{max-width:210mm;margin:0 auto;padding:16mm}'
      +'.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #111}'
      +'.biz-block{flex:1;padding-right:20px}'
      +'.biz-name{font-size:24px;font-weight:900;letter-spacing:-.03em;margin-bottom:6px}'
      +'.biz-detail{font-size:11px;color:#555;line-height:1.7}'
      +'.doc-block{text-align:right;flex-shrink:0}'
      +'.doc-title{font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#111;margin-bottom:8px}'
      +'.doc-num{font-size:14px;font-weight:700;color:#555;margin-bottom:4px}'
      +'.doc-status{display:inline-block;padding:3px 12px;border-radius:99px;font-size:10px;font-weight:800;border:2px solid;letter-spacing:.08em}'
      +'.client-section{display:flex;justify-content:space-between;margin-bottom:28px;gap:20px}'
      +'.client-box{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px}'
      +'.client-box h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:8px}'
      +'.client-box p{font-size:12px;color:#111;line-height:1.7}'
      +'.items-table{width:100%;border-collapse:collapse;margin-bottom:0}'
      +'.items-table th{background:#111;color:#fff;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;text-align:right}'
      +'.items-table th:first-child{text-align:left}'
      +'.items-table th:nth-child(2),.items-table th:nth-child(3){text-align:center}'
      +'.totals-block{display:flex;justify-content:flex-end;margin-top:0}'
      +'.totals-inner{width:280px}'
      +'.totals-row{display:flex;justify-content:space-between;padding:7px 12px;font-size:12px;border-bottom:1px solid #e5e7eb}'
      +'.totals-row.grand{background:#111;color:#fff;font-size:15px;font-weight:800;padding:12px;border-radius:0 0 0 0;border:none}'
      +'.paid-row{display:flex;justify-content:space-between;padding:7px 12px;font-size:12px;color:#16a34a;font-weight:700;border-bottom:1px solid #e5e7eb}'
      +'.bal-row{display:flex;justify-content:space-between;padding:7px 12px;font-size:12px;color:#dc2626;font-weight:800;border-bottom:1px solid #e5e7eb}'
      +'.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end}'
      +'.sig-line{border-top:1px solid #333;padding-top:6px;font-size:10px;color:#777;width:180px}'
      +'.page-footer{text-align:center;font-size:10px;color:#9ca3af;margin-top:16px}'
      +'@media print{@page{size:A4;margin:12mm}.page{padding:0}}';

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      +'<meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<title>Invoice '+Utils.esc(Sales.no(s))+'</title><style>'+css+'</style></head><body>'
      +'<div class="page">'

      // ── HEADER ──────────────────────────────────────────────────────────────
      +'<div class="header">'
      +'<div style="display:flex;align-items:flex-start;gap:16px">'
      +logoHtml
      +'<div class="biz-block">'
      +'<div class="biz-name">'+Utils.esc(bizName)+'</div>'
      +'<div class="biz-detail">'
      +(bizAddr  ? bizAddr+'<br>'  : '')
      +(bizPhone ? 'Tel: '+bizPhone+'<br>' : '')
      +(bizEmail ? bizEmail : '')
      +'</div></div></div>'
      +'<div class="doc-block">'
      +'<div class="doc-title">Invoice</div>'
      +'<div class="doc-num">'+Utils.esc(Sales.no(s))+'</div>'
      +'<div class="doc-num" style="font-size:11px;font-weight:400">Date: '+Utils.date(s.date)+'</div>'
      +'<div class="doc-num" style="font-size:11px;font-weight:400">Payment: '+(s.payment||'Cash')+'</div>'
      +'<div style="margin-top:8px"><span class="doc-status" style="color:'+statusColor+';border-color:'+statusColor+';">'+(s.status||'Paid').toUpperCase()+'</span></div>'
      +'</div></div>'

      // ── BILL TO + INVOICE DETAILS ────────────────────────────────────────────
      +'<div class="client-section">'
      +'<div class="client-box">'
      +'<h3>Bill To</h3>'
      +'<p><strong>'+Utils.esc(s.customer||'Walk-in Customer')+'</strong><br>'
      +(custPhone   ? 'Tel: '+Utils.esc(custPhone)+'<br>'   : '')
      +(custAddress ? Utils.esc(custAddress)+'<br>'         : '')
      +(custEmail   ? Utils.esc(custEmail)                  : '')
      +'</p></div>'
      +'<div class="client-box">'
      +'<h3>Invoice Details</h3>'
      +'<p>Invoice No: <strong>'+Utils.esc(Sales.no(s))+'</strong><br>'
      +'Date: <strong>'+Utils.date(s.date)+'</strong><br>'
      +'Payment: <strong>'+(s.payment||'Cash')+'</strong><br>'
      +'Prepared by: <strong>'+Utils.esc(bizName)+'</strong><br>'
      +'Generated: '+now.toLocaleDateString()
      +'</p></div>'
      +'</div>'

      // ── ITEMS TABLE ──────────────────────────────────────────────────────────
      +'<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:0">'
      +'<table class="items-table">'
      +'<thead><tr>'
      +'<th style="text-align:left;width:36%">Description</th>'
      +'<th style="text-align:center;width:8%">Qty</th>'
      +'<th style="text-align:center;width:8%">Unit</th>'
      +'<th style="text-align:right;width:16%">Unit Price</th>'
      +'<th style="text-align:right;width:10%">Disc.</th>'
      +'<th style="text-align:right;width:22%">Amount</th>'
      +'</tr></thead>'
      +'<tbody>'+itemRows+'</tbody>'
      +'</table>'

      // ── TOTALS ───────────────────────────────────────────────────────────────
      +'<div class="totals-block">'
      +'<div class="totals-inner">'
      +(discAmt>0 ? '<div class="totals-row"><span>Subtotal</span><span>'+Utils.cur(subtotal,cur)+'</span></div>' : '')
      +(discAmt>0 ? '<div class="totals-row"><span>'+Sales.discLabel(s)+'</span><span>−'+Utils.cur(discAmt,cur)+'</span></div>' : '')
      +'<div class="totals-row"><span>Subtotal</span><span>'+Utils.cur(total,cur)+'</span></div>'
      +'<div class="totals-row grand"><span>TOTAL</span><span>'+Utils.cur(total,cur)+'</span></div>'
      +'<div class="paid-row"><span>Paid ('+Utils.esc(s.payment||'Cash')+')</span><span>'+Utils.cur(amtPaid,cur)+'</span></div>'
      +(balance>0 ? '<div class="bal-row"><span>Balance Due</span><span>'+Utils.cur(balance,cur)+'</span></div>' : '')
      +'</div></div></div>'

      // Payment history
      +payHistHtml

      // Notes
      +(s.notes ? '<div style="margin-top:20px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:11px;color:#555;line-height:1.7"><strong>Notes:</strong> '+Utils.esc(s.notes)+'</div>' : '')

      // ── FOOTER ───────────────────────────────────────────────────────────────
      +'<div class="footer">'
      +'<div class="sig-line">Authorised Signature &nbsp;&nbsp;&nbsp; Date: _________</div>'
      +'<div class="sig-line" style="text-align:right">Client Acceptance &nbsp;&nbsp;&nbsp; Date: _________</div>'
      +'</div>'
      +'<div class="page-footer">'+Utils.esc(bizName)+(bizPhone?' &nbsp;·&nbsp; Tel: '+Utils.esc(bizPhone):'')+' &nbsp;·&nbsp; Thank you for your business!</div>'
      +'</div>'
      +'</body></html>';

    Sales._printHtml(html,'print-frame');
  },
  printPaymentReceipt: function(saleId,paymentId,amount,newBalance){
    var s=DB.getSales().find(function(x){ return x.id===saleId; }); if(!s) return;
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var bizName=settings.bizName||'SmartStock Pro';
    var now=new Date();
    var allPayments=DB.getPaymentsForSale(saleId);

    var payHistRows=allPayments.map(function(p,i){
      return '<div class="row sm"><span>#'+(i+1)+' '+Utils.esc(p.note||'Payment')+' · '+(p.paidAt?new Date(p.paidAt).toLocaleDateString():'')+'</span><span class="paid bold">'+Utils.cur(p.amount,cur)+'</span></div>';
    }).join('');

    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Receipt</title>'
      +'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Courier New",monospace;font-size:13px;color:#000;background:#fff;padding:12px;max-width:360px;margin:0 auto}.center{text-align:center}.bold{font-weight:bold}.lg{font-size:16px}.sm{font-size:11px}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;padding:3px 0}.paid{color:#16a34a}.bal{color:#d97706}@media print{@page{margin:5mm}body{max-width:100%}}</style></head><body>'
      +'<div class="center bold lg">'+bizName+'</div>'
      +'<div class="center bold sm">PAYMENT RECEIPT</div>'
      +'<div class="center sm">'+now.toLocaleString()+'</div>'
      +'<div class="line"></div>'
      +'<div class="row"><span>Customer:</span><span class="bold">'+Utils.esc(s.customer||'Walk-in')+'</span></div>'
      +'<div class="row"><span>Receipt #:</span><span class="bold">'+(paymentId||'PMT')+'</span></div>'
      +'<div class="row"><span>Original Invoice:</span><span>'+Utils.esc(Sales.no(s))+'</span></div>'
      +'<div class="row"><span>Date:</span><span>'+now.toLocaleDateString()+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="row"><span>Invoice Total:</span><span>'+Utils.cur(s.total,cur)+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="bold sm" style="margin-bottom:4px">ALL PAYMENTS</div>'
      +payHistRows
      +'<div class="line"></div>'
      +'<div class="row paid bold lg"><span>Amount Paid Today</span><span>'+Utils.cur(amount,cur)+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="row '+(newBalance<=0?'paid':'bal')+' bold"><span>Remaining Balance</span><span>'+(newBalance<=0?'FULLY PAID ✓':Utils.cur(newBalance,cur))+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="center sm">Thank you for your payment!</div>'
      +'<div class="center sm bold">'+bizName+'</div>'
      +'</body></html>';

    Sales._printHtml(html,'print-frame-2');
  },

  // ── SHARED PRINT HELPER ────────────────────────────────────────────────────
  _printHtml: function(html, frameId){
    // Inject print-color-adjust into the HTML if not present
    if (html.indexOf('-webkit-print-color-adjust') === -1) {
      html = html.replace('<style>', '<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}');
    }
    // Ensure A4 page size is enforced
    if (html.indexOf('@page') === -1) {
      html = html.replace('</style>', '@page{size:A4 portrait;margin:10mm}</style>');
    }

    // Remove old overlay
    var oldOv = document.getElementById(frameId + '-overlay');
    if (oldOv) oldOv.remove();
    var old = document.getElementById(frameId);
    if (old) old.remove();

    // Full-screen overlay with close button
    var overlay = document.createElement('div');
    overlay.id  = frameId + '-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.id = frameId + '-close';
    closeBtn.innerHTML = '✕ Close';
    closeBtn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:100000;background:#111;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3)';
    closeBtn.onclick = function() { overlay.remove(); closeBtn.remove(); };
    document.body.appendChild(closeBtn);

    // iframe
    var f = document.createElement('iframe');
    f.id  = frameId;
    f.style.cssText = 'width:100%;height:100%;border:none';
    overlay.appendChild(f);
    document.body.appendChild(overlay);

    try {
      f.contentDocument.open();
      f.contentDocument.write(html);
      f.contentDocument.close();
      setTimeout(function() {
        try {
          f.contentWindow.focus();
          f.contentWindow.print();
          // IMPORTANT: do NOT auto-remove the iframe on a timer.
          // On Android, the PDF is rendered only when the user taps
          // "Save" in the print dialog — if the iframe is gone by then,
          // Chrome renders the app screen into the PDF instead.
          // Desktop: close automatically once the print dialog closes.
          var isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
          if (!isMobile) {
            f.contentWindow.onafterprint = function() {
              setTimeout(function() { overlay.remove(); closeBtn.remove(); }, 500);
            };
          }
          // Mobile: the report stays visible; user taps ✕ Close when done.
        } catch(e) {
          overlay.remove(); closeBtn.remove();
          var blob = new Blob([html], {type:'text/html'});
          var url  = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }
      }, 600);
    } catch(e) {
      overlay.remove(); closeBtn.remove();
      var blob = new Blob([html], {type:'text/html'});
      var url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  },
};
