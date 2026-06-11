/* SmartStock Pro V5 — Full Bundle */

/* === utils.js === */
var Utils = {
  cur(v, sym) {
    sym = sym || DB.getSettings().currency || '$';
    return sym + (parseFloat(v) || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
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

/* === database.js === */
// SmartStock Pro V5 — Local Database (localStorage)
// Replace methods with Supabase calls when ready
var DB = {
  KEY: 'ssp_v5',

  _data: null,

  _default() {
    return {
      settings: { bizName:'SmartStock Pro', currency:'$', tax:0, lowStock:5, theme:'dark' },
      users: [],
      products: [],
      sales: [],
      customers: [],
      suppliers: [],
      expenses: [],
      employees: [],
      payroll: [],
      notifications: [],
      payments: [],
      allocations: [],
      purchaseOrders: [],
      grns: [],
      supplierBills: [],
      quotations: [],
    };
  },

  load() {
    const raw = Utils.storage.get(this.KEY);
    this._data = raw || this._default();
    // Ensure all arrays exist
    const d = this._data;
    ['users','products','sales','customers','suppliers','expenses','employees','payroll','notifications','payments','allocations','purchaseOrders','grns','supplierBills','quotations']
      .forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.settings) d.settings = this._default().settings;
    return this._data;
  },

  save() {
    if (this._data) Utils.storage.set(this.KEY, this._data);
  },

  get(key) { if (!this._data) this.load(); return this._data[key]; },
  set(key, val) { if (!this._data) this.load(); this._data[key] = val; this.save(); },

  getSettings() { return this.get('settings') || {}; },
  saveSettings(s) { this._data.settings = { ...this.getSettings(), ...s }; this.save(); },

  // Products
  getProducts() { return this.get('products') || []; },
  addProduct(p) { p.id = Utils.uid('P'); p.createdAt = Utils.today(); const arr = this.get('products'); arr.push(p); this.save(); return p; },
  updateProduct(id, data) { const arr = this.get('products'); const i = arr.findIndex(x=>x.id===id); if(i>-1) { arr[i]={...arr[i],...data,updatedAt:Utils.today()}; this.save(); } },
  deleteProduct(id) { this._data.products = this.get('products').filter(x=>x.id!==id); this.save(); },

  // Sales
  getSales() { return this.get('sales') || []; },
  addSale(s) { s.id = Utils.uid('INV'); s.createdAt = Utils.today(); const arr = this.get('sales'); arr.unshift(s); this.save(); return s; },
  updateSale(id, data) { const arr = this.get('sales'); const i = arr.findIndex(x=>x.id===id); if(i>-1) { arr[i]={...arr[i],...data}; this.save(); } },
  deleteSale(id) { this._data.sales = this.get('sales').filter(x=>x.id!==id); this.save(); },

  // Customers
  getCustomers() { return this.get('customers') || []; },
  addCustomer(c) { c.id = Utils.uid('C'); c.createdAt = Utils.today(); c.totalSpent=0; c.purchases=0; const arr = this.get('customers'); arr.push(c); this.save(); return c; },
  updateCustomer(id, data) { const arr = this.get('customers'); const i = arr.findIndex(x=>x.id===id); if(i>-1) { arr[i]={...arr[i],...data}; this.save(); } },
  deleteCustomer(id) { this._data.customers = this.get('customers').filter(x=>x.id!==id); this.save(); },

  // Suppliers
  getSuppliers() { return this.get('suppliers') || []; },
  addSupplier(s) { s.id = Utils.uid('S'); s.createdAt = Utils.today(); const arr = this.get('suppliers'); arr.push(s); this.save(); return s; },
  updateSupplier(id, data) { const arr = this.get('suppliers'); const i = arr.findIndex(x=>x.id===id); if(i>-1) { arr[i]={...arr[i],...data}; this.save(); } },
  deleteSupplier(id) { this._data.suppliers = this.get('suppliers').filter(x=>x.id!==id); this.save(); },

  // Expenses
  getExpenses() { return this.get('expenses') || []; },
  addExpense(e) { e.id = Utils.uid('EXP'); e.createdAt = Utils.today(); const arr = this.get('expenses'); arr.unshift(e); this.save(); return e; },
  deleteExpense(id) { this._data.expenses = this.get('expenses').filter(x=>x.id!==id); this.save(); },

  // Employees
  getEmployees() { return this.get('employees') || []; },
  addEmployee(e) { e.id = Utils.uid('E'); e.createdAt = Utils.today(); const arr = this.get('employees'); arr.push(e); this.save(); return e; },
  updateEmployee(id, data) { const arr = this.get('employees'); const i = arr.findIndex(x=>x.id===id); if(i>-1) { arr[i]={...arr[i],...data}; this.save(); } },
  deleteEmployee(id) { this._data.employees = this.get('employees').filter(x=>x.id!==id); this.save(); },

  // Payroll
  getPayroll() { return this.get('payroll') || []; },
  addPayroll(p) { p.id = Utils.uid('PAY'); p.paidAt = Utils.today(); const arr = this.get('payroll'); arr.unshift(p); this.save(); return p; },

  // Payments (partial payment history)
  getPayments()      { return this.get('payments') || []; },
  addPayment(p)      { p.id = Utils.uid('PAY'); p.paidAt = new Date().toISOString(); const arr = this.get('payments'); arr.unshift(p); this.save(); return p; },
  getPaymentsForSale(saleId) { return this.getPayments().filter(p => p.saleId === saleId); },
  getPaymentsForCustomer(custId) { return this.getPayments().filter(p => p.customerId === custId); },

  // Auto-create or find customer by name
  findOrCreateCustomer(name, phone) {
    if (!name || name.toLowerCase() === 'walk-in customer') return null;
    const existing = this.getCustomers().find(c =>
      c.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (existing) return existing;
    return this.addCustomer({ name: name.trim(), phone: phone||'', email:'', status:'Active', credit:0 });
  },

  // ── Allocations ──────────────────────────────────────────────────────────
  getAllocations() { return this.get('allocations') || []; },

  addAllocation(a) {
    a.id = Utils.uid('ALC');
    a.createdAt = Utils.today();
    var arr = this.get('allocations');
    arr.push(a);
    this.save();
    return a;
  },

  updateAllocation(id, data) {
    var arr = this.get('allocations');
    var i   = arr.findIndex(function(x){ return x.id===id; });
    if (i > -1) { arr[i] = Object.assign({}, arr[i], data); this.save(); }
  },

  deleteAllocation(id) {
    this._data.allocations = this.getAllocations().filter(function(x){ return x.id!==id; });
    this.save();
  },

  // Returns active allocations for today with their daily amounts
  getAllocatedDaily() {
    var today  = Utils.today();
    var allocs = this.getAllocations();
    return allocs.filter(function(a) {
      if (!a.startDate || a.startDate > today) return false;
      if (a.endDate && a.endDate < today) return false;
      return true;
    });
  },

  // Total allocated daily amount
  getAllocatedDailyTotal() {
    return this.getAllocatedDaily().reduce(function(sum, a){ return sum + (parseFloat(a.daily)||0); }, 0);
  },

  // Stats helpers

  // ── Purchase Orders ────────────────────────────────────────────────────────
  getPurchaseOrders() { return this.get('purchaseOrders') || []; },
  addPurchaseOrder(p) { p.id = Utils.uid('PO'); p.createdAt = Utils.today(); var arr = this.get('purchaseOrders'); arr.unshift(p); this.save(); return p; },
  updatePurchaseOrder(id, data) { var arr = this.get('purchaseOrders'); var i = arr.findIndex(function(x){ return x.id===id; }); if(i>-1){ arr[i]=Object.assign({},arr[i],data); this.save(); } },
  deletePurchaseOrder(id) { this._data.purchaseOrders = this.getPurchaseOrders().filter(function(x){ return x.id!==id; }); this.save(); },

  // ── Goods Received Notes ───────────────────────────────────────────────────
  getGRNs() { return this.get('grns') || []; },
  addGRN(g) { g.id = Utils.uid('GRN'); g.createdAt = Utils.today(); var arr = this.get('grns'); arr.unshift(g); this.save(); return g; },
  updateGRN(id, data) { var arr = this.get('grns'); var i = arr.findIndex(function(x){ return x.id===id; }); if(i>-1){ arr[i]=Object.assign({},arr[i],data); this.save(); } },

  // ── Supplier Bills ─────────────────────────────────────────────────────────
  getSupplierBills() { return this.get('supplierBills') || []; },
  addSupplierBill(b) { b.id = Utils.uid('BILL'); b.createdAt = Utils.today(); var arr = this.get('supplierBills'); arr.unshift(b); this.save(); return b; },
  updateSupplierBill(id, data) { var arr = this.get('supplierBills'); var i = arr.findIndex(function(x){ return x.id===id; }); if(i>-1){ arr[i]=Object.assign({},arr[i],data); this.save(); } },
  deleteSupplierBill(id) { this._data.supplierBills = this.getSupplierBills().filter(function(x){ return x.id!==id; }); this.save(); },

  // ── Quotations ─────────────────────────────────────────────────────────────
  getQuotations() { return this.get('quotations') || []; },
  addQuotation(q) { var yr=new Date().getFullYear(); var num=String(this.getQuotations().length+1).padStart(4,'0'); q.id='QT-'+yr+'-'+num; q.createdAt=Utils.today(); var arr=this.get('quotations'); arr.unshift(q); this.save(); return q; },
  updateQuotation(id, data) { var arr = this.get('quotations'); var i = arr.findIndex(function(x){ return x.id===id; }); if(i>-1){ arr[i]=Object.assign({},arr[i],data); this.save(); } },
  deleteQuotation(id) { this._data.quotations = this.getQuotations().filter(function(x){ return x.id!==id; }); this.save(); },

  stats() {
    const sales = this.getSales();
    const expenses = this.getExpenses();
    const products = this.getProducts();
    const today = Utils.today();
    const month = today.slice(0,7);
    const todaySales = sales.filter(s=>s.date===today);
    const monthSales = sales.filter(s=>s.date&&s.date.startsWith(month));
    const monthExp = expenses.filter(e=>e.date&&e.date.startsWith(month));
    const totalRev = monthSales.reduce((a,s)=>a+(parseFloat(s.total)||0),0);
    const totalExp = monthExp.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
    const todayRev = todaySales.reduce((a,s)=>a+(parseFloat(s.total)||0),0);
    const totalCogs = monthSales.reduce((a,s)=>a+(s.items||[]).reduce((b,i)=>b+(parseFloat(i.cost||0)*parseInt(i.qty||1)),0),0);
    const lowStock = products.filter(p=>p.qty<=(p.lowLevel||5)&&p.status!=='inactive');
    const outStock = products.filter(p=>p.qty===0&&p.status!=='inactive');
    var allocatedDaily = this.getAllocatedDailyTotal();
    var trueNetProfit  = totalRev - totalExp - allocatedDaily;
    return { totalRev, totalExp, todayRev, netProfit:totalRev-totalExp, trueNetProfit, allocatedDaily, totalCogs, grossProfit:totalRev-totalCogs, lowStock, outStock,
      todayCount:todaySales.length, monthCount:monthSales.length };
  },
};

/* === auth.js === */
var Auth = {
  currentUser: null,

  login: function() {
    var username = Utils.val('l-user');
    var password = Utils.val('l-pass');
    if (!username) { Auth._err('login-err', 'Enter your username'); return; }
    if (!password) { Auth._err('login-err', 'Enter your password'); return; }
    var users = DB.get('users') || [];
    if (!users.length) { Auth._err('login-err', 'No accounts yet — create one first'); return; }
    var user = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === username.toLowerCase()) { user = users[i]; break; }
    }
    if (!user) { Auth._err('login-err', 'Username not found'); return; }
    // Check password — supports plain, btoa, and SHA-256 hash
    var ok = (password === user.password)
          || (btoa(password) === user.password)
          || (typeof user.password === 'string' && user.password.length < 20 && password === user.password);
    if (!ok) {
      // Try SHA-256 async
      Auth._hashPw(password).then(function(hashed) {
        if (hashed === user.password) {
          Auth._doLogin(user);
        } else {
          Auth._err('login-err', 'Incorrect password');
        }
      });
      return;
    }
    Auth._doLogin(user);
  },

  _doLogin: function(user) {
    Auth.currentUser = user;
    Utils.storage.set('ssp_session', { uid: user.id });
    App.showShell();
  },

  signup: function() {
    var biz   = Utils.val('s-biz');
    var name  = Utils.val('s-name');
    var uname = Utils.val('s-user');
    var pw    = Utils.val('s-pass');
    if (!biz)        { Auth._err('signup-err', 'Enter your business name'); return; }
    if (!name)       { Auth._err('signup-err', 'Enter your full name'); return; }
    if (!uname)      { Auth._err('signup-err', 'Choose a username'); return; }
    if (pw.length < 6) { Auth._err('signup-err', 'Password must be at least 6 characters'); return; }
    var users = DB.get('users') || [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === uname.toLowerCase()) {
        Auth._err('signup-err', 'Username already taken'); return;
      }
    }
    // Save with plain password first (works immediately, no async hash issues)
    var user = {
      id: Utils.uid('U'),
      username: uname,
      name: name,
      role: 'owner',
      status: 'active',
      createdAt: Utils.today(),
      password: pw,
    };
    users.push(user);
    DB.set('users', users);
    DB.saveSettings({ bizName: biz, currency: '$' });
    Auth.currentUser = user;
    Utils.storage.set('ssp_session', { uid: user.id });
    App.showShell();
  },

  logout: function() {
    Auth.currentUser = null;
    Utils.storage.del('ssp_session');
    location.reload();
  },

  showTab: function(tab) {
    var inF  = Utils.get('login-form');
    var upF  = Utils.get('signup-form');
    var tIn  = Utils.get('ltab-in');
    var tUp  = Utils.get('ltab-up');
    var eI   = Utils.get('login-err');
    var eS   = Utils.get('signup-err');
    if (eI) eI.classList.add('hidden');
    if (eS) eS.classList.add('hidden');
    if (tab === 'in') {
      if (inF) { inF.style.display = 'block'; inF.classList.remove('hidden'); }
      if (upF) { upF.style.display = 'none';  upF.classList.add('hidden');    }
      if (tIn) tIn.classList.add('active');
      if (tUp) tUp.classList.remove('active');
    } else {
      if (upF) { upF.style.display = 'block'; upF.classList.remove('hidden'); }
      if (inF) { inF.style.display = 'none';  inF.classList.add('hidden');    }
      if (tUp) tUp.classList.add('active');
      if (tIn) tIn.classList.remove('active');
    }
  },

  togglePw: function(id) {
    var el = Utils.get(id);
    if (el) el.type = (el.type === 'password') ? 'text' : 'password';
  },

  _err: function(id, msg) {
    var el = Utils.get(id);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); el.style.display = 'block'; }
  },

  _hashPw: function(pw) {
    return new Promise(function(resolve) {
      try {
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw)).then(function(buf) {
          resolve(Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join(''));
        }).catch(function() { resolve(btoa(pw)); });
      } catch(e) { resolve(btoa(pw)); }
    });
  },

  forgotPassword: function() {
    var uname = Utils.val('l-user') || '';
    if (!uname) {
      Modal.open({
        title: 'Reset Password', barColor: 'var(--wa)',
        body: '<div class="fg"><label class="fl">Enter your Username</label>'
            + '<input class="fi" id="fp-user" placeholder="Your username"></div>',
        footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
              + '<button class="btn-primary" style="flex:1" onclick="Auth.doReset()">Find Account</button>',
      });
      return;
    }
    Auth._showResetFor(uname);
  },

  _showResetFor: function(uname) {
    var users = DB.get('users') || [];
    var found = false;
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === uname.toLowerCase()) { found = true; break; }
    }
    if (!found) {
      Modal.open({
        title: 'Not Found',
        body: '<div style="text-align:center;padding:20px 10px">'
            + '<div style="font-size:44px;margin-bottom:12px">🔍</div>'
            + '<div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:8px">Username not found</div>'
            + '<div style="font-size:13px;color:var(--t2)">No account with that username exists.</div></div>',
        footer: '<button class="btn-primary btn-full" onclick="Modal.close()">OK</button>',
      });
      return;
    }
    Auth._resetUser = uname;
    Modal.open({
      title: 'Reset Password', sub: 'Account: ' + uname, barColor: 'var(--wa)',
      body: '<div class="fg"><label class="fl">New Password (min 6 chars)</label>'
          + '<input class="fi" id="fp-new" type="password" placeholder="Enter new password"></div>'
          + '<div class="fg"><label class="fl">Confirm Password</label>'
          + '<input class="fi" id="fp-conf" type="password" placeholder="Confirm new password"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Auth.saveReset()">Reset Password</button>',
    });
  },

  doReset: function() {
    var el = Utils.get('fp-user');
    if (!el) return;
    var uname = el.value.trim();
    if (!uname) { Toast.show('Enter your username', 'err'); return; }
    Modal.close();
    setTimeout(function() { Auth._showResetFor(uname); }, 250);
  },

  saveReset: function() {
    var newPw = Utils.val('fp-new');
    var conf  = Utils.val('fp-conf');
    if (!newPw || newPw.length < 6) { Toast.show('Min 6 characters', 'err'); return; }
    if (newPw !== conf) { Toast.show('Passwords do not match', 'err'); return; }
    var users = DB.get('users') || [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === Auth._resetUser.toLowerCase()) {
        users[i].password = newPw;
        DB.set('users', users);
        Modal.close();
        Toast.show('Password reset! Sign in with your new password.', 'ok');
        return;
      }
    }
    Toast.show('Account not found', 'err');
  },

  _resetUser: '',

  bootSync: function() {
    try {
      var sess = Utils.storage.get('ssp_session');
      if (sess && sess.uid) {
        var users = DB.get('users') || [];
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === sess.uid && users[i].status !== 'pending') {
            Auth.currentUser = users[i]; return true;
          }
        }
      }
    } catch(e) {}
    return false;
  },
};

/* === quickcreate.js === */
// ══════════════════════════════════════════════════════════════════════════
// QUICKCREATE — Inline Supplier & Product creation from any transaction screen
// Called from: Supply (PO, GRN, Bills, Reorder), Sales
// ══════════════════════════════════════════════════════════════════════════
var QuickCreate = {

  // ── QUICK SUPPLIER ─────────────────────────────────────────────────────────
  // callbackFn receives the new supplier object after save
  quickSupplier: function(callbackFn) {
    Modal.open({
      title: '+ Add New Supplier',
      sub: 'Saved instantly to all supplier databases',
      barColor: 'var(--wa)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Supplier Name *</label>'
          + '<input class="fi" id="qs-name" placeholder="e.g. CeramTech Ltd"></div>'
          + '<div class="fg"><label class="fl">Contact Person</label>'
          + '<input class="fi" id="qs-contact" placeholder="e.g. John Smith"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Phone Number</label>'
          + '<input class="fi" id="qs-phone" type="tel" placeholder="+231 77 000 000"></div>'
          + '<div class="fg"><label class="fl">WhatsApp</label>'
          + '<input class="fi" id="qs-whatsapp" type="tel" placeholder="+231 77 000 000"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Email</label>'
          + '<input class="fi" id="qs-email" type="email" placeholder="supplier@email.com"></div>'
          + '<div class="fg"><label class="fl">Address</label>'
          + '<input class="fi" id="qs-addr" placeholder="City, Country"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Notes</label>'
          + '<input class="fi" id="qs-notes" placeholder="Payment terms, special instructions..."></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="QuickCreate._saveSupplier()">✓ Save &amp; Select Supplier</button>',
    });
    // Store callback for after save
    QuickCreate._suppCallback = callbackFn;
  },

  _suppCallback: null,

  _saveSupplier: function() {
    var name = Utils.val('qs-name').trim();
    if (!name) { Toast.show('Supplier name is required', 'err'); return; }
    var supp = DB.addSupplier({
      name:    name,
      contact: Utils.val('qs-contact'),
      phone:   Utils.val('qs-phone'),
      whatsapp:Utils.val('qs-whatsapp'),
      email:   Utils.val('qs-email'),
      address: Utils.val('qs-addr'),
      notes:   Utils.val('qs-notes'),
      balance: 0,
      status: 'Active',
    });
    Modal.close();
    Toast.show('✓ Supplier "'+Utils.esc(supp.name)+'" added and saved to all databases', 'ok');
    // Fire callback — caller refreshes its dropdown and selects new supplier
    if (typeof QuickCreate._suppCallback === 'function') {
      QuickCreate._suppCallback(supp);
      QuickCreate._suppCallback = null;
    }
  },

  // ── QUICK PRODUCT ──────────────────────────────────────────────────────────
  // callbackFn receives the new product object after save
  quickProduct: function(callbackFn) {
    var suppliers = DB.getSuppliers();
    var suppOpts = '<option value="">— select supplier —</option>'
      + suppliers.map(function(s){ return '<option value="'+s.id+'">'+Utils.esc(s.name)+'</option>'; }).join('');
    var cats = ['Floor Tiles','Wall Tiles','Porcelain','Natural Stone','Outdoor','Adhesive & Grout','Other'];

    Modal.open({
      title: '+ Add New Product',
      sub: 'Saved instantly to inventory and all databases',
      barColor: 'var(--ok)',
      body: '<div class="form-row">'
          + '<div class="fg" style="flex:2"><label class="fl">Product Name *</label>'
          + '<input class="fi" id="qp-name" placeholder="e.g. Ceramic Floor Tile 60x60"></div>'
          + '<div class="fg"><label class="fl">Category</label>'
          + '<select class="fi" id="qp-cat">'
          + cats.map(function(c){ return '<option>'+c+'</option>'; }).join('')
          + '</select></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">SKU / Code</label>'
          + '<input class="fi" id="qp-sku" placeholder="e.g. CFT-6060"></div>'
          + '<div class="fg"><label class="fl">Barcode</label>'
          + '<input class="fi" id="qp-barcode" placeholder="Optional"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Cost Price *</label>'
          + '<input class="fi" id="qp-cost" type="number" step="0.01" min="0" placeholder="0.00"></div>'
          + '<div class="fg"><label class="fl">Selling Price *</label>'
          + '<input class="fi" id="qp-price" type="number" step="0.01" min="0" placeholder="0.00"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Opening Quantity</label>'
          + '<input class="fi" id="qp-qty" type="number" min="0" value="0"></div>'
          + '<div class="fg"><label class="fl">Unit</label>'
          + '<select class="fi" id="qp-unit">'
          + ['Box','Pcs','Sqm','Bag','Roll','Set','Pallet','Other'].map(function(u){ return '<option>'+u+'</option>'; }).join('')
          + '</select></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Default Supplier</label>'
          + '<select class="fi" id="qp-supp">'+suppOpts+'</select></div>'
          + '<div class="fg"><label class="fl">Description</label>'
          + '<input class="fi" id="qp-desc" placeholder="Optional product description..."></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="QuickCreate._saveProduct()">✓ Save &amp; Add to Order</button>',
    });
    QuickCreate._prodCallback = callbackFn;
  },

  _prodCallback: null,

  _saveProduct: function() {
    var name  = Utils.val('qp-name').trim();
    var cost  = parseFloat(Utils.val('qp-cost')||0);
    var price = parseFloat(Utils.val('qp-price')||0);
    if (!name)  { Toast.show('Product name is required', 'err'); return; }
    if (!price) { Toast.show('Selling price is required', 'err'); return; }
    var prod = DB.addProduct({
      name:     name,
      category: (Utils.get('qp-cat')||{value:'Other'}).value,
      sku:      Utils.val('qp-sku'),
      barcode:  Utils.val('qp-barcode'),
      cost:     cost,
      price:    price,
      qty:      parseInt(Utils.val('qp-qty')||0),
      unit:     (Utils.get('qp-unit')||{value:'Pcs'}).value,
      defaultSupplierId: (Utils.get('qp-supp')||{value:''}).value||null,
      description: Utils.val('qp-desc'),
      status:   'active',
      lowLevel: 5,
    });
    Modal.close();
    Toast.show('✓ Product "'+Utils.esc(prod.name)+'" added to inventory and all databases', 'ok');
    if (typeof QuickCreate._prodCallback === 'function') {
      QuickCreate._prodCallback(prod);
      QuickCreate._prodCallback = null;
    }
  },

  // ── HELPERS: build dropdown option lists with + Add New buttons ────────────
  // Returns HTML string for a <select> with "+ Add New Supplier" as first option
  supplierOptions: function(selectedId, placeholder) {
    var ph = placeholder || '— select supplier —';
    var suppliers = DB.getSuppliers();
    var opts = '<option value="">'+ph+'</option>'
      + '<option value="__new__" style="color:var(--ok);font-weight:700">＋ Add New Supplier</option>';
    if (suppliers.length) opts += '<option disabled>──────────────</option>';
    opts += suppliers.map(function(s){
      return '<option value="'+s.id+'"'+(s.id===selectedId?' selected':'')+'>'+Utils.esc(s.name)+'</option>';
    }).join('');
    return opts;
  },

  // Returns HTML string for a <select> with "+ Add New Product" as first option
  productOptions: function(selectedId, placeholder) {
    var ph = placeholder || '— tap to select product —';
    var products = DB.getProducts().filter(function(p){ return p.status !== 'inactive'; });
    var opts = '<option value="">'+ph+'</option>'
      + '<option value="__new__" style="color:var(--ok);font-weight:700">＋ Add New Product</option>';
    if (products.length) opts += '<option disabled>──────────────</option>';
    opts += products.map(function(p){
      return '<option value="'+p.id+'"'+(p.id===selectedId?' selected':'')+'>'+Utils.esc(p.name)+'</option>';
    }).join('');
    return opts;
  },

  // Handle supplier dropdown change — intercepts __new__ value
  // elId: the select element id, refreshFn: called with new supplier to refresh the select
  onSupplierChange: function(sel, refreshFn) {
    if (sel.value === '__new__') {
      sel.value = ''; // reset while popup is open
      QuickCreate.quickSupplier(function(newSupp) {
        if (typeof refreshFn === 'function') refreshFn(newSupp);
      });
      return true; // was intercepted
    }
    return false; // normal selection
  },

  // Handle product dropdown change — intercepts __new__ value
  onProductChange: function(sel, refreshFn) {
    if (sel.value === '__new__') {
      sel.value = '';
      QuickCreate.quickProduct(function(newProd) {
        if (typeof refreshFn === 'function') refreshFn(newProd);
      });
      return true;
    }
    return false;
  },
};

/* === router.js === */
var PAGES = ['dashboard','products','sales','customers','suppliers','supply','expenses','salary','finance','reports','quotations','ai','settings','more'];
var BN_PAGES = ['dashboard','sales','products','customers','more'];

