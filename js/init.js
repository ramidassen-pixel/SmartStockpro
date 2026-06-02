if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

(function() {
      try {
        var s = localStorage.getItem('ss_session');
        if (s && JSON.parse(s).uid) {
          // We have a session — inject CSS to skip BOTH loaders entirely
          // The app will appear instantly; no logo flash, no spinner
          var style = document.createElement('style');
          style.id = 'instant-restore-css';
          style.textContent = 
            '#ss-loader { display: none !important; }' +
            '#splash-restore { display: none !important; }' +
            '#login { display: none !important; }' +
            '#shell { display: flex !important; }';
          document.head.appendChild(style);
          window._instantRestore = true;
        }
      } catch(e) {}
    })();

// ── Service Worker: Clear old caches & unregister ──────
  // This runs FIRST to kill any cached broken versions
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(reg) {
        reg.unregister();
        console.log('[SW] Unregistered:', reg.scope);
      });
    });
    caches.keys().then(function(names) {
      names.forEach(function(name) {
        caches.delete(name);
        console.log('[SW] Cache deleted:', name);
      });
    });
  }
  // ── DO NOT re-register service worker ──────────────────
  // Service workers cause stale cache problems.
  // App works fine without one using Firebase for sync.
  //
  // To re-enable offline support in future, add sw.js back
  // with a cache-busting version number.

// ══════════════════════════════════════════════════════════
// RENDER GUARANTEE SYSTEM
// Retries all page renders after Firebase syncs
// Ensures no page stays blank due to timing issues
// ══════════════════════════════════════════════════════════

var _renderGuardActive = false;
var _renderGuardTimer  = null;

function startRenderGuard() {
  if (_renderGuardActive) return;
  _renderGuardActive = true;
  var attempts = 0;
  var maxAttempts = 20; // 20 x 1.5s = 30 seconds
  _renderGuardTimer = setInterval(function() {
    attempts++;
    var b = (typeof biz === 'function') ? biz() : null;
    if (b && b.name) {
      // Business data loaded — render current page
      try {
        var lastPage = localStorage.getItem('ss_last_page') || 'dash';
        goTo(lastPage);
      } catch(e) {}
      clearInterval(_renderGuardTimer);
      _renderGuardActive = false;
      return;
    }
    if (attempts >= maxAttempts) {
      clearInterval(_renderGuardTimer);
      _renderGuardActive = false;
    }
  }, 1500);
}


// ── Force clear stale service worker caches ──
(function(){
  var APP_VER='4.9';
  try{
    var sv=localStorage.getItem('ss_app_ver');
    if(sv!==APP_VER){
      localStorage.setItem('ss_app_ver',APP_VER);
      if('caches' in window){
        caches.keys().then(function(ns){ns.forEach(function(n){caches.delete(n);});});
      }
      if('serviceWorker' in navigator){
        navigator.serviceWorker.getRegistrations().then(function(rs){
          if(rs.length>0){rs.forEach(function(r){r.unregister();});window.location.reload(true);}
        });
      }
    }
  }catch(e){}
})();


/* ============================================================
   SmartStock Pro — app.js
   Complete application JavaScript
   Sections:
     - Config & Constants
     - Permissions & Auth
     - UI Utilities (toast, confirm, drawers)
     - Admin & Change Requests
     - Login & Session Management
     - Dashboard
     - Sales / POS
     - Products & Inventory
     - Firebase Sync
     - Expenses
     - Gallery
     - Salary
     - Credits / Debtors
     - Business Settings & Team
     - Reports & Daily Report
     - Customers
     - AI Assistant
     - Team Chat
     - PWA & Service Worker
     - Stock Management
     - Quotations
     - Warehouses
     - Suppliers
     - Order Fulfillment
     - Initialization
   ============================================================ */





'use strict';
const CSYM={USD:'$',LRD:'L$',EUR:'€',GBP:'£',NGN:'₦',GHS:'₵',ZAR:'R',KES:'Ksh'};
const CATI={Tiles:'🟦',Cement:'🏗',Tools:'🔧',Paint:'🎨',Plumbing:'🚰',Electrical:'⚡',Accessories:'🔩',Other:'📦',General:'📦'};
const MODS=['products','sales','stock','expenses','salary','reports'];
const MLBL={products:'Products',sales:'Sales',stock:'Stock',expenses:'Expenses',salary:'Salary',reports:'Reports'};
const RLBL={primaryAdmin:'Primary Admin',admin:'Admin',dataOperator:'Data Operator',viewer:'Viewer'};
const RCLS={primaryAdmin:'rpa',admin:'rad',dataOperator:'rdo',viewer:'rvi'};
const PROD_LOCK_HRS=3;  // hours before product edit requires approval (was 8)
const RECORD_LOCK_HRS=3; // hours before sales/expense edit requires approval (was 8)
const DEL_GRACE=5*60*60*1000;
let DB={businesses:[],currentBizId:1,users:[],inviteCodes:[],notifications:[],deleteRequests:[],changeRequests:[],adminLog:[],nextBizId:2,nextUserId:3,nextCodeId:1,nextNotifId:1,nextReqId:1,nextLogId:1,nextCRId:1};
let CU=null,CBI=1,confFn=null,toastTmr=null;
let cartItems=[],siItems=[],siIdx=0,soItems=[],soIdx=0,puItems=[],puIdx=0;
let currentPayMode='Cash',saleMode='quick';
let saleFilter='all',expFilter='all',prodCat='all',galCat='all';
let payingCrId=null,editProdId=null,editEmpId=null,curSalRecId=null;
let pendingRecCR={type:null,id:null,label:null}; // for sale/expense change requests
let editingExpId=null,editingSaleId=null,pendingCRProdId=null;
let pinCallback=null,pinCancelCb=null;
let calcRooms=[{id:1,name:'Room 1',l:0,w:0,area:0}],calcRId=2;
let permSel={manual:MODS.slice(),invite:MODS.slice()};
let adminTabActive='requests';
let curTheme='dark';

