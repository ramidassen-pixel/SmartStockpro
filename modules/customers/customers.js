var Customers = {
  editId: null,
  search: '',

  // ── CUSTOMERS LIST ─────────────────────────────────────────────────────────
  render() {
    const pg = Utils.get('pg-customers');
    if (!pg) return;
    const list     = DB.getCustomers();
    const settings = DB.getSettings();
    const cur      = settings.currency || '$';
    const vip      = list.filter(c => c.status === 'VIP').length;
    const allSales = DB.getSales();
    const outstanding = allSales.filter(s => s.status !== 'Paid')
      .reduce((a, s) => a + (parseFloat(s.balance) || 0), 0);

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Customers</div>
          <div class="page-sub">${list.length} customers · ${vip} VIP</div>
        </div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Customers.openAddModal()">＋ Add</button>
        </div>
      </div>

      <div class="sec">
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:12px">
          <div class="kpi" style="--kc:var(--in);--kibg:var(--inb)">
            <div class="kpi-icon">👥</div><div class="kpi-label">Total</div>
            <div class="kpi-value">${list.length}</div>
          </div>
          <div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">
            <div class="kpi-icon">⭐</div><div class="kpi-label">VIP</div>
            <div class="kpi-value">${vip}</div>
          </div>
          <div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)">
            <div class="kpi-icon">💳</div><div class="kpi-label">Outstanding</div>
            <div class="kpi-value" style="font-size:16px">${Utils.cur(outstanding,cur)}</div>
          </div>
        </div>
      </div>

      <!-- SEARCH BAR -->
      <div style="display:flex;align-items:center;gap:9px;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:var(--r10);padding:10px 13px;margin:0 14px 12px;transition:border-color .2s">
        <span style="font-size:16px;color:var(--t3)">🔍</span>
        <input id="cust-search" placeholder="Search by name, phone, invoice, amount, date..."
          style="flex:1;background:none;color:var(--t1);font-size:14px;border:none;outline:none"
          value="${Utils.esc(this.search)}"
          oninput="Customers.setSearch(this.value)">
        ${this.search ? `<button onclick="Customers.setSearch('')" style="color:var(--t3);font-size:16px;cursor:pointer;padding:2px">✕</button>` : ''}
      </div>

      <div id="cust-list" class="sec"></div>`;

    this._renderList();
  },

  setSearch(v) {
    this.search = v;
    const el = Utils.get('cust-search');
    if (el) el.value = v;
    this._renderList();
    // Update clear button
    const pg = Utils.get('pg-customers');
    if (!pg) return;
    const clearBtn = pg.querySelector('[onclick*="setSearch(\'\'"]');
    if (!v && clearBtn) clearBtn.remove();
  },

  _renderList() {
    const el  = Utils.get('cust-list');
    if (!el) return;
    const settings = DB.getSettings();
    const cur      = settings.currency || '$';
    const q        = this.search.toLowerCase().trim();
    const allSales = DB.getSales();

    let list = DB.getCustomers();

    // If there is a search query — search customers AND sales
    if (q) {
      const matchedCustIds = new Set();

      // Search through sales by invoice number, amount, date
      allSales.forEach(s => {
        const matchInvoice = (s.id||'').toLowerCase().includes(q);
        const matchAmount  = String(s.total||'').includes(q);
        const matchDate    = (s.date||'').includes(q);
        const matchName    = (s.customer||'').toLowerCase().includes(q);
        if ((matchInvoice || matchAmount || matchDate || matchName) && s.customerId) {
          matchedCustIds.add(s.customerId);
        }
      });

      list = list.filter(c => {
        const matchName  = (c.name||'').toLowerCase().includes(q);
        const matchPhone = (c.phone||'').toLowerCase().includes(q);
        const matchEmail = (c.email||'').toLowerCase().includes(q);
        return matchName || matchPhone || matchEmail || matchedCustIds.has(c.id);
      });
    }

    if (!list.length) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-icon">👥</div>
          <div class="empty-title">${q ? 'No results for "'+Utils.esc(q)+'"' : 'No customers yet'}</div>
          <div class="empty-sub">${q ? 'Try a different search term' : 'Customers are added automatically when you make a sale, or tap + Add'}</div>
          ${!q ? '<div class="empty-action"><button class="btn-primary btn-sm" onclick="Customers.openAddModal()">＋ Add Customer</button></div>' : ''}
        </div>`;
      return;
    }

    el.innerHTML = `<div class="card">${list.map(c => {
      const custSales = allSales.filter(s => s.customerId === c.id || s.customer === c.name);
      const openBal   = custSales.filter(s => s.status !== 'Paid').reduce((a,s)=>a+(parseFloat(s.balance)||0),0);
      const initials  = (c.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

      return `
      <div class="list-item" onclick="Customers.viewProfile('${c.id}')">
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#07080D;flex-shrink:0;border:1.5px solid rgba(201,168,76,.25)">${initials}</div>
        <div class="list-info">
          <div class="list-name">
            ${Utils.esc(c.name)}
            ${c.status==='VIP'?'<span class="badge badge-gold">VIP</span>':''}
            ${openBal>0?`<span class="badge badge-warn">Owes ${Utils.cur(openBal,cur)}</span>`:''}
          </div>
          <div class="list-meta">
            ${c.phone?`📞 ${Utils.esc(c.phone)}`:''}
            ${c.email?`· ${Utils.esc(c.email)}`:''}
          </div>
          <div class="list-meta">
            ${custSales.length} invoice${custSales.length!==1?'s':''} · ${Utils.cur(c.totalSpent||0,cur)} total
          </div>
        </div>
        <div class="list-right">
          <div class="list-actions">
            <button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Customers.openEditModal('${c.id}')" title="Edit">✏️</button>
            <button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Customers.del('${c.id}','${Utils.esc(c.name)}')" title="Delete">🗑</button>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
  },

  // ── CUSTOMER PROFILE & HISTORY ─────────────────────────────────────────────
  viewProfile(id) {
    const c = DB.getCustomers().find(x => x.id === id);
    if (!c) return;
    const settings = DB.getSettings();
    const cur      = settings.currency || '$';
    const allSales = DB.getSales().filter(s => s.customerId === id || s.customer === c.name);
    const payments = DB.getPaymentsForCustomer(id);
    const openBal  = allSales.filter(s=>s.status!=='Paid').reduce((a,s)=>a+(parseFloat(s.balance)||0),0);
    const totalPaid= allSales.reduce((a,s)=>a+(parseFloat(s.amountPaid)||parseFloat(s.total)||0),0);
    const initials = (c.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

    Modal.open({
      title: c.name,
      sub: `${c.status||'Active'} · ${allSales.length} invoices`,
      barColor: openBal>0 ? 'var(--wa)' : 'var(--ok)',
      body: `
        <!-- Profile card -->
        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:15px;margin-bottom:14px;display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#07080D;flex-shrink:0">${initials}</div>
          <div style="flex:1">
            <div style="font-size:17px;font-weight:800;color:var(--t1)">${Utils.esc(c.name)}</div>
            ${c.phone?`<div style="font-size:12px;color:var(--t2);margin-top:2px">📞 ${Utils.esc(c.phone)}</div>`:''}
            ${c.email?`<div style="font-size:12px;color:var(--t2);margin-top:1px">✉️ ${Utils.esc(c.email)}</div>`:''}
            ${c.address?`<div style="font-size:12px;color:var(--t2);margin-top:1px">📍 ${Utils.esc(c.address)}</div>`:''}
          </div>
        </div>

        <!-- Summary stats -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
          <div style="background:var(--gb3);border:1px solid rgba(201,168,76,.15);border-radius:var(--r10);padding:12px;text-align:center">
            <div style="font-size:18px;font-weight:800;color:var(--g)">${allSales.length}</div>
            <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-top:3px">Invoices</div>
          </div>
          <div style="background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r10);padding:12px;text-align:center">
            <div style="font-size:14px;font-weight:800;color:var(--ok)">${Utils.cur(totalPaid,cur)}</div>
            <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-top:3px">Total Paid</div>
          </div>
          <div style="background:${openBal>0?'var(--wab)':'var(--okb)'};border:1px solid ${openBal>0?'var(--wabd)':'var(--okbd)'};border-radius:var(--r10);padding:12px;text-align:center">
            <div style="font-size:14px;font-weight:800;color:${openBal>0?'var(--wa)':'var(--ok)'}">${openBal>0?Utils.cur(openBal,cur):'Clear'}</div>
            <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-top:3px">Balance</div>
          </div>
        </div>

        <!-- Invoice history -->
        <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Invoice History (${allSales.length})</div>
        ${allSales.length ? `
        <div class="card" style="margin-bottom:12px">
          ${allSales.map(s=>`
          <div style="padding:12px 14px;border-bottom:1px solid var(--bd);cursor:pointer" onclick="Modal.close();Sales.viewInvoice('${s.id}')">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700;color:var(--t1);font-family:var(--fm)">${s.id}</div>
                <div style="font-size:11px;color:var(--t2);margin-top:2px">${Utils.date(s.date)} · ${s.payment||'Cash'}</div>
                ${s.status==='Partial'?`
                <div style="margin-top:5px">
                  <div class="progress"><div class="progress-fill" style="width:${Math.min(100,Math.round(((parseFloat(s.amountPaid)||0)/(parseFloat(s.total)||1))*100))}%;background:var(--wa)"></div></div>
                  <div style="font-size:10px;color:var(--wa);margin-top:3px">Paid ${Utils.cur(s.amountPaid||0,cur)} · Bal ${Utils.cur(s.balance||0,cur)}</div>
                </div>`:''}
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:15px;font-weight:800;color:var(--g)">${Utils.cur(s.total,cur)}</div>
                <div style="margin-top:4px">${Utils.statusBadge(s.status||'Paid')}</div>
                ${s.status!=='Paid'?`<button class="btn-ok btn-sm" style="margin-top:5px" onclick="event.stopPropagation();Modal.close();Sales.openPayBalance('${s.id}')">💳 Pay</button>`:''}
              </div>
            </div>
          </div>`).join('')}
        </div>` : '<div class="empty" style="padding:20px"><div class="empty-icon">🧾</div><div class="empty-title">No invoices yet</div></div>'}

        <!-- Payment history -->
        ${payments.length ? `
        <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Payment History (${payments.length})</div>
        <div class="card">
          ${payments.map(p=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-bottom:1px solid var(--bd)">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--t1)">${Utils.esc(p.note||'Payment')}</div>
              <div style="font-size:10px;color:var(--t3);font-family:var(--fm);margin-top:2px">${p.id} · ${p.paidAt?new Date(p.paidAt).toLocaleDateString():''} · ${p.method||'Cash'}</div>
              ${p.invoiceRef?`<div style="font-size:10px;color:var(--t2)">Ref: ${p.invoiceRef}</div>`:''}
            </div>
            <div style="font-size:14px;font-weight:800;color:var(--ok);font-family:var(--fm)">${Utils.cur(p.amount,cur)}</div>
          </div>`).join('')}
        </div>` : ''}`,

      footer: `
        <button class="btn-ghost" onclick="Modal.close()">Close</button>
        <button class="btn-ghost" onclick="Customers.openEditModal('${c.id}')">✏️ Edit</button>
        ${openBal>0?`<button class="btn-primary" style="flex:1;background:linear-gradient(135deg,var(--wa),#b45309);color:#fff" onclick="Modal.close();Sales.openPayBalance('${allSales.find(s=>s.status!=='Paid')?.id||''}')">💳 Pay Balance</button>`:''}`,
    });
  },

  // ── ADD / EDIT FORMS ───────────────────────────────────────────────────────
  openAddModal() {
    this.editId = null;
    Modal.open({ title:'Add Customer', body:this._form(), barColor:'var(--in)',
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Customers.save()">💾 Save</button>` });
  },

  openEditModal(id) {
    this.editId = id;
    const c = DB.getCustomers().find(x => x.id === id);
    if (!c) return;
    Modal.open({ title:'Edit Customer', sub:c.name, body:this._form(c), barColor:'var(--in)',
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Customers.save()">💾 Update</button>` });
  },

  _form(c) {
    c = c || {};
    return `
      <div class="form-row">
        <div class="fg"><label class="fl">Full Name *</label>
          <input class="fi" id="cf-name" value="${Utils.esc(c.name||'')}" placeholder="John Doe"></div>
        <div class="fg"><label class="fl">Phone</label>
          <input class="fi" id="cf-phone" value="${Utils.esc(c.phone||'')}" placeholder="+1 555-0000" type="tel"></div>
      </div>
      <div class="fg"><label class="fl">Email</label>
        <input class="fi" id="cf-email" value="${Utils.esc(c.email||'')}" type="email" placeholder="email@example.com"></div>
      <div class="form-row">
        <div class="fg"><label class="fl">Status</label>
          <select class="fi" id="cf-status">
            <option${(c.status||'Active')==='Active'?' selected':''}>Active</option>
            <option${c.status==='VIP'?' selected':''}>VIP</option>
            <option${c.status==='Inactive'?' selected':''}>Inactive</option>
          </select></div>
        <div class="fg"><label class="fl">Credit Limit</label>
          <input class="fi" id="cf-credit" type="number" value="${c.credit||0}" min="0"></div>
      </div>
      <div class="fg"><label class="fl">Address</label>
        <input class="fi" id="cf-addr" value="${Utils.esc(c.address||'')}" placeholder="Street, City"></div>`;
  },

  save() {
    const name = Utils.val('cf-name');
    if (!name) { Toast.show('Name is required', 'err'); return; }
    const data = {
      name, phone: Utils.val('cf-phone'), email: Utils.val('cf-email'),
      address: Utils.val('cf-addr'), credit: parseFloat(Utils.val('cf-credit')||0),
      status: Utils.get('cf-status')?.value || 'Active',
    };
    if (this.editId) { DB.updateCustomer(this.editId, data); Toast.show('Customer updated ✓', 'ok'); }
    else { DB.addCustomer(data); Toast.show('Customer added ✓', 'ok'); }
    Modal.close();
    this.render();
  },

  del(id, name) {
    confirmDel(`Delete "${name}"?`, () => {
      DB.deleteCustomer(id);
      Toast.show('Deleted', 'warn');
      this.render();
    });
  },

  debtFollowUp: function(custId) {
    var cust    = DB.getCustomers().find(function(c){ return c.id===custId; });
    if (!cust) return;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var bizPhone = settings.bizPhone || '';

    // Get unpaid sales for this customer
    var unpaidSales = DB.getSales().filter(function(s){
      return (s.customerId===custId||s.customer===cust.name) && s.status !== 'Paid' && parseFloat(s.balance)>0;
    });
    var totalOwed = unpaidSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    if (!totalOwed) { Toast.show('No outstanding balance for '+cust.name,'ok'); return; }

    // Build debt details
    var debtLines = unpaidSales.map(function(s){
      return '• Invoice '+s.id+' ('+Utils.date(s.date)+'): '+Utils.cur(s.balance,cur);
    }).join('\n');

    // Aging
    var oldest = unpaidSales.reduce(function(a,s){ return !a||s.date<a?s.date:a; },null);
    var daysOld = oldest ? Math.floor((Date.now()-new Date(oldest).getTime())/(864e5)) : 0;

    // Build WhatsApp message
    var nl = '\n';
    var msg = 'Dear *'+cust.name+'*,' + nl + nl
      + 'This is a friendly reminder from *'+bizName+'* regarding your outstanding balance.' + nl + nl
      + 'Outstanding Invoices:' + nl
      + debtLines + nl + nl
      + 'Total Amount Owed: '+Utils.cur(totalOwed,cur) + nl
      + (daysOld > 0 ? 'Oldest invoice: '+daysOld+' days ago' + nl + nl : nl)
      + 'Please arrange payment at your earliest convenience.' + nl + nl
      + 'Thank you for your business!'
      + (bizPhone ? nl + 'Tel: '+bizPhone : '');

        // Show preview modal before sending
    Modal.open({
      title: '📤 Debt Follow-Up', sub: Utils.esc(cust.name), barColor: 'var(--wa)',
      body:
        '<div style="background:var(--wab);border:1px solid var(--wabd);border-radius:var(--r10);padding:12px 14px;margin-bottom:14px">'
        + '<div style="font-size:13px;font-weight:700;color:var(--wa);margin-bottom:4px">Total Outstanding</div>'
        + '<div style="font-size:22px;font-weight:900;color:var(--er)">'+Utils.cur(totalOwed,cur)+'</div>'
        + '<div style="font-size:11px;color:var(--t2);margin-top:2px">'+unpaidSales.length+' invoice'+(unpaidSales.length!==1?'s':'')+' · '+daysOld+' days outstanding</div>'
        + '</div>'
        + '<div class="fg"><label class="fl">WhatsApp Message Preview</label>'
        + '<textarea class="fi" id="debt-msg" rows="10" style="font-size:12px;line-height:1.6;resize:none">'+msg+'</textarea></div>'
        + '<div class="fg"><label class="fl">Customer Phone</label>'
        + '<input class="fi" id="debt-phone" value="'+(cust.phone||'')+'" placeholder="+231 77 000 000"></div>',
      footer:
        '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
        + '<button class="btn-primary" style="flex:1;background:#25D366" onclick="Customers.sendDebtWhatsApp()">📤 Send via WhatsApp</button>',
    });
  },

  sendDebtWhatsApp: function() {
    var msg     = Utils.val('debt-msg');
    var phone   = Utils.val('debt-phone').replace(/[^0-9]/g,'');
    var encoded = encodeURIComponent(msg);
    var url     = phone && phone.length > 5
      ? 'https://wa.me/' + phone + '?text=' + encoded
      : 'https://wa.me/?text=' + encoded;

    // Anchor click trick — works in PWA where window.open is blocked
    var a = document.createElement('a');
    a.href   = url;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ document.body.removeChild(a); }, 500);
    Modal.close();
  },

  debtReport: function() {
    var customers = DB.getCustomers();
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';
    var allSales  = DB.getSales();
    var today     = new Date();

    // Build debt aging report
    var debtors = customers.map(function(cust){
      var unpaid = allSales.filter(function(s){
        return (s.customerId===cust.id||s.customer===cust.name) && s.status!=='Paid' && parseFloat(s.balance)>0;
      });
      var total  = unpaid.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
      if (!total) return null;
      var oldest = unpaid.reduce(function(a,s){ return !a||s.date<a?s.date:a; },null);
      var days   = oldest ? Math.floor((today-new Date(oldest))/(864e5)) : 0;
      return { cust:cust, total:total, count:unpaid.length, days:days };
    }).filter(Boolean).sort(function(a,b){ return b.total-a.total; });

    if (!debtors.length) {
      Modal.open({
        title: '💚 Debt Report', barColor: 'var(--ok)',
        body: '<div style="text-align:center;padding:30px"><div style="font-size:48px;margin-bottom:12px">✅</div><div style="font-size:16px;font-weight:700;color:var(--ok)">All customers are fully paid!</div><div style="font-size:12px;color:var(--t2);margin-top:6px">No outstanding balances</div></div>',
        footer: '<button class="btn-primary btn-full" onclick="Modal.close()">Close</button>',
      });
      return;
    }

    var totalDebt = debtors.reduce(function(a,d){ return a+d.total; },0);
    var body = '<div style="background:var(--erb);border-radius:var(--r10);padding:12px 14px;margin-bottom:14px;display:flex;justify-content:space-between">'
      + '<div><div style="font-size:11px;color:var(--t2)">Total Outstanding</div><div style="font-size:20px;font-weight:900;color:var(--er)">'+Utils.cur(totalDebt,cur)+'</div></div>'
      + '<div style="text-align:right"><div style="font-size:11px;color:var(--t2)">Debtors</div><div style="font-size:20px;font-weight:900;color:var(--er)">'+debtors.length+'</div></div>'
      + '</div>'
      + debtors.map(function(d){
          var col = d.days > 30 ? 'var(--er)' : d.days > 7 ? 'var(--wa)' : 'var(--t2)';
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bd)">'
            + '<div style="flex:1">'
            + '<div style="font-size:13px;font-weight:700;color:var(--t1)">'+Utils.esc(d.cust.name)+'</div>'
            + '<div style="font-size:11px;color:'+col+'">'+(d.cust.phone?'📞 '+d.cust.phone+' · ':'')+d.days+' days outstanding · '+d.count+' invoice'+(d.count!==1?'s':'')+'</div>'
            + '</div>'
            + '<div style="text-align:right">'
            + '<div style="font-size:15px;font-weight:800;color:var(--er)">'+Utils.cur(d.total,cur)+'</div>'
            + '<button class="btn-ghost btn-sm" onclick="Customers.debtFollowUp(\'' + d.cust.id + '\')" style="color:#25D366;font-size:10px;margin-top:4px">📤 Follow Up</button>'
            + '</div></div>';
        }).join('');

    Modal.open({
      title: '⚠️ Debt Aging Report', barColor: 'var(--er)',
      body: body,
      footer: '<button class="btn-primary btn-full" onclick="Modal.close()">Close</button>',
    });
  },
};