var Router = {
  current: 'dashboard',

  go(page) {
    if (!PAGES.includes(page)) page = 'dashboard';
    this.current = page;
    // Hide all pages
    PAGES.forEach(p => {
      const el = Utils.get('pg-' + p);
      if (el) el.classList.remove('active');
    });
    // Show target
    const target = Utils.get('pg-' + page);
    if (target) target.classList.add('active');
    // Update bottom nav
    BN_PAGES.forEach(p => {
      const btn = Utils.get('bn-' + p);
      if (btn) btn.classList.toggle('active', p === page || (p==='more' && !BN_PAGES.includes(page)));
    });
    // Close sidebar
    UI.closeSidebar();
    // Scroll to top
    const pc = Utils.get('pages-container');
    if (pc) pc.scrollTop = 0;
    // Render page
    const renders = {
      dashboard: () => Dashboard.render(),
      products:  () => Products.render(),
      sales:     () => Sales.render(),
      customers: () => Customers.render(),
      suppliers:  () => Suppliers.render(),
      supply:     () => Supply.render(),
      quotations: () => Quotations.render(),
      expenses:  () => Expenses.render(),
      salary:    () => Salary.render(),
      finance:   () => Finance.render(),
      reports:   () => Reports.render(),
      ai:        () => AI.render(),
      settings:  () => Settings.render(),
      more:      () => MorePage.render(),
    };
    try {
      if (renders[page]) renders[page]();
    } catch(e) {
      const el = Utils.get('pg-' + page);
      if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Error loading page</div><div class="empty-sub">${e.message}</div></div>`;
    }
  },
};

/* === notifications.js === */
var Notifs = {
  check() {
    const list = [];
    const stats = DB.stats();
    stats.lowStock.forEach(p => list.push({ type:'warn', title:`Low stock: ${p.name}`, body:`Only ${p.qty} left`, time: Utils.today() }));
    stats.outStock.forEach(p => list.push({ type:'err', title:`Out of stock: ${p.name}`, body:'Reorder needed', time: Utils.today() }));
    // Salary due
    const emps = DB.getEmployees();
    const paid = DB.getPayroll().filter(p=>p.month===Utils.today().slice(0,7)).map(p=>p.employeeId);
    const unpaid = emps.filter(e=>!paid.includes(e.id)&&e.status==='active');
    if (unpaid.length > 0) list.push({ type:'info', title:`${unpaid.length} salary payment(s) due`, body:'This month', time:Utils.today() });
    const badge = Utils.get('notif-badge');
    if (badge) {
      if (list.length > 0) { badge.classList.remove('hidden'); badge.textContent = list.length > 9 ? '9+' : list.length; }
      else badge.classList.add('hidden');
    }
    Utils.set('notif-list', list.length > 0 ? list.map(n => `
      <div class="notif-item">
        <div class="notif-item-title">${Utils.esc(n.title)}</div>
        <div style="font-size:12px;color:var(--text2)">${Utils.esc(n.body||'')}</div>
        <div class="notif-item-time">${n.time}</div>
      </div>`).join('') : '<div class="notif-empty">All caught up! 🎉</div>');
    return list;
  },
};

/* === charts.js === */
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

/* === app.js === */
var UI = {
  toggleNotifPanel: function() {
    var p = Utils.get('notif-panel');
    if (!p) return;
    if (p.classList.contains('hidden')) { Notifs.check(); p.classList.remove('hidden'); }
    else p.classList.add('hidden');
  },
  applyTheme: function(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
    var mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.content = theme === 'light' ? '#f2f3f8' : '#070A12';
  },
  closeSidebar: function() {},
};

var App = {
  _hide: function(id) {
    var el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.classList.add('hidden'); }
  },
  _show: function(id, disp) {
    var el = document.getElementById(id);
    if (el) { el.style.display = disp || 'block'; el.classList.remove('hidden'); }
  },

  showLogin: function() {
    App._hide('loader');
    App._hide('app-shell');
    App._show('login-screen', 'flex');
    try { UI.applyTheme(DB.getSettings().theme || 'dark'); } catch(e) {}
  },

  showShell: function() {
    App._hide('loader');
    App._hide('login-screen');
    App._show('app-shell', 'flex');
    try {
      var user = Auth.currentUser || {};
      var s    = DB.getSettings();
      UI.applyTheme(s.theme || 'dark');
      var bn = document.getElementById('tb-biz-name');
      if (bn) bn.textContent = s.bizName || 'SmartStock Pro';
      var bs = document.getElementById('tb-biz-sub');
      if (bs) bs.textContent = s.bizPhone || s.bizAddress || 'Business Manager';
      var av = document.getElementById('tb-avatar');
      if (av && user.name) av.textContent = user.name[0].toUpperCase();
      if (s.bizLogo && typeof Settings !== 'undefined') Settings._applyBizLogo(s.bizLogo);
      if (user.photo && typeof Settings !== 'undefined') Settings._applyUserPhoto(user.photo, user);
      try { Notifs.check(); } catch(e2) {}
      Router.go('dashboard');
    } catch(e) { console.error('showShell:', e); Router.go('dashboard'); }
  },

  boot: function() {
    try { DB.load(); } catch(e) { console.error('DB:', e); }
    var loggedIn = false;
    try {
      var sess = Utils.storage.get('ssp_session');
      if (sess && sess.uid) {
        var users = DB.get('users') || [];
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === sess.uid && users[i].status !== 'pending') {
            Auth.currentUser = users[i]; loggedIn = true; break;
          }
        }
      }
    } catch(e) { console.error('session:', e); }
    if (loggedIn) App.showShell();
    else App.showLogin();
  },
};

/* === dashboard.js === */
var Dashboard = {

  render: function() {
    var pg = Utils.get('pg-dashboard');
    if (!pg) return;

    var s         = DB.stats();
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';
    var user      = Auth.currentUser || {};
    var role      = (user.role || 'owner').toLowerCase();
    var sales     = DB.getSales();
    var products  = DB.getProducts().filter(function(p){ return p.status !== 'inactive'; });
    var suppliers = DB.getSuppliers();
    var today     = Utils.today();
    var month     = today.slice(0, 7);
    var now       = new Date();
    var hour      = now.getHours();
    var dow       = now.getDay(); // 0=Sun

    // ── Role visibility ───────────────────────────────────────────────────
    var canSeeMoney = (role==='owner'||role==='admin'||role==='primary admin'||role==='manager');
    var mask = '— — —';
    function showMoney(val) { return canSeeMoney ? Utils.cur(val, cur) : mask; }

    // ── Read toggles from settings ────────────────────────────────────────
    // allocEnabled: default ON  (false only when explicitly set false)
    // cogsEnabled:  default ON
    var allocEnabled = settings.allocEnabled !== false;
    var cogsEnabled  = settings.cogsEnabled  !== false;

    // ── TODAY calculations ─────────────────────────────────────────────────
    var allExpenses  = DB.getExpenses();
    var allPayroll   = DB.getPayroll();

    var todaySales   = sales.filter(function(s){ return s.date === today; });
    var todayRev     = todaySales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var todayManExp  = allExpenses.filter(function(e){ return e.date===today; })
                        .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // COGS today — only if cogsEnabled
    var rawTodayCOGS = todaySales.reduce(function(a,s){
      return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0);
    }, 0);
    var todayCOGS = cogsEnabled ? rawTodayCOGS : 0;

    // Allocated today — Mon–Sat only, only if allocEnabled
    var rawAllocDay = s.allocatedDaily || 0;
    var todayAlloc  = (allocEnabled && dow !== 0) ? rawAllocDay : 0;

    // Gross Profit today = Sales − COGS
    var todayGross = todayRev - todayCOGS;
    // Net Profit today = Gross − ManExp − Alloc
    var todayNet   = todayGross - todayManExp - todayAlloc;

    // ── THIS MONTH calculations ────────────────────────────────────────────
    var monthSales   = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
    var monthRev     = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var rawMonthCOGS = monthSales.reduce(function(a,s){
      return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0);
    }, 0);
    var monthCOGS    = cogsEnabled ? rawMonthCOGS : 0;
    var monthManExp  = allExpenses.filter(function(e){ return e.date && e.date.startsWith(month); })
                        .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // Working days Mon–Sat so far this month
    var workDays = 0;
    var d = new Date(now.getFullYear(), now.getMonth(), 1);
    while (d <= now) { if (d.getDay() !== 0) workDays++; d.setDate(d.getDate()+1); }
    var monthAlloc = (allocEnabled) ? rawAllocDay * workDays : 0;

    var monthGross = monthRev - monthCOGS;
    var monthNet   = monthGross - monthManExp - monthAlloc;
    var monthGrossMargin = monthRev > 0 ? ((monthGross/monthRev)*100).toFixed(1) : '0.0';
    var monthNetMargin   = monthRev > 0 ? ((monthNet/monthRev)*100).toFixed(1)   : '0.0';
    var todayGrossMargin = todayRev  > 0 ? ((todayGross/todayRev)*100).toFixed(1) : '0.0';
    var todayNetMargin   = todayRev  > 0 ? ((todayNet/todayRev)*100).toFixed(1)   : '0.0';

    // ── Yesterday comparison ──────────────────────────────────────────────
    var yest      = new Date(now); yest.setDate(yest.getDate()-1);
    var yestStr   = yest.toISOString().slice(0,10);
    var yestDow   = yest.getDay();
    var yestSales = sales.filter(function(s){ return s.date===yestStr; });
    var yestRev   = yestSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
    var yestCOGS  = cogsEnabled ? yestSales.reduce(function(a,s){
      return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0);
    }, 0) : 0;
    var yestManExp = allExpenses.filter(function(e){ return e.date===yestStr; })
                      .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
    var yestAlloc  = (allocEnabled && yestDow !== 0) ? rawAllocDay : 0;
    var yestNet    = (yestRev-yestCOGS) - yestManExp - yestAlloc;
    var netDiff    = todayNet - yestNet;

    var compHtml = '';
    if (canSeeMoney) {
      if      (Math.abs(netDiff) < 0.01) compHtml = '<span style="color:var(--t3);font-size:12px;font-weight:600">→ Same as yesterday</span>';
      else if (netDiff > 0)              compHtml = '<span style="color:var(--ok);font-size:12px;font-weight:700">↑ '+Utils.cur(netDiff,cur)+' more than yesterday</span>';
      else                               compHtml = '<span style="color:var(--er);font-size:12px;font-weight:700">↓ '+Utils.cur(Math.abs(netDiff),cur)+' less than yesterday</span>';
    }

    // ── Outstanding debt ──────────────────────────────────────────────────
    var debtSales = sales.filter(function(s){ return s.status!=='Paid'; });
    var totalDebt = debtSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    // ── Low stock ─────────────────────────────────────────────────────────
    var lowStockCount = s.lowStock.length + s.outStock.length;
    var lowPulse = lowStockCount > 0
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--er);margin-left:6px;animation:pulse 1.5s ease-in-out infinite"></span>'
      : '';

    // ════════════════════════════════════════════════════════════════════
    // AREA 1 — GREETING
    // ════════════════════════════════════════════════════════════════════
    var greet       = hour<12?'Good Morning':hour<17?'Good Afternoon':'Good Evening';
    var displayName = user.name ? user.name.split(' ')[0] : (user.username||'Ramie');
    var fullDate    = now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

    var greetHtml = '<div style="background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(201,168,76,.02));border:1px solid rgba(201,168,76,.15);border-radius:var(--r16);padding:18px 16px;margin:0 14px 14px">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'
      + '<div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);letter-spacing:-.02em">'+greet+', '+Utils.esc(displayName)+' 👋</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:4px">'+fullDate+'</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px">SmartStock Store · Monrovia, Liberia</div>'
      + '</div>'
      + '<div style="font-size:32px;flex-shrink:0">'+(hour<12?'🌅':hour<17?'☀️':'🌙')+'</div>'
      + '</div></div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 2 — HERO: TODAY'S NET PROFIT
    // ════════════════════════════════════════════════════════════════════
    var heroColor = todayNet>=0?'var(--ok)':'var(--er)';
    var heroBg    = todayNet>=0?'rgba(16,185,129,.06)':'rgba(239,68,68,.06)';
    var heroBd    = todayNet>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)';

    var heroHtml = '<div style="background:'+heroBg+';border:1px solid '+heroBd+';border-radius:var(--r16);padding:18px 16px;margin:0 14px 10px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.14em;margin-bottom:10px;font-family:var(--fm)">Today\'s Net Profit</div>'
      + '<div style="font-size:36px;font-weight:900;color:'+heroColor+';letter-spacing:-.03em;line-height:1;margin-bottom:10px">'+(canSeeMoney?Utils.cur(todayNet,cur):mask)+'</div>'
      + (compHtml?'<div style="margin-bottom:8px">'+compHtml+'</div>':'')
      + '</div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 3 — 4 STAT CARDS  (with toggles on COGS and Allocated)
    // ════════════════════════════════════════════════════════════════════

    // Helper: small inline toggle switch
    function miniToggle(fnName, isOn) {
      var bg  = isOn ? 'var(--ok)' : 'var(--bd2)';
      var lft = isOn ? '14px'      : '2px';
      return '<div onclick="Dashboard.'+fnName+'()" style="display:flex;align-items:center;cursor:pointer;padding:2px">'
        + '<div style="width:28px;height:16px;border-radius:8px;background:'+bg+';position:relative;transition:background .2s;flex-shrink:0">'
        + '<div style="width:12px;height:12px;border-radius:50%;background:#fff;position:absolute;top:2px;left:'+lft+';transition:left .2s;box-shadow:0 1px 2px rgba(0,0,0,.3)"></div>'
        + '</div></div>';
    }

    var todayNetC  = todayNet>=0?'var(--ok)':'var(--er)';
    var todayNetBg = todayNet>=0?'var(--okb)':'var(--erb)';

    var statCards = '<div class="kpi-grid" style="grid-template-columns:1fr 1fr;gap:10px;padding:0 14px;margin-bottom:10px">'

      // Card 1 — Today Sales (gold)
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">'
      + '<div class="kpi-icon">💰</div>'
      + '<div class="kpi-label">Today Sales</div>'
      + '<div class="kpi-value">'+showMoney(todayRev)+'</div>'
      + '<div class="kpi-sub">'+todaySales.length+' transaction'+(todaySales.length!==1?'s':'')+'</div></div>'

      // Card 2 — Today Manual Expenses (red)
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)">'
      + '<div class="kpi-icon">💸</div>'
      + '<div class="kpi-label">Today Expenses</div>'
      + '<div class="kpi-value">'+showMoney(todayManExp)+'</div>'
      + '<div class="kpi-sub">Manual expenses</div></div>'

      // Card 3 — COGS with toggle (amber)
      + '<div class="kpi" style="--kc:var(--wa);--kibg:'+(cogsEnabled?'var(--wab)':'var(--bg3)')+';opacity:'+(cogsEnabled?'1':'.65')+'">'
      + '<div class="kpi-icon">🏷️</div>'
      + '<div class="kpi-label" style="display:flex;align-items:center;justify-content:space-between">'
      + 'COGS'
      + miniToggle('toggleCOGS', cogsEnabled)
      + '</div>'
      + '<div class="kpi-value" style="color:'+(cogsEnabled?'var(--wa)':'var(--t3)')+'">'+showMoney(todayCOGS)+'</div>'
      + '<div class="kpi-sub">'+(cogsEnabled?'Cost of goods · ON':'Paused · OFF')+'</div></div>'

      // Card 4 — Allocated with toggle (amber/grey)
      + '<div class="kpi" style="--kc:var(--wa);--kibg:'+(allocEnabled?'var(--wab)':'var(--bg3)')+';opacity:'+(allocEnabled?'1':'.65')+'">'
      + '<div class="kpi-icon">📅</div>'
      + '<div class="kpi-label" style="display:flex;align-items:center;justify-content:space-between">'
      + 'Allocated'
      + miniToggle('toggleAlloc', allocEnabled)
      + '</div>'
      + '<div class="kpi-value" style="color:'+(allocEnabled?'var(--wa)':'var(--t3)')+'">'+showMoney(todayAlloc)+'</div>'
      + '<div class="kpi-sub">'+(allocEnabled?(dow===0?'Sunday — $0':'$'+rawAllocDay.toFixed(2)+'/day · ON'):'Paused · OFF')+'</div></div>'

      + '</div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 4 — DETAIL BREAKDOWN CARD (always visible)
    // ════════════════════════════════════════════════════════════════════

    // Row builder helpers
    function dRow(label, todayVal, monthVal, tc, mc, subLabel) {
      return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:'+(subLabel?'flex-start':'center')+';padding:8px 0;border-bottom:1px solid var(--bd)">'
        + '<div><div style="font-size:12px;color:var(--t2)">'+label+'</div>'+(subLabel?'<div style="font-size:10px;color:var(--t3);margin-top:2px">'+subLabel+'</div>':'')+'</div>'
        + '<span style="font-size:13px;font-weight:700;color:'+tc+';font-family:var(--fm);text-align:right;white-space:nowrap">'+todayVal+'</span>'
        + '<span style="font-size:13px;font-weight:700;color:'+mc+';font-family:var(--fm);text-align:right;white-space:nowrap;min-width:82px">'+monthVal+'</span>'
        + '</div>';
    }
    function dBigRow(label, todayVal, monthVal, tc, mc) {
      return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;padding:10px 0;border-top:2px solid var(--bd2);margin-top:3px">'
        + '<span style="font-size:13px;font-weight:800;color:var(--t1)">'+label+'</span>'
        + '<span style="font-size:16px;font-weight:900;color:'+tc+';font-family:var(--fm);text-align:right;white-space:nowrap">'+todayVal+'</span>'
        + '<span style="font-size:16px;font-weight:900;color:'+mc+';font-family:var(--fm);text-align:right;white-space:nowrap;min-width:82px">'+monthVal+'</span>'
        + '</div>';
    }

    var allocSubLabel = !allocEnabled
      ? 'Toggle is OFF — not counted'
      : (dow===0
          ? 'Sunday — not charged today'
          : 'Mon–Sat · '+Utils.cur(rawAllocDay,cur)+'/day ×'+workDays+' days');

    var cogsSubLabel = !cogsEnabled ? 'Toggle is OFF — not counted' : '';

    var tGrossC  = todayGross>=0?'var(--ok)':'var(--er)';
    var mGrossC  = monthGross>=0?'var(--ok)':'var(--er)';
    var tNetC    = todayNet>=0?'var(--ok)':'var(--er)';
    var mNetC    = monthNet>=0?'var(--ok)':'var(--er)';

    var detailHtml = canSeeMoney ? ''
      + '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r14);padding:14px 14px 10px;margin:0 14px 14px">'

      // Header: title + column labels
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--bd)">'
      + '<div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em">Breakdown</div>'
      + '<div style="display:flex;gap:0">'
      + '<div style="font-size:9px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.08em;text-align:right;min-width:72px">TODAY</div>'
      + '<div style="font-size:9px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.08em;text-align:right;min-width:82px">THIS MONTH</div>'
      + '</div>'
      + '</div>'

      // Gross Sales row
      + dRow('Gross Sales', showMoney(todayRev), showMoney(monthRev), 'var(--g)', 'var(--g)')

      // COGS row — dims when OFF
      + dRow(
          'Cost of Goods (COGS)',
          cogsEnabled ? showMoney(todayCOGS) : '<span style="color:var(--t3);font-style:italic">OFF</span>',
          cogsEnabled ? showMoney(monthCOGS) : '<span style="color:var(--t3);font-style:italic">OFF</span>',
          'var(--wa)', 'var(--wa)',
          cogsSubLabel
        )

      // Gross Profit bold row
      + dBigRow('GROSS PROFIT', showMoney(todayGross), showMoney(monthGross), tGrossC, mGrossC)

      // Manual Expenses
      + dRow('Manual Expenses', showMoney(todayManExp), showMoney(monthManExp), 'var(--er)', 'var(--er)')

      // Allocated Expenses — dims when OFF
      + dRow(
          'Allocated Expenses',
          allocEnabled ? showMoney(todayAlloc) : '<span style="color:var(--t3);font-style:italic">OFF</span>',
          allocEnabled ? showMoney(monthAlloc) : '<span style="color:var(--t3);font-style:italic">OFF</span>',
          'var(--wa)', 'var(--wa)',
          allocSubLabel
        )

      // NET PROFIT bold row
      + dBigRow('NET PROFIT', showMoney(todayNet), showMoney(monthNet), tNetC, mNetC)

      // Margin row
      + '<div style="display:flex;justify-content:flex-end;gap:18px;margin-top:8px;padding-top:6px;border-top:1px solid var(--bd)">'
      + '<div style="text-align:right">'
      + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Today Margin</div>'
      + '<div style="font-size:12px;font-weight:800;color:'+tNetC+'">'+todayNetMargin+'%</div>'
      + '</div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Month Margin</div>'
      + '<div style="font-size:12px;font-weight:800;color:'+mNetC+'">'+monthNetMargin+'%</div>'
      + '</div>'
      + '</div>'

      + '</div>' : '';

    // ════════════════════════════════════════════════════════════════════
    // AREA 5 — RECENT SALES
    // ════════════════════════════════════════════════════════════════════
    function timeAgo(dateStr) {
      if (!dateStr) return '';
      var diff = Math.floor((now - new Date(dateStr)) / 60000);
      if (diff < 1)   return 'Just now';
      if (diff < 60)  return diff+' min ago';
      var h = Math.floor(diff/60);
      if (h < 24)     return h+' hr ago';
      if (h < 48)     return 'Yesterday';
      return Math.floor(h/24)+' days ago';
    }

    var recentRows = sales.slice(0,10).map(function(sale) {
      var items = (sale.items||[]).map(function(i){ return i.name; }).join(', ');
      if (items.length>40) items=items.slice(0,38)+'…';
      var bc = sale.status==='Paid'?'var(--ok)':sale.status==='Partial'?'var(--wa)':'var(--er)';
      return '<div class="list-item" onclick="Sales.viewInvoice(\''+sale.id+'\')">'
        + '<div class="list-icon" style="background:var(--gb3);font-size:18px">🧾</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(sale.customer||'Walk-in')+'</div>'
        + '<div class="list-meta" style="font-family:var(--fm)">'+sale.id+'</div>'
        + (items?'<div class="list-meta" style="font-size:10px;color:var(--t3)">'+Utils.esc(items)+'</div>':'')
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val" style="font-size:14px">'+showMoney(sale.total)+'</div>'
        + '<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+bc+'18;border:1px solid '+bc+'40;color:'+bc+'">'+(sale.status||'PAID').toUpperCase()+'</span>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'+timeAgo(sale.date)+'</div>'
        + '</div></div>';
    }).join('');

    var recentHtml = '<div class="sec">'
      + '<div class="sec-title">Recent Sales <span class="sec-link" onclick="Router.go(\'sales\')">View All →</span></div>'
      + (sales.length>0 ? '<div class="card">'+recentRows+'</div>'
        : '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No sales yet</div><div class="empty-sub">Tap "+ New Sale" to get started</div></div>')
      + '</div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 6 — LOW STOCK ALERTS
    // ════════════════════════════════════════════════════════════════════
    var alertsHtml = '';
    var allAlerts = s.outStock.concat(s.lowStock);
    if (allAlerts.length > 0) {
      var alertRows = allAlerts.slice(0,6).map(function(p) {
        var isOut  = p.qty===0, isCrit = p.qty<=1;
        var label  = isOut?'OUT':isCrit?'CRITICAL':'LOW';
        var lc = isOut||isCrit?'var(--er)':'var(--wa)';
        var lb = isOut||isCrit?'var(--erb)':'var(--wab)';
        var pct = Math.min(100,Math.max(2,Math.round((p.qty/Math.max(p.lowLevel||5,1))*100)));
        return '<div class="list-item" onclick="Router.go(\'products\')">'
          + '<div class="list-icon" style="background:'+lb+'">'+(isOut?'🚫':isCrit?'🔴':'⚠️')+'</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(p.name)+'</div>'
          + '<div class="list-meta">Qty: <strong>'+p.qty+'</strong> · Min: '+(p.lowLevel||5)+'</div>'
          + '<div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:'+pct+'%;background:'+lc+'"></div></div></div>'
          + '</div>'
          + '<div class="list-right"><span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+lb+';border:1px solid '+lc+'40;color:'+lc+'">'+label+'</span></div>'
          + '</div>';
      }).join('');
      alertsHtml = '<div class="sec">'
        + '<div class="sec-title">⚠️ Low Stock Alert '
        + '<span style="background:var(--er);color:#fff;font-size:9px;font-weight:800;padding:1px 7px;border-radius:99px;margin-left:4px">'+allAlerts.length+'</span>'
        + '<span class="sec-link" onclick="Router.go(\'products\')">View All</span></div>'
        + '<div class="card">'+alertRows+'</div>'
        + '<div style="padding:10px 14px 0"><button class="btn-ghost" style="width:100%;font-size:12px" onclick="Router.go(\'products\')">📋 View All Stock</button></div>'
        + '</div>';
    }

    // ════════════════════════════════════════════════════════════════════
    // AREA 7 — TOP PRODUCTS TODAY
    // ════════════════════════════════════════════════════════════════════
    var prodMap = {};
    todaySales.forEach(function(sale) {
      (sale.items||[]).forEach(function(item) {
        if (!prodMap[item.name]) prodMap[item.name]={qty:0,rev:0};
        prodMap[item.name].qty += parseInt(item.qty)||1;
        prodMap[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var topProds = Object.keys(prodMap).map(function(n){ return {name:n,qty:prodMap[n].qty,rev:prodMap[n].rev}; })
      .sort(function(a,b){ return b.qty-a.qty; }).slice(0,5);

    var topProdsHtml = '<div class="sec"><div class="sec-title">🏆 Top Products Today</div>'
      + (topProds.length>0 ? '<div class="card card-body">'
          + topProds.map(function(p,i) {
              var medals=['🥇','🥈','🥉','4️⃣','5️⃣'];
              return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bd)">'
                + '<span style="font-size:16px;flex-shrink:0">'+(medals[i]||'·')+'</span>'
                + '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+Utils.esc(p.name)+'</div>'
                + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+p.qty+' units sold</div></div>'
                + '<div style="text-align:right;flex-shrink:0"><div style="font-size:13px;font-weight:700;color:var(--g)">'+showMoney(p.rev)+'</div></div>'
                + '</div>';
            }).join('')+'</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon" style="font-size:28px">📦</div><div class="empty-title" style="font-size:13px">No sales today yet</div></div>')
      + '</div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 8 — SUPPLIER PAYMENTS
    // ════════════════════════════════════════════════════════════════════
    var suppHtml = '';
    if (canSeeMoney) {
      var suppDebt = suppliers.filter(function(sup){ return (parseFloat(sup.balance)||0)>0; });
      var sevenStr = new Date(now.getTime()+7*86400000).toISOString().slice(0,10);
      if (suppDebt.length>0) {
        var suppRows = suppDebt.slice(0,5).map(function(sup) {
          var bal=parseFloat(sup.balance)||0, due=sup.dueDate||'';
          var st,sc,sb;
          if (due&&due<today)         {st='OVERDUE'; sc='var(--er)';sb='var(--erb)';}
          else if (due&&due<=sevenStr){st='DUE SOON';sc='var(--wa)';sb='var(--wab)';}
          else                        {st='PENDING'; sc='var(--in)';sb='var(--inb)';}
          return '<div class="list-item">'
            +'<div class="list-icon" style="background:var(--wab)">🏭</div>'
            +'<div class="list-info"><div class="list-name">'+Utils.esc(sup.name)+'</div>'
            +'<div class="list-meta">'+(due?'Due: '+Utils.date(due):'No due date')+'</div></div>'
            +'<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(bal,cur)+'</div>'
            +'<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+sb+';border:1px solid '+sc+'40;color:'+sc+'">'+st+'</span>'
            +'</div></div>';
        }).join('');
        suppHtml = '<div class="sec"><div class="sec-title">🏭 Supplier Payments Due <span class="sec-link" onclick="Router.go(\'suppliers\')">View All →</span></div>'
          + '<div class="card">'+suppRows+'</div></div>';
      } else {
        suppHtml = '<div class="sec"><div class="sec-title">🏭 Supplier Payments</div>'
          + '<div style="padding:12px 14px;background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r10);text-align:center;font-size:13px;font-weight:600;color:var(--ok)">✓ All suppliers paid</div></div>';
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // AREA 9 — QUICK ACTIONS
    // ════════════════════════════════════════════════════════════════════
    var qaHtml = '<div class="sec"><div class="sec-title">Quick Actions</div>'
      + '<div class="qa-grid" style="grid-template-columns:repeat(3,1fr)">'
      + '<div class="qa-btn" onclick="Sales.openNewSale()"><div class="qa-icon" style="background:var(--okb)">💵</div><div class="qa-label">New Sale</div></div>'
      + '<div class="qa-btn" onclick="Products.openAddModal()"><div class="qa-icon" style="background:var(--gb)">📦</div><div class="qa-label">Add Stock</div></div>'
      + '<div class="qa-btn" onclick="Expenses.openAddModal()"><div class="qa-icon" style="background:var(--erb)">💸</div><div class="qa-label">Add Expense</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'suppliers\')"><div class="qa-icon" style="background:var(--wab)">🚛</div><div class="qa-label">Suppliers</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'reports\')"><div class="qa-icon" style="background:var(--inb)">📊</div><div class="qa-label">Reports</div></div>'
      + '<div class="qa-btn" onclick="Router.go(\'ai\')"><div class="qa-icon" style="background:var(--gb)">🤖</div><div class="qa-label">AI Assistant</div></div>'
      + '</div></div>';

    // ════════════════════════════════════════════════════════════════════
    // AREA 10 — DAILY SUMMARY STRIP
    // ════════════════════════════════════════════════════════════════════
    var stripHtml = '<div style="margin:0 14px 14px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r12);padding:13px 14px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px;font-family:var(--fm)">Daily Summary</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
      + '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:3px">Gross Sales</div><div style="font-size:13px;font-weight:800;color:var(--g)">'+showMoney(todayRev)+'</div></div>'
      + '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:3px">Expenses</div><div style="font-size:13px;font-weight:800;color:var(--er)">'+showMoney(todayManExp+todayAlloc)+'</div></div>'
      + '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:3px">Net Profit</div><div style="font-size:13px;font-weight:800;color:'+(todayNet>=0?'var(--g)':'var(--er)')+'">'+showMoney(todayNet)+'</div></div>'
      + '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:3px">Transactions</div><div style="font-size:13px;font-weight:800;color:var(--in)">'+todaySales.length+'</div></div>'
      + '</div>'
      + (canSeeMoney?'<button class="btn-ghost" style="width:100%;font-size:12px" onclick="Dashboard.printDailyReport()">🖨 Print Daily Report</button>':'')
      + '</div>';

    // ── ASSEMBLE ──────────────────────────────────────────────────────────
    pg.innerHTML = '<div style="padding-top:6px">'
      + greetHtml
      + heroHtml
      + statCards
      + detailHtml
      + recentHtml
      + alertsHtml
      + topProdsHtml
      + suppHtml
      + qaHtml
      + weekChart()
      + stripHtml
      + '</div>';

    Dashboard.animateCountUp();
  },

  // ── TOGGLE: Allocated Expenses ON / OFF ───────────────────────────────────
  toggleAlloc: function() {
    var on = DB.getSettings().allocEnabled !== false;
    DB.saveSettings({ allocEnabled: !on });
    Toast.show(!on ? '📅 Allocated expenses ON' : '📅 Allocated expenses OFF', !on ? 'ok' : 'warn');
    Dashboard.render();
  },

  // ── TOGGLE: Cost of Goods (COGS) ON / OFF ────────────────────────────────
  toggleCOGS: function() {
    var on = DB.getSettings().cogsEnabled !== false;
    DB.saveSettings({ cogsEnabled: !on });
    Toast.show(!on ? '🏷️ COGS ON — deducted from profit' : '🏷️ COGS OFF — not counted', !on ? 'ok' : 'warn');
    Dashboard.render();
  },

  // ── COUNT-UP ANIMATION ────────────────────────────────────────────────────
  animateCountUp: function() {
    var els = document.querySelectorAll('.kpi-value');
    els.forEach(function(el) {
      var text = el.textContent.trim();
      var match = text.match(/[\d,\.]+/);
      if (!match) return;
      var target = parseFloat(match[0].replace(/,/g,''));
      if (isNaN(target)||target===0) return;
      var prefix = text.slice(0,text.indexOf(match[0]));
      var suffix = text.slice(text.indexOf(match[0])+match[0].length);
      var st = null;
      function step(ts) {
        if (!st) st=ts;
        var p = Math.min((ts-st)/900,1);
        var e = 1-Math.pow(1-p,3);
        var v = target*e;
        var f = target>=1000 ? v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}) : (target%1!==0?v.toFixed(2):Math.round(v).toString());
        el.textContent = prefix+f+suffix;
        if (p<1) requestAnimationFrame(step); else el.textContent=text;
      }
      requestAnimationFrame(step);
    });
  },

  // ── PRINT DAILY REPORT ────────────────────────────────────────────────────
  printDailyReport: function() {
    Reports.dailyDate = Utils.today();
    Reports.view = 'daily';
    Router.go('reports');
  },
};

// Week chart helper
function weekChart() {
  var sales = DB.getSales();
  var cur   = DB.getSettings().currency || '$';
  return '<div class="sec"><div class="chart-wrap">'
    + '<div class="chart-title">This Week\'s Revenue</div>'
    + '<div class="chart-sub">'+cur+' daily breakdown</div>'
    + Charts.weekBars(sales)
    + '</div></div>';
}


/* === products.js === */
var Products = {
  filter: 'All', search: '', editId: null,

  render() {
    const pg = Utils.get('pg-products');
    if (!pg) return;
    const prods = DB.getProducts();
    const active = prods.filter(p=>p.status!=='inactive');
    const low = active.filter(p=>p.qty<=(p.lowLevel||5)&&p.qty>0).length;
    const out = active.filter(p=>p.qty===0).length;
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Products</div>
          <div class="page-sub">${active.length} products · ${low} low · ${out} out</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Products.openAddModal()">+ Add</button>
        </div>
      </div>
      <div class="search-bar">
        <span>🔍</span>
        <input placeholder="Search by name, SKU, category..." oninput="Products.setSearch(this.value)" value="${Utils.esc(this.search)}">
      </div>
      <div class="chips">
        ${['All','In Stock','Low Stock','Out of Stock'].map(f=>`<div class="chip${this.filter===f?' active':''}" onclick="Products.setFilter('${f}')">${f}</div>`).join('')}
      </div>
      <div id="prod-list" class="sec"></div>`;
    this._renderList();
  },

  setFilter(f) { this.filter=f; this.render(); },
  setSearch(v) { this.search=v; this._renderList(); },

  _renderList() {
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    const all = DB.getProducts().filter(p => {
      if (p.status==='inactive') return false;
      const fs = this.filter;
      if (fs!=='All') {
        if (fs==='In Stock'&&(p.qty===0||p.qty<=(p.lowLevel||5))) return false;
        if (fs==='Low Stock'&&!(p.qty<=(p.lowLevel||5)&&p.qty>0)) return false;
        if (fs==='Out of Stock'&&p.qty!==0) return false;
      }
      if (this.search) {
        const q = this.search.toLowerCase();
        return (p.name||'').toLowerCase().includes(q)||(p.sku||'').toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q);
      }
      return true;
    });
    const el = Utils.get('prod-list');
    if (!el) return;
    if (!all.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div class="empty-title">No products found</div><div class="empty-sub">Try a different filter or add a product</div></div>';
      return;
    }
    el.innerHTML = `<div class="card">${all.map(p=>{
      const st = p.qty===0?'Out of Stock':p.qty<=(p.lowLevel||5)?'Low Stock':'In Stock';
      const margin = p.price>0 ? Math.round(((p.price-p.cost)/p.price)*100) : 0;
      return `<div class="list-item">
        <div class="list-icon" style="background:var(--goldbg);font-size:20px">${p.emoji||'📦'}</div>
        <div class="list-info">
          <div class="list-name">${Utils.esc(p.name)}</div>
          <div class="list-meta"><span class="badge badge-gold">${Utils.esc(p.category||'—')}</span> · SKU: ${Utils.esc(p.sku||'—')}</div>
          <div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:${Math.min(100,Math.max(3,Utils.pct(p.qty,(p.lowLevel||5)*4)))}%;background:${p.qty===0?'var(--err)':p.qty<=(p.lowLevel||5)?'var(--warn)':'var(--ok)'}"></div></div></div>
        </div>
        <div class="list-right">
          <div class="list-val">${Utils.cur(p.price,cur)}</div>
          <div style="font-size:10px;color:var(--ok);margin-top:2px">${margin}% margin</div>
          <div style="margin-top:3px">${Utils.statusBadge(st)}</div>
          <div class="list-actions">
            <button class="btn-ghost btn-sm btn-icon" onclick="Products.openEditModal('${p.id}')">✏️</button>
            <button class="btn-danger btn-sm btn-icon" onclick="Products.del('${p.id}','${Utils.esc(p.name)}')">🗑</button>
          </div>
        </div>
      </div>`;}).join('')}</div>`;
  },

  openAddModal() {
    this.editId = null;
    Modal.open({
      title:'Add Product', sub:'Fill in product details',
      body: this._form(),
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Products.save()">💾 Save Product</button>`,
    });
  },

  openEditModal(id) {
    this.editId = id;
    const p = DB.getProducts().find(x=>x.id===id);
    if (!p) return;
    Modal.open({
      title:'Edit Product', sub:p.name,
      body: this._form(p),
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Products.save()">💾 Update</button>`,
    });
  },

  _form(p) {
    p = p || {};
    const cats = ['Tiles','Cement','Tools','Paint','Plumbing','Electrical','Adhesives','Stone','Mosaic','Paving','Other'];
    return `
      <div class="fg"><label class="fl">Product Name *</label>
        <input class="fi" id="pf-name" value="${Utils.esc(p.name||'')}" placeholder="e.g. Ceramic Floor Tile"></div>
      <div class="form-row">
        <div class="fg"><label class="fl">SKU / Code</label>
          <input class="fi" id="pf-sku" value="${Utils.esc(p.sku||'')}" placeholder="CFT-001"></div>
        <div class="fg"><label class="fl">Category</label>
          <select class="fi" id="pf-cat">${cats.map(c=>`<option${p.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="form-row-3">
        <div class="fg"><label class="fl">Quantity *</label>
          <input class="fi" id="pf-qty" type="number" value="${p.qty||0}" min="0"></div>
        <div class="fg"><label class="fl">Cost Price</label>
          <input class="fi" id="pf-cost" type="number" step="0.01" value="${p.cost||0}" min="0"></div>
        <div class="fg"><label class="fl">Selling Price *</label>
          <input class="fi" id="pf-price" type="number" step="0.01" value="${p.price||0}" min="0"></div>
      </div>
      <div class="form-row">
        <div class="fg"><label class="fl">Low Stock Alert</label>
          <input class="fi" id="pf-low" type="number" value="${p.lowLevel||5}" min="0"></div>
        <div class="fg"><label class="fl">Unit</label>
          <select class="fi" id="pf-unit"><option>Box</option><option>Pcs</option><option>Bag</option><option>Roll</option><option>Litre</option><option>Kg</option><option>Set</option></select></div>
      </div>
      <div class="fg"><label class="fl">Description</label>
        <textarea class="fi" id="pf-desc" rows="2" placeholder="Optional...">${Utils.esc(p.desc||'')}</textarea></div>
    `;
  },

  save() {
    const name  = Utils.val('pf-name');
    const price = parseFloat(Utils.val('pf-price')||0);
    const qty   = parseInt(Utils.val('pf-qty')||0);
    if (!name) { Toast.show('Product name is required','err'); return; }
    if (!price) { Toast.show('Selling price is required','err'); return; }
    const data = {
      name, price, qty, sku:Utils.val('pf-sku'),
      category: Utils.get('pf-cat')?.value||'Other',
      cost: parseFloat(Utils.val('pf-cost')||0),
      lowLevel: parseInt(Utils.val('pf-low')||5),
      unit: Utils.get('pf-unit')?.value||'Pcs',
      desc: Utils.val('pf-desc'),
      status: 'active',
    };
    if (this.editId) { DB.updateProduct(this.editId, data); Toast.show('Product updated ✓','ok'); }
    else { DB.addProduct(data); Toast.show('Product added ✓','ok'); }
    Modal.close();
    this.render();
    Notifs.check();
  },

  del(id, name) {
    confirmDel(`Delete "${name}"?`, () => {
      DB.deleteProduct(id);
      Toast.show('Product deleted','warn');
      this.render();
    });
  },
};


/* === sales.js === */
var Sales = {
  filter: 'All',
  cart: [],
  discount: 0,

  // ── RENDER SALES LIST ──────────────────────────────────────────────────────
  render() {
    var pg = Utils.get('pg-sales');
    if (!pg) return;
    var all      = DB.getSales();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var filtered = this.filter === 'All' ? all : all.filter(function(s){ return s.status === Sales.filter; });
    var totalRev    = all.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var collected   = all.filter(function(s){ return s.status==='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var partPaid    = all.filter(function(s){ return s.status==='Partial'; }).reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); }, 0);
    var outstanding = all.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);

    var rows = filtered.map(function(s) {
      var progress = s.status==='Partial'
        ? '<div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:'+Math.min(100,Math.round(((parseFloat(s.amountPaid)||0)/(parseFloat(s.total)||1))*100))+'%;background:var(--wa)"></div></div>'
          + '<div style="font-size:10px;color:var(--wa);margin-top:3px;font-family:var(--fm)">Paid '+Utils.cur(s.amountPaid||0,cur)+' · Bal '+Utils.cur(s.balance||0,cur)+'</div></div>'
        : '';
      var payBtn = s.status!=='Paid'
        ? '<button class="btn-ok btn-sm" onclick="event.stopPropagation();Sales.openPayBalance(\''+s.id+'\')">💳 Pay</button>'
        : '';
      return '<div class="list-item" onclick="Sales.viewInvoice(\''+s.id+'\') ">'
        + '<div class="list-icon" style="background:var(--gb3);border-color:rgba(201,168,76,.15);font-size:20px">🧾</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
        + '<div class="list-meta">'+s.id+' · '+Utils.date(s.date)+'</div>'
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
      + '<div class="empty-title">No '+(this.filter!=='All'?this.filter+' ':'')+'sales yet</div>'
      + '<div class="empty-sub">Tap "+ New Sale" to get started</div>'
      + '<div class="empty-action"><button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button></div></div>';

    var chips = ['All','Paid','Partial','Credit'].map(function(f){
      var cnt = f==='All' ? all.length : all.filter(function(s){ return s.status===f; }).length;
      return '<div class="chip'+(Sales.filter===f?' active':'')+'" onclick="Sales.setFilter(\''+f+'\')">'+f+' ('+cnt+')</div>';
    }).join('');

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Sales</div><div class="page-sub">'+all.length+' invoices total</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button></div>'
      + '</div>'
      + '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">💰</div><div class="kpi-label">Total Revenue</div><div class="kpi-value">'+Utils.cur(totalRev,cur)+'</div><div class="kpi-sub">'+all.length+' invoices</div></div>'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">✅</div><div class="kpi-label">Collected</div><div class="kpi-value">'+Utils.cur(collected+partPaid,cur)+'</div><div class="kpi-sub">'+all.filter(function(s){return s.status==='Paid';}).length+' paid</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">⏳</div><div class="kpi-label">Outstanding</div><div class="kpi-value">'+Utils.cur(outstanding,cur)+'</div><div class="kpi-sub">'+all.filter(function(s){return s.status!=='Paid';}).length+' open</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📊</div><div class="kpi-label">Invoices</div><div class="kpi-value">'+all.length+'</div><div class="kpi-sub">All time</div></div>'
      + '</div></div>'
      + '<div class="chips">'+chips+'</div>'
      + '<div class="sec">'+(filtered.length ? '<div class="card">'+rows+'</div>' : emptyState)+'</div>';
  },

  setFilter: function(f) { this.filter=f; this.render(); },

  // ── NEW SALE FORM ──────────────────────────────────────────────────────────
  openNewSale: function() {
    this.cart=[]; this.discount=0;
    var custs    = DB.getCustomers();
    var prods    = DB.getProducts().filter(function(p){ return p.status!=='inactive' && p.qty>0; });
    var settings = DB.getSettings();
    var cur      = settings.currency||'$';

    var custOpts = prods.map(function(p){
      return '<option value="'+p.id+'">'+Utils.esc(p.name)+' · '+Utils.cur(p.price,cur)+' · '+p.qty+' left</option>';
    }).join('');

    Modal.open({
      title:'New Sale', sub:'Create invoice', barColor:'var(--ok)',
      body: '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">👤 Customer</div>'
          + '<div class="form-row" style="margin-bottom:8px">'
          + '<div class="fg" style="margin:0"><label class="fl">Customer Name</label>'
          + '<input class="fi" id="s-cust-name" placeholder="Type name or Walk-in..." oninput="Sales.onCustNameInput(this.value)" style="font-weight:600"></div>'
          + '<div class="fg" style="margin:0"><label class="fl">Date</label>'
          + '<input class="fi" id="s-date" type="date" value="'+Utils.today()+'"></div></div>'
          + '<input type="hidden" id="s-cust-id" value="">'
          + '<div id="s-cust-suggestions" style="display:none;border:1px solid var(--bd2);border-radius:var(--r8);background:var(--bg2);overflow:hidden;max-height:140px;overflow-y:auto"></div>'
          + '<div id="s-cust-tag" style="display:none;font-size:11px;color:var(--ok);font-weight:600;margin-top:5px;font-family:var(--fm)"></div>'
          + '</div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📦 Products</div>'
          + '<div class="fg" style="margin-bottom:10px"><label class="fl">Add Product</label>'
          + '<select class="fi" id="s-prod-sel" onchange="Sales.addToCart(this)">'+QuickCreate.productOptions()+'</select></div>'
          + '<div id="s-cart-wrap"><div style="text-align:center;padding:14px 0;color:var(--t3);font-size:13px">No items added yet</div></div>'
          + '</div>'
          + '<div id="s-totals"></div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">💳 Payment</div>'
          + '<div class="form-row" style="margin-bottom:12px">'
          + '<div class="fg" style="margin:0"><label class="fl">Discount %</label><input class="fi" id="s-disc" type="number" value="0" min="0" max="100" oninput="Sales.updateTotals()"></div>'
          + '<div class="fg" style="margin:0"><label class="fl">Payment Method</label><select class="fi" id="s-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Credit</option></select></div>'
          + '</div>'
          + '<div class="fg" style="margin:0"><label class="fl">Amount Paid Now <span style="color:var(--t3);text-transform:none;letter-spacing:0;font-weight:400">(0 = full payment on save)</span></label>'
          + '<input class="fi" id="s-amt-paid" type="number" value="0" min="0" step="0.01" oninput="Sales.updateTotals()" style="font-size:16px;font-weight:700;color:var(--ok)"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Notes (optional)</label><input class="fi" id="s-notes" placeholder="Any extra information..."></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-ghost" onclick="Sales.saveSale(\'new\')" style="color:var(--g);border-color:rgba(201,168,76,.3)">💾 Save &amp; New</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Sales.saveSale(\'close\')">🧾 Save Invoice</button>',
    });
    var nameEl=Utils.get('s-cust-name');
    if(nameEl) nameEl.value='Walk-in Customer';
    this.updateTotals();
  },

  // ── CUSTOMER AUTO-SUGGEST + INFO PANEL ────────────────────────────────────
  onCustNameInput: function(val) {
    Utils.get('s-cust-id').value='';
    Utils.get('s-cust-tag').style.display='none';
    if (!val.trim()) { Utils.get('s-cust-suggestions').style.display='none'; return; }
    var custs = DB.getCustomers().filter(function(c){ return c.name.toLowerCase().indexOf(val.toLowerCase())!==-1; }).slice(0,6);
    var box = Utils.get('s-cust-suggestions');
    if (!custs.length) { box.style.display='none'; return; }
    box.style.display='block';
    var cur = DB.getSettings().currency||'$';
    box.innerHTML = custs.map(function(c){
      var allSales = DB.getSales().filter(function(s){ return s.customerId===c.id||s.customer===c.name; });
      var openBal  = allSales.filter(function(s){ return s.status!=='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
      return '<div onclick="Sales.selectCust(\''+c.id+'\',\''+Utils.esc(c.name)+'\')" '
        + 'style="padding:10px 13px;cursor:pointer;font-size:13px;font-weight:600;color:var(--t1);border-bottom:1px solid var(--bd)" '
        + 'onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">'
        + '<span style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#07080D;flex-shrink:0">'+c.name[0].toUpperCase()+'</span>'
        + '<span style="flex:1">'+Utils.esc(c.name)+'</span>'
        + (openBal>0?'<span style="font-size:10px;color:var(--wa);font-weight:700">Owes '+Utils.cur(openBal,cur)+'</span>':'<span style="font-size:10px;color:var(--ok)">Clear</span>')
        + '</div>'
        + '<div style="font-size:10px;color:var(--t2);padding-left:36px">'
        + allSales.length+' invoices · Total spent: '+Utils.cur(c.totalSpent||0,cur)
        + (c.phone?' · '+c.phone:'')
        + '</div></div>';
    }).join('');
  },

  selectCust: function(id, name) {
    Utils.get('s-cust-name').value=name;
    Utils.get('s-cust-id').value=id;
    Utils.get('s-cust-suggestions').style.display='none';
    var tag=Utils.get('s-cust-tag');
    // Show customer info panel
    var c = DB.getCustomers().find(function(x){ return x.id===id; });
    var allSales = DB.getSales().filter(function(s){ return s.customerId===id||s.customer===name; });
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
      return '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px 13px;margin-bottom:8px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);flex:1;padding-right:8px">'+Utils.esc(item.name)+'</div>'
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
  updateTotals: function(){
    var totEl=Utils.get('s-totals');
    var cur=DB.getSettings().currency||'$';
    this.discount=parseFloat(Utils.val('s-disc')||0);
    if(!this.cart.length){ if(totEl) totEl.innerHTML=''; return; }
    var sub     = this.cart.reduce(function(a,i){ return a+(parseFloat(i.price)||0)*(parseInt(i.qty)||0); },0);
    var discAmt = sub*(this.discount/100);
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
    var discHtml = this.discount>0
      ? '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--t2)">Subtotal</span><span style="font-size:13px;font-weight:600;font-family:var(--fm)">'+Utils.cur(sub,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--er)">Discount ('+this.discount+'%)</span><span style="font-size:13px;font-weight:600;color:var(--er);font-family:var(--fm)">−'+Utils.cur(discAmt,cur)+'</span></div>' : '';
    var paidHtml = showPartial
      ? '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--ok);font-weight:600">✓ Amount Paid</span><span style="font-size:14px;font-weight:700;color:var(--ok);font-family:var(--fm)">'+Utils.cur(paidRaw,cur)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)"><span style="font-size:13px;color:var(--wa);font-weight:600">⏳ Balance Due</span><span style="font-size:14px;font-weight:700;color:var(--wa);font-family:var(--fm)">'+Utils.cur(balance,cur)+'</span></div>' : '';
    if(totEl) totEl.innerHTML = '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">🧮 Order Summary</div>'
      + discHtml
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd2)"><span style="font-size:15px;font-weight:800;color:var(--t1)">Total Amount</span><span style="font-size:18px;font-weight:900;color:var(--g);letter-spacing:-.02em;font-family:var(--fm)">'+Utils.cur(total,cur)+'</span></div>'
      + paidHtml + progressHtml
      + '<div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:var(--t3)">Invoice status</span><span style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;background:'+sc+'18;border:1px solid '+sc+'40;color:'+sc+'">'+status+'</span></div>'
      + noteHtml+'</div>';
  },

  // ── SAVE SALE ──────────────────────────────────────────────────────────────
  saveSale: function(action){
    action=action||'close';
    if(!this.cart.length){ Toast.show('Add at least one product','err'); return; }
    var custName = Utils.val('s-cust-name').trim()||'Walk-in Customer';
    var custId   = Utils.val('s-cust-id')||null;
    var method   = (Utils.get('s-method')||{value:'Cash'}).value||'Cash';
    var sub      = this.cart.reduce(function(a,i){ return a+(parseFloat(i.price)||0)*(parseInt(i.qty)||0); },0);
    var discAmt  = sub*(this.discount/100);
    var total    = sub-discAmt;
    var paidRaw  = parseFloat(Utils.val('s-amt-paid')||0);
    var paid     = Math.min(paidRaw, total);
    var balance  = Math.max(0, total-paid);
    var status   = paid>0&&balance>0?'Partial':(paid<=0&&method==='Credit')?'Credit':'Paid';

    var finalCustId = custId;
    if (!finalCustId && custName && custName.toLowerCase()!=='walk-in customer') {
      var nc = DB.findOrCreateCustomer(custName);
      if (nc) finalCustId = nc.id;
    }
    var cust = finalCustId ? DB.getCustomers().find(function(c){ return c.id===finalCustId; }) : null;

    var sale = DB.addSale({
      customer:custName, customerId:finalCustId||null,
      items:this.cart.map(function(i){ return {id:i.id,name:i.name,price:i.price,cost:i.cost,qty:i.qty}; }),
      subtotal:sub, discount:this.discount, total:total,
      amountPaid:status==='Paid'?total:paid,
      balance:status==='Paid'?0:balance,
      payment:method, status:status,
      date:Utils.val('s-date')||Utils.today(),
      notes:Utils.val('s-notes'),
    });

    if (paid>0 || status==='Paid') {
      DB.addPayment({ saleId:sale.id, customerId:finalCustId||null,
        amount:status==='Paid'?total:paid, method:method,
        note:'Initial payment', invoiceRef:sale.id });
    }
    this.cart.forEach(function(item){
      var p=DB.getProducts().find(function(x){ return x.id===item.id; });
      if(p) DB.updateProduct(item.id,{qty:Math.max(0,(p.qty||0)-(parseInt(item.qty)||0))});
    });
    if(cust) DB.updateCustomer(finalCustId,{totalSpent:(cust.totalSpent||0)+total,purchases:(cust.purchases||0)+1});

    Toast.show('Invoice '+sale.id+' saved ✓','ok');
    Notifs.check();

    if(action==='new'){
      this.cart=[]; this.discount=0;
      var n=Utils.get('s-cust-name'); if(n) n.value='Walk-in Customer';
      Utils.get('s-cust-id').value='';
      Utils.get('s-cust-tag').style.display='none';
      var d=Utils.get('s-disc'); if(d) d.value='0';
      var p2=Utils.get('s-amt-paid'); if(p2) p2.value='0';
      var nt=Utils.get('s-notes'); if(nt) nt.value='';
      this.renderCart();
      Toast.show('Ready for next sale','ok');
      this.render();
    } else {
      Modal.close();
      this.render();
      // Show print prompt after close
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
      title:'Invoice '+s.id, sub:Utils.date(s.date), barColor:barColor,
      body: '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:14px;margin-bottom:12px">'
          + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:3px">'+Utils.esc(s.customer||'Walk-in')+'</div>'
          + '<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+s.id+' · '+Utils.date(s.date)+' · '+(s.payment||'Cash')+'</div>'
          + '</div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Items</div>'
          + itemsHtml + '</div>'
          + '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px">'
          + (s.discount>0?'<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:var(--t2);font-size:13px">Discount ('+s.discount+'%)</span><span style="color:var(--er);font-family:var(--fm)">−'+Utils.cur((s.subtotal||0)*(s.discount/100),cur)+'</span></div>':'')
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
      title:'Pay Balance', sub:'Invoice '+s.id+' · '+Utils.esc(s.customer||'Walk-in'), barColor:'var(--wa)',
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
      sub:      isPayment?'Paid '+Utils.cur(amount||0,cur)+' — '+Utils.esc(s.customer||'Customer'):saleId+' · '+Utils.esc(s.customer||'Walk-in')+' · '+Utils.cur(s.total,cur),
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

  // ── PRINT RECEIPT ──────────────────────────────────────────────────────────
  printReceipt: function(id){
    var s=DB.getSales().find(function(x){ return x.id===id; }); if(!s) return;
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var bizName=settings.bizName||'SmartStock Pro';
    var now=new Date();
    var payments=DB.getPaymentsForSale(id);

    var itemRows=(s.items||[]).map(function(item){
      return '<div class="row"><span style="flex:1;padding-right:8px">'+item.name+'</span></div>'
            +'<div class="row sm"><span>'+item.qty+' x '+Utils.cur(item.price,cur)+'</span><span class="bold">'+Utils.cur(item.price*item.qty,cur)+'</span></div>';
    }).join('');

    var payHistRows=payments.length>1
      ? '<div class="line"></div><div class="bold sm" style="margin-bottom:4px">PAYMENT HISTORY</div>'
        +payments.map(function(p,i){
          return '<div class="row sm"><span>#'+(i+1)+' '+( p.paidAt?new Date(p.paidAt).toLocaleDateString():'')+'</span><span class="paid bold">'+Utils.cur(p.amount,cur)+'</span></div>';
        }).join('') : '';

    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt '+s.id+'</title>'
      +'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Courier New",monospace;font-size:13px;color:#000;background:#fff;padding:12px;max-width:360px;margin:0 auto}.center{text-align:center}.bold{font-weight:bold}.lg{font-size:16px}.sm{font-size:11px}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;padding:3px 0}.paid{color:#16a34a}.bal{color:#d97706}@media print{@page{margin:5mm}body{max-width:100%}}</style></head><body>'
      +'<div class="center bold lg">'+bizName+'</div>'
      +'<div class="center sm">Business Receipt</div>'
      +'<div class="center sm">'+now.toLocaleString()+'</div>'
      +'<div class="line"></div>'
      +'<div class="row"><span>Customer:</span><span class="bold">'+Utils.esc(s.customer||'Walk-in')+'</span></div>'
      +'<div class="row"><span>Invoice #:</span><span class="bold">'+s.id+'</span></div>'
      +'<div class="row"><span>Date:</span><span>'+Utils.date(s.date)+'</span></div>'
      +'<div class="row"><span>Payment:</span><span>'+(s.payment||'Cash')+'</span></div>'
      +'<div class="line"></div>'
      +'<div class="bold sm" style="margin-bottom:4px">ITEMS</div>'
      +itemRows
      +'<div class="line"></div>'
      +(s.discount>0?'<div class="row"><span>Discount ('+s.discount+'%)</span><span>-'+Utils.cur((s.subtotal||0)*(s.discount/100),cur)+'</span></div>':'')
      +'<div class="row bold lg"><span>TOTAL</span><span>'+Utils.cur(s.total,cur)+'</span></div>'
      +'<div class="row paid"><span>Amount Paid</span><span class="bold">'+Utils.cur(s.amountPaid||s.total,cur)+'</span></div>'
      +((s.balance||0)>0?'<div class="row bal"><span>Balance Due</span><span class="bold">'+Utils.cur(s.balance,cur)+'</span></div>':'')
      +payHistRows
      +'<div class="line"></div>'
      +'<div class="center sm bold">Status: '+(s.status||'Paid')+'</div>'
      +(s.notes?'<div class="center sm" style="margin-top:4px">'+Utils.esc(s.notes)+'</div>':'')
      +'<div class="line"></div>'
      +'<div class="center sm">Thank you for your business!</div>'
      +'<div class="center sm bold" style="margin-top:4px">'+bizName+'</div>'
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
      +'<div class="row"><span>Original Invoice:</span><span>'+saleId+'</span></div>'
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
    var old=document.getElementById(frameId); if(old) old.remove();
    var f=document.createElement('iframe');
    f.id=frameId;
    f.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
    document.body.appendChild(f);
    try {
      f.contentDocument.open();
      f.contentDocument.write(html);
      f.contentDocument.close();
      setTimeout(function(){
        try { f.contentWindow.print(); }
        catch(e){ window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank'); }
      }, 600);
    } catch(e){
      window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank');
    }
  },
};


/* === customers.js === */
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
};


/* === suppliers.js === */
var Suppliers = {
  editId: null,
  render() {
    const pg = Utils.get('pg-suppliers');
    if (!pg) return;
    const list = DB.getSuppliers();
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Suppliers</div>
          <div class="page-sub">${list.length} suppliers</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Suppliers.openAddModal()">+ Add</button>
        </div>
      </div>
      <div class="sec">
        ${list.length ? `<div class="card">${list.map(s=>`
          <div class="list-item">
            <div class="list-icon" style="background:var(--warnbg)">🏭</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(s.name)}</div>
              <div class="list-meta">${s.contact||'—'} · ${s.phone||'—'}</div>
              ${(s.balance||0)>0?`<div style="font-size:11px;color:var(--err)">Owe: ${Utils.cur(s.balance,cur)}</div>`:'<div style="font-size:11px;color:var(--ok)">Balance clear</div>'}
            </div>
            <div class="list-right">
              ${Utils.statusBadge(s.status||'Active')}
              <div class="list-actions">
                <button class="btn-ghost btn-sm btn-icon" onclick="Suppliers.openEditModal('${s.id}')">✏️</button>
                <button class="btn-danger btn-sm btn-icon" onclick="Suppliers.del('${s.id}','${Utils.esc(s.name)}')">🗑</button>
              </div>
            </div>
          </div>`).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">🏭</div><div class="empty-title">No suppliers yet</div><div class="empty-sub">Add your first supplier</div></div>'}
      </div>`;
  },
  openAddModal() {
    this.editId = null;
    Modal.open({ title:'Add Supplier', body:this._form(), barColor:'var(--warn)',
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Suppliers.save()">💾 Save</button>` });
  },
  openEditModal(id) {
    this.editId = id;
    const s = DB.getSuppliers().find(x=>x.id===id);
    if (!s) return;
    Modal.open({ title:'Edit Supplier', sub:s.name, body:this._form(s), barColor:'var(--warn)',
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Suppliers.save()">💾 Update</button>` });
  },
  _form(s) {
    s = s||{};
    return `
      <div class="form-row">
        <div class="fg"><label class="fl">Company Name *</label><input class="fi" id="sf-name" value="${Utils.esc(s.name||'')}" placeholder="Supplier Co."></div>
        <div class="fg"><label class="fl">Contact Person</label><input class="fi" id="sf-contact" value="${Utils.esc(s.contact||'')}" placeholder="John Smith"></div>
      </div>
      <div class="form-row">
        <div class="fg"><label class="fl">Phone</label><input class="fi" id="sf-phone" value="${Utils.esc(s.phone||'')}" type="tel"></div>
        <div class="fg"><label class="fl">Email</label><input class="fi" id="sf-email" value="${Utils.esc(s.email||'')}" type="email"></div>
      </div>
      <div class="form-row">
        <div class="fg"><label class="fl">Outstanding Balance</label><input class="fi" id="sf-bal" type="number" value="${s.balance||0}" min="0"></div>
        <div class="fg"><label class="fl">Status</label>
          <select class="fi" id="sf-status"><option${(s.status||'Active')==='Active'?' selected':''}>Active</option><option${s.status==='Inactive'?' selected':''}>Inactive</option></select></div>
      </div>
      <div class="fg"><label class="fl">Address</label><input class="fi" id="sf-addr" value="${Utils.esc(s.address||'')}" placeholder="Country, City"></div>`;
  },
  save() {
    const name = Utils.val('sf-name');
    if (!name) { Toast.show('Company name is required','err'); return; }
    const data = { name, contact:Utils.val('sf-contact'), phone:Utils.val('sf-phone'), email:Utils.val('sf-email'), address:Utils.val('sf-addr'), balance:parseFloat(Utils.val('sf-bal')||0), status:Utils.get('sf-status')?.value||'Active' };
    if (this.editId) { DB.updateSupplier(this.editId, data); Toast.show('Supplier updated ✓','ok'); }
    else { DB.addSupplier(data); Toast.show('Supplier added ✓','ok'); }
    Modal.close(); this.render();
  },
  del(id, name) { confirmDel(`Delete "${name}"?`, ()=>{ DB.deleteSupplier(id); Toast.show('Deleted','warn'); this.render(); }); },
};


/* === supply.js === */
var Supply = {

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER — tab switching
  // ══════════════════════════════════════════════════════════════════════════
  tab: 'overview',

  render: function() {
    var pg = Utils.get('pg-supply');
    if (!pg) return;
    var tabs = [
      ['overview', '📊 Overview'],
      ['po',       '📋 Purchase Orders'],
      ['grn',      '📦 Received (GRN)'],
      ['invoices', '🧾 Supplier Bills'],
      ['reorder',  '🔔 Reorder Alerts'],
    ];
    var chipHtml = '<div class="chips" style="padding:0 14px 0">'
      + tabs.map(function(t){
          return '<div class="chip'+(Supply.tab===t[0]?' active':'')+'" onclick="Supply.setTab(\''+t[0]+'\')">'+t[1]+'</div>';
        }).join('') + '</div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Supply</div><div class="page-sub">Procurement &amp; stock management</div></div>'
      + '<div class="page-actions">'+(Supply.tab==='po'?'<button class="btn-primary btn-sm" onclick="Supply.openNewPO()">＋ New PO</button>':Supply.tab==='grn'?'<button class="btn-primary btn-sm" onclick="Supply.openNewGRN()">＋ Receive Stock</button>':Supply.tab==='invoices'?'<button class="btn-primary btn-sm" onclick="Supply.openNewBill()">＋ Add Bill</button>':'')
      + '</div></div>'
      + chipHtml
      + '<div id="supply-body"></div>';

    Supply._renderTab();
  },

  setTab: function(t) { Supply.tab = t; Supply.render(); },

  _renderTab: function() {
    var body = Utils.get('supply-body');
    if (!body) return;
    if (Supply.tab === 'overview')  Supply._renderOverview(body);
    else if (Supply.tab === 'po')   Supply._renderPOList(body);
    else if (Supply.tab === 'grn')  Supply._renderGRNList(body);
    else if (Supply.tab === 'invoices') Supply._renderBills(body);
    else if (Supply.tab === 'reorder')  Supply._renderReorder(body);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 1 — OVERVIEW
  // ══════════════════════════════════════════════════════════════════════════
  _renderOverview: function(el) {
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';
    var suppliers = DB.getSuppliers();
    var pos       = DB.getPurchaseOrders();
    var grns      = DB.getGRNs();
    var bills     = DB.getSupplierBills();
    var products  = DB.getProducts().filter(function(p){ return p.status !== 'inactive'; });

    var totalOwed    = bills.filter(function(b){ return b.status !== 'Paid'; })
                        .reduce(function(a,b){ return a+(parseFloat(b.balance)||0); },0);
    var openPOs      = pos.filter(function(p){ return p.status !== 'Received' && p.status !== 'Cancelled'; }).length;
    var pendingGRNs  = grns.filter(function(g){ return g.status === 'Pending'; }).length;
    var overdueCount = bills.filter(function(b){ return b.status!=='Paid' && b.dueDate && b.dueDate < Utils.today(); }).length;

    // Stock value
    var stockValue = products.reduce(function(a,p){ return a+(parseFloat(p.cost)||0)*(parseInt(p.qty)||0); },0);

    // Reorder count
    var reorderNeeded = products.filter(function(p){ return p.qty <= (p.reorderPoint || p.lowLevel || 5); }).length;

    var kpis = '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)">'
      + '<div class="kpi-icon">💳</div><div class="kpi-label">Owed to Suppliers</div>'
      + '<div class="kpi-value">'+Utils.cur(totalOwed,cur)+'</div>'
      + '<div class="kpi-sub">'+(overdueCount>0?overdueCount+' overdue':'All current')+'</div></div>'

      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)">'
      + '<div class="kpi-icon">📋</div><div class="kpi-label">Open POs</div>'
      + '<div class="kpi-value">'+openPOs+'</div>'
      + '<div class="kpi-sub">Purchase orders active</div></div>'

      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">'
      + '<div class="kpi-icon">📦</div><div class="kpi-label">Stock Value</div>'
      + '<div class="kpi-value">'+Utils.cur(stockValue,cur)+'</div>'
      + '<div class="kpi-sub">At cost price</div></div>'

      + '<div class="kpi" style="--kc:'+(reorderNeeded>0?'var(--er)':'var(--ok)')+';--kibg:'+(reorderNeeded>0?'var(--erb)':'var(--okb)')+'">'
      + '<div class="kpi-icon">'+(reorderNeeded>0?'🔔':'✅')+'</div><div class="kpi-label">Reorder Needed</div>'
      + '<div class="kpi-value">'+reorderNeeded+'</div>'
      + '<div class="kpi-sub">'+(reorderNeeded>0?'Products low':'All stocked')+'</div></div>'
      + '</div></div>';

    // Recent POs
    var recentPORows = pos.slice(0,5).map(function(po) {
      var sc = {Draft:'var(--t3)',Sent:'var(--in)',Confirmed:'var(--wa)',Received:'var(--ok)',Cancelled:'var(--er)'}[po.status]||'var(--t3)';
      return '<div class="list-item" onclick="Supply.viewPO(\''+po.id+'\') ">'
        + '<div class="list-icon" style="background:var(--inb)">📋</div>'
        + '<div class="list-info"><div class="list-name">'+Utils.esc(po.supplier)+'</div>'
        + '<div class="list-meta">'+po.id+' · '+Utils.date(po.date)+'</div></div>'
        + '<div class="list-right"><div class="list-val">'+Utils.cur(po.total,cur)+'</div>'
        + '<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40;font-weight:700">'+po.status+'</span>'
        + '</div></div>';
    }).join('');

    // Overdue bills
    var overdueRows = bills.filter(function(b){ return b.status!=='Paid' && b.dueDate && b.dueDate < Utils.today(); })
      .slice(0,5).map(function(b) {
        var days = Math.round((new Date()-new Date(b.dueDate))/86400000);
        return '<div class="list-item" onclick="Supply.viewBill(\''+b.id+'\') ">'
          + '<div class="list-icon" style="background:var(--erb)">🧾</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(b.supplier)+'</div>'
          + '<div class="list-meta">'+b.id+' · Due: '+Utils.date(b.dueDate)+' ('+days+'d overdue)</div></div>'
          + '<div class="list-right"><div class="list-val" style="color:var(--er)">'+Utils.cur(b.balance,cur)+'</div>'
          + '<span style="font-size:9px;padding:2px 7px;border-radius:99px;background:var(--erb);color:var(--er);border:1px solid rgba(239,68,68,.3);font-weight:700">OVERDUE</span>'
          + '</div></div>';
      }).join('');

    el.innerHTML = kpis
      + (pos.length ? '<div class="sec"><div class="sec-title">Recent Purchase Orders <span class="sec-link" onclick="Supply.setTab(\'po\')">View All →</span></div><div class="card">'+recentPORows+'</div></div>' : '')
      + (overdueRows ? '<div class="sec"><div class="sec-title">⚠️ Overdue Bills <span class="sec-link" onclick="Supply.setTab(\'invoices\')">View All →</span></div><div class="card">'+overdueRows+'</div></div>' : '')
      + (pos.length===0&&bills.length===0 ? '<div class="sec"><div class="empty"><div class="empty-icon">🏭</div><div class="empty-title">No supply activity yet</div><div class="empty-sub">Create a Purchase Order to get started</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="Supply.setTab(\'po\')">＋ New Purchase Order</button></div></div></div>' : '');
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2 — PURCHASE ORDERS
  // ══════════════════════════════════════════════════════════════════════════
  _renderPOList: function(el) {
    var settings = DB.getSettings(); var cur = settings.currency||'$';
    var pos = DB.getPurchaseOrders();
    var statusColors = {Draft:'var(--t3)',Sent:'var(--in)',Confirmed:'var(--wa)',Received:'var(--ok)',Cancelled:'var(--er)'};

    var rows = pos.map(function(po) {
      var sc = statusColors[po.status]||'var(--t3)';
      return '<div class="list-item" onclick="Supply.viewPO(\''+po.id+'\')">'
        + '<div class="list-icon" style="background:var(--inb)">📋</div>'
        + '<div class="list-info"><div class="list-name">'+Utils.esc(po.supplier)+'</div>'
        + '<div class="list-meta">'+po.id+' · '+Utils.date(po.date)+'</div>'
        + '<div class="list-meta" style="font-size:10px;color:var(--t3)">'+(po.items||[]).length+' item'+(((po.items||[]).length)!==1?'s':'')+' · Expected: '+(po.expectedDate?Utils.date(po.expectedDate):'TBD')+'</div>'
        + '</div>'
        + '<div class="list-right"><div class="list-val">'+Utils.cur(po.total,cur)+'</div>'
        + '<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40;font-weight:700">'+po.status+'</span>'
        + '<div class="list-actions">'
        + (po.status!=='Received'&&po.status!=='Cancelled'?'<button class="btn-ok btn-sm" onclick="event.stopPropagation();Supply.openReceiveGRN(\''+po.id+'\')">📦 Receive</button>':'')
        + '<button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Supply.deletePO(\''+po.id+'\')">🗑</button>'
        + '</div></div></div>';
    }).join('');

    el.innerHTML = pos.length
      ? '<div class="sec"><div class="card">'+rows+'</div></div>'
      : '<div class="sec"><div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No purchase orders yet</div><div class="empty-sub">Tap "+ New PO" to order from a supplier</div></div></div>';
  },

  openNewPO: function() {
    var suppliers = DB.getSuppliers();
    var products  = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var cur       = DB.getSettings().currency||'$';
    if (!suppliers.length) { Toast.show('Add a supplier first','warn'); return; }
    Supply._poCart = [];

    Modal.open({
      title:'New Purchase Order', sub:'Order stock from a supplier', barColor:'var(--in)',
      body:'<div class="form-row">'
          +'<div class="fg"><label class="fl">Supplier *</label>'
          +'<select class="fi" id="po-supp" onchange="Supply._onPOSuppChange(this)">'+QuickCreate.supplierOptions()+'</select></div>'
          +'<div class="fg"><label class="fl">Expected Delivery</label>'
          +'<input class="fi" id="po-exp" type="date" value="'+Utils.today()+'"></div></div>'
          +'<div class="fg"><label class="fl">Add Products</label>'
          +'<select class="fi" id="po-prod-sel" onchange="Supply.addToPOCart(this)">'+QuickCreate.productOptions()+'</select></div>'
          +'<div id="po-cart-wrap"><div style="text-align:center;padding:14px;color:var(--t3);font-size:13px">No items added yet</div></div>'
          +'<div id="po-total-wrap"></div>'
          +'<div class="fg"><label class="fl">Notes</label><input class="fi" id="po-notes" placeholder="Any instructions..."></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.savePO()">💾 Save PO</button>',
    });
  },

  addToPOCart: function(sel) {
    // Intercept "+ Add New Product"
    if (QuickCreate.onProductChange(sel, function(newProd) {
      // Refresh dropdown and add new product to cart
      var poSel = Utils.get('po-prod-sel');
      if (poSel) poSel.innerHTML = QuickCreate.productOptions();
      Supply._poCart.push({id:newProd.id,name:newProd.name,qty:1,costPrice:parseFloat(newProd.cost)||0});
      Supply._renderPOCart();
    })) return;
    var id=sel.value; if(!id) return;
    var p=DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    sel.value='';
    if (Supply._poCart.find(function(i){ return i.id===id; })) return;
    Supply._poCart.push({id:id,name:p.name,qty:1,costPrice:parseFloat(p.cost)||0});
    Supply._renderPOCart();
  },

  _onPOSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var poSuppSel = Utils.get('po-supp');
      if (poSuppSel) {
        poSuppSel.innerHTML = QuickCreate.supplierOptions(newSupp.id);
        poSuppSel.value = newSupp.id;
      }
    });
  },

  _renderPOCart: function() {
    var el=Utils.get('po-cart-wrap'); if(!el) return;
    var cur=DB.getSettings().currency||'$';
    if(!Supply._poCart.length){ el.innerHTML='<div style="text-align:center;padding:14px;color:var(--t3);font-size:13px">No items added yet</div>'; Utils.get('po-total-wrap').innerHTML=''; return; }
    el.innerHTML=Supply._poCart.map(function(item,i){
      return '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">'
        +'<span style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(item.name)+'</span>'
        +'<input type="number" value="'+item.qty+'" min="1" oninput="Supply._setPOQty('+i+',this.value)" style="width:60px;text-align:center;font-size:13px;font-weight:600;background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:4px;color:var(--t1)">'
        +'<input type="number" value="'+item.costPrice+'" min="0" step="0.01" oninput="Supply._setPOCost('+i+',this.value)" style="width:80px;text-align:right;font-size:13px;font-weight:600;background:var(--gb);border:1px solid rgba(201,168,76,.2);border-radius:6px;padding:4px;color:var(--g)">'
        +'<button onclick="Supply._poCart.splice('+i+',1);Supply._renderPOCart()" style="background:var(--erb);border:1px solid var(--erbd);color:var(--er);border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>'
        +'</div>';
    }).join('');
    var total=Supply._poCart.reduce(function(a,i){ return a+(i.costPrice*i.qty); },0);
    Utils.get('po-total-wrap').innerHTML='<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:800"><span style="color:var(--t1)">PO Total</span><span style="color:var(--g);font-family:var(--fm)">'+Utils.cur(total,cur)+'</span></div>';
  },

  _setPOQty: function(i,v){ var n=parseInt(v); if(!isNaN(n)&&n>0){ Supply._poCart[i].qty=n; Supply._renderPOCart(); } },
  _setPOCost: function(i,v){ var n=parseFloat(v); if(!isNaN(n)&&n>=0){ Supply._poCart[i].costPrice=n; Supply._renderPOCart(); } },

  savePO: function() {
    var suppId=(Utils.get('po-supp')||{value:''}).value;
    if(!suppId){ Toast.show('Select a supplier','err'); return; }
    if(!Supply._poCart.length){ Toast.show('Add at least one product','err'); return; }
    var supp=DB.getSuppliers().find(function(s){ return s.id===suppId; });
    var total=Supply._poCart.reduce(function(a,i){ return a+(i.costPrice*i.qty); },0);
    DB.addPurchaseOrder({
      supplier: supp?supp.name:'Unknown',
      supplierId: suppId,
      items: Supply._poCart.map(function(i){ return Object.assign({},i); }),
      total: total,
      date: Utils.today(),
      expectedDate: Utils.val('po-exp'),
      notes: Utils.val('po-notes'),
      status: 'Sent',
    });
    Toast.show('Purchase Order saved ✓','ok');
    Modal.close();
    Supply.render();
  },

  viewPO: function(id) {
    var po=DB.getPurchaseOrders().find(function(x){ return x.id===id; }); if(!po) return;
    var cur=DB.getSettings().currency||'$';
    var sc={Draft:'var(--t3)',Sent:'var(--in)',Confirmed:'var(--wa)',Received:'var(--ok)',Cancelled:'var(--er)'}[po.status]||'var(--t3)';
    var statusOpts=['Draft','Sent','Confirmed','Received','Cancelled'].map(function(s){
      return '<option'+(po.status===s?' selected':'')+'>'+s+'</option>';
    }).join('');

    Modal.open({
      title:po.id, sub:Utils.esc(po.supplier)+' · '+Utils.date(po.date), barColor:'var(--in)',
      body:'<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
          +'<span style="font-size:12px;color:var(--t2)">Status</span>'
          +'<select onchange="Supply.updatePOStatus(\''+id+'\',this.value)" style="background:var(--bg2);border:1px solid var(--bd2);border-radius:6px;padding:4px 8px;font-size:12px;color:var(--t1)">'+statusOpts+'</select>'
          +'</div>'
          +'<div class="report-row"><span class="report-label">Expected Delivery</span><span class="report-val">'+(po.expectedDate?Utils.date(po.expectedDate):'Not set')+'</span></div>'
          +'<div class="report-row"><span class="report-label">PO Total</span><span class="report-val gold">'+Utils.cur(po.total,cur)+'</span></div>'
          +'</div>'
          +'<div class="sec-title" style="margin-bottom:6px">Ordered Items</div>'
          +'<div class="card card-body">'
          +(po.items||[]).map(function(item){
              return '<div class="report-row"><span class="report-label">'+Utils.esc(item.name)+'<span style="font-size:10px;color:var(--t3);margin-left:6px">×'+item.qty+'</span></span>'
                +'<span class="report-val gold">'+Utils.cur(item.costPrice*item.qty,cur)+'</span></div>';
            }).join('')
          +'</div>'+(po.notes?'<div style="font-size:12px;color:var(--t2);margin-top:10px;padding:10px;background:var(--bg3);border-radius:var(--r8)">'+Utils.esc(po.notes)+'</div>':''),
      footer:'<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            +(po.status!=='Received'&&po.status!=='Cancelled'?'<button class="btn-primary" style="flex:1" onclick="Modal.close();Supply.openReceiveGRN(\''+id+'\')">📦 Receive Stock</button>':''),
    });
  },

  updatePOStatus: function(id,status) {
    DB.updatePurchaseOrder(id,{status:status});
    Toast.show('Status updated ✓','ok');
    if (status==='Received') { Modal.close(); Supply.render(); }
  },

  deletePO: function(id) {
    confirmDel('Delete this purchase order?',function(){ DB.deletePurchaseOrder(id); Toast.show('Deleted','warn'); Supply.render(); });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 3 — GOODS RECEIVED NOTES (GRN)
  // ══════════════════════════════════════════════════════════════════════════
  _renderGRNList: function(el) {
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var grns=DB.getGRNs();
    var rows=grns.map(function(g){
      var sc=g.status==='Confirmed'?'var(--ok)':'var(--wa)';
      return '<div class="list-item" onclick="Supply.viewGRN(\''+g.id+'\')">'
        +'<div class="list-icon" style="background:var(--gb3)">📦</div>'
        +'<div class="list-info"><div class="list-name">'+Utils.esc(g.supplier)+'</div>'
        +'<div class="list-meta">'+g.id+' · '+Utils.date(g.date)+'</div>'
        +'<div class="list-meta" style="font-size:10px;color:var(--t3)">'+(g.poRef?'PO: '+g.poRef:'Manual receive')+'</div></div>'
        +'<div class="list-right"><div class="list-val">'+Utils.cur(g.total,cur)+'</div>'
        +'<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40;font-weight:700">'+g.status+'</span>'
        +'</div></div>';
    }).join('');

    el.innerHTML = grns.length
      ? '<div class="sec"><div class="card">'+rows+'</div></div>'
      : '<div class="sec"><div class="empty"><div class="empty-icon">📦</div><div class="empty-title">No stock received yet</div><div class="empty-sub">Record stock arrivals from suppliers here</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="Supply.openNewGRN()">＋ Receive Stock</button></div></div></div>';
  },

  openReceiveGRN: function(poId) {
    var po=DB.getPurchaseOrders().find(function(x){ return x.id===poId; });
    Supply._grnCart = po ? po.items.map(function(i){ return {id:i.id,name:i.name,orderedQty:i.qty,receivedQty:i.qty,costPrice:i.costPrice,condition:'Good'}; }) : [];
    Supply._grnPoRef = poId;
    Supply._openGRNForm(po?po.supplier:'', po?po.supplierId:'');
  },

  openNewGRN: function() {
    Supply._grnCart = [];
    Supply._grnPoRef = null;
    Supply._openGRNForm('', '');
  },

  _openGRNForm: function(supplierName, supplierId) {
    var suppliers=DB.getSuppliers();
    var products=DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var cur=DB.getSettings().currency||'$';

    Modal.open({
      title:'Receive Stock', sub:Supply._grnPoRef?'Receiving against '+Supply._grnPoRef:'Manual stock receipt', barColor:'var(--ok)',
      body:'<div class="form-row">'
          +'<div class="fg"><label class="fl">Supplier</label>'
          +'<select class="fi" id="grn-supp" onchange="Supply._onGRNSuppChange(this)">'+QuickCreate.supplierOptions(supplierId)+'</select></div>'
          +'<div class="fg"><label class="fl">Received Date</label>'
          +'<input class="fi" id="grn-date" type="date" value="'+Utils.today()+'"></div></div>'
          +(Supply._grnCart.length?'':
              '<div class="fg"><label class="fl">Add Product</label>'
              +'<select class="fi" id="grn-prod-sel" onchange="Supply.addToGRNCart(this)">'+QuickCreate.productOptions()+'</select></div>'
          )
          +'<div id="grn-cart-wrap"></div>'
          +'<div class="fg" style="margin-top:8px"><label class="fl">Delivery Note / Reference</label><input class="fi" id="grn-ref" placeholder="e.g. DN-1234"></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.saveGRN()">✅ Confirm Receipt</button>',
    });
    // Pre-fill supplier
    if (supplierId) { var el=Utils.get('grn-supp'); if(el) el.value=supplierId; }
    Supply._renderGRNCart();
  },

  addToGRNCart: function(sel) {
    if (QuickCreate.onProductChange(sel, function(newProd) {
      var grnSel = Utils.get('grn-prod-sel');
      if (grnSel) grnSel.innerHTML = QuickCreate.productOptions();
      Supply._grnCart.push({id:newProd.id,name:newProd.name,orderedQty:0,receivedQty:1,costPrice:parseFloat(newProd.cost)||0,condition:'Good'});
      Supply._renderGRNCart();
    })) return;
    var id=sel.value; if(!id) return;
    var p=DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    sel.value='';
    if (Supply._grnCart.find(function(i){ return i.id===id; })) return;
    Supply._grnCart.push({id:id,name:p.name,orderedQty:0,receivedQty:1,costPrice:parseFloat(p.cost)||0,condition:'Good'});
    Supply._renderGRNCart();
  },

  _onGRNSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var grnSuppSel = Utils.get('grn-supp');
      if (grnSuppSel) {
        grnSuppSel.innerHTML = QuickCreate.supplierOptions(newSupp.id);
        grnSuppSel.value = newSupp.id;
      }
    });
  },

  _renderGRNCart: function() {
    var el=Utils.get('grn-cart-wrap'); if(!el) return;
    var cur=DB.getSettings().currency||'$';
    if(!Supply._grnCart.length){ el.innerHTML=''; return; }
    el.innerHTML='<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin:10px 0 6px">Items to Receive</div>'
      +Supply._grnCart.map(function(item,i){
          return '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:10px 12px;margin-bottom:8px">'
            +'<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:8px">'+Utils.esc(item.name)+'</div>'
            +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
            +'<div><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Qty Received</div>'
            +'<input type="number" value="'+item.receivedQty+'" min="0" oninput="Supply._grnCart['+i+'].receivedQty=parseInt(this.value)||0" style="width:100%;font-size:14px;font-weight:700;background:var(--bg2);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 8px;color:var(--ok)"></div>'
            +'<div><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Cost Price</div>'
            +'<input type="number" value="'+item.costPrice+'" min="0" step="0.01" oninput="Supply._grnCart['+i+'].costPrice=parseFloat(this.value)||0" style="width:100%;font-size:14px;font-weight:700;background:var(--gb);border:1.5px solid rgba(201,168,76,.2);border-radius:6px;padding:5px 8px;color:var(--g)"></div>'
            +'<div><div style="font-size:9px;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Condition</div>'
            +'<select onchange="Supply._grnCart['+i+'].condition=this.value" style="width:100%;background:var(--bg2);border:1px solid var(--bd2);border-radius:6px;padding:5px;color:var(--t1);font-size:12px">'
            +'<option'+(item.condition==='Good'?' selected':'')+'>Good</option>'
            +'<option'+(item.condition==='Damaged'?' selected':'')+'>Damaged</option>'
            +'<option'+(item.condition==='Short'?' selected':'')+'>Short</option>'
            +'</select></div>'
            +'</div></div>';
        }).join('');
  },

  saveGRN: function() {
    var suppId=(Utils.get('grn-supp')||{value:''}).value;
    if(!suppId){ Toast.show('Select a supplier','err'); return; }
    if(!Supply._grnCart.length){ Toast.show('Add at least one item','err'); return; }
    var supp=DB.getSuppliers().find(function(s){ return s.id===suppId; });
    var total=Supply._grnCart.reduce(function(a,i){ return a+i.receivedQty*i.costPrice; },0);

    var grn=DB.addGRN({
      supplier: supp?supp.name:'Unknown',
      supplierId: suppId,
      poRef: Supply._grnPoRef||null,
      items: Supply._grnCart.map(function(i){ return Object.assign({},i); }),
      total: total,
      date: Utils.val('grn-date')||Utils.today(),
      deliveryRef: Utils.val('grn-ref'),
      status: 'Confirmed',
    });

    // Update product stock and cost price (weighted average)
    Supply._grnCart.forEach(function(item) {
      if (item.condition==='Damaged') return; // Don't add damaged to stock
      var p=DB.getProducts().find(function(x){ return x.id===item.id; });
      if(p){
        var newQty   = (parseInt(p.qty)||0) + item.receivedQty;
        var oldValue = (parseInt(p.qty)||0) * (parseFloat(p.cost)||0);
        var newValue = item.receivedQty * item.costPrice;
        var avgCost  = newQty>0 ? (oldValue+newValue)/newQty : item.costPrice;
        DB.updateProduct(item.id,{ qty:newQty, cost:parseFloat(avgCost.toFixed(4)) });
      }
    });

    // Mark PO as received
    if(Supply._grnPoRef) DB.updatePurchaseOrder(Supply._grnPoRef,{status:'Received'});

    Toast.show('Stock received ✓ — inventory updated','ok');
    Modal.close();
    Supply.render();
  },

  viewGRN: function(id) {
    var g=DB.getGRNs().find(function(x){ return x.id===id; }); if(!g) return;
    var cur=DB.getSettings().currency||'$';
    Modal.open({
      title:g.id, sub:Utils.esc(g.supplier)+' · '+Utils.date(g.date), barColor:'var(--ok)',
      body:'<div class="card card-body">'
          +'<div class="report-row"><span class="report-label">Supplier</span><span class="report-val">'+Utils.esc(g.supplier)+'</span></div>'
          +(g.poRef?'<div class="report-row"><span class="report-label">PO Reference</span><span class="report-val">'+g.poRef+'</span></div>':'')
          +(g.deliveryRef?'<div class="report-row"><span class="report-label">Delivery Note</span><span class="report-val">'+Utils.esc(g.deliveryRef)+'</span></div>':'')
          +'<div class="report-row"><span class="report-label">Total Value</span><span class="report-val gold">'+Utils.cur(g.total,cur)+'</span></div>'
          +'</div>'
          +'<div class="sec-title" style="margin:12px 0 6px">Items Received</div>'
          +'<div class="card card-body">'
          +(g.items||[]).map(function(item){
              var cond=item.condition!=='Good'?'<span style="font-size:9px;color:var(--er);margin-left:5px">'+item.condition+'</span>':'';
              return '<div class="report-row"><span class="report-label">'+Utils.esc(item.name)+cond+'<span style="font-size:10px;color:var(--t3);margin-left:6px">×'+item.receivedQty+'</span></span>'
                +'<span class="report-val gold">'+Utils.cur(item.costPrice*item.receivedQty,cur)+'</span></div>';
            }).join('')
          +'</div>',
      footer:'<button class="btn-primary" style="flex:1" onclick="Modal.close()">Close</button>',
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 4 — SUPPLIER BILLS / INVOICES
  // ══════════════════════════════════════════════════════════════════════════
  _renderBills: function(el) {
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var bills=DB.getSupplierBills();
    var today=Utils.today();

    var rows=bills.map(function(b){
      var isOverdue=b.status!=='Paid'&&b.dueDate&&b.dueDate<today;
      var sc=b.status==='Paid'?'var(--ok)':isOverdue?'var(--er)':'var(--wa)';
      var label=b.status==='Paid'?'PAID':isOverdue?'OVERDUE':'UNPAID';
      return '<div class="list-item" onclick="Supply.viewBill(\''+b.id+'\')">'
        +'<div class="list-icon" style="background:var(--wab)">🧾</div>'
        +'<div class="list-info"><div class="list-name">'+Utils.esc(b.supplier)+'</div>'
        +'<div class="list-meta">'+b.id+' · '+Utils.date(b.date)+'</div>'
        +'<div class="list-meta" style="font-size:10px;color:var(--t3)">Due: '+(b.dueDate?Utils.date(b.dueDate):'No due date')+'</div></div>'
        +'<div class="list-right"><div class="list-val">'+Utils.cur(b.total,cur)+'</div>'
        +(b.balance>0?'<div style="font-size:10px;color:var(--wa);margin-top:2px">Bal: '+Utils.cur(b.balance,cur)+'</div>':'')
        +'<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40;font-weight:700">'+label+'</span>'
        +(b.status!=='Paid'?'<button class="btn-ok btn-sm" style="margin-top:4px" onclick="event.stopPropagation();Supply.openPayBill(\''+b.id+'\')">💳 Pay</button>':'')
        +'</div></div>';
    }).join('');

    el.innerHTML = bills.length
      ? '<div class="sec"><div class="card">'+rows+'</div></div>'
      : '<div class="sec"><div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No supplier bills yet</div><div class="empty-sub">Record supplier invoices here to track what you owe</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="Supply.openNewBill()">＋ Add Bill</button></div></div></div>';
  },

  openNewBill: function() {
    var suppliers=DB.getSuppliers();
    Modal.open({
      title:'Add Supplier Bill', sub:'Record an invoice from a supplier', barColor:'var(--wa)',
      body:'<div class="fg"><label class="fl">Supplier *</label>'
          +'<select class="fi" id="bill-supp" onchange="Supply._onBillSuppChange(this)">'+QuickCreate.supplierOptions()+'</select></div>'
          +'<div class="fg"><label class="fl">Supplier Invoice Number</label>'
          +'<input class="fi" id="bill-ref" placeholder="e.g. INV-789"></div>'
          +'<div class="form-row">'
          +'<div class="fg"><label class="fl">Invoice Date</label>'
          +'<input class="fi" id="bill-date" type="date" value="'+Utils.today()+'"></div>'
          +'<div class="fg"><label class="fl">Due Date</label>'
          +'<input class="fi" id="bill-due" type="date"></div></div>'
          +'<div class="fg"><label class="fl">Amount *</label>'
          +'<input class="fi" id="bill-amt" type="number" step="0.01" min="0" placeholder="0.00" style="font-size:18px;font-weight:700"></div>'
          +'<div class="fg"><label class="fl">Notes</label>'
          +'<input class="fi" id="bill-notes" placeholder="What was this for?"></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.saveBill()">💾 Save Bill</button>',
    });
  },

  _onBillSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var billSel = Utils.get('bill-supp');
      if (billSel) {
        billSel.innerHTML = QuickCreate.supplierOptions(newSupp.id);
        billSel.value = newSupp.id;
      }
    });
  },

  saveBill: function() {
    var suppId=(Utils.get('bill-supp')||{value:''}).value;
    var amt=parseFloat(Utils.val('bill-amt')||0);
    if(!suppId){ Toast.show('Select a supplier','err'); return; }
    if(!amt){ Toast.show('Enter the amount','err'); return; }
    var supp=DB.getSuppliers().find(function(s){ return s.id===suppId; });
    DB.addSupplierBill({
      supplier: supp?supp.name:'Unknown',
      supplierId: suppId,
      ref: Utils.val('bill-ref'),
      date: Utils.val('bill-date')||Utils.today(),
      dueDate: Utils.val('bill-due'),
      total: amt,
      balance: amt,
      notes: Utils.val('bill-notes'),
      status: 'Unpaid',
    });
    // Update supplier balance
    if(supp){ DB.updateSupplier(suppId,{balance:(parseFloat(supp.balance)||0)+amt}); }
    Toast.show('Bill saved ✓','ok');
    Modal.close();
    Supply.render();
  },

  viewBill: function(id) {
    var b=DB.getSupplierBills().find(function(x){ return x.id===id; }); if(!b) return;
    var cur=DB.getSettings().currency||'$';
    var today=Utils.today();
    var isOverdue=b.status!=='Paid'&&b.dueDate&&b.dueDate<today;
    Modal.open({
      title:b.id, sub:Utils.esc(b.supplier), barColor:b.status==='Paid'?'var(--ok)':isOverdue?'var(--er)':'var(--wa)',
      body:'<div class="card card-body">'
          +'<div class="report-row"><span class="report-label">Supplier</span><span class="report-val">'+Utils.esc(b.supplier)+'</span></div>'
          +(b.ref?'<div class="report-row"><span class="report-label">Supplier Invoice No.</span><span class="report-val">'+Utils.esc(b.ref)+'</span></div>':'')
          +'<div class="report-row"><span class="report-label">Invoice Date</span><span class="report-val">'+Utils.date(b.date)+'</span></div>'
          +(b.dueDate?'<div class="report-row"><span class="report-label">Due Date</span><span class="report-val" style="color:'+(isOverdue?'var(--er)':'var(--t1)')+'">'+Utils.date(b.dueDate)+(isOverdue?' ⚠️ OVERDUE':'')+'</span></div>':'')
          +'<div class="report-row"><span class="report-label">Total Amount</span><span class="report-val gold">'+Utils.cur(b.total,cur)+'</span></div>'
          +'<div class="report-row"><span class="report-label">Balance Due</span><span class="report-val" style="color:'+(b.balance>0?'var(--wa)':'var(--ok)')+'">'+Utils.cur(b.balance,cur)+'</span></div>'
          +(b.notes?'<div style="font-size:12px;color:var(--t2);margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">'+Utils.esc(b.notes)+'</div>':'')
          +'</div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            +(b.status!=='Paid'?'<button class="btn-primary" style="flex:1" onclick="Modal.close();Supply.openPayBill(\''+id+'\')">💳 Pay Bill</button>':''),
    });
  },

  openPayBill: function(id) {
    var b=DB.getSupplierBills().find(function(x){ return x.id===id; }); if(!b) return;
    var cur=DB.getSettings().currency||'$';
    Modal.open({
      title:'Pay Bill', sub:Utils.esc(b.supplier)+' · '+Utils.cur(b.balance,cur)+' outstanding', barColor:'var(--ok)',
      body:'<div style="background:var(--gb3);border:1px solid rgba(201,168,76,.2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          +'<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--t2)">Total Bill</span><span style="font-weight:700">'+Utils.cur(b.total,cur)+'</span></div>'
          +'<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800"><span style="color:var(--wa)">Balance Due</span><span style="color:var(--wa)">'+Utils.cur(b.balance,cur)+'</span></div>'
          +'</div>'
          +'<div class="fg"><label class="fl">Amount Paying Now *</label>'
          +'<input class="fi" id="pb2-amt" type="number" value="'+b.balance.toFixed(2)+'" min="0.01" step="0.01" style="font-size:18px;font-weight:700;color:var(--ok)"></div>'
          +'<div class="fg"><label class="fl">Payment Method</label>'
          +'<select class="fi" id="pb2-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.payBill(\''+id+'\')">💳 Record Payment</button>',
    });
  },

  payBill: function(id) {
    var b=DB.getSupplierBills().find(function(x){ return x.id===id; }); if(!b) return;
    var paying=Math.min(parseFloat(Utils.val('pb2-amt')||0),parseFloat(b.balance)||0);
    if(paying<=0){ Toast.show('Enter valid amount','err'); return; }
    var newBal=Math.max(0,b.balance-paying);
    var newStatus=newBal<=0?'Paid':'Partial';
    DB.updateSupplierBill(id,{balance:newBal,status:newStatus});
    // Reduce supplier balance
    var supp=DB.getSuppliers().find(function(s){ return s.id===b.supplierId; });
    if(supp){ DB.updateSupplier(b.supplierId,{balance:Math.max(0,(parseFloat(supp.balance)||0)-paying)}); }
    Toast.show(newStatus==='Paid'?'Bill fully paid ✅':'Payment recorded ✓','ok');
    Modal.close();
    Supply.render();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 5 — REORDER ALERTS + AUTO-PO
  // ══════════════════════════════════════════════════════════════════════════
  _renderReorder: function(el) {
    var settings=DB.getSettings(); var cur=settings.currency||'$';
    var products=DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var suppliers=DB.getSuppliers();

    // Products needing reorder
    var needReorder=products.filter(function(p){ return p.qty<=(p.reorderPoint||p.lowLevel||5); });
    // Products fine
    var stockOK=products.filter(function(p){ return p.qty>(p.reorderPoint||p.lowLevel||5); });

    var reorderRows=needReorder.map(function(p){
      var pct=Math.min(100,Math.max(2,Math.round((p.qty/Math.max(p.reorderPoint||p.lowLevel||5,1))*100)));
      var isOut=p.qty===0;
      var lc=isOut?'var(--er)':'var(--wa)';
      var defaultSupp=suppliers.find(function(s){ return s.id===p.defaultSupplierId; });
      return '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:13px 14px;margin-bottom:10px">'
        +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">'
        +'<div><div style="font-size:14px;font-weight:700;color:var(--t1)">'+Utils.esc(p.name)+'</div>'
        +'<div style="font-size:11px;color:var(--t2);margin-top:3px">Current: <strong style="color:'+lc+'">'+p.qty+'</strong> · Reorder point: '+(p.reorderPoint||p.lowLevel||5)+'</div>'
        +'<div style="font-size:11px;color:var(--t3);margin-top:1px">Reorder qty: '+(p.reorderQty||20)+' · Cost price: '+Utils.cur(p.cost||0,cur)+'</div>'
        +'</div>'
        +'<span style="padding:3px 10px;border-radius:99px;font-size:9px;font-weight:800;background:'+lc+'18;color:'+lc+';border:1px solid '+lc+'40;white-space:nowrap">'+(isOut?'OUT OF STOCK':'LOW STOCK')+'</span>'
        +'</div>'
        +'<div class="progress" style="height:5px;margin-bottom:10px"><div class="progress-fill" style="width:'+pct+'%;background:'+lc+'"></div></div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        +(defaultSupp?'<span style="font-size:11px;color:var(--t2)">Supplier: <strong>'+Utils.esc(defaultSupp.name)+'</strong></span>':'<span style="font-size:11px;color:var(--t3)">No default supplier set</span>')
        +'<button class="btn-primary btn-sm" style="margin-left:auto" onclick="Supply.createAutoPO(\''+p.id+'\')">📋 Create PO</button>'
        +'<button class="btn-ghost btn-sm" onclick="Supply.openSetReorderLevels(\''+p.id+'\')">⚙️ Settings</button>'
        +'</div></div>';
    }).join('');

    el.innerHTML = '<div class="sec">'
      + (needReorder.length
          ? '<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:var(--r12);padding:12px 14px;margin-bottom:14px">'
            +'<div style="font-size:12px;font-weight:700;color:var(--er);margin-bottom:3px">⚠️ '+needReorder.length+' product'+(needReorder.length!==1?'s':'')+' need reordering</div>'
            +'<div style="font-size:11px;color:var(--t2)">Tap "Create PO" to auto-generate a Purchase Order</div></div>'
            + reorderRows
          : '<div style="background:var(--okb);border:1px solid var(--okbd);border-radius:var(--r12);padding:14px;text-align:center;font-size:14px;font-weight:600;color:var(--ok)">✓ All products are well stocked</div>')
      + (stockOK.length?'<div style="font-size:10px;color:var(--t3);text-align:center;margin-top:12px">'+stockOK.length+' other products at adequate stock levels</div>':'')
      + '</div>';
  },

  createAutoPO: function(productId) {
    var p=DB.getProducts().find(function(x){ return x.id===productId; }); if(!p) return;
    var suppliers=DB.getSuppliers();
    // suppOpts built via QuickCreate for auto-PO
    var cur=DB.getSettings().currency||'$';
    var orderQty=p.reorderQty||20;
    var total=orderQty*(parseFloat(p.cost)||0);

    Modal.open({
      title:'Create Purchase Order', sub:'Reorder: '+Utils.esc(p.name), barColor:'var(--in)',
      body:'<div style="background:var(--gb3);border:1px solid rgba(201,168,76,.2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          +'<div style="font-size:13px;font-weight:700;color:var(--t1)">'+Utils.esc(p.name)+'</div>'
          +'<div style="font-size:11px;color:var(--t2);margin-top:4px">Current stock: <strong style="color:var(--er)">'+p.qty+'</strong> · Reorder qty: <strong>'+orderQty+'</strong></div>'
          +'</div>'
          +'<div class="fg"><label class="fl">Supplier *</label>'
          +'<select class="fi" id="auto-po-supp" onchange="Supply._onAutoPOSuppChange(this)">'+QuickCreate.supplierOptions(p.defaultSupplierId)+'</select></div>'
          +'<div class="form-row">'
          +'<div class="fg"><label class="fl">Order Quantity</label>'
          +'<input class="fi" id="auto-po-qty" type="number" value="'+orderQty+'" min="1" oninput="Supply._updateAutoPOTotal(\''+productId+'\',this.value)"></div>'
          +'<div class="fg"><label class="fl">Cost Price</label>'
          +'<input class="fi" id="auto-po-cost" type="number" value="'+(parseFloat(p.cost)||0).toFixed(2)+'" step="0.01" oninput="Supply._updateAutoPOTotal(\''+productId+'\',null)"></div>'
          +'</div>'
          +'<div id="auto-po-total" style="font-size:16px;font-weight:800;color:var(--g);text-align:right;padding:8px 0">PO Total: '+Utils.cur(total,cur)+'</div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.saveAutoPO(\''+productId+'\')">💾 Create PO</button>',
    });
  },

  _updateAutoPOTotal: function(productId, newQty) {
    var qty  = parseInt((Utils.get('auto-po-qty')||{value:'0'}).value)||0;
    var cost = parseFloat((Utils.get('auto-po-cost')||{value:'0'}).value)||0;
    var cur  = DB.getSettings().currency||'$';
    var el   = Utils.get('auto-po-total');
    if (el) el.textContent = 'PO Total: '+Utils.cur(qty*cost,cur);
  },

  _onAutoPOSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var autoSel = Utils.get('auto-po-supp');
      if (autoSel) {
        autoSel.innerHTML = QuickCreate.supplierOptions(newSupp.id);
        autoSel.value = newSupp.id;
      }
    });
  },

  saveAutoPO: function(productId) {
    var p=DB.getProducts().find(function(x){ return x.id===productId; }); if(!p) return;
    var suppId=(Utils.get('auto-po-supp')||{value:''}).value;
    var qty=parseInt((Utils.get('auto-po-qty')||{value:'0'}).value)||0;
    var cost=parseFloat((Utils.get('auto-po-cost')||{value:'0'}).value)||0;
    if(!suppId){ Toast.show('Select a supplier','err'); return; }
    if(qty<1){ Toast.show('Enter quantity','err'); return; }
    var supp=DB.getSuppliers().find(function(s){ return s.id===suppId; });
    DB.addPurchaseOrder({
      supplier: supp?supp.name:'Unknown',
      supplierId: suppId,
      items:[{id:productId,name:p.name,qty:qty,costPrice:cost,orderedQty:qty}],
      total: qty*cost,
      date: Utils.today(),
      status:'Sent',
      autoGenerated:true,
    });
    // Save default supplier for next time
    DB.updateProduct(productId,{defaultSupplierId:suppId,reorderQty:qty});
    Toast.show('Purchase Order created ✓','ok');
    Modal.close();
    Supply.render();
  },

  openSetReorderLevels: function(id) {
    var p=DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    var suppliers=DB.getSuppliers();
    // suppOpts via QuickCreate
    Modal.open({
      title:'Reorder Settings', sub:Utils.esc(p.name), barColor:'var(--in)',
      body:'<div class="form-row">'
          +'<div class="fg"><label class="fl">Reorder Point</label>'
          +'<input class="fi" id="rl-point" type="number" value="'+(p.reorderPoint||p.lowLevel||5)+'" min="0">'
          +'<div style="font-size:10px;color:var(--t3);margin-top:3px">Alert when stock reaches this level</div></div>'
          +'<div class="fg"><label class="fl">Reorder Quantity</label>'
          +'<input class="fi" id="rl-qty" type="number" value="'+(p.reorderQty||20)+'" min="1">'
          +'<div style="font-size:10px;color:var(--t3);margin-top:3px">How many to order each time</div></div>'
          +'</div>'
          +'<div class="fg"><label class="fl">Default Supplier</label>'
          +'<select class="fi" id="rl-supp" onchange="Supply._onRLSuppChange(this)">'+QuickCreate.supplierOptions(p.defaultSupplierId,'— none —')+'</select></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Supply.saveReorderSettings(\''+id+'\')">💾 Save</button>',
    });
  },

  _onRLSuppChange: function(sel) {
    QuickCreate.onSupplierChange(sel, function(newSupp) {
      var rlSel = Utils.get('rl-supp');
      if (rlSel) {
        rlSel.innerHTML = QuickCreate.supplierOptions(newSupp.id, '— none —');
        rlSel.value = newSupp.id;
      }
    });
  },

  saveReorderSettings: function(id) {
    DB.updateProduct(id,{
      reorderPoint: parseInt(Utils.val('rl-point')||5),
      reorderQty:   parseInt(Utils.val('rl-qty')||20),
      defaultSupplierId: (Utils.get('rl-supp')||{value:''}).value||null,
    });
    Toast.show('Reorder settings saved ✓','ok');
    Modal.close();
    Supply.render();
  },
};


