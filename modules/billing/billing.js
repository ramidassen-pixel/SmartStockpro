/* === billing.js — Plan & Billing ===
   Shops upgrade from the free trial to Shop ($9/month) or Business ($19/month).
   They pay by Mobile Money to the platform owner's number, then submit the
   transaction ID here. The platform owner sees the payment on this same page
   ("Payments to confirm"), checks their phone and taps Approve or Reject.
   The server sets the price and only the platform owner can approve
   (see supabase/migrations/20261123090000_plan_payments.sql).            */

var BILLING = {
  // Where shops send the money. Leave a number empty to hide that network.
  payTo: {
    'MTN MoMo':     '0880563614',
    'Orange Money': '',
  },
  payToName: 'RAMIE DASSEN',   // name shops see when they send the money
  whatsapp: '231889756551',    // shops can message you after paying
  plans: {
    shop:     { name: 'Shop',     price: 9,  points: ['1 shop, up to 3 staff', 'Unlimited products and sales', 'Invoices, debts, reports', 'AI assistant'] },
    business: { name: 'Business', price: 19, points: ['Up to 10 staff', 'Suppliers, purchase orders, salary', 'Help setting up your stock list', 'Priority support'] },
  },
};

var Billing = {
  _me: null,          // result of my_plan()
  _mine: [],          // this shop's payments
  _review: [],        // payments waiting for the platform owner
  _pick: 'shop',
  _months: 1,
  _busy: false,

  // ── data ──────────────────────────────────────────────────────────────────
  _get: function(path) {
    return DB._ensureToken().then(function() {
      var h = DB._hdr(); delete h.Prefer;
      return fetch(DB._url() + '/rest/v1/' + path, { headers: h });
    }).then(function(r) {
      return r.json().then(function(d) { if (!r.ok) throw new Error((d && d.message) || 'Server error'); return d; });
    });
  },
  _post: function(table, row) {
    return DB._ensureToken().then(function() {
      var h = DB._hdr(); h.Prefer = 'return=representation';
      return fetch(DB._url() + '/rest/v1/' + table, { method: 'POST', headers: h, body: JSON.stringify(row) });
    }).then(function(r) {
      return r.json().catch(function() { return {}; }).then(function(d) {
        if (!r.ok) {
          var msg = (d && d.message) || 'Server error';
          if (/plan_payments_txn_uq|duplicate key/i.test(msg)) msg = 'That transaction ID was already submitted.';
          throw new Error(msg);
        }
        return Array.isArray(d) ? d[0] : d;
      });
    });
  },

  load: function() {
    var self = this;
    return DB.rpc('my_plan', {}).then(function(me) {
      self._me = me || {};
      var jobs = [];
      if (me && me.business_id) {
        jobs.push(self._get('plan_payments?select=*&business_id=eq.' + encodeURIComponent(me.business_id) + '&order=created_at.desc&limit=20')
          .then(function(r) { self._mine = r || []; }, function() { self._mine = []; }));
      }
      if (me && me.is_platform_admin) {
        jobs.push(self._get('plan_payments?select=*&order=created_at.desc&limit=50')
          .then(function(r) { self._review = r || []; }, function() { self._review = []; }));
      }
      return Promise.all(jobs);
    });
  },

  // ── page ──────────────────────────────────────────────────────────────────
  render: function() {
    var pg = Utils.get('pg-billing'); if (!pg) return;
    pg.innerHTML = '<div class="page-header"><div><div class="page-title">Plan &amp; Billing</div>'
      + '<div class="page-sub">Your SmartStock Pro plan</div></div></div>'
      + '<div class="sec"><div class="card card-body" style="text-align:center;color:var(--t3)">Loading your plan…</div></div>';
    var self = this;
    this.load().then(function() { self._paint(); }, function(e) {
      pg.innerHTML = '<div class="page-header"><div><div class="page-title">Plan &amp; Billing</div></div></div>'
        + '<div class="empty"><div class="empty-icon">📶</div><div class="empty-title">Could not load your plan</div>'
        + '<div class="empty-sub">' + Utils.esc(e && e.network ? 'You are offline. Connect to the internet and try again.' : (e && e.message) || '') + '</div>'
        + '<div class="empty-action"><button class="btn-primary btn-sm" onclick="Billing.render()">Try again</button></div></div>';
    });
  },

  _status: function() {
    var me = this._me || {}, P = BILLING.plans;
    var d = function(x) { return x ? Utils.date(x) : ''; };
    var map = {
      owner:       ['👑', 'Owner account', 'Your own shop. No payment needed.', 'var(--g)'],
      active:      ['✅', (P[me.plan] ? P[me.plan].name : 'Paid') + ' plan', 'Paid until ' + d(me.paid_until) + ' · ' + me.days_left + ' day' + (me.days_left === 1 ? '' : 's') + ' left', 'var(--ok)'],
      expired:     ['⚠️', 'Plan ended', 'Your ' + (P[me.plan] ? P[me.plan].name : '') + ' plan ended on ' + d(me.paid_until) + '. Pay below to continue.', 'var(--er)'],
      trial:       ['🎁', 'Free trial', me.days_left + ' day' + (me.days_left === 1 ? '' : 's') + ' left (ends ' + d(me.trial_ends) + ')', 'var(--in)'],
      trial_ended: ['⏳', 'Free trial ended', 'Ended ' + d(me.trial_ends) + '. Choose a plan below to keep going.', 'var(--wa)'],
    };
    var s = map[me.state] || ['ℹ️', 'Plan', '', 'var(--t2)'];
    return '<div class="card card-body" style="display:flex;gap:14px;align-items:center;border-left:4px solid ' + s[3] + '">'
      + '<div style="font-size:34px">' + s[0] + '</div><div><div style="font-size:17px;font-weight:800;color:var(--t1)">' + s[1] + '</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-top:3px">' + s[2] + '</div></div></div>';
  },

  _paint: function() {
    var pg = Utils.get('pg-billing'); if (!pg) return;
    var me = this._me || {};
    var html = '<div class="page-header"><div><div class="page-title">Plan &amp; Billing</div>'
      + '<div class="page-sub">Pay by Mobile Money · confirmed within 24 hours</div></div>'
      + '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="Billing.render()">↻ Refresh</button></div></div>'
      + '<div class="sec">' + this._status() + '</div>';

    if (me.is_platform_admin) html += this._reviewHtml();
    if (me.state !== 'owner') html += this._payHtml();
    if (this._mine.length) html += this._mineHtml();
    pg.innerHTML = html;
  },

  _payHtml: function() {
    var me = this._me || {}, self = this, P = BILLING.plans;
    var cards = Object.keys(P).map(function(k) {
      var p = P[k], on = self._pick === k;
      return '<button class="card card-body" onclick="Billing._pick=\'' + k + '\';Billing._paint()" aria-pressed="' + on + '" '
        + 'style="flex:1;min-width:150px;text-align:left;cursor:pointer;border:2px solid ' + (on ? 'var(--g)' : 'var(--bd2)') + ';background:' + (on ? 'var(--gb)' : 'var(--bg2)') + '">'
        + '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:' + (on ? 'var(--g)' : 'var(--t3)') + '">' + p.name + (on ? ' ✓' : '') + '</div>'
        + '<div style="font-size:26px;font-weight:900;color:var(--t1);margin:6px 0">$' + p.price + '<span style="font-size:13px;font-weight:600;color:var(--t3)"> / month</span></div>'
        + p.points.map(function(x) { return '<div style="font-size:12px;color:var(--t2);margin-top:3px">• ' + x + '</div>'; }).join('')
        + '</button>';
    }).join('');
    var monthsOpts = [1, 3, 6, 12].map(function(m) {
      return '<option value="' + m + '"' + (self._months === m ? ' selected' : '') + '>' + m + ' month' + (m > 1 ? 's' : '') + '</option>';
    }).join('');
    var total = P[this._pick].price * this._months;
    var nets = Object.keys(BILLING.payTo).filter(function(n) { return BILLING.payTo[n]; });
    var payLines = nets.map(function(n) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)">'
        + '<span style="font-size:13px;color:var(--t2)">' + n + '</span>'
        + '<span style="font-family:var(--fm);font-size:16px;font-weight:800;color:var(--t1)">' + BILLING.payTo[n] + '</span>'
        + '<button class="btn-ghost btn-sm" onclick="Billing.copy(\'' + BILLING.payTo[n] + '\')">Copy</button></div>';
    }).join('');

    var form = me.is_owner_of_shop
      ? '<div class="fg"><label class="fl">Network you paid with</label><select class="fi" id="bl-net">'
          + nets.map(function(n) { return '<option>' + n + '</option>'; }).join('') + '</select></div>'
        + '<div class="form-row">'
        + '<div class="fg"><label class="fl">Phone number you paid from *</label><input class="fi" id="bl-phone" type="tel" inputmode="tel" placeholder="088 000 0000"></div>'
        + '<div class="fg"><label class="fl">Name on that number</label><input class="fi" id="bl-name" maxlength="80" placeholder="Name shown on the payment"></div>'
        + '</div>'
        + '<div class="fg"><label class="fl">Transaction ID (from the SMS) *</label><input class="fi" id="bl-txn" maxlength="40" autocapitalize="characters" placeholder="e.g. 1234567890" style="font-family:var(--fm);letter-spacing:.05em"></div>'
        + '<button class="btn-primary btn-full" id="bl-submit" onclick="Billing.submit()">I have paid · Send for confirmation</button>'
      : '<div style="font-size:13px;color:var(--t2);background:var(--bg3);border-radius:var(--r10);padding:12px">Only the shop owner can pay for the plan. Ask the owner to open <strong>More → Plan &amp; Billing</strong>.</div>';

    return '<div class="sec"><div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">1 · Choose a plan</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div>'
      + '<div class="card card-body" style="margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
      + '<label class="fl" for="bl-months" style="margin:0">Pay for</label>'
      + '<select class="fi" id="bl-months" style="width:auto;flex:1;min-width:120px" onchange="Billing._months=parseInt(this.value,10)||1;Billing._paint()">' + monthsOpts + '</select>'
      + '<div style="margin-left:auto;text-align:right"><div style="font-size:11px;color:var(--t3)">Total to send</div>'
      + '<div style="font-size:24px;font-weight:900;color:var(--g);font-family:var(--fm)">$' + total + '</div></div></div></div>'

      + '<div class="sec"><div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">2 · Send the money</div>'
      + '<div class="card card-body">'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:6px">Send <strong style="color:var(--t1)">$' + total + '</strong> (or the same amount in LRD) to:</div>'
      + payLines
      + (BILLING.payToName ? '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)">'
          + '<span style="font-size:13px;color:var(--t2)">Name</span><span style="font-size:14px;font-weight:800;color:var(--t1)">' + Utils.esc(BILLING.payToName) + '</span></div>' : '')
      + '<div style="font-size:12px;color:var(--t3);margin-top:8px">Check the name shows as ' + Utils.esc(BILLING.payToName || 'above') + ' before you send. Keep the SMS: it has the transaction ID you need below.</div>'
      + '</div></div>'

      + '<div class="sec"><div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">3 · Tell us you paid</div>'
      + '<div class="card card-body">' + form + '</div></div>';
  },

  _badge: function(st) {
    return Utils.statusBadge(st === 'approved' ? 'Approved' : st === 'rejected' ? 'Rejected' : 'Pending')
      .replace('Pending', 'Waiting');
  },

  _row: function(p, admin) {
    var P = BILLING.plans;
    var when = p.created_at ? new Date(p.created_at) : null;
    return '<div class="list-item" style="flex-wrap:wrap;cursor:default">'
      + '<div class="list-info">'
      + (admin ? '<div class="list-name">' + Utils.esc(p.business_name || p.business_id) + '</div>' : '')
      + '<div class="' + (admin ? 'list-meta' : 'list-name') + '">' + (P[p.plan] ? P[p.plan].name : p.plan) + ' · ' + p.months + ' month' + (p.months > 1 ? 's' : '') + '</div>'
      + '<div class="list-meta" style="font-family:var(--fm)">' + Utils.esc(p.network) + ' · ID ' + Utils.esc(p.txn_id) + '</div>'
      + '<div class="list-meta">From ' + Utils.esc(p.payer_phone) + (p.payer_name ? ' (' + Utils.esc(p.payer_name) + ')' : '')
      + (when ? ' · ' + Utils.date(when) + ' ' + when.toTimeString().slice(0, 5) : '') + '</div>'
      + (p.note ? '<div class="list-meta" style="color:var(--wa)">Note: ' + Utils.esc(p.note) + '</div>' : '')
      + '</div>'
      + '<div class="list-right"><div class="list-val">$' + (parseFloat(p.amount) || 0) + '</div><div style="margin-top:4px">' + this._badge(p.status) + '</div></div>'
      + (admin && p.status === 'pending'
          ? '<div class="list-actions" style="width:100%;margin-top:8px">'
            + '<button class="btn-ghost btn-sm" onclick="Billing.review(\'' + p.id + '\',false)">✕ Reject</button>'
            + '<button class="btn-ok btn-sm" onclick="Billing.review(\'' + p.id + '\',true)">✓ Approve</button></div>'
          : '')
      + '</div>';
  },

  _reviewHtml: function() {
    var self = this;
    var waiting = this._review.filter(function(p) { return p.status === 'pending'; });
    var done = this._review.filter(function(p) { return p.status !== 'pending'; }).slice(0, 10);
    return '<div class="sec"><div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">'
      + '🛡️ Payments to confirm (' + waiting.length + ')</div>'
      + (waiting.length
          ? '<div style="font-size:12px;color:var(--t3);margin-bottom:8px">Check the amount and transaction ID on your phone before approving.</div>'
            + '<div class="card">' + waiting.map(function(p) { return self._row(p, true); }).join('') + '</div>'
          : '<div class="card card-body" style="font-size:13px;color:var(--t3)">No payments waiting.</div>')
      + (done.length ? '<div style="font-size:11px;color:var(--t3);margin:12px 0 6px">Recently checked</div><div class="card">'
          + done.map(function(p) { return self._row(p, true); }).join('') + '</div>' : '')
      + '</div>';
  },

  _mineHtml: function() {
    var self = this;
    return '<div class="sec"><div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">Your payments</div>'
      + '<div class="card">' + this._mine.map(function(p) { return self._row(p, false); }).join('') + '</div></div>';
  },

  // ── actions ───────────────────────────────────────────────────────────────
  copy: function(txt) {
    var ok = function() { Toast.show('Number copied ✓', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, ok);
    else ok();
  },

  submit: function() {
    if (this._busy) return;
    var me = this._me || {};
    var phone = Utils.val('bl-phone'), txn = Utils.val('bl-txn').replace(/\s+/g, ''), name = Utils.val('bl-name');
    var net = (Utils.get('bl-net') || {}).value;
    if (phone.replace(/\D/g, '').length < 6) { Toast.show('Enter the phone number you paid from', 'err'); return; }
    if (txn.length < 4) { Toast.show('Enter the transaction ID from the SMS', 'err'); return; }
    var plan = this._pick, months = this._months, total = BILLING.plans[plan].price * months;
    this._busy = true;
    var btn = Utils.get('bl-submit'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    var self = this;
    this._post('plan_payments', {
      business_id: me.business_id, plan: plan, months: months, amount: total,
      network: net, payer_phone: phone, payer_name: name || null, txn_id: txn,
    }).then(function(row) {
      self._busy = false;
      Toast.show('Sent ✓ We will confirm your payment soon', 'ok', 5000);
      self._afterSubmit(row || { plan: plan, months: months, amount: total, network: net, txn_id: txn.toUpperCase() });
      return self.load().then(function() { self._paint(); });
    }).catch(function(e) {
      self._busy = false;
      if (btn) { btn.disabled = false; btn.textContent = 'I have paid · Send for confirmation'; }
      Toast.show(e.network || e.message === 'Failed to fetch' ? 'No connection. Try again when you are online.' : e.message, 'err', 6000);
    });
  },

  _afterSubmit: function(p) {
    var me = this._me || {}, bizName = (DB.getSettings().bizName || '');
    var msg = 'Hello, I paid for SmartStock Pro.\n'
      + 'Shop: ' + bizName + ' (' + me.business_id + ')\n'
      + 'Plan: ' + (BILLING.plans[p.plan] ? BILLING.plans[p.plan].name : p.plan) + ', ' + p.months + ' month(s), $' + (parseFloat(p.amount) || 0) + '\n'
      + p.network + ' transaction ID: ' + p.txn_id;
    Modal.open({
      title: 'Payment sent for confirmation', barColor: 'var(--ok)',
      body: '<div style="text-align:center;padding:10px 0 6px"><div style="font-size:46px">✅</div>'
        + '<div style="font-size:14px;color:var(--t1);font-weight:700;margin:8px 0">We received your payment details</div>'
        + '<div style="font-size:13px;color:var(--t2);line-height:1.6">Your plan turns on as soon as the payment is confirmed, usually within 24 hours. You can send us a WhatsApp message to make it faster.</div></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Close</button>'
        + '<button class="btn-primary" style="flex:1" onclick="Billing._tellUs()">💬 Tell us on WhatsApp</button>',
    });
    this._waMsg = msg;
  },
  _waMsg: '',
  _tellUs: function() { Modal.close(); Sales._openWhatsApp(this._waMsg, BILLING.whatsapp); },

  review: function(id, approve) {
    var p = this._review.find(function(x) { return x.id === id; }); if (!p) return;
    var self = this;
    var go = function() {
      var note = approve ? null : (Utils.val('bl-note') || null);
      Modal.close();
      DB.rpc('review_plan_payment', { p_id: id, p_approve: approve, p_note: note }).then(function(r) {
        Toast.show(approve ? 'Approved ✓ ' + (p.business_name || '') + ' is on ' + BILLING.plans[p.plan].name + ' until ' + Utils.date(r && r.paid_until) : 'Payment rejected', approve ? 'ok' : 'warn', 5000);
        if (typeof Router !== 'undefined' && Router.current === 'superadmin') { SuperAdmin._tab = 'payments'; SuperAdmin._loadAndRender(); return; }
        return self.load().then(function() { self._paint(); });
      }).catch(function(e) { Toast.show(e.network ? 'No connection. Try again.' : e.message, 'err', 6000); });
    };
    Modal.open({
      title: approve ? 'Approve payment?' : 'Reject payment?', barColor: approve ? 'var(--ok)' : 'var(--er)',
      sub: Utils.esc(p.business_name || p.business_id),
      body: '<div class="report-row"><span class="report-label">Amount</span><span class="report-val">$' + (parseFloat(p.amount) || 0) + '</span></div>'
        + '<div class="report-row"><span class="report-label">Plan</span><span class="report-val">' + BILLING.plans[p.plan].name + ' · ' + p.months + ' month(s)</span></div>'
        + '<div class="report-row"><span class="report-label">' + Utils.esc(p.network) + ' ID</span><span class="report-val" style="font-family:var(--fm)">' + Utils.esc(p.txn_id) + '</span></div>'
        + '<div class="report-row"><span class="report-label">From</span><span class="report-val">' + Utils.esc(p.payer_phone) + '</span></div>'
        + (approve
            ? '<div style="font-size:12px;color:var(--t3);margin-top:10px">Only approve if this money arrived on your phone.</div>'
            : '<div class="fg" style="margin-top:10px"><label class="fl">Reason (the shop sees this)</label><input class="fi" id="bl-note" maxlength="300" placeholder="e.g. No payment found with this ID"></div>'),
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
        + '<button class="' + (approve ? 'btn-ok' : 'btn-danger') + '" style="flex:1" id="bl-go">' + (approve ? '✓ Approve' : '✕ Reject') + '</button>',
    });
    var b = Utils.get('bl-go'); if (b) b.onclick = go;
  },
};
