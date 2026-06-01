const Inventory = {
  filter: 'All', search: '',
  editId: null,

  render() {
    const prods = DB.products();
    const low = prods.filter(p=>p.status!=='In Stock').length;
    const html = `
<div class="sec">
  <div class="sh">Inventory <span class="sl" onclick="openD('d-product');Inventory.clearForm()">+ Add</span></div>
  <div class="chips">
    ${['All','In Stock','Low Stock','Out of Stock'].map(f=>
      `<div class="chip${Inventory.filter===f?' on':''}" onclick="Inventory.setFilter('${f}')">${f}${f==='All'?' ('+prods.length+')':''}</div>`
    ).join('')}
  </div>
  <div style="margin-bottom:12px">
    <input class="fi" placeholder="🔍 Search products, SKU..." value="${Utils.esc(Inventory.search)}"
      oninput="Inventory.setSearch(this.value)" style="padding:10px 14px;font-size:13px">
  </div>
  <div id="inv-list"></div>
</div>`;
    Utils.set('pg-inventory', html);
    this.renderList();
  },

  setFilter(f) { this.filter=f; this.render(); },
  setSearch(v) { this.search=v; this.renderList(); },

  renderList() {
    const prods = DB.products().filter(p => {
      const matchFilter = this.filter==='All' || p.status===this.filter;
      const q = this.search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
    if (!prods.length) {
      Utils.set('inv-list', '<div class="empty"><div class="ei">📦</div><div class="et">No products found</div><div class="es">Try adjusting your filter or search</div></div>');
      return;
    }
    const html = prods.map(p => {
      const margin = p.price>0 ? Math.round(((p.price-p.cost)/p.price)*100) : 0;
      const barPct = Math.max(3, Math.round((p.qty/(p.low||1))*100));
      const barColor = p.qty===0 ? 'var(--er)' : p.qty<p.low ? 'var(--wa)' : 'var(--ok)';
      return `
      <div class="card" style="margin-bottom:10px">
        <div class="list-item" style="padding:13px 14px" onclick="Inventory.openEdit('${p.id}')">
          <div class="list-icon" style="background:var(--gd);font-size:20px">🧱</div>
          <div class="list-info">
            <div class="list-name">${Utils.esc(p.name)} ${Utils.statusBadge(p.status)}</div>
            <div class="list-meta"><span class="mono">${p.sku||'—'}</span> · ${p.category}</div>
            <div style="margin-top:6px"><div class="prog-bar" style="height:4px"><div class="prog-fill" style="width:${Math.min(100,barPct)}%;background:${barColor}"></div></div></div>
            <div style="font-size:10px;color:var(--t3);margin-top:3px;font-family:var(--fm)">${p.qty} units · min ${p.low}</div>
          </div>
          <div class="list-right">
            <div class="list-val">${Utils.cur(p.price)}</div>
            <div style="font-size:10px;color:var(--ok);font-weight:700;font-family:var(--fm);margin-top:3px">${margin}% margin</div>
            <div style="display:flex;gap:5px;margin-top:7px;justify-content:flex-end">
              <button class="act-btn gold" onclick="event.stopPropagation();Inventory.openEdit('${p.id}')">✏️</button>
              <button class="act-btn danger" onclick="event.stopPropagation();Inventory.confirmDelete('${p.id}','${Utils.esc(p.name)}')">🗑</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
    Utils.set('inv-list', html);
  },

  clearForm() {
    this.editId = null;
    Utils.set('prod-form-title','Add Product');
    ['pf-name','pf-sku','pf-qty','pf-cost','pf-price'].forEach(id => { const e=document.getElementById(id);if(e)e.value=''; });
    const low=document.getElementById('pf-low');if(low)low.value='50';
    const cat=document.getElementById('pf-cat');if(cat)cat.value='Tiles';
  },

  openEdit(id) {
    const p = DB.products().find(x=>x.id===id);
    if (!p) return;
    this.editId = id;
    Utils.set('prod-form-title','Edit Product');
    const set = (id,v) => { const e=document.getElementById(id);if(e)e.value=v; };
    set('pf-name',p.name); set('pf-sku',p.sku||''); set('pf-qty',p.qty);
    set('pf-cost',p.cost); set('pf-price',p.price); set('pf-low',p.low);
    const cat=document.getElementById('pf-cat');if(cat)cat.value=p.category;
    openD('d-product');
  },

  saveProduct(action) {
    const name = Utils.val('pf-name');
    if (!name) { Toast.show('Product name is required','er'); return; }
    const price = parseFloat(Utils.val('pf-price')||0);
    if (!price) { Toast.show('Price is required','er'); return; }
    const qty = parseInt(Utils.val('pf-qty')||0);
    const low = parseInt(Utils.val('pf-low')||50);
    const status = qty===0 ? 'Out of Stock' : qty<low ? 'Low Stock' : 'In Stock';
    const data = {
      name, sku:Utils.val('pf-sku'),
      category:document.getElementById('pf-cat')?.value||'Tiles',
      qty, cost:parseFloat(Utils.val('pf-cost')||0), price, low, status
    };
    if (this.editId) { DB.updateProduct(this.editId,data); Toast.show('Product updated ✓','ok'); }
    else { DB.addProduct(data); Toast.show('Product added ✓','ok'); }
    if (action==='addnew') { this.clearForm(); }
    else { closeD('d-product'); }
    this.render();
  },

  confirmDelete(id, name) {
    App.confirm('Delete Product','Remove "'+name+'" from inventory?','🗑️',()=>{
      DB.deleteProduct(id);
      Toast.show('Product deleted','wa');
      this.render();
    });
  },
};