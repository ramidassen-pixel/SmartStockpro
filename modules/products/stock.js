/* === stock.js === */
/* SmartStock Pro V5 — Stock Movement History */
var Stock = {

  render: function() {
    var pg = Utils.get('pg-stock');
    if (!pg) return;
    var prods     = DB.getProducts();
    var movements = DB.getStockMovements ? DB.getStockMovements() : [];
    var settings  = DB.getSettings();
    var cur       = settings.currency || '$';

    // Summary stats
    var totalIn  = movements.filter(function(m){ return m.qty > 0; }).reduce(function(a,m){ return a+m.qty; },0);
    var totalOut = movements.filter(function(m){ return m.qty < 0; }).reduce(function(a,m){ return a+Math.abs(m.qty); },0);
    var lowStock = prods.filter(function(p){ return p.status!=='inactive' && p.qty<=(p.lowLevel||5); });
    var outStock = prods.filter(function(p){ return p.status!=='inactive' && p.qty<=0; });

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Stock Movement</div>'
      + '<div class="page-sub">Inventory in & out history</div></div>'
      + '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Stock.openAdjust()">📦 Adjust Stock</button></div>'
      + '</div>'

      // KPI cards
      + '<div class="sec"><div class="kpi-grid">'
      + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">📦</div><div class="kpi-label">Total Products</div><div class="kpi-value">'+prods.filter(function(p){return p.status!=='inactive';}).length+'</div></div>'
      + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">📥</div><div class="kpi-label">Units In</div><div class="kpi-value">'+Utils.num(totalIn)+'</div><div class="kpi-sub">all time</div></div>'
      + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">📤</div><div class="kpi-label">Units Out</div><div class="kpi-value">'+Utils.num(totalOut)+'</div><div class="kpi-sub">all time</div></div>'
      + '<div class="kpi" style="--kc:var(--er);--kibg:var(--erb)"><div class="kpi-icon">⚠️</div><div class="kpi-label">Low/Out Stock</div><div class="kpi-value">'+lowStock.length+'</div><div class="kpi-sub">need reorder</div></div>'
      + '</div></div>'

      // Alert banner if out of stock
      + (outStock.length ? '<div style="background:var(--erb);border:1.5px solid var(--erbd);border-radius:var(--r12);padding:12px 16px;margin:0 16px 12px;display:flex;align-items:center;gap:10px">'
        + '<div style="font-size:22px">🚫</div>'
        + '<div><div style="font-size:13px;font-weight:700;color:var(--er)">'+outStock.length+' product'+(outStock.length!==1?'s':'')+' out of stock</div>'
        + '<div style="font-size:11px;color:var(--t2)">'+outStock.slice(0,3).map(function(p){return Utils.esc(p.name);}).join(', ')+(outStock.length>3?'...':'')+'</div>'
        + '</div></div>' : '')

      // Low stock list
      + (lowStock.length ? '<div class="sec"><div class="sec-title">⚠️ Low Stock Alert ('+lowStock.length+')</div>'
        + '<div class="card">'
        + lowStock.map(function(p){
            var pct  = p.qty <= 0 ? 0 : Math.min(100, Math.round((p.qty/(p.lowLevel||5))*100));
            var col  = p.qty <= 0 ? 'var(--er)' : 'var(--wa)';
            return '<div class="list-item" onclick="Stock.openAdjustProduct(\''+p.id+'\',\''+Utils.esc(p.name)+'\')">'
              + '<div class="list-icon" style="background:var(--erb);font-size:18px">📦</div>'
              + '<div class="list-info">'
              + '<div class="list-name">'+Utils.esc(p.name)+'</div>'
              + '<div class="list-meta">'+Utils.esc(p.category||'')+(p.sku?' · SKU: '+p.sku:'')+'</div>'
              + '<div style="background:var(--bd);border-radius:99px;height:5px;margin-top:5px">'
              + '<div style="background:'+col+';border-radius:99px;height:5px;width:'+pct+'%"></div>'
              + '</div></div>'
              + '<div class="list-right">'
              + '<div style="font-size:20px;font-weight:900;color:'+col+'">'+Utils.num(p.qty)+'</div>'
              + '<div style="font-size:10px;color:var(--t3)">in stock</div>'
              + '<button class="btn-ghost btn-sm" onclick="event.stopPropagation();Stock.openAdjustProduct(\''+p.id+'\',\''+Utils.esc(p.name)+'\')" style="color:var(--ok);margin-top:4px;font-size:10px">+ Restock</button>'
              + '</div></div>';
          }).join('')
        + '</div></div>' : '')

      // Movement history
      + '<div class="sec"><div class="sec-title">📋 Movement History</div>'
      + (movements.length
          ? '<div class="card">'
            + movements.slice(0,50).map(function(mv){
                var isIn  = mv.qty > 0;
                var icon  = isIn ? '📥' : '📤';
                var color = isIn ? 'var(--ok)' : 'var(--er)';
                var bg    = isIn ? 'var(--okb)' : 'var(--erb)';
                var typeLabel = {
                  'sale':'Sale','grn':'Purchase/GRN','adjustment':'Manual Adjust',
                  'return':'Return','damage':'Damage/Loss',
                }[mv.type] || mv.type;
                return '<div class="list-item">'
                  + '<div class="list-icon" style="background:'+bg+';font-size:16px">'+icon+'</div>'
                  + '<div class="list-info">'
                  + '<div class="list-name">'+Utils.esc(mv.productName||'')+'</div>'
                  + '<div class="list-meta">'+typeLabel+(mv.customer?' · '+Utils.esc(mv.customer):'')+(mv.note?' · '+Utils.esc(mv.note):'')+'</div>'
                  + '<div class="list-meta" style="font-size:10px;color:var(--t3)">'+Utils.date(mv.date)+(mv.refId?' · Ref: '+mv.refId.slice(-8):'')+'</div>'
                  + '</div>'
                  + '<div class="list-right">'
                  + '<div style="font-size:18px;font-weight:900;color:'+color+'">'+(isIn?'+':'')+Utils.num(mv.qty)+'</div>'
                  + '<div style="font-size:10px;color:var(--t3)">units</div>'
                  + '</div></div>';
              }).join('')
            + '</div>'
          : '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No movement history yet</div><div class="empty-sub">History records automatically when sales are made</div></div>')
      + '</div>'
      + '<div style="height:40px"></div>';
  },

  /* ── Manual stock adjustment ───────────────────────────────── */
  openAdjust: function() {
    var prods = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var opts  = prods.map(function(p){
      return '<option value="'+p.id+'">'+Utils.esc(p.name)+' ('+p.qty+' in stock)</option>';
    }).join('');

    Modal.open({
      title: '📦 Stock Adjustment', barColor: 'var(--in)',
      body:
        '<div class="fg"><label class="fl">Product *</label>'
        + '<select class="fi" id="adj-prod">'+opts+'</select></div>'
        + '<div class="form-row">'
        + '<div class="fg"><label class="fl">Type *</label>'
        + '<select class="fi" id="adj-type">'
        + '<option value="adjustment">✏️ Manual Adjustment</option>'
        + '<option value="grn">📥 Stock Received (Purchase)</option>'
        + '<option value="return">↩️ Customer Return</option>'
        + '<option value="damage">💔 Damage / Loss</option>'
        + '</select></div>'
        + '<div class="fg"><label class="fl">Quantity *</label>'
        + '<input class="fi" id="adj-qty" type="number" placeholder="e.g. 10 or -5"></div>'
        + '</div>'
        + '<div class="fg"><label class="fl">Note / Reason</label>'
        + '<input class="fi" id="adj-note" placeholder="e.g. Received from supplier, damaged in storage..."></div>'
        + '<div class="fg"><label class="fl">Date</label>'
        + '<input class="fi" id="adj-date" type="date" value="'+Utils.today()+'"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Stock.saveAdjust()">✓ Save Adjustment</button>',
    });
  },

  openAdjustProduct: function(prodId, prodName) {
    var prods = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
    var opts  = prods.map(function(p){
      return '<option value="'+p.id+'"'+(p.id===prodId?' selected':'')+'>'+Utils.esc(p.name)+' ('+p.qty+' in stock)</option>';
    }).join('');

    Modal.open({
      title: '📦 Restock: '+Utils.esc(prodName), barColor: 'var(--ok)',
      body:
        '<div class="fg"><label class="fl">Product</label>'
        + '<select class="fi" id="adj-prod">'+opts+'</select></div>'
        + '<div class="form-row">'
        + '<div class="fg"><label class="fl">Type</label>'
        + '<select class="fi" id="adj-type">'
        + '<option value="grn" selected>📥 Stock Received</option>'
        + '<option value="adjustment">✏️ Manual Adjustment</option>'
        + '<option value="return">↩️ Customer Return</option>'
        + '<option value="damage">💔 Damage / Loss</option>'
        + '</select></div>'
        + '<div class="fg"><label class="fl">Quantity to Add *</label>'
        + '<input class="fi" id="adj-qty" type="number" placeholder="0" min="1"></div>'
        + '</div>'
        + '<div class="fg"><label class="fl">Note</label>'
        + '<input class="fi" id="adj-note" placeholder="e.g. Received from supplier..."></div>'
        + '<div class="fg"><label class="fl">Date</label>'
        + '<input class="fi" id="adj-date" type="date" value="'+Utils.today()+'"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Stock.saveAdjust()">✓ Save</button>',
    });
  },

  saveAdjust: function() {
    var prodId = (Utils.get('adj-prod')||{value:''}).value;
    var type   = (Utils.get('adj-type')||{value:'adjustment'}).value;
    var qty    = parseInt(Utils.val('adj-qty'))||0;
    var note   = Utils.val('adj-note').trim();
    var date   = Utils.val('adj-date')||Utils.today();

    if (!prodId) { Toast.show('Select a product','err'); return; }
    if (!qty)    { Toast.show('Enter quantity','err'); return; }

    // Damage/loss = negative
    if (type === 'damage' && qty > 0) qty = -qty;

    var prods = DB.getProducts();
    var idx   = prods.findIndex(function(p){ return p.id===prodId; });
    if (idx < 0) { Toast.show('Product not found','err'); return; }

    var oldQty = parseInt(prods[idx].qty)||0;
    var newQty = Math.max(0, oldQty + qty);
    prods[idx].qty = newQty;
    DB.set('products', prods);

    // Record movement
    var mv = {
      id:          Utils.uid('MV'),
      productId:   prodId,
      productName: prods[idx].name,
      type:        type,
      qty:         qty,
      qtyBefore:   oldQty,
      qtyAfter:    newQty,
      refType:     'manual',
      date:        date,
      note:        note || type,
      createdBy:   (Auth.currentUser||{}).name || '',
      createdAt:   new Date().toISOString(),
    };
    if (DB.addStockMovement) DB.addStockMovement(mv);

    Toast.show(prods[idx].name + ': ' + oldQty + ' → ' + newQty + ' ✓', 'ok');
    Modal.close();
    Stock.render();
  },
};