/* === expenses.js === */
var Expenses = {

  // ── RENDER ─────────────────────────────────────────────────────────────────
  render: function() {
    var pg = Utils.get('pg-expenses');
    if (!pg) return;
    var list     = DB.getExpenses();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var month    = Utils.today().slice(0, 7);
    var thisMonth = list.filter(function(e){ return e.date && e.date.startsWith(month); });
    var total     = thisMonth.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // Category breakdown
    var cats = {};
    thisMonth.forEach(function(e){ cats[e.category]=(cats[e.category]||0)+(parseFloat(e.amount)||0); });

    // Allocated expenses
    var allocs     = DB.getAllocations();
    var allocToday = DB.getAllocatedDaily();
    var allocTotal = allocToday.reduce(function(a,x){ return a+x.daily; }, 0);

    // Regular expense rows
    var expRows = list.length ? list.map(function(e){
      return '<div class="list-item">'
        + '<div class="list-icon" style="background:var(--erb)">💸</div>'
        + '<div class="list-info">'
        + '<div class="list-name">'+Utils.esc(e.description||e.category)+'</div>'
        + '<div class="list-meta">'+Utils.esc(e.category)+' · '+Utils.date(e.date)+(e.recurring?' · 🔄':'')+'</div>'
        + '</div>'
        + '<div class="list-right">'
        + '<div class="list-val" style="color:var(--er)">'+Utils.cur(e.amount,cur)+'</div>'
        + '<div class="list-actions"><button class="btn-danger btn-sm btn-icon" onclick="Expenses.del(\''+e.id+'\')">🗑</button></div>'
        + '</div></div>';
    }).join('') : '<div class="empty" style="padding:20px"><div class="empty-icon">💸</div><div class="empty-title">No manual expenses yet</div></div>';

    // Allocated expense rows (amber/orange, read-only)
    var allocRows = allocToday.length ? allocToday.map(function(a){
      return '<div style="display:flex;align-items:center;gap:11px;padding:12px 14px;border-bottom:1px solid rgba(245,158,11,.12);cursor:pointer" onclick="Allocations.render()">'
        + '<div style="width:40px;height:40px;border-radius:var(--r10);background:rgba(245,158,11,.12);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">🔒</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:600;color:var(--t1)">'+Utils.esc(a.name)+'</div>'
        + '<div style="font-size:11px;color:var(--wa);margin-top:2px;font-family:var(--fm)">'+Utils.esc(a.periodLabel)+' · tap to edit in Allocations</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:16px;font-weight:800;color:var(--wa)">'+Utils.cur(a.daily,cur)+'/day</div>'
        + '<div style="font-size:9px;color:var(--t3);font-family:var(--fm);margin-top:2px">ALLOCATED</div>'
        + '</div></div>';
    }).join('') : '<div style="padding:14px;text-align:center;color:var(--t3);font-size:13px">No active allocations. <span style="color:var(--wa);cursor:pointer" onclick="Allocations.render()">Set up allocations →</span></div>';

    var catChartHtml = Object.keys(cats).length
      ? '<div class="chart-wrap"><div class="chart-title">By Category</div><div class="chart-sub">Monthly breakdown</div>'+Charts.bar(Object.values(cats), Object.keys(cats), 'ok')+'</div>'
      : '';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Expenses</div>'
      + '<div class="page-sub">'+thisMonth.length+' manual · '+Utils.cur(total,cur)+' this month</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Expenses.openAddModal()">+ Add</button></div>'
      + '</div>'
      + '<div class="sec">'
      + '<div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)"><div class="kpi-icon">💸</div><div class="kpi-label">Manual (Month)</div><div class="kpi-value">'+Utils.cur(total,cur)+'</div><div class="kpi-sub">'+thisMonth.length+' entries</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">📅</div><div class="kpi-label">Allocated (Daily)</div><div class="kpi-value">'+Utils.cur(allocTotal,cur)+'</div><div class="kpi-sub">'+allocToday.length+' active</div></div>'
      + '</div>'
      + catChartHtml
      + '<div class="sec-title">Manual Expenses <span class="sec-link" onclick="Expenses.openAddModal()">+ Add</span></div>'
      + '<div class="card">'+expRows+'</div>'
      + '</div>'
      // Allocated section
      + '<div class="sec">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<div style="font-size:12px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.1em">🔒 Allocated Expenses</div>'
      + '<span style="font-size:12px;font-weight:600;color:var(--wa);cursor:pointer" onclick="Allocations.render()">Manage →</span>'
      + '</div>'
      + '<div style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.2);border-radius:var(--r14);overflow:hidden">'
      + allocRows
      + (allocToday.length ? '<div style="padding:11px 14px;background:rgba(245,158,11,.08);border-top:1px solid rgba(245,158,11,.15);display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:12px;font-weight:700;color:var(--wa)">Total Allocated Today</span>'
        + '<span style="font-size:16px;font-weight:800;color:var(--wa);font-family:var(--fm)">'+Utils.cur(allocTotal,cur)+'</span>'
        + '</div>' : '')
      + '</div>'
      + '</div>';
  },

  // ── ADD EXPENSE ────────────────────────────────────────────────────────────
  openAddModal: function() {
    Modal.open({
      title: 'Add Expense', barColor: 'var(--er)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Category *</label>'
          + '<select class="fi" id="ef-cat"><option>Rent</option><option>Utilities</option><option>Salaries</option><option>Marketing</option><option>Maintenance</option><option>Transport</option><option>Insurance</option><option>Stock Purchase</option><option>Other</option></select></div>'
          + '<div class="fg"><label class="fl">Amount *</label>'
          + '<input class="fi" id="ef-amt" type="number" step="0.01" placeholder="0.00"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Description</label>'
          + '<input class="fi" id="ef-desc" placeholder="What was this for?"></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Date</label>'
          + '<input class="fi" id="ef-date" type="date" value="'+Utils.today()+'"></div>'
          + '<div class="fg"><label class="fl">Recurring?</label>'
          + '<select class="fi" id="ef-rec"><option value="0">No</option><option value="1">Yes — Monthly</option></select></div>'
          + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Expenses.save()">💾 Save</button>',
    });
  },

  save: function() {
    var amt = parseFloat(Utils.val('ef-amt')||0);
    if (!amt) { Toast.show('Amount is required','err'); return; }
    DB.addExpense({
      category: (Utils.get('ef-cat')||{value:'Other'}).value,
      description: Utils.val('ef-desc'),
      amount: amt,
      date: Utils.val('ef-date') || Utils.today(),
      recurring: !!parseInt(Utils.val('ef-rec')||'0'),
    });
    Toast.show('Expense saved ✓','ok');
    Modal.close();
    this.render();
  },

  del: function(id) {
    confirmDel('Delete this expense?', function(){
      DB.deleteExpense(id);
      Toast.show('Deleted','warn');
      Expenses.render();
    });
  },
};


