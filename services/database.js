/* SmartStock Pro — Database Service
   Currently wraps MockData.
   Replace method bodies with Supabase calls:
     const {data,error} = await supabase.from('products').select('*');
*/
const DB = {
  // INVENTORY
  async getProducts()          { return [...MockData.inventory]; },
  async addProduct(p)          { MockData.inventory.push({...p,id:Utils.uid('P')});return p; },
  async updateProduct(id,data) { const i=MockData.inventory.findIndex(p=>p.id===id);if(i>-1)MockData.inventory[i]={...MockData.inventory[i],...data}; },
  async deleteProduct(id)      { MockData.inventory=MockData.inventory.filter(p=>p.id!==id); },

  // CUSTOMERS
  async getCustomers()         { return [...MockData.customers]; },
  async addCustomer(c)         { MockData.customers.push({...c,id:Utils.uid('C')});return c; },
  async updateCustomer(id,d)   { const i=MockData.customers.findIndex(c=>c.id===id);if(i>-1)MockData.customers[i]={...MockData.customers[i],...d}; },

  // SALES
  async getSales()             { return [...MockData.sales]; },
  async addSale(s)             { MockData.sales.unshift({...s,id:Utils.uid('INV')});return s; },

  // SUPPLIERS
  async getSuppliers()         { return [...MockData.suppliers]; },
  async addSupplier(s)         { MockData.suppliers.push({...s,id:Utils.uid('S')});return s; },

  // EXPENSES
  async getExpenses()          { return [...MockData.expenses]; },
  async addExpense(e)          { MockData.expenses.push({...e,id:Utils.uid('EXP')});return e; },
  async deleteExpense(id)      { MockData.expenses=MockData.expenses.filter(e=>e.id!==id); },

  // EMPLOYEES
  async getEmployees()         { return [...MockData.employees]; },
};
