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
      businesses: [],
      branches: [],
      customRoles: [],
      auditLogs: [],
      activityLogs: [],
    };
  },

  load() {
    const raw = Utils.storage.get(this.KEY);
    this._data = raw || this._default();
    // Ensure all arrays exist
    const d = this._data;
    ['users','products','sales','customers','suppliers','expenses','employees','payroll','notifications','payments','allocations','purchaseOrders','grns','supplierBills','quotations','businesses','branches','customRoles','auditLogs','activityLogs']
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