/* === allocations.js === */
// ── EXPENSE ALLOCATIONS MODULE ─────────────────────────────────────────────
// Daily amount = Total Amount ÷ Days between Start Date and End Date
// If no end date is set, uses 30 days as the default span

var Allocations = {

  // ── RENDER LIST PAGE ───────────────────────────────────────────────────────
  render: function() {
    Router.go('expenses');
    var pg = Utils.get('pg-expenses');
    if (!pg) return;
    var cur    = DB.getSettings().currency || '$';
    var allocs = DB.getAllocations();
    var today  = Utils.today();
    var daily  = DB.getAllocatedDaily();
    var dayTot = daily.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);

    var rows = allocs.length ? allocs.map(function(a) {
      var active   = a.startDate <= today && (!a.endDate || a.endDate >= today);
      var statusBg = active ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)';
      var statusCl = active ? 'var(--ok)' : 'var(--er)';
      var statusTx = active ? 'Active' : (a.startDate > today ? 'Not Started' : 'Ended');

      // Build the date span label
      var spanDays = Allocations._calcDays(a.startDate, a.endDate);
      var spanLabel = Utils.cur(a.amount, cur) + ' over ' + spanDays + ' day' + (spanDays !== 1 ? 's' : '')
        + ' = ' + Utils.cur(a.daily, cur) + '/day';

      return '<div style="display:flex;align-items:center;gap:11px;padding:13px 14px;border-bottom:1px solid var(--bd)">'
        + '<div style="width:42px;height:42px;border-radius:var(--r10);background:rgba(245,158,11,.12);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">📅</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1)">'+Utils.esc(a.name)+'</div>'
        + '<div style="font-size:11px;color:var(--wa);margin-top:2px;font-family:var(--fm)">'+spanLabel+'</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'
        + 'From: '+Utils.date(a.startDate)+(a.endDate?' · Until: '+Utils.date(a.endDate):' · Ongoing (no end date)')
        + '</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:15px;font-weight:800;color:var(--wa)">'+Utils.cur(a.amount,cur)+'</div>'
        + '<div style="font-size:9px;color:var(--t3);font-family:var(--fm)">'+Utils.esc(a.category||'')+'</div>'
        + '<div style="margin-top:4px;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;background:'+statusBg+';color:'+statusCl+'">'+statusTx+'</div>'
        + '<div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end">'
        + '<button class="btn-ghost btn-sm btn-icon" onclick="Allocations.openEdit(\''+a.id+'\')">✏️</button>'
        + '<button class="btn-danger btn-sm btn-icon" onclick="Allocations.del(\''+a.id+'\',\''+Utils.esc(a.name)+'\')">🗑</button>'
        + '</div></div></div>';
    }).join('')
    : '<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">No allocations yet</div>'
      + '<div class="empty-sub">Add a cost with a start and end date — the daily amount is calculated automatically.</div></div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Expense Allocations</div>'
      + '<div class="page-sub">'+allocs.length+' allocation'+( allocs.length!==1?'s':'')+' · '+Utils.cur(dayTot,cur)+'/day active</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Allocations.openAdd()">+ Add</button></div>'
      + '</div>'
      + '<div class="sec">'
      + '<div class="kpi-grid" style="grid-template-columns:1fr 1fr">'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)">'
      + '<div class="kpi-icon">📅</div><div class="kpi-label">Daily Total</div>'
      + '<div class="kpi-value">'+Utils.cur(dayTot,cur)+'</div>'
      + '<div class="kpi-sub">Deducted each day</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)">'
      + '<div class="kpi-icon">📊</div><div class="kpi-label">Active Now</div>'
      + '<div class="kpi-value">'+daily.length+'</div>'
      + '<div class="kpi-sub">of '+allocs.length+' total</div></div>'
      + '</div>'
      + '<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.18);border-radius:var(--r12);padding:12px 14px;margin-bottom:14px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--wa);margin-bottom:4px">ℹ️ How it works</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.65">'
      + 'Enter the total cost, a start date, and an end date. The system divides the total by the number of days to get the daily rate. '
      + 'That amount is automatically deducted from your net profit each day the allocation is active.'
      + '</div></div>'
      + '<div class="sec-title">All Allocations</div>'
      + '<div class="card">'+rows+'</div>'
      + '</div>'
      + '<div class="sec" style="padding-bottom:8px">'
      + '<button class="btn-ghost" style="width:100%" onclick="Expenses.render()">← Back to Expenses</button>'
      + '</div>';
  },

  // ── FORM ───────────────────────────────────────────────────────────────────
  openAdd:  function() { this._openForm(null); },
  openEdit: function(id) {
    var a = DB.getAllocations().find(function(x){ return x.id===id; });
    if (a) this._openForm(a);
  },

  _openForm: function(existing) {
    var isEdit = !!existing;
    var a      = existing || {};

    Modal.open({
      title:    isEdit ? 'Edit Allocation' : 'Add Allocation',
      sub:      'Cost is divided across the date range automatically',
      barColor: 'var(--wa)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Expense Name *</label>'
          + '<input class="fi" id="al-name" value="'+Utils.esc(a.name||'')+'" placeholder="e.g. Shop Rent"></div>'
          + '<div class="fg"><label class="fl">Category</label>'
          + '<select class="fi" id="al-cat">'
          + ['Rent','Salary','Insurance','Utilities','Fuel','Transport','Other'].map(function(c){
              return '<option'+(a.category===c?' selected':'')+'>'+c+'</option>';
            }).join('')
          + '</select></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Total Amount *</label>'
          + '<input class="fi" id="al-amt" type="number" step="0.01" min="0"'
          + ' value="'+(a.amount||'')+'" placeholder="e.g. 600.00"'
          + ' oninput="Allocations.previewDaily()" style="font-size:18px;font-weight:700"></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Start Date *</label>'
          + '<input class="fi" id="al-start" type="date" value="'+(a.startDate||Utils.today())+'"'
          + ' oninput="Allocations.previewDaily()"></div>'
          + '<div class="fg"><label class="fl">End Date</label>'
          + '<input class="fi" id="al-end" type="date" value="'+(a.endDate||'')+'"'
          + ' placeholder="Leave blank = 30 days" oninput="Allocations.previewDaily()"></div>'
          + '</div>'
          // Live preview box
          + '<div id="al-preview" style="'
          + 'background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);'
          + 'border-radius:var(--r10);padding:13px 14px;min-height:44px;'
          + 'font-size:13px;color:var(--wa);font-weight:600;line-height:1.6'
          + '">Enter amount and dates to see the daily rate</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + (isEdit ? '' : '<button class="btn-ghost" onclick="Allocations.save(\'new\')" style="color:var(--wa);border-color:rgba(245,158,11,.3)">💾 Save &amp; Add New</button>')
            + '<button class="btn-primary" style="flex:1;background:linear-gradient(135deg,var(--wa),#b45309);color:#fff"'
            + ' onclick="Allocations.save(\'close\''+(isEdit?',\''+a.id+'\'':'')+')">💾 Save</button>',
    });
    setTimeout(function(){ Allocations.previewDaily(); }, 60);
  },

  // ── LIVE PREVIEW ───────────────────────────────────────────────────────────
  previewDaily: function() {
    var el  = Utils.get('al-preview'); if (!el) return;
    var amt = parseFloat((Utils.get('al-amt')||{value:'0'}).value||0);
    var cur = DB.getSettings().currency || '$';
    if (!amt) { el.textContent = 'Enter amount and dates to see the daily rate'; return; }

    var start = (Utils.get('al-start')||{value:''}).value;
    var end   = (Utils.get('al-end')||{value:''}).value;
    var days  = Allocations._calcDays(start, end);
    var daily = amt / days;

    el.innerHTML = '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">'
      + '<span>'+Utils.cur(amt,cur)+' ÷ '+days+' day'+(days!==1?'s':'')+'</span>'
      + '<span style="font-size:16px;color:var(--g);font-weight:800">= '+Utils.cur(daily,cur)+' / day</span>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px;font-weight:400">'
      + (end ? 'From '+start+' to '+end : 'No end date — using 30 days as default span')
      + '</div>';
  },

  // ── HELPERS ────────────────────────────────────────────────────────────────
  // Days between start and end. Falls back to 30 if no end date.
  _calcDays: function(start, end) {
    if (!start) return 30;
    if (!end)   return 30; // no end date = 30 day default
    var s = new Date(start);
    var e = new Date(end);
    var diff = Math.round((e - s) / 86400000); // ms per day
    return diff > 0 ? diff : 1; // at least 1 day
  },

  _calcDailyFromDates: function(amount, start, end) {
    var days = Allocations._calcDays(start, end);
    return amount / days;
  },

  // ── SAVE ───────────────────────────────────────────────────────────────────
  save: function(action, editId) {
    var name  = Utils.val('al-name').trim();
    var amt   = parseFloat(Utils.val('al-amt')||0);
    var start = Utils.val('al-start') || Utils.today();
    var end   = Utils.val('al-end')   || '';
    var cat   = (Utils.get('al-cat')||{value:'Other'}).value;

    if (!name) { Toast.show('Name is required','err');   return; }
    if (!amt)  { Toast.show('Amount is required','err'); return; }
    if (!start){ Toast.show('Start date is required','err'); return; }
    if (end && end <= start) { Toast.show('End date must be after start date','err'); return; }

    var days  = Allocations._calcDays(start, end);
    var daily = amt / days;
    var cur   = DB.getSettings().currency || '$';
    var spanLabel = Utils.cur(amt,cur)+' over '+days+' day'+(days!==1?'s':'')+' = '+Utils.cur(daily,cur)+'/day';

    var data = {
      name:        name,
      amount:      amt,
      daily:       daily,
      days:        days,
      periodLabel: spanLabel,
      category:    cat,
      startDate:   start,
      endDate:     end || null,
    };

    if (editId) {
      DB.updateAllocation(editId, data);
      Toast.show('Allocation updated ✓', 'ok');
      Modal.close();
      Allocations.render();
    } else {
      DB.addAllocation(data);
      Toast.show('Allocation saved ✓', 'ok');
      if (action === 'new') {
        // Reset form for next entry
        var amtEl   = Utils.get('al-amt');   if(amtEl)   amtEl.value   = '';
        var endEl   = Utils.get('al-end');   if(endEl)   endEl.value   = '';
        var nameEl  = Utils.get('al-name');  if(nameEl)  nameEl.value  = '';
        var startEl = Utils.get('al-start'); if(startEl) startEl.value = Utils.today();
        Allocations.previewDaily();
        Toast.show('Ready for next allocation', 'ok');
      } else {
        Modal.close();
        Allocations.render();
      }
    }
  },

  // ── DELETE ─────────────────────────────────────────────────────────────────
  del: function(id, name) {
    confirmDel('Remove "'+name+'" allocation?', function(){
      DB.deleteAllocation(id);
      Toast.show('Allocation removed', 'warn');
      Allocations.render();
    });
  },
};


