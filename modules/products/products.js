/* === products.js === */
var Products = {
  filter: 'All', search: '', editId: null, catFilter: 'All',

  render() {
    const pg = Utils.get('pg-products');
    if (!pg) return;
    const prods = DB.getProducts();
    const active = prods.filter(p=>p.status!=='inactive');
    const low = active.filter(p=>p.qty<=(p.lowLevel||5)&&p.qty>0).length;
    const out = active.filter(p=>p.qty===0).length;
    const cats = ['All', ...DB.getCategories()];
    pg.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Products</div>
          <div class="page-sub">${active.length} products · ${low} low · ${out} out</div></div>
        <div class="page-actions">
          <button class="btn-ghost btn-sm" onclick="Products.openScanner()" title="Scan barcode">📷</button>
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
      <div class="chips" style="margin-top:-6px">
        ${cats.map(c=>`<div class="chip${this.catFilter===c?' active':''}" style="${this.catFilter===c?'':'opacity:.7'}" onclick="Products.setCatFilter('${Utils.esc(c)}')">${c==='All'?'🗂 All Categories':Products._catIcon(c)+' '+c}</div>`).join('')}
        <div class="chip" style="background:var(--bg3);color:var(--t3)" onclick="Products.manageCategories()">⚙️ Manage</div>
      </div>
      <div id="prod-list" class="sec"></div>`;
    this._renderList();
  },

  setFilter(f) { this.filter=f; this.render(); },
  setCatFilter(c) { this.catFilter=c; this.render(); },
  setSearch(v) { this.search=v; this._renderList(); },

  _catIcon(cat) {
    const icons = {Tiles:'🟫',Cement:'🧱',Tools:'🔧',Paint:'🎨',Plumbing:'🚰',Electrical:'💡',Adhesives:'🧪',Stone:'🪨',Mosaic:'◻️',Paving:'🟧',Other:'📦'};
    return icons[cat] || '📦';
  },

  _renderList() {
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    const rate = parseFloat(settings.lrdRate)||0;
    const all = DB.getProducts().filter(p => {
      if (p.status==='inactive') return false;
      if (this.catFilter!=='All' && (p.category||'Other')!==this.catFilter) return false;
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
      const lrdLine = rate ? `<div style="font-size:10px;color:var(--t3);margin-top:1px">≈ L$${(p.price*rate).toLocaleString(undefined,{maximumFractionDigits:0})}</div>` : '';
      const thumb = p.photo
        ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r10)">`
        : (p.emoji||this._catIcon(p.category));
      return `<div class="list-item" onclick="Products.openEditModal('${p.id}')">
        <div class="list-icon" style="background:var(--goldbg);font-size:20px;overflow:hidden;padding:0">${thumb}</div>
        <div class="list-info">
          <div class="list-name">${Utils.esc(p.name)}</div>
          <div class="list-meta"><span class="badge badge-gold">${Utils.esc(p.category||'—')}</span> · SKU: ${Utils.esc(p.sku||'—')}</div>
          <div style="margin-top:5px"><div class="progress"><div class="progress-fill" style="width:${Math.min(100,Math.max(3,Utils.pct(p.qty,(p.lowLevel||5)*4)))}%;background:${p.qty===0?'var(--err)':p.qty<=(p.lowLevel||5)?'var(--warn)':'var(--ok)'}"></div></div></div>
        </div>
        <div class="list-right">
          <div class="list-val">${Utils.cur(p.price,cur)}</div>
          ${lrdLine}
          <div style="font-size:10px;color:var(--ok);margin-top:2px">${margin}% margin</div>
          <div style="margin-top:3px">${Utils.statusBadge(st)}</div>
          <div class="list-actions">
            <button class="btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();Products.openEditModal('${p.id}')">✏️</button>
            <button class="btn-danger btn-sm btn-icon" onclick="event.stopPropagation();Products.del('${p.id}','${Utils.esc(p.name)}')">🗑</button>
          </div>
        </div>
      </div>`;}).join('')}</div>`;
  },

  openAddModal() {
    this.editId = null;
    this._photoData = null;
    Modal.open({
      title:'Add Product', sub:'Fill in product details',
      body: this._form(),
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-ghost" style="flex:1" onclick="Products.save(true)">💾 Save & Add New</button>
              <button class="btn-primary" style="flex:1" onclick="Products.save()">💾 Save Product</button>`,
    });
  },

  openEditModal(id) {
    this.editId = id;
    const p = DB.getProducts().find(x=>x.id===id);
    if (!p) return;
    this._photoData = p.photo || null;
    Modal.open({
      title:'Edit Product', sub:p.name,
      body: this._form(p),
      footer:`<button class="btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn-primary" style="flex:1" onclick="Products.save()">💾 Update</button>`,
    });
  },

  _form(p) {
    p = p || {};
    const cats = DB.getCategories();
    const sku = p.sku || Products._suggestSku(p.name, p.category);
    return `
      <div class="fg" style="text-align:center;margin-bottom:14px">
        <label class="fl" style="text-align:center;display:block">Product Photo</label>
        <div id="pf-photo-preview" onclick="Utils.get('pf-photo-input').click()"
             style="width:88px;height:88px;border-radius:var(--r14);background:var(--bg3);border:2px dashed var(--bd2);
             margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:30px;cursor:pointer;overflow:hidden">
          ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover">` : '📷'}
        </div>
        <input type="file" id="pf-photo-input" accept="image/*" capture="environment" style="display:none" onchange="Products.onPhotoSelected(this)">
        <div style="font-size:11px;color:var(--t3);margin-top:6px">Tap to add a photo (optional)</div>
      </div>
      <div class="fg"><label class="fl">Product Name *</label>
        <input class="fi" id="pf-name" value="${Utils.esc(p.name||'')}" placeholder="e.g. Ceramic Floor Tile" oninput="Products.onNameChange()"></div>
      <div class="form-row">
        <div class="fg"><label class="fl">SKU / Barcode</label>
          <div style="display:flex;gap:6px">
            <input class="fi" id="pf-sku" value="${Utils.esc(sku)}" placeholder="Auto-generated" style="flex:1">
            <button type="button" class="btn-ghost btn-sm" onclick="Products.regenSku()" title="Regenerate">🔄</button>
          </div></div>
        <div class="fg"><label class="fl">Category</label>
          <select class="fi" id="pf-cat" onchange="Products.regenSku()">${cats.map(c=>`<option${p.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
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
      <div style="text-align:center;margin-top:4px">
        <button type="button" class="btn-ghost btn-sm" onclick="Products.printLabel('${p.id||''}')" ${!p.id?'disabled style="opacity:.4"':''}>🏷️ Print SKU Label</button>
      </div>
    `;
  },

  // ── PHOTO HANDLING ─────────────────────────────────────────────────────
  onPhotoSelected(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      Products._resizeImage(e.target.result, 400, 400, function(resized) {
        Products._photoData = resized;
        const prev = Utils.get('pf-photo-preview');
        if (prev) prev.innerHTML = `<img src="${resized}" style="width:100%;height:100%;object-fit:cover">`;
      });
    };
    reader.readAsDataURL(file);
  },

  _resizeImage(src, maxW, maxH, callback) {
    const img = new Image();
    img.onload = function() {
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) { const r = Math.min(maxW/w, maxH/h); w = Math.round(w*r); h = Math.round(h*r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = function() { callback(src); };
    img.src = src;
  },

  // ── SKU GENERATION ──────────────────────────────────────────────────────
  _suggestSku(name, category) {
    const catPrefix = {
      Tiles:'TIL', Cement:'CEM', Tools:'TOL', Paint:'PNT', Plumbing:'PLB',
      Electrical:'ELC', Adhesives:'ADH', Stone:'STN', Mosaic:'MOS', Paving:'PAV', Other:'OTH',
    };
    const prefix = catPrefix[category] || (category ? category.slice(0,3).toUpperCase() : 'PRD');
    const namePart = (name||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,3).toUpperCase() || 'XXX';
    const rand = Math.floor(100 + Math.random()*900);
    return prefix + '-' + namePart + rand;
  },

  onNameChange() {
    const skuEl = Utils.get('pf-sku');
    if (skuEl && !skuEl.dataset.touched && !this.editId) {
      const name = Utils.val('pf-name');
      const cat  = (Utils.get('pf-cat')||{value:'Other'}).value;
      skuEl.value = Products._suggestSku(name, cat);
    }
  },

  regenSku() {
    const name = Utils.val('pf-name');
    const cat  = (Utils.get('pf-cat')||{value:'Other'}).value;
    const skuEl = Utils.get('pf-sku');
    if (skuEl) skuEl.value = Products._suggestSku(name, cat);
  },

  // ── BARCODE SCANNER (camera-based, BarcodeDetector API with fallback) ──
  openScanner() {
    if (!('BarcodeDetector' in window)) {
      Modal.open({
        title:'📷 Scanner Unavailable', barColor:'var(--wa)',
        body: '<div style="text-align:center;padding:20px 10px">'
          + '<div style="font-size:42px;margin-bottom:12px">⚠️</div>'
          + '<div style="font-size:13px;color:var(--t2);line-height:1.7">Your browser doesn\'t support camera barcode scanning yet. You can still search products by typing their SKU code in the search bar.</div>'
          + '</div>',
        footer: '<button class="btn-primary btn-full" onclick="Modal.close()">OK</button>',
      });
      return;
    }
    Modal.open({
      title:'📷 Scan Barcode / SKU', barColor:'var(--in)',
      body: '<div style="text-align:center">'
        + '<video id="scanner-video" style="width:100%;border-radius:var(--r12);background:#000" autoplay playsinline muted></video>'
        + '<div id="scanner-result" style="margin-top:12px;font-size:12px;color:var(--t2)">Point camera at a barcode or printed SKU label...</div>'
        + '</div>',
      footer: '<button class="btn-ghost btn-full" onclick="Products.closeScanner()">Close Scanner</button>',
    });
    setTimeout(() => Products._startScanner(), 250);
  },

  _scannerStream: null,

  _startScanner() {
    const video = Utils.get('scanner-video');
    if (!video) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        Products._scannerStream = stream;
        video.srcObject = stream;
        const detector = new BarcodeDetector({ formats: ['code_128','ean_13','ean_8','upc_a','upc_e','qr_code'] });
        const scanLoop = () => {
          if (!Products._scannerStream) return;
          detector.detect(video).then(codes => {
            if (codes.length) {
              Products._onScanResult(codes[0].rawValue);
            } else {
              requestAnimationFrame(scanLoop);
            }
          }).catch(() => requestAnimationFrame(scanLoop));
        };
        scanLoop();
      })
      .catch(err => {
        const resEl = Utils.get('scanner-result');
        if (resEl) resEl.innerHTML = '<span style="color:var(--er)">Camera access denied or unavailable.</span>';
      });
  },

  closeScanner() {
    if (Products._scannerStream) {
      Products._scannerStream.getTracks().forEach(t => t.stop());
      Products._scannerStream = null;
    }
    Modal.close();
  },

  _onScanResult(code) {
    Products.closeScanner();
    const prods = DB.getProducts();
    const match = prods.find(p => p.sku && p.sku.toLowerCase() === code.toLowerCase());
    const saleActive = !!Utils.get('s-prod-search');
    if (match) {
      if (saleActive && typeof Sales !== 'undefined') {
        Sales.addToCartById(match.id);
        Toast.show('Added: ' + match.name, 'ok');
      } else {
        Toast.show('Found: ' + match.name, 'ok');
        setTimeout(() => Products.openEditModal(match.id), 300);
      }
    } else {
      Toast.show('No product found for code: ' + code, 'warn');
      if (!saleActive) { this.search = code; this.render(); }
    }
  },

  // ── PRINT SKU LABEL (for products with no barcode) ──────────────────────
  printLabel(id) {
    const p = DB.getProducts().find(x=>x.id===id);
    if (!p) { Toast.show('Save the product first','err'); return; }
    const settings = DB.getSettings();
    const bizName = settings.bizName || 'SmartStock Pro';
    const cur = settings.currency || '$';

    const css = '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:Arial,Helvetica,sans-serif}'
      + '.label{width:280px;border:2px solid #111;border-radius:8px;padding:14px;text-align:center;margin:20px auto}'
      + '.biz{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.08em}'
      + '.name{font-size:16px;font-weight:800;margin:6px 0}'
      + '.price{font-size:22px;font-weight:900;color:#111;margin:8px 0}'
      + '.barcode{font-family:"Libre Barcode 128",monospace;font-size:42px;letter-spacing:2px;margin:4px 0}'
      + '.sku{font-size:13px;font-weight:700;letter-spacing:.1em;font-family:monospace}'
      + '@media print{@page{size:80mm 50mm;margin:2mm}}';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
      <style>${css}</style></head><body>
      <div class="label">
        <div class="biz">${Utils.esc(bizName)}</div>
        <div class="name">${Utils.esc(p.name)}</div>
        <div class="barcode">*${Utils.esc(p.sku||'NOSKU')}*</div>
        <div class="sku">${Utils.esc(p.sku||'')}</div>
        <div class="price">${Utils.cur(p.price,cur)}</div>
      </div>
      </body></html>`;

    Sales._printHtml(html, 'label-frame');
  },

  // ── CATEGORY MANAGEMENT ─────────────────────────────────────────────────
  manageCategories() {
    const cats = DB.getCategories();
    Modal.open({
      title:'⚙️ Manage Categories', barColor:'var(--g)',
      body: `<div id="cat-list">${this._catListHtml(cats)}</div>
        <div class="fg" style="margin-top:14px"><label class="fl">Add New Category</label>
        <div style="display:flex;gap:8px">
          <input class="fi" id="new-cat-name" placeholder="e.g. Roofing" style="flex:1">
          <button class="btn-primary btn-sm" onclick="Products.addCategory()">+ Add</button>
        </div></div>`,
      footer:'<button class="btn-primary btn-full" onclick="Modal.close();Products.render()">Done</button>',
    });
  },

  _catListHtml(cats) {
    return `<div class="card">${cats.map(c => `
      <div class="list-item" style="padding:10px 14px">
        <div class="list-icon" style="background:var(--goldbg);font-size:16px">${this._catIcon(c)}</div>
        <div class="list-info"><div class="list-name" style="font-size:13px">${Utils.esc(c)}</div></div>
        <button class="btn-danger btn-sm btn-icon" onclick="Products.deleteCategory('${Utils.esc(c)}')">🗑</button>
      </div>`).join('')}</div>`;
  },

  addCategory() {
    const name = Utils.val('new-cat-name').trim();
    if (!name) { Toast.show('Enter a category name','err'); return; }
    const cats = DB.getCategories();
    if (cats.some(c => c.toLowerCase()===name.toLowerCase())) { Toast.show('Category already exists','err'); return; }
    cats.push(name);
    DB.saveCategories(cats);
    Toast.show('Category added ✓','ok');
    const listEl = Utils.get('cat-list');
    if (listEl) listEl.innerHTML = this._catListHtml(cats);
    const input = Utils.get('new-cat-name'); if (input) input.value='';
  },

  deleteCategory(name) {
    const inUse = DB.getProducts().some(p => p.category===name);
    if (inUse) { Toast.show('Cannot delete — products use this category','err'); return; }
    const cats = DB.getCategories().filter(c => c!==name);
    DB.saveCategories(cats);
    Toast.show('Category removed','warn');
    const listEl = Utils.get('cat-list');
    if (listEl) listEl.innerHTML = this._catListHtml(cats);
  },

  save(andNew) {
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
      photo: this._photoData || null,
      status: 'active',
    };
    if (this.editId) { DB.updateProduct(this.editId, data); Toast.show('Product updated ✓','ok'); }
    else { DB.addProduct(data); Toast.show('Product added ✓','ok'); }
    this._photoData = null;
    Modal.close();
    this.render();
    Notifs.check();
    // Save & Add New: instantly reopen a clean form for the next product
    if (andNew && !this.editId) {
      const self = this;
      setTimeout(function(){ self.openAddModal(); }, 220);
    }
    this.editId = null;
  },

  del(id, name) {
    confirmDel(`Delete "${name}"?`, () => {
      DB.deleteProduct(id);
      Toast.show('Product deleted','warn');
      this.render();
    });
  },
};
