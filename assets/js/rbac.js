/* SmartStock Pro V5 — RBAC, Multi-Business & Activity System */

/* ═══════════════════════════════════════════════════════════
   PERMISSIONS REGISTRY
═══════════════════════════════════════════════════════════ */
var PERMISSIONS = {
  // Sales
  create_sales:        'Create Sales',
  edit_sales:          'Edit Sales',
  delete_sales:        'Delete Sales',
  // Products & Inventory
  create_products:     'Create Products',
  edit_products:       'Edit Products',
  delete_products:     'Delete Products',
  manage_inventory:    'Manage Inventory',
  // People
  manage_customers:    'Manage Customers',
  manage_suppliers:    'Manage Suppliers',
  manage_payroll:      'Manage Payroll',
  manage_users:        'Manage Users',
  // Finance
  view_reports:        'View Reports',
  export_reports:      'Export Reports',
  view_financial:      'View Financial Data',
  manage_expenses:     'Manage Expenses',
  approve_transactions:'Approve Transactions',
  // Supply & Quotations
  create_quotations:   'Create Quotations',
  manage_purchases:    'Manage Purchase Orders',
  // System
  access_settings:     'Access Settings',
  access_ai:           'Access AI Assistant',
  backup_database:     'Backup & Restore Database',
  view_audit_logs:     'View Audit Logs',
  // Admin
  manage_businesses:   'Manage Businesses',
  manage_branches:     'Manage Branches',
  manage_roles:        'Manage Roles',
  transfer_ownership:  'Transfer Ownership',
};

/* ═══════════════════════════════════════════════════════════
   ROLE DEFINITIONS
═══════════════════════════════════════════════════════════ */
var ROLE_PRESETS = {
  primary_admin: {
    label: 'Primary Admin',
    color: 'var(--g)',
    bg:    'var(--gb)',
    icon:  '👑',
    permissions: Object.keys(PERMISSIONS).reduce(function(o,k){ o[k]=true; return o; }, {}),
  },
  admin: {
    label: 'Admin',
    color: 'var(--in)',
    bg:    'var(--inb)',
    icon:  '🛡️',
    permissions: {
      create_sales:true, edit_sales:true, delete_sales:true,
      create_products:true, edit_products:true, delete_products:true,
      manage_inventory:true, manage_customers:true, manage_suppliers:true,
      manage_payroll:true, manage_users:true,
      view_reports:true, export_reports:true, view_financial:true,
      manage_expenses:true, approve_transactions:true,
      create_quotations:true, manage_purchases:true,
      access_settings:true, access_ai:true,
      manage_branches:true, view_audit_logs:true,
    },
  },
  accountant: {
    label: 'Accountant',
    color: 'var(--ok)',
    bg:    'var(--okb)',
    icon:  '📊',
    permissions: {
      view_reports:true, export_reports:true, view_financial:true,
      manage_expenses:true, manage_payroll:true,
      create_quotations:true, access_ai:true,
    },
  },
  store_manager: {
    label: 'Store Manager',
    color: 'var(--wa)',
    bg:    'var(--wab)',
    icon:  '🏭',
    permissions: {
      create_products:true, edit_products:true, manage_inventory:true,
      manage_suppliers:true, manage_purchases:true,
      view_reports:true, create_quotations:true,
    },
  },
  sales_employee: {
    label: 'Sales Employee',
    color: '#7B7FF5',
    bg:    'rgba(123,127,245,.1)',
    icon:  '💼',
    permissions: {
      create_sales:true, create_quotations:true,
      manage_customers:true,
    },
  },
  viewer: {
    label: 'Viewer / Auditor',
    color: 'var(--t2)',
    bg:    'var(--bg3)',
    icon:  '👁️',
    permissions: {
      view_reports:true, view_financial:true, view_audit_logs:true,
    },
  },
};

/* ═══════════════════════════════════════════════════════════
   PERMISSION CHECK HELPERS
═══════════════════════════════════════════════════════════ */
var Perms = {
  // Check if current user has a permission
  can: function(permKey) {
    var user = Auth.currentUser;
    if (!user) return false;
    if (user.role === 'primary_admin') return true;
    // Check custom permissions first
    if (user.permissions && user.permissions[permKey] !== undefined) {
      return !!user.permissions[permKey];
    }
    // Fall back to role preset
    var preset = ROLE_PRESETS[user.role];
    if (preset) return !!preset.permissions[permKey];
    return false;
  },

  // Get role display info
  getRoleInfo: function(role) {
    return ROLE_PRESETS[role] || { label: role || 'User', color: 'var(--t2)', bg: 'var(--bg3)', icon: '👤' };
  },

  // Role badge HTML
  roleBadge: function(role) {
    var info = Perms.getRoleInfo(role);
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;background:' + info.bg + ';color:' + info.color + ';border:1px solid ' + info.color + '40">' + info.icon + ' ' + info.label + '</span>';
  },

  // Check role level (for promotion/demotion)
  roleLevel: function(role) {
    var levels = { primary_admin:5, admin:4, accountant:3, store_manager:3, sales_employee:2, viewer:1 };
    return levels[role] || 1;
  },
};