/* === salary.js === */
var Salary = {
  render() {
    const pg = Utils.get('pg-salary');
    if (!pg) return;
    const emps = DB.getEmployees();
    const settings = DB.getSettings();
    const cur = settings.currency||'$';
    const month = Utils.today().slice(0,7);
    const payroll = DB.getPayroll().filter(p=>p.month===month);
    const paidIds = payroll.map(p=>p.employeeId);
    const totalPayroll = emps.filter(e=>e.status==='active').reduce((a,e)=>a+(parseFloat(e.salary)||0),0);
    const paidAmt = payroll.reduce((a,p)=>a+(parseFloat(p.amount)||0),0);
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Salary</div>
          <div class="page-sub">${emps.length} employees</div></div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Salary.openAddEmp()">+ Add Staff</button>
        </div>
      </div>
      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--gold);--kibg:var(--goldbg)">
            <div class="kpi-icon">💰</div><div class="kpi-label">Monthly Payroll</div>
            <div class="kpi-value">${Utils.cur(totalPayroll,cur)}</div>
          </div>
          <div class="kpi" style="--kc:var(--ok);--kibg:var(--okbg)">
            <div class="kpi-icon">✅</div><div class="kpi-label">Paid This Month</div>
            <div class="kpi-value">${Utils.cur(paidAmt,cur)}</div>
            <div class="kpi-sub">${paidIds.length} of ${emps.length}</div>
          </div>
        </div>
        <div class="sec-title">Staff Members</div>
        ${emps.length ? `<div class="card">${emps.map(e=>{
          const paid = paidIds.includes(e.id);
          return `<div class="sal-row">
            <div>
              <div class="sal-name">${Utils.esc(e.name)}</div>
              <div class="sal-role">${Utils.esc(e.role||'—')} · ${Utils.esc(e.dept||'—')}</div>
            </div>
            <div style="text-align:right">
              <div class="sal-amount">${Utils.cur(e.salary||0,cur)}</div>
              <div style="margin-top:4px;display:flex;gap:6px;justify-content:flex-end">
                ${Utils.statusBadge(paid?'Paid':'Pending')}
                ${!paid?`<button class="btn-ok btn-sm" onclick="Salary.pay('${e.id}')">Pay</button>`:''}
                <button class="btn-danger btn-sm btn-icon" onclick="Salary.delEmp('${e.id}','${Utils.esc(e.name)}')">🗑</button>
              </div>
            </div>
          </div>`;}).join('')}</div>` :
          '<div class="empty"><div class="empty-icon">👔</div><div class="empty-title">No employees yet</div><div class="empty-sub">Add your staff members</div></div>'}
      </div>`;
  },
  openAddEmp() {
    Modal.open({ title:'Add Employee', barColor:'var(--gold)',
      body:`
        <div class="form-row">
          <div class="fg"><label class="fl">Full Name *</label><input class="fi" id="em-name" placeholder="Employee name"></div>
          <div class="fg"><label class="fl">Role</label><input class="fi" id="em-role" placeholder="e.g. Sales Manager"></div>
        </div>
        <div class="form-row">
          <div class="fg"><label class="fl">Department</label><input class="fi" id="em-dept" placeholder="e.g. Sales"></div>
          <div class="fg"><label class="fl">Monthly Salary *</label><input class="fi" id="em-sal" type="number" step="0.01" placeholder="0.00"></div>
        </div>
        <div class="fg"><label class="fl">Phone</label><input class="fi" id="em-phone" type="tel"></div>`,
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Salary.saveEmp()">💾 Save</button>` });
  },
  saveEmp() {
    const name = Utils.val('em-name'); const sal = parseFloat(Utils.val('em-sal')||0);
    if (!name) { Toast.show('Name is required','err'); return; }
    DB.addEmployee({ name, role:Utils.val('em-role'), dept:Utils.val('em-dept'), salary:sal, phone:Utils.val('em-phone'), status:'active' });
    Toast.show('Employee added ✓','ok'); Modal.close(); this.render();
  },
  pay(id) {
    const e = DB.getEmployees().find(x=>x.id===id);
    if (!e) return;
    DB.addPayroll({ employeeId:id, employeeName:e.name, amount:e.salary, month:Utils.today().slice(0,7) });
    Toast.show(`${e.name} — salary paid ✓`,'ok');
    this.render();
  },
  delEmp(id, name) { confirmDel(`Remove "${name}" from staff?`, ()=>{ DB.deleteEmployee(id); Toast.show('Removed','warn'); this.render(); }); },
};


