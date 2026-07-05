/* === globalsearch.js === */
var GlobalSearch = {
  query: '',

  open: function() {
    this.query = '';
    Modal.open({
      title: '🔍 Search Everything', barColor: 'var(--in)',
      body:
        '<div class="fg" style="margin-bottom:4px">'
        + '<input class="fi" id="gs-input" placeholder="Search invoices, customers, products, suppliers..." '
        + 'oninput="GlobalSearch.run(this.value)" autocomplete="off" autofocus style="font-size:15px">'
        + '</div>'
        + '<div id="gs-results" style="margin-top:10px;max-height:55vh;overflow-y:auto">'
        + '<div style="text-align:center;padding:24px 10px;color:var(--t3);font-size:12px">Type to search across your whole business — invoices, customers, products, and suppliers.</div>'
        + '</div>',
      footer: '<button class="btn-ghost btn-full" onclick="Modal.close()">Close</button>',
    });
    setTimeout(function(){ var el = Utils.get('gs-input'); if (el) el.focus(); }, 200);
  },

  run: function(q) {
    this.query = q;
    var resEl = Utils.get('gs-results');
    if (!resEl) return;
    var query = (q || '').trim().toLowerCase();
    if (!query) {
      resEl.innerHTML = '<div style="text-align:center;padding:24px 10px;color:var(--t3);font-size:12px">Type to search across your whole business — invoices, customers, products, and suppliers.</div>';
      return;
    }

    var settings = DB.getSettings();
    var cur = settings.currency || '$';
    var html = '';

    // ── Sales / Invoices ──
    var sales = DB.getSales().filter(function(s){
      return (s.id && s.id.toLowerCase().includes(query))
          || (s.customer && s.customer.toLowerCase().includes(query))
          || (s.notes && s.notes.toLowerCase().includes(query))
          || (s.total && String(s.total).includes(query));
    }).slice(0, 8);

    if (sales.length) {
      html += '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin:10px 0 6px">🧾 Invoices ('+sales.length+')</div>';
      html += '<div class="card">' + sales.map(function(s){
        var sc = {Paid:'var(--ok)',Partial:'var(--wa)',Credit:'var(--er)'}[s.status] || 'var(--t3)';
        return '<div class="list-item" onclick="Modal.close();Sales.viewInvoice(\''+s.id+'\')">'
          + '<div class="list-icon" style="background:var(--goldbg);font-size:16px">🧾</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(s.id)+' · '+Utils.esc(s.customer||'Walk-in')+'</div>'
          + '<div class="list-meta">'+Utils.date(s.date)+' · <span style="color:'+sc+'">'+s.status+'</span></div></div>'
          + '<div class="list-right"><div class="list-val">'+Utils.cur(s.total,cur)+'</div></div>'
          + '</div>';
      }).join('') + '</div>';
    }

    // ── Customers ──
    var customers = DB.getCustomers().filter(function(c){
      return (c.name && c.name.toLowerCase().includes(query))
          || (c.phone && c.phone.toLowerCase().includes(query))
          || (c.email && c.email.toLowerCase().includes(query));
    }).slice(0, 8);

    if (customers.length) {
      html += '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px">👤 Customers ('+customers.length+')</div>';
      html += '<div class="card">' + customers.map(function(c){
        return '<div class="list-item" onclick="Modal.close();Customers.openEditModal(\''+c.id+'\')">'
          + '<div class="list-icon" style="background:var(--goldbg);font-size:16px">👤</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(c.name)+'</div>'
          + '<div class="list-meta">'+Utils.esc(c.phone||c.email||'No contact info')+'</div></div>'
          + '<div class="list-right"><div class="list-val" style="font-size:12px;color:var(--t3)">'+Utils.num(c.purchases||0)+' orders</div></div>'
          + '</div>';
      }).join('') + '</div>';
    }

    // ── Products ──
    var products = DB.getProducts().filter(function(p){
      return p.status !== 'inactive' && (
        (p.name && p.name.toLowerCase().includes(query))
        || (p.sku && p.sku.toLowerCase().includes(query))
        || (p.category && p.category.toLowerCase().includes(query))
      );
    }).slice(0, 8);

    if (products.length) {
      html += '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px">📦 Products ('+products.length+')</div>';
      html += '<div class="card">' + products.map(function(p){
        return '<div class="list-item" onclick="Modal.close();Router.go(\'products\');setTimeout(function(){Products.openEditModal(\''+p.id+'\')},150)">'
          + '<div class="list-icon" style="background:var(--goldbg);font-size:16px">'+(p.emoji||'📦')+'</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(p.name)+'</div>'
          + '<div class="list-meta">SKU: '+Utils.esc(p.sku||'—')+' · '+Utils.num(p.qty)+' in stock</div></div>'
          + '<div class="list-right"><div class="list-val">'+Utils.cur(p.price,cur)+'</div></div>'
          + '</div>';
      }).join('') + '</div>';
    }

    // ── Suppliers ──
    var suppliers = (DB.getSuppliers ? DB.getSuppliers() : []).filter(function(s){
      return (s.name && s.name.toLowerCase().includes(query))
          || (s.phone && s.phone.toLowerCase().includes(query))
          || (s.contact && s.contact.toLowerCase().includes(query));
    }).slice(0, 8);

    if (suppliers.length) {
      html += '<div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px">🚚 Suppliers ('+suppliers.length+')</div>';
      html += '<div class="card">' + suppliers.map(function(s){
        return '<div class="list-item" onclick="Modal.close();Router.go(\'suppliers\')">'
          + '<div class="list-icon" style="background:var(--goldbg);font-size:16px">🚚</div>'
          + '<div class="list-info"><div class="list-name">'+Utils.esc(s.name)+'</div>'
          + '<div class="list-meta">'+Utils.esc(s.contact||s.phone||'No contact info')+'</div></div>'
          + '</div>';
      }).join('') + '</div>';
    }

    var totalResults = sales.length + customers.length + products.length + suppliers.length;
    if (!totalResults) {
      html = '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">No results found</div><div class="empty-sub">Try a different search term</div></div>';
    }

    resEl.innerHTML = html;
  },
};
