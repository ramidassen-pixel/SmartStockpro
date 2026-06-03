/* DB Service — wraps MockData. Swap for Supabase calls. */
const DB = {
  products()          { return [...MockData.products]; },
  addProduct(p)       { p.id=Utils.uid('P'); MockData.products.push(p); return p; },
  updateProduct(id,d) { const i=MockData.products.findIndex(x=>x.id===id); if(i>-1) MockData.products[i]={...MockData.products[i],...d}; },
  deleteProduct(id)   { MockData.products=MockData.products.filter(x=>x.id!==id); },
  customers()         { return [...MockData.customers]; },
  addCustomer(c)      { c.id=Utils.uid('C'); c.purchases=0; c.total=0; MockData.customers.push(c); return c; },
  sales()             { return [...MockData.sales]; },
  addSale(s)          { s.id=Utils.uid('INV'); MockData.sales.unshift(s); return s; },
  expenses()          { return [...MockData.expenses]; },
  addExpense(e)       { e.id=Utils.uid('EXP'); MockData.expenses.push(e); return e; },
  deleteExpense(id)   { MockData.expenses=MockData.expenses.filter(x=>x.id!==id); },
  employees()         { return [...MockData.employees]; },
};