const biz=()=>{if(!DB||!DB.businesses||!DB.businesses.length)return null;return DB.businesses.find(b=>b.id===CBI)||DB.businesses[0];};
const today=()=>new Date().toISOString().split('T')[0];
const yesterday=()=>{var d=new Date();d.setDate(d.getDate()-1);return d.toISOString().split('T')[0];};
const calcTrend=(curr,prev)=>{
  if(prev<=0&&curr<=0)return 0;
  if(prev<=0)return 100;
  return Math.round(((curr-prev)/prev)*100);
};
const trendHtml=pct=>{
  if(pct===0||isNaN(pct))return '';
  var up=pct>0;
  return '<div class="trend '+(up?'trend-up':'trend-dn')+'">'+(up?'↑':'↓')+Math.abs(pct)+'%</div>';
};
const thisMonth=()=>today().slice(0,7);
const sym=()=>{const b=biz();return({"USD":"$","LRD":"L$","EUR":"€","GBP":"£","NGN":"₦","GHS":"₵","ZAR":"R","KES":"Ksh"})[b&&b.currency?b.currency:'USD']||'$';};
const f$=v=>sym()+Number(v||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const fN=v=>Number(v||0).toLocaleString();
const isToday=d=>d===today();
const isWeek=d=>{
  if(!d)return false;
  var t=new Date(d+'T12:00:00');
  return(Date.now()-t.getTime())<=7*24*3600000;
};
const isMon=d=>d&&d.startsWith(today().slice(0,7));
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const em=m=>`<div class="empty"><div class="ei">📦</div><div class="et">Nothing here</div><div class="es">${m}</div></div>`;
const ago=ts=>{const d=(Date.now()-ts)/1000;if(d<60)return Math.floor(d)+'s ago';if(d<3600)return Math.floor(d/60)+'m ago';if(d<86400)return Math.floor(d/3600)+'h ago';return Math.floor(d/86400)+'d ago';};
const fmtDate=ts=>new Date(ts).toLocaleString();
const mkInit=n=>String(n||'?').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
const sTotal=s=>Math.max(0,s.items.reduce((a,b)=>a+b.qty*b.unitPrice,0)-(s.discount||0));
const sDue=s=>Math.max(0,sTotal(s)-(s.paid||0));
const sSt=s=>{const d=sDue(s);return d<=0?'PAID':(s.paid||0)>0?'PARTIAL':'CREDIT';};
const crBal=c=>(c.totalOwed||0)-(c.totalPaid||0); // Outstanding balance (can be 0)
const canAccess=m=>{if(!CU)return false;if(CU.role==='primaryAdmin'||CU.role==='admin')return true;return(CU.allowedModules||[]).includes(m);};
const isAdmin=()=>CU&&(CU.role==='primaryAdmin'||CU.role==='admin');
// ─── PRIMARY ADMIN: only the original account creator
const isPrimary=()=>CU&&CU.role==='primaryAdmin';

// ─── PERMISSION SYSTEM ───
// Each toggleable permission has a key. Primary admin can grant these per-user.
// 9 toggleable permissions (the ones the user selected)
const PERM_KEYS = [
  'see_dashboard_cards',     // Dashboard revenue/profit cards (overall)
  'see_net_profit',          // Hero: Today's Net Profit strip
  'see_expenses_card',       // Dashboard: Expenses card
  'see_inventory_value',     // Dashboard: Inventory Value card
  'see_weekly_revenue',      // Dashboard: Weekly Revenue chart
  'see_all_sales',           // See ALL sales (not just own) — also drives Today Sales total
  'see_product_price',       // See product selling prices
  'see_financial_reports',   // Reports page (P&L, profit analysis)
  'see_sales_totals',        // Sales totals + due amounts on sales page
  'see_product_cost',        // Product cost prices
  'see_expenses',            // Expenses page (full access)
  'see_salary_management',   // Salary Management menu access
  'export_reports',          // Export Excel
  'print_daily_report',      // Print daily summary
  'manage_team',             // Manage team (approve, promote)
  'manage_settings'          // Business Settings
];
const PERM_LABELS = {
  see_dashboard_cards:   'View Dashboard (general)',
  see_net_profit:        'View Today\'s Net Profit',
  see_expenses_card:     'View Expenses card',
  see_inventory_value:   'View Inventory Value card',
  see_weekly_revenue:    'View Weekly Revenue chart',
  see_all_sales:         'View ALL sales (not just own)',
  see_product_price:     'View product selling prices',
  see_financial_reports: 'View Financial Reports',
  see_sales_totals:      'View Sales totals + due amounts',
  see_product_cost:      'View product cost prices',
  see_expenses:          'View Expenses page',
  see_salary_management: 'Access Salary Management',
  export_reports:        'Export Sales / Reports to Excel',
  print_daily_report:    'Print Daily Report',
  manage_team:           'Manage Team',
  manage_settings:       'Manage Business Settings'
};


// ═══════════════════════════════════════════════════════════════════
//  WORKING-DAY ALLOCATION SYSTEM
//  Used by Documentation Expense & Salary Allocation modules
// ═══════════════════════════════════════════════════════════════════

// Holiday calendar per country (MM-DD format, repeated every year)
// "*" before date = fixed annual date. Some holidays vary year-to-year — those use full YYYY-MM-DD.
const COUNTRY_HOLIDAYS = {
  Liberia: {
    name: 'Liberia',
    flag: '🇱🇷',
    workWeek: [1,2,3,4,5,6], // Mon-Sat (0=Sun, 6=Sat)
    fixed: [
      {date:'01-01', name:'New Year\'s Day'},
      {date:'02-11', name:'Armed Forces Day'},
      {date:'03-15', name:'Decoration Day'},
      {date:'03-15', name:'J.J. Roberts\' Birthday'},
      {date:'04-12', name:'Fast & Prayer Day'},
      {date:'05-14', name:'National Unification Day'},
      {date:'07-26', name:'Independence Day'},
      {date:'08-24', name:'Flag Day'},
      {date:'11-29', name:'President Tubman\'s Birthday'},
      {date:'12-25', name:'Christmas Day'},
    ]
  },
  Ghana: {
    name: 'Ghana',
    flag: '🇬🇭',
    workWeek: [1,2,3,4,5,6],
    fixed: [
      {date:'01-01', name:'New Year\'s Day'},
      {date:'01-07', name:'Constitution Day'},
      {date:'03-06', name:'Independence Day'},
      {date:'05-01', name:'Workers\' Day'},
      {date:'05-25', name:'Africa Unity Day'},
      {date:'07-01', name:'Republic Day'},
      {date:'09-21', name:'Founder\'s Day'},
      {date:'12-25', name:'Christmas Day'},
      {date:'12-26', name:'Boxing Day'},
    ]
  },
  Nigeria: {
    name: 'Nigeria',
    flag: '🇳🇬',
    workWeek: [1,2,3,4,5,6],
    fixed: [
      {date:'01-01', name:'New Year\'s Day'},
      {date:'05-01', name:'Workers\' Day'},
      {date:'05-29', name:'Democracy Day'},
      {date:'06-12', name:'Democracy Day (Public)'},
      {date:'10-01', name:'Independence Day'},
      {date:'12-25', name:'Christmas Day'},
      {date:'12-26', name:'Boxing Day'},
    ]
  },
  USA: {
    name: 'United States',
    flag: '🇺🇸',
    workWeek: [1,2,3,4,5], // Mon-Fri
    fixed: [
      {date:'01-01', name:'New Year\'s Day'},
      {date:'07-04', name:'Independence Day'},
      {date:'11-11', name:'Veterans Day'},
      {date:'12-25', name:'Christmas Day'},
    ]
  },
  Other: {
    name: 'Other',
    flag: '🌍',
    workWeek: [1,2,3,4,5,6],
    fixed: []
  }
};

function getBizCountry(){
  const b = (typeof biz === 'function') ? biz() : null;
  if (!b) return 'Liberia';
  return b.country || 'Liberia';
}

function getHolidaySet(year, country){
  country = country || getBizCountry();
  const data = COUNTRY_HOLIDAYS[country] || COUNTRY_HOLIDAYS.Liberia;
  const set = new Set();
  (data.fixed || []).forEach(function(h){
    set.add(year + '-' + h.date);
  });
  // Custom business holidays (if added)
  const b = (typeof biz === 'function') ? biz() : null;
  if (b && Array.isArray(b.customHolidays)) {
    b.customHolidays.forEach(function(h){
      if (h && h.date) set.add(h.date);
    });
  }
  return set;
}

function isWorkingDay(dateStr, country){
  // dateStr = 'YYYY-MM-DD'
  if (!dateStr) return false;
  country = country || getBizCountry();
  const data = COUNTRY_HOLIDAYS[country] || COUNTRY_HOLIDAYS.Liberia;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const dow = d.getDay(); // 0=Sun..6=Sat
  if (!(data.workWeek || []).includes(dow)) return false;
  const year = d.getFullYear();
  const holidays = getHolidaySet(year, country);
  if (holidays.has(dateStr)) return false;
  return true;
}


// ─── Get day count using allocation method (calendar OR working days) ───
function getAllocDayCount(startDateStr, endDateStr){
  // Always uses working days only (Mon-Sat, excludes holidays)
  return countWorkingDays(startDateStr, endDateStr);
}

// ─── Check if a date counts for allocation (respects method setting) ───
function isAllocationDay(dateStr){
  // Allocation only happens on working days (Mon-Sat, no holidays)
  return isWorkingDay(dateStr);
}

function countWorkingDays(startDateStr, endDateStr, country){
  // Inclusive on both ends
  if (!startDateStr || !endDateStr) return 0;
  country = country || getBizCountry();
  var start = new Date(startDateStr + 'T00:00:00');
  var end = new Date(endDateStr + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (start > end) return 0;
  // Walk year by year for efficiency (cache holidays per year)
  var holidayCache = {};
  var data = COUNTRY_HOLIDAYS[country] || COUNTRY_HOLIDAYS.Liberia;
  var ww = new Set(data.workWeek || []);
  var count = 0;
  var cur = new Date(start);
  while (cur <= end) {
    var yr = cur.getFullYear();
    if (!holidayCache[yr]) holidayCache[yr] = getHolidaySet(yr, country);
    if (ww.has(cur.getDay())) {
      var iso = cur.toISOString().split('T')[0];
      if (!holidayCache[yr].has(iso)) count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ─── Per-document/per-salary daily allocation ───
function getDocDailyAmount(doc){
  if (!doc) return 0;
  if (!doc.cost || !doc.startDate || !doc.expiryDate) return 0;
  const total = getAllocDayCount(doc.startDate, doc.expiryDate);
  if (total <= 0) return 0;
  return doc.cost / total;
}

function getSalaryDailyAmount(emp){
  if (!emp) return 0;
  // Only allocate if both dates set AND toggle is enabled
  if (!emp.allocStart || !emp.allocEnd) return 0;
  // Validate dates
  if (emp.allocEnd <= emp.allocStart) return 0;
  var total = getAllocDayCount(emp.allocStart, emp.allocEnd);
  if (total <= 0) return 0;
  // Use allocCost if available; otherwise compute from monthly salary
  var cost = parseFloat(emp.allocCost || 0);
  if (cost <= 0) {
    // Fallback: compute from monthly salary × months
    var sD = new Date(emp.allocStart + 'T00:00:00');
    var eD = new Date(emp.allocEnd + 'T00:00:00');
    var months = (eD.getFullYear() - sD.getFullYear()) * 12 + (eD.getMonth() - sD.getMonth());
    var lms = new Date(eD.getFullYear(), eD.getMonth(), 1);
    months += (Math.floor((eD - lms)/(86400000)) + 1) / new Date(eD.getFullYear(),eD.getMonth()+1,0).getDate();
    months -= (sD.getDate()-1) / new Date(sD.getFullYear(),sD.getMonth()+1,0).getDate();
    if (months < 0.01) months = 0.01;
    cost = parseFloat(emp.monthlySalary || 0) * months;
  }
  if (cost <= 0) return 0;
  return cost / total;
}

function getDocAccruedAmount(doc, asOfDateStr){
  // How much has accrued from startDate to asOf (or today)
  if (!doc || !doc.startDate) return 0;
  asOfDateStr = asOfDateStr || today();
  const start = doc.startDate;
  // accrued = working days from start to min(asOf, expiry)... but user said "keep allocating until deleted"
  // We'll use min(asOf, expiry) for the strict version OR asOf for "keep going" — we picked KEEP GOING
  const end = asOfDateStr;
  const workedDays = countWorkingDays(start, end);
  const daily = getDocDailyAmount(doc);
  return workedDays * daily;
}

// ─── Aggregate daily allocations (called by getDailyNet) ───
function getDayAllocations(dateStr){
  // Returns {docs: $X, salary: $Y, total: $X+$Y, breakdown: [...]}
  const b = (typeof biz === 'function') ? biz() : null;
  if (!b) return {docs:0, salary:0, total:0, breakdown:[]};
  if (!dateStr) dateStr = today();
  // Skip only if allocation method = 'working' AND not a working day
  if (!isAllocationDay(dateStr)) return {docs:0, salary:0, total:0, breakdown:[]};

  var docs = 0;
  var docList = [];
  (b.docExpenses || []).forEach(function(d){
    if (d.status === 'deleted') return;
    if (!d.startDate || dateStr < d.startDate) return;
    // "Keep allocating until deleted/renewed" — so allocate even after expiry
    var amount = getDocDailyAmount(d);
    if (amount > 0) {
      docs += amount;
      docList.push({type:'doc', name:d.name, amount:amount, id:d.id});
    }
  });

  var salary = 0;
  var salList = [];
  (b.employees || []).forEach(function(emp){
    if (emp.deleted) return;
    if (!emp.allocStart || !emp.allocEnd) return;
    if (dateStr < emp.allocStart || dateStr > emp.allocEnd) return;
    var amount = getSalaryDailyAmount(emp);
    if (amount > 0) {
      salary += amount;
      salList.push({type:'salary', name:emp.name, amount:amount, id:emp.id});
    }
  });

  return {
    docs: docs,
    salary: salary,
    total: docs + salary,
    breakdown: docList.concat(salList)
  };
}


const PERM_ICONS = {
  see_dashboard_cards:   '📊',
  see_net_profit:        '💚',
  see_expenses_card:     '💸',
  see_inventory_value:   '📦',
  see_weekly_revenue:    '📈',
  see_all_sales:         '🧾',
  see_product_price:     '💲',
  see_financial_reports: '💰',
  see_sales_totals:      '🧾',
  see_product_cost:      '🏷',
  see_expenses:          '💸',
  see_salary_management: '💼',
  export_reports:        '📥',
  print_daily_report:    '🖨',
  manage_team:           '👥',
  manage_settings:       '⚙'
};

// Default permissions when user is created.
// Primary admin gets all. Admin gets a sensible default. dataOperator/viewer get nothing.
function defaultPermsFor(role) {
  if (role === 'primaryAdmin') {
    var p = {}; PERM_KEYS.forEach(function(k){ p[k] = true; }); return p;
  }
  if (role === 'admin') {
    // Admins by default can view but not export. Primary admin can adjust.
    return {
      see_dashboard_cards: true,
      see_net_profit: true,
      see_expenses_card: true,
      see_inventory_value: true,
      see_weekly_revenue: true,
      see_all_sales: true,
      see_product_price: true,
      see_financial_reports: true,
      see_sales_totals: true,
      see_product_cost: false,
      see_expenses: true,
      see_salary_management: true,
      export_reports: false,
      print_daily_report: false,
      manage_team: false,
      manage_settings: false
    };
  }
  // Staff / viewers — nothing financial by default
  var p2 = {}; PERM_KEYS.forEach(function(k){ p2[k] = false; });
  // But they need to see product prices to make sales
  p2.see_product_price = true;
  return p2;
}

// CHECK if current user has a given permission
// Primary admin ALWAYS has all permissions (cannot be revoked).
function hasPerm(permKey) {
  if (!CU) return false;
  if (CU.role === 'primaryAdmin') return true;
  // Make sure user has perms object
  if (!CU.perms) {
    var u = (DB.users || []).find(function(x){ return x.id === CU.id; });
    CU.perms = (u && u.perms) ? u.perms : defaultPermsFor(CU.role);
  }
  return !!CU.perms[permKey];
}

// Show a friendly "locked" toast and explanation
function permDenied(permKey) {
  var label = PERM_LABELS[permKey] || permKey;
  var icon = PERM_ICONS[permKey] || '🔒';
  toast(icon + ' Locked: "' + label + '" — ask admin for access', 'er');
}

// Set permission on a user (only primary admin can do this)
function setUserPerm(userId, permKey, value) {
  if (!isPrimary()) { toast('Only primary admin can change permissions', 'er'); return false; }
  if (PERM_KEYS.indexOf(permKey) < 0) return false;
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) { toast('User not found', 'er'); return false; }
  if (u.role === 'primaryAdmin') { toast('Cannot change primary admin permissions', 'er'); return false; }
  u.perms = u.perms || defaultPermsFor(u.role);
  u.perms[permKey] = !!value;
  u.updatedAt = Date.now();
  // Audit
  if (typeof addAdminLog === 'function') {
    addAdminLog('perm_change',
      (value ? 'Granted' : 'Revoked') + ' "' + PERM_LABELS[permKey] + '" for ' + u.name,
      CU.name);
  }
  dbSave();
  if (typeof fbPush === 'function') try { fbPush(); } catch(e){}
  return true;
}

// Migration: ensure all users have a perms object
function migrateUserPerms() {
  if (!DB.users) return;
  DB.users.forEach(function(u){
    if (!u.perms) u.perms = defaultPermsFor(u.role);
    // Make sure all known keys exist
    PERM_KEYS.forEach(function(k){
      if (typeof u.perms[k] === 'undefined') u.perms[k] = defaultPermsFor(u.role)[k];
    });
  });
}

// Password gate for sensitive actions — asks EVERY time (most secure)
function requirePassword(actionName, onSuccess) {
  if (!CU) { toast('Not signed in', 'er'); return; }
  var msg = 'Enter YOUR password to confirm: ' + (actionName || 'this sensitive action');
  requireAdminPin(onSuccess, null, msg);
}
const canDel=()=>isAdmin();
const payBadge=st=>st==='PAID'?'<span class="bdg bok0">✓ PAID</span>':st==='PARTIAL'?'<span class="bdg bwa0">◑ PARTIAL</span>':'<span class="bdg ber0">○ CREDIT</span>';
const g6=()=>{const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let r='';for(let i=0;i<6;i++)r+=c[Math.floor(Math.random()*c.length)];return r;};
const rb=r=>`<span class="rb0 ${{"primaryAdmin":"rpa","admin":"rad","dataOperator":"rdo","viewer":"rvi"}[r]||'rvi'}">${RLBL[r]||r}</span>`;
const el=id=>document.getElementById(id);
const gv=function(id){var e=document.getElementById(id);return e?(e.value||'').trim():'';}
const sv=function(id,v){var e=document.getElementById(id);if(e)e.value=(v===null||v===undefined)?'':v;};
const months=()=>{const m=[];for(let i=0;i<12;i++){const d=new Date();d.setMonth(d.getMonth()-i);m.push(d.toISOString().slice(0,7));}return m;};
const isProdLocked=p=>{if(!p||!p.createdAt||p.adminUnlocked)return false;return(Date.now()-p.createdAt)<PROD_LOCK_HRS*3600000;};
const prodLockRem=p=>{const rem=PROD_LOCK_HRS*3600000-(Date.now()-p.createdAt);if(rem<=0)return'0h';const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000);return h>0?`${h}h ${m}m`:`${m}m`;};
// Record lock: sales and expenses older than 3 hours require admin approval to edit/delete
const isRecordLocked=rec=>{if(!rec||!rec.createdAt||rec.adminUnlocked)return false;return(Date.now()-rec.createdAt)>RECORD_LOCK_HRS*3600000;};
const recLockAgo=rec=>{const h=Math.floor((Date.now()-rec.createdAt)/3600000);return h>=24?Math.floor(h/24)+'d ago':h+'h ago';};
const hasPendingCR=(type,id)=>(DB.changeRequests||[]).some(r=>r.bizId===CBI&&r.recordType===type&&r.recordId===id&&r.status==='pending');

// ── THEME ──
// renderProducts called inside saveProd

function initTheme(){curTheme=localStorage.getItem('ss_theme')||'dark';applyTheme(curTheme);}
function applyTheme(t){curTheme=t;document.documentElement.setAttribute('data-theme',t);localStorage.setItem('ss_theme',t);const mc=el('themecolor');if(mc)mc.content=t==='light'?'#F5F0E8':'#080808';}


// ── STORAGE ──
function dbSave(){
  // Always save locally first — encrypted if key is available
  try {
    if (typeof dbSaveEncrypted === 'function') {
      dbSaveEncrypted();
    } else {
      localStorage.setItem('ss_v4', JSON.stringify(DB));
    }
  } catch(e) {}
  // Then push to Firebase if connected (syncs all other devices)
  if (FB_READY) {
    setSyncStatus('saving');
    fbPush();
  }
}
function dbLoad(){
  var loaded = false;
  try {
    var rawData = null;
    if (typeof dbLoadDecrypted === 'function') {
      rawData = dbLoadDecrypted();
    } else {
      var r = localStorage.getItem('ss_v4');
      if (r) rawData = JSON.parse(r);
    }
    if (rawData) {
      DB = rawData;
      migrateDB();
      // Auto-purge expired trash items (older than 30 days)
      try { if(typeof purgExpiredTrash === 'function') purgExpiredTrash(); } catch(e){}
      loaded = true;
    }
  } catch(e) {}

  if (!loaded) {
    // ── FRESH DEVICE: Try to pull data from Firebase before doing anything ──
    // Don't seed demo data — connect to Firebase and pull real data first
    seedDB();  // set up empty DB structure
    // Auto-connect using hardcoded config (always available)
    if (typeof FB_DEFAULT_CONFIG !== 'undefined' && FB_DEFAULT_CONFIG) {
      try {
        FB_CONFIG = FB_DEFAULT_CONFIG;
        localStorage.setItem('ss_fb_config', JSON.stringify(FB_CONFIG));
      } catch(e){}
    }
    setTimeout(function(){
      if (typeof fbInit === 'function') fbInit();
    }, 1200);
    return;
  }

  // ── EXISTING DEVICE: If no real users exist, don't create demo accounts ──
  // (they were removed for security — each installation sets its own accounts)
  if (!DB.users) DB.users = [];

  // Connect Firebase for real-time sync
  if (fbLoadConfig()) {
    setTimeout(function() { fbInit(); }, 1500);
  } else if (typeof FB_DEFAULT_CONFIG !== 'undefined' && FB_DEFAULT_CONFIG) {
    // Use hardcoded config as fallback
    try {
      FB_CONFIG = FB_DEFAULT_CONFIG;
      localStorage.setItem('ss_fb_config', JSON.stringify(FB_CONFIG));
    } catch(e){}
    setTimeout(function(){ if(typeof fbInit==='function') fbInit(); }, 1500);
  } else {
    setSyncStatus('local');
  }
}
function migrateDB(){
  // Make sure top-level arrays exist
  if (!DB.notifications) DB.notifications = [];
  if (!DB.users) DB.users = [];
  if (!DB.businesses) DB.businesses = [];
  if (!DB.changeRequests) DB.changeRequests = [];
  if (!DB.adminLog) DB.adminLog = [];
  if (!DB.chatMessages) DB.chatMessages = [];
  if (!DB.inviteCodes) DB.inviteCodes = [];
  // Make sure each business has the new fields
  (DB.businesses || []).forEach(function(b){
    if (!b.docExpenses) b.docExpenses = [];
    if (!b.customHolidays) b.customHolidays = [];
    if (!b.country) b.country = 'Liberia';
    if (!b.nextDocId) b.nextDocId = 1;
  });
  if (typeof DB.nextNotifId !== 'number' || isNaN(DB.nextNotifId)) DB.nextNotifId = (DB.notifications || []).length + 1;
  if (typeof migrateUserPerms === 'function') migrateUserPerms();
  if(!DB.changeRequests)DB.changeRequests=[];if(!DB.adminLog)DB.adminLog=[];if(!DB.nextCRId)DB.nextCRId=1;
  DB.businesses.forEach(b=>{
    ['expenses','employees','salaryRecords','stockHistory','purchases','stockOuts','credits'].forEach(k=>{if(!b[k])b[k]=[];});
    ['nextExpId','nextEmpId','nextSalId','nextHistId','nextSoId','nextCrId'].forEach(k=>{if(!b[k])b[k]=1;});
    (b.products||[]).forEach(p=>{if(!p.imgData)p.imgData='';if(!p.createdAt)p.createdAt=Date.now()-PROD_LOCK_HRS*3600001;if(!p.updatedAt)p.updatedAt=p.createdAt;if(!p.status)p.status='active';});
    (b.sales||[]).forEach(s=>{if(!s.createdAt)s.createdAt=Date.now()-RECORD_LOCK_HRS*3600001;if(!s.updatedAt)s.updatedAt=s.createdAt;if(!s.status)s.status='active';if(!s.contact)s.contact='';if(!s.editLog)s.editLog=[];if(!s.fulfillments)s.fulfillments=[];if(!s.fulStatus)s.fulStatus='Pending';if(s.assignedStaff===undefined)s.assignedStaff='';});
    (b.expenses||[]).forEach(e=>{if(!e.createdAt)e.createdAt=Date.now()-RECORD_LOCK_HRS*3600001;if(!e.updatedAt)e.updatedAt=e.createdAt;if(!e.status)e.status='active';if(!e.editLog)e.editLog=[];});
    // New features migration
    if(!b.warehouses||!b.warehouses.length) b.warehouses=[{id:1,name:'Main Warehouse',location:'',isDefault:true,createdAt:Date.now()}];
    if(!b.nextWhId)    b.nextWhId    = (b.warehouses.reduce((a,w)=>Math.max(a,w.id),0))+1;
    if(!b.suppliers)   b.suppliers   = [];
    if(!b.nextSuppId)  b.nextSuppId  = 1;
    if(!b.suppInvoices)b.suppInvoices= [];
    if(!b.nextSInvId)  b.nextSInvId  = 1;
    if(!b.quotations)  b.quotations  = [];
    if(!b.nextQuoteId) b.nextQuoteId = 1;
    if(!b.stockHistory)b.stockHistory= [];
    if(!b.nextHistId)  b.nextHistId  = 1;
    if(!b.nextFulId)   b.nextFulId   = 1;
    // Ensure sales have fulfillment fields
    (b.sales||[]).forEach(function(s){
      if(!s.fulfillments)  s.fulfillments  = [];
      if(!s.fulStatus)     s.fulStatus     = 'Pending';
      if(!s.assignedStaff) s.assignedStaff = '';
    });
    // Ensure all products have warehouseStock
    (b.products||[]).forEach(function(p){
      if(!p.warehouseStock){
        p.warehouseStock={};
        p.warehouseStock[b.warehouses[0].id]=p.qty||0;
      }
    });
  });
}
function seedDB(){
  const ts=Date.now();
  const b={id:1,name:'SmartStock Store',currency:'USD',address:'Main Street',phone:'',logoType:'initials',logoData:'',lowStock:5,
    products:[
      {id:1,name:'Ceramic Floor Tile 60x60 Grey',sku:'T-6060-GRY',category:'Tiles',cost:18,price:28.50,qty:85,unit:'Box',lowLevel:10,desc:'6 tiles per box',size:'60x60cm',imgData:'',createdAt:ts-9*3600000,updatedAt:ts-9*3600000,status:'active'},
      {id:2,name:'White Wall Tile 30x60',sku:'T-3060-WHT',category:'Tiles',cost:12,price:19,qty:4,unit:'Box',lowLevel:10,desc:'',size:'30x60cm',imgData:'',createdAt:ts-5*3600000,updatedAt:ts-5*3600000,status:'active'},
      {id:3,name:'Portland Cement 50kg',sku:'C-PORT-50',category:'Cement',cost:8.5,price:13,qty:3,unit:'Bag',lowLevel:15,desc:'',size:'',imgData:'',createdAt:ts-24*3600000,updatedAt:ts-24*3600000,status:'active'},
      {id:4,name:'Tile Adhesive 20kg',sku:'C-ADH-20',category:'Cement',cost:6,price:10.50,qty:22,unit:'Bag',lowLevel:10,desc:'',size:'',imgData:'',createdAt:ts-24*3600000,updatedAt:ts-24*3600000,status:'active'},
      {id:5,name:'NEW: Mosaic Tile (LOCKED 🔒)',sku:'T-MOS-2',category:'Tiles',cost:35,price:55,qty:12,unit:'Box',lowLevel:5,desc:'Recently added — locked for 8h',size:'2x2cm',imgData:'',createdAt:ts-3600000,updatedAt:ts-3600000,status:'active'},
    ],nextProdId:6,
    sales:[
      {id:1,inv:'INV-0001',date:today(),customer:'James Owens',contact:'555-1001',items:[{prodId:1,name:'Ceramic Floor Tile 60x60 Grey',qty:3,unitPrice:28.50,cost:18}],discount:0,paid:85.50,paymode:'Cash',createdAt:ts-3600000,updatedAt:ts-3600000,status:'active',editLog:[]},
      {id:2,inv:'INV-0002',date:today(),customer:'Sara Lee',contact:'555-1002',items:[{prodId:3,name:'Portland Cement 50kg',qty:5,unitPrice:13,cost:8.5}],discount:10,paid:0,paymode:'Credit',createdAt:ts-1800000,updatedAt:ts-1800000,status:'active',editLog:[]},
    ],nextSaleId:3,
    expenses:[
      {id:1,date:today(),amount:25.00,description:'Fuel for delivery run',category:'Transport',by:'admin',createdAt:ts-7200000,updatedAt:ts-7200000,status:'active',editLog:[]},
      {id:2,date:today(),amount:15.50,description:'Office supplies',category:'Supplies',by:'admin',createdAt:ts-3600000,updatedAt:ts-3600000,status:'active',editLog:[]},
    ],nextExpId:3,
    employees:[{id:1,name:'Maria Santos',role:'Cashier',phone:'555-2001',monthlySalary:800,type:'Employee',startDate:'2024-01-01',createdAt:ts},{id:2,name:'John Doe',role:'Warehouse',phone:'555-2002',monthlySalary:600,type:'Employee',startDate:'2024-01-01',createdAt:ts}],nextEmpId:3,
    salaryRecords:[{id:1,empId:1,month:thisMonth(),baseSalary:800,deductions:[],paid:false,paidDate:null,createdAt:ts},{id:2,empId:2,month:thisMonth(),baseSalary:600,deductions:[{date:today(),amount:50,reason:'Absence',type:'Absence',addedBy:'admin'}],paid:false,paidDate:null,createdAt:ts}],nextSalId:3,
    stockHistory:[{id:1,date:today(),type:'IN',prodName:'Ceramic Floor Tile 60x60 Grey',qty:20,by:'admin',ref:'PO-001',notes:'Initial stock',ts:ts-86400000}],nextHistId:2,purchases:[],stockOuts:[],
    credits:[{id:1,name:'Sara Lee',ref:'INV-0002',date:today(),totalOwed:55,totalPaid:0,paymode:'Credit',status:'OPEN',payments:[],contact:'555-1002'}],nextSoId:1,nextCrId:2};
  DB.businesses=[b];
  DB.users=[];  // No default accounts — each installation creates its own via signup
  DB.nextUserId=3;dbSave();
}

// ── TOAST ──
function toast(msg,type='ok'){el('tico').textContent=type==='ok'?'✓':type==='gd'?'★':type==='wa'?'⚠':'✕';el('tmsg').textContent=msg;const t=el('toast');t.className='show '+type;clearTimeout(toastTmr);toastTmr=setTimeout(()=>t.className='',3400);}

// ── CONFIRM ──
function showConf(ico,ttl,msg,fn){el('mico').textContent=ico;el('mttl').textContent=ttl;el('mmsg').textContent=msg;confFn=fn;el('mconf').classList.add('on');}
function closeModal(){el('mconf').classList.remove('on');el('m-adminpin').classList.remove('on');}
function runConf(){if(confFn)confFn();closeModal();}

// ── ADMIN PIN ──
function requireAdminPin(onSuccess,onCancel,message){
  pinCallback=onSuccess;pinCancelCb=onCancel;
  el('pin-msg').textContent=message||'Enter your admin password to proceed';
  sv('pin-input','');el('m-adminpin').classList.add('on');
  setTimeout(()=>el('pin-input')?.focus(),200);
}
async function verifyAdminPin(){
  var pw = el('pin-input') ? el('pin-input').value : '';
  var u  = (DB.users||[]).find(function(x){ return x.id === (CU && CU.id); });
  if (!u) { toast('User not found','er'); return; }
  if (!pw) { toast('Enter your password','er'); el('pin-input') && el('pin-input').focus(); return; }
  // Verify password correctly — supports both hashed and plain-text (migration)
  var ok = await verifyPassword(pw, u.password);
  if (!ok) {
    toast('Incorrect password','er');
    if(el('pin-input')){ el('pin-input').value=''; el('pin-input').focus(); }
    return;
  }
  el('m-adminpin').classList.remove('on');
  var cb = pinCallback;
  pinCallback = null; pinCancelCb = null;
  if (cb) cb();
}
function cancelAdminPin(){el('m-adminpin').classList.remove('on');if(pinCancelCb)pinCancelCb();pinCallback=null;pinCancelCb=null;}

// ── ADMIN LOG ──
function addAdminLog(action,detail,by){
  const b=biz();DB.adminLog.unshift({id:DB.nextLogId++,action,detail,bizId:b?b.id:CBI,by:by||CU?.name||'system',ts:Date.now()});
  if(DB.adminLog.length>500)DB.adminLog=DB.adminLog.slice(0,500);
}

// ── CHANGE REQUESTS ──
function submitChangeRequest(){
  if(!pendingCRProdId)return;const b=biz();const p=(b.products||[]).find(x=>x.id===pendingCRProdId);if(!p)return;
  const changes=gv('cr-changes'),urgency=el('cr-urgency')?.value||'normal';
  if(!changes){toast('Describe the changes needed','er');return;}
  if(!DB.changeRequests)DB.changeRequests=[];if(!DB.nextCRId)DB.nextCRId=1;
  DB.changeRequests.unshift({id:DB.nextCRId++,bizId:CBI,recordType:'product',recordId:p.id,prodId:p.id,prodName:p.name,label:p.name,action:'edit',requestedBy:CU?.name||'unknown',requestedById:CU?.id,changes,urgency,status:'pending',ts:Date.now(),resolvedBy:null,resolvedAt:null,originalData:JSON.parse(JSON.stringify(p))});
  addNotif('warn',`🔒 Change request from ${CU?.name} for "${p.name}"`);
  dbSave();closeD('d-changereq');toast('Change request submitted — Admin will review','wa');checkNotif();updateAdminBell();
}

// New: submit change request for Sales or Expenses (8-hour lock)
function openRecordChangeRequest(type,id,label){
  pendingRecCR={type,id,label};
  el('rec-cr-title').textContent=`Request Change: ${type}`;
  el('rec-cr-sub').textContent=`"${label}" — requires admin approval`;
  el('rec-cr-info').textContent=`This ${type.toLowerCase()} record was created more than ${RECORD_LOCK_HRS} hours ago. Edits and deletes require admin approval.`;
  sv('rec-cr-changes','');sv('rec-cr-action','edit');sv('rec-cr-urgency','normal');
  openD('d-rec-cr');
  setTimeout(()=>el('rec-cr-changes')?.focus(),300);
}
function submitRecordChangeRequest(){
  const{type,id,label}=pendingRecCR;if(!type||!id){toast('Error: no record selected','er');return;}
  const changes=gv('rec-cr-changes');if(!changes){toast('Describe the change needed','er');return;}
  const action=el('rec-cr-action')?.value||'edit';const urgency=el('rec-cr-urgency')?.value||'normal';
  const b=biz();
  // Get original data snapshot
  let originalData=null;
  if(type==='sale')originalData=JSON.parse(JSON.stringify((b.sales||[]).find(x=>x.id===id)||{}));
  else if(type==='expense')originalData=JSON.parse(JSON.stringify((b.expenses||[]).find(x=>x.id===id)||{}));
  if(!DB.changeRequests)DB.changeRequests=[];if(!DB.nextCRId)DB.nextCRId=1;
  DB.changeRequests.unshift({id:DB.nextCRId++,bizId:CBI,recordType:type,recordId:id,label,action,requestedBy:CU?.name||'unknown',requestedById:CU?.id,changes,urgency,status:'pending',ts:Date.now(),resolvedBy:null,resolvedAt:null,originalData});
  addNotif('warn',`⏳ ${type} change request from ${CU?.name}: "${label}"`);
  dbSave();closeD('d-rec-cr');toast(`Change request submitted for admin approval`,'wa');checkNotif();updateAdminBell();
}
function openAdminPanel(){
  if(!isAdmin()){toast('Admin access required','er');return;}
  switchAdminTab('requests');renderAdminRequests();openD('d-admin');
}
function switchAdminTab(tab){
  adminTabActive=tab;
  el('ap-tab-req').classList.toggle('on',tab==='requests');el('ap-tab-log').classList.toggle('on',tab==='log');
  el('admin-tab-requests').style.display=tab==='requests'?'':'none';el('admin-tab-log').style.display=tab==='log'?'':'none';
  if(tab==='requests')renderAdminRequests();else renderAdminLog();
}
function renderAdminRequests(){
  const reqs=(DB.changeRequests||[]).filter(r=>r.bizId===CBI).sort((a,b)=>b.ts-a.ts);
  const pending=reqs.filter(r=>r.status==='pending');
  const badge=el('req-count-badge');if(badge)badge.innerHTML=pending.length?`<span class="bdg ber0" style="margin-left:4px">${pending.length}</span>`:'';
  if(!reqs.length){el('admin-tab-requests').innerHTML=em('No change requests yet');return;}
  const typeIco={product:'🔒',sale:'🧾',expense:'💸'};
  const actionCls={edit:'bwa0',delete:'ber0'};
  el('admin-tab-requests').innerHTML=reqs.map(r=>{
    const ico=typeIco[r.recordType||'product']||'📋';
    const label=r.label||r.prodName||'Record';
    const actionLabel=(r.action||'edit').toUpperCase();
    return `<div class="req-card">
      <div class="req-header">
        <div>
          <div class="req-title">${ico} ${esc(label)}</div>
          <div class="req-meta">
            <span class="bdg ${actionCls[r.action]||'bwa0'}" style="font-size:9px;margin-right:4px">${actionLabel}</span>
            <span class="bdg bdf" style="font-size:9px;margin-right:4px">${(r.recordType||'product').toUpperCase()}</span>
            by ${esc(r.requestedBy)} · ${ago(r.ts)} ·
            <span class="bdg ${r.urgency==='critical'?'ber0':r.urgency==='high'?'bwa0':'bdf'}" style="font-size:9px">${r.urgency}</span>
          </div>
        </div>
        <span class="bdg ${r.status==='pending'?'bwa0':r.status==='approved'||r.status==='completed'?'bok0':'ber0'}">${r.status.toUpperCase()}</span>
      </div>
      <div class="req-changes"><strong>Request:</strong><br>${esc(r.changes)}</div>
      ${r.status==='pending'?`
        <div class="req-actions">
          <button type="button" class="btn bok bsm" onclick="approveAnyRequest(${r.id})">✓ Approve</button>
          <button type="button" class="btn ber bsm" onclick="rejectChangeRequest(${r.id})">✕ Reject</button>
          ${(r.recordType==='product'||!r.recordType)?`<button type="button" class="btn bin bsm" onclick="viewLockedProduct(${r.prodId||r.recordId})">View</button>`:''}
        </div>`:
        `<div style="font-size:12px;color:var(--t3);padding-top:4px">Resolved by ${esc(r.resolvedBy||'—')} ${r.resolvedAt?'· '+ago(r.resolvedAt):''}</div>`
      }
    </div>`;
  }).join('');
}
function approveChangeRequest(id){approveAnyRequest(id);}
function approveAnyRequest(id){
  const req=DB.changeRequests.find(r=>r.id===id);if(!req)return;
  requireAdminPin(()=>{
    const b=biz();const now=Date.now();
    req.status='approved';req.resolvedBy=CU.name;req.resolvedAt=now;
    const type=req.recordType||'product';
    if(type==='product'){
      const p=(b.products||[]).find(x=>x.id===(req.prodId||req.recordId));
      if(p){p.adminUnlocked=true;p.adminUnlockedBy=CU.name;p.adminUnlockedAt=now;}
      addAdminLog('approve_cr',`Approved product change: "${req.label||req.prodName}"`,CU.name);
      addNotif('info',`✓ Product change approved: "${req.label||req.prodName}"`);
      dbSave();renderAdminRequests();checkNotif();updateAdminBell();
      toast('Approved! Product unlocked.','ok');
      if(p)setTimeout(()=>openEditProd(p.id),400);
    } else if(type==='sale'){
      const s=(b.sales||[]).find(x=>x.id===req.recordId);
      if(s){s.adminUnlocked=true;s.adminUnlockedBy=CU.name;s.adminUnlockedAt=now;}
      if(req.action==='delete'&&s){
        b.sales=(b.sales||[]).filter(x=>x.id!==req.recordId);
        toast('Sale deleted per approved request');
      } else {
        toast('Sale unlocked — admin can now edit.','ok');
        if(s)setTimeout(()=>openEditSale(req.recordId),400);
      }
      addAdminLog('approve_cr',`Approved sale change: "${req.label}"`,CU.name);
      dbSave();renderAdminRequests();renderSales();renderDash();checkNotif();updateAdminBell();
    } else if(type==='expense'){
      const e=(b.expenses||[]).find(x=>x.id===req.recordId);
      if(e){e.adminUnlocked=true;e.adminUnlockedBy=CU.name;e.adminUnlockedAt=now;}
      if(req.action==='delete'&&e){
        b.expenses=(b.expenses||[]).filter(x=>x.id!==req.recordId);
        toast('Expense deleted per approved request');
      } else {
        toast('Expense unlocked — admin can now edit.','ok');
        if(e)setTimeout(()=>openEditExp(req.recordId),400);
      }
      addAdminLog('approve_cr',`Approved expense change: "${req.label}"`,CU.name);
      dbSave();renderAdminRequests();renderExpenses();renderDash();checkNotif();updateAdminBell();
    }
  },null,'Confirm approval — enter admin password');
}
function rejectChangeRequest(id){
  const req=DB.changeRequests.find(r=>r.id===id);if(!req)return;
  showConf('✕','Reject Request?',`Reject change request for "${req.prodName}"?`,()=>{
    req.status='rejected';req.resolvedBy=CU.name;req.resolvedAt=Date.now();
    addAdminLog('reject_cr',`Rejected change request for "${req.prodName}"`,CU.name);
    dbSave();renderAdminRequests();updateAdminBell();toast('Request rejected');
  });
}
function viewLockedProduct(prodId){closeD('d-admin');setTimeout(()=>openEditProd(prodId),300);}
function renderAdminLog(){
  const logs=(DB.adminLog||[]).filter(l=>l.bizId===CBI).slice(0,100);
  if(!logs.length){el('admin-tab-log').innerHTML=em('No admin actions logged yet');return;}
  el('admin-tab-log').innerHTML='<div class="card" style="border-radius:0;border:none">'+logs.map(l=>`<div class="admin-log-item"><div class="ali-dot" style="background:var(--g)"></div><div class="ali-msg">${esc(l.detail)}<br><span style="font-size:10px;color:var(--t3)">by ${esc(l.by)}</span></div><div class="ali-time">${ago(l.ts)}</div></div>`).join('')+'</div>';
}
function updateAdminBell(){
  const pending=(DB.changeRequests||[]).filter(r=>r.bizId===CBI&&r.status==='pending').length;
  const dot=el('req-dot');if(dot)dot.style.display=pending>0?'block':'none';
  const badge=el('admin-req-badge');if(badge){badge.innerHTML=pending>0?`<span class="bdg ber0">${pending}</span>`:'';badge.style.display=pending>0?'':'none';}
  // Update nav badge on expenses if there are pending expense requests
  const expPend=(DB.changeRequests||[]).filter(r=>r.bizId===CBI&&r.status==='pending'&&r.recordType==='expense').length;
  const salPend=(DB.changeRequests||[]).filter(r=>r.bizId===CBI&&r.status==='pending'&&r.recordType==='sale').length;
  // Show pending count in More tools
  const moreReqBadge=el('admin-req-badge');
  if(moreReqBadge){moreReqBadge.textContent=pending>0?pending:'';moreReqBadge.style.display=pending>0?'':'none';}
}

// ── DRAWER ──
function closeAllDrawers(){
  document.querySelectorAll('.dov.on').forEach(function(d){
    d.classList.remove('on');
  });
}
function openD(id){
  // Close any open drawer first to prevent overlap
  document.querySelectorAll('.dov.on').forEach(function(d){
    if(d.id !== id) d.classList.remove('on');
  });
  var el2=document.getElementById(id);
  if(el2) el2.classList.add('on');
}
function closeD(id){
  var el2=document.getElementById(id);
  if(el2) el2.classList.remove('on');
}

// ── LOGIN ──

// ════════════════════════════════════════════════════════
//  AUTH MODULE — Google + Form Sign-In/Sign-Up
// ════════════════════════════════════════════════════════

// ── Show/hide panels ──
function showLogin() {
  var l = document.getElementById('lsec');
  var r = document.getElementById('rsec');
  var t1 = document.getElementById('tab-signin');
  var t2 = document.getElementById('tab-signup');
  if (l) l.style.display = 'block';
  if (r) r.style.display = 'none';
  if (t1) { t1.style.background = 'linear-gradient(135deg,#D4A520,#A07810)'; t1.style.color = '#060810'; }
  if (t2) { t2.style.background = 'transparent'; t2.style.color = '#505A72'; }
}

function showReg() {
  var lsec = document.getElementById('lsec');
  var rsec = document.getElementById('rsec');
  var lt   = document.getElementById('tab-signin');
  var rt   = document.getElementById('tab-signup');
  if (lsec) lsec.style.display = 'none';
  if (rsec) rsec.style.display = '';
  if (lt) { lt.style.background = 'transparent'; lt.style.color = '#505A72'; }
  if (rt) { rt.style.background = 'linear-gradient(135deg,#D4A520,#A07810)'; rt.style.color = '#060810'; }
  // Always reset to role-selection step
  var s1 = document.getElementById('reg-step1');
  var so = document.getElementById('reg-step-owner');
  var ss = document.getElementById('reg-step-staff');
  var sp = document.getElementById('reg-step-pending');
  if (s1) s1.style.display = '';
  if (so) so.style.display = 'none';
  if (ss) ss.style.display = 'none';
  if (sp) sp.style.display = 'none';
  // Clear errors
  var e1 = document.getElementById('register-err');
  var e2 = document.getElementById('staff-register-err');
  if (e1) e1.style.display = 'none';
  if (e2) e2.style.display = 'none';
}

function togglePwVis(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var hidden = inp.type === 'password';
  inp.type = hidden ? 'text' : 'password';
  btn.innerHTML = hidden ? '&#128064;' : '&#128065;';
}

// ── Form Sign In ──
function loginErr(msg) {
  // Show error on login page (works even when shell is hidden)
  var errEl = document.getElementById('login-err');
  var regErr = document.getElementById('register-err');
  if (errEl)  { errEl.textContent = msg;  errEl.style.display  = ''; }
  if (regErr) { regErr.textContent = msg; regErr.style.display = ''; }
  // Also try toast
  try { toast(msg, 'er'); } catch(e) {}
}

async function doLogin() {
  var errEl = document.getElementById('login-err');
  if (errEl) errEl.style.display = 'none';

  try {
    var uEl = document.getElementById('lu');
    var pEl = document.getElementById('lp');
    var u   = uEl ? uEl.value.trim() : '';
    var p   = pEl ? pEl.value : '';

    if (!u) { loginErr('Please enter your username or email'); return; }
    if (!p) { loginErr('Please enter your password'); return; }

    if (!DB || !DB.users || DB.users.length === 0) {
      loginErr('Syncing data… please wait a moment and try again.');
      setTimeout(function() { try { dbLoad(); } catch(e2) {} }, 500);
      return;
    }

    // ── RATE LIMIT CHECK ──
    var lockUntil = isAccountLocked(u);
    if (lockUntil) {
      loginErr('🔒 Account locked — too many failed attempts. Try again in ' + getRemainingLockout(lockUntil));
      // Update countdown every second
      if (window._lockTimer) clearInterval(window._lockTimer);
      window._lockTimer = setInterval(function(){
        var lu2 = isAccountLocked(u);
        if (lu2) {
          loginErr('🔒 Account locked. Try again in ' + getRemainingLockout(lu2));
        } else {
          clearInterval(window._lockTimer);
          var errEl2 = document.getElementById('login-err');
          if (errEl2) errEl2.style.display = 'none';
        }
      }, 1000);
      return;
    }

    // ── FIND USER by username OR email (case-insensitive) ──
    var matchedUser = null;
    var isEmailLogin = u.includes('@');
    for (var i = 0; i < DB.users.length; i++) {
      var usr = DB.users[i];
      var usernameMatch = usr.username && usr.username.toLowerCase() === u.toLowerCase();
      var emailMatch    = isEmailLogin && usr.email && usr.email.toLowerCase() === u.toLowerCase();
      if (usernameMatch || emailMatch) {
        var ok = await verifyPassword(p, usr.password);
        if (ok) { matchedUser = usr; break; }
      }
    }

    if (!matchedUser) {
      var failCount = recordFailedAttempt(u);
      var attemptsLeft = MAX_ATTEMPTS - failCount;
      if (attemptsLeft <= 0) {
        loginErr('🔒 Account locked for 15 minutes after too many failed attempts.');
      } else if (attemptsLeft <= 2) {
        loginErr('Wrong username or password. ' + attemptsLeft + ' attempt' + (attemptsLeft===1?'':'s') + ' remaining before lockout.');
      } else {
        loginErr('Wrong username or password.');
      }
      return;
    }

    if (matchedUser.status === 'pending') {
      loginErr('Your account is pending admin approval. Please wait.');
      return;
    }
    if (matchedUser.status === 'rejected') {
      loginErr('Your account access was rejected. Contact your admin.');
      return;
    }
    if (matchedUser.status === 'inactive') {
      loginErr('🚫 Your account has been deactivated. Contact your admin to reactivate it.');
      return;
    }

    // ── EMAIL VERIFICATION CHECK ──
    // If logging in with email, Firebase Auth must verify it first
    // SKIP this check on local files (content:// or file://) — Firebase doesn't work locally
    var isLocalFile = window._isLocalFile ||
      window.location.protocol === 'file:' ||
      window.location.href.indexOf('content://') === 0;

    // ALL users with email must be verified (not just email-login users)
    if (matchedUser.email && !isLocalFile && FB_AUTH) {
      try {
        var fbCred = await FB_AUTH.signInWithEmailAndPassword(matchedUser.email, p);
        if (fbCred && fbCred.user && !fbCred.user.emailVerified) {
          var _as = { url: 'https://smartstock-pro.netlify.app?verified=1', handleCodeInApp: false };
          try { await fbCred.user.sendEmailVerification(_as); } catch(e){}
          try { FB_AUTH.signOut(); } catch(e){}
          loginErr('📧 Email not verified. A new verification link has been sent to ' + matchedUser.email + '. Check your inbox and spam folder, then sign in again.');
          return;
        }
      } catch(fbErr) {
        if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-login-credentials') {
          fbAuthSignIn(matchedUser.email, p).catch(function(){});
        } else if (fbErr.code === 'auth/user-not-found') {
          fbAuthCreateUser(matchedUser.email, p).catch(function(){});
        } else {
          console.warn('[Firebase Auth] Verification check:', fbErr.code);
        }
      }
    } else if (!matchedUser.email && !isLocalFile) {
      loginErr('📧 Your account needs a verified email. Please contact your admin to add an email to your account.');
      return;
    }

    // ── SUCCESS — clear failed attempts, upgrade hash if needed ──
    clearFailedAttempts(u);
    await upgradePasswordIfNeeded(matchedUser, p);
    loginAs(matchedUser);
    resetSessionTimer();
    // Sync Firebase Auth session
    if (matchedUser.email && !isEmailLogin) {
      // Username login — sign into Firebase Auth silently
      fbAuthSignIn(matchedUser.email, p).catch(function(){});
    }

  } catch(e) {
    loginErr('Login error: ' + e.message);
    console.error('[Login]', e);
  }
}

// ── Form Register (no invite code — open signup) ──
async function doRegister() {
  try {
    // OWNER PATH — creates new business + Primary Admin
    var bizName = gv('reg-biz-name');
    var name    = gv('rn');
    var email   = gv('reg-email');
    var dob     = gv('reg-dob');
    var location= gv('reg-location');
    var un      = gv('ru');
    var pEl     = document.getElementById('rp');
    var pw      = pEl ? pEl.value : '';

    if (!bizName) { regErrOwner('Business name is required'); return; }
    if (!name)    { regErrOwner('Your full name is required'); return; }
    if (!email)   { regErrOwner('Email is required'); return; }
    if (!isValidEmail(email)) { regErrOwner('Please enter a valid email address'); return; }
    if (!dob)     { regErrOwner('Date of birth is required'); return; }
    if (!isAdult(dob)) { regErrOwner('You must be at least 13 years old'); return; }
    if (!location){ regErrOwner('Location is required'); return; }
    if (!un)      { regErrOwner('Username is required'); return; }
    if (!isValidUsername(un)) { regErrOwner('Username: 3-20 letters, numbers or underscores'); return; }
    if (!pw || pw.length < 6) { regErrOwner('Password must be at least 6 characters'); return; }
    // Block common weak passwords
    var WEAK_PWS = ['123456','111111','000000','123123','password','654321','112233','1234567','12345678'];
    if (WEAK_PWS.indexOf(pw) !== -1 || /^(.)+$/.test(pw)) {
      regErrOwner('Password is too weak — avoid repeated digits or obvious patterns'); return;
    }

    // Check email not already used
    var emailLower = email.toLowerCase().trim();
    for (var ei = 0; ei < DB.users.length; ei++) {
      if ((DB.users[ei].email || '').toLowerCase() === emailLower) {
        regErrOwner(
          'That email is already registered. ' +
          'If you forgot your password, use the "Forgot password?" link on the Sign In screen. ' +
          'Or use a different email to create a new account.'
        );
        return;
      }
    }

    // Check business name not taken (case-insensitive)
    var bizNameLower = bizName.toLowerCase().trim();
    for (var bi = 0; bi < (DB.businesses || []).length; bi++) {
      if ((DB.businesses[bi].name || '').toLowerCase().trim() === bizNameLower) {
        regErrOwner('That business name is already registered. Try a different name.');
        return;
      }
    }

    // Check username not taken
    for (var i = 0; i < DB.users.length; i++) {
      if ((DB.users[i].username || '').toLowerCase() === un.toLowerCase()) {
        regErrOwner('Username already taken — try another');
        return;
      }
    }

    // Create new business
    var newBizId = DB.nextBizId || ((DB.businesses || []).length + 1);
    DB.nextBizId = newBizId + 1;
    var newBiz = {
      id:        newBizId,
      name:      bizName.trim(),
      currency:  'USD',
      address:   '',
      phone:     '',
      logoType:  'initials',
      logoData:  '',
      products:  [],
      sales:     [],
      expenses:  [],
      customers: [],
      credits:   [],
      stockMoves:[],
      salaries:  [],
      docExpenses:[],
      customHolidays:[],
      country: 'Liberia',
      nextProdId:1, nextSaleId:1, nextExpId:1, nextCustId:1,
      nextCreditId:1, nextStockId:1, nextSalId:1, nextDocId:1,
      createdAt: Date.now()
    };
    (DB.businesses = DB.businesses || []).push(newBiz);

    // Create Primary Admin user for this business
    var recoveryCode = generateRecoveryCode();
    var _ownerPw = pw;
    try { _ownerPw = await hashPassword(pw); } catch(e) { _ownerPw = pw; }
    var newUser = {
      id:             DB.nextUserId++,
      username:       un,
      password:       _ownerPw,
      name:           name,
      email:          email.toLowerCase().trim(),
      dob:            dob,
      location:       location.trim(),
      role:           'primaryAdmin',
      status:         'active',
      businessIds:    [newBizId],
      allowedModules: (typeof MODS !== 'undefined' ? MODS : ['products','sales','stock','expenses','customers','salary','reports']),
      phone:          '',
      recoveryCode:   recoveryCode,
      usernameChangedAt: 0,
      profileComplete:   true,
      createdAt:      Date.now(),
      signupMethod:   'form-owner'
    };
    // ── FINAL VALIDATION before saving to Firebase ──
    if (!newUser.username || !newUser.password || !newUser.email) {
      regErrOwner('Internal error: user data incomplete. Please try again.');
      return;
    }
    if (newUser.password.length < 10) {
      // Hashed password should be much longer (sha256: + 64 hex chars)
      regErrOwner('Password not properly hashed. Please try again.');
      return;
    }
    if (!newUser.email.includes('@') || !newUser.email.includes('.')) {
      regErrOwner('Invalid email format. Please check and try again.');
      return;
    }

    DB.users.push(newUser);
    DB.currentBizId = newBizId;
    dbSave();
    if (typeof fbPush === 'function') try { fbPush(); } catch(e){}
    // Create Firebase Auth account + send verification email
    if (typeof fbAuthCreateUser === 'function' && newUser.email) {
      fbAuthCreateUser(newUser.email, pw)
        .then(function(cred) {
          if (cred && cred.user) {
            console.log('[Signup] Firebase Auth account ready for:', newUser.email);
          }
        })
        .catch(function(err) {
          console.warn('[Signup] Firebase Auth creation failed:', err);
        });
    }

    // Show recovery code BEFORE logging in so user sees it
    var rcEl = document.getElementById('recovery-code-display');
    if (rcEl) rcEl.textContent = recoveryCode;
    openD('d-recovery-code');

    // After user dismisses recovery code dialog, log them in
    window._pendingLoginUser = newUser;
    window._pendingBizName   = bizName;
    // Show congrats + email verification screen when recovery code is dismissed
    // Hook into the drawer close event for d-recovery-code
    var _onRcClose = function() {
      document.removeEventListener('d-recovery-code-closed', _onRcClose);
      var pendUser = window._pendingLoginUser;
      var pendBiz  = window._pendingBizName;
      window._pendingLoginUser = null;
      window._pendingBizName   = null;
      if (pendUser && typeof showCongratsScreen === 'function') {
        showCongratsScreen(pendUser, pendBiz);
      } else if (pendUser) {
        loginAs(pendUser);
        resetSessionTimer();
        toast('🎉 Welcome to SmartStock Pro!', 'gd');
      }
    };
    document.addEventListener('d-recovery-code-closed', _onRcClose, { once: true });
  } catch(e) {
    regErrOwner('Registration error: ' + e.message);
  }
}

async function doStaffRegister() {
  try {
    // STAFF PATH — joins existing business, status=pending until admin approves
    var bizName = gv('staff-biz-name');
    var name    = gv('staff-name');
    var email   = gv('staff-email');
    var dob     = gv('staff-dob');
    var location= gv('staff-location');
    var un      = gv('staff-username');
    var pEl     = document.getElementById('staff-password');
    var pw      = pEl ? pEl.value : '';

    if (!bizName) { regErrStaff('Business name is required'); return; }
    if (!name)    { regErrStaff('Your full name is required'); return; }
    if (!email)   { regErrStaff('Email is required'); return; }
    if (!isValidEmail(email)) { regErrStaff('Please enter a valid email address'); return; }
    if (!dob)     { regErrStaff('Date of birth is required'); return; }
    if (!isAdult(dob)) { regErrStaff('You must be at least 13 years old'); return; }
    if (!location){ regErrStaff('Location is required'); return; }
    if (!un)      { regErrStaff('Username is required'); return; }
    if (!isValidUsername(un)) { regErrStaff('Username: 3-20 letters, numbers or underscores'); return; }
    if (!pw || pw.length < 6) { regErrStaff('Password must be at least 6 characters'); return; }
    var WEAK_PW_STAFF = ['123456','111111','000000','123123','password','654321','112233','1234567','12345678'];
    if (WEAK_PW_STAFF.indexOf(pw) !== -1) {
      regErrStaff('Password is too weak — avoid common patterns like 123456 or 111111'); return;
    }

    // Check email not already used
    var emailLower = email.toLowerCase().trim();
    for (var ei2 = 0; ei2 < DB.users.length; ei2++) {
      if ((DB.users[ei2].email || '').toLowerCase() === emailLower) {
        regErrStaff('That email is already registered. Try Sign In, or use a different email.');
        return;
      }
    }

    // Find business by exact name (case-insensitive)
    var bizNameLower = bizName.toLowerCase().trim();
    var matchedBiz = null;
    for (var bi = 0; bi < (DB.businesses || []).length; bi++) {
      if ((DB.businesses[bi].name || '').toLowerCase().trim() === bizNameLower) {
        matchedBiz = DB.businesses[bi];
        break;
      }
    }
    if (!matchedBiz) {
      regErrStaff('Business "' + bizName + '" not found. Check the exact name with your admin.');
      return;
    }

    // Check username not taken
    for (var i = 0; i < DB.users.length; i++) {
      if ((DB.users[i].username || '').toLowerCase() === un.toLowerCase()) {
        // Allow if it's a previously rejected pending user re-trying
        if (DB.users[i].status === 'pending' && DB.users[i].name === name) {
          // Update existing pending request
          DB.users[i].password   = pw;
          DB.users[i].email      = email.toLowerCase().trim();
          DB.users[i].dob        = dob;
          DB.users[i].location   = location.trim();
          DB.users[i].businessIds= [matchedBiz.id];
          DB.users[i].rejectedAt = null;
          DB.users[i].profileComplete = true;
          DB.users[i].createdAt  = Date.now();
          dbSave();
          notifyAdminsOfSignup(matchedBiz, DB.users[i]);
          showPendingScreen(matchedBiz.name);
          return;
        }
        regErrStaff('Username already taken — try another');
        return;
      }
    }

    // Create pending staff account
    var newUser = {
      id:             DB.nextUserId++,
      username:       un,
      password:       await (async function(){ try{ return await hashPassword(pw); }catch(e){ return pw; } })(),
      name:           name,
      email:          email.toLowerCase().trim(),
      dob:            dob,
      location:       location.trim(),
      role:           'dataOperator',
      status:         'pending',
      businessIds:    [matchedBiz.id],
      allowedModules: ['products','sales','stock','expenses','customers'],
      phone:          '',
      usernameChangedAt: 0,
      profileComplete:   true,
      createdAt:      Date.now(),
      signupMethod:   'form-staff'
    };
    // ── FINAL VALIDATION before saving to Firebase ──
    if (!newUser.username || !newUser.password || !newUser.email) {
      regErrStaff('Internal error: user data incomplete. Please try again.');
      return;
    }
    if (newUser.password.length < 10) {
      regErrStaff('Password not properly hashed. Please try again.');
      return;
    }
    if (!newUser.email.includes('@') || !newUser.email.includes('.')) {
      regErrStaff('Invalid email format. Please check and try again.');
      return;
    }

    DB.users.push(newUser);
    dbSave();

    // Create Firebase Auth account + send verification email
    if (typeof fbAuthCreateUser === 'function' && newUser.email) {
      fbAuthCreateUser(newUser.email, pw)
        .then(function(cred) {
          if (cred && cred.user) {
            console.log('[Staff Signup] Firebase Auth account ready for:', newUser.email);
          }
        })
        .catch(function(err) {
          console.warn('[Staff Signup] Firebase Auth creation failed:', err);
        });
    }

    // Notify all admins of this business
    notifyAdminsOfSignup(matchedBiz, newUser);

    // Show pending screen
    showPendingScreen(matchedBiz.name);
    toast('Request sent! Waiting for admin approval.', 'gd');
  } catch(e) {
    regErrStaff('Registration error: ' + e.message);
  }
}

function notifyAdminsOfSignup(biz, user) {
  if (!biz || !user) return;
  DB.notifications = DB.notifications || [];
  if (typeof DB.nextNotifId !== 'number' || isNaN(DB.nextNotifId)) DB.nextNotifId = 1;

  // Add ONE business-wide notification (so all admins see it on opening the bell)
  DB.notifications.unshift({
    id:        DB.nextNotifId++,
    type:      'user_signup',
    msg:       '👤 ' + user.name + ' (@' + user.username + ') wants to join as staff. Approve in More → Team Management.',
    pendingUserId: user.id,
    bizId:     biz.id,
    read:      false,
    ts:        Date.now()
  });
  dbSave();
  // Push to Firebase so admins on other devices see it immediately
  if (typeof fbPush === 'function') {
    try { fbPush(); } catch(e) {}
  }
  // Update the bell dot if admin is currently viewing
  if (typeof checkNotif === 'function') {
    try { checkNotif(); } catch(e) {}
  }
}

function showPendingScreen(bizName) {
  document.getElementById('reg-step1').style.display       = 'none';
  document.getElementById('reg-step-owner').style.display  = 'none';
  document.getElementById('reg-step-staff').style.display  = 'none';
  var pendEl = document.getElementById('reg-step-pending');
  if (pendEl) pendEl.style.display = '';
  var bizEl  = document.getElementById('pending-biz');
  if (bizEl) bizEl.textContent = bizName;
}

function selectRole(role) {
  document.getElementById('reg-step1').style.display = 'none';
  if (role === 'owner') {
    document.getElementById('reg-step-owner').style.display = '';
    setTimeout(function(){
      var f = document.getElementById('reg-biz-name');
      if (f) f.focus();
    }, 150);
  } else if (role === 'staff') {
    document.getElementById('reg-step-staff').style.display = '';
    setTimeout(function(){
      var f = document.getElementById('staff-biz-name');
      if (f) f.focus();
    }, 150);
  }
}

function backToStep1() {
  document.getElementById('reg-step-owner').style.display   = 'none';
  document.getElementById('reg-step-staff').style.display   = 'none';
  document.getElementById('reg-step-pending').style.display = 'none';
  document.getElementById('reg-step1').style.display = '';
}

function regErrOwner(msg) {
  var e = document.getElementById('register-err');
  if (e) { e.textContent = msg; e.style.display = ''; }
  if (typeof toast === 'function') toast(msg, 'er');
}
function regErrStaff(msg) {
  var e = document.getElementById('staff-register-err');
  if (e) { e.textContent = msg; e.style.display = ''; }
  if (typeof toast === 'function') toast(msg, 'er');
}

function loginAs(user) {
  try {
    CU = user;
    // ── PERSIST SESSION — stay logged in until manual sign out ──
    try { localStorage.setItem('ss_session', JSON.stringify({uid: user.id, ts: Date.now()})); } catch(e){}
    // ── SET ENCRYPTION KEY (derived from password) ──
    try {
      if (typeof setEncryptionKey === 'function' && user.password) {
        setEncryptionKey(user.password);
      }
    } catch(e){}
    // Apply permission-based CSS classes
    setTimeout(function(){ try { if (typeof applySalesPermStyles === 'function') applySalesPermStyles(); } catch(e){} }, 100);
    // Load permissions from DB (in case they changed since last login)
    try {
      if (typeof defaultPermsFor === 'function' && typeof PERM_KEYS !== 'undefined') {
        var freshUser = (DB.users || []).find(function(x){ return x.id === user.id; });
        if (freshUser) {
          if (!freshUser.perms) freshUser.perms = defaultPermsFor(freshUser.role);
          PERM_KEYS.forEach(function(k){
            if (typeof freshUser.perms[k] === 'undefined') freshUser.perms[k] = defaultPermsFor(freshUser.role)[k];
          });
          CU.perms = freshUser.perms;
        }
      }
    } catch(e) { console.warn('[loginAs] perms load:', e); }
    // Profile-complete gate: forces existing users to fill missing fields
    try { if (typeof checkProfileComplete === 'function') setTimeout(checkProfileComplete, 1000); } catch(e){}
    // Auto-connect to Firebase if config exists but not connected
    try {
      if (typeof FB_DB === 'undefined' || !FB_DB) {
        if (typeof fbInit === 'function') fbInit();
      } else if (typeof fbPush === 'function') {
        // Connected - push our local state to make sure server has latest
        setTimeout(function(){ try { fbPush(); } catch(e){} }, 800);
      }
    } catch(e) { console.warn('[Login] Firebase auto-connect:', e); }
    var bids  = user.businessIds || [];
    var found = false;
    for (var i = 0; i < bids.length; i++) {
      if (bids[i] === DB.currentBizId) { found = true; break; }
    }
    CBI = found ? DB.currentBizId : (bids[0] || 1);
    DB.currentBizId = CBI;

    var loginEl = document.getElementById('login');
    var shellEl = document.getElementById('shell');
    if (loginEl) loginEl.style.display = 'none';
    if (shellEl) shellEl.style.display = 'flex';

    // Set avatar — use Google photo or initials
    var uavEl = document.getElementById('uav');
    if (uavEl) {
      if (user.photoURL) {
        uavEl.innerHTML = '<img src="' + user.photoURL + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      } else {
        uavEl.textContent = mkInit(user.name);
      }
    }
    sv('suname', user.name);
    sv('surole', RLBL[user.role] || user.role);
    updateTopbar();
    updateAdminUI();
    checkNotif();
    updateAdminBell();
    // ── Restore to last visited page (not always 'dash') ──
    var _lastPage = 'dash';
    try {
      var _saved = localStorage.getItem('ss_last_page');
      var _validPages = ['dash','sales','products','customers','expenses',
                         'reports','gallery','salary','docexp','calc','chat'];
      if (_saved && _validPages.indexOf(_saved) !== -1) {
        _lastPage = _saved;
      }
    } catch(e){}
    goTo(_lastPage);
    // Start render guard — retries page render until Firebase data loads
    try { startRenderGuard(); } catch(e) {}
    // Start session timeout timer
    try { if(typeof resetSessionTimer === 'function') resetSessionTimer(); } catch(e){}
    // Start PIN lock timer (only if user has a PIN set)
    try { if(typeof startPinTimer === 'function') startPinTimer(); } catch(e){}
    // Check document expirations + show warnings
    try { if(typeof checkDocExpirations === 'function') checkDocExpirations(); } catch(e){}
  } catch(e) {
    alert('Error loading app: ' + e.message + '\nPlease reload.');
  }
}

// ── doLogout — also sign out of Google ──
function doLogout() {
  // Stop session timeout timer
  try { if(typeof stopSessionTimer === 'function') stopSessionTimer(); } catch(e){}
  // Clear encryption key on logout
  try { if(typeof clearEncryptionKey === 'function') clearEncryptionKey(); } catch(e){}
  // Sign out of Firebase Auth
  try { if(typeof fbAuthSignOut === 'function') fbAuthSignOut(); } catch(e){}
  CU = null;
  // ── CLEAR PERSISTED SESSION + PAGE ──
  try { localStorage.removeItem('ss_session'); } catch(e){}
  try { localStorage.removeItem('ss_last_page'); } catch(e){}
  var loginEl = document.getElementById('login');
  var shellEl = document.getElementById('shell');
  var sp = document.getElementById('splash-restore');
  if (loginEl) loginEl.style.display = 'flex';
  if (shellEl) shellEl.style.display = 'none';
  if (sp) sp.style.display = 'none';
  var lp = document.getElementById('lp');
  if (lp) lp.value = '';
  showLogin();
}




// ── TOPBAR ──
function updateTopbar(){
  const b=biz();if(!b)return;el('tbn').textContent=b.name;el('tbs').textContent=DB.businesses.length>1?'Tap to switch':'Tap for settings';
  const init=mkInit(b.name),hasImg=b.logoType==='image'&&b.logoData;
  ['tbl','ll'].forEach(id=>{const e=el(id);if(!e)return;e.innerHTML=hasImg?`<img src="${b.logoData}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`:init;});
  const lt=el('lbt');if(lt)lt.textContent=b.name;
}
function updateAdminUI(){
  const a=isAdmin();
  // Guard every el() lookup — some elements have been removed since this was written
  const adminlbl=el('adminlbl');   if(adminlbl)   adminlbl.style.display=a?'':'none';
  const admintools=el('admintools'); if(admintools) admintools.style.display=a?'':'none';
  const adminbell=el('admin-bell'); if(adminbell) adminbell.style.display=a?'':'none';
  if(el('pfab'))el('pfab').style.display=canAccess('products')?'':'none';
  if(el('sfab'))el('sfab').style.display=canAccess('sales')?'':'none';
  if(el('addempbtn'))el('addempbtn').style.display=a?'':'none';
  if(el('addbtn'))el('addbtn').style.display=a?'':'none';
  if(el('mpaybtn'))el('mpaybtn').style.display=a?'':'none';
}

// ── NOTIFICATIONS ──
function addAdminLogAlias(type,detail,by){addAdminLog(type,detail,by);}
function addNotif(type,msg){const b=biz();DB.notifications.unshift({id:DB.nextNotifId++,type,msg,read:false,bizId:b?b.id:CBI,ts:Date.now()});checkNotif();}
function checkNotif(){
  const b=biz();if(!b)return;
  if(!DB.notifications) DB.notifications=[];
  const unread=DB.notifications.filter(n=>!n.read&&n.bizId===b.id).length;
  const dot=el('ndot');if(dot)dot.style.display=unread>0?'block':'none';
  // Update sidebar menu dot too (pending signups + change requests)
  try {
    if(typeof isAdmin === 'function' && isAdmin()){
      var pending = 0;
      if(typeof getPendingSignups === 'function') pending += getPendingSignups().length;
      pending += (DB.changeRequests || []).filter(function(r){
        return r.bizId === CBI && r.status === 'pending';
      }).length;
      var md = document.getElementById('menu-dot');
      if(md) md.style.display = pending > 0 ? '' : 'none';
    }
  } catch(e){}
}
function openNotif(){
  const b=biz();if(!b)return;DB.notifications.filter(n=>n.bizId===b.id).forEach(n=>n.read=true);dbSave();checkNotif();
  const notifs=DB.notifications.filter(n=>n.bizId===b.id).slice(0,30);
  const tc={info:'var(--in)',warn:'var(--wa)',product:'var(--g)',sale:'var(--ok)',user:'var(--pu)',expense:'var(--er)'};
  let h=`<div style="padding:10px 13px;border-bottom:1px solid var(--bd)"><div class="sh" style="margin-bottom:8px">Alerts</div>`;
  h+=notifs.length?notifs.map(n=>`<div class="aitem"><div class="adot" style="background:${tc[n.type]||'var(--t2)'}"></div><div class="amsg">${esc(n.msg)}</div><div class="atime">${ago(n.ts)}</div></div>`).join(''):`<div style="padding:8px 0;font-size:12px;color:var(--t3)">No alerts</div>`;h+=`</div>`;
  el('notifbody').innerHTML=h;el('notifsub').textContent=notifs.length+' alerts';openD('d-notif');
}

// ── NAVIGATION (Back to Home always available) ──
function goTo(p){
  ['dash','sales','products','customers','expenses','reports','gallery','salary','docexp','more','calc','chat'].forEach(x=>{el('pg-'+x)?.classList.toggle('on',x===p);el('bn-'+x)?.classList.toggle('on',x===p);});
  if(p==='dash')renderDash();if(p==='sales'){fillSalesSummary();renderSales();}if(p==='products')renderProducts();
  if(p==='customers')renderCustomers();if(p==='reports'){fillFinMonths();renderFinReports();}
  if(p==='expenses'){fillExpSummary();renderExpenses();}if(p==='gallery')renderGallery();
  if(p==='salary'){fillSalMonths();renderSalary();}
  if(p==='chat'){try{renderGroupChat();}catch(e){}}if(p==='docexp'){renderDocExp();}if(p==='calc')initCalc();
  if(p==='chat'){ if(typeof renderChat === 'function') renderChat(); }
  el('pc')&&(el('pc').scrollTop=0);
  // ── Remember last page for session restore ──
  try { localStorage.setItem('ss_last_page', p); } catch(e){}
}

// ── DAILY NET ──
function getDailyNet(date){
  const b=biz();if(!b)return{gross:0,exp:0,net:0,actualExp:0,allocExp:0};
  const gross=(b.sales||[]).filter(s=>s.date===date&&s.status!=='cancelled').reduce((a,s)=>a+sTotal(s),0);
  const actualExp=(b.expenses||[]).filter(e=>e.date===date&&e.status!=='cancelled').reduce((a,e)=>a+(e.amount||0),0);
  // ── Add daily allocations from docs + salaries (ONLY IF TOGGLE IS ON) ──
  var allocEnabled = (b.allocationsEnabled !== false);  // default ON
  var allocExp = 0;
  if (allocEnabled && typeof getDayAllocations === 'function') {
    var alloc = getDayAllocations(date);
    allocExp = (alloc && alloc.total) || 0;
  }
  var totalExp = actualExp + allocExp;
  return{gross:gross,exp:totalExp,actualExp:actualExp,allocExp:allocExp,net:gross-totalExp};
}

// ── DASHBOARD ──