/* === finance.js === */
var Finance = {
  render: function() {
    var pg = Utils.get('pg-finance');
    if (!pg) return;
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';
    var sales     = DB.getSales();
    var expenses  = DB.getExpenses();
    var payroll   = DB.getPayroll();
    var suppliers = DB.getSuppliers();
    var allocs    = DB.getAllocatedDaily();
    var allocTot  = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);

    // ── A. TOTAL SALES ───────────────────────────────────────────────────────
    // All sales regardless of payment status
    var totalSales = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);

    // ── B. COGS — Quantity Sold × Cost Price per product ────────────────────
    var totalCOGS = sales.reduce(function(a,s){
      return a + (s.items||[]).reduce(function(b,item){
        return b + (parseFloat(item.cost)||0) * (parseInt(item.qty)||1);
      }, 0);
    }, 0);

    // ── C. GROSS PROFIT ──────────────────────────────────────────────────────
    var grossProfit = totalSales - totalCOGS;
    var grossMargin = totalSales > 0 ? (grossProfit/totalSales*100).toFixed(1) : '0.0';

    // ── D. TOTAL EXPENSES ────────────────────────────────────────────────────
    // Manual expenses (all time)
    var manualExp = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    // Allocated expenses daily total
    var totalExp  = manualExp + allocTot;

    // ── E. NET PROFIT ────────────────────────────────────────────────────────
    var netProfit  = grossProfit - totalExp;
    var netMargin  = totalSales > 0 ? (netProfit/totalSales*100).toFixed(1) : '0.0';

    // ── F. CASH AVAILABLE ────────────────────────────────────────────────────
    // Only count ACTUALLY PAID sales — exclude unpaid credit
    var cashFromSales = sales.filter(function(s){ return s.status==='Paid'; })
      .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);

    // Partial payments collected
    var cashFromPartial = sales.filter(function(s){ return s.status==='Partial'; })
      .reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); }, 0);

    // Payment method breakdown (only from collected money)
    var payMethods = { Cash:0, 'Mobile Money':0, 'Bank Transfer':0, Other:0 };
    sales.forEach(function(s){
      if (s.status === 'Paid' || s.status === 'Partial') {
        var collected = s.status==='Paid' ? (parseFloat(s.total)||0) : (parseFloat(s.amountPaid)||0);
        var method    = s.payment || 'Cash';
        if (payMethods[method] !== undefined) payMethods[method] += collected;
        else payMethods['Other'] = (payMethods['Other']||0) + collected;
      }
    });

    // Debt collections (balance payments recorded in payments table)
    var payments     = DB.getPayments ? DB.getPayments() : [];
    var debtCollected= payments.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); }, 0);

    // Cash out: expenses paid
    var expCashOut = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // Cash out: salary paid
    var salaryPaid = payroll.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); }, 0);

    // Cash out: supplier payments (amounts paid to suppliers — tracked as reduced balance)
    // We don't have a supplier payment ledger, so we note this as a placeholder
    var supplierPaid = 0; // Would come from supplier payment records if tracked

    var totalCashIn  = cashFromSales + cashFromPartial + debtCollected;
    var totalCashOut = expCashOut + salaryPaid + supplierPaid;
    var cashAvailable= totalCashIn - totalCashOut;

    // Outstanding debt (credit still owed)
    var creditOutstanding = sales.filter(function(s){ return s.status!=='Paid'; })
      .reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);

    // This month data
    var month     = Utils.today().slice(0,7);
    var monthSales= sales.filter(function(s){ return s.date&&s.date.startsWith(month); });
    var monthRev  = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var monthExp  = expenses.filter(function(e){ return e.date&&e.date.startsWith(month); })
                     .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);

    // ── HERO CARDS (4 big cards) ─────────────────────────────────────────────
    var heroCards = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 14px;margin-bottom:16px">'
      // Total Sales — Gold
      + Finance._heroCard('💰','TOTAL SALES',Utils.cur(totalSales,cur),sales.length+' invoices','var(--g)','var(--gb)','var(--g)')
      // Cash Available — Blue
      + Finance._heroCard('💵','CASH AVAILABLE',Utils.cur(cashAvailable,cur),'Actual cash on hand','var(--in)','var(--inb)','var(--in)')
      // Gross Profit — Green
      + Finance._heroCard('📈','GROSS PROFIT',Utils.cur(grossProfit,cur),grossMargin+'% margin',grossProfit>=0?'var(--ok)':'var(--er)',grossProfit>=0?'var(--okb)':'var(--erb)',grossProfit>=0?'var(--ok)':'var(--er)')
      // Net Profit — Green or Red
      + Finance._heroCard(netProfit>=0?'✅':'📉','NET PROFIT',Utils.cur(netProfit,cur),netMargin+'% margin',netProfit>=0?'var(--ok)':'var(--er)',netProfit>=0?'var(--okb)':'var(--erb)',netProfit>=0?'var(--ok)':'var(--er)')
      + '</div>';

    // ── FULL P&L STATEMENT ───────────────────────────────────────────────────
    function plRow(label, val, color, isBold, isBig) {
      var borderTop = isBold ? ';border-top:2px solid var(--bd2);padding-top:10px;margin-top:6px' : '';
      var fontSize  = isBig  ? 'font-size:17px' : 'font-size:13px';
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd)'+borderTop+'">'
        + '<span style="'+fontSize+';color:'+(isBold?'var(--t1)':'var(--t2)')+';font-weight:'+(isBold?'800':'500')+'">'+label+'</span>'
        + '<span style="'+fontSize+';font-weight:'+(isBold?'900':'700')+';color:'+color+';font-family:var(--fm)">'+val+'</span>'
        + '</div>';
    }

    var plHtml = '<div class="sec">'
      + '<div class="sec-title">📊 Profit &amp; Loss Statement</div>'
      + '<div class="card card-body">'
      + plRow('Total Sales Revenue',          Utils.cur(totalSales,cur),  'var(--g)')
      + plRow('Cost of Goods Sold (COGS)',    '('+Utils.cur(totalCOGS,cur)+')',   'var(--er)')
      + plRow('GROSS PROFIT',                 Utils.cur(grossProfit,cur)+' ('+grossMargin+'%)', grossProfit>=0?'var(--ok)':'var(--er)', true, true)
      + plRow('Manual Expenses',              '('+Utils.cur(manualExp,cur)+')',  'var(--er)')
      + (allocTot>0 ? plRow('Allocated Expenses (daily)', '('+Utils.cur(allocTot,cur)+')', 'var(--wa)') : '')
      + plRow('Total Expenses',               '('+Utils.cur(totalExp,cur)+')',   'var(--er)')
      + plRow('NET PROFIT',                   Utils.cur(netProfit,cur)+' ('+netMargin+'%)', netProfit>=0?'var(--ok)':'var(--er)', true, true)
      + '</div></div>';

    // ── COGS BREAKDOWN ───────────────────────────────────────────────────────
    var prodCOGS = {};
    sales.forEach(function(s){
      (s.items||[]).forEach(function(item){
        if (!prodCOGS[item.name]) prodCOGS[item.name]={sold:0,cost:0,rev:0,costPrice:parseFloat(item.cost)||0};
        prodCOGS[item.name].sold += parseInt(item.qty)||1;
        prodCOGS[item.name].cost += (parseFloat(item.cost)||0)*(parseInt(item.qty)||1);
        prodCOGS[item.name].rev  += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var cogsKeys = Object.keys(prodCOGS).sort(function(a,b){ return prodCOGS[b].cost-prodCOGS[a].cost; }).slice(0,10);

    var cogsHtml = cogsKeys.length ? '<div class="sec">'
      + '<div class="sec-title">🏷️ COGS Breakdown by Product</div>'
      + '<div class="card">'
      + '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px;padding:8px 14px;border-bottom:1px solid var(--bd);font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.08em">'
      + '<span>Product</span><span style="text-align:right">Sold</span><span style="text-align:right">Cost/unit</span><span style="text-align:right">Total Cost</span></div>'
      + cogsKeys.map(function(k){
          var p=prodCOGS[k];
          var margin = p.rev>0 ? ((p.rev-p.cost)/p.rev*100).toFixed(0) : '0';
          return '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px;padding:9px 14px;border-bottom:1px solid var(--bd);align-items:center">'
            + '<div><div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(k)+'</div>'
            + '<div style="font-size:10px;color:var(--ok)">'+margin+'% margin</div></div>'
            + '<div style="text-align:right;font-size:12px;color:var(--t2)">×'+p.sold+'</div>'
            + '<div style="text-align:right;font-size:12px;color:var(--t2)">'+Utils.cur(p.costPrice,cur)+'</div>'
            + '<div style="text-align:right;font-size:13px;font-weight:700;color:var(--er)">'+Utils.cur(p.cost,cur)+'</div>'
            + '</div>';
        }).join('')
      + '<div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg3);font-weight:800;font-size:13px">'
      + '<span style="color:var(--t1)">TOTAL COGS</span><span style="color:var(--er);font-family:var(--fm)">'+Utils.cur(totalCOGS,cur)+'</span></div>'
      + '</div></div>' : '';

    // ── CASH AVAILABLE BREAKDOWN ─────────────────────────────────────────────
    function cashRow(label, val, color, note) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">'
        + '<div><span style="font-size:13px;color:var(--t2)">'+label+'</span>'+(note?'<div style="font-size:10px;color:var(--t3);margin-top:1px">'+note+'</div>':'')+'</div>'
        + '<span style="font-size:14px;font-weight:700;color:'+color+';font-family:var(--fm)">'+val+'</span>'
        + '</div>';
    }

    var cashHtml = '<div class="sec">'
      + '<div class="sec-title">💵 Cash Available Calculation</div>'
      + '<div class="card card-body">'
      + '<div style="font-size:10px;font-weight:800;color:var(--ok);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--bd)">CASH IN</div>'
      + cashRow('Cash Sales (Paid invoices)', Utils.cur(cashFromSales,cur), 'var(--ok)')
      + cashRow('Partial Payments Collected', Utils.cur(cashFromPartial,cur), 'var(--ok)', 'From partial/installment sales')
      + (debtCollected>0 ? cashRow('Debt Collections', Utils.cur(debtCollected,cur), 'var(--ok)', 'Balance payments from customers') : '')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;font-size:14px;border-top:1px solid var(--bd2);margin-top:4px">'
      + '<span style="color:var(--t1)">Total Cash In</span><span style="color:var(--ok);font-family:var(--fm)">'+Utils.cur(totalCashIn,cur)+'</span></div>'
      + '<div style="font-size:10px;font-weight:800;color:var(--er);text-transform:uppercase;letter-spacing:.1em;margin:14px 0 8px;padding-top:10px;border-top:1px solid var(--bd)">CASH OUT</div>'
      + cashRow('Expenses Paid', Utils.cur(expCashOut,cur), 'var(--er)')
      + (salaryPaid>0 ? cashRow('Salary Payments', Utils.cur(salaryPaid,cur), 'var(--er)') : '')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;font-size:14px;border-top:1px solid var(--bd2);margin-top:4px">'
      + '<span style="color:var(--t1)">Total Cash Out</span><span style="color:var(--er);font-family:var(--fm)">'+Utils.cur(totalCashOut,cur)+'</span></div>'
      + '<div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:900;font-size:18px;border-top:2px solid var(--in);margin-top:6px">'
      + '<span style="color:var(--t1)">CASH AVAILABLE</span><span style="color:var(--in);font-family:var(--fm)">'+Utils.cur(cashAvailable,cur)+'</span></div>'
      + (creditOutstanding>0 ? '<div style="font-size:11px;color:var(--wa);font-weight:600;margin-top:4px">⚠️ '+Utils.cur(creditOutstanding,cur)+' still owed by customers (not included in cash)</div>' : '')
      + '</div></div>';

    // ── PAYMENT METHOD BREAKDOWN ─────────────────────────────────────────────
    var payMax = Math.max.apply(null, Object.values(payMethods).concat([1]));
    var payHtml = '<div class="sec">'
      + '<div class="sec-title">💳 Collections by Payment Method</div>'
      + '<div class="card card-body">'
      + Object.keys(payMethods).filter(function(m){ return payMethods[m]>0; }).map(function(m){
          var pct = totalCashIn>0 ? Math.round((payMethods[m]/totalCashIn)*100) : 0;
          return '<div style="margin-bottom:12px">'
            + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
            + '<span style="color:var(--t2)">'+Utils.esc(m)+'</span>'
            + '<span style="color:var(--ok);font-weight:700">'+Utils.cur(payMethods[m],cur)+' · '+pct+'%</span></div>'
            + '<div class="progress" style="height:7px"><div class="progress-fill" style="width:'+pct+'%;background:var(--ok)"></div></div>'
            + '</div>';
        }).join('')
      + '</div></div>';

    // ── EXPENSE BREAKDOWN ────────────────────────────────────────────────────
    var expCats = {};
    expenses.forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });
    var expMax = Math.max.apply(null, Object.values(expCats).concat([1]));

    var expHtml = Object.keys(expCats).length ? '<div class="sec">'
      + '<div class="sec-title">💸 Expense Breakdown</div>'
      + '<div class="card card-body">'
      + Object.keys(expCats).sort(function(a,b){ return expCats[b]-expCats[a]; }).map(function(cat){
          var pct = manualExp>0 ? Math.round((expCats[cat]/manualExp)*100) : 0;
          return '<div style="margin-bottom:12px">'
            + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
            + '<span style="color:var(--t2)">'+Utils.esc(cat)+'</span>'
            + '<span style="color:var(--er);font-weight:700">'+Utils.cur(expCats[cat],cur)+' · '+pct+'%</span></div>'
            + '<div class="progress" style="height:7px"><div class="progress-fill" style="width:'+pct+'%;background:var(--er)"></div></div>'
            + '</div>';
        }).join('')
      + (allocTot>0 ? '<div style="border-top:1px solid var(--bd);padding-top:10px;margin-top:4px">'
          +'<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
          +'<span style="color:var(--wa)">Allocated (recurring daily)</span>'
          +'<span style="color:var(--wa);font-weight:700">'+Utils.cur(allocTot,cur)+'/day</span></div>'
          +'</div>' : '')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:6px;border-top:2px solid var(--bd2);font-weight:800;font-size:14px">'
      + '<span style="color:var(--t1)">Grand Total Expenses</span>'
      + '<span style="color:var(--er);font-family:var(--fm)">'+Utils.cur(totalExp,cur)+'</span></div>'
      + '</div></div>' : '';

    // ── REVENUE TREND ────────────────────────────────────────────────────────
    var chartHtml = '<div class="sec"><div class="chart-wrap">'
      + '<div class="chart-title">Revenue Trend (6 Months)</div>'
      + '<div class="chart-sub">'+cur+' monthly breakdown</div>'
      + Charts.monthBars(sales,'gold')+'</div></div>';

    // ── SALARY SUMMARY ───────────────────────────────────────────────────────
    var salHtml = '';
    if (salaryPaid > 0) {
      var emps = DB.getEmployees();
      salHtml = '<div class="sec">'
        + '<div class="sec-title">👔 Salary Summary</div>'
        + '<div class="card card-body">'
        + '<div class="report-row"><span class="report-label">Total Salary Paid</span><span class="report-val err">'+Utils.cur(salaryPaid,cur)+'</span></div>'
        + '<div class="report-row"><span class="report-label">Employees</span><span class="report-val">'+emps.length+'</span></div>'
        + '<div class="report-row"><span class="report-label">Monthly Payroll Budget</span><span class="report-val gold">'+Utils.cur(emps.reduce(function(a,e){ return a+(parseFloat(e.salary)||0); },0),cur)+'</span></div>'
        + '</div></div>';
    }

    // ── SUMMARY STATS ROW ────────────────────────────────────────────────────
    var statsHtml = '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">📦</div><div class="kpi-label">Invoices</div><div class="kpi-value">'+sales.length+'</div></div>'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">💳</div><div class="kpi-label">Avg Sale</div><div class="kpi-value">'+Utils.cur(sales.length?totalSales/sales.length:0,cur)+'</div></div>'
      + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">⏳</div><div class="kpi-label">Outstanding</div><div class="kpi-value">'+Utils.cur(creditOutstanding,cur)+'</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">👥</div><div class="kpi-label">Customers</div><div class="kpi-value">'+DB.getCustomers().length+'</div></div>'
      + '</div></div>';

    // ── ASSEMBLE ─────────────────────────────────────────────────────────────
    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Finance</div><div class="page-sub">Cash &amp; Profit Summary · All time</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Finance.printSummary()">🖨 Print</button></div>'
      + '</div>'
      + heroCards
      + plHtml
      + cogsHtml
      + cashHtml
      + payHtml
      + expHtml
      + chartHtml
      + salHtml
      + statsHtml;
  },

  // ── HERO CARD HELPER ───────────────────────────────────────────────────────
  _heroCard: function(icon, label, value, sub, color, bg, textColor) {
    return '<div style="background:'+bg+';border:1px solid '+color+'28;border-radius:var(--r14);padding:15px 13px;position:relative;overflow:hidden">'
      + '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'+color+'"></div>'
      + '<div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;font-family:var(--fm)">'+label+'</div>'
      + '<div style="font-size:20px;font-weight:900;color:'+textColor+';letter-spacing:-.02em;line-height:1">'+value+'</div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:5px">'+sub+'</div>'
      + '</div>';
  },

  // ── PRINT CASH & PROFIT SUMMARY ───────────────────────────────────────────
  printSummary: function() {
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var now      = new Date();
    var sales    = DB.getSales();
    var expenses = DB.getExpenses();
    var payroll  = DB.getPayroll();
    var allocs   = DB.getAllocatedDaily();
    var allocTot = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);

    var totalSales = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var totalCOGS  = sales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0); }, 0);
    var grossProfit= totalSales - totalCOGS;
    var manualExp  = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var totalExp   = manualExp + allocTot;
    var netProfit  = grossProfit - totalExp;
    var cashFromSales  = sales.filter(function(s){ return s.status==='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var cashFromPart   = sales.filter(function(s){ return s.status==='Partial'; }).reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); }, 0);
    var salaryPaid     = payroll.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); }, 0);
    var cashAvailable  = cashFromSales + cashFromPart - manualExp - salaryPaid;

    var css = 'body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:20px;max-width:700px;margin:0 auto}'
      + 'h1{font-size:22px;font-weight:900;margin:0 0 2px}h2{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #111;padding-bottom:4px;margin:18px 0 8px}'
      + '.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}'
      + '.card{background:#f9f9f9;border:1px solid #ddd;padding:14px;border-radius:4px;border-top:3px solid #ccc}'
      + '.card-gold{border-top-color:#c9a84c}.card-green{border-top-color:#16a34a}.card-blue{border-top-color:#2563eb}.card-er{border-top-color:#dc2626}'
      + '.card label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#666;display:block;margin-bottom:4px}'
      + '.card .val{font-size:20px;font-weight:900}.card .sub{font-size:11px;color:#888;margin-top:2px}'
      + 'table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#f0f0f0;border:1px solid #ccc;padding:7px;text-align:left;font-size:12px}'
      + 'td{border:1px solid #ddd;padding:7px;font-size:12px}.right{text-align:right}.bold{font-weight:700}'
      + '.total-row{background:#f5f5f5;font-weight:700}.green{color:#16a34a}.red{color:#dc2626}.gold{color:#c9a84c}.blue{color:#2563eb}'
      + '.sig-line{display:flex;justify-content:space-between;margin-top:36px}'
      + '.sig{flex:1;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#444;margin-right:20px}'
      + '@media print{@page{size:A4;margin:12mm}}';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Finance Summary</title><style>'+css+'</style></head><body>'
      + '<div style="text-align:center;margin-bottom:10px">'
      + (settings.bizLogo?'<img src="'+settings.bizLogo+'" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #ddd;margin-bottom:6px"><br>':'')
      + '<strong style="font-size:20px">'+Utils.esc(bizName)+'</strong><br>'
      + (settings.bizAddress?'<span style="font-size:11px;color:#555">'+Utils.esc(settings.bizAddress)+'</span><br>':'')
      + (settings.bizPhone?'<span style="font-size:11px;color:#555">Tel: '+Utils.esc(settings.bizPhone)+'</span><br>':'')
      + '</div>'
      + '<div style="text-align:center;color:#555;font-size:12px">Cash &amp; Profit Summary</div>'
      + '<div style="color:#666;font-size:11px">Generated: '+now.toLocaleString()+'</div>'
      + '<h2>Key Numbers</h2>'
      + '<div class="summary">'
      + '<div class="card card-gold"><label>Total Sales</label><div class="val gold">'+Utils.cur(totalSales,cur)+'</div><div class="sub">'+sales.length+' invoices</div></div>'
      + '<div class="card card-blue"><label>Cash Available</label><div class="val blue">'+Utils.cur(cashAvailable,cur)+'</div><div class="sub">Actual cash</div></div>'
      + '<div class="card card-green"><label>Gross Profit</label><div class="val green">'+Utils.cur(grossProfit,cur)+'</div><div class="sub">After COGS</div></div>'
      + '<div class="card '+(netProfit>=0?'card-green':'card-er')+'"><label>Net Profit</label><div class="val '+(netProfit>=0?'green':'red')+'">'+Utils.cur(netProfit,cur)+'</div><div class="sub">After all expenses</div></div>'
      + '</div>'
      + '<h2>Profit &amp; Loss</h2>'
      + '<table><thead><tr><th>Description</th><th class="right">Amount</th></tr></thead><tbody>'
      + '<tr><td>Total Sales Revenue</td><td class="right bold green">'+Utils.cur(totalSales,cur)+'</td></tr>'
      + '<tr><td>Less: Cost of Goods Sold</td><td class="right red">('+Utils.cur(totalCOGS,cur)+')</td></tr>'
      + '<tr class="total-row"><td>Gross Profit</td><td class="right green">'+Utils.cur(grossProfit,cur)+'</td></tr>'
      + '<tr><td>Less: Manual Expenses</td><td class="right red">('+Utils.cur(manualExp,cur)+')</td></tr>'
      + (allocTot>0?'<tr><td>Less: Allocated Expenses</td><td class="right" style="color:#b45309">('+Utils.cur(allocTot,cur)+')</td></tr>':'')
      + '<tr class="total-row"><td class="bold">NET PROFIT</td><td class="right bold '+(netProfit>=0?'green':'red')+'">'+Utils.cur(netProfit,cur)+'</td></tr>'
      + '</tbody></table>'
      + '<h2>Cash Available</h2>'
      + '<table><thead><tr><th>Description</th><th class="right">Amount</th></tr></thead><tbody>'
      + '<tr><td>Cash Sales Collected</td><td class="right green">'+Utils.cur(cashFromSales,cur)+'</td></tr>'
      + (cashFromPart>0?'<tr><td>Partial Payments Collected</td><td class="right green">'+Utils.cur(cashFromPart,cur)+'</td></tr>':'')
      + '<tr><td>Less: Expenses Paid</td><td class="right red">('+Utils.cur(manualExp,cur)+')</td></tr>'
      + (salaryPaid>0?'<tr><td>Less: Salary Paid</td><td class="right red">('+Utils.cur(salaryPaid,cur)+')</td></tr>':'')
      + '<tr class="total-row"><td class="bold">Cash Available</td><td class="right bold blue">'+Utils.cur(cashAvailable,cur)+'</td></tr>'
      + '</tbody></table>'
      + '<div class="sig-line">'
      + '<div class="sig">Prepared by: _________________________&nbsp;&nbsp;Date: ___________</div>'
      + '<div class="sig">Approved by: _________________________&nbsp;&nbsp;Date: ___________</div>'
      + '</div>'
      + '<div style="text-align:center;font-size:10px;color:#888;margin-top:20px;border-top:1px solid #ddd;padding-top:10px">SmartStock Pro · '+Utils.esc(bizName)+' · '+now.toLocaleDateString()+'</div>'
      + '</body></html>';

    if (typeof Sales !== 'undefined' && Sales._printHtml) {
      Sales._printHtml(html, 'finance-print-frame');
    } else {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
      setTimeout(function(){ try{f.contentWindow.print();}catch(e){ window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank'); } }, 600);
    }
  },
};


/* === reports.js === */
var Reports = {
  period: 'month',
  dailyDate: '',
  view: 'financial', // 'financial' or 'daily'

  // ══════════════════════════════════════════════════════════════
  // MAIN RENDER — switches between Financial and Daily Report
  // ══════════════════════════════════════════════════════════════
  render: function() {
    var pg = Utils.get('pg-reports');
    if (!pg) return;
    if (!this.dailyDate) this.dailyDate = Utils.today();
    if (this.view === 'daily') {
      this.renderDailyView(pg);
    } else {
      this.renderFinancialView(pg);
    }
  },

  // ══════════════════════════════════════════════════════════════
  // FINANCIAL REPORT VIEW
  // ══════════════════════════════════════════════════════════════
  renderFinancialView: function(pg) {
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var sales    = DB.getSales();
    var expenses = DB.getExpenses();
    var today    = Utils.today();
    var month    = today.slice(0, 7);
    var weekDate = new Date(); weekDate.setDate(weekDate.getDate() - 6);
    var weekStr  = weekDate.toISOString().slice(0, 10);
    var user     = Auth.currentUser || {};
    var role     = (user.role || 'owner').toLowerCase();
    var canSeeMoney = role === 'owner' || role === 'admin' || role === 'primary admin' || role === 'manager';
    var mask = '— — —';

    // Date range for current period
    var filtered, expFiltered, fromStr, toStr;
    if (this.period === 'today') {
      fromStr = today; toStr = today;
      filtered    = sales.filter(function(s){ return s.date === today; });
      expFiltered = expenses.filter(function(e){ return e.date === today; });
    } else if (this.period === 'week') {
      fromStr = weekStr; toStr = today;
      filtered    = sales.filter(function(s){ return s.date >= weekStr && s.date <= today; });
      expFiltered = expenses.filter(function(e){ return e.date >= weekStr && e.date <= today; });
    } else if (this.period === 'month') {
      fromStr = month + '-01'; toStr = today;
      filtered    = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
      expFiltered = expenses.filter(function(e){ return e.date && e.date.startsWith(month); });
    } else if (this.period === 'year') {
      var yr = today.slice(0,4);
      fromStr = yr + '-01-01'; toStr = today;
      filtered    = sales.filter(function(s){ return s.date && s.date.startsWith(yr); });
      expFiltered = expenses.filter(function(e){ return e.date && e.date.startsWith(yr); });
    } else {
      fromStr = month + '-01'; toStr = today;
      filtered    = sales.filter(function(s){ return s.date && s.date.startsWith(month); });
      expFiltered = expenses.filter(function(e){ return e.date && e.date.startsWith(month); });
    }

    // ── Revenue & Profit ──
    var rev     = filtered.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var cogs    = filtered.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost||0)*parseInt(i.qty||1)); },0); }, 0);
    var gross   = rev - cogs;
    var manExp  = expFiltered.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var allocs  = DB.getAllocatedDaily();
    var allocDay= allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    // Count days in period for total allocation
    var pDays   = Math.max(1, Math.round((new Date(toStr) - new Date(fromStr)) / 86400000) + 1);
    var allocTot= allocDay * pDays;
    var totalExp= manExp + allocTot;
    var net     = rev - totalExp;
    var margin  = rev > 0 ? (net/rev*100).toFixed(1) : '0.0';

    // ── Payment method breakdown ──
    var payMethods = {};
    filtered.forEach(function(s){
      var m = s.payment || 'Cash';
      payMethods[m] = (payMethods[m]||0) + (parseFloat(s.total)||0);
    });

    // ── Top products ──
    var prodMap = {};
    filtered.forEach(function(s){
      (s.items||[]).forEach(function(item){
        if (!prodMap[item.name]) prodMap[item.name] = {qty:0,rev:0};
        prodMap[item.name].qty += parseInt(item.qty)||1;
        prodMap[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var topProds = Object.keys(prodMap).map(function(k){ return {name:k,qty:prodMap[k].qty,rev:prodMap[k].rev}; })
      .sort(function(a,b){ return b.rev-a.rev; }).slice(0,10);

    // ── Top customers ──
    var custMap = {};
    filtered.forEach(function(s){
      var key = s.customer||'Walk-in';
      if (!custMap[key]) custMap[key] = {spent:0,debt:0};
      custMap[key].spent += parseFloat(s.total)||0;
      if (s.status!=='Paid') custMap[key].debt += parseFloat(s.balance)||0;
    });
    var topCusts = Object.keys(custMap).map(function(k){ return {name:k,spent:custMap[k].spent,debt:custMap[k].debt}; })
      .sort(function(a,b){ return b.spent-a.spent; }).slice(0,10);

    // ── Expense breakdown by category ──
    var expCats = {};
    expFiltered.forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });
    var expCatMax = Math.max.apply(null, Object.values(expCats).concat([1]));

    // ── Debtors ──
    var debtSales = sales.filter(function(s){ return s.status!=='Paid'; });
    var debtMap = {};
    debtSales.forEach(function(s){
      var key = s.customer||'Walk-in';
      if (!debtMap[key]) debtMap[key] = {total:0, oldest:s.date};
      debtMap[key].total += parseFloat(s.balance)||0;
      if (s.date < debtMap[key].oldest) debtMap[key].oldest = s.date;
    });
    var debtors = Object.keys(debtMap).map(function(k){ return {name:k,total:debtMap[k].total,oldest:debtMap[key=k].oldest}; })
      .sort(function(a,b){ return b.total-a.total; });
    var totalDebt = debtors.reduce(function(a,d){ return a+d.total; },0);

    // ── Suppliers ──
    var suppliers = DB.getSuppliers();
    var suppDebt = suppliers.filter(function(s){ return (parseFloat(s.balance)||0) > 0; });
    var totalSuppDebt = suppDebt.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    // ── Period chips ──
    var periods = [['today','Today'],['week','This Week'],['month','This Month'],['year','This Year']];
    var chips = periods.map(function(p){
      return '<div class="chip'+(Reports.period===p[0]?' active':'')+'" onclick="Reports.setPeriod(\''+p[0]+'\')">' + p[1] + '</div>';
    }).join('');

    // ── P&L Table ──
    function plRow(label, val, color, bold) {
      var style = 'display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)';
      if (bold) style += ';margin-top:4px;padding-top:10px;border-top:2px solid var(--bd2)';
      return '<div style="'+style+'">'
        + '<span style="font-size:13px;color:var(--t2);'+(bold?'font-weight:800;color:var(--t1)':'')+'">' + label + '</span>'
        + '<span style="font-size:'+(bold?'16':'14')+'px;font-weight:'+(bold?'900':'700')+';color:'+color+';font-family:var(--fm)">'+(canSeeMoney?val:mask)+'</span>'
        + '</div>';
    }

    var plHtml = '<div class="sec">'
      + '<div class="sec-title">📊 Profit &amp; Loss</div>'
      + '<div class="card card-body">'
      + plRow('Gross Revenue', Utils.cur(rev,cur), 'var(--ok)')
      + plRow('Cost of Goods Sold', '('+Utils.cur(cogs,cur)+')', 'var(--er)')
      + plRow('GROSS PROFIT', Utils.cur(gross,cur), gross>=0?'var(--ok)':'var(--er)', true)
      + plRow('Manual Expenses', '('+Utils.cur(manExp,cur)+')', 'var(--er)')
      + plRow('Allocated Expenses', '('+Utils.cur(allocTot,cur)+')', 'var(--wa)')
      + plRow('Total Expenses', '('+Utils.cur(totalExp,cur)+')', 'var(--er)')
      + plRow('NET PROFIT', Utils.cur(net,cur)+' ('+margin+'%)', net>=0?'var(--g)':'var(--er)', true)
      + '</div></div>';

    // ── KPI Cards ──
    var kpis = '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">💰</div><div class="kpi-label">Revenue</div><div class="kpi-value">'+(canSeeMoney?Utils.cur(rev,cur):mask)+'</div><div class="kpi-sub">'+filtered.length+' sales</div></div>'
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)"><div class="kpi-icon">💸</div><div class="kpi-label">Expenses</div><div class="kpi-value">'+(canSeeMoney?Utils.cur(totalExp,cur):mask)+'</div></div>'
      + '<div class="kpi" style="--kc:'+(net>=0?'var(--ok)':'var(--er)')+';--kibg:'+(net>=0?'var(--okb)':'var(--erb)')+'"><div class="kpi-icon">'+(net>=0?'📈':'📉')+'</div><div class="kpi-label">Net Profit</div><div class="kpi-value">'+(canSeeMoney?Utils.cur(net,cur):mask)+'</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📊</div><div class="kpi-label">Margin</div><div class="kpi-value">'+(canSeeMoney?margin+'%':mask)+'</div></div>'
      + '</div></div>';

    // ── Revenue chart ──
    var chartHtml = '<div class="sec"><div class="chart-wrap">'
      + '<div class="chart-title">Revenue Trend</div>'
      + '<div class="chart-sub">'+cur+' breakdown</div>'
      + Charts.weekBars(sales)
      + '</div></div>';

    // ── Payment methods ──
    var payTotal = Object.values(payMethods).reduce(function(a,v){ return a+v; }, 0) || 1;
    var payHtml = '<div class="sec"><div class="sec-title">💳 Sales by Payment Method</div>'
      + '<div class="card card-body">'
      + Object.keys(payMethods).map(function(m){
          var pct = Math.round((payMethods[m]/payTotal)*100);
          return '<div style="margin-bottom:10px">'
            + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
            + '<span style="color:var(--t2)">'+Utils.esc(m)+'</span>'
            + '<span style="color:var(--t1);font-weight:700">'+(canSeeMoney?Utils.cur(payMethods[m],cur):mask)+' · '+pct+'%</span></div>'
            + '<div class="progress" style="height:6px"><div class="progress-fill" style="width:'+pct+'%;background:var(--g)"></div></div>'
            + '</div>';
        }).join('')
      + '</div></div>';

    // ── Top products ──
    var topProdHtml = '<div class="sec"><div class="sec-title">🏆 Top Products</div>'
      + (topProds.length ? '<div class="card card-body">'
          + topProds.map(function(p,i){
              var medals=['🥇','🥈','🥉'];
              return '<div class="report-row"><span class="report-label">'+(medals[i]||((i+1)+'.'))+' '+Utils.esc(p.name)+'<span style="font-size:10px;color:var(--t3);margin-left:6px">'+p.qty+' units</span></span>'
                + '<span class="report-val gold">'+(canSeeMoney?Utils.cur(p.rev,cur):mask)+'</span></div>';
            }).join('')
          + '</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon">📦</div><div class="empty-title">No sales this period</div></div>')
      + '</div>';

    // ── Top customers ──
    var topCustHtml = '<div class="sec"><div class="sec-title">👥 Top Customers</div>'
      + (topCusts.length ? '<div class="card card-body">'
          + topCusts.map(function(c,i){
              return '<div class="report-row">'
                + '<span class="report-label">'+(i+1)+'. '+Utils.esc(c.name)
                + (c.debt>0?'<span style="font-size:10px;color:var(--wa);margin-left:6px">Owes '+Utils.cur(c.debt,cur)+'</span>':'')
                +'</span>'
                + '<span class="report-val gold">'+(canSeeMoney?Utils.cur(c.spent,cur):mask)+'</span></div>';
            }).join('')
          + '</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon">👥</div><div class="empty-title">No customers this period</div></div>')
      + '</div>';

    // ── Expense breakdown ──
    var expBreakHtml = canSeeMoney ? '<div class="sec"><div class="sec-title">💸 Expense Breakdown</div>'
      + (Object.keys(expCats).length ? '<div class="card card-body">'
          + Object.keys(expCats).sort(function(a,b){ return expCats[b]-expCats[a]; }).map(function(cat){
              var pct = Math.round((expCats[cat]/manExp)*100) || 0;
              return '<div style="margin-bottom:10px">'
                + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">'
                + '<span style="color:var(--t2)">'+Utils.esc(cat)+'</span>'
                + '<span style="color:var(--er);font-weight:700">'+Utils.cur(expCats[cat],cur)+' · '+pct+'%</span></div>'
                + '<div class="progress" style="height:5px"><div class="progress-fill" style="width:'+pct+'%;background:var(--er)"></div></div>'
                + '</div>';
            }).join('')
          + (allocTot>0?'<div style="border-top:1px solid var(--bd);padding-top:8px;margin-top:4px">'
              + '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--wa)">Allocated (recurring)</span><span style="color:var(--wa);font-weight:700">'+Utils.cur(allocTot,cur)+'</span></div>'
              + '</div>':'')
          + '</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon">💸</div><div class="empty-title">No expenses this period</div></div>')
      + '</div>' : '';

    // ── Debtors ──
    var now = new Date();
    var debtHtml = canSeeMoney ? '<div class="sec"><div class="sec-title">💳 Outstanding Debts <span style="color:var(--t3);font-weight:400;font-size:11px">'+debtors.length+' customers · '+Utils.cur(totalDebt,cur)+'</span></div>'
      + (debtors.length ? '<div class="card">'
          + debtors.map(function(d){
              var days = Math.round((now - new Date(d.oldest)) / 86400000);
              var dc = days > 30 ? 'var(--er)' : days > 7 ? 'var(--wa)' : 'var(--in)';
              return '<div class="list-item">'
                + '<div class="list-info"><div class="list-name">'+Utils.esc(d.name)+'</div>'
                + '<div class="list-meta">Oldest: '+Utils.date(d.oldest)+' · '+days+' days ago</div></div>'
                + '<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(d.total,cur)+'</div>'
                + '<span style="font-size:9px;padding:2px 7px;border-radius:99px;background:'+dc+'18;color:'+dc+';border:1px solid '+dc+'40;font-weight:700">'+(days>30?'OVERDUE':days>7?'FOLLOW UP':'RECENT')+'</span>'
                + '</div></div>';
            }).join('')
          + '</div>'
        : '<div style="padding:12px 14px;color:var(--ok);font-weight:600;font-size:13px;background:var(--okb);border-radius:var(--r10)">✓ No outstanding debts</div>')
      + '</div>' : '';

    // ── Suppliers ──
    var suppHtml = canSeeMoney && suppDebt.length ? '<div class="sec"><div class="sec-title">🏭 Supplier Payables · '+Utils.cur(totalSuppDebt,cur)+'</div>'
      + '<div class="card">'
      + suppDebt.map(function(s){
          return '<div class="list-item"><div class="list-info"><div class="list-name">'+Utils.esc(s.name)+'</div>'
            +'<div class="list-meta">'+(s.dueDate?'Due: '+Utils.date(s.dueDate):'No due date')+'</div></div>'
            +'<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(s.balance,cur)+'</div></div></div>';
        }).join('')
      + '</div></div>' : '';

    // ── Export buttons ──
    var exportHtml = canSeeMoney ? '<div class="sec" style="display:flex;gap:8px">'
      + '<button class="btn-ghost" style="flex:1;font-size:12px" onclick="Reports.exportCSV()">📥 Export CSV</button>'
      + '<button class="btn-ghost" style="flex:1;font-size:12px" onclick="Reports.switchToDaily()">📅 Daily Report</button>'
      + '</div>' : '';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Reports</div><div class="page-sub">Financial performance</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Reports.switchToDaily()">📅 Daily</button></div>'
      + '</div>'
      + '<div class="chips">'+chips+'</div>'
      + kpis + plHtml + chartHtml + payHtml + topProdHtml + topCustHtml + expBreakHtml + debtHtml + suppHtml + exportHtml;
  },

  // ══════════════════════════════════════════════════════════════
  // DAILY REPORT VIEW — in-app viewer with date picker
  // ══════════════════════════════════════════════════════════════
  renderDailyView: function(pg) {
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var d        = this.dailyDate;
    var user     = Auth.currentUser || {};
    var sales    = DB.getSales().filter(function(s){ return s.date === d; });
    var expenses = DB.getExpenses().filter(function(e){ return e.date === d; });
    var allocs   = DB.getAllocatedDaily();
    var allocDay = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    var rev      = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var manExp   = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var net      = rev - manExp - allocDay;
    var hasData  = sales.length > 0 || expenses.length > 0;

    // Payment method totals
    var payTotals = {};
    sales.forEach(function(s){ var m=s.payment||'Cash'; payTotals[m]=(payTotals[m]||0)+(parseFloat(s.total)||0); });

    // Credit sales
    var creditSales = sales.filter(function(s){ return s.status!=='Paid'; });
    var creditAmt   = creditSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); }, 0);
    var allCustomers= DB.getCustomers();

    // Products sold summary
    var prodSold = {};
    sales.forEach(function(s){
      (s.items||[]).forEach(function(item){
        if (!prodSold[item.name]) prodSold[item.name] = {qty:0,rev:0,price:item.price,cat:''};
        prodSold[item.name].qty += parseInt(item.qty)||1;
        prodSold[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });

    // Low stock
    var products  = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var lowStock  = products.filter(function(p){ return p.qty<=(p.lowLevel||5); });

    // Navigation dates
    var prevDate = new Date(d); prevDate.setDate(prevDate.getDate()-1);
    var nextDate = new Date(d); nextDate.setDate(nextDate.getDate()+1);
    var prevStr  = prevDate.toISOString().slice(0,10);
    var nextStr  = nextDate.toISOString().slice(0,10);
    var today    = Utils.today();
    var isToday  = d === today;

    // Full date label
    var dateObj  = new Date(d + 'T12:00:00');
    var fullDate = dateObj.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

    // ── Date picker bar ──
    var pickerHtml = '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px 0">'
      + '<button class="btn-ghost btn-sm" onclick="Reports.shiftDay(-1)">← Prev</button>'
      + '<input type="date" value="'+d+'" onchange="Reports.setDailyDate(this.value)"'
      + ' style="flex:1;background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r8);padding:8px 10px;font-size:13px;color:var(--t1);text-align:center">'
      + '<button class="btn-ghost btn-sm" '+(isToday?'disabled style="opacity:.4"':'')+' onclick="Reports.shiftDay(1)">Next →</button>'
      + '</div>'
      + '<div style="text-align:center;font-size:12px;color:var(--t2);padding:6px 14px 0">'+fullDate+'</div>';

    if (!hasData) {
      pg.innerHTML = '<div class="page-header">'
        + '<div><div class="page-title">Daily Report</div><div class="page-sub">'+fullDate+'</div></div>'
        + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Reports.switchToFinancial()">← Financial</button></div>'
        + '</div>'
        + pickerHtml
        + '<div class="empty" style="padding:48px 24px"><div class="empty-icon">📋</div>'
        + '<div class="empty-title">No data for this date</div>'
        + '<div class="empty-sub">No sales or expenses were recorded on '+fullDate+'</div></div>';
      return;
    }

    // ── Section: Profit Summary ──
    var summaryRows = '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd);font-size:13px">'
      + '<span style="color:var(--t2)">Gross Sales</span><span style="color:var(--ok);font-weight:700">'+Utils.cur(rev,cur)+'</span></div>'
      + (manExp>0?'<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd);font-size:13px">'
        + '<span style="color:var(--t2)">Manual Expenses</span><span style="color:var(--er);font-weight:700">-'+Utils.cur(manExp,cur)+'</span></div>':'')
      + (allocDay>0?'<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd);font-size:13px">'
        + '<span style="color:var(--wa)">Allocated Expenses</span><span style="color:var(--wa);font-weight:700">-'+Utils.cur(allocDay,cur)+'/day</span></div>':'')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:900;border-top:2px solid var(--bd2);margin-top:4px">'
      + '<span style="color:var(--t1)">NET PROFIT</span><span style="color:'+(net>=0?'var(--g)':'var(--er)')+'">'+Utils.cur(net,cur)+'</span></div>';

    var summaryStats = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">'
      + '<div style="background:var(--bg3);border-radius:var(--r8);padding:10px;text-align:center">'
      + '<div style="font-size:18px;font-weight:800;color:var(--in)">'+sales.length+'</div><div style="font-size:10px;color:var(--t3)">TRANSACTIONS</div></div>'
      + '<div style="background:var(--bg3);border-radius:var(--r8);padding:10px;text-align:center">'
      + '<div style="font-size:14px;font-weight:800;color:var(--g)">'+(sales.length>0?Utils.cur(rev/sales.length,cur):'—')+'</div><div style="font-size:10px;color:var(--t3)">AVG SALE</div></div>'
      + '</div>'
      + '<div style="margin-top:8px">'
      + Object.keys(payTotals).map(function(m){
          return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">'
            + '<span style="color:var(--t3)">'+Utils.esc(m)+'</span><span style="color:var(--t2);font-weight:600">'+Utils.cur(payTotals[m],cur)+'</span></div>';
        }).join('')
      + (creditAmt>0?'<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">'
        +'<span style="color:var(--wa)">Credit (not yet paid)</span><span style="color:var(--wa);font-weight:600">'+Utils.cur(creditAmt,cur)+'</span></div>':'')
      + '</div>';

    var profSec = '<div class="sec"><div class="sec-title">💰 Daily Profit Summary</div>'
      + '<div class="card card-body">'+summaryRows+summaryStats+'</div></div>';

    // ── Section: Sales list ──
    var salesRows = sales.map(function(s){
      var itemNames = (s.items||[]).map(function(i){ return Utils.esc(i.name)+' ×'+i.qty; }).join(', ');
      if (itemNames.length > 50) itemNames = itemNames.slice(0,48)+'…';
      var bc = s.status==='Paid'?'var(--ok)':s.status==='Partial'?'var(--wa)':'var(--er)';
      return '<div class="list-item">'
        + '<div class="list-icon" style="background:var(--gb3)">🧾</div>'
        + '<div class="list-info"><div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
        + '<div class="list-meta" style="font-family:var(--fm)">'+s.id+'</div>'
        + (itemNames?'<div class="list-meta" style="font-size:10px">'+itemNames+'</div>':'')
        + '</div>'
        + '<div class="list-right"><div class="list-val">'+Utils.cur(s.total,cur)+'</div>'
        + '<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:'+bc+'18;color:'+bc+';border:1px solid '+bc+'40;font-weight:700">'+((s.status||'PAID').toUpperCase())+'</span>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'+Utils.esc(s.payment||'Cash')+'</div>'
        + '</div></div>';
    }).join('');

    var salesSec = '<div class="sec"><div class="sec-title">🧾 Sales Transactions ('+sales.length+')</div>'
      + (sales.length ? '<div class="card">'+salesRows+'</div>'
        : '<div class="empty" style="padding:20px"><div class="empty-icon">🧾</div><div class="empty-title">No sales today</div></div>')
      + '</div>';

    // ── Section: Products sold ──
    var prodKeys = Object.keys(prodSold).sort(function(a,b){ return prodSold[b].rev-prodSold[a].rev; });
    var totalUnits = prodKeys.reduce(function(a,k){ return a+prodSold[k].qty; }, 0);
    var prodSec = '<div class="sec"><div class="sec-title">📦 Products Sold ('+totalUnits+' units)</div>'
      + (prodKeys.length ? '<div class="card card-body">'
          + prodKeys.map(function(k){
              var p = prodSold[k];
              return '<div class="report-row"><span class="report-label">'+Utils.esc(k)+'<span style="font-size:10px;color:var(--t3);margin-left:6px">×'+p.qty+'</span></span>'
                + '<span class="report-val gold">'+Utils.cur(p.rev,cur)+'</span></div>';
            }).join('')
          + '</div>'
        : '<div class="empty" style="padding:16px"><div class="empty-title" style="font-size:13px">No products sold</div></div>')
      + '</div>';

    // ── Section: Expenses ──
    var expRows = expenses.map(function(e){
      return '<div class="list-item"><div class="list-icon" style="background:var(--erb)">💸</div>'
        + '<div class="list-info"><div class="list-name">'+Utils.esc(e.description||e.category)+'</div>'
        + '<div class="list-meta">'+Utils.esc(e.category)+'</div></div>'
        + '<div class="list-right"><div class="list-val" style="color:var(--er)">'+Utils.cur(e.amount,cur)+'</div></div></div>';
    }).join('');

    var allocRows = allocs.map(function(a){
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(245,158,11,.1)">'
        + '<span style="font-size:16px">🔒</span>'
        + '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(a.name)+'</div>'
        + '<div style="font-size:11px;color:var(--wa)">'+Utils.esc(a.periodLabel||'Allocated')+'</div></div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--wa)">'+Utils.cur(a.daily,cur)+'/day</div></div>';
    }).join('');

    var expSec = '<div class="sec"><div class="sec-title">💸 Expenses</div>'
      + (expenses.length?'<div class="card">'+expRows+'</div>':'')
      + (manExp>0?'<div style="display:flex;justify-content:space-between;padding:8px 14px;font-weight:700;font-size:13px"><span style="color:var(--t2)">Manual Total</span><span style="color:var(--er)">'+Utils.cur(manExp,cur)+'</span></div>':'')
      + (allocs.length?'<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;color:var(--wa);text-transform:uppercase;letter-spacing:.1em;padding:0 2px 6px">🔒 Allocated (daily share)</div>'
        +'<div style="background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.18);border-radius:var(--r10);overflow:hidden">'+allocRows+'</div>'
        +'<div style="display:flex;justify-content:space-between;padding:8px 2px;font-weight:700;font-size:13px"><span style="color:var(--wa)">Allocated Total</span><span style="color:var(--wa)">'+Utils.cur(allocDay,cur)+'</span></div>'
        +'</div>':'')
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;font-size:14px;border-top:2px solid var(--bd2);margin-top:4px"><span style="color:var(--t1)">Grand Total</span><span style="color:var(--er)">'+Utils.cur(manExp+allocDay,cur)+'</span></div>'
      + '</div>';

    // ── Section: Credit summary ──
    var creditSec = creditSales.length ? '<div class="sec"><div class="sec-title">💳 Credit Sales Today</div>'
      + '<div class="card">'
      + creditSales.map(function(s){
          var cust = allCustomers.find(function(c){ return c.id===s.customerId; });
          var totalOwed = cust ? cust.totalSpent - DB.getSales().filter(function(x){ return x.customerId===cust.id&&x.status==='Paid'; }).reduce(function(a,x){ return a+(parseFloat(x.total)||0); },0) : (parseFloat(s.balance)||0);
          return '<div class="list-item"><div class="list-icon" style="background:var(--wab)">👤</div>'
            + '<div class="list-info"><div class="list-name">'+Utils.esc(s.customer||'Walk-in')+'</div>'
            + '<div class="list-meta">'+s.id+' · Balance: '+Utils.cur(s.balance||0,cur)+'</div></div>'
            + '<div class="list-right"><div class="list-val" style="color:var(--wa)">'+Utils.cur(s.total,cur)+'</div>'
            + '<div style="font-size:10px;color:var(--er);margin-top:2px">Owes: '+Utils.cur(s.balance||0,cur)+'</div></div></div>';
        }).join('')
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:13px"><span style="color:var(--t2)">New credit today</span><span style="color:var(--wa)">'+Utils.cur(creditAmt,cur)+'</span></div>'
      + '</div>' : '';

    // ── Section: Low stock warning ──
    var lowSec = lowStock.length ? '<div class="sec">'
      + '<div style="padding:12px 14px;background:var(--wab);border:1px solid var(--wabd);border-radius:var(--r10);font-size:13px;color:var(--wa);font-weight:600">'
      + '⚠️ '+lowStock.length+' product'+(lowStock.length!==1?'s':'')+' need reordering — '
      + '<span style="cursor:pointer;text-decoration:underline" onclick="Router.go(\'products\')">view stock list</span>'
      + '</div></div>' : '';

    // ── Action buttons ──
    var actionHtml = '<div class="sec" style="display:flex;gap:8px">'
      + '<button class="btn-ghost" style="flex:1;font-size:12px" onclick="Reports.switchToFinancial()">← Financial</button>'
      + '<button class="btn-primary" style="flex:1;font-size:12px" onclick="Reports.printDailyReport()">🖨 Print Report</button>'
      + '</div>';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Daily Report</div><div class="page-sub">'+fullDate+'</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Reports.switchToFinancial()">← Back</button></div>'
      + '</div>'
      + pickerHtml
      + profSec + salesSec + prodSec + expSec + creditSec + lowSec + actionHtml;
  },

  // ══════════════════════════════════════════════════════════════
  // PRINT — Full professional daily report
  // ══════════════════════════════════════════════════════════════
  printDailyReport: function() {
    var d        = this.dailyDate || Utils.today();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var user     = Auth.currentUser || {};
    var userName = user.name || user.username || 'User';
    var now      = new Date();
    var dateObj  = new Date(d + 'T12:00:00');
    var fullDate = dateObj.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    var timeStr  = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

    var sales    = DB.getSales().filter(function(s){ return s.date === d; });
    var expenses = DB.getExpenses().filter(function(e){ return e.date === d; });
    var allocs   = DB.getAllocatedDaily();
    var allocDay = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); }, 0);
    var rev      = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
    var manExp   = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var net      = rev - manExp - allocDay;
    var products = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var lowStock = products.filter(function(p){ return p.qty<=(p.lowLevel||5); });

    var payTotals = {};
    sales.forEach(function(s){ var m=s.payment||'Cash'; payTotals[m]=(payTotals[m]||0)+(parseFloat(s.total)||0); });
    var creditSales = sales.filter(function(s){ return s.status!=='Paid'; });
    var creditAmt   = creditSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);

    var prodSold = {};
    sales.forEach(function(s){
      (s.items||[]).forEach(function(item){
        if (!prodSold[item.name]) prodSold[item.name] = {qty:0,rev:0,price:parseFloat(item.price)||0};
        prodSold[item.name].qty += parseInt(item.qty)||1;
        prodSold[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
      });
    });
    var totalUnits = Object.values(prodSold).reduce(function(a,p){ return a+p.qty; },0);

    var css = 'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff;margin:0;padding:0}'
      + '.page{max-width:210mm;margin:0 auto;padding:15mm}'
      + 'h1{font-size:22px;font-weight:900;margin:0 0 2px}'
      + 'h2{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #111;padding-bottom:4px;margin:18px 0 8px}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}'
      + 'th{background:#f0f0f0;border:1px solid #ccc;padding:6px 8px;text-align:left;font-weight:700}'
      + 'td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}'
      + '.right{text-align:right}.bold{font-weight:700}.total-row{background:#f9f9f9;font-weight:700}'
      + '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:16px}'
      + '.biz-name{font-size:24px;font-weight:900;letter-spacing:-.02em}'
      + '.report-title{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#444;margin-top:4px}'
      + '.meta{font-size:10px;color:#666;margin-top:2px}'
      + '.summary-box{background:#f9f9f9;border:1px solid #ddd;padding:12px;margin-bottom:14px}'
      + '.sum-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee}'
      + '.sum-row.total{font-weight:900;font-size:14px;border-top:2px solid #111;border-bottom:none;padding-top:8px;margin-top:4px}'
      + '.badge{padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700}'
      + '.badge-paid{background:#d1fae5;color:#065f46}'
      + '.badge-credit{background:#fee2e2;color:#991b1b}'
      + '.badge-partial{background:#fef3c7;color:#92400e}'
      + '.sig-line{display:flex;justify-content:space-between;margin-top:32px}'
      + '.sig{flex:1;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#444;margin-right:20px}'
      + '.footer{text-align:center;font-size:10px;color:#888;margin-top:24px;border-top:1px solid #ddd;padding-top:10px}'
      + '@media print{@page{size:A4;margin:12mm} .page{padding:0} .no-print{display:none}}'
      + '@page{@bottom-right{content:counter(page) " of " counter(pages);font-size:10px}}';

    var salesTableRows = sales.map(function(s){
      var items = (s.items||[]).map(function(i){ return i.name+' \xD7'+i.qty; }).join(', ');
      if (items.length>60) items=items.slice(0,58)+'\u2026';
      var badge = s.status==='Paid'?'badge-paid':s.status==='Partial'?'badge-partial':'badge-credit';
      return '<tr><td style="font-family:monospace">'+Utils.esc(s.id)+'</td>'
        +'<td>'+Utils.esc(s.customer||'Walk-in')+'</td>'
        +'<td>'+Utils.esc(items)+'</td>'
        +'<td class="right bold">'+Utils.cur(s.total,cur)+'</td>'
        +'<td>'+Utils.esc(s.payment||'Cash')+'</td>'
        +'<td><span class="badge '+badge+'">'+(s.status||'PAID').toUpperCase()+'</span></td></tr>';
    }).join('');

    var prodTableRows = Object.keys(prodSold).sort(function(a,b){ return prodSold[b].rev-prodSold[a].rev; }).map(function(k){
      var p=prodSold[k];
      return '<tr><td>'+Utils.esc(k)+'</td><td class="right">'+p.qty+'</td>'
        +'<td class="right">'+Utils.cur(p.price,cur)+'</td>'
        +'<td class="right bold">'+Utils.cur(p.rev,cur)+'</td></tr>';
    }).join('');

    var expTableRows = expenses.map(function(e){
      return '<tr><td>'+Utils.esc(e.description||e.category)+'</td>'
        +'<td>'+Utils.esc(e.category)+'</td>'
        +'<td>'+Utils.esc(e.payment||'Cash')+'</td>'
        +'<td class="right bold">'+Utils.cur(e.amount,cur)+'</td></tr>';
    }).join('');

    var allocTableRows = allocs.map(function(a){
      return '<tr><td>'+Utils.esc(a.name)+'</td>'
        +'<td>'+Utils.esc(a.periodLabel||'Recurring')+'</td>'
        +'<td class="right bold">'+Utils.cur(a.daily,cur)+'</td></tr>';
    }).join('');

    var creditTableRows = creditSales.map(function(s){
      return '<tr><td>'+Utils.esc(s.customer||'Walk-in')+'</td>'
        +'<td style="font-family:monospace">'+Utils.esc(s.id)+'</td>'
        +'<td class="right">'+Utils.cur(s.total,cur)+'</td>'
        +'<td class="right bold" style="color:#b45309">'+Utils.cur(s.balance||0,cur)+'</td></tr>';
    }).join('');

    var payRows = Object.keys(payTotals).map(function(m){
      return '<div class="sum-row"><span>'+Utils.esc(m)+'</span><span class="bold">'+Utils.cur(payTotals[m],cur)+'</span></div>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Report — '+Utils.esc(bizName)+'</title><style>'+css+'</style></head><body>'
      + '<div class="page">'
      // Header
      + '<div class="header">'
      + '<div style="display:flex;align-items:flex-start;gap:14px">'
      + (settings.bizLogo?'<img src="'+settings.bizLogo+'" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #ddd;flex-shrink:0">':'')
      + '<div>'
      + '<div class="biz-name">'+Utils.esc(bizName)+'</div>'
      + (settings.bizAddress?'<div class="meta">📍 '+Utils.esc(settings.bizAddress)+'</div>':'')
      + (settings.bizPhone  ?'<div class="meta">📞 '+Utils.esc(settings.bizPhone)+'</div>':'')
      + (settings.bizEmail  ?'<div class="meta">✉️ '+Utils.esc(settings.bizEmail)+'</div>':'')
      + '<div class="report-title">Daily Business Report</div>'
      + '<div class="meta">'+fullDate+'</div>'
      + '</div></div>'
      + '<div style="text-align:right">'
      + '<div class="meta">Generated by: '+Utils.esc(userName)+'</div>'
      + '<div class="meta">Printed at: '+timeStr+'</div>'
      + '<div class="meta">'+now.toLocaleDateString()+'</div>'
      + '</div>'
      + '</div>'
      // Section 1 — Profit Summary
      + '<h2>1. Daily Profit Summary</h2>'
      + '<div class="summary-box">'
      + '<div class="sum-row"><span>Gross Sales Today</span><span class="bold">'+Utils.cur(rev,cur)+'</span></div>'
      + (manExp>0?'<div class="sum-row"><span>Less: Manual Expenses</span><span class="bold" style="color:#dc2626">-'+Utils.cur(manExp,cur)+'</span></div>':'')
      + (allocDay>0?'<div class="sum-row"><span>Less: Allocated Expenses</span><span class="bold" style="color:#d97706">-'+Utils.cur(allocDay,cur)+'</span></div>':'')
      + '<div class="sum-row total"><span>NET PROFIT TODAY</span><span style="color:'+(net>=0?'#065f46':'#dc2626')+'">'+Utils.cur(net,cur)+'</span></div>'
      + '</div>'
      + '<table><thead><tr><th>Metric</th><th class="right">Value</th></tr></thead><tbody>'
      + '<tr><td>Total transactions</td><td class="right">'+sales.length+'</td></tr>'
      + '<tr><td>Average sale value</td><td class="right">'+(sales.length>0?Utils.cur(rev/sales.length,cur):'—')+'</td></tr>'
      + Object.keys(payTotals).map(function(m){ return '<tr><td>'+Utils.esc(m)+' collected</td><td class="right">'+Utils.cur(payTotals[m],cur)+'</td></tr>'; }).join('')
      + (creditAmt>0?'<tr><td style="color:#b45309">Credit sales (not yet paid)</td><td class="right" style="color:#b45309">'+Utils.cur(creditAmt,cur)+'</td></tr>':'')
      + '</tbody></table>'
      // Section 2 — Sales List
      + '<h2>2. Sales Transactions</h2>'
      + (sales.length?
          '<table><thead><tr><th>Invoice</th><th>Customer</th><th>Products</th><th class="right">Amount</th><th>Payment</th><th>Status</th></tr></thead>'
          +'<tbody>'+salesTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td colspan="3">TOTAL SALES</td><td class="right">'+Utils.cur(rev,cur)+'</td><td colspan="2">'+sales.length+' transactions</td></tr></tfoot>'
          +'</table>'
        : '<p style="color:#888">No sales recorded for this date.</p>')
      // Section 3 — Products
      + '<h2>3. Products Sold</h2>'
      + (Object.keys(prodSold).length?
          '<table><thead><tr><th>Product</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead>'
          +'<tbody>'+prodTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td>TOTALS</td><td class="right">'+totalUnits+' units</td><td></td><td class="right">'+Utils.cur(rev,cur)+'</td></tr></tfoot>'
          +'</table>'
        : '<p style="color:#888">No products sold this date.</p>')
      // Section 4 — Expenses
      + '<h2>4. Expenses</h2>'
      + (expenses.length?
          '<p style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px">Manual Expenses</p>'
          +'<table><thead><tr><th>Description</th><th>Category</th><th>Payment</th><th class="right">Amount</th></tr></thead>'
          +'<tbody>'+expTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td colspan="3">TOTAL MANUAL EXPENSES</td><td class="right">'+Utils.cur(manExp,cur)+'</td></tr></tfoot>'
          +'</table>'
        : '<p style="font-size:11px;color:#888">No manual expenses recorded.</p>')
      + (allocs.length?
          '<p style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px;margin-top:10px">Allocated Expenses (Daily Share)</p>'
          +'<table><thead><tr><th>Name</th><th>Basis</th><th class="right">Today\'s Amount</th></tr></thead>'
          +'<tbody>'+allocTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td colspan="2">TOTAL ALLOCATED EXPENSES</td><td class="right">'+Utils.cur(allocDay,cur)+'</td></tr></tfoot>'
          +'</table>'
        :'')
      + '<p style="font-weight:800;font-size:13px">Grand Total Expenses: '+Utils.cur(manExp+allocDay,cur)+'</p>'
      // Section 5 — Credit Summary
      + (creditSales.length?
          '<h2>5. Credit Sales</h2>'
          +'<table><thead><tr><th>Customer</th><th>Invoice</th><th class="right">Sale Amount</th><th class="right">Balance Due</th></tr></thead>'
          +'<tbody>'+creditTableRows+'</tbody>'
          +'<tfoot><tr class="total-row"><td colspan="3">TOTAL NEW CREDIT</td><td class="right" style="color:#b45309">'+Utils.cur(creditAmt,cur)+'</td></tr></tfoot>'
          +'</table>'
        :'')
      // Section 6 — Payment summary
      + '<h2>'+(creditSales.length?'6':'5')+'. Cash &amp; Payment Summary</h2>'
      + '<div class="summary-box">'
      + payRows
      + (creditAmt>0?'<div class="sum-row"><span style="color:#b45309">Less: Credit sales</span><span class="bold" style="color:#b45309">-'+Utils.cur(creditAmt,cur)+'</span></div>':'')
      + '<div class="sum-row total"><span>Total Collected (Cash &amp; Transfers)</span><span>'+Utils.cur(rev-creditAmt,cur)+'</span></div>'
      + '</div>'
      // Low stock warning
      + (lowStock.length?'<p style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:4px;font-size:12px;font-weight:600;color:#92400e">'
        +'&#9888; '+lowStock.length+' product'+(lowStock.length!==1?'s':'')+' are below minimum stock level and need reordering.</p>':'')
      // Signatures
      + '<div class="sig-line">'
      + '<div class="sig">Prepared by: _________________________ &nbsp;&nbsp; Date: ___________</div>'
      + '<div class="sig">Approved by: _________________________ &nbsp;&nbsp; Date: ___________</div>'
      + '</div>'
      // Footer
      + '<div class="footer">Report generated by SmartStock Pro &nbsp;|&nbsp; '+Utils.esc(bizName)+' &nbsp;|&nbsp; '+fullDate+'</div>'
      + '</div>'
      + '</body></html>';

    if (typeof Sales !== 'undefined' && Sales._printHtml) {
      Sales._printHtml(html, 'daily-report-frame');
    } else {
      var f=document.createElement('iframe');
      f.id='daily-report-frame';
      f.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
      setTimeout(function(){ try{f.contentWindow.print();}catch(e){window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank');} },600);
    }
  },

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════
  setPeriod:         function(p) { this.period=p; this.view='financial'; this.render(); },
  switchToDaily:     function()  { this.view='daily'; this.dailyDate=this.dailyDate||Utils.today(); this.render(); },
  switchToFinancial: function()  { this.view='financial'; this.render(); },
  setDailyDate:      function(d) { this.dailyDate=d; this.render(); },
  shiftDay: function(n) {
    var d=new Date(this.dailyDate+'T12:00:00'); d.setDate(d.getDate()+n);
    var nd=d.toISOString().slice(0,10);
    if (nd<=Utils.today()) { this.dailyDate=nd; this.render(); }
  },

  exportCSV: function() {
    var sales  = DB.getSales();
    var header = ['ID','Date','Customer','Total','Status','Items'];
    var rows   = sales.map(function(s){
      return [s.id||'',s.date||'',s.customer||'',s.total||0,s.status||'',(s.items||[]).length];
    });
    var lines = [header].concat(rows).map(function(row){
      return row.map(function(cell){ return '"'+String(cell).replace(/"/g,'""')+'"'; }).join(',');
    });
    var csv = lines.join('\r\n');
    var a=document.createElement('a');
    a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    a.download='smartstock_reports_'+Utils.today()+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    Toast.show('CSV exported \u2713','ok');
  },
};


/* === quotations.js === */
var Quotations = {
  filter: 'All',

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN LIST
  // ══════════════════════════════════════════════════════════════════════════
  render: function() {
    var pg = Utils.get('pg-quotations');
    if (!pg) return;
    var list     = DB.getQuotations();
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var today    = Utils.today();

    // Auto-mark expired
    list.forEach(function(q) {
      if (q.status === 'Sent' && q.expiryDate && q.expiryDate < today) {
        DB.updateQuotation(q.id, {status: 'Expired'});
      }
    });
    list = DB.getQuotations();

    var filters = ['All','Draft','Sent','Approved','Declined','Expired'];
    var filtered = this.filter === 'All' ? list : list.filter(function(q){ return q.status === Quotations.filter; });

    var totalVal  = list.reduce(function(a,q){ return a+(parseFloat(q.total)||0); },0);
    var approved  = list.filter(function(q){ return q.status==='Approved'; });
    var approvedV = approved.reduce(function(a,q){ return a+(parseFloat(q.total)||0); },0);
    var pending   = list.filter(function(q){ return q.status==='Sent'; }).length;

    var chips = filters.map(function(f){
      var cnt = f==='All' ? list.length : list.filter(function(q){ return q.status===f; }).length;
      return '<div class="chip'+(Quotations.filter===f?' active':'')+'" onclick="Quotations.setFilter(\''+f+'\')">'
        +f+' ('+cnt+')</div>';
    }).join('');

    var rows = filtered.map(function(q) {
      var sc = {Draft:'var(--t3)',Sent:'var(--in)',Approved:'var(--ok)',Declined:'var(--er)',Expired:'var(--wa)'}[q.status]||'var(--t3)';
      var expired = q.expiryDate && q.expiryDate < today && q.status !== 'Declined';
      return '<div class="list-item" onclick="Quotations.viewQuotation(\''+q.id+'\')">'
        +'<div class="list-icon" style="background:var(--inb);font-size:18px">📄</div>'
        +'<div class="list-info">'
        +'<div class="list-name">'+Utils.esc(q.clientName||'No client')+'</div>'
        +'<div class="list-meta" style="font-family:var(--fm)">'+q.id+' · '+Utils.date(q.date)+'</div>'
        +(q.expiryDate?'<div class="list-meta" style="font-size:10px;color:'+(expired?'var(--er)':'var(--t3)')+'">Expires: '+Utils.date(q.expiryDate)+(expired?' ⚠️ EXPIRED':' ')+'</div>':'')
        +'</div>'
        +'<div class="list-right">'
        +'<div class="list-val">'+Utils.cur(q.total||0,cur)+'</div>'
        +'<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:800;background:'+sc+'18;color:'+sc+';border:1px solid '+sc+'40">'+q.status+'</span>'
        +'<div class="list-actions">'
        +'<button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Quotations.printQuotation(\''+q.id+'\')" title="Print">🖨</button>'
        +(q.status!=='Approved'&&q.status!=='Declined'?'<button class="btn-ok btn-sm" onclick="event.stopPropagation();Quotations.convertToInvoice(\''+q.id+'\')">→ Invoice</button>':'')
        +'<button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Quotations.del(\''+q.id+'\')">🗑</button>'
        +'</div></div></div>';
    }).join('');

    pg.innerHTML = '<div class="page-header">'
      +'<div><div class="page-title">Quotations</div><div class="page-sub">'+list.length+' quotations total</div></div>'
      +'<div class="page-actions"><button class="btn-primary btn-sm" onclick="Quotations.openNewQuotation()">＋ New Quote</button></div>'
      +'</div>'
      +'<div class="sec"><div class="kpi-grid">'
      +'<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📄</div><div class="kpi-label">Total Quotes</div><div class="kpi-value">'+list.length+'</div><div class="kpi-sub">'+Utils.cur(totalVal,cur)+'</div></div>'
      +'<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">⏳</div><div class="kpi-label">Pending</div><div class="kpi-value">'+pending+'</div><div class="kpi-sub">Awaiting response</div></div>'
      +'<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">✅</div><div class="kpi-label">Approved</div><div class="kpi-value">'+approved.length+'</div><div class="kpi-sub">'+Utils.cur(approvedV,cur)+'</div></div>'
      +'<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">📊</div><div class="kpi-label">Conversion</div><div class="kpi-value">'+(list.length?Math.round((approved.length/list.length)*100):0)+'%</div><div class="kpi-sub">Approval rate</div></div>'
      +'</div></div>'
      +'<div class="chips">'+chips+'</div>'
      +'<div class="sec">'
      +(filtered.length?'<div class="card">'+rows+'</div>'
        :'<div class="empty"><div class="empty-icon">📄</div><div class="empty-title">No '+(this.filter!=='All'?this.filter+' ':'')+'quotations yet</div>'
          +'<div class="empty-sub">Create professional quotations for your clients</div>'
          +'<div class="empty-action"><button class="btn-primary btn-sm" onclick="Quotations.openNewQuotation()">＋ New Quotation</button></div></div>')
      +'</div>';
  },

  setFilter: function(f) { this.filter=f; this.render(); },

  // ══════════════════════════════════════════════════════════════════════════
  // NEW QUOTATION FORM
  // ══════════════════════════════════════════════════════════════════════════
  _cart: [],
  _discount: 0,
  _tax: 0,

  openNewQuotation: function() {
    this._cart = [];
    this._discount = 0;
    this._tax = 0;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var custs    = DB.getCustomers();
    var nextNum  = this._nextNumber();

    var custSugg = custs.slice(0,50).map(function(c){
      return '<option value="'+Utils.esc(c.name)+'">';
    }).join('');

    Modal.open({
      title: 'New Quotation', sub: nextNum, barColor: 'var(--in)',
      body: '<datalist id="qt-cust-list">'+custSugg+'</datalist>'

        // Client info
        +'<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        +'<div style="font-size:10px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">👤 Client Information</div>'
        +'<div class="form-row" style="margin-bottom:8px">'
        +'<div class="fg" style="margin:0"><label class="fl">Client Name *</label>'
        +'<input class="fi" id="qt-client" list="qt-cust-list" placeholder="Type or select client..." oninput="Quotations._onClientInput(this.value)"></div>'
        +'<div class="fg" style="margin:0"><label class="fl">Phone</label>'
        +'<input class="fi" id="qt-phone" type="tel" placeholder="+231 77 000 000"></div>'
        +'</div>'
        +'<div class="form-row">'
        +'<div class="fg" style="margin:0"><label class="fl">Email</label>'
        +'<input class="fi" id="qt-email" type="email" placeholder="client@email.com"></div>'
        +'<div class="fg" style="margin:0"><label class="fl">Address</label>'
        +'<input class="fi" id="qt-addr" placeholder="Client address"></div>'
        +'</div>'
        +'<div id="qt-client-info" style="display:none;margin-top:8px;font-size:11px;color:var(--ok);font-weight:600"></div>'
        +'</div>'

        // Dates
        +'<div class="form-row" style="margin-bottom:14px">'
        +'<div class="fg"><label class="fl">Date</label><input class="fi" id="qt-date" type="date" value="'+Utils.today()+'"></div>'
        +'<div class="fg"><label class="fl">Expiry Date</label><input class="fi" id="qt-expiry" type="date"></div>'
        +'</div>'

        // Products
        +'<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        +'<div style="font-size:10px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📦 Products / Services</div>'
        +'<div class="fg" style="margin-bottom:10px"><label class="fl">Add Product</label>'
        +'<select class="fi" id="qt-prod-sel" onchange="Quotations._addItem(this)">'+QuickCreate.productOptions()+'</select></div>'
        +'<div id="qt-items-wrap"><div style="text-align:center;padding:14px;color:var(--t3);font-size:13px">No items added yet</div></div>'
        +'</div>'

        // Totals
        +'<div id="qt-totals"></div>'

        // Terms
        +'<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
        +'<div style="font-size:10px;font-weight:800;color:var(--in);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📝 Terms & Notes</div>'
        +'<div class="fg" style="margin-bottom:8px"><label class="fl">Payment Terms</label>'
        +'<select class="fi" id="qt-payterms"><option>Immediate</option><option>Net 7</option><option>Net 14</option><option>Net 30</option><option>Net 60</option><option>50% Upfront</option></select></div>'
        +'<div class="fg" style="margin-bottom:8px"><label class="fl">Notes to Client</label>'
        +'<input class="fi" id="qt-notes" placeholder="Additional notes for the client..."></div>'
        +'<div class="fg"><label class="fl">Terms & Conditions</label>'
        +'<input class="fi" id="qt-terms" placeholder="e.g. Prices valid for 30 days. Delivery not included."></div>'
        +'</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-ghost" onclick="Quotations.saveQuotation(\'draft\')" style="color:var(--t2)">💾 Save Draft</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Quotations.saveQuotation(\'sent\')">📤 Save &amp; Print</button>',
    });
    this._renderItems();
    this._renderTotals();
  },

  _nextNumber: function() {
    var list = DB.getQuotations();
    var year = new Date().getFullYear();
    var num  = list.length + 1;
    return 'QT-' + year + '-' + String(num).padStart(4,'0');
  },

  _onClientInput: function(val) {
    var infoEl = Utils.get('qt-client-info');
    if (!val.trim()) { if(infoEl) infoEl.style.display='none'; return; }
    var cust = DB.getCustomers().find(function(c){ return c.name.toLowerCase()===val.toLowerCase().trim(); });
    if (cust) {
      var phone = Utils.get('qt-phone'); if(phone&&!phone.value) phone.value = cust.phone||'';
      var email = Utils.get('qt-email'); if(email&&!email.value) email.value = cust.email||'';
      var addr  = Utils.get('qt-addr');  if(addr&&!addr.value)   addr.value  = cust.address||'';
      if (infoEl) {
        infoEl.textContent = '✓ Existing customer — '+DB.getSales().filter(function(s){ return s.customerId===cust.id; }).length+' previous invoices';
        infoEl.style.display = 'block';
      }
    } else { if(infoEl) infoEl.style.display='none'; }
  },

  _addItem: function(sel) {
    if (QuickCreate.onProductChange(sel, function(newProd) {
      var s2 = Utils.get('qt-prod-sel'); if(s2) s2.innerHTML = QuickCreate.productOptions();
      Quotations._cart.push({id:newProd.id,name:newProd.name,qty:1,price:newProd.price,discount:0,tax:0,unit:newProd.unit||'Pcs'});
      Quotations._renderItems(); Quotations._renderTotals();
    })) return;
    var id = sel.value; if (!id) return;
    var p  = DB.getProducts().find(function(x){ return x.id===id; }); if(!p) return;
    sel.value = '';
    if (this._cart.find(function(i){ return i.id===id; })) return;
    this._cart.push({id:p.id,name:p.name,qty:1,price:p.price,discount:0,tax:0,unit:p.unit||'Pcs'});
    this._renderItems();
    this._renderTotals();
  },

  _renderItems: function() {
    var el = Utils.get('qt-items-wrap'); if(!el) return;
    var cur = DB.getSettings().currency||'$';
    if (!this._cart.length) {
      el.innerHTML='<div style="text-align:center;padding:14px;color:var(--t3);font-size:13px">No items added yet</div>';
      return;
    }
    el.innerHTML = this._cart.map(function(item,i){
      var lineTotal = item.qty * item.price * (1-(item.discount/100)) * (1+(item.tax/100));
      return '<div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r10);padding:11px 13px;margin-bottom:8px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
        +'<div style="font-size:13px;font-weight:700;color:var(--t1);flex:1;padding-right:8px">'+Utils.esc(item.name)+'<span style="font-size:10px;color:var(--t3);margin-left:6px">'+item.unit+'</span></div>'
        +'<button onclick="Quotations._cart.splice('+i+',1);Quotations._renderItems();Quotations._renderTotals()" style="width:20px;height:20px;border-radius:50%;background:var(--erb);border:1px solid var(--erbd);color:var(--er);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:7px;align-items:end">'
        // Qty
        +'<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Qty</div>'
        +'<input type="number" value="'+item.qty+'" min="1" oninput="Quotations._cart['+i+'].qty=parseInt(this.value)||1;Quotations._renderTotals()" style="width:100%;font-size:13px;font-weight:700;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 7px;-webkit-appearance:none;color:var(--t1)"></div>'
        // Unit Price
        +'<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Unit Price</div>'
        +'<input type="number" value="'+item.price+'" min="0" step="0.01" oninput="Quotations._cart['+i+'].price=parseFloat(this.value)||0;Quotations._renderTotals()" style="width:100%;font-size:13px;font-weight:700;background:var(--gb);border:1.5px solid rgba(201,168,76,.25);border-radius:6px;padding:5px 7px;-webkit-appearance:none;color:var(--g)"></div>'
        // Discount
        +'<div><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Disc. %</div>'
        +'<input type="number" value="'+item.discount+'" min="0" max="100" oninput="Quotations._cart['+i+'].discount=parseFloat(this.value)||0;Quotations._renderTotals()" style="width:100%;font-size:13px;background:var(--bg3);border:1.5px solid var(--bd2);border-radius:6px;padding:5px 7px;-webkit-appearance:none;color:var(--er)"></div>'
        // Line Total
        +'<div style="text-align:right"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Total</div>'
        +'<div style="font-size:15px;font-weight:800;color:var(--g)">'+Utils.cur(lineTotal,cur)+'</div>'
        +'</div>'
        +'</div></div>';
    }).join('');
  },

  _renderTotals: function() {
    var el = Utils.get('qt-totals'); if(!el) return;
    var cur = DB.getSettings().currency||'$';
    if (!this._cart.length) { el.innerHTML=''; return; }
    var subtotal = this._cart.reduce(function(a,item){ return a+item.qty*item.price*(1-(item.discount/100)); },0);
    var taxAmt   = subtotal * (this._tax/100);
    var total    = subtotal + taxAmt;
    el.innerHTML = '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">'
      +'<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">🧮 Summary</div>'
      +'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px"><span style="color:var(--t2)">Subtotal</span><span style="font-weight:600;font-family:var(--fm)">'+Utils.cur(subtotal,cur)+'</span></div>'
      +'<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bd)">'
      +'<span style="font-size:13px;color:var(--t2);flex:1">Tax %</span>'
      +'<input type="number" value="'+this._tax+'" min="0" max="100" oninput="Quotations._tax=parseFloat(this.value)||0;Quotations._renderTotals()" style="width:70px;text-align:center;font-size:13px;background:var(--bg2);border:1px solid var(--bd2);border-radius:6px;padding:4px 6px;color:var(--t1)">'
      +'<span style="font-size:13px;font-weight:600;font-family:var(--fm);min-width:60px;text-align:right">'+Utils.cur(taxAmt,cur)+'</span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:17px;font-weight:900"><span style="color:var(--t1)">TOTAL</span><span style="color:var(--g);font-family:var(--fm)">'+Utils.cur(total,cur)+'</span></div>'
      +'</div>';
  },

  saveQuotation: function(action) {
    if (!this._cart.length) { Toast.show('Add at least one item','err'); return; }
    var clientName = Utils.val('qt-client').trim();
    if (!clientName) { Toast.show('Client name is required','err'); return; }

    var subtotal = this._cart.reduce(function(a,item){ return a+item.qty*item.price*(1-(item.discount/100)); },0);
    var taxAmt   = subtotal * (this._tax/100);
    var total    = subtotal + taxAmt;
    var status   = action==='sent' ? 'Sent' : 'Draft';

    // Auto-create or link customer
    var cust = DB.findOrCreateCustomer(clientName, Utils.val('qt-phone'));
    if (cust && Utils.val('qt-email')) DB.updateCustomer(cust.id,{email:Utils.val('qt-email'),address:Utils.val('qt-addr')});

    var qt = DB.addQuotation({
      clientName:   clientName,
      clientPhone:  Utils.val('qt-phone'),
      clientEmail:  Utils.val('qt-email'),
      clientAddress:Utils.val('qt-addr'),
      customerId:   cust ? cust.id : null,
      items:        this._cart.map(function(i){ return Object.assign({},i); }),
      subtotal:     subtotal,
      taxPct:       this._tax,
      taxAmount:    taxAmt,
      total:        total,
      payTerms:     (Utils.get('qt-payterms')||{value:'Immediate'}).value,
      notes:        Utils.val('qt-notes'),
      terms:        Utils.val('qt-terms'),
      date:         Utils.val('qt-date')||Utils.today(),
      expiryDate:   Utils.val('qt-expiry')||'',
      status:       status,
    });

    Toast.show('Quotation '+qt.id+' saved ✓','ok');
    Modal.close();
    this.render();
    if (action === 'sent') {
      setTimeout(function(){ Quotations.printQuotation(qt.id); }, 400);
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW QUOTATION
  // ══════════════════════════════════════════════════════════════════════════
  viewQuotation: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var cur = DB.getSettings().currency||'$';
    var sc  = {Draft:'var(--t3)',Sent:'var(--in)',Approved:'var(--ok)',Declined:'var(--er)',Expired:'var(--wa)'}[q.status]||'var(--t3)';
    var statusOpts = ['Draft','Sent','Approved','Declined'].map(function(s){
      return '<option'+(q.status===s?' selected':'')+'>'+s+'</option>';
    }).join('');

    var itemsHtml = (q.items||[]).map(function(item){
      var lineTotal = item.qty*item.price*(1-(item.discount/100));
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">'
        +'<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--t1)">'+Utils.esc(item.name)+'</div>'
        +'<div style="font-size:11px;color:var(--t2);font-family:var(--fm)">'+item.qty+' '+item.unit+' × '+Utils.cur(item.price,cur)+(item.discount>0?' (−'+item.discount+'%)':'')+'</div></div>'
        +'<div style="font-size:14px;font-weight:700;color:var(--g)">'+Utils.cur(lineTotal,cur)+'</div></div>';
    }).join('');

    Modal.open({
      title:q.id, sub:Utils.esc(q.clientName)+' · '+Utils.date(q.date), barColor:'var(--in)',
      body: '<div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px;margin-bottom:12px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
          +'<span style="font-size:12px;color:var(--t2)">Status</span>'
          +'<select onchange="Quotations.updateStatus(\''+id+'\',this.value)" style="background:var(--bg2);border:1px solid var(--bd2);border-radius:6px;padding:4px 8px;font-size:12px;color:var(--t1)">'+statusOpts+'</select>'
          +'</div>'
          +'<div class="report-row"><span class="report-label">Client</span><span class="report-val">'+Utils.esc(q.clientName)+'</span></div>'
          +(q.clientPhone?'<div class="report-row"><span class="report-label">Phone</span><span class="report-val">'+Utils.esc(q.clientPhone)+'</span></div>':'')
          +(q.expiryDate?'<div class="report-row"><span class="report-label">Expires</span><span class="report-val">'+Utils.date(q.expiryDate)+'</span></div>':'')
          +'<div class="report-row"><span class="report-label">Payment Terms</span><span class="report-val">'+Utils.esc(q.payTerms||'Immediate')+'</span></div>'
          +'</div>'
          +'<div class="card card-body" style="margin-bottom:12px">'+itemsHtml+'</div>'
          +'<div class="card card-body">'
          +'<div class="report-row"><span class="report-label">Subtotal</span><span class="report-val">'+Utils.cur(q.subtotal,cur)+'</span></div>'
          +(q.taxAmount>0?'<div class="report-row"><span class="report-label">Tax ('+q.taxPct+'%)</span><span class="report-val">'+Utils.cur(q.taxAmount,cur)+'</span></div>':'')
          +'<div class="report-row" style="border-top:2px solid var(--bd2);padding-top:8px;margin-top:4px"><span style="font-size:15px;font-weight:800;color:var(--t1)">TOTAL</span><span style="font-size:17px;font-weight:900;color:var(--g);font-family:var(--fm)">'+Utils.cur(q.total,cur)+'</span></div>'
          +'</div>'
          +(q.notes?'<div style="background:var(--bg3);border-radius:var(--r8);padding:10px 12px;margin-top:10px;font-size:12px;color:var(--t2)">📝 '+Utils.esc(q.notes)+'</div>':''),
      footer: '<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            + '<button class="btn-ghost btn-icon" onclick="Quotations.printQuotation(\''+id+'\')">🖨 Print</button>'
            + (q.status!=='Approved'&&q.status!=='Declined'?'<button class="btn-primary" style="flex:1" onclick="Modal.close();Quotations.convertToInvoice(\''+id+'\')">→ Convert to Invoice</button>':''),
    });
  },

  updateStatus: function(id, status) {
    DB.updateQuotation(id,{status:status});
    Toast.show('Status updated to '+status+' ✓','ok');
    if (status==='Approved') {
      Toast.show('Tap "→ Invoice" to convert to an invoice','ok');
    }
    this.render();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONVERT TO INVOICE
  // ══════════════════════════════════════════════════════════════════════════
  convertToInvoice: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var cur = DB.getSettings().currency||'$';
    Modal.open({
      title:'Convert to Invoice', sub:q.id+' → Invoice', barColor:'var(--ok)',
      body: '<div style="text-align:center;padding:20px 10px">'
          +'<div style="font-size:48px;margin-bottom:14px">📄→🧾</div>'
          +'<div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:8px">Convert this quotation to an invoice?</div>'
          +'<div style="font-size:13px;color:var(--t2);margin-bottom:16px">Client: <strong>'+Utils.esc(q.clientName)+'</strong><br>Amount: <strong style="color:var(--g)">'+Utils.cur(q.total,cur)+'</strong></div>'
          +'</div>'
          +'<div class="fg"><label class="fl">Payment Method</label>'
          +'<select class="fi" id="cv-method"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Credit</option></select></div>'
          +'<div class="fg"><label class="fl">Amount Paid Now</label>'
          +'<input class="fi" id="cv-paid" type="number" value="'+q.total.toFixed(2)+'" min="0" step="0.01" style="font-size:16px;font-weight:700;color:var(--ok)"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Quotations._doConvert(\''+id+'\')">✅ Create Invoice</button>',
    });
  },

  _doConvert: function(id) {
    var q = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var method = (Utils.get('cv-method')||{value:'Cash'}).value;
    var paid   = Math.min(parseFloat(Utils.val('cv-paid')||0), q.total);
    var balance= Math.max(0, q.total-paid);
    var status = paid>=q.total?'Paid':(paid>0?'Partial':'Credit');

    // Find or create customer
    var cust = DB.findOrCreateCustomer(q.clientName, q.clientPhone);
    if (cust && (q.clientEmail||q.clientAddress)) {
      DB.updateCustomer(cust.id,{email:q.clientEmail||cust.email,address:q.clientAddress||cust.address});
    }

    // Create sale
    var sale = DB.addSale({
      customer:   q.clientName,
      customerId: cust?cust.id:null,
      items:      q.items,
      subtotal:   q.subtotal,
      discount:   0,
      total:      q.total,
      amountPaid: status==='Paid'?q.total:paid,
      balance:    status==='Paid'?0:balance,
      payment:    method,
      status:     status,
      date:       Utils.today(),
      notes:      'Converted from quotation '+q.id,
      fromQuotation: id,
    });

    // Deduct stock
    q.items.forEach(function(item){
      var p=DB.getProducts().find(function(x){ return x.id===item.id; });
      if(p) DB.updateProduct(item.id,{qty:Math.max(0,(p.qty||0)-(parseInt(item.qty)||0))});
    });

    // Update customer
    if(cust) DB.updateCustomer(cust.id,{totalSpent:(cust.totalSpent||0)+q.total,purchases:(cust.purchases||0)+1});

    // Mark quotation approved
    DB.updateQuotation(id,{status:'Approved',convertedToInvoice:sale.id});

    Modal.close();
    Toast.show('Invoice '+sale.id+' created from quotation ✓','ok');
    this.render();
    // Show print prompt
    setTimeout(function(){ Sales.showPrintPrompt(sale.id,'invoice'); },400);
  },

  del: function(id) {
    confirmDel('Delete this quotation?', function(){
      DB.deleteQuotation(id);
      Toast.show('Deleted','warn');
      Quotations.render();
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PROFESSIONAL PRINT / PDF
  // ══════════════════════════════════════════════════════════════════════════
  printQuotation: function(id) {
    var q        = DB.getQuotations().find(function(x){ return x.id===id; }); if(!q) return;
    var settings = DB.getSettings();
    var cur      = settings.currency || '$';
    var bizName  = settings.bizName  || 'SmartStock Pro';
    var bizAddr  = settings.bizAddress || '';
    var bizPhone = settings.bizPhone   || '';
    var bizEmail = settings.bizEmail   || '';
    var bizLogo  = settings.bizLogo    || '';
    var now      = new Date();

    // Calculate totals per line
    var subtotal = q.subtotal || q.items.reduce(function(a,item){ return a+item.qty*item.price*(1-(item.discount/100)); },0);
    var taxAmt   = q.taxAmount || 0;
    var total    = q.total || subtotal + taxAmt;

    var logoHtml = bizLogo
      ? '<img src="'+bizLogo+'" alt="Logo" onerror="this.style.display=\'none\'" style="width:80px;height:80px;object-fit:contain;object-position:center">'
      : '<div style="width:80px;height:80px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:32px">📦</div>';

    var statusColors = {Draft:'#6b7280',Sent:'#2563eb',Approved:'#16a34a',Declined:'#dc2626',Expired:'#d97706'};
    var statusColor  = statusColors[q.status] || '#6b7280';

    var itemRows = (q.items||[]).map(function(item,i){
      var lineTotal = item.qty * item.price * (1-(item.discount/100));
      var bg = i%2===0 ? '' : 'background:#f9fafb';
      return '<tr style="'+bg+'">'
        +'<td style="padding:10px 12px;font-size:12px;border-bottom:1px solid #e5e7eb">'+Utils.esc(item.name)+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:center;border-bottom:1px solid #e5e7eb">'+item.qty+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:center;border-bottom:1px solid #e5e7eb">'+item.unit+'</td>'
        +'<td style="padding:10px 12px;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb">'+Utils.cur(item.price,cur)+'</td>'
        +(item.discount>0?'<td style="padding:10px 12px;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;color:#dc2626">'+item.discount+'%</td>'
          :'<td style="padding:10px 12px;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;color:#9ca3af">—</td>')
        +'<td style="padding:10px 12px;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:700">'+Utils.cur(lineTotal,cur)+'</td>'
        +'</tr>';
    }).join('');

    var css = '*{margin:0;padding:0;box-sizing:border-box}'
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
      +'.items-table th{background:#111;color:#fff;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}'
      +'.items-table th:not(:first-child){text-align:right}'
      +'.items-table th:nth-child(2),.items-table th:nth-child(3){text-align:center}'
      +'.totals-block{display:flex;justify-content:flex-end;margin-top:0}'
      +'.totals-inner{width:280px}'
      +'.totals-row{display:flex;justify-content:space-between;padding:7px 12px;font-size:12px;border-bottom:1px solid #e5e7eb}'
      +'.totals-row.grand{background:#111;color:#fff;font-size:15px;font-weight:800;padding:12px;border-radius:0 0 8px 8px;border:none}'
      +'.notes-block{margin-top:20px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:11px;color:#555;line-height:1.7}'
      +'.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end}'
      +'.sig-line{border-top:1px solid #333;padding-top:6px;font-size:10px;color:#777;width:180px}'
      +'.page-footer{text-align:center;font-size:10px;color:#9ca3af;margin-top:16px}'
      +'@media print{@page{size:A4;margin:12mm}.page{padding:0}}'
      +'@page{@bottom-right{content:counter(page) " / " counter(pages);font-size:9px;color:#aaa}}';

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      +'<meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<title>Quotation '+q.id+'</title><style>'+css+'</style></head><body>'
      +'<div class="page">'

      // Header
      +'<div class="header">'
      +'<div style="display:flex;align-items:flex-start;gap:16px">'
      +logoHtml
      +'<div class="biz-block">'
      +'<div class="biz-name">'+Utils.esc(bizName)+'</div>'
      +'<div class="biz-detail">'
      +(bizAddr?bizAddr+'<br>':'')
      +(bizPhone?'Tel: '+bizPhone+'<br>':'')
      +(bizEmail?bizEmail:'')
      +'</div></div></div>'
      +'<div class="doc-block">'
      +'<div class="doc-title">Quotation</div>'
      +'<div class="doc-num">'+q.id+'</div>'
      +'<div class="doc-num" style="font-size:11px;font-weight:400">Date: '+Utils.date(q.date)+'</div>'
      +(q.expiryDate?'<div class="doc-num" style="font-size:11px;font-weight:400">Valid until: '+Utils.date(q.expiryDate)+'</div>':'')
      +'<div style="margin-top:8px"><span class="doc-status" style="color:'+statusColor+';border-color:'+statusColor+'">'+q.status.toUpperCase()+'</span></div>'
      +'</div></div>'

      // Client + Quote info
      +'<div class="client-section">'
      +'<div class="client-box">'
      +'<h3>Bill To</h3>'
      +'<p><strong>'+Utils.esc(q.clientName)+'</strong><br>'
      +(q.clientAddress?q.clientAddress+'<br>':'')
      +(q.clientPhone?'Tel: '+q.clientPhone+'<br>':'')
      +(q.clientEmail?q.clientEmail:'')
      +'</p></div>'
      +'<div class="client-box">'
      +'<h3>Quotation Details</h3>'
      +'<p>Payment Terms: <strong>'+Utils.esc(q.payTerms||'Immediate')+'</strong><br>'
      +'Prepared by: <strong>'+Utils.esc(settings.bizName||'')+'</strong><br>'
      +(q.expiryDate?'Offer valid until: <strong>'+Utils.date(q.expiryDate)+'</strong><br>':'')
      +'Generated: '+now.toLocaleDateString()
      +'</p></div>'
      +'</div>'

      // Items table
      +'<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:0">'
      +'<table class="items-table">'
      +'<thead><tr>'
      +'<th style="text-align:left;width:35%">Description</th>'
      +'<th style="text-align:center;width:10%">Qty</th>'
      +'<th style="text-align:center;width:10%">Unit</th>'
      +'<th style="text-align:right;width:15%">Unit Price</th>'
      +'<th style="text-align:right;width:10%">Disc.</th>'
      +'<th style="text-align:right;width:20%">Amount</th>'
      +'</tr></thead>'
      +'<tbody>'+itemRows+'</tbody>'
      +'</table>'

      // Totals
      +'<div class="totals-block">'
      +'<div class="totals-inner">'
      +'<div class="totals-row"><span>Subtotal</span><span>'+Utils.cur(subtotal,cur)+'</span></div>'
      +(taxAmt>0?'<div class="totals-row"><span>Tax ('+q.taxPct+'%)</span><span>'+Utils.cur(taxAmt,cur)+'</span></div>':'')
      +'<div class="totals-row grand"><span>TOTAL</span><span>'+Utils.cur(total,cur)+'</span></div>'
      +'</div></div>'
      +'</div>'

      // Notes & Terms
      +((q.notes||q.terms)?'<div class="notes-block">'
        +(q.notes?'<p><strong>Notes:</strong> '+Utils.esc(q.notes)+'</p>':'')
        +(q.terms?'<p style="margin-top:6px"><strong>Terms &amp; Conditions:</strong> '+Utils.esc(q.terms)+'</p>':'')
        +'</div>':'')

      // Signatures
      +'<div class="footer">'
      +'<div class="sig-line">Authorized Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: __________</div>'
      +'<div class="sig-line">Client Acceptance &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: __________</div>'
      +'</div>'

      // Footer
      +'<div class="page-footer">'
      +Utils.esc(bizName)+(bizPhone?' · Tel: '+bizPhone:'')+' · Thank you for your business!'
      +'</div>'

      +'</div></body></html>';

    Sales._printHtml(html, 'quotation-print-frame');
  },
};


/* === ai.js === */
var AI = {
  history: [],
  busy: false,
  inited: false,
  KEY: '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',

  render: function() {
    var pg = Utils.get('pg-ai');
    if (!pg) return;
    pg.innerHTML = '<div class="ai-wrap">'
      + '<div class="ai-head">'
      + '<div class="ai-brand">'
      + '<div class="ai-avatar">🤖</div>'
      + '<div style="flex:1">'
      + '<div class="ai-title">SmartStock AI</div>'
      + '<div class="ai-status">'
      + '<span class="ai-status-dot"></span>'
      + '<span id="ai-status-txt">Ready — Ask me anything</span>'
      + '</div></div>'
      + '<button class="btn-ghost btn-sm" onclick="AI.clear()">Clear</button>'
      + '</div>'
      // Quick chips
      + '<div class="ai-chips">'
      + '<div class="ai-chip ai-chip-report" onclick="AI.generateFullReport()" style="background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.05));border:1px solid rgba(201,168,76,.3);color:var(--g);font-weight:700">📋 Full Business Report</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'What products are low in stock?\')">📦 Low stock?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Give me a full business summary\')">📊 Summary</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'How much did I earn today?\')">💰 Today?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Which products sell the most?\')">🏆 Top sellers?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Who owes me money?\')">💸 Debtors?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Am I making a profit?\')">📈 Profitable?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'What should I restock urgently?\')">🚨 Restock?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Analyze my expenses this month\')">💡 Expenses?</div>'
      + '</div>'
      + '</div>'
      + '<div class="ai-msgs" id="ai-msgs"></div>'
      + '<div class="ai-input-row">'
      + '<textarea class="ai-input" id="ai-inp" placeholder="Ask anything about your business..." rows="1"'
      + ' onkeydown="if(event.keyCode===13&&!event.shiftKey){event.preventDefault();AI.send();}"'
      + ' oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,100)+\'px\'"></textarea>'
      + '<button class="ai-send" id="ai-send-btn" onclick="AI.send()">➤</button>'
      + '</div>'
      + '</div>';

    if (!this.inited) {
      this.inited = true;
      this._addBot('👋 Hi! I\'m SmartStock AI, your business assistant.\n\nI have access to your live data and can help with:\n• 📦 Inventory & stock analysis\n• 💰 Sales & revenue insights\n• 📊 Profit & expense reports\n• 💡 Smart recommendations\n• 📋 **Full Daily Business Report** — tap the gold button above\n\nUse the quick buttons above or type your question!');
    }
  },

  // ── BUILD FULL BUSINESS DATA CONTEXT ────────────────────────────────────────
  _buildFullContext: function() {
    try {
      var s        = DB.stats();
      var settings = DB.getSettings();
      var cur      = settings.currency || '$';
      var today    = Utils.today();
      var month    = today.slice(0,7);
      var now      = new Date();

      var prods    = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
      var sales    = DB.getSales();
      var expenses = DB.getExpenses();
      var custs    = DB.getCustomers();
      var suppliers= DB.getSuppliers();
      var payroll  = DB.getPayroll ? DB.getPayroll() : [];
      var allocs   = DB.getAllocatedDaily ? DB.getAllocatedDaily() : [];

      // Today
      var todaySales  = sales.filter(function(s){ return s.date===today; });
      var todayRev    = todaySales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
      var todayExp    = expenses.filter(function(e){ return e.date===today; }).reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
      var todayCOGS   = todaySales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0); },0);
      var allocDay    = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); },0);

      // Month
      var monthSales  = sales.filter(function(s){ return s.date&&s.date.startsWith(month); });
      var monthRev    = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
      var monthExp    = expenses.filter(function(e){ return e.date&&e.date.startsWith(month); }).reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
      var monthCOGS   = monthSales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0); },0);
      var monthGross  = monthRev - monthCOGS;
      var monthNet    = monthGross - monthExp - (allocDay*30);

      // Payment methods
      var payMethods = {};
      todaySales.forEach(function(s){ var m=s.payment||'Cash'; payMethods[m]=(payMethods[m]||0)+(parseFloat(s.total)||0); });

      // Top products today
      var prodMap = {};
      todaySales.forEach(function(s){ (s.items||[]).forEach(function(item){
        if(!prodMap[item.name]) prodMap[item.name]={qty:0,rev:0,cost:0};
        prodMap[item.name].qty += parseInt(item.qty)||1;
        prodMap[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
        prodMap[item.name].cost+= (parseFloat(item.cost)||0)*(parseInt(item.qty)||1);
      }); });
      var topProds = Object.keys(prodMap).map(function(k){ return {name:k,qty:prodMap[k].qty,rev:prodMap[k].rev,profit:prodMap[k].rev-prodMap[k].cost}; })
        .sort(function(a,b){ return b.rev-a.rev; }).slice(0,5);

      // Customer debts
      var debtSales = sales.filter(function(s){ return s.status!=='Paid'; });
      var totalDebt = debtSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
      var debtCustMap = {};
      debtSales.forEach(function(s){ var k=s.customer||'Walk-in'; debtCustMap[k]=(debtCustMap[k]||0)+(parseFloat(s.balance)||0); });
      var topDebtors = Object.keys(debtCustMap).map(function(k){ return {name:k,debt:debtCustMap[k]}; }).sort(function(a,b){ return b.debt-a.debt; }).slice(0,5);

      // Supplier debts
      var suppDebt = suppliers.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
      var topSuppDebt = suppliers.filter(function(s){ return (parseFloat(s.balance)||0)>0; }).sort(function(a,b){ return (parseFloat(b.balance)||0)-(parseFloat(a.balance)||0); }).slice(0,3);

      // Expense categories this month
      var expCats = {};
      expenses.filter(function(e){ return e.date&&e.date.startsWith(month); }).forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });

      // Stock value
      var stockValue = prods.reduce(function(a,p){ return a+(parseFloat(p.cost)||0)*(parseInt(p.qty)||0); },0);
      var lowStock   = prods.filter(function(p){ return p.qty<=(p.lowLevel||5)&&p.qty>0; });
      var outStock   = prods.filter(function(p){ return p.qty===0; });

      // Cash available
      var cashCollected = sales.filter(function(s){ return s.status==='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
      var partCollected = sales.filter(function(s){ return s.status==='Partial'; }).reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); },0);
      var salaryPaid    = payroll.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); },0);
      var cashAvail     = cashCollected + partCollected - monthExp - salaryPaid;

      var lines = [
        '=== BUSINESS INFORMATION ===',
        'Business Name: ' + (settings.bizName||'Rock Stone'),
        'Address: ' + (settings.bizAddress||'Monrovia, Liberia'),
        'Phone: ' + (settings.bizPhone||'N/A'),
        'Report Date: ' + now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}),
        'Currency: ' + cur,
        '',
        '=== TODAY\'S PERFORMANCE ===',
        'Today Sales: ' + cur + todayRev.toFixed(2) + ' (' + todaySales.length + ' transactions)',
        'Today COGS: ' + cur + todayCOGS.toFixed(2),
        'Today Gross Profit: ' + cur + (todayRev-todayCOGS).toFixed(2),
        'Today Manual Expenses: ' + cur + todayExp.toFixed(2),
        'Today Allocated Expenses: ' + cur + allocDay.toFixed(2) + '/day',
        'Today Net Profit: ' + cur + (todayRev-todayCOGS-todayExp-allocDay).toFixed(2),
        'Payment methods today: ' + JSON.stringify(payMethods),
        '',
        '=== THIS MONTH\'S PERFORMANCE ===',
        'Month Revenue: ' + cur + monthRev.toFixed(2) + ' (' + monthSales.length + ' sales)',
        'Month COGS: ' + cur + monthCOGS.toFixed(2),
        'Month Gross Profit: ' + cur + monthGross.toFixed(2) + ' (' + (monthRev>0?((monthGross/monthRev)*100).toFixed(1):0) + '% margin)',
        'Month Expenses: ' + cur + monthExp.toFixed(2),
        'Month Net Profit: ' + cur + monthNet.toFixed(2) + ' (' + (monthRev>0?((monthNet/monthRev)*100).toFixed(1):0) + '% margin)',
        '',
        '=== TOP PRODUCTS TODAY ===',
        topProds.map(function(p,i){ return (i+1)+'. '+p.name+': '+cur+p.rev.toFixed(2)+' ('+p.qty+' units, profit: '+cur+p.profit.toFixed(2)+')'; }).join('\n') || 'No sales today',
        '',
        '=== EXPENSE BREAKDOWN (MONTH) ===',
        Object.keys(expCats).map(function(k){ return k+': '+cur+expCats[k].toFixed(2); }).join('\n') || 'No expenses this month',
        'Allocated (recurring): ' + cur + (allocDay*30).toFixed(2) + '/month (' + cur + allocDay.toFixed(2) + '/day)',
        '',
        '=== CASH & COLLECTIONS ===',
        'Cash Available (est.): ' + cur + cashAvail.toFixed(2),
        'Total Collected (Paid invoices): ' + cur + cashCollected.toFixed(2),
        'Partial Payments Collected: ' + cur + partCollected.toFixed(2),
        'Outstanding Customer Debt: ' + cur + totalDebt.toFixed(2),
        'Outstanding Supplier Debt: ' + cur + suppDebt.toFixed(2),
        'Net Receivable: ' + cur + (totalDebt-suppDebt).toFixed(2),
        '',
        '=== TOP CUSTOMER DEBTORS ===',
        topDebtors.map(function(d,i){ return (i+1)+'. '+d.name+': '+cur+d.debt.toFixed(2); }).join('\n') || 'No outstanding debts',
        '',
        '=== SUPPLIER BALANCES ===',
        topSuppDebt.map(function(s,i){ return (i+1)+'. '+s.name+': '+cur+(parseFloat(s.balance)||0).toFixed(2); }).join('\n') || 'All suppliers paid',
        'Total suppliers: ' + suppliers.length,
        '',
        '=== INVENTORY STATUS ===',
        'Total products: ' + prods.length,
        'Stock value (at cost): ' + cur + stockValue.toFixed(2),
        'Low stock products (' + lowStock.length + '): ' + lowStock.slice(0,5).map(function(p){ return p.name+'('+p.qty+')'; }).join(', '),
        'Out of stock (' + outStock.length + '): ' + outStock.slice(0,5).map(function(p){ return p.name; }).join(', '),
        '',
        '=== CUSTOMERS ===',
        'Total customers: ' + custs.length,
        'Customers with debt: ' + topDebtors.length,
        '',
        '=== SALARY ===',
        'Total salary paid: ' + cur + salaryPaid.toFixed(2),
        'Employees: ' + (DB.getEmployees ? DB.getEmployees().length : 0),
      ];

      return lines.join('\n');
    } catch(e) {
      return 'Error gathering business data: ' + e.message;
    }
  },

  // ── SIMPLE CONTEXT for regular chat ─────────────────────────────────────────
  _context: function() {
    try {
      var s = DB.stats();
      var settings = DB.getSettings();
      var cur = settings.currency||'$';
      var custs = DB.getCustomers();
      var sales = DB.getSales();
      return [
        'Business: ' + (settings.bizName||'My Store'),
        'Currency: ' + cur,
        'Products: ' + DB.getProducts().filter(function(p){ return p.status!=='inactive'; }).length + ' active',
        'Low stock (' + s.lowStock.length + '): ' + s.lowStock.slice(0,5).map(function(p){ return p.name+'('+p.qty+')'; }).join(', '),
        'Out of stock (' + s.outStock.length + '): ' + s.outStock.slice(0,3).map(function(p){ return p.name; }).join(', '),
        'Total revenue this month: ' + cur + s.totalRev.toFixed(2),
        'Total expenses this month: ' + cur + s.totalExp.toFixed(2),
        'Net profit: ' + cur + s.netProfit.toFixed(2),
        'Today revenue: ' + cur + s.todayRev.toFixed(2) + ' (' + s.todayCount + ' sales)',
        'Total customers: ' + custs.length,
        'Total sales (all time): ' + sales.length,
      ].join('\n');
    } catch(e) { return 'Business data unavailable.'; }
  },

  // ── GENERATE FULL BUSINESS REPORT ──────────────────────────────────────────
  generateFullReport: function() {
    if (this.busy) { Toast.show('AI is busy, please wait','warn'); return; }
    var settings = DB.getSettings();
    var bizName  = settings.bizName || 'Rock Stone';
    var today    = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

    // Show a loading card in the chat
    this._addUser('📋 Generate Full Daily Business Management Report for ' + today);
    this.history.push({role:'user', content:'Generate a complete professional Daily Business Management Report as a Chartered Accountant and Financial Analyst. Use ALL the business data provided. Include: Executive Summary, Sales Analysis, Profit Analysis (Gross & Net), Expense Analysis, Cash Flow Analysis, Debt Analysis (customer & supplier), Inventory Analysis, Business Health Score out of 100, and AI Accountant Recommendations. Use professional accounting standards. Format clearly with sections, show all calculations, highlight profits in positive terms and losses clearly. End with a Final Management Summary table.'});

    var systemPrompt = 'You are a Professional Chartered Accountant, Financial Analyst, Inventory Auditor, and Business Consultant reporting directly to the business owner.\n\nBUSINESS DATA (LIVE FROM SYSTEM):\n' + this._buildFullContext() + '\n\nGENERATE A COMPLETE DAILY BUSINESS MANAGEMENT REPORT following this structure:\n1. EXECUTIVE SUMMARY\n2. SALES ANALYSIS (revenue, transactions, avg value, payment methods, top products)\n3. PROFIT ANALYSIS (Gross Profit, Gross Margin%, Net Profit, Net Margin%)\n4. EXPENSE ANALYSIS (by category, largest expense, % of revenue)\n5. CASH FLOW ANALYSIS (cash in, cash out, available cash, outstanding debts)\n6. DEBT ANALYSIS (customer debts top 5, supplier balances, net receivable position)\n7. INVENTORY ANALYSIS (stock value, low stock, out of stock, recommendations)\n8. BUSINESS HEALTH SCORE /100 (score profitability, cash flow, inventory, debt, sales, expenses)\n9. AI ACCOUNTANT RECOMMENDATIONS (5-7 specific actionable recommendations)\n10. FINAL MANAGEMENT SUMMARY TABLE\n\nUse professional language. Show all formulas and calculations. Be specific with numbers from the data. Mark profits with ✅, losses with ❌, warnings with ⚠️.';

    this.busy = true;
    var btn = Utils.get('ai-send-btn');
    if (btn) btn.textContent = '⏳';
    this._setStatus('Generating report…', '#F59E0B');
    var tid = 'at-' + Date.now();
    this._addTyping(tid);

    var self = this;
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{role:'user', content:'Generate the complete Daily Business Management Report now. Be thorough and professional.'}],
      }),
    }).then(function(res){ return res.json(); })
    .then(function(data) {
      self._rmTyping(tid);
      self.busy = false;
      if (btn) btn.textContent = '➤';
      if (data.content && data.content[0] && data.content[0].text) {
        var report = data.content[0].text;
        self._addReport(report, bizName, today);
        self.history.push({role:'assistant', content:report});
        self._setStatus('Report ready ✓', 'var(--ok)');
        Toast.show('Full business report generated ✓','ok');
      } else {
        self._addBot('⚠️ ' + (data.error ? data.error.message : 'Could not generate report. Please try again.'));
        self._setStatus('Ready', 'var(--ok)');
      }
    }).catch(function(err) {
      self._rmTyping(tid);
      self.busy = false;
      if (btn) btn.textContent = '➤';
      self._setStatus('Error', 'var(--er)');
      self._addBot('⚠️ Error: ' + err.message);
    });
  },

  // ── RENDER THE REPORT WITH RICH FORMATTING ───────────────────────────────────
  _addReport: function(text, bizName, date) {
    var msgs = Utils.get('ai-msgs'); if (!msgs) return;

    // Build the formatted report card
    var d = document.createElement('div');
    d.className = 'ai-bot';
    d.style.cssText = 'background:var(--bg2);border:1px solid rgba(201,168,76,.25);border-radius:var(--r14);padding:0;overflow:hidden;max-width:100%';

    // Report header
    var header = '<div style="background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.05));border-bottom:1px solid rgba(201,168,76,.2);padding:14px 16px;display:flex;align-items:center;justify-content:space-between">'
      + '<div>'
      + '<div style="font-size:13px;font-weight:800;color:var(--g);letter-spacing:.04em">📋 DAILY BUSINESS MANAGEMENT REPORT</div>'
      + '<div style="font-size:11px;color:var(--t2);margin-top:2px">' + bizName + ' · ' + date + '</div>'
      + '</div>'
      + '<button onclick="AI.printReport(this)" style="background:var(--gb);border:1px solid rgba(201,168,76,.3);color:var(--g);padding:6px 12px;border-radius:var(--r8);font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0">🖨 Print</button>'
      + '</div>';

    // Format the report body
    var body = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      // Section headers (lines starting with === or ##)
      .replace(/={3,}([^=]+)={3,}/g, function(m, title) {
        return '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;padding:14px 16px 6px;margin-top:4px;border-top:1px solid var(--bd)">' + title.trim() + '</div>';
      })
      .replace(/^#{1,3} (.+)$/gm, function(m, title) {
        return '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;padding:14px 16px 6px;margin-top:4px;border-top:1px solid var(--bd)">' + title + '</div>';
      })
      // Bold text
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      // Profit indicator lines
      .replace(/(✅[^\n]+)/g,'<span style="color:var(--ok);font-weight:600">$1</span>')
      .replace(/(❌[^\n]+)/g,'<span style="color:var(--er);font-weight:600">$1</span>')
      .replace(/(⚠️[^\n]+)/g,'<span style="color:var(--wa);font-weight:600">$1</span>')
      // Bullet points
      .replace(/^[•\-\*] (.+)$/gm,'<div style="padding:3px 16px 3px 24px;font-size:13px;color:var(--t1)">• $1</div>')
      // Number lines (metrics)
      .replace(/^(\d+\.\s.+)$/gm,'<div style="padding:3px 16px;font-size:13px;color:var(--t1)">$1</div>')
      // Table rows (| separated)
      .replace(/^\|(.+)\|$/gm, function(m, cells) {
        var cols = cells.split('|').map(function(c){ return c.trim(); });
        var isHeader = cols.some(function(c){ return /^[-:]+$/.test(c); });
        if (isHeader) return '';
        var tdHtml = cols.map(function(c,i){
          var color = '';
          if (c.match(/^\d/) || c.match(/^\$/)) {
            if (c.match(/^-/) || c.match(/loss|❌/i)) color = 'color:var(--er)';
            else color = 'color:var(--ok)';
          }
          return '<td style="padding:6px 10px;border:1px solid var(--bd);font-size:12px;font-weight:'+(i===0?'600':'400')+';'+color+'">' + c + '</td>';
        }).join('');
        return '<tr>' + tdHtml + '</tr>';
      })
      // Wrap all table rows in a table
      .replace(/(<tr>[\s\S]*?<\/tr>)+/g, function(rows) {
        return '<div style="padding:8px 16px;overflow-x:auto"><table style="width:100%;border-collapse:collapse">' + rows + '</table></div>';
      })
      // Newlines to paragraphs
      .replace(/\n\n+/g,'</p><p style="padding:4px 16px;font-size:13px;color:var(--t1)">')
      .replace(/\n/g,'<br>');

    var bodyHtml = '<div style="padding:4px 0 14px">'
      + '<p style="padding:4px 16px;font-size:13px;color:var(--t1)">' + body + '</p>'
      + '</div>';

    d.innerHTML = header + bodyHtml;
    // Store raw text for printing
    d.dataset.reportText = text;
    d.dataset.reportBiz  = bizName;
    d.dataset.reportDate = date;

    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  },

  // ── PRINT REPORT ──────────────────────────────────────────────────────────
  printReport: function(btn) {
    var card = btn ? btn.closest('.ai-bot') : null;
    var text = card ? card.dataset.reportText : '';
    var biz  = card ? card.dataset.reportBiz  : (DB.getSettings().bizName||'Rock Stone');
    var date = card ? card.dataset.reportDate  : new Date().toLocaleDateString();
    var settings = DB.getSettings();

    var logoHtml = settings.bizLogo
      ? '<div style="text-align:center;margin-bottom:8px"><img src="'+settings.bizLogo+'" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid #ddd"></div>'
      : '';

    var css = 'body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:15mm;max-width:210mm;margin:0 auto}'
      + 'h1{font-size:20px;font-weight:900;margin:0 0 2px;text-align:center}'
      + 'h2{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #333;padding-bottom:4px;margin:16px 0 6px;color:#333}'
      + 'p{font-size:12px;line-height:1.6;margin:4px 0}'
      + 'ul,ol{margin:4px 0 4px 18px;font-size:12px}'
      + 'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}'
      + 'th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}'
      + 'th{background:#f0f0f0;font-weight:700}'
      + '.ok{color:#16a34a;font-weight:700}.er{color:#dc2626;font-weight:700}.wa{color:#d97706;font-weight:700}'
      + '@media print{@page{size:A4;margin:12mm}}';

    // Format text for print
    var printBody = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/={3,}([^=]+)={3,}/g,'<h2>$1</h2>')
      .replace(/^#{1,3} (.+)$/gm,'<h2>$1</h2>')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/(✅[^\n]+)/g,'<span class="ok">$1</span>')
      .replace(/(❌[^\n]+)/g,'<span class="er">$1</span>')
      .replace(/(⚠️[^\n]+)/g,'<span class="wa">$1</span>')
      .replace(/^\|(.+)\|$/gm, function(m, cells) {
        var cols = cells.split('|').map(function(c){ return c.trim(); });
        if (cols.every(function(c){ return /^[-: ]+$/.test(c); })) return '';
        return '<tr>' + cols.map(function(c){ return '<td>'+c+'</td>'; }).join('') + '</tr>';
      })
      .replace(/(<tr>[\s\S]*?<\/tr>)+/g,'<table>$&</table>')
      .replace(/\n/g,'<br>');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Business Report</title><style>'+css+'</style></head><body>'
      + logoHtml
      + '<h1>' + biz + '</h1>'
      + '<p style="text-align:center;color:#555;font-size:11px">DAILY BUSINESS MANAGEMENT REPORT &nbsp;|&nbsp; ' + date + '</p>'
      + '<p style="text-align:center;color:#555;font-size:10px">Generated by SmartStock AI &nbsp;|&nbsp; ' + new Date().toLocaleString() + '</p>'
      + '<hr style="border:1px solid #333;margin:10px 0">'
      + printBody
      + '</body></html>';

    if (typeof Sales !== 'undefined' && Sales._printHtml) {
      Sales._printHtml(html, 'ai-report-frame');
    } else {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
      setTimeout(function(){ try{f.contentWindow.print();}catch(e){ window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank'); } }, 600);
    }
  },

  // ── REGULAR CHAT SEND ────────────────────────────────────────────────────────
  send: async function() {
    if (this.busy) return;
    var inp = Utils.get('ai-inp');
    var q   = inp ? inp.value.trim() : '';
    if (!q) return;
    inp.value = ''; inp.style.height = 'auto';
    this._addUser(q);
    this.history.push({role:'user', content:q});
    this.busy = true;
    var btn = Utils.get('ai-send-btn');
    if (btn) btn.textContent = '⏳';
    this._setStatus('Thinking…', '#F59E0B');
    var tid = 'at-' + Date.now();
    this._addTyping(tid);
    var self = this;
    try {
      var res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: 'You are SmartStock AI — expert business assistant and accountant.\n\nLIVE DATA:\n' + this._context() + '\n\nBe concise, practical, and use bullet points. Always give specific numbers from the data.',
          messages: this.history.slice(-10),
        }),
      });
      var data = await res.json();
      this._rmTyping(tid);
      this.busy = false;
      if (btn) btn.textContent = '➤';
      this._setStatus('Ready', 'var(--ok)');
      if (data.content && data.content[0] && data.content[0].text) {
        var ans = data.content[0].text;
        this._addBot(ans);
        this.history.push({role:'assistant', content:ans});
        if (this.history.length > 20) this.history = this.history.slice(-20);
      } else {
        this._addBot('⚠️ ' + (data.error ? data.error.message : 'No response. Please try again.'));
      }
    } catch(err) {
      this._rmTyping(tid);
      this.busy = false;
      if (btn) btn.textContent = '➤';
      this._setStatus('Error', 'var(--er)');
      this._addBot('⚠️ Error: ' + err.message + '\nCheck your internet connection.');
    }
  },

  ask: function(q) { var inp = Utils.get('ai-inp'); if(inp){ inp.value=q; this.send(); } },

  clear: function() {
    this.history = []; this.inited = false;
    var msgs = Utils.get('ai-msgs'); if(msgs) msgs.innerHTML = '';
    this.render();
  },

  _setStatus: function(t,c) {
    var dot = document.querySelector('.ai-status-dot');
    var txt = Utils.get('ai-status-txt');
    if (dot) dot.style.background = c;
    if (txt) txt.textContent = t;
  },

  _addUser: function(text) {
    var msgs = Utils.get('ai-msgs'); if (!msgs) return;
    var d = document.createElement('div'); d.className = 'ai-user'; d.textContent = text;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _addBot: function(text) {
    var msgs = Utils.get('ai-msgs'); if (!msgs) return;
    var d = document.createElement('div'); d.className = 'ai-bot';
    var html = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/^[•\-\*] (.+)/gm,'<span class="ai-bot-li">• $1</span>')
      .replace(/(✅[^\n]+)/g,'<span style="color:var(--ok)">$1</span>')
      .replace(/(❌[^\n]+)/g,'<span style="color:var(--er)">$1</span>')
      .replace(/(⚠️[^\n]+)/g,'<span style="color:var(--wa)">$1</span>')
      .replace(/\n/g,'<br>');
    d.innerHTML = html;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _addTyping: function(id) {
    var msgs = Utils.get('ai-msgs'); if (!msgs) return;
    var d = document.createElement('div'); d.id = id; d.className = 'ai-bot';
    d.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _rmTyping: function(id) { var e = Utils.get(id); if(e) e.remove(); },
};


/* === settings.js === */
var Settings = {


  // ═══ SHARED RECEIPT/REPORT HEADER BUILDER ════════════════════════════════
  // Used by sales receipts, daily reports, and finance summaries
  // Returns HTML string for the top of any printed document
  _buildReceiptHeader: function(settings) {
    var bizName    = settings.bizName    || 'SmartStock Pro';
    var bizAddress = settings.bizAddress || '';
    var bizPhone   = settings.bizPhone   || '';
    var bizEmail   = settings.bizEmail   || '';
    var bizLogo    = settings.bizLogo    || '';

    var logoHtml = bizLogo
      ? '<div style="text-align:center;margin-bottom:8px"><img src="'+bizLogo+'" alt="Logo" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #ddd"></div>'
      : '';

    return logoHtml
      + '<div class="center bold lg">'+bizName+'</div>'
      + (bizAddress ? '<div class="center sm">'+bizAddress+'</div>' : '')
      + (bizPhone   ? '<div class="center sm">Tel: '+bizPhone+'</div>' : '')
      + (bizEmail   ? '<div class="center sm">'+bizEmail+'</div>'    : '');
  },

  render: function() {
    var pg   = Utils.get('pg-settings');
    if (!pg) return;
    var s    = DB.getSettings();
    var user = Auth.currentUser || {};

    var bizLogo  = s.bizLogo  || '';
    var userPic  = user.photo || '';

    var bizLogoHtml = bizLogo
      ? '<img src="'+bizLogo+'" alt="Logo" style="width:56px;height:56px;border-radius:var(--r12);object-fit:cover;border:2px solid rgba(201,168,76,.3)">'
      : '<div style="width:56px;height:56px;border-radius:var(--r12);background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#07080D;border:2px solid rgba(201,168,76,.3)">'+(s.bizName?s.bizName[0].toUpperCase():'S')+'</div>';

    var userInitial = user.name?user.name[0].toUpperCase():(user.username?user.username[0].toUpperCase():'U');
    var userPicHtml = userPic
      ? '<img src="'+userPic+'" alt="Photo" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,.3)">'
      : '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#07080D;border:2px solid rgba(201,168,76,.3)">'+userInitial+'</div>';

    pg.innerHTML = ''

      + '<div class="page-header">'
      + '<div><div class="page-title">Settings</div><div class="page-sub">App configuration</div></div>'
      + '</div>'

      // ── PROFILE PICTURES ──────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Profile Pictures</div>'
      + '<div class="card">'

      + '<div class="settings-item" style="align-items:flex-start;gap:12px;padding:14px">'
      + '<div style="flex-shrink:0;margin-top:2px">'+bizLogoHtml+'</div>'
      + '<div class="settings-info" style="flex:1">'
      + '<div class="settings-name">Business Logo</div>'
      + '<div class="settings-desc">'+Utils.esc(s.bizName||'SmartStock Pro')+'</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px">Shown on receipts, reports &amp; topbar</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
      + '<button class="btn-ghost btn-sm" onclick="Settings.pickBizLogo()" style="font-size:11px;white-space:nowrap">📷 Change</button>'
      + (bizLogo?'<button class="btn-danger btn-sm" onclick="Settings.removeBizLogo()" style="font-size:11px">✕ Remove</button>':'')
      + '</div>'
      + '</div>'
      + '<input type="file" id="biz-logo-input" accept="image/*" style="display:none" onchange="Settings.onBizLogoSelected(this)">'

      + '<div class="settings-item" style="align-items:flex-start;gap:12px;padding:14px;border-top:1px solid var(--bd)">'
      + '<div style="flex-shrink:0;margin-top:2px">'+userPicHtml+'</div>'
      + '<div class="settings-info" style="flex:1">'
      + '<div class="settings-name">My Profile Photo</div>'
      + '<div class="settings-desc">'+Utils.esc(user.name||user.username||'User')+' · '+Utils.esc(user.role||'Owner')+'</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px">Shown in the topbar top-right corner</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
      + '<button class="btn-ghost btn-sm" onclick="Settings.pickUserPhoto()" style="font-size:11px;white-space:nowrap">📷 Change</button>'
      + (userPic?'<button class="btn-danger btn-sm" onclick="Settings.removeUserPhoto()" style="font-size:11px">✕ Remove</button>':'')
      + '</div>'
      + '</div>'
      + '<input type="file" id="user-photo-input" accept="image/*" style="display:none" onchange="Settings.onUserPhotoSelected(this)">'

      + '</div></div>'

      // ── BUSINESS INFORMATION ──────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Business Information</div>'
      + '<div class="card">'
      + '<div class="settings-item" onclick="Settings.openBizModal()">'
      + '<div class="settings-icon" style="background:var(--gb)">🏢</div>'
      + '<div class="settings-info">'
      + '<div class="settings-name">'+Utils.esc(s.bizName||'SmartStock Pro')+'</div>'
      + (s.bizAddress?'<div style="font-size:11px;color:var(--t2);margin-top:2px">📍 '+Utils.esc(s.bizAddress)+'</div>':'<div style="font-size:11px;color:var(--t3);margin-top:2px">No address set</div>')
      + (s.bizPhone  ?'<div style="font-size:11px;color:var(--t2);margin-top:1px">📞 '+Utils.esc(s.bizPhone)+'</div>':'')
      + (s.bizEmail  ?'<div style="font-size:11px;color:var(--t2);margin-top:1px">✉️ '+Utils.esc(s.bizEmail)+'</div>':'')
      + '</div>'
      + '<div class="settings-arrow">›</div></div>'
      + '</div></div>'

      // ── SETTINGS ─────────────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Settings</div>'
      + '<div class="card">'
      + '<div class="settings-item" onclick="Settings.openCurrencyModal()">'
      + '<div class="settings-icon" style="background:var(--gb)">💱</div>'
      + '<div class="settings-info"><div class="settings-name">Currency</div>'
      + '<div class="settings-desc">'+Utils.esc(s.currency||'$')+'</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item" onclick="Settings.openLowStockModal()">'
      + '<div class="settings-icon" style="background:var(--wab)">⚠️</div>'
      + '<div class="settings-info"><div class="settings-name">Low Stock Alert Level</div>'
      + '<div class="settings-desc">Alert when stock ≤ '+(s.lowStock||5)+'</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item">'
      + '<div class="settings-icon" style="background:var(--bg3)">🌙</div>'
      + '<div class="settings-info"><div class="settings-name">Dark Mode</div>'
      + '<div class="settings-desc">Premium dark theme</div></div>'
      + '<div class="toggle '+(s.theme!=='light'?'on':'')+'" onclick="Settings.toggleTheme()"></div>'
      + '</div></div></div>'

      // ── ACCOUNT ───────────────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Account</div>'
      + '<div class="card">'
      + '<div class="settings-item">'
      + '<div style="flex-shrink:0">'
      + (userPic?'<img src="'+userPic+'" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover">':'<div class="settings-icon" style="background:var(--inb)">👤</div>')
      + '</div>'
      + '<div class="settings-info"><div class="settings-name">'+Utils.esc(user.name||'User')+'</div>'
      + '<div class="settings-desc">'+Utils.esc(user.username||'')+' · '+Utils.esc(user.role||'Owner')+'</div></div>'
      + '</div>'
      + '<div class="settings-item" onclick="Settings.openPasswordModal()">'
      + '<div class="settings-icon" style="background:var(--wab)">🔑</div>'
      + '<div class="settings-info"><div class="settings-name">Change Password</div>'
      + '<div class="settings-desc">Update your password</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '</div></div>'

      // ── DATA ──────────────────────────────────────────────────────────────
      + '<div class="settings-section">'
      + '<div class="settings-title">Data</div>'
      + '<div class="card">'
      + '<div class="settings-item" onclick="Settings.exportData()">'
      + '<div class="settings-icon" style="background:var(--okb)">📥</div>'
      + '<div class="settings-info"><div class="settings-name">Export Backup</div>'
      + '<div class="settings-desc">Download all data as JSON</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '<div class="settings-item" onclick="Settings.openImportModal()">'
      + '<div class="settings-icon" style="background:var(--inb)">📤</div>'
      + '<div class="settings-info"><div class="settings-name">Import Backup</div>'
      + '<div class="settings-desc">Restore from backup file</div></div>'
      + '<div class="settings-arrow">›</div></div>'
      + '</div></div>'

      + '<div class="sec" style="padding-top:0">'
      + '<button class="btn-danger btn-full" onclick="Auth.logout()">🚪 Sign Out</button>'
      + '</div>';
  },

  // ═══ BUSINESS LOGO ═══════════════════════════════════════════════════════
  pickBizLogo: function() { var el=Utils.get('biz-logo-input'); if(el) el.click(); },

  onBizLogoSelected: function(input) {
    var file=input.files&&input.files[0]; if(!file) return;
    if(file.size>2*1024*1024){ Toast.show('Max 2MB','err'); input.value=''; return; }
    Toast.show('Processing…','ok');
    var reader=new FileReader();
    reader.onload=function(e){
      Settings._resizeImage(e.target.result,400,400,function(resized){
        DB.saveSettings({bizLogo:resized});
        Settings._applyBizLogo(resized);
        Toast.show('Business logo updated ✓','ok');
        Settings.render();
      });
    };
    reader.readAsDataURL(file); input.value='';
  },

  removeBizLogo: function() {
    DB.saveSettings({bizLogo:''});
    Settings._applyBizLogo('');
    Toast.show('Logo removed','warn');
    Settings.render();
  },

  _applyBizLogo: function(src) {
    var imgEl=Utils.get('tb-logo-img');
    var emojiEl=Utils.get('tb-logo-emoji');
    if(src){
      if(imgEl){ imgEl.src=src; imgEl.style.display='block'; }
      if(emojiEl) emojiEl.style.display='none';
    } else {
      if(imgEl) imgEl.style.display='none';
      if(emojiEl) emojiEl.style.display='block';
    }
  },

  // ═══ USER PHOTO ══════════════════════════════════════════════════════════
  pickUserPhoto: function() { var el=Utils.get('user-photo-input'); if(el) el.click(); },

  onUserPhotoSelected: function(input) {
    var file=input.files&&input.files[0]; if(!file) return;
    if(file.size>2*1024*1024){ Toast.show('Max 2MB','err'); input.value=''; return; }
    Toast.show('Processing…','ok');
    var reader=new FileReader();
    reader.onload=function(e){
      Settings._resizeImage(e.target.result,300,300,function(resized){
        var users=DB.get('users')||[];
        var user=Auth.currentUser;
        if(user){
          for(var i=0;i<users.length;i++){
            if(users[i].id===user.id){ users[i].photo=resized; break; }
          }
          DB.set('users',users);
          Auth.currentUser.photo=resized;
        }
        Settings._applyUserPhoto(resized,user);
        Toast.show('Profile photo updated ✓','ok');
        Settings.render();
      });
    };
    reader.readAsDataURL(file); input.value='';
  },

  removeUserPhoto: function() {
    var users=DB.get('users')||[];
    var user=Auth.currentUser;
    if(user){
      for(var i=0;i<users.length;i++){
        if(users[i].id===user.id){ delete users[i].photo; break; }
      }
      DB.set('users',users);
      delete Auth.currentUser.photo;
    }
    Settings._applyUserPhoto('',user);
    Toast.show('Photo removed','warn');
    Settings.render();
  },

  _applyUserPhoto: function(src,user) {
    var el=Utils.get('tb-avatar'); if(!el) return;
    if(src){
      el.innerHTML='<img src="'+src+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    } else {
      var init=user&&user.name?user.name[0].toUpperCase():(user&&user.username?user.username[0].toUpperCase():'U');
      el.innerHTML=init;
    }
  },

  // ═══ IMAGE RESIZE ════════════════════════════════════════════════════════
  _resizeImage: function(src,maxW,maxH,callback){
    var img=new Image();
    img.onload=function(){
      var w=img.width,h=img.height;
      if(w>maxW||h>maxH){ var r=Math.min(maxW/w,maxH/h); w=Math.round(w*r); h=Math.round(h*r); }
      var c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      callback(c.toDataURL('image/jpeg',0.8));
    };
    img.onerror=function(){ callback(src); };
    img.src=src;
  },

  // ═══ BUSINESS INFO MODAL ═════════════════════════════════════════════════
  openBizModal: function() {
    var s=DB.getSettings();
    Modal.open({
      title:'Business Information',
      sub:'Appears on all receipts, reports and documents',
      barColor:'var(--g)',
      body:'<div class="fg"><label class="fl">Business Name *</label>'
          +'<input class="fi" id="set-biz" value="'+Utils.esc(s.bizName||'')+'" placeholder="e.g. Rock Stone"></div>'
          +'<div class="fg"><label class="fl">Address</label>'
          +'<input class="fi" id="set-addr" value="'+Utils.esc(s.bizAddress||'')+'" placeholder="e.g. Broad Street, Monrovia, Liberia"></div>'
          +'<div class="form-row">'
          +'<div class="fg"><label class="fl">Phone Number</label>'
          +'<input class="fi" id="set-phone" type="tel" value="'+Utils.esc(s.bizPhone||'')+'" placeholder="+231 77 000 000"></div>'
          +'<div class="fg"><label class="fl">Email</label>'
          +'<input class="fi" id="set-email" type="email" value="'+Utils.esc(s.bizEmail||'')+'" placeholder="info@business.com"></div>'
          +'</div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.saveBiz()">💾 Save</button>',
    });
  },

  saveBiz: function() {
    var name=Utils.val('set-biz');
    if(!name){ Toast.show('Business name is required','err'); return; }
    DB.saveSettings({
      bizName:name,
      bizAddress:Utils.val('set-addr'),
      bizPhone:Utils.val('set-phone'),
      bizEmail:Utils.val('set-email'),
    });
    var el=Utils.get('tb-biz-name'); if(el) el.textContent=name;
    var sub=Utils.get('tb-biz-sub');
    if(sub){ var s2=DB.getSettings(); sub.textContent=s2.bizPhone||s2.bizAddress||'Business Manager'; }
    Toast.show('Business info updated ✓','ok');
    Modal.close();
    Settings.render();
  },

  // ═══ CURRENCY ════════════════════════════════════════════════════════════
  openCurrencyModal: function() {
    var s=DB.getSettings();
    var currencies=[['$','USD — Dollar'],['€','EUR — Euro'],['£','GBP — Pound'],
      ['L$','LRD — Liberian Dollar'],['₦','NGN — Naira'],['₵','GHS — Cedi'],['R','ZAR — Rand'],['Ksh','KES — Shilling']];
    Modal.open({
      title:'Currency',
      body:'<div class="fg"><label class="fl">Select Currency</label>'
          +'<select class="fi" id="set-cur">'
          +currencies.map(function(c){ return '<option value="'+c[0]+'"'+(s.currency===c[0]?' selected':'')+'>'+c[1]+' ('+c[0]+')</option>'; }).join('')
          +'</select></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.saveCurrency()">Save</button>',
    });
  },

  saveCurrency: function() {
    var el=Utils.get('set-cur');
    DB.saveSettings({currency:el?el.value:'$'});
    Toast.show('Currency updated ✓','ok');
    Modal.close();
    Settings.render();
  },

  // ═══ LOW STOCK ═══════════════════════════════════════════════════════════
  openLowStockModal: function() {
    var s=DB.getSettings();
    Modal.open({
      title:'Low Stock Alert',
      body:'<div class="fg"><label class="fl">Alert when stock is at or below</label>'
          +'<input class="fi" id="set-low" type="number" value="'+(s.lowStock||5)+'" min="1"></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.saveLowStock()">Save</button>',
    });
  },

  saveLowStock: function() {
    DB.saveSettings({lowStock:parseInt(Utils.val('set-low')||5)});
    Toast.show('Updated ✓','ok');
    Modal.close();
    Settings.render();
    Notifs.check();
  },

  // ═══ THEME ═══════════════════════════════════════════════════════════════
  toggleTheme: function() {
    var s=DB.getSettings();
    var next=s.theme==='light'?'dark':'light';
    DB.saveSettings({theme:next});
    UI.applyTheme(next);
    Settings.render();
  },

  // ═══ PASSWORD ════════════════════════════════════════════════════════════
  openPasswordModal: function() {
    Modal.open({
      title:'Change Password', barColor:'var(--wa)',
      body:'<div class="fg"><label class="fl">Current Password</label><input class="fi" id="pw-old" type="password"></div>'
          +'<div class="fg"><label class="fl">New Password (min 6)</label><input class="fi" id="pw-new" type="password"></div>'
          +'<div class="fg"><label class="fl">Confirm New Password</label><input class="fi" id="pw-conf" type="password"></div>',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.changePassword()">Update</button>',
    });
  },

  changePassword: async function() {
    var oldPw=Utils.val('pw-old'), newPw=Utils.val('pw-new'), conf=Utils.val('pw-conf');
    if(!oldPw||!newPw){ Toast.show('All fields required','err'); return; }
    if(newPw.length<6){ Toast.show('Min 6 characters','err'); return; }
    if(newPw!==conf){ Toast.show('Passwords do not match','err'); return; }
    var user=Auth.currentUser;
    var ok=await Auth._verifyPw(oldPw,user.password);
    if(!ok){ Toast.show('Current password is wrong','err'); return; }
    var hashed=await Auth._hashPw(newPw);
    var users=DB.get('users');
    for(var i=0;i<users.length;i++){ if(users[i].id===user.id){ users[i].password=hashed; break; } }
    DB.set('users',users);
    Toast.show('Password updated ✓','ok');
    Modal.close();
  },

  // ═══ EXPORT / IMPORT ═════════════════════════════════════════════════════
  exportData: function() {
    var json=JSON.stringify(DB._data,null,2);
    var a=document.createElement('a');
    a.href='data:application/json;charset=utf-8,'+encodeURIComponent(json);
    a.download='smartstock_backup_'+Utils.today()+'.json';
    a.click();
    Toast.show('Backup downloaded ✓','ok');
  },

  openImportModal: function() {
    Modal.open({
      title:'Import Backup',
      body:'<p style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6">Select a SmartStock backup JSON file. This will REPLACE all current data.</p>'
          +'<input type="file" id="import-file" accept=".json" class="fi">',
      footer:'<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            +'<button class="btn-primary" style="flex:1" onclick="Settings.importData()">Import</button>',
    });
  },

  importData: function() {
    var fileEl=Utils.get('import-file');
    var file=fileEl&&fileEl.files&&fileEl.files[0];
    if(!file){ Toast.show('Select a file','err'); return; }
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        DB._data=JSON.parse(e.target.result);
        DB.save();
        Toast.show('Data imported ✓','ok');
        Modal.close();
        location.reload();
      } catch(err){ Toast.show('Invalid backup file','err'); }
    };
    reader.readAsText(file);
  },
};


