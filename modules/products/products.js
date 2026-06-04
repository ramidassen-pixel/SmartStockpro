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
