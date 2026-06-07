var Sales = {
  filter: 'All',
  cart: [],
  discount: 0,
  amountPaid: 0,
  _saveAction: 'close', // 'close' or 'new'

  // ─── SALES LIST PAGE ───────────────────────────────────────────────────────
  render() {
    const pg = Utils.get('pg-sales');
    if (!pg) return;
    const all      = DB.getSales();
    const settings = DB.getSettings();
    const cur      = settings.currency || '$';
    const filters  = ['All', 'Paid', 'Partial', 'Credit'];
    const filtered = this.filter === 'All' ? all : all.filter(s => s.status === this.filter);
    const totalRev   = all.reduce((a, s) => a + (parseFloat(s.total)    || 0), 0);
    const collected  = all.filter(s => s.status === 'Paid'   ).reduce((a, s) => a + (parseFloat(s.total) || 0), 0);
    const partial    = all.filter(s => s.status === 'Partial').reduce((a, s) => a + (parseFloat(s.amountPaid) || 0), 0);
    const pending    = all.filter(s => s.status !== 'Paid'   ).reduce((a, s) => a + (parseFloat(s.balance)   || parseFloat(s.total) || 0), 0);

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Sales</div>
          <div class="page-sub">${all.length} invoices total</div>
        </div>
        <div class="page-actions">
          <button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button>
        </div>
      </div>

      <div class="sec">
        <div class="kpi-grid">
          <div class="kpi" style="--kc:var(--g);--kibg:var(--gb)">
            <div class="kpi-icon">💰</div>
            <div class="kpi-label">Total Revenue</div>
            <div class="kpi-value">${Utils.cur(totalRev, cur)}</div>
            <div class="kpi-sub">${all.length} invoices</div>
          </div>
          <div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)">
            <div class="kpi-icon">✅</div>
            <div class="kpi-label">Collected</div>
            <div class="kpi-value">${Utils.cur(collected + partial, cur)}</div>
            <div class="kpi-sub">${all.filter(s => s.status === 'Paid').length} paid</div>
          </div>
          <div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)">
            <div class="kpi-icon">⏳</div>
            <div class="kpi-label">Outstanding</div>
            <div class="kpi-value">${Utils.cur(pending, cur)}</div>
            <div class="kpi-sub">Balance due</div>
          </div>
          <div class="kpi" style="--kc:var(--in);--kibg:var(--inb)">
            <div class="kpi-icon">📊</div>
            <div class="kpi-label">Invoices</div>
            <div class="kpi-value">${all.length}</div>
            <div class="kpi-sub">${all.filter(s => s.status !== 'Paid').length} open</div>
          </div>
        </div>
      </div>

      <div class="chips">
        ${filters.map(f => `
          <div class="chip${this.filter === f ? ' active' : ''}" onclick="Sales.setFilter('${f}')">
            ${f} (${f === 'All' ? all.length : all.filter(s => s.status === f).length})
          </div>`).join('')}
      </div>

      <div class="sec">
        ${filtered.length ? `
        <div class="card">
          ${filtered.map(s => `
          <div class="list-item">
            <div class="list-icon" style="background:var(--gb3);border-color:rgba(201,168,76,.15)">🧾</div>
            <div class="list-info">
              <div class="list-name">${Utils.esc(s.customer || 'Walk-in')}</div>
              <div class="list-meta">
                <span>${s.id}</span>
                <span>·</span>
                <span>${Utils.date(s.date)}</span>
                <span>·</span>
                <span>${(s.items || []).length} item${(s.items||[]).length !== 1 ? 's' : ''}</span>
              </div>
              ${s.status === 'Partial' ? `
              <div style="margin-top:5px">
                <div class="progress" style="height:4px">
                  <div class="progress-fill" style="width:${Math.min(100,Math.round(((parseFloat(s.amountPaid)||0)/(parseFloat(s.total)||1))*100))}%;background:var(--wa)"></div>
                </div>
                <div style="font-size:10px;color:var(--wa);margin-top:3px;font-family:var(--fm)">
                  Paid ${Utils.cur(s.amountPaid||0,cur)} · Balance ${Utils.cur(s.balance||0,cur)}
                </div>
              </div>` : ''}
            </div>
            <div class="list-right">
              <div class="list-val">${Utils.cur(s.total, cur)}</div>
              <div style="margin-top:4px">${Utils.statusBadge(s.status || 'Paid')}</div>
              <div class="list-actions">
                ${s.status !== 'Paid' ? `<button class="btn-ok btn-sm" onclick="Sales.markPaid('${s.id}')">✓ Paid</button>` : ''}
                <button class="btn-danger btn-sm btn-icon" onclick="Sales.del('${s.id}')">🗑</button>
              </div>
            </div>
          </div>`).join('')}
        </div>` : `
        <div class="empty">
          <div class="empty-icon">🧾</div>
          <div class="empty-title">No ${this.filter !== 'All' ? this.filter + ' ' : ''}sales yet</div>
          <div class="empty-sub">Tap "+ New Sale" to create your first invoice</div>
          <div class="empty-action">
            <button class="btn-primary btn-sm" onclick="Sales.openNewSale()">＋ New Sale</button>
          </div>
        </div>`}
      </div>`;
  },

  setFilter(f) { this.filter = f; this.render(); },

  // ─── OPEN NEW SALE FORM ────────────────────────────────────────────────────
  openNewSale() {
    this.cart        = [];
    this.discount    = 0;
    this.amountPaid  = 0;
    this._saveAction = 'close';

    const custs    = DB.getCustomers();
    const prods    = DB.getProducts().filter(p => p.status !== 'inactive' && p.qty > 0);
    const settings = DB.getSettings();
    const cur      = settings.currency || '$';

    Modal.open({
      title: 'New Sale',
      sub: 'Create invoice',
      barColor: 'var(--ok)',
      body: `
        <!-- CUSTOMER SECTION -->
        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">👤 Customer</div>
          <div class="form-row" style="margin-bottom:10px">
            <div class="fg" style="margin:0">
              <label class="fl">Name / Type</label>
              <input class="fi" id="s-cust-name" placeholder="Enter customer name..."
                oninput="Sales.onCustNameInput(this.value)"
                style="font-weight:600">
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Date</label>
              <input class="fi" id="s-date" type="date" value="${Utils.today()}">
            </div>
          </div>
          <!-- Customer dropdown for existing customers -->
          <div id="s-cust-suggestions" style="display:none;border:1px solid var(--bd2);border-radius:var(--r8);background:var(--bg2);overflow:hidden;max-height:140px;overflow-y:auto;margin-top:4px"></div>
          <input type="hidden" id="s-cust-id" value="">
          <div id="s-cust-selected" style="display:none;font-size:11px;color:var(--ok);font-weight:600;margin-top:5px;font-family:var(--fm)"></div>
        </div>

        <!-- PRODUCTS SECTION -->
        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">📦 Products</div>
          <div class="fg" style="margin-bottom:10px">
            <label class="fl">Add Product to Cart</label>
            <select class="fi" id="s-prod-sel" onchange="Sales.addToCart(this)">
              <option value="">— tap to select product —</option>
              ${prods.map(p => `<option value="${p.id}">${Utils.esc(p.name)} · ${Utils.cur(p.price, cur)} · ${p.qty} in stock</option>`).join('')}
            </select>
          </div>
          <div id="s-cart-wrap">
            <div style="text-align:center;padding:16px 0;color:var(--t3);font-size:13px">No items added yet</div>
          </div>
        </div>

        <!-- TOTALS SECTION -->
        <div id="s-totals"></div>

        <!-- PAYMENT SECTION -->
        <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">💳 Payment</div>
          <div class="form-row" style="margin-bottom:12px">
            <div class="fg" style="margin:0">
              <label class="fl">Discount %</label>
              <input class="fi" id="s-disc" type="number" value="0" min="0" max="100"
                oninput="Sales.updateTotals()" placeholder="0">
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Payment Method</label>
              <select class="fi" id="s-method">
                <option>Cash</option>
                <option>Mobile Money</option>
                <option>Bank Transfer</option>
                <option>Credit</option>
              </select>
            </div>
          </div>
          <div class="fg" style="margin-bottom:0">
            <label class="fl">Amount Paid Now <span style="color:var(--t3);font-weight:400;text-transform:none;letter-spacing:0">(leave 0 if full payment)</span></label>
            <input class="fi" id="s-amt-paid" type="number" value="0" min="0" step="0.01"
              oninput="Sales.updateTotals()" placeholder="0.00"
              style="font-size:16px;font-weight:700;color:var(--ok)">
          </div>
        </div>

        <!-- NOTES -->
        <div class="fg">
          <label class="fl">Notes (optional)</label>
          <input class="fi" id="s-notes" placeholder="Any extra information...">
        </div>`,

      footer: `
        <button class="btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn-ghost" onclick="Sales.saveSale('new')" style="color:var(--g);border-color:rgba(201,168,76,.3)">💾 Save &amp; New</button>
        <button class="btn-primary" style="flex:1" onclick="Sales.saveSale('close')">🧾 Save Invoice</button>`,
    });

    // Pre-fill Walk-in
    const nameEl = Utils.get('s-cust-name');
    if (nameEl) nameEl.value = 'Walk-in Customer';
    this.updateTotals();
  },

  // ─── CUSTOMER NAME AUTO-FILL ───────────────────────────────────────────────
  onCustNameInput(val) {
    Utils.get('s-cust-id').value = '';
    Utils.get('s-cust-selected').style.display = 'none';
    if (!val.trim() || val.length < 1) {
      Utils.get('s-cust-suggestions').style.display = 'none';
      return;
    }
    const custs = DB.getCustomers().filter(c =>
      c.name.toLowerCase().includes(val.toLowerCase())
    ).slice(0, 6);
    const box = Utils.get('s-cust-suggestions');
    if (!custs.length) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const settings = DB.getSettings();
    const cur = settings.currency || '$';
    box.innerHTML = custs.map(c => `
      <div onclick="Sales.selectCust('${c.id}','${Utils.esc(c.name)}')"
        style="padding:10px 13px;cursor:pointer;font-size:13px;font-weight:600;color:var(--t1);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px;transition:background .12s"
        onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
        <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#07080D;flex-shrink:0">${c.name[0].toUpperCase()}</span>
        <span style="flex:1">${Utils.esc(c.name)}</span>
        <span style="font-size:10px;color:var(--t2)">${Utils.cur(c.totalSpent||0,cur)}</span>
      </div>`).join('');
  },

  selectCust(id, name) {
    Utils.get('s-cust-name').value   = name;
    Utils.get('s-cust-id').value     = id;
    Utils.get('s-cust-suggestions').style.display = 'none';
    const sel = Utils.get('s-cust-selected');
    sel.textContent = '✓ Linked to customer record';
    sel.style.display = 'block';
  },

  // ─── ADD TO CART ───────────────────────────────────────────────────────────
  addToCart(sel) {
    const id = sel.value;
    if (!id) return;
    const p = DB.getProducts().find(x => x.id === id);
    if (!p) return;
    sel.value = '';
    const existing = this.cart.find(i => i.id === id);
    if (existing) {
      existing.qty++;
    } else {
      this.cart.push({ id, name: p.name, price: p.price, cost: p.cost || 0, qty: 1, maxQty: p.qty });
    }
    this.renderCart();
  },

  // ─── RENDER CART ITEMS ─────────────────────────────────────────────────────
  renderCart() {
    const cartEl   = Utils.get('s-cart-wrap');
    if (!cartEl) return;
    const settings = DB.getSettings();
    const cur      = settings.currency || '$';

    if (!this.cart.length) {
      cartEl.innerHTML = '<div style="text-align:center;padding:16px 0;color:var(--t3);font-size:13px">No items added yet</div>';
      this.updateTotals();
      return;
    }

    cartEl.innerHTML = this.cart.map((item, i) => `
      <div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r10);padding:12px 13px;margin-bottom:8px">

        <!-- Product name + remove -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:var(--t1);flex:1;padding-right:8px">${Utils.esc(item.name)}</div>
          <button onclick="Sales.removeItem(${i})"
            style="width:22px;height:22px;border-radius:50%;background:var(--erb);border:1px solid var(--erbd);color:var(--er);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1">✕</button>
        </div>

        <!-- Qty + Price + Line Total -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end">

          <!-- Quantity — editable input -->
          <div>
            <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Qty</div>
            <div style="display:flex;align-items:center;gap:5px">
              <button onclick="Sales.changeQty(${i},-1)"
                style="width:26px;height:26px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd2);color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">−</button>
              <input
                type="number"
                value="${item.qty}"
                min="1"
                oninput="Sales.setQty(${i},this.value)"
                onblur="Sales.setQty(${i},this.value)"
                style="width:44px;text-align:center;font-size:14px;font-weight:700;color:var(--t1);background:var(--bg3);border:1.5px solid var(--bd2);border-radius:6px;padding:4px 2px;-webkit-appearance:none;font-family:var(--ff)">
              <button onclick="Sales.changeQty(${i},1)"
                style="width:26px;height:26px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd2);color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">+</button>
            </div>
          </div>

          <!-- Unit Price — editable -->
          <div>
            <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Unit Price</div>
            <input
              type="number"
              value="${item.price}"
              min="0"
              step="0.01"
              oninput="Sales.setPrice(${i},this.value)"
              onblur="Sales.setPrice(${i},this.value)"
              style="width:100%;text-align:right;font-size:14px;font-weight:700;color:var(--g);background:var(--bg3);border:1.5px solid rgba(201,168,76,.3);border-radius:6px;padding:5px 8px;-webkit-appearance:none;font-family:var(--ff)">
          </div>

          <!-- Line Total -->
          <div style="text-align:right">
            <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--fm)">Total</div>
            <div style="font-size:16px;font-weight:800;color:var(--g);letter-spacing:-.01em" id="line-total-${i}">${Utils.cur(item.price * item.qty, cur)}</div>
          </div>

        </div>
      </div>`).join('');

    this.updateTotals();
  },

  // ─── QTY / PRICE SETTERS ──────────────────────────────────────────────────
  changeQty(i, d) {
    if (!this.cart[i]) return;
    const newQty = Math.max(1, (this.cart[i].qty || 1) + d);
    this.cart[i].qty = newQty;
    this.renderCart();
  },

  setQty(i, val) {
    if (!this.cart[i]) return;
    const n = parseInt(val);
    if (!isNaN(n) && n >= 1) {
      this.cart[i].qty = n;
      // Update line total in place without re-rendering whole cart
      const settings = DB.getSettings();
      const cur      = settings.currency || '$';
      const el       = Utils.get('line-total-' + i);
      if (el) el.textContent = Utils.cur(this.cart[i].price * n, cur);
      this.updateTotals();
    }
  },

  setPrice(i, val) {
    if (!this.cart[i]) return;
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) {
      this.cart[i].price = n;
      const settings = DB.getSettings();
      const cur      = settings.currency || '$';
      const el       = Utils.get('line-total-' + i);
      if (el) el.textContent = Utils.cur(n * this.cart[i].qty, cur);
      this.updateTotals();
    }
  },

  removeItem(i) {
    this.cart.splice(i, 1);
    this.renderCart();
  },

  // ─── UPDATE TOTALS PANEL ──────────────────────────────────────────────────
  updateTotals() {
    const totEl    = Utils.get('s-totals');
    const settings = DB.getSettings();
    const cur      = settings.currency || '$';
    this.discount  = parseFloat(Utils.val('s-disc') || 0);

    if (!this.cart.length) {
      if (totEl) totEl.innerHTML = '';
      return;
    }

    const sub      = this.cart.reduce((a, i) => a + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 0), 0);
    const discAmt  = sub * (this.discount / 100);
    const total    = sub - discAmt;

    // Amount paid — read from input
    const paidRaw  = parseFloat(Utils.val('s-amt-paid') || 0);
    const paid     = Math.min(paidRaw, total);  // can't overpay
    const balance  = Math.max(0, total - paid);
    this.amountPaid = paid;

    // Determine status
    let status = 'Paid';
    if (paid <= 0)        status = Utils.get('s-method')?.value === 'Credit' ? 'Credit' : 'Paid';
    else if (balance > 0) status = 'Partial';
    else                  status = 'Paid';

    // Status color
    const statusColor = status === 'Paid' ? 'var(--ok)' : status === 'Partial' ? 'var(--wa)' : 'var(--er)';

    if (totEl) totEl.innerHTML = `
      <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12);padding:14px;margin-bottom:14px">
        <div style="font-size:10px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">🧮 Order Summary</div>

        ${this.discount > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)">
          <span style="font-size:13px;color:var(--t2)">Subtotal</span>
          <span style="font-size:13px;font-weight:600;font-family:var(--fm)">${Utils.cur(sub, cur)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)">
          <span style="font-size:13px;color:var(--er)">Discount (${this.discount}%)</span>
          <span style="font-size:13px;font-weight:600;color:var(--er);font-family:var(--fm)">−${Utils.cur(discAmt, cur)}</span>
        </div>` : ''}

        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd2)">
          <span style="font-size:15px;font-weight:800;color:var(--t1)">Total Amount</span>
          <span style="font-size:18px;font-weight:900;color:var(--g);letter-spacing:-.02em;font-family:var(--fm)">${Utils.cur(total, cur)}</span>
        </div>

        ${paid > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)">
          <span style="font-size:13px;color:var(--ok);font-weight:600">✓ Amount Paid</span>
          <span style="font-size:14px;font-weight:700;color:var(--ok);font-family:var(--fm)">${Utils.cur(paid, cur)}</span>
        </div>` : ''}

        ${balance > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bd)">
          <span style="font-size:13px;color:var(--wa);font-weight:600">⏳ Balance Due</span>
          <span style="font-size:14px;font-weight:700;color:var(--wa);font-family:var(--fm)">${Utils.cur(balance, cur)}</span>
        </div>

        <!-- Progress bar -->
        <div style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-bottom:5px">
            <span>Payment progress</span>
            <span>${Math.round((paid/total)*100)}% paid</span>
          </div>
          <div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${Math.round((paid/total)*100)}%;background:linear-gradient(90deg,var(--ok),var(--g));border-radius:3px;transition:width .4s ease"></div>
          </div>
        </div>` : ''}

        <div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--t3)">Invoice status</span>
          <span style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;background:${statusColor}18;border:1px solid ${statusColor}40;color:${statusColor}">${status}</span>
        </div>
      </div>`;
  },

  // ─── SAVE SALE ─────────────────────────────────────────────────────────────
  saveSale(action) {
    action = action || 'close';

    if (!this.cart.length) {
      Toast.show('Add at least one product', 'err');
      return;
    }

    const custName = Utils.val('s-cust-name').trim() || 'Walk-in Customer';
    const custId   = Utils.val('s-cust-id') || null;
    const cust     = custId ? DB.getCustomers().find(c => c.id === custId) : null;
    const method   = Utils.get('s-method')?.value || 'Cash';

    const sub      = this.cart.reduce((a, i) => a + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 0), 0);
    const discAmt  = sub * (this.discount / 100);
    const total    = sub - discAmt;
    const paidRaw  = parseFloat(Utils.val('s-amt-paid') || 0);
    const paid     = Math.min(paidRaw, total);
    const balance  = Math.max(0, total - paid);

    // Determine status
    let status = 'Paid';
    if (paid > 0 && balance > 0) status = 'Partial';
    else if (paid <= 0 && method === 'Credit') status = 'Credit';
    else if (paid <= 0 && method !== 'Credit') status = 'Paid'; // full cash assumed

    DB.addSale({
      customer:    custName,
      customerId:  custId,
      items:       this.cart.map(i => ({ ...i })),
      subtotal:    sub,
      discount:    this.discount,
      total:       total,
      amountPaid:  paid <= 0 && status === 'Paid' ? total : paid,
      balance:     status === 'Paid' ? 0 : balance,
      payment:     method,
      status:      status,
      date:        Utils.val('s-date') || Utils.today(),
      notes:       Utils.val('s-notes'),
    });

    // Deduct stock
    this.cart.forEach(item => {
      const p = DB.getProducts().find(x => x.id === item.id);
      if (p) DB.updateProduct(item.id, { qty: Math.max(0, (p.qty || 0) - (parseInt(item.qty) || 0)) });
    });

    // Update customer record
    if (cust) {
      DB.updateCustomer(custId, {
        totalSpent: (cust.totalSpent || 0) + total,
        purchases:  (cust.purchases  || 0) + 1,
      });
    }

    Toast.show('Invoice saved ✓', 'ok');
    Notifs.check();

    if (action === 'new') {
      // Reset form for new sale
      this.cart        = [];
      this.discount    = 0;
      this.amountPaid  = 0;
      const nameEl = Utils.get('s-cust-name');
      if (nameEl) nameEl.value = 'Walk-in Customer';
      Utils.get('s-cust-id').value = '';
      Utils.get('s-cust-selected').style.display = 'none';
      const discEl = Utils.get('s-disc'); if (discEl) discEl.value = '0';
      const paidEl = Utils.get('s-amt-paid'); if (paidEl) paidEl.value = '0';
      const notesEl = Utils.get('s-notes'); if (notesEl) notesEl.value = '';
      this.renderCart();
      Toast.show('Ready for next sale ✓', 'ok');
    } else {
      Modal.close();
    }

    this.render();
  },

  // ─── MARK PAID ─────────────────────────────────────────────────────────────
  markPaid(id) {
    const s = DB.getSales().find(x => x.id === id);
    if (s) {
      DB.updateSale(id, { status: 'Paid', amountPaid: s.total, balance: 0 });
    }
    Toast.show('Marked as fully paid ✓', 'ok');
    this.render();
  },

  // ─── DELETE SALE ──────────────────────────────────────────────────────────
  del(id) {
    confirmDel('Delete this invoice?', () => {
      DB.deleteSale(id);
      Toast.show('Invoice deleted', 'warn');
      this.render();
    });
  },
};