/* === more.js === */
var MorePage = {
  render: function() {
    var pg = Utils.get('pg-more');
    if (!pg) return;
    var sections = [
      {
        label: 'Business',
        items: [
          { icon:'📄', label:'Quotations',         desc:'Create & manage client quotations', bg:'var(--inb)', action:"Router.go('quotations')", badge:'NEW' },
          { icon:'🤖', label:'AI Assistant',        desc:'Ask Claude about your business',   bg:'var(--gb)',  action:"Router.go('ai')" },
          { icon:'🏭', label:'Suppliers',           desc:'Manage your suppliers',            bg:'var(--wab)', action:"Router.go('suppliers')" },
          { icon:'🚚', label:'Supply Management',  desc:'Purchase orders, GRN & bills',     bg:'var(--inb)', action:"Router.go('supply')", badge:'NEW' },
          { icon:'💰', label:'Salary & Payroll',   desc:'Manage employee salaries',         bg:'var(--okb)', action:"Router.go('salary')" },
        ]
      },
      {
        label: 'Finance',
        items: [
          { icon:'📊', label:'Finance Overview',   desc:'P&L, Cash Flow, margins',          bg:'var(--inb)', action:"Router.go('finance')" },
          { icon:'📋', label:'Reports',            desc:'Financial performance reports',    bg:'var(--wab)', action:"Router.go('reports')" },
          { icon:'📅', label:'Daily Report',       desc:"Print today's daily report",       bg:'var(--gb)',  action:"Reports.switchToDaily ? Reports.switchToDaily() : null; Router.go('reports')" },
          { icon:'📅', label:'Expense Allocations',desc:'Set up recurring cost allocations',bg:'rgba(245,158,11,.12)', action:"Allocations.render ? Allocations.render() : null" },
        ]
      },
      {
        label: 'System',
        items: [
          { icon:'⚙️', label:'Settings',           desc:'App configuration & profile',      bg:'var(--gb)',  action:"Router.go('settings')" },
          { icon:'🔔', label:'Notifications',      desc:'Stock & salary alerts',            bg:'var(--erb)', action:"Notifs.check();UI.toggleNotifPanel()" },
          { icon:'📥', label:'Export Data',        desc:'Download backup as JSON',          bg:'var(--okb)', action:"Settings.exportData()" },
          { icon:'🌙', label:'Toggle Theme',       desc:'Switch dark / light mode',         bg:'var(--bg3)', action:"Settings.toggleTheme()" },
          { icon:'🚪', label:'Sign Out',           desc:'Log out of this account',          bg:'var(--erb)', action:"Auth.logout()", danger:true },
        ]
      }
    ];

    var html = '<div class="page-header"><div><div class="page-title">More</div><div class="page-sub">Features & settings</div></div></div>';
    sections.forEach(function(section) {
      html += '<div class="sec"><div class="sec-title">'+section.label+'</div><div class="card">';
      section.items.forEach(function(item) {
        var badge = item.badge ? '<span style="background:var(--g);color:#07080D;font-size:9px;font-weight:800;padding:2px 8px;border-radius:99px;flex-shrink:0">'+item.badge+'</span>' : '';
        html += '<div class="more-item" onclick="'+item.action+'">'
          +'<div class="more-icon" style="background:'+item.bg+'">'+item.icon+'</div>'
          +'<div class="more-text"><div class="more-name"'+(item.danger?' style="color:var(--er)"':'')+'>'+item.label+'</div>'
          +'<div class="more-desc">'+item.desc+'</div></div>'
          +badge
          +'<div class="more-arrow">&#8250;</div></div>';
      });
      html += '</div></div>';
    });
    pg.innerHTML = html;
  },
};

