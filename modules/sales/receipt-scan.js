/* === receipt-scan.js === */
/* SmartStock Pro — Scan a paper receipt into the New Sale form.
   1. Staff take a photo of the receipt they wrote.
   2. The scan-receipt function reads it with AI and matches each line to a product.
   3. The New Sale form is filled in; anything the AI was unsure of is highlighted.
   4. Staff tick "I checked every line against the paper" and tap Save — only then is the sale recorded.
   The photo is kept (private, per business) so the paper behind any sale can be seen later. */
// Opened from the computer's QR code: remember the one-time code (it survives signing in) and tidy the address bar
(function() {
  var m = /[#&]ps=([a-z0-9]{12,40})~([A-Za-z0-9_\-]{1,80})/.exec(location.hash || '');
  if (!m) return;
  try { sessionStorage.setItem('ssp_phone_scan', m[1] + '~' + m[2]); } catch (e) {}
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
})();

var ReceiptScan = {
  ENDPOINT: 'scan-receipt',
  BUCKET: 'receipts',
  current: null,   // { photo: Blob, url: objectURL, result: {...}, uploaded: 'biz/RC-x.jpg' }
  _busy: false,

  reset: function() {
    if (this.current && this.current.url) { try { URL.revokeObjectURL(this.current.url); } catch (e) {} }
    this.current = null; this._busy = false; this._phone = null;
    var p = Utils.get('s-scan-panel'); if (p) p.innerHTML = this._idleHtml();
  },
  active: function() { return !!(this.current && this.current.result); },

  // ── The bar at the top of the New Sale form ────────────────────────────────
  bar: function() {
    return '<div id="s-scan-panel" style="margin-bottom:14px">' + this._idleHtml() + '</div>'
      + '<input type="file" id="s-scan-file" accept="image/*" capture="environment" style="display:none" onchange="ReceiptScan.onFile(this)">';
  },
  _idleHtml: function() {
    var btn = 'display:flex;align-items:center;justify-content:center;gap:10px;padding:13px;border:1.5px dashed var(--g);color:var(--g);font-weight:700;font-size:14px;border-radius:var(--r12)';
    if (this._isComputer()) {
      // On a computer: take the photo with the phone (QR code), or upload a photo file
      return '<div style="display:flex;gap:8px">'
        + '<button type="button" class="btn-ghost" onclick="ReceiptScan.phoneStart()" style="flex:1.4;' + btn + '"><span style="font-size:20px">📱</span> Scan receipt with phone</button>'
        + '<button type="button" class="btn-ghost" onclick="ReceiptScan.pick()" style="flex:1;' + btn + ';border-color:var(--bd2);color:var(--t2)"><span style="font-size:18px">📁</span> Upload photo</button>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--t3);text-align:center;margin-top:5px">Photograph a receipt you wrote — the form fills in for you to check</div>';
    }
    return '<button type="button" class="btn-ghost" onclick="ReceiptScan.pick()" style="width:100%;' + btn + '">'
      + '<span style="font-size:20px">📷</span> Scan paper receipt</button>'
      + '<div style="font-size:11px;color:var(--t3);text-align:center;margin-top:5px">Take a photo of a receipt you wrote — the form fills in for you to check</div>';
  },
  _isComputer: function() {
    var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
    return !mobile && !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
  },

  // ── Use the phone's camera from a computer ─────────────────────────────────
  // The computer shows a QR code holding a one-time link. The phone (signed in to the same business) opens it,
  // takes the photo and stores it at receipts/<business>/PH-<code>.jpg. The computer watches for that file,
  // then reads it like any other scan; the same file is kept as the sale's receipt photo.
  _phone: null,
  phoneStart: function() {
    if (this._busy) return;
    if (navigator.onLine === false) { Toast.show('Scanning needs internet. You can still type the sale in.', 'err'); return; }
    var biz = DB._bizId;
    if (!biz || !/^[A-Za-z0-9_\-]+$/.test(biz)) { Toast.show('Please sign in again', 'err'); return; }
    var rnd = new Uint8Array(12); crypto.getRandomValues(rnd);
    var code = Array.prototype.map.call(rnd, function(b) { return (b % 36).toString(36); }).join('');
    var link = location.origin + location.pathname + '#ps=' + code + '~' + biz;
    var ph = this._phone = { code: code, path: biz + '/PH-' + code + '.jpg', started: Date.now() };
    var qr = '';
    try { qr = QR.svg(link, 200); } catch (e) { qr = ''; }
    this._panel('<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:14px;background:var(--bg3);border:1.5px solid var(--g);border-radius:var(--r12)">'
      + '<div style="background:#fff;padding:6px;border-radius:10px;line-height:0;flex-shrink:0">' + qr + '</div>'
      + '<div style="flex:1;min-width:200px">'
      + '<div style="font-weight:800;color:var(--t1);font-size:15px">📱 Point your phone camera at this code</div>'
      + '<ol style="margin:8px 0 0 18px;padding:0;font-size:12.5px;color:var(--t2);line-height:1.7">'
      + '<li>Open the link that appears on your phone</li>'
      + '<li>Sign in with the same account if it asks</li>'
      + '<li>Tap <b>Take photo</b> and photograph the receipt</li></ol>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;color:var(--g);font-weight:700">'
      + '<div style="width:14px;height:14px;border:2px solid var(--bd2);border-top-color:var(--g);border-radius:50%;animation:spin 1s linear infinite"></div>Waiting for the photo…</div>'
      + '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">'
      + '<button type="button" class="btn-ghost btn-sm" onclick="ReceiptScan.phoneCopy()">Copy link</button>'
      + '<button type="button" class="btn-ghost btn-sm" onclick="ReceiptScan.reset()" style="color:var(--er)">Cancel</button></div>'
      + '</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>');
    ph.link = link;
    var self = this;
    setTimeout(function() { self._phonePoll(ph); }, 3000);
  },
  phoneCopy: function() {
    var ph = this._phone; if (!ph) return;
    (navigator.clipboard ? navigator.clipboard.writeText(ph.link) : Promise.reject()).then(
      function() { Toast.show('Link copied — send it to your phone', 'ok'); },
      function() { prompt('Open this link on your phone:', ph.link); });
  },
  _phonePoll: function(ph) {
    var self = this;
    if (this._phone !== ph) return;                          // cancelled, or a new code was made
    if (!Utils.get('s-scan-panel')) { this._phone = null; return; }   // the New Sale form was closed
    if (Date.now() - ph.started > 15 * 60 * 1000) {
      this._phone = null; this._panel(this._errorHtml('The phone link expired. Tap "Scan receipt with phone" again.')); return;
    }
    AI._authHeaders().then(function(h) {
      return fetch(SUPABASE_URL + '/storage/v1/object/authenticated/' + self.BUCKET + '/' + ph.path, {
        headers: { apikey: h.apikey, Authorization: h.Authorization }, cache: 'no-store',
      });
    }).then(function(res) {
      if (self._phone !== ph) return;
      if (!res.ok) { setTimeout(function() { self._phonePoll(ph); }, 2500); return; }
      return res.blob().then(function(blob) {
        if (self._phone !== ph) return;
        self._phone = null;
        Toast.show('Photo received from your phone ✓', 'ok');
        self._scan(blob, ph.path);
      });
    }).catch(function() { if (self._phone === ph) setTimeout(function() { self._phonePoll(ph); }, 5000); });
  },

  // On the phone: the link from the QR code was opened (the code is kept until the photo is sent)
  phoneCheck: function() {
    var v = ''; try { v = sessionStorage.getItem('ssp_phone_scan') || ''; } catch (e) {}
    var m = /^([a-z0-9]{12,40})~([A-Za-z0-9_\-]{1,80})$/.exec(v); if (!m) return;
    if (Utils.get('ps-status')) return;                       // already showing
    if (DB._bizId !== m[2]) {
      try { sessionStorage.removeItem('ssp_phone_scan'); } catch (e) {}
      Modal.open({ title: '📱 Receipt photo', barColor: 'var(--er)',
        body: '<p style="font-size:14px;color:var(--t2);line-height:1.6">This phone is signed in to a different business than the computer. Sign in with the same account on both, then scan the code again.</p>',
        footer: '<button class="btn-ghost btn-full" onclick="Modal.close()">Close</button>' });
      return;
    }
    this._phoneCode = m[1];
    Modal.open({ title: '📱 Send a receipt photo', sub: 'It goes to the New Sale form on your computer',
      body: '<input type="file" id="ps-file" accept="image/*" capture="environment" style="display:none" onchange="ReceiptScan.phoneFile(this)">'
        + '<button type="button" class="btn-primary btn-full" onclick="Utils.get(\'ps-file\').click()" style="padding:18px;font-size:17px;font-weight:800">📷 Take photo</button>'
        + '<div id="ps-status" style="margin-top:14px;font-size:13px;color:var(--t2);line-height:1.6;text-align:center">Lay the receipt flat in good light and fit the whole page in the picture.</div>',
      footer: '<button class="btn-ghost btn-full" onclick="ReceiptScan.phoneDone()">Close</button>' });
  },
  phoneFile: function(input) {
    var file = input && input.files && input.files[0]; if (!file) return;
    var st = Utils.get('ps-status'), biz = DB._bizId, code = this._phoneCode, self = this;
    if (!code || !biz) return;
    if (st) st.innerHTML = '<b style="color:var(--g)">Sending the photo…</b>';
    this._shrink(file).then(function(blob) {
      return AI._authHeaders().then(function(h) {
        return fetch(SUPABASE_URL + '/storage/v1/object/' + self.BUCKET + '/' + biz + '/PH-' + code + '.jpg', {
          method: 'POST', headers: { apikey: h.apikey, Authorization: h.Authorization, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: blob,
        });
      });
    }).then(function(res) {
      if (res.status === 409 || res.status === 400) {
        // Already sent once with this code
        if (st) st.innerHTML = '<b style="color:var(--wa)">A photo was already sent with this code.</b><br>To send another, tap "Scan receipt with phone" on the computer again and scan the new code.';
        return;
      }
      if (!res.ok) throw new Error(res.status);
      try { sessionStorage.removeItem('ssp_phone_scan'); } catch (e) {}
      if (st) st.innerHTML = '<div style="font-size:40px">✅</div><b style="color:var(--ok);font-size:15px">Sent! Look at your computer.</b><br>The New Sale form is filling in there.';
    }).catch(function() {
      if (st) st.innerHTML = '<b style="color:var(--er)">The photo could not be sent.</b> Check the internet connection and tap Take photo again.';
    });
  },
  phoneDone: function() { try { sessionStorage.removeItem('ssp_phone_scan'); } catch (e) {} this._phoneCode = null; Modal.close(); },
  pick: function() {
    if (this._busy) return;
    if (navigator.onLine === false) { Toast.show('Scanning needs internet. You can still type the sale in.', 'err'); return; }
    var f = Utils.get('s-scan-file'); if (f) { f.value = ''; f.click(); }
  },

  onFile: function(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type || 'image/')) { Toast.show('Please choose a photo', 'err'); return; }
    this._phone = null;
    this._scan(file, '');
  },

  // Read a photo (from this device, or sent from the phone already stored at `stored`)
  _scan: function(file, stored) {
    var self = this;
    this._busy = true;
    this._panel('<div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg3);border:1px solid var(--bd2);border-radius:var(--r12)">'
      + '<div class="spinner" style="width:22px;height:22px;border:3px solid var(--bd2);border-top-color:var(--g);border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0"></div>'
      + '<div><div style="font-weight:700;color:var(--t1);font-size:13px">Reading the receipt…</div>'
      + '<div style="font-size:11px;color:var(--t3)">This takes about 5–20 seconds</div></div></div>'
      + '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>');
    this._shrink(file).then(function(blob) {
      return self._toDataUrl(blob).then(function(dataUrl) {
        return AI._authHeaders().then(function(h) {
          return fetch(SUPABASE_URL + '/functions/v1/' + self.ENDPOINT, {
            method: 'POST', headers: h, body: JSON.stringify({ image: dataUrl, today: Utils.today() }),
          });
        }).then(function(res) {
          return res.json().catch(function() { return {}; }).then(function(d) {
            if (!res.ok || d.error) throw new Error(d.error || ('The receipt could not be read (' + res.status + ')'));
            return d;
          });
        }).then(function(result) {
          self._busy = false;
          if (self.current && self.current.url) { try { URL.revokeObjectURL(self.current.url); } catch (e) {} }
          self.current = { photo: blob, url: URL.createObjectURL(blob), result: result, uploaded: stored || '' };
          if (result.is_receipt === false) {
            self._panel(self._errorHtml('This photo doesn\'t look like a sales receipt. Try again with the whole receipt in the picture.'));
            self.current = null; return;
          }
          self.apply(result);
        });
      });
    }).catch(function(err) {
      self._busy = false;
      self._panel(self._errorHtml((err && err.message) || 'The receipt could not be read.'));
    });
  },

  _errorHtml: function(msg) {
    return '<div style="padding:12px 14px;background:var(--erb);border:1px solid var(--erbd);border-radius:var(--r12);font-size:13px;color:var(--er);margin-bottom:8px">⚠️ ' + Utils.esc(msg) + '</div>'
      + this._idleHtml();
  },
  _panel: function(html) { var p = Utils.get('s-scan-panel'); if (p) p.innerHTML = html; },

  // Resize to a sharp-enough JPEG (handwriting needs detail; keep under ~600 KB)
  _shrink: function(file) {
    return new Promise(function(resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function() {
        var max = 1800, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function(b) { b ? resolve(b) : reject(new Error('Could not prepare the photo')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Could not open the photo')); };
      img.src = url;
    });
  },
  _toDataUrl: function(blob) {
    return new Promise(function(resolve, reject) {
      var r = new FileReader(); r.onload = function() { resolve(r.result); }; r.onerror = reject; r.readAsDataURL(blob);
    });
  },

  // ── Fill the New Sale form from what was read ──────────────────────────────
  apply: function(r) {
    var products = DB.getProducts();
    // "No. 3134", "#3134", "Receipt No: 3134" → "3134" (the same number the app uses as Invoice No.)
    if (r.receipt_no) r.receipt_no = String(r.receipt_no).replace(/^[\s#:.\-]*((receipt|invoice|inv|rcpt|n[º°]|no|nr|number)[\s#:.\-]*)*/i, '').trim();
    // Customer: an existing record (same phone, or same name) or the name/phone as written
    var digits = function(s) { return String(s || '').replace(/\D/g, '').slice(-7); };
    var cust = null;
    if (r.customer_phone && digits(r.customer_phone).length >= 7) {
      cust = DB.getCustomers().find(function(c) { return digits(c.phone) === digits(r.customer_phone); }) || null;
    }
    if (!cust && r.customer_name) {
      var n = r.customer_name.toLowerCase().trim();
      cust = DB.getCustomers().find(function(c) { return (c.name || '').toLowerCase().trim() === n; }) || null;
    }
    if (cust) Sales.selectCust(cust);
    else if (r.customer_name || r.customer_phone) {
      Sales.selectWalkin();
      var ne = Utils.get('s-cust-name'); if (ne) ne.value = r.customer_name || 'Walk-in Customer';
      var pe = Utils.get('s-cust-phone'); if (pe) pe.value = r.customer_phone || '';
    }
    if (r.date) { var de = Utils.get('s-date'); if (de) de.value = r.date; }
    if (r.payment_method) { var me = Utils.get('s-method'); if (me) me.value = r.payment_method; }
    if (r.discount_amount > 0) {
      var dv = Utils.get('s-disc'); if (dv) dv.value = r.discount_amount;
      var dt = Utils.get('s-disc-type'); if (dt) dt.value = 'amount';
    }
    var ap = Utils.get('s-amt-paid'); if (ap) ap.value = (r.amount_paid != null && r.total_written && r.amount_paid < r.total_written) ? r.amount_paid : '';
    // The number written on the paper becomes the invoice number
    if (r.receipt_no) {
      var inv = Utils.get('s-inv-no'); if (inv) inv.value = r.receipt_no;
      var hint = Utils.get('s-inv-hint'); if (hint) { hint.textContent = 'From the paper receipt — check it matches'; hint.style.color = 'var(--wa)'; }
    }

    // Lines that match a product go into the cart; the rest wait for the staff member to pick a product
    Sales.cart = [];
    this.current.unmatched = [];
    var self = this;
    (r.items || []).forEach(function(it, idx) {
      var p = it.product_id && products.find(function(x) { return x.id === it.product_id; });
      if (!p) { self.current.unmatched.push({ idx: idx, written: it.written, qty: it.qty, price: it.unit_price }); return; }
      var ex = Sales.cart.find(function(c) { return c.id === p.id && c.price === it.unit_price; });
      var scan = { written: it.written, sure: !!it.sure, warnings: (it.warnings || []).slice() };
      if (p.price && it.unit_price && Math.abs(p.price - it.unit_price) > 0.009) {
        scan.warnings.push('Receipt price ' + Utils.cur(it.unit_price, '$') + ', stock price ' + Utils.cur(p.price, '$'));
      }
      if (ex) { ex.qty += it.qty; ex._scan.sure = ex._scan.sure && scan.sure; ex._scan.written += ' + ' + it.written; return; }
      Sales.cart.push({ id: p.id, name: p.name, price: it.unit_price || p.price, cost: p.cost || 0, qty: it.qty, maxQty: p.qty, unit: p.unit || 'Pcs', _scan: scan });
    });
    Sales.renderCart();
    this.render();
    Toast.show('Receipt read — check every line before saving', 'ok');
  },

  // Called when a product is added by hand while a scan is open: it clears a waiting unmatched line
  resolveUnmatched: function(i) {
    if (!this.current || !this.current.unmatched) return;
    var u = this.current.unmatched[i]; if (!u) return;
    var s = Utils.get('s-prod-search');
    if (s) {
      // A size like "24 x 24" finds tiles best; otherwise the first words as written
      var w = String(u.written || '').replace(/(\d)\s*[x×*]\s*(?=\d)/gi, '$1x');
      var size = w.match(/\d+x\d+(x\d+)?/i);
      s.value = size ? size[0] : w.split(' ').slice(0, 2).join(' ');
      s.focus(); Sales.onProdSearch(s.value);
    }
    this.current._pending = i;
  },
  // Sales.addToCartById asks first: when a "Find product" is waiting, the picked product gets the
  // quantity and price written on the receipt for that line. Returns true when it handled the add.
  takePending: function(productId) {
    var c = this.current; if (!c || c._pending == null) return false;
    var u = c.unmatched[c._pending]; c._pending = null; if (!u) return false;
    var p = DB.getProducts().find(function(x) { return x.id === productId; }); if (!p) return false;
    Sales.cart.push({ id: p.id, name: p.name, price: u.price || p.price, cost: p.cost || 0, qty: u.qty || 1, maxQty: p.qty, unit: p.unit || 'Pcs',
      _scan: { written: u.written, sure: true, warnings: ['Product picked by hand'] } });
    c.unmatched = c.unmatched.filter(function(x) { return x !== u; });
    Sales.renderCart(); this.render();
    Toast.show(p.name + ' added for "' + u.written + '" ✓', 'ok');
    return true;
  },
  skipUnmatched: function(i) {
    if (!this.current || !this.current.unmatched) return;
    this.current.unmatched.splice(i, 1); this.render(); this.refresh();
  },

  // ── The review panel (above the form) ──────────────────────────────────────
  render: function() {
    var c = this.current; if (!c) return;
    var r = c.result, cur = DB.getSettings().currency || '$';
    var unsure = Sales.cart.filter(function(i) { return i._scan && !i._scan.sure; }).length;
    var dup = this._duplicate(r);
    var html = '<div style="background:var(--wab);border:1.5px solid var(--wa);border-radius:var(--r12);padding:12px 14px">'
      + '<div style="display:flex;gap:12px;align-items:flex-start">'
      + '<img src="' + c.url + '" alt="Receipt photo" onclick="ReceiptScan.showPhoto()" style="width:64px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--bd2);cursor:zoom-in;flex-shrink:0">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-weight:800;color:var(--t1);font-size:14px">📷 Scanned receipt' + (r.receipt_no ? ' #' + Utils.esc(r.receipt_no) : '') + '</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:2px">Handwriting: <b>' + ({ good: 'clear', fair: 'mostly clear', poor: 'hard to read' }[r.legibility] || r.legibility) + '</b>'
      + ' · ' + (r.items || []).length + ' line' + ((r.items || []).length === 1 ? '' : 's') + ' read'
      + (unsure ? ' · <b style="color:var(--wa)">' + unsure + ' to check</b>' : '') + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'
      + '<button type="button" class="btn-ghost btn-sm" onclick="ReceiptScan.showPhoto()">🔍 View photo</button>'
      + '<button type="button" class="btn-ghost btn-sm" onclick="ReceiptScan.pick()">↻ Scan again</button>'
      + '<button type="button" class="btn-ghost btn-sm" onclick="ReceiptScan.discard()" style="color:var(--er)">✕ Discard scan</button>'
      + '</div></div></div>';

    if (dup) html += '<div style="margin-top:10px;padding:9px 11px;background:var(--erb);border:1px solid var(--erbd);border-radius:var(--r8);font-size:12px;color:var(--er);font-weight:600">⚠️ ' + Utils.esc(dup) + '</div>';
    html += '<div id="s-scan-total"></div>';

    if (c.unmatched && c.unmatched.length) {
      html += '<div style="margin-top:10px;font-size:11px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.08em">Not matched to a product — pick one or skip</div>'
        + c.unmatched.map(function(u, i) {
          return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:8px 10px;background:var(--bg2);border:1px dashed var(--wa);border-radius:var(--r8)">'
            + '<div style="flex:1;min-width:0;font-size:13px"><b>"' + Utils.esc(u.written) + '"</b>'
            + '<div style="font-size:11px;color:var(--t3)">' + u.qty + ' × ' + Utils.cur(u.price || 0, cur) + '</div></div>'
            + '<button type="button" class="btn-ghost btn-sm" onclick="ReceiptScan.resolveUnmatched(' + i + ')">Find product</button>'
            + '<button type="button" class="btn-ghost btn-sm" onclick="ReceiptScan.skipUnmatched(' + i + ')" title="Leave this line out">Skip</button></div>';
        }).join('');
    }
    if (r.unreadable && r.unreadable.length) {
      html += '<div style="margin-top:10px;font-size:12px;color:var(--t2)"><b>Couldn\'t read:</b> ' + r.unreadable.map(Utils.esc).join('; ') + '</div>';
    }
    if (r.notes) html += '<div style="margin-top:6px;font-size:12px;color:var(--t2)"><b>Note on receipt:</b> ' + Utils.esc(r.notes) + '</div>';

    html += '<label style="display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:10px;background:var(--bg2);border-radius:var(--r8);cursor:pointer;font-size:13px;color:var(--t1);font-weight:600">'
      + '<input type="checkbox" id="s-scan-ok" onchange="this.parentNode.style.outline=\'\'" style="-webkit-appearance:checkbox;appearance:auto;accent-color:var(--ok);width:20px;height:20px;flex-shrink:0;margin-top:1px;cursor:pointer">'
      + '<span>I checked every line, the customer and the total against the paper receipt</span></label>'
      + '</div>';
    this._panel(html);
    this.refresh();
  },

  // Live check: does the form's total match the total written on the paper?
  refresh: function() {
    var el = Utils.get('s-scan-total'); var c = this.current;
    if (!el || !c) return;
    var r = c.result, cur = DB.getSettings().currency || '$';
    var sub = Sales.cart.reduce(function(a, i) { return a + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 0); }, 0);
    var total = sub - (Sales._formDisc ? Sales._formDisc(sub).amount : 0);
    if (!r.total_written) {
      el.innerHTML = '<div style="margin-top:10px;font-size:12px;color:var(--t2)">No total written on the receipt. Form total: <b>' + Utils.cur(total, cur) + '</b></div>';
      return;
    }
    var ok = Math.abs(total - r.total_written) <= 0.05;
    // Lines still waiting for a product are not in the form yet: say how much of the gap they cover
    var waiting = (c.unmatched || []).reduce(function(a, u) { return a + (parseFloat(u.price) || 0) * (parseFloat(u.qty) || 0); }, 0);
    var covered = !ok && waiting > 0 && Math.abs(total + waiting - r.total_written) <= 0.05;
    el.innerHTML = '<div style="margin-top:10px;padding:9px 11px;border-radius:var(--r8);font-size:13px;font-weight:700;'
      + (ok ? 'background:var(--okb);border:1px solid var(--okbd);color:var(--ok)">✓ Total matches the receipt: ' + Utils.cur(total, cur)
        : covered ? 'background:var(--wab);border:1px solid var(--wa);color:var(--wa)">Receipt total ' + Utils.cur(r.total_written, cur) + ' — form ' + Utils.cur(total, cur)
            + ' so far. Pick products for the lines below (' + Utils.cur(waiting, cur) + ') and it will match.'
        : 'background:var(--erb);border:1px solid var(--erbd);color:var(--er)">✗ Receipt total ' + Utils.cur(r.total_written, cur) + ' — form total ' + Utils.cur(total, cur)
            + ' (difference ' + Utils.cur(Math.abs(total - r.total_written), cur) + ')'
            + (waiting > 0 ? '<div style="font-weight:600;font-size:12px;margin-top:3px">' + Utils.cur(waiting, cur) + ' of it is in the lines below that still need a product.</div>' : ''))
      + '</div>';
  },

  _duplicate: function(r) {
    var sales = DB.getSales();
    if (r.receipt_no) {
      var used = sales.find(function(x) { return String(x.invoiceNo || '') === String(r.receipt_no); });
      if (used) return 'Invoice No. ' + r.receipt_no + ' is already saved (' + (used.customer || 'Walk-in') + ', ' + (used.date || '') + '). If this is the same receipt, discard this scan; if not, change the Invoice No.';
      var s = sales.find(function(x) { return x.scan && x.scan.receiptNo && String(x.scan.receiptNo) === String(r.receipt_no); });
      if (s) return 'Paper receipt #' + r.receipt_no + ' was already scanned as invoice ' + Sales.no(s) + ' on ' + (s.date || '') + '.';
    }
    if (r.total_written) {
      var d = r.date || Utils.today();
      var t = sales.find(function(x) {
        return x.scan && x.date === d && Math.abs((parseFloat(x.scan.writtenTotal) || 0) - r.total_written) < 0.01
          && (!r.customer_name || (x.customer || '').toLowerCase() === r.customer_name.toLowerCase());
      });
      if (t) return 'A scanned receipt with the same date and total (' + Utils.cur(r.total_written, '$') + ') is already saved as invoice ' + Sales.no(t) + '. Make sure this is not the same receipt.';
    }
    return '';
  },

  discard: function() {
    var r = this.current && this.current.result, inv = Utils.get('s-inv-no');
    if (r && r.receipt_no && inv && inv.value === r.receipt_no) {
      inv.value = DB.getSettings().invoiceNextNo || '';
      var hint = Utils.get('s-inv-hint'); if (hint) { hint.textContent = 'Next number filled in automatically'; hint.style.color = ''; }
    }
    this.reset();
    Sales.cart.forEach(function(i) { delete i._scan; });
    Sales.renderCart();
    Toast.show('Scan discarded — the form is kept as it is', 'ok');
  },

  showPhoto: function(src) {
    src = src || (this.current && this.current.url); if (!src) return;
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:12px;cursor:zoom-out';
    d.innerHTML = '<img src="' + src + '" alt="Receipt photo" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px">'
      + '<button style="position:absolute;top:12px;right:12px;width:40px;height:40px;border-radius:50%;border:none;background:#fff;font-size:18px;cursor:pointer" aria-label="Close">✕</button>';
    d.onclick = function() { d.remove(); };
    document.body.appendChild(d);
  },

  // ── Saving ────────────────────────────────────────────────────────────────
  // Called by Sales.saveSale: false (with the reason shown) until the staff member has confirmed the scan
  canSave: function() {
    var c = this.current;
    if (!c) return true;
    if (c.unmatched && c.unmatched.length) {
      Toast.show('Pick a product (or tap Skip) for every line marked "Not matched"', 'err');
      var p = Utils.get('s-scan-panel'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return false;
    }
    var ok = Utils.get('s-scan-ok');
    if (!ok || !ok.checked) {
      Toast.show('Tick "I checked every line…" after checking the form against the paper receipt', 'err');
      if (ok) { ok.parentNode.style.outline = '2px solid var(--er)'; ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return false;
    }
    return true;
  },

  // Stores the photo, then calls done(scanMeta) — the record kept on the sale
  beforeSave: function(done) {
    var c = this.current;
    if (!c) return done(null);
    var r = c.result;
    var meta = {
      receiptNo: r.receipt_no || '', writtenTotal: r.total_written || null, confirmed: true, model: r.model || '',
      unsureLines: (r.items || []).filter(function(i) { return !i.sure; }).length,
    };
    if (c.uploaded) { meta.photo = c.uploaded; return done(meta); }
    this._upload(c.photo).then(function(path) {
      c.uploaded = path; meta.photo = path; done(meta);
    }, function() {
      Toast.show('The receipt photo could not be stored (no connection?) — the sale is saved without it', 'warn');
      done(meta);
    });
  },

  _upload: function(blob) {
    var biz = DB._bizId;
    if (!biz || !/^[A-Za-z0-9_\-]+$/.test(biz)) return Promise.reject(new Error('no business'));
    var path = biz + '/' + Utils.uid('RC') + '.jpg';
    var self = this;
    return AI._authHeaders().then(function(h) {
      return fetch(SUPABASE_URL + '/storage/v1/object/' + self.BUCKET + '/' + path, {
        method: 'POST',
        headers: { apikey: h.apikey, Authorization: h.Authorization, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
        body: blob,
      });
    }).then(function(res) { if (!res.ok) throw new Error('upload ' + res.status); return path; });
  },

  // Show the stored photo of a saved sale (private: fetched with the user's sign-in)
  openSaved: function(path) {
    if (!path) return;
    Toast.show('Opening receipt photo…', 'ok');
    var self = this;
    AI._authHeaders().then(function(h) {
      return fetch(SUPABASE_URL + '/storage/v1/object/authenticated/' + self.BUCKET + '/' + path, {
        headers: { apikey: h.apikey, Authorization: h.Authorization },
      });
    }).then(function(res) {
      if (!res.ok) throw new Error(res.status);
      return res.blob();
    }).then(function(b) { self.showPhoto(URL.createObjectURL(b)); }, function() {
      Toast.show('The receipt photo could not be opened', 'err');
    });
  },
};
