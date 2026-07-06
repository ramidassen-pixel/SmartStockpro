/* === usermgmt.js === */
/* SmartStock Pro V5 — User & Role Management Module */
var UserMgmt = {
  activeTab: 'users',

  render: function() {
    var pg = Utils.get('pg-usermgmt');
    if (!pg) return;
    if (!Perms.can('manage_users') && !Perms.can('manage_roles')) {
      pg.innerHTML = '<div class="empty" style="padding:60px 20px"><div class="empty-icon">🔒</div><div class="empty-title">Access Restricted</div><div class="empty-sub">You do not have permission to manage users.</div></div>';
      return;
    }

    var tabs = [
      ['users',     '👥 Users'],
      ['businesses','🏢 Businesses'],
      ['branches',  '🏪 Branches'],
      ['roles',     '🛡️ Roles'],
      ['audit',     '📋 Audit Log'],
      ['activity',  '📈 Activity'],
    ];

    var user = Auth.currentUser || {};
    var isPrimary = user.role === 'primary_admin';

    pg.innerHTML = '<div class="page-header">'
      + '<div><div class="page-title">Team & Access</div><div class="page-sub">Roles, permissions & activity</div></div>'
      + (Perms.can('manage_users') ? '<div class="page-actions"><button class="btn-ghost btn-sm" onclick="UserMgmt.showAddUserInfo()">＋ Add User</button></div>' : '')
      + '</div>'
      + '<div class="chips">' + tabs.map(function(t){
          return '<div class="chip' + (UserMgmt.activeTab===t[0]?' active':'') + '" onclick="UserMgmt.setTab(\'' + t[0] + '\')">' + t[1] + '</div>';
        }).join('') + '</div>'
      + '<div id="um-body"></div>';

    UserMgmt._renderTab();
  },

  setTab: function(t) { UserMgmt.activeTab = t; UserMgmt.render(); },

  _renderTab: function() {
    var el = Utils.get('um-body');
    if (!el) return;
    var t = UserMgmt.activeTab;
    if (t === 'users')      UserMgmt._renderUsers(el);
    else if (t === 'businesses') UserMgmt._renderBusinesses(el);
    else if (t === 'branches')   UserMgmt._renderBranches(el);
    else if (t === 'roles')      UserMgmt._renderRoles(el);
    else if (t === 'audit')      UserMgmt._renderAudit(el);
    else if (t === 'activity')   UserMgmt._renderActivity(el);
  },

  /* ── USERS TAB — reads live from Supabase (platform_users), so the
     same staff list and pending approvals show identically on every
     device, not just the one that originally registered them. ──── */
  _renderUsers: function(el) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">Loading team...</div>';
    var current = Auth.currentUser || {};
    var token = (Auth._session && Auth._session.access_token) || SUPABASE_ANON;

    fetch(SUPABASE_URL + '/rest/v1/platform_users?select=*&order=registered_at', {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + token },
    })
    .then(function(r){ return r.json(); })
    .then(function(rows) {
      var allUsers = Array.isArray(rows) ? rows : [];
      // A non-admin's session only has RLS access to their own row;
      // an admin reading via admin-data would see the whole business —
      // for now this self-scoped read is enough to show "my own status"
      // for staff, and the full team for whoever the RLS allows.
      var users = allUsers.filter(function(u){ return u.business_id === current.currentBusinessId; });
      var pending = users.filter(function(u){ return u.status === 'pending'; });

      var pendingHtml = '';
      if (pending.length && current.role === 'primary_admin') {
        var roleOpts = Object.keys(ROLE_PRESETS).filter(function(k){ return k !== 'primary_admin'; }).map(function(k){
          return '<option value="' + k + '">' + ROLE_PRESETS[k].icon + ' ' + ROLE_PRESETS[k].label + '</option>';
        }).join('');
        pendingHtml = '<div style="background:rgba(255,173,31,.06);border:1px solid var(--wabd);border-radius:var(--r14);padding:14px;margin:0 14px 14px">'
          + '<div style="font-size:11px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">⏳ Pending Approvals (' + pending.length + ')</div>'
          + pending.map(function(u) {
              return '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r10);padding:12px;margin-bottom:8px">'
                + '<div style="display:flex;align-items:flex-start;gap:10px">'
                + '<div style="flex:1">'
                + '<div style="font-size:13px;font-weight:700;color:var(--t1)">' + Utils.esc(u.name) + '</div>'
                + '<div style="font-size:11px;color:var(--t2);margin-top:2px">' + Utils.esc(u.email) + '</div>'
                + '<div style="font-size:10px;color:var(--t3);margin-top:2px">📱 ' + Utils.esc(u.phone||'No phone') + ' · Requested: ' + Utils.date(u.registered_at) + '</div>'
                + '</div></div>'
                + '<div style="margin-top:10px;display:flex;gap:7px;align-items:center">'
                + '<select id="apr-role-' + u.id + '" style="flex:1;background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:6px;font-size:12px;color:var(--t1)">' + roleOpts + '</select>'
                + '<button class="btn-ok btn-sm" data-uid="' + u.id + '" onclick="UserMgmt.approveUser(this.dataset.uid)">✓ Approve</button>'
                + '<button class="btn-danger btn-sm" data-uid="' + u.id + '" onclick="UserMgmt.rejectUser(this.dataset.uid)">✕ Reject</button>'
                + '</div></div>';
            }).join('')
          + '</div>';
      }

      var rows2 = users.filter(function(u){ return u.status !== 'pending'; }).map(function(u) {
        var isSelf  = u.id === current.id;
        var info    = Perms.getRoleInfo(u.role);
        var stats   = (typeof Activity !== 'undefined') ? Activity.getStats(u.id) : { lastLogin:null, totalSales:0 };
        var lastLogin = u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : (stats.lastLogin ? new Date(stats.lastLogin).toLocaleDateString() : 'Never');

        return '<div class="list-item">'
          + '<div class="list-icon" style="background:' + info.bg + ';font-size:20px">' + info.icon + '</div>'
          + '<div class="list-info">'
          + '<div class="list-name">' + Utils.esc(u.name || u.email) + (isSelf ? ' <span style="font-size:9px;background:var(--gb);color:var(--g);padding:2px 6px;border-radius:99px;font-weight:700">YOU</span>' : '') + '</div>'
          + '<div class="list-meta">' + Utils.esc(u.email) + ' · ' + Perms.roleBadge(u.role) + '</div>'
          + '<div class="list-meta" style="font-size:10px;color:var(--t3)">Last login: ' + lastLogin + ' · Sales: ' + (stats.totalSales||0) + '</div>'
          + '</div>'
          + '<div class="list-right">'
          + '<span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;background:' + (u.status==='active'?'var(--okb)':'var(--erb)') + ';color:' + (u.status==='active'?'var(--ok)':'var(--er)') + '">' + (u.status||'active').toUpperCase() + '</span>'
          + '<div class="list-actions">'
          + (!isSelf && Perms.can('manage_roles') && current.role === 'primary_admin' ? '<button class="btn-ghost btn-sm" onclick="UserMgmt.openPromote(\'' + u.id + '\')">⬆️ Role</button>' : '')
          + '</div></div></div>';
      }).join('');

      el.innerHTML = pendingHtml + '<div class="sec"><div class="card">' + (rows2 || '<div class="empty" style="padding:30px"><div class="empty-icon">👥</div><div class="empty-title">No users yet</div></div>') + '</div></div>'
        + '<div class="sec" style="text-align:center;padding:0 14px"><div style="font-size:11px;color:var(--t3);line-height:1.6">New staff join from the <strong>Sign In screen → Join Business</strong> tab — they\'ll appear here once they request access.</div></div>';
    })
    .catch(function(err) {
      el.innerHTML = '<div style="padding:20px;color:var(--er)">Could not load team: ' + err.message + '</div>';
    });
  },

  approveUser: function(userId) {
    var roleEl = Utils.get('apr-role-' + userId);
    var role   = roleEl ? roleEl.value : null;
    Auth.approveUser(userId, role);
    setTimeout(function(){ UserMgmt._renderTab(); }, 600);
  },

  rejectUser: function(userId) {
    Auth.rejectUser(userId);
    setTimeout(function(){ UserMgmt._renderTab(); }, 600);
  },

  showAddUserInfo: function() {
    Modal.open({
      title: '＋ Adding Staff', barColor: 'var(--in)',
      body: '<div style="text-align:center;padding:10px 0">'
        + '<div style="font-size:42px;margin-bottom:14px">📲</div>'
        + '<div style="font-size:13px;color:var(--t2);line-height:1.8">To add a new staff member, have them open SmartStock Pro on their own phone and use the <strong style="color:var(--g)">Join Business</strong> tab on the sign-in screen with your exact business name.</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:14px;line-height:1.7">Their request will appear right here under <strong>Pending Approvals</strong> for you to approve.</div>'
        + '</div>',
      footer: '<button class="btn-primary btn-full" onclick="Modal.close()">Got it</button>',
    });
  },

  openAddUser: function() {
    if (!Perms.can('manage_users')) { Toast.show('No permission', 'err'); return; }
    var businesses = DB.get('businesses') || [];
    var bizOpts = businesses.map(function(b){ return '<option value="' + b.id + '">' + Utils.esc(b.name) + '</option>'; }).join('');
    var roleOpts = Object.keys(ROLE_PRESETS).map(function(k){
      return '<option value="' + k + '">' + ROLE_PRESETS[k].icon + ' ' + ROLE_PRESETS[k].label + '</option>';
    }).join('');

    Modal.open({
      title: 'Add New User', barColor: 'var(--g)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Full Name *</label><input class="fi" id="nu-name" placeholder="John Smith"></div>'
          + '<div class="fg"><label class="fl">Username *</label><input class="fi" id="nu-user" placeholder="john_smith"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Password *</label><input class="fi" id="nu-pass" type="password" placeholder="Min 6 chars"></div>'
          + '<div class="fg"><label class="fl">Role *</label><select class="fi" id="nu-role">' + roleOpts + '</select></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Assign to Business</label>'
          + '<select class="fi" id="nu-biz" multiple style="height:80px">' + bizOpts + '</select>'
          + '<div style="font-size:10px;color:var(--t3);margin-top:4px">Hold Ctrl/tap to select multiple</div></div>'
          + '<div class="fg"><label class="fl">Email</label><input class="fi" id="nu-email" type="email" placeholder="user@email.com"></div>'
          + '<div class="fg"><label class="fl">Phone</label><input class="fi" id="nu-phone" type="tel" placeholder="+231 77 000 000"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="UserMgmt.saveNewUser()">✓ Create User</button>',
    });
  },

  saveNewUser: function() {
    var name  = Utils.val('nu-name').trim();
    var uname = Utils.val('nu-user').trim();
    var pw    = Utils.val('nu-pass');
    var role  = (Utils.get('nu-role')||{value:'sales_employee'}).value;
    if (!name || !uname) { Toast.show('Name and username required', 'err'); return; }
    if (pw.length < 6)   { Toast.show('Password min 6 characters', 'err'); return; }
    var users = DB.get('users') || [];
    if (users.find(function(u){ return u.username.toLowerCase() === uname.toLowerCase(); })) {
      Toast.show('Username already taken', 'err'); return;
    }
    // Get selected businesses
    var bizSel = Utils.get('nu-biz');
    var bizIds = bizSel ? Array.from(bizSel.selectedOptions).map(function(o){ return o.value; }) : [];
    var user = {
      id:          Utils.uid('U'),
      username:    uname,
      name:        name,
      email:       Utils.val('nu-email'),
      phone:       Utils.val('nu-phone'),
      role:        role,
      businessIds: bizIds,
      permissions: {},
      status:      'active',
      createdAt:   Utils.today(),
      createdBy:   (Auth.currentUser||{}).id,
      password:    pw,
    };
    users.push(user);
    DB.set('users', users);
    AuditLog.record('CREATE_USER', 'Created user: ' + uname + ' with role: ' + role);
    Toast.show('User "' + uname + '" created ✓', 'ok');
    Modal.close();
    UserMgmt.render();
  },

  openEditUser: function(id) {
    var users  = DB.get('users') || [];
    var u      = users.find(function(x){ return x.id === id; });
    if (!u) return;
    var roleOpts = Object.keys(ROLE_PRESETS).map(function(k){
      return '<option value="' + k + '"' + (u.role===k?' selected':'') + '>' + ROLE_PRESETS[k].icon + ' ' + ROLE_PRESETS[k].label + '</option>';
    }).join('');
    Modal.open({
      title: 'Edit User: ' + Utils.esc(u.username), barColor: 'var(--in)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Full Name</label><input class="fi" id="eu-name" value="' + Utils.esc(u.name||'') + '"></div>'
          + '<div class="fg"><label class="fl">Role</label><select class="fi" id="eu-role">' + roleOpts + '</select></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Email</label><input class="fi" id="eu-email" value="' + Utils.esc(u.email||'') + '"></div>'
          + '<div class="fg"><label class="fl">Phone</label><input class="fi" id="eu-phone" value="' + Utils.esc(u.phone||'') + '"></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Status</label><select class="fi" id="eu-status"><option value="active"' + (u.status==='active'?' selected':'') + '>Active</option><option value="suspended"' + (u.status==='suspended'?' selected':'') + '>Suspended</option></select></div>'
          + '<div class="fg"><label class="fl">New Password (leave blank to keep)</label><input class="fi" id="eu-pass" type="password" placeholder="Leave blank to keep current"></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-danger btn-sm" onclick="UserMgmt.suspendUser(\'' + id + '\')">Suspend</button>'
            + '<button class="btn-primary" style="flex:1" onclick="UserMgmt.saveEditUser(\'' + id + '\')">💾 Save</button>',
    });
  },

  saveEditUser: function(id) {
    var users = DB.get('users') || [];
    var idx   = users.findIndex(function(x){ return x.id === id; });
    if (idx < 0) return;
    var newPw = Utils.val('eu-pass');
    var old   = users[idx];
    users[idx] = Object.assign({}, old, {
      name:   Utils.val('eu-name') || old.name,
      role:   (Utils.get('eu-role')||{value:old.role}).value,
      email:  Utils.val('eu-email'),
      phone:  Utils.val('eu-phone'),
      status: (Utils.get('eu-status')||{value:'active'}).value,
      password: newPw && newPw.length >= 6 ? newPw : old.password,
    });
    DB.set('users', users);
    AuditLog.record('EDIT_USER', 'Edited user: ' + old.username);
    Toast.show('User updated ✓', 'ok');
    Modal.close();
    UserMgmt.render();
  },

  suspendUser: function(id) {
    var users = DB.get('users') || [];
    var idx   = users.findIndex(function(x){ return x.id === id; });
    if (idx < 0) return;
    users[idx].status = 'suspended';
    DB.set('users', users);
    AuditLog.record('SUSPEND_USER', 'Suspended user: ' + users[idx].username);
    Toast.show('User suspended', 'warn');
    Modal.close();
    UserMgmt.render();
  },

  openPromote: function(id) {
    var users  = DB.get('users') || [];
    var u      = users.find(function(x){ return x.id === id; });
    if (!u) return;
    var current = Auth.currentUser || {};
    var roleOpts = Object.keys(ROLE_PRESETS).map(function(k){
      return '<option value="' + k + '"' + (u.role===k?' selected':'') + '>' + ROLE_PRESETS[k].icon + ' ' + ROLE_PRESETS[k].label + '</option>';
    }).join('');
    Modal.open({
      title: 'Change Role', sub: Utils.esc(u.username) + ' · current: ' + Perms.getRoleInfo(u.role).label, barColor: 'var(--wa)',
      body: '<div class="fg"><label class="fl">New Role</label><select class="fi" id="pr-role">' + roleOpts + '</select></div>'
          + '<div style="background:var(--wab);border:1px solid var(--wabd);border-radius:var(--r10);padding:12px;font-size:12px;color:var(--wa);margin-top:8px">'
          + '⚠️ Role changes are permanently logged in the audit trail.</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="UserMgmt.saveRole(\'' + id + '\')">✓ Change Role</button>',
    });
  },

  saveRole: function(id) {
    var users   = DB.get('users') || [];
    var idx     = users.findIndex(function(x){ return x.id === id; });
    if (idx < 0) return;
    var newRole = (Utils.get('pr-role')||{value:''}).value;
    var oldRole = users[idx].role;
    if (!newRole || newRole === oldRole) { Modal.close(); return; }
    users[idx].role = newRole;
    DB.set('users', users);
    AuditLog.record('ROLE_CHANGE', 'Changed ' + users[idx].username + ' from ' + oldRole + ' to ' + newRole);
    Toast.show('Role updated to ' + Perms.getRoleInfo(newRole).label + ' ✓', 'ok');
    Modal.close();
    UserMgmt.render();
  },

  /* ── BUSINESSES TAB ─────────────────────────────────────── */
  _renderBusinesses: function(el) {
    var businesses = DB.get('businesses') || [];
    var canManage  = Perms.can('manage_businesses');

    var rows = businesses.map(function(b) {
      var branchCount = (DB.get('branches') || []).filter(function(br){ return br.businessId === b.id; }).length;
      return '<div class="list-item">'
        + '<div class="list-icon" style="background:var(--gb)">'
        + (b.logo ? '<img src="' + b.logo + '" style="width:36px;height:36px;border-radius:8px;object-fit:cover">' : '🏢')
        + '</div>'
        + '<div class="list-info">'
        + '<div class="list-name">' + Utils.esc(b.name) + '</div>'
        + '<div class="list-meta">' + (b.address||'No address') + '</div>'
        + '<div class="list-meta" style="font-size:10px;color:var(--t3)">' + branchCount + ' branch' + (branchCount!==1?'es':'') + ' · ' + (b.currency||'$') + ' · ' + (b.phone||'') + '</div>'
        + '</div>'
        + '<div class="list-right">'
        + '<button class="btn-ghost btn-sm" onclick="BusinessMgr.switchTo(\'' + b.id + '\')">Switch</button>'
        + (canManage ? '<button class="btn-ghost btn-sm btn-icon" onclick="UserMgmt.openEditBusiness(\'' + b.id + '\')">✏️</button>' : '')
        + '</div></div>';
    }).join('');

    el.innerHTML = '<div class="sec">'
      + (canManage ? '<div style="padding:0 14px 10px"><button class="btn-primary btn-sm" onclick="UserMgmt.openAddBusiness()">＋ Add Business</button></div>' : '')
      + (businesses.length ? '<div class="card">' + rows + '</div>' : '<div class="empty"><div class="empty-icon">🏢</div><div class="empty-title">No businesses yet</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="UserMgmt.openAddBusiness()">＋ Add Business</button></div></div>')
      + '</div>';
  },

  openAddBusiness: function() {
    if (!Perms.can('manage_businesses')) { Toast.show('No permission', 'err'); return; }
    var currencies = ['$','L$','€','£','₦','₵'];
    Modal.open({
      title: '+ Add Business', barColor: 'var(--g)',
      body: '<div class="form-row">'
          + '<div class="fg"><label class="fl">Business Name *</label><input class="fi" id="nb-name" placeholder="e.g. Rock Stone Main"></div>'
          + '<div class="fg"><label class="fl">Currency</label><select class="fi" id="nb-cur">' + currencies.map(function(c){ return '<option value="' + c + '">' + c + '</option>'; }).join('') + '</select></div>'
          + '</div>'
          + '<div class="fg"><label class="fl">Address</label><input class="fi" id="nb-addr" placeholder="Street, City, Country"></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Phone</label><input class="fi" id="nb-phone" type="tel" placeholder="+231 77 000 000"></div>'
          + '<div class="fg"><label class="fl">Email</label><input class="fi" id="nb-email" type="email" placeholder="info@business.com"></div>'
          + '</div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Tax Number</label><input class="fi" id="nb-tax" placeholder="Optional"></div>'
          + '<div class="fg"><label class="fl">Timezone</label><select class="fi" id="nb-tz"><option value="Africa/Monrovia">Africa/Monrovia (GMT+0)</option><option value="Africa/Lagos">Africa/Lagos (GMT+1)</option><option value="America/New_York">New York (GMT-5)</option><option value="Europe/London">London (GMT+0)</option><option value="Asia/Dubai">Dubai (GMT+4)</option></select></div>'
          + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="UserMgmt.saveNewBusiness()">💾 Save Business</button>',
    });
  },

  saveNewBusiness: function() {
    var name = Utils.val('nb-name').trim();
    if (!name) { Toast.show('Business name required', 'err'); return; }
    var biz = {
      id:        Utils.uid('BIZ'),
      name:      name,
      address:   Utils.val('nb-addr'),
      phone:     Utils.val('nb-phone'),
      email:     Utils.val('nb-email'),
      taxNo:     Utils.val('nb-tax'),
      currency:  (Utils.get('nb-cur')||{value:'$'}).value,
      timezone:  (Utils.get('nb-tz')||{value:'Africa/Monrovia'}).value,
      logo:      '',
      ownerId:   (Auth.currentUser||{}).id,
      createdAt: Utils.today(),
    };
    var bizes = DB.get('businesses') || [];
    bizes.push(biz);
    DB.set('businesses', bizes);
    // Assign to current user
    var user = Auth.currentUser;
    if (user) {
      var users = DB.get('users') || [];
      var idx = users.findIndex(function(u){ return u.id === user.id; });
      if (idx >= 0) {
        users[idx].businessIds = users[idx].businessIds || [];
        users[idx].businessIds.push(biz.id);
        DB.set('users', users);
      }
    }
    AuditLog.record('CREATE_BUSINESS', 'Created business: ' + name);
    Toast.show('Business "' + name + '" created ✓', 'ok');
    Modal.close();
    UserMgmt.render();
  },

  openEditBusiness: function(id) {
    var bizes = DB.get('businesses') || [];
    var b = bizes.find(function(x){ return x.id === id; });
    if (!b) return;
    var currencies = ['$','L$','€','£','₦','₵'];
    Modal.open({
      title: 'Edit Business', sub: Utils.esc(b.name), barColor: 'var(--in)',
      body: '<div class="fg"><label class="fl">Business Name</label><input class="fi" id="eb-name" value="' + Utils.esc(b.name) + '"></div>'
          + '<div class="fg"><label class="fl">Address</label><input class="fi" id="eb-addr" value="' + Utils.esc(b.address||'') + '"></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Phone</label><input class="fi" id="eb-phone" value="' + Utils.esc(b.phone||'') + '"></div>'
          + '<div class="fg"><label class="fl">Currency</label><select class="fi" id="eb-cur">' + currencies.map(function(c){ return '<option value="' + c + '"' + (b.currency===c?' selected':'') + '>' + c + '</option>'; }).join('') + '</select></div>'
          + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="UserMgmt.saveEditBusiness(\'' + id + '\')">💾 Save</button>',
    });
  },

  saveEditBusiness: function(id) {
    var bizes = DB.get('businesses') || [];
    var idx = bizes.findIndex(function(x){ return x.id === id; });
    if (idx < 0) return;
    bizes[idx] = Object.assign({}, bizes[idx], {
      name:     Utils.val('eb-name') || bizes[idx].name,
      address:  Utils.val('eb-addr'),
      phone:    Utils.val('eb-phone'),
      currency: (Utils.get('eb-cur')||{value:'$'}).value,
    });
    DB.set('businesses', bizes);
    AuditLog.record('EDIT_BUSINESS', 'Edited business: ' + bizes[idx].name);
    Toast.show('Business updated ✓', 'ok');
    Modal.close();
    UserMgmt.render();
  },

  /* ── BRANCHES TAB ───────────────────────────────────────── */
  _renderBranches: function(el) {
    var branches   = DB.get('branches') || [];
    var businesses = DB.get('businesses') || [];
    var users      = DB.get('users') || [];
    var canManage  = Perms.can('manage_branches');

    var bizOpts = businesses.map(function(b){ return '<option value="' + b.id + '">' + Utils.esc(b.name) + '</option>'; }).join('');

    var rows = branches.map(function(br) {
      var biz = businesses.find(function(b){ return b.id === br.businessId; });
      var mgr = users.find(function(u){ return u.id === br.managerId; });
      return '<div class="list-item">'
        + '<div class="list-icon" style="background:var(--wab)">🏪</div>'
        + '<div class="list-info">'
        + '<div class="list-name">' + Utils.esc(br.name) + '</div>'
        + '<div class="list-meta">' + (biz ? Utils.esc(biz.name) : '') + ' · ' + (br.location||'No location') + '</div>'
        + '<div class="list-meta" style="font-size:10px;color:var(--t3)">Manager: ' + (mgr ? Utils.esc(mgr.name||mgr.username) : 'Unassigned') + '</div>'
        + '</div>'
        + (canManage ? '<div class="list-right"><button class="btn-ghost btn-sm btn-icon" onclick="UserMgmt.openEditBranch(\'' + br.id + '\')">✏️</button></div>' : '')
        + '</div>';
    }).join('');

    el.innerHTML = '<div class="sec">'
      + (canManage ? '<div style="padding:0 14px 10px"><button class="btn-primary btn-sm" onclick="UserMgmt.openAddBranch()">＋ Add Branch</button></div>' : '')
      + (branches.length ? '<div class="card">' + rows + '</div>'
        : '<div class="empty"><div class="empty-icon">🏪</div><div class="empty-title">No branches yet</div><div class="empty-action"><button class="btn-primary btn-sm" onclick="UserMgmt.openAddBranch()">＋ Add Branch</button></div></div>')
      + '</div>';
  },

  openAddBranch: function() {
    if (!Perms.can('manage_branches')) { Toast.show('No permission', 'err'); return; }
    var bizes = DB.get('businesses') || [];
    var users = DB.get('users') || [];
    var bizOpts = bizes.map(function(b){ return '<option value="' + b.id + '">' + Utils.esc(b.name) + '</option>'; }).join('');
    var mgrOpts = '<option value="">— None —</option>' + users.map(function(u){ return '<option value="' + u.id + '">' + Utils.esc(u.name||u.username) + '</option>'; }).join('');
    Modal.open({
      title: '+ Add Branch', barColor: 'var(--wa)',
      body: '<div class="fg"><label class="fl">Branch Name *</label><input class="fi" id="nbr-name" placeholder="e.g. Sinkor Branch"></div>'
          + '<div class="fg"><label class="fl">Business *</label><select class="fi" id="nbr-biz">' + bizOpts + '</select></div>'
          + '<div class="fg"><label class="fl">Location / Address</label><input class="fi" id="nbr-loc" placeholder="Street, City"></div>'
          + '<div class="form-row">'
          + '<div class="fg"><label class="fl">Branch Manager</label><select class="fi" id="nbr-mgr">' + mgrOpts + '</select></div>'
          + '<div class="fg"><label class="fl">Phone</label><input class="fi" id="nbr-phone" type="tel"></div>'
          + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="UserMgmt.saveNewBranch()">💾 Save Branch</button>',
    });
  },

  saveNewBranch: function() {
    var name  = Utils.val('nbr-name').trim();
    var bizId = (Utils.get('nbr-biz')||{value:''}).value;
    if (!name || !bizId) { Toast.show('Branch name and business required', 'err'); return; }
    var branch = {
      id:         Utils.uid('BR'),
      name:       name,
      businessId: bizId,
      location:   Utils.val('nbr-loc'),
      managerId:  (Utils.get('nbr-mgr')||{value:''}).value || null,
      phone:      Utils.val('nbr-phone'),
      createdAt:  Utils.today(),
    };
    var branches = DB.get('branches') || [];
    branches.push(branch);
    DB.set('branches', branches);
    AuditLog.record('CREATE_BRANCH', 'Created branch: ' + name);
    Toast.show('Branch "' + name + '" created ✓', 'ok');
    Modal.close();
    UserMgmt.render();
  },

  openEditBranch: function(id) {
    var branches = DB.get('branches') || [];
    var br = branches.find(function(x){ return x.id === id; }); if (!br) return;
    var users = DB.get('users') || [];
    var mgrOpts = '<option value="">— None —</option>' + users.map(function(u){ return '<option value="' + u.id + '"' + (br.managerId===u.id?' selected':'') + '>' + Utils.esc(u.name||u.username) + '</option>'; }).join('');
    Modal.open({
      title: 'Edit Branch', sub: Utils.esc(br.name), barColor: 'var(--in)',
      body: '<div class="fg"><label class="fl">Branch Name</label><input class="fi" id="ebr-name" value="' + Utils.esc(br.name) + '"></div>'
          + '<div class="fg"><label class="fl">Location</label><input class="fi" id="ebr-loc" value="' + Utils.esc(br.location||'') + '"></div>'
          + '<div class="fg"><label class="fl">Branch Manager</label><select class="fi" id="ebr-mgr">' + mgrOpts + '</select></div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="UserMgmt.saveEditBranch(\'' + id + '\')">💾 Save</button>',
    });
  },

  saveEditBranch: function(id) {
    var branches = DB.get('branches') || [];
    var idx = branches.findIndex(function(x){ return x.id === id; }); if (idx<0) return;
    branches[idx] = Object.assign({}, branches[idx], {
      name:      Utils.val('ebr-name') || branches[idx].name,
      location:  Utils.val('ebr-loc'),
      managerId: (Utils.get('ebr-mgr')||{value:''}).value || null,
    });
    DB.set('branches', branches);
    AuditLog.record('EDIT_BRANCH', 'Edited branch: ' + branches[idx].name);
    Toast.show('Branch updated ✓', 'ok');
    Modal.close();
    UserMgmt.render();
  },

  /* ── ROLES TAB ──────────────────────────────────────────── */
  _renderRoles: function(el) {
    var canManage = Perms.can('manage_roles');
    var roleCards = Object.keys(ROLE_PRESETS).map(function(key) {
      var r    = ROLE_PRESETS[key];
      var pCount = Object.values(r.permissions).filter(Boolean).length;
      return '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r14);padding:14px;margin-bottom:10px">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<div style="width:40px;height:40px;border-radius:var(--r10);background:' + r.bg + ';display:flex;align-items:center;justify-content:center;font-size:18px">' + r.icon + '</div>'
        + '<div><div style="font-size:14px;font-weight:700;color:var(--t1)">' + r.label + '</div>'
        + '<div style="font-size:11px;color:var(--t2)">' + pCount + ' permissions</div></div>'
        + '<button class="btn-ghost btn-sm" style="margin-left:auto" onclick="UserMgmt.viewRole(\'' + key + '\')">View Permissions</button>'
        + '</div></div>';
    }).join('');

    // Custom roles
    var customRoles = DB.get('customRoles') || [];
    var customCards = customRoles.map(function(r) {
      var pCount = Object.values(r.permissions||{}).filter(Boolean).length;
      return '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r14);padding:14px;margin-bottom:10px">'
        + '<div style="display:flex;align-items:center;gap:10px">'
        + '<div style="width:40px;height:40px;border-radius:var(--r10);background:var(--pub);display:flex;align-items:center;justify-content:center;font-size:18px">⚙️</div>'
        + '<div><div style="font-size:14px;font-weight:700;color:var(--t1)">' + Utils.esc(r.name) + ' <span style="font-size:9px;background:var(--pub);color:var(--pu);padding:2px 6px;border-radius:99px">CUSTOM</span></div>'
        + '<div style="font-size:11px;color:var(--t2)">' + pCount + ' permissions</div></div>'
        + (canManage ? '<button class="btn-ghost btn-sm btn-icon" style="margin-left:auto" onclick="UserMgmt.editCustomRole(\'' + r.id + '\')">✏️</button>' : '')
        + '</div></div>';
    }).join('');

    el.innerHTML = '<div class="sec">'
      + (canManage ? '<div style="padding:0 14px 10px"><button class="btn-primary btn-sm" onclick="UserMgmt.openCustomRole()">⚙️ Create Custom Role</button></div>' : '')
      + '<div class="sec-title">System Roles</div>'
      + roleCards
      + (customRoles.length ? '<div class="sec-title" style="margin-top:8px">Custom Roles</div>' + customCards : '')
      + '</div>';
  },

  viewRole: function(roleKey) {
    var r = ROLE_PRESETS[roleKey]; if (!r) return;
    var permsHtml = Object.keys(PERMISSIONS).map(function(k) {
      var has = !!r.permissions[k];
      return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bd)">'
        + '<span style="font-size:18px">' + (has ? '✅' : '❌') + '</span>'
        + '<span style="font-size:13px;color:' + (has?'var(--t1)':'var(--t3)') + '">' + PERMISSIONS[k] + '</span>'
        + '</div>';
    }).join('');
    Modal.open({
      title: r.icon + ' ' + r.label, sub: 'Permission details', barColor: r.color,
      body: '<div class="card card-body">' + permsHtml + '</div>',
      footer: '<button class="btn-primary btn-full" onclick="Modal.close()">Close</button>',
    });
  },

  openCustomRole: function() {
    var permsHtml = Object.keys(PERMISSIONS).map(function(k) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)">'
        + '<input type="checkbox" id="cr-' + k + '" style="width:18px;height:18px;cursor:pointer">'
        + '<label for="cr-' + k + '" style="font-size:13px;color:var(--t1);cursor:pointer;flex:1">' + PERMISSIONS[k] + '</label>'
        + '</div>';
    }).join('');
    Modal.open({
      title: 'Create Custom Role', barColor: 'var(--pu)',
      body: '<div class="fg"><label class="fl">Role Name *</label><input class="fi" id="cr-name" placeholder="e.g. Procurement Officer"></div>'
          + '<div class="sec-title" style="padding:12px 0 6px">Select Permissions</div>'
          + '<div class="card card-body">' + permsHtml + '</div>',
      footer: '<button class="btn-ghost" onclick="Modal.close()">Cancel</button>'
            + '<button class="btn-primary" style="flex:1" onclick="UserMgmt.saveCustomRole()">💾 Create Role</button>',
    });
  },

  saveCustomRole: function() {
    var name = Utils.val('cr-name').trim();
    if (!name) { Toast.show('Role name required', 'err'); return; }
    var perms = {};
    Object.keys(PERMISSIONS).forEach(function(k) {
      var cb = Utils.get('cr-' + k);
      perms[k] = cb ? cb.checked : false;
    });
    var role = { id: Utils.uid('ROLE'), name: name, permissions: perms, isCustom: true, createdAt: Utils.today() };
    var customs = DB.get('customRoles') || [];
    customs.push(role);
    DB.set('customRoles', customs);
    AuditLog.record('CREATE_ROLE', 'Created custom role: ' + name);
    Toast.show('Role "' + name + '" created ✓', 'ok');
    Modal.close();
    UserMgmt.render();
  },

  /* ── AUDIT LOG TAB ──────────────────────────────────────── */
  _renderAudit: function(el) {
    if (!Perms.can('view_audit_logs')) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🔒</div><div class="empty-title">Restricted</div></div>';
      return;
    }
    var logs = AuditLog.get();
    var rows = logs.slice(0,100).map(function(l) {
      var d    = new Date(l.timestamp);
      var time = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      var info = Perms.getRoleInfo(l.role);
      return '<div style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:flex-start;padding:10px 14px;border-bottom:1px solid var(--bd)">'
        + '<div style="font-size:18px">' + info.icon + '</div>'
        + '<div><div style="font-size:12px;font-weight:700;color:var(--t1)">' + Utils.esc(l.userName) + ' · <span style="font-weight:500;color:var(--in)">' + l.action + '</span></div>'
        + (l.detail ? '<div style="font-size:11px;color:var(--t2);margin-top:2px">' + Utils.esc(l.detail) + '</div>' : '')
        + '</div>'
        + '<div style="font-size:10px;color:var(--t3);white-space:nowrap;text-align:right">' + time + '</div>'
        + '</div>';
    }).join('');

    el.innerHTML = '<div class="sec">'
      + '<div style="padding:0 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      + '<div style="font-size:12px;color:var(--t2)">' + logs.length + ' total events</div>'
      + '<button class="btn-ghost btn-sm" onclick="UserMgmt._exportAudit()">📥 Export</button>'
      + '</div>'
      + (logs.length ? '<div class="card">' + rows + '</div>'
        : '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No audit logs yet</div></div>')
      + '</div>';
  },

  _exportAudit: function() {
    var logs = AuditLog.get();
    var csv  = 'Time,User,Role,Action,Detail\n';
    csv += logs.map(function(l) {
      return [l.timestamp,l.userName,l.role,l.action,l.detail].map(function(v){ return '"' + (v||'').replace(/"/g,'""') + '"'; }).join(',');
    }).join('\n');
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'audit_log_' + Utils.today() + '.csv';
    a.click();
    Toast.show('Audit log exported ✓', 'ok');
  },

  /* ── ACTIVITY TAB ───────────────────────────────────────── */
  _renderActivity: function(el) {
    var users = DB.get('users') || [];
    var cur   = DB.getSettings().currency || '$';

    // Performance cards per user
    var ranked = users.map(function(u) {
      var stats = Activity.getStats(u.id);
      var sales = DB.getSales().filter(function(s){ return s.userId === u.id; });
      var rev   = sales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
      return Object.assign({}, u, { stats: stats, revenue: rev });
    }).sort(function(a,b){ return b.revenue - a.revenue; });

    var medals = ['🥇','🥈','🥉'];
    var cards  = ranked.map(function(u, i) {
      var info = Perms.getRoleInfo(u.role);
      var s    = u.stats;
      return '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r14);padding:14px;margin-bottom:10px">'
        + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
        + '<div style="font-size:28px">' + (medals[i]||'🏅') + '</div>'
        + '<div style="flex:1">'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1)">' + Utils.esc(u.name||u.username) + '</div>'
        + '<div style="margin-top:3px">' + Perms.roleBadge(u.role) + '</div>'
        + '</div>'
        + '<div style="text-align:right"><div style="font-size:18px;font-weight:800;color:var(--g)">' + Utils.cur(u.revenue,cur) + '</div><div style="font-size:10px;color:var(--t3)">Total Revenue</div></div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
        + UserMgmt._miniStat('🧾', 'Sales', s.totalSales)
        + UserMgmt._miniStat('📄', 'Quotations', s.totalQuotations)
        + UserMgmt._miniStat('📦', 'Products', s.totalProducts)
        + UserMgmt._miniStat('👥', 'Customers', s.totalCustomers)
        + UserMgmt._miniStat('🔑', 'Sessions', s.totalSessions)
        + UserMgmt._miniStat('⏱️', 'Avg Mins', s.avgSessionMins)
        + '</div>'
        + (s.lastLogin ? '<div style="font-size:10px;color:var(--t3);margin-top:8px">Last login: ' + new Date(s.lastLogin).toLocaleString() + '</div>' : '')
        + '</div>';
    }).join('');

    el.innerHTML = '<div class="sec">'
      + '<div class="sec-title">Employee Performance Rankings</div>'
      + (ranked.length ? cards : '<div class="empty"><div class="empty-icon">📈</div><div class="empty-title">No activity data yet</div></div>')
      + '</div>';
  },

  _miniStat: function(icon, label, val) {
    return '<div style="text-align:center;background:var(--bg3);border-radius:var(--r10);padding:8px 4px">'
      + '<div style="font-size:14px">' + icon + '</div>'
      + '<div style="font-size:16px;font-weight:700;color:var(--t1)">' + val + '</div>'
      + '<div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em">' + label + '</div>'
      + '</div>';
  },
};