/* ═══════════════════════════════════════════════════════════
   AUDIT LOG SYSTEM
═══════════════════════════════════════════════════════════ */
var AuditLog = {
  // Record an action — called throughout the app
  record: function(action, detail, businessId) {
    var user = Auth.currentUser || {};
    var logs = DB.get('auditLogs') || [];
    var entry = {
      id:         Utils.uid('LOG'),
      userId:     user.id || 'system',
      userName:   user.name || user.username || 'System',
      role:       user.role || 'unknown',
      businessId: businessId || (user.currentBusinessId) || null,
      branchId:   user.branchId || null,
      action:     action,
      detail:     detail || '',
      timestamp:  new Date().toISOString(),
      device:     navigator.userAgent.slice(0, 80),
    };
    logs.unshift(entry);
    // Keep last 2000 logs
    if (logs.length > 2000) logs = logs.slice(0, 2000);
    DB.set('auditLogs', logs);
  },

  // Get logs with optional filters
  get: function(filters) {
    var logs = DB.get('auditLogs') || [];
    if (!filters) return logs;
    if (filters.userId)     logs = logs.filter(function(l){ return l.userId === filters.userId; });
    if (filters.businessId) logs = logs.filter(function(l){ return l.businessId === filters.businessId; });
    if (filters.action)     logs = logs.filter(function(l){ return l.action.includes(filters.action); });
    if (filters.date)       logs = logs.filter(function(l){ return l.timestamp.startsWith(filters.date); });
    return logs;
  },
};

/* ═══════════════════════════════════════════════════════════
   ACTIVITY TRACKER
═══════════════════════════════════════════════════════════ */
var Activity = {
  _session: null,

  // Called on login
  startSession: function(user) {
    var session = {
      id:         Utils.uid('SES'),
      userId:     user.id,
      loginTime:  new Date().toISOString(),
      logoutTime: null,
      device:     navigator.userAgent.slice(0,80),
      actions:    [],
      salesCount: 0,
      invoicesCount: 0,
      quotationsCount: 0,
      productsAdded: 0,
      expensesAdded: 0,
      customersAdded: 0,
    };
    Activity._session = session;
    Utils.storage.set('active_session', session);
    AuditLog.record('LOGIN', 'User logged in');
  },

  // Called on logout/page close
  endSession: function() {
    var session = Activity._session || Utils.storage.get('active_session');
    if (!session) return;
    session.logoutTime = new Date().toISOString();
    var sessions = DB.get('activityLogs') || [];
    sessions.unshift(session);
    if (sessions.length > 500) sessions = sessions.slice(0, 500);
    DB.set('activityLogs', sessions);
    Utils.storage.del('active_session');
    Activity._session = null;
    AuditLog.record('LOGOUT', 'User logged out');
  },

  // Track a specific action count
  track: function(type) {
    var session = Activity._session;
    if (!session) return;
    if (type === 'sale')       session.salesCount++;
    if (type === 'invoice')    session.invoicesCount++;
    if (type === 'quotation')  session.quotationsCount++;
    if (type === 'product')    session.productsAdded++;
    if (type === 'expense')    session.expensesAdded++;
    if (type === 'customer')   session.customersAdded++;
    session.actions.push({ type: type, time: new Date().toISOString() });
    Utils.storage.set('active_session', session);
  },

  // Get performance stats for a user
  getStats: function(userId) {
    var logs = DB.get('activityLogs') || [];
    var userLogs = logs.filter(function(l){ return l.userId === userId; });
    return {
      totalSessions:    userLogs.length,
      totalSales:       userLogs.reduce(function(a,l){ return a+(l.salesCount||0); }, 0),
      totalInvoices:    userLogs.reduce(function(a,l){ return a+(l.invoicesCount||0); }, 0),
      totalQuotations:  userLogs.reduce(function(a,l){ return a+(l.quotationsCount||0); }, 0),
      totalProducts:    userLogs.reduce(function(a,l){ return a+(l.productsAdded||0); }, 0),
      totalCustomers:   userLogs.reduce(function(a,l){ return a+(l.customersAdded||0); }, 0),
      lastLogin:        userLogs[0] ? userLogs[0].loginTime : null,
      avgSessionMins:   userLogs.length ? Math.round(userLogs.reduce(function(a,l){
        if (!l.logoutTime) return a;
        return a + (new Date(l.logoutTime) - new Date(l.loginTime)) / 60000;
      }, 0) / userLogs.length) : 0,
    };
  },
};

/* ═══════════════════════════════════════════════════════════
   MULTI-BUSINESS MANAGER
═══════════════════════════════════════════════════════════ */
var BusinessMgr = {
  // Get all businesses (primary admin sees all, others see assigned)
  getAll: function() {
    var all = DB.get('businesses') || [];
    var user = Auth.currentUser;
    if (!user) return [];
    if (user.role === 'primary_admin') return all;
    var ids = user.businessIds || [];
    return all.filter(function(b){ return ids.indexOf(b.id) !== -1; });
  },

  // Get current active business
  getCurrent: function() {
    var user = Auth.currentUser;
    if (!user) return null;
    var id = user.currentBusinessId || Utils.storage.get('current_business');
    var all = DB.get('businesses') || [];
    return all.find(function(b){ return b.id === id; }) || all[0] || null;
  },

  // Switch active business
  switchTo: function(businessId) {
    var user = Auth.currentUser;
    if (!user) return;
    user.currentBusinessId = businessId;
    Auth.currentUser = user;
    Utils.storage.set('current_business', businessId);
    AuditLog.record('SWITCH_BUSINESS', 'Switched to business: ' + businessId);
    Router.go('dashboard');
    Toast.show('Business switched ✓', 'ok');
  },

  // Get branches for a business
  getBranches: function(businessId) {
    var all = DB.get('branches') || [];
    return all.filter(function(b){ return b.businessId === (businessId || '') ; });
  },
};
