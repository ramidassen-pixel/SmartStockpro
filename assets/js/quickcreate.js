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
