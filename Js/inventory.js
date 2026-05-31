/* SmartStock Pro — Inventory Page */
const Inventory = {
  data: [],
  search: '',

  async render() {
    this.data = await DB.getProducts();
    const content = document.getElementById('page-content');
    const low = this.data.filter(p=>p.status==='Low Stock').length;
    const out = this.data.filter(p=>p.status==='Out of Stock').length;
    content.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Inventory</h1>
          <p class="page-subtitle">${this.data.length} products · ${low} low · ${out} out of stock</p></div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm">${Components.icon('download',13)} Export</button>
          <button class="btn btn-primary btn-sm" onclick="Inventory.openAddModal()">${Components.icon('plus',13)} Add Product</button>
        </div>
      </div>
      <div class="card mb-4 animate-in" style="padding:12px 16px">
        <div class="flex gap-2 items-center" style="flex-wrap:wrap">
          <div class="topbar-search" style="max-width:280px;flex:1">
            ${Components.icon('search',14,'var(--color-text-dim)')}
            <input placeholder="Search name, SKU, category..." oninput="Inventory.filterTable(this.value)"/>
          </div>
          <div class="flex gap-2" style="margin-left:auto">
            ${['All','In Stock','Low Stock','Out of Stock'].map(f=>`<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="Inventory.filterTable('',this,'${f}')">${f}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="card animate-in" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table>
          <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Qty</th><th>Min</th><th>Cost</th><th>Price</th><th>Margin</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="inv-table"></tbody>
        </table></div>
      </div>`;
    this.renderTable();
  },

  renderTable(filter='') {
    const rows = this.data.filter(p =>
      !filter || p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.sku.toLowerCase().includes(filter.toLowerCase()) ||
      p.category.toLowerCase().includes(filter.toLowerCase()) ||
      p.status === filter
    );
    const margin = p => Math.round(((p.price-p.cost)/p.price)*100);
    Utils.render('#inv-table', rows.length ? rows.map(p=>`
      <tr>
        <td><span class="font-mono text-gold text-xs">${p.sku}</span></td>
        <td style="font-weight:500">${Utils.esc(p.name)}</td>
        <td class="text-sec text-sm">${p.category}</td>
        <td style="font-weight:600;color:${p.qty===0?'var(--color-error)':p.qty<p.low?'var(--color-warning)':'var(--color-text)'}">${p.qty}</td>
        <td class="text-sec text-sm">${p.low}</td>
        <td class="font-mono text-sm">${Utils.currency(p.cost)}</td>
        <td class="font-mono text-sm text-gold">${Utils.currency(p.price)}</td>
        <td class="text-sm text-success">${margin(p)}%</td>
        <td>${Components.badge(p.status)}</td>
        <td><div class="flex gap-2">
          <button class="btn btn-icon btn-ghost btn-sm" onclick="Inventory.openEditModal('${p.id}')">${Components.icon('edit',13)}</button>
          <button class="btn btn-icon btn-danger btn-sm" onclick="Inventory.deleteProduct('${p.id}')">${Components.icon('trash',13)}</button>
        </div></td>
      </tr>`).join('') : `<tr><td colspan="10" class="table-empty">No products found</td></tr>`);
  },

  filterTable(val) { this.renderTable(val); },

  openAddModal() {
    const body = this._formHTML({});
    Components.openModal(Components.modal({id:'inv-modal',title:'Add Product',body,
      footer:`<button class="btn btn-ghost" onclick="Components.closeModal('inv-modal')">Cancel</button>
              <button class="btn btn-primary" onclick="Inventory.saveProduct()">${Components.icon('check',13)} Save</button>`}));
  },

  openEditModal(id) {
    const p = this.data.find(x=>x.id===id);
    if (!p) return;
    const body = this._formHTML(p);
    Components.openModal(Components.modal({id:'inv-modal',title:'Edit Product',body,
      footer:`<button class="btn btn-ghost" onclick="Components.closeModal('inv-modal')">Cancel</button>
              <button class="btn btn-primary" onclick="Inventory.saveProduct('${id}')">${Components.icon('check',13)} Update</button>`}));
  },

  _formHTML(p={}) {
    const cats = ['Tiles','Mosaic','Paving','Stone','Adhesives','Grout','Tools','Other'];
    const statuses = ['In Stock','Low Stock','Out of Stock'];
    return `
      <div class="flex flex-col gap-3">
        <div class="form-group"><label class="form-label">Product Name</label>
          <input class="form-input" id="f-name" value="${Utils.esc(p.name||'')}" placeholder="Enter product name"/></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">SKU</label>
            <input class="form-input" id="f-sku" value="${Utils.esc(p.sku||'')}" placeholder="SKU-001"/></div>
          <div class="form-group"><label class="form-label">Category</label>
            <select class="form-select" id="f-cat">${cats.map(c=>`<option${p.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Quantity</label>
            <input class="form-input" id="f-qty" type="number" value="${p.qty||0}"/></div>
          <div class="form-group"><label class="form-label">Cost ($)</label>
            <input class="form-input" id="f-cost" type="number" step="0.01" value="${p.cost||0}"/></div>
          <div class="form-group"><label class="form-label">Sell Price ($)</label>
            <input class="form-input" id="f-price" type="number" step="0.01" value="${p.price||0}"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Low Stock Alert</label>
            <input class="form-input" id="f-low" type="number" value="${p.low||50}"/></div>
          <div class="form-group"><label class="form-label">Status</label>
            <select class="form-select" id="f-status">${statuses.map(s=>`<option${p.status===s?' selected':''}>${s}</option>`).join('')}</select></div>
        </div>
      </div>`;
  },

  async saveProduct(id) {
    const f = (sel) => Utils.$('#inv-modal '+sel)?.value;
    const item = {
      name:f('#f-name'), sku:f('#f-sku'), category:f('#f-cat'),
      qty:+f('#f-qty'), cost:+f('#f-cost'), price:+f('#f-price'),
      low:+f('#f-low'), status:f('#f-status'),
    };
    if (!item.name) { Toast.show('Product name required','error'); return; }
    if (id) await DB.updateProduct(id, item);
    else    await DB.addProduct(item);
    Toast.show(id?'Product updated':'Product added','success');
    Components.closeModal('inv-modal');
    this.render();
  },

  async deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    await DB.deleteProduct(id);
    Toast.show('Product deleted','warning');
    this.render();
  },
};
