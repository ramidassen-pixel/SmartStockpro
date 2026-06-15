/* SmartStock Pro V5 — Customer Support & Feedback Module */
var Support = {
  activeTab: 'my',

  /* ══════════════════════════════════════════════════════════════
     RENDER — user-facing support page
  ══════════════════════════════════════════════════════════════ */
  render: function() {
    var pg = Utils.get('pg-support');
    if (!pg) return;
    var user    = Auth.currentUser || {};
    var isAdmin = (user.role === 'primary_admin' || user.role === 'admin');

    var tabs = isAdmin
      ? [['all','📋 All Tickets'],['my','📩 My Tickets'],['feedback','⭐ Feedback']]
      : [['my','📩 My Tickets'],['new','✉️ New Ticket'],['feedback','⭐ Give Feedback']];

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Support Center</div>'
      + '<div class="page-sub">Help, feedback & issue tracking</div></div>'
      + (isAdmin ? '' : '<div class="page-actions"><button class="btn-primary btn-sm" onclick="Support.setTab(\'new\')">＋ New Ticket</button></div>')
      + '</div>'
      + '<div class="chips">'
      + tabs.map(function(t){
          return '<div class="chip'+(Support.activeTab===t[0]?' active':'')+'" onclick="Support.setTab(\''+t[0]+'\')">'+t[1]+'</div>';
        }).join('')
      + '</div>'
      + '<div id="support-body"></div>';

    Support._renderTab();
  },

  setTab: function(t) { Support.activeTab = t; Support.render(); },

  _renderTab: function() {
    var el   = Utils.get('support-body'); if (!el) return;
    var user = Auth.currentUser || {};
    var isAdmin = user.role === 'primary_admin' || user.role === 'admin';
    var t = Support.activeTab;
    if      (t === 'new')      Support._renderNewTicket(el);
    else if (t === 'feedback') Support._renderFeedbackForm(el);
    else if (t === 'all' && isAdmin) Support._renderAllTickets(el);
    else     Support._renderMyTickets(el);
  },

  /* ── NEW TICKET FORM ──────────────────────────────────────────*/
  _renderNewTicket: function(el) {
    var cats = ['🐛 Bug Report','💡 Feature Request','💳 Billing Issue','🔐 Account Problem','⭐ General Feedback','❓ How To'];
    el.innerHTML = '<div class="sec">'
      + '<div class="card card-body">'
      + '<div style="text-align:center;padding:10px 0 18px">'
      + '<div style="font-size:48px;margin-bottom:8px">🎫</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1)">Submit a Support Ticket</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:4px">We usually reply within 24 hours</div>'
      + '</div>'
      + '<div class="fg"><label class="fl">Category</label>'
      + '<select class="fi" id="tk-cat">'
      + cats.map(function(c){ return '<option>'+c+'</option>'; }).join('')
      + '</select></div>'
      + '<div class="fg"><label class="fl">Subject *</label>'
      + '<input class="fi" id="tk-subj" placeholder="Brief summary of your issue"></div>'
      + '<div class="fg"><label class="fl">Describe your issue *</label>'
      + '<textarea class="fi" id="tk-msg" rows="5" placeholder="Please explain in detail what happened, what you expected, and what you see instead..." style="resize:none;line-height:1.6"></textarea></div>'
      + '<div class="fg"><label class="fl">Priority</label>'
      + '<select class="fi" id="tk-pri">'
      + '<option value="low">🟢 Low — General question</option>'
      + '<option value="normal" selected>🟡 Normal — Minor issue</option>'
      + '<option value="high">🔴 High — Blocking my work</option>'
      + '</select></div>'
      + '<div style="background:var(--inb);border:1px solid var(--inbd);border-radius:var(--r10);padding:12px 14px;margin-bottom:14px;font-size:12px;color:var(--in)">📧 You will receive updates on this ticket inside the app.</div>'
      + '<button class="btn-primary btn-full" onclick="Support.submitTicket()">🎫 Submit Ticket</button>'
      + '</div></div>';
  },

  submitTicket: function() {
    var user    = Auth.currentUser || {};
    var biz     = DB.getSettings();
    var cat     = (Utils.get('tk-cat')||{value:'⭐ General Feedback'}).value;
    var subj    = Utils.val('tk-subj').trim();
    var msg     = Utils.val('tk-msg').trim();
    var pri     = (Utils.get('tk-pri')||{value:'normal'}).value;

    if (!subj) { Toast.show('Enter a subject','err'); return; }
    if (!msg)  { Toast.show('Describe your issue','err'); return; }

    var ticketNum = 'TK-' + Date.now().toString(36).toUpperCase().slice(-6);
    var ticketId  = Utils.uid('TK');

    var ticket = {
      id:            ticketId,
      ticket_number: ticketNum,
      business_id:   user.currentBusinessId || (user.businessIds&&user.businessIds[0]) || null,
      business_name: biz.bizName || '',
      user_id:       user.id || '',
      user_name:     user.name || user.username || '',
      user_email:    user.email || '',
      category:      cat,
      subject:       subj,
      message:       msg,
      status:        'open',
      priority:      pri,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    };

    // Save locally
    var tickets = Support._getLocalTickets();
    tickets.unshift(ticket);
    Utils.storage.set('support_tickets', tickets);

    // Sync to Supabase
    var hdr = {
      'Content-Type':  'application/json',
      'apikey':         SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
    };
    fetch(SUPABASE_URL + '/rest/v1/support_tickets', {
      method:  'POST',
      headers: hdr,
      body:    JSON.stringify(ticket),
    }).then(function(r){
      console.log('Ticket synced:', r.status);
    }).catch(function(e){
      console.log('Ticket sync error:', e.message);
    });

    // Also send notification email via existing edge function
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:      'ramidassen@gmail.com',
          subject: '[SmartStock Support] ' + ticketNum + ': ' + subj,
          type:    'support',
          html:    '<h2>New Support Ticket</h2><p><b>Ticket:</b> '+ticketNum+'</p><p><b>From:</b> '+(user.name||'')+(user.email?' ('+user.email+')':'')+'</p><p><b>Business:</b> '+(biz.bizName||'')+'</p><p><b>Category:</b> '+cat+'</p><p><b>Priority:</b> '+pri+'</p><p><b>Subject:</b> '+subj+'</p><hr><p>'+msg+'</p>',
        }),
      }).catch(function(){});
    } catch(e) {}

    Toast.show('Ticket ' + ticketNum + ' submitted ✓', 'ok');
    Support.activeTab = 'my';
    Support.render();
  },

  /* ── MY TICKETS ───────────────────────────────────────────────*/
  _renderMyTickets: function(el) {
    var user    = Auth.currentUser || {};
    var tickets = Support._getLocalTickets().filter(function(t){ return t.user_id === user.id; });

    if (!tickets.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>'
        + '<div class="empty-title">No tickets yet</div>'
        + '<div class="empty-sub">Submit a ticket if you need help</div>'
        + '<div class="empty-action"><button class="btn-primary btn-sm" onclick="Support.setTab(\'new\')">＋ New Ticket</button></div></div>';
      return;
    }

    el.innerHTML = '<div class="sec"><div class="card">'
      + tickets.map(function(t){
          var sc = t.status==='open'?'var(--wa)':t.status==='answered'?'var(--ok)':t.status==='resolved'?'var(--g)':'var(--t3)';
          var pc = t.priority==='high'?'var(--er)':t.priority==='normal'?'var(--wa)':'var(--ok)';
          var msgs = Support._getLocalMessages(t.id);
          var hasReply = msgs.some(function(m){ return m.sender_type==='admin'; });
          return '<div class="list-item" onclick="Support.openTicket(\''+t.id+'\',false)">'
            + '<div class="list-icon" style="background:var(--gb)">🎫</div>'
            + '<div class="list-info">'
            + '<div class="list-name">'+Utils.esc(t.subject)
            + (hasReply ? ' <span style="font-size:10px;background:var(--okb);color:var(--ok);padding:2px 6px;border-radius:99px;font-weight:700">REPLIED</span>' : '')
            + '</div>'
            + '<div class="list-meta">'+Utils.esc(t.category)+' · '+t.ticket_number+'</div>'
            + '<div class="list-meta" style="font-size:10px;color:var(--t3)">'+Utils.date(t.created_at)+'</div>'
            + '</div>'
            + '<div class="list-right">'
            + '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;border:1px solid '+sc+';color:'+sc+'">'+t.status.toUpperCase()+'</span>'
            + '<span style="font-size:9px;color:'+pc+';margin-top:3px;display:block">'+t.priority.toUpperCase()+'</span>'
            + '</div></div>';
        }).join('')
      + '</div></div>';
  },

  /* ── ALL TICKETS (admin view) ─────────────────────────────────*/
  _renderAllTickets: function(el) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Loading tickets...</div>';

    var hdr = { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer '+SUPABASE_ANON };
    fetch(SUPABASE_URL + '/rest/v1/support_tickets?select=*&order=created_at.desc', { headers: hdr })
      .then(function(r){ return r.json(); })
      .then(function(tickets) {
        if (!tickets || !tickets.length) {
          el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">No tickets yet</div></div>';
          return;
        }
        var open     = tickets.filter(function(t){ return t.status==='open'; }).length;
        var answered = tickets.filter(function(t){ return t.status==='answered'; }).length;
        var resolved = tickets.filter(function(t){ return t.status==='resolved'; }).length;

        el.innerHTML = '<div class="sec">'
          + '<div class="kpi-grid" style="margin-bottom:14px">'
          + '<div class="kpi" style="--kc:var(--wa);--kibg:var(--wab)"><div class="kpi-icon">📬</div><div class="kpi-label">Open</div><div class="kpi-value">'+open+'</div></div>'
          + '<div class="kpi" style="--kc:var(--ok);--kibg:var(--okb)"><div class="kpi-icon">💬</div><div class="kpi-label">Answered</div><div class="kpi-value">'+answered+'</div></div>'
          + '<div class="kpi" style="--kc:var(--g);--kibg:var(--gb)"><div class="kpi-icon">✅</div><div class="kpi-label">Resolved</div><div class="kpi-value">'+resolved+'</div></div>'
          + '<div class="kpi" style="--kc:var(--in);--kibg:var(--inb)"><div class="kpi-icon">🎫</div><div class="kpi-label">Total</div><div class="kpi-value">'+tickets.length+'</div></div>'
          + '</div>'
          + '<div class="card">'
          + tickets.map(function(t){
              var sc = t.status==='open'?'var(--wa)':t.status==='answered'?'var(--ok)':t.status==='resolved'?'var(--g)':'var(--t3)';
              var pc = t.priority==='high'?'#FF4D6A':t.priority==='normal'?'#FFAD1F':'#0FD47D';
              return '<div class="list-item" onclick="Support.openTicket(\''+t.id+'\',true)">'
                + '<div class="list-icon" style="background:var(--bg3);font-size:16px">🎫</div>'
                + '<div class="list-info">'
                + '<div class="list-name">'+Utils.esc(t.subject)+'</div>'
                + '<div class="list-meta">'+Utils.esc(t.user_name||'')+' · '+Utils.esc(t.business_name||'')+'</div>'
                + '<div class="list-meta" style="font-size:10px;color:var(--t3)">'+t.ticket_number+' · '+Utils.esc(t.category||'')+'</div>'
                + '</div>'
                + '<div class="list-right">'
                + '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;border:1px solid '+sc+';color:'+sc+'">'+t.status.toUpperCase()+'</span>'
                + '<span style="font-size:9px;color:'+pc+';display:block;margin-top:3px">'+t.priority.toUpperCase()+'</span>'
                + '</div></div>';
            }).join('')
          + '</div></div>';

        // Store in local for reply access
        Utils.storage.set('support_tickets_admin', tickets);
      }).catch(function(err){
        el.innerHTML = '<div style="padding:20px;color:var(--er)">Error: '+Utils.esc(err.message)+'</div>';
      });
  },

  /* ── OPEN TICKET / CHAT VIEW ──────────────────────────────────*/
  openTicket: function(ticketId, isAdmin) {
    var ticket = isAdmin
      ? (Utils.storage.get('support_tickets_admin')||[]).find(function(t){ return t.id===ticketId; })
      : Support._getLocalTickets().find(function(t){ return t.id===ticketId; });
    if (!ticket) { Toast.show('Ticket not found','err'); return; }

    var sc = ticket.status==='open'?'var(--wa)':ticket.status==='answered'?'var(--ok)':ticket.status==='resolved'?'var(--g)':'var(--t3)';

    Modal.open({
      title: ticket.ticket_number,
      sub:   Utils.esc(ticket.subject),
      barColor: 'var(--in)',
      body:
        // Ticket info
        '<div style="background:var(--bg3);border-radius:var(--r10);padding:12px 14px;margin-bottom:14px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        + '<span style="font-size:11px;color:var(--t2)">'+Utils.esc(ticket.category||'')+'</span>'
        + '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;border:1px solid '+sc+';color:'+sc+'">'+ticket.status.toUpperCase()+'</span>'
        + '</div>'
        + '<div style="font-size:12px;color:var(--t1);line-height:1.7">'+Utils.esc(ticket.message)+'</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:6px">Submitted: '+Utils.date(ticket.created_at)+' by '+Utils.esc(ticket.user_name||'')+'</div>'
        + '</div>'

        // Messages thread
        + '<div id="ticket-messages" style="max-height:260px;overflow-y:auto;margin-bottom:12px">'
        + Support._buildMessages(ticketId)
        + '</div>'

        // Reply box
        + '<div class="fg" style="margin-bottom:8px"><label class="fl">'+(isAdmin?'Your Reply to User':'Your Message')+'</label>'
        + '<textarea class="fi" id="ticket-reply" rows="3" placeholder="Type your message..." style="resize:none"></textarea></div>'

        // Admin extras
        + (isAdmin ? '<div class="form-row">'
            + '<div class="fg" style="margin:0"><label class="fl">Change Status</label>'
            + '<select class="fi" id="ticket-status">'
            + '<option value="open"'+(ticket.status==='open'?' selected':'')+'>📬 Open</option>'
            + '<option value="answered"'+(ticket.status==='answered'?' selected':'')+'>💬 Answered</option>'
            + '<option value="resolved"'+(ticket.status==='resolved'?' selected':'')+'>✅ Resolved</option>'
            + '<option value="closed"'+(ticket.status==='closed'?' selected':'')+'>🔒 Closed</option>'
            + '</select></div>'
            + '<div class="fg" style="margin:0"><label class="fl">Priority</label>'
            + '<select class="fi" id="ticket-priority">'
            + '<option value="low"'+(ticket.priority==='low'?' selected':'')+'>🟢 Low</option>'
            + '<option value="normal"'+(ticket.priority==='normal'?' selected':'')+'>🟡 Normal</option>'
            + '<option value="high"'+(ticket.priority==='high'?' selected':'')+'>🔴 High</option>'
            + '</select></div>'
            + '</div>' : ''),
      footer: '<button class="btn-ghost" onclick="Modal.close()">Close</button>'
            + '<button class="btn-primary" style="flex:1" onclick="Support.sendReply(\''+ticketId+'\',\''+isAdmin+'\')">'
            + (isAdmin ? '📨 Send Reply' : '💬 Send Message')
            + '</button>',
    });
  },

  _buildMessages: function(ticketId) {
    var msgs = Support._getLocalMessages(ticketId);
    if (!msgs.length) return '<div style="text-align:center;font-size:12px;color:var(--t3);padding:12px">No messages yet</div>';
    return msgs.map(function(m){
      var isAdmin = m.sender_type === 'admin';
      return '<div style="margin-bottom:10px;display:flex;flex-direction:'+(isAdmin?'row-reverse':'row')+';align-items:flex-start;gap:8px">'
        + '<div style="min-width:32px;height:32px;border-radius:50%;background:'+(isAdmin?'var(--gb)':'var(--inb)')+';display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">'
        + (isAdmin?'🛡️':'👤')+'</div>'
        + '<div style="max-width:85%;background:'+(isAdmin?'var(--gb3)':'var(--bg3)')+';border:1px solid '+(isAdmin?'rgba(212,168,67,.2)':'var(--bd)')+';border-radius:12px;padding:10px 12px">'
        + '<div style="font-size:10px;font-weight:700;color:'+(isAdmin?'var(--g)':'var(--in)')+';margin-bottom:4px">'+Utils.esc(m.sender_name||'')+'</div>'
        + '<div style="font-size:13px;color:var(--t1);line-height:1.6">'+Utils.esc(m.message)+'</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:5px">'+Utils.date(m.created_at)+'</div>'
        + '</div></div>';
    }).join('');
  },

  sendReply: function(ticketId, isAdmin) {
    isAdmin = isAdmin === true || isAdmin === 'true';
    var replyEl = Utils.get('ticket-reply');
    var reply   = replyEl ? replyEl.value.trim() : '';
    if (!reply) { Toast.show('Type a message first','err'); return; }

    var user    = Auth.currentUser || {};
    var senderType = isAdmin ? 'admin' : 'user';
    var senderName = isAdmin ? ('Support Team') : (user.name||user.username||'User');

    var msg = {
      ticket_id:   ticketId,
      sender_type: senderType,
      sender_name: senderName,
      message:     reply,
      created_at:  new Date().toISOString(),
    };

    // Save locally
    var msgs = Support._getLocalMessages(ticketId);
    msgs.push(msg);
    var allMsgs = Utils.storage.get('support_messages') || {};
    allMsgs[ticketId] = msgs;
    Utils.storage.set('support_messages', allMsgs);

    // Sync message to Supabase
    var hdr = {
      'Content-Type':  'application/json',
      'apikey':         SUPABASE_ANON,
      'Authorization': 'Bearer '+SUPABASE_ANON,
    };
    fetch(SUPABASE_URL + '/rest/v1/support_messages', {
      method:  'POST',
      headers: hdr,
      body:    JSON.stringify(msg),
    }).catch(function(){});

    // Update ticket status if admin changed it
    if (isAdmin) {
      var newStatus   = (Utils.get('ticket-status')||{value:'answered'}).value;
      var newPriority = (Utils.get('ticket-priority')||{value:'normal'}).value;

      // Update locally
      var tickets = Utils.storage.get('support_tickets') || [];
      tickets.forEach(function(t){
        if (t.id===ticketId) { t.status=newStatus; t.priority=newPriority; t.updated_at=new Date().toISOString(); }
      });
      Utils.storage.set('support_tickets', tickets);

      // Sync update to Supabase
      fetch(SUPABASE_URL + '/rest/v1/support_tickets?id=eq.'+encodeURIComponent(ticketId), {
        method:  'PATCH',
        headers: hdr,
        body:    JSON.stringify({ status: newStatus, priority: newPriority, updated_at: new Date().toISOString() }),
      }).catch(function(){});
    }

    Toast.show('Message sent ✓','ok');
    Modal.close();
    Support.render();
  },

  /* ── FEEDBACK FORM ────────────────────────────────────────────*/
  _renderFeedbackForm: function(el) {
    var user = Auth.currentUser || {};
    var isAdmin = user.role === 'primary_admin' || user.role === 'admin';

    if (isAdmin) {
      // Admin sees all feedback ratings
      Support._renderFeedbackAdmin(el);
      return;
    }

    el.innerHTML = '<div class="sec"><div class="card card-body">'
      + '<div style="text-align:center;padding:10px 0 20px">'
      + '<div style="font-size:48px;margin-bottom:10px">⭐</div>'
      + '<div style="font-size:16px;font-weight:700;color:var(--t1)">How are we doing?</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-top:4px">Your feedback helps us improve SmartStock Pro</div>'
      + '</div>'
      // Star rating
      + '<div style="text-align:center;margin-bottom:20px">'
      + '<div style="font-size:11px;color:var(--t2);margin-bottom:10px">Tap to rate</div>'
      + '<div id="star-row" style="display:flex;justify-content:center;gap:8px">'
      + [1,2,3,4,5].map(function(n){
          return '<span id="star-'+n+'" onclick="Support.setStar('+n+')" '
            + 'style="font-size:36px;cursor:pointer;transition:transform .15s;opacity:.4">⭐</span>';
        }).join('')
      + '</div>'
      + '<div id="star-label" style="font-size:13px;color:var(--t2);margin-top:8px;min-height:20px"></div>'
      + '</div>'
      + '<div class="fg"><label class="fl">What can we improve?</label>'
      + '<textarea class="fi" id="fb-msg" rows="4" placeholder="Tell us what you love, what you hate, or what features you want..." style="resize:none;line-height:1.6"></textarea></div>'
      + '<button class="btn-primary btn-full" onclick="Support.submitFeedback()">⭐ Submit Feedback</button>'
      + '</div></div>';

    Support._selectedStars = 0;
  },

  _selectedStars: 0,

  setStar: function(n) {
    Support._selectedStars = n;
    var labels = {1:'😞 Poor',2:'😕 Below Average',3:'😊 Average',4:'😃 Good',5:'🤩 Excellent!'};
    for (var i=1; i<=5; i++) {
      var el = Utils.get('star-'+i);
      if (el) el.style.opacity = i<=n ? '1' : '0.3';
    }
    var lbl = Utils.get('star-label');
    if (lbl) lbl.textContent = labels[n]||'';
  },

  submitFeedback: function() {
    var user  = Auth.currentUser || {};
    var biz   = DB.getSettings();
    var stars = Support._selectedStars;
    var msg   = Utils.val('fb-msg').trim();
    if (!stars) { Toast.show('Please give a star rating','err'); return; }
    if (!msg)   { Toast.show('Please write a comment','err'); return; }

    var ticketId  = Utils.uid('TK');
    var ticketNum = 'FB-' + Date.now().toString(36).toUpperCase().slice(-6);

    var ticket = {
      id:            ticketId,
      ticket_number: ticketNum,
      business_id:   user.currentBusinessId || (user.businessIds&&user.businessIds[0]) || null,
      business_name: biz.bizName || '',
      user_id:       user.id || '',
      user_name:     user.name || user.username || '',
      user_email:    user.email || '',
      category:      '⭐ General Feedback',
      subject:       stars + ' star feedback',
      message:       msg,
      status:        'open',
      priority:      'low',
      rating:        stars,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    };

    // Save locally
    var tickets = Support._getLocalTickets();
    tickets.unshift(ticket);
    Utils.storage.set('support_tickets', tickets);

    // Sync to Supabase
    var hdr = {
      'Content-Type':  'application/json',
      'apikey':         SUPABASE_ANON,
      'Authorization': 'Bearer '+SUPABASE_ANON,
    };
    fetch(SUPABASE_URL + '/rest/v1/support_tickets', {
      method:  'POST',
      headers: hdr,
      body:    JSON.stringify(ticket),
    }).catch(function(){});

    Toast.show('Thank you for your feedback! ⭐'.repeat(stars), 'ok');
    Support.activeTab = 'my';
    Support.render();
  },

  _renderFeedbackAdmin: function(el) {
    var hdr = { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer '+SUPABASE_ANON };
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Loading feedback...</div>';
    fetch(SUPABASE_URL + '/rest/v1/support_tickets?category=eq.⭐ General Feedback&select=*&order=created_at.desc', { headers: hdr })
      .then(function(r){ return r.json(); })
      .then(function(feedbacks) {
        if (!feedbacks.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">⭐</div><div class="empty-title">No feedback yet</div></div>'; return; }
        var avg = feedbacks.filter(function(f){ return f.rating; }).reduce(function(a,f){ return a+f.rating; },0) / feedbacks.filter(function(f){ return f.rating; }).length;
        el.innerHTML = '<div class="sec">'
          + '<div style="text-align:center;background:var(--gb3);border:1px solid rgba(212,168,67,.2);border-radius:var(--r14);padding:20px;margin-bottom:14px">'
          + '<div style="font-size:42px;font-weight:900;color:var(--g)">'+avg.toFixed(1)+'</div>'
          + '<div style="font-size:18px;margin:4px 0">⭐⭐⭐⭐⭐</div>'
          + '<div style="font-size:12px;color:var(--t2)">Average from '+feedbacks.length+' reviews</div>'
          + '</div>'
          + '<div class="card">'
          + feedbacks.map(function(f){
              var stars = '⭐'.repeat(f.rating||0);
              return '<div class="list-item">'
                + '<div class="list-icon" style="background:var(--gb);font-size:18px">⭐</div>'
                + '<div class="list-info">'
                + '<div class="list-name">'+stars+'</div>'
                + '<div class="list-meta" style="font-size:12px;color:var(--t1);margin-top:4px">'+Utils.esc(f.message||'')+'</div>'
                + '<div class="list-meta" style="font-size:10px;color:var(--t3);margin-top:3px">'+Utils.esc(f.user_name||'')+' · '+Utils.esc(f.business_name||'')+' · '+Utils.date(f.created_at)+'</div>'
                + '</div>'
                + '<button class="btn-ghost btn-sm btn-icon" onclick="Support.openTicket(\''+f.id+'\',true)" style="flex-shrink:0">💬</button>'
                + '</div>';
            }).join('')
          + '</div></div>';
        Utils.storage.set('support_tickets_admin', feedbacks);
      }).catch(function(){ el.innerHTML='<div style="padding:20px;color:var(--er)">Error loading feedback</div>'; });
  },

  /* ── HELPERS ──────────────────────────────────────────────────*/
  _getLocalTickets: function() {
    return Utils.storage.get('support_tickets') || [];
  },
  _getLocalMessages: function(ticketId) {
    var all = Utils.storage.get('support_messages') || {};
    return all[ticketId] || [];
  },
};
