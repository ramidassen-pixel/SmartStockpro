async function hashPassword(plain) {
  // Try Web Crypto API first (requires HTTPS)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(plain));
      const hex = Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2,'0')).join('');
      return PW_PREFIX + hex;
    } catch(e) {
      console.warn('[Security] Web Crypto failed, using fallback:', e.message);
    }
  }
  // Fallback: pure-JS SHA-256 (works on HTTP/local files)
  return PW_PREFIX + _sha256(plain);
}

// Pure-JS SHA-256 (no dependencies, works everywhere)
function _sha256(str) {
  function rr(n,d){return n>>>d|n<<(32-d);}
  var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
         0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
         0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
         0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
         0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
         0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
         0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
         0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var msg=[];
  for(var i=0;i<str.length;i++){
    var c=str.charCodeAt(i);
    if(c<128)msg.push(c);
    else if(c<2048)msg.push(192|(c>>6),128|(c&63));
    else msg.push(224|(c>>12),128|((c>>6)&63),128|(c&63));
  }
  var ml=msg.length*8;msg.push(0x80);
  while((msg.length%64)!==56)msg.push(0);
  msg.push(0,0,0,0,(ml>>>24)&0xff,(ml>>>16)&0xff,(ml>>>8)&0xff,ml&0xff);
  for(var i2=0;i2<msg.length;i2+=64){
    var w=[];
    for(var j=0;j<16;j++)w[j]=(msg[i2+j*4]<<24)|(msg[i2+j*4+1]<<16)|(msg[i2+j*4+2]<<8)|msg[i2+j*4+3];
    for(var j2=16;j2<64;j2++){var s0=rr(w[j2-15],7)^rr(w[j2-15],18)^(w[j2-15]>>>3);var s1=rr(w[j2-2],17)^rr(w[j2-2],19)^(w[j2-2]>>>10);w[j2]=(w[j2-16]+s0+w[j2-7]+s1)>>>0;}
    var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],hh=H[7];
    for(var j3=0;j3<64;j3++){var S1=rr(e,6)^rr(e,11)^rr(e,25);var ch=(e&f)^(~e&g);var t1=(hh+S1+ch+K[j3]+w[j3])>>>0;var S0=rr(a,2)^rr(a,13)^rr(a,22);var maj=(a&b)^(a&c)^(b&c);var t2=(S0+maj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+hh)>>>0;
  }
  return H.map(function(n){return('00000000'+n.toString(16)).slice(-8);}).join('');
}

function isHashed(pw) {
  return typeof pw === 'string' && pw.startsWith(PW_PREFIX);
}

async function verifyPassword(plain, stored) {
  if (!stored) return false;
  try {
    if (!isHashed(stored)) return plain === stored;
    return await hashPassword(plain) === stored;
  } catch(e) {
    console.warn('[verifyPassword] Error:', e.message);
    return plain === stored;
  }
}

// Migrate a user's password from plain-text to hashed (called on successful login)
async function upgradePasswordIfNeeded(user, plainPw) {
  if (!isHashed(user.password)) {
    user.password = await hashPassword(plainPw);
    const u = (DB.users || []).find(function(x){ return x.id === user.id; });
    if (u) u.password = user.password;
    dbSave();
    try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
    console.log('[Security] Password upgraded to SHA-256 hash for:', user.username);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  LOGIN RATE LIMITER — 5 attempts → 15 min lockout
//  Stored in localStorage (separate from DB so it survives DB resets)
// ═══════════════════════════════════════════════════════════════════

const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000;  // 15 minutes
const LOCKOUT_KEY   = 'ss_login_attempts';

function getLockoutData() {
  try {
    var raw = localStorage.getItem(LOCKOUT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function saveLockoutData(data) {
  try { localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data)); } catch(e){}
}

function isAccountLocked(username) {
  var data = getLockoutData();
  var rec  = data[username.toLowerCase()];
  if (!rec) return false;
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    return rec.lockedUntil;  // returns timestamp
  }
  return false;
}

function recordFailedAttempt(username) {
  var data = getLockoutData();
  var key  = username.toLowerCase();
  if (!data[key]) data[key] = { attempts: 0, lockedUntil: 0, firstAttempt: Date.now() };
  data[key].attempts++;
  data[key].lastAttempt = Date.now();

  if (data[key].attempts >= MAX_ATTEMPTS) {
    data[key].lockedUntil = Date.now() + LOCKOUT_MS;
    data[key].attempts    = 0;
    // Alert admin if they exist
    try {
      var admin = (DB.users || []).find(function(u){
        return u.role === 'primaryAdmin';
      });
      if (admin && typeof addNotif === 'function') {
        addNotif('security', '⚠️ Security Alert: Account "' + username +
          '" was locked after ' + MAX_ATTEMPTS + ' failed login attempts at ' +
          new Date().toLocaleTimeString());
      }
    } catch(e){}
  }
  saveLockoutData(data);
  return data[key].attempts;
}

function clearFailedAttempts(username) {
  var data = getLockoutData();
  delete data[username.toLowerCase()];
  saveLockoutData(data);
}

function getRemainingLockout(lockedUntil) {
  var ms   = lockedUntil - Date.now();
  var mins = Math.floor(ms / 60000);
  var secs = Math.floor((ms % 60000) / 1000);
  return mins + ':' + (secs < 10 ? '0' : '') + secs;
}


// ═══════════════════════════════════════════════════════════════════
//  SESSION TIMEOUT — auto-logout after 30 min inactivity
//  Warning shown at 25 min: "Session expires in 5 min"
// ═══════════════════════════════════════════════════════════════════

var SESSION_TIMEOUT_MS  = 30 * 60 * 1000;   // 30 minutes
var SESSION_WARNING_MS  = 25 * 60 * 1000;   // warn at 25 min
var _sessionTimer       = null;
var _sessionWarnTimer   = null;
var _sessionWarnShown   = false;

function resetSessionTimer() {
  if (!CU) return;  // Not logged in — don't track
  clearTimeout(_sessionTimer);
  clearTimeout(_sessionWarnTimer);
  _sessionWarnShown = false;

  // Warning at 25 min
  _sessionWarnTimer = setTimeout(function(){
    if (!CU || _sessionWarnShown) return;
    _sessionWarnShown = true;
    if (typeof toast === 'function') {
      toast('⏱ Session expires in 5 minutes — tap anywhere to stay logged in', 'wa');
    }
  }, SESSION_WARNING_MS);

  // Auto-logout at 30 min
  _sessionTimer = setTimeout(function(){
    if (!CU) return;
    console.log('[Security] Session expired due to inactivity');
    if (typeof toast === 'function') toast('🔒 Session expired — please sign in again', 'er');
    setTimeout(function(){
      if (typeof doLogout === 'function') doLogout();
    }, 1500);
  }, SESSION_TIMEOUT_MS);
}

function stopSessionTimer() {
  clearTimeout(_sessionTimer);
  clearTimeout(_sessionWarnTimer);
  _sessionTimer = null;
  _sessionWarnTimer = null;
}

// Reset timer on ANY user activity
['click','touchstart','keydown','scroll','mousemove'].forEach(function(evt){
  document.addEventListener(evt, function(){
    if (CU) resetSessionTimer();
  }, { passive: true, capture: true });
});

// Also reset on page visibility change (returning to tab)
document.addEventListener('visibilitychange', function(){
  if (!document.hidden && CU) {
    // Check if session has already expired while tab was hidden
    var sess = null;
    try { sess = JSON.parse(localStorage.getItem('ss_session')); } catch(e){}
    if (sess && sess.ts) {
      var idle = Date.now() - sess.ts;
      if (idle > SESSION_TIMEOUT_MS) {
        console.log('[Security] Session expired while app was in background');
        if (typeof toast === 'function') toast('🔒 Session expired — please sign in again', 'er');
        setTimeout(function(){ if (typeof doLogout === 'function') doLogout(); }, 1000);
        return;
      }
    }
    resetSessionTimer();
  }
});

// Update session timestamp regularly so we can detect bg expiry
setInterval(function(){
  if (CU) {
    try {
      var sess = JSON.parse(localStorage.getItem('ss_session') || '{}');
      if (sess && sess.uid) {
        sess.ts = Date.now();
        localStorage.setItem('ss_session', JSON.stringify(sess));
      }
    } catch(e){}
  }
}, 60000);  // Update every minute


// ═══════════════════════════════════════════════════════════════════
//  XSS PROTECTION — comprehensive input sanitization
// ═══════════════════════════════════════════════════════════════════

// Strengthen the existing esc() function (override it)
// This version handles all dangerous HTML/JS injection chars
window.escFull = function(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g,  '&#x60;');
};

// Sanitize user input before storing (strip script tags etc.)
function sanitizeInput(str) {
  if (!str) return '';
  return String(str)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]+>/g, '')  // strip all remaining HTML tags
    .trim();
}

// Wrap all form saves to sanitize inputs
// This patches the critical entry points
(function patchSanitize(){
  // Products
  var origSaveProd = window.saveProd;
  if (typeof origSaveProd === 'function') {
    window.saveProd = function() {
      // Sanitize product name and description before save
      var nameEl = document.getElementById('pname');
      var descEl = document.getElementById('pdesc');
      if (nameEl) nameEl.value = sanitizeInput(nameEl.value);
      if (descEl) descEl.value = sanitizeInput(descEl.value);
      return origSaveProd.apply(this, arguments);
    };
  }
  // Sales
  var origSaveSale = window.saveSale;
  if (typeof origSaveSale === 'function') {
    window.saveSale = function() {
      var custEl = document.getElementById('scust');
      var phoneEl = document.getElementById('sphone');
      if (custEl) custEl.value = sanitizeInput(custEl.value);
      if (phoneEl) phoneEl.value = sanitizeInput(phoneEl.value);
      return origSaveSale.apply(this, arguments);
    };
  }
})();



// ═══════════════════════════════════════════════════════════════════
//  APP PIN LOCK — 4-digit PIN, locks after 5 min inactivity
// ═══════════════════════════════════════════════════════════════════

var PIN_TIMEOUT_MS   = 5 * 60 * 1000;  // 5 minutes
var _pinTimer        = null;
var _pinBuffer       = '';
var _pinLocked       = false;
var _pinAttempts     = 0;
var MAX_PIN_ATTEMPTS = 5;

function getUserPin() {
  if (!CU) return null;
  return CU.appPin || null;
}

function startPinTimer() {
  if (!CU || !getUserPin()) return;  // Only if PIN is set
  clearTimeout(_pinTimer);
  _pinTimer = setTimeout(function(){
    if (CU && getUserPin()) lockApp();
  }, PIN_TIMEOUT_MS);
}

function stopPinTimer() {
  clearTimeout(_pinTimer);
  _pinTimer = null;
}

function lockApp() {
  if (!CU) return;
  var pin = getUserPin();
  if (!pin) return;  // No PIN set — don't lock
  _pinLocked = true;
  _pinBuffer = '';
  _pinAttempts = 0;
  updatePinDots();
  var nameEl = document.getElementById('pin-lock-name');
  if (nameEl) nameEl.textContent = CU.name + ' — Locked';
  var errEl = document.getElementById('pin-error');
  if (errEl) errEl.textContent = '';
  var screen = document.getElementById('pin-lock-screen');
  if (screen) screen.style.display = 'flex';
}

function unlockApp() {
  _pinLocked = false;
  _pinBuffer = '';
  _pinAttempts = 0;
  var screen = document.getElementById('pin-lock-screen');
  if (screen) screen.style.display = 'none';
  startPinTimer();
}

function pinPress(digit) {
  if (_pinBuffer.length >= 4) return;
  _pinBuffer += digit;
  updatePinDots();
  if (_pinBuffer.length === 4) {
    setTimeout(checkPin, 100);  // Small delay so last dot shows
  }
}

function pinBackspace() {
  if (_pinBuffer.length > 0) {
    _pinBuffer = _pinBuffer.slice(0, -1);
    updatePinDots();
  }
}

function updatePinDots() {
  for (var i = 0; i < 4; i++) {
    var dot = document.getElementById('pd' + i);
    if (dot) {
      dot.classList.toggle('filled', i < _pinBuffer.length);
      dot.classList.remove('error');
    }
  }
}

function checkPin() {
  var pin = getUserPin();
  if (_pinBuffer === pin) {
    unlockApp();
    var errEl = document.getElementById('pin-error');
    if (errEl) errEl.textContent = '';
  } else {
    _pinAttempts++;
    _pinBuffer = '';
    // Flash dots red
    for (var i = 0; i < 4; i++) {
      var dot = document.getElementById('pd' + i);
      if (dot) { dot.classList.remove('filled'); dot.classList.add('error'); }
    }
    var errEl2 = document.getElementById('pin-error');
    if (_pinAttempts >= MAX_PIN_ATTEMPTS) {
      if (errEl2) errEl2.textContent = 'Too many attempts — signing out';
      setTimeout(function(){ pinSignOut(); }, 1500);
    } else {
      if (errEl2) errEl2.textContent = 'Wrong PIN · ' + (MAX_PIN_ATTEMPTS - _pinAttempts) + ' attempts left';
    }
    setTimeout(updatePinDots, 400);
  }
}

function pinSignOut() {
  unlockApp();
  doLogout();
}

function pinUsePassword() {
  // Let user bypass PIN with full password — sign them out to re-login
  unlockApp();
  doLogout();
}

// Reset PIN timer on activity (supplement session timer)
['click','touchstart','keydown'].forEach(function(evt){
  document.addEventListener(evt, function(){
    if (CU && getUserPin() && !_pinLocked) startPinTimer();
  }, { passive: true, capture: true });
});

// Check if should lock when returning to tab
document.addEventListener('visibilitychange', function(){
  if (!document.hidden && CU && getUserPin()) {
    // Check how long we've been away
    var sess = null;
    try { sess = JSON.parse(localStorage.getItem('ss_session') || '{}'); } catch(e){}
    if (sess && sess.lastActive) {
      var idle = Date.now() - sess.lastActive;
      if (idle > PIN_TIMEOUT_MS) { lockApp(); return; }
    }
    startPinTimer();
  }
});

// Update lastActive timestamp regularly for background detection
setInterval(function(){
  if (CU && !_pinLocked) {
    try {
      var s = JSON.parse(localStorage.getItem('ss_session') || '{}');
      if (s && s.uid) { s.lastActive = Date.now(); localStorage.setItem('ss_session', JSON.stringify(s)); }
    } catch(e){}
  }
}, 30000);



// ═══════════════════════════════════════════════════════════════════
//  ACCOUNT DEACTIVATION — disable/enable staff accounts
// ═══════════════════════════════════════════════════════════════════

function deactivateUser(userId) {
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) return;
  if (u.role === 'primaryAdmin') { toast('Cannot deactivate the Primary Admin', 'er'); return; }

  requireAdminPin(function(){
    showConf('🚫', 'Deactivate Account?',
      '"' + esc(u.name) + '" will be immediately signed out and cannot log in until reactivated.',
      function(){
        u.status = 'inactive';
        u.deactivatedAt = Date.now();
        u.deactivatedBy = CU.name;
        // Force session expiry — clear their session if on this device
        try {
          var sess = JSON.parse(localStorage.getItem('ss_session') || '{}');
          if (sess.uid === userId) { localStorage.removeItem('ss_session'); }
        } catch(e){}
        dbSave();
        try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
        addAdminLog('deactivate', 'Deactivated account: ' + u.name, CU.name);
        toast('Account deactivated — ' + u.name + ' cannot login', 'gd');
        renderTeam();
      }
    );
  }, null, 'Deactivate account — enter admin PIN');
}

function reactivateUser(userId) {
  var u = (DB.users || []).find(function(x){ return x.id === userId; });
  if (!u) return;
  requireAdminPin(function(){
    u.status = 'active';
    u.deactivatedAt = null;
    u.deactivatedBy = null;
    dbSave();
    try { if(typeof fbPush === 'function') fbPush(); } catch(e){}
    addAdminLog('reactivate', 'Reactivated account: ' + u.name, CU.name);
    toast('Account reactivated — ' + u.name + ' can login again', 'gd');
    renderTeam();
  }, null, 'Reactivate account — enter admin PIN');
}



function togglePinSetup(on) {
  var fields = el('pin-setup-fields');
  var lbl    = el('pin-toggle-lbl');
  if (fields) fields.style.display = on ? '' : 'none';
  if (lbl)    lbl.textContent = on ? 'ON' : 'OFF';
  if (!on) {
    sv('pe-pin', ''); sv('pe-pin2', '');
  }
}



// ═══════════════════════════════════════════════════════════════════
//  DELETE ACCOUNT — permanent deletion with password confirmation
// ═══════════════════════════════════════════════════════════════════

function openDeleteAccount() {
  if (!CU) return;
  closeD('d-profile');

  // Build warning message based on role
  var detailsEl = el('del-account-details');
  if (detailsEl) {
    var lines = [];
    if (CU.role === 'primaryAdmin') {
      lines.push('🔴 <strong>You are the Primary Admin.</strong>');
      lines.push('Deleting your account will permanently delete:');
      lines.push('• All your business data (sales, products, expenses)');
      lines.push('• All team member accounts linked to your business');
      lines.push('• All customer records, credits, and history');
      lines.push('• All documentation and salary records');
      lines.push('• Your Firebase database entry');
      lines.push('<br><strong style="color:var(--er)">This CANNOT be recovered.</strong>');
    } else {
      lines.push('Deleting your account will:');
      lines.push('• Remove your login access permanently');
      lines.push('• Remove you from the team roster');
      lines.push('• Your sales records will remain (for business records)');
      lines.push('<br>You will need a new invite to rejoin.');
    }
    detailsEl.innerHTML = lines.join('<br>');
  }

  // Reset form
  sv('del-account-confirm', '');
  sv('del-account-pw', '');
  var errEl = el('del-account-err');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  var btn = el('del-account-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.4'; btn.style.cursor = 'not-allowed'; }

  openD('d-del-account');
  setTimeout(function(){ var inp = el('del-account-confirm'); if(inp) inp.focus(); }, 300);
}

function checkDelAccountConfirm(val) {
  var btn = el('del-account-btn');
  if (!btn) return;
  if (val && val.trim().toUpperCase() === 'DELETE') {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  } else {
    btn.disabled = true;
    btn.style.opacity = '.4';
    btn.style.cursor = 'not-allowed';
  }
}

async function confirmDeleteAccount() {
  if (!CU) return;
  var confirmText = (el('del-account-confirm') ? el('del-account-confirm').value : '').trim().toUpperCase();
  var pw = el('del-account-pw') ? el('del-account-pw').value : '';
  var errEl = el('del-account-err');

  function showErr(msg) {
    if (errEl) { errEl.textContent = msg; errEl.style.display = ''; }
  }

  if (confirmText !== 'DELETE') {
    showErr('Please type DELETE to confirm'); return;
  }
  if (!pw) {
    showErr('Please enter your password'); return;
  }

  // Verify password
  var pwOk = await verifyPassword(pw, CU.password);
  if (!pwOk) {
    showErr('Incorrect password — account not deleted'); return;
  }

  // ── PERFORM DELETION ──
  var userId = CU.id;
  var isPrimary = (CU.role === 'primaryAdmin');

  if (isPrimary) {
    // Delete entire business data + all users in this business
    var b = (typeof biz === 'function') ? biz() : null;
    if (b) {
      var bizId = b.id;
      // Remove all users belonging to this business
      DB.users = (DB.users || []).filter(function(u) {
        return !(u.businessIds && u.businessIds.indexOf(bizId) !== -1);
      });
      // Remove the business itself
      DB.businesses = (DB.businesses || []).filter(function(bz) {
        return bz.id !== bizId;
      });
    } else {
      // Just remove this user
      DB.users = (DB.users || []).filter(function(u) { return u.id !== userId; });
    }
  } else {
    // Staff/Admin: just remove this user account
    DB.users = (DB.users || []).filter(function(u) { return u.id !== userId; });
    // Remove from business employees if listed
    (DB.businesses || []).forEach(function(bz) {
      if (bz.employees) {
        bz.employees = bz.employees.filter(function(e) { return e.userId !== userId; });
      }
    });
  }

  // Save + sync to Firebase
  try { dbSave(); } catch(e) {}
  try {
    if (typeof fbPushUsers === 'function') fbPushUsers();
    if (typeof fbPush === 'function') setTimeout(fbPush, 300);
  } catch(e) {}

  // Clear local session
  try { localStorage.removeItem('ss_session'); } catch(e) {}
  try { localStorage.removeItem('ss_last_page'); } catch(e) {}

  closeD('d-del-account');

  // Show farewell message then logout
  var shellEl = el('shell');
  if (shellEl) {
    shellEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;text-align:center;padding:20px">' +
      '<div style="font-size:48px">👋</div>' +
      '<div style="font-family:var(--fd);font-size:24px;font-weight:800;color:var(--t1)">Account Deleted</div>' +
      '<div style="font-size:14px;color:var(--t3);max-width:300px;line-height:1.6">Your account has been permanently deleted. Thank you for using SmartStock Pro.</div>' +
      '<button onclick="location.reload()" class="btn bg" style="margin-top:16px">Back to Start</button>' +
    '</div>';
  }
  CU = null;
  try { if(typeof stopSessionTimer==='function') stopSessionTimer(); } catch(e) {}
}



// ═══════════════════════════════════════════════════════════════════
//  localStorage ENCRYPTION
//  XOR cipher with password-derived key — works everywhere (no HTTPS needed)
//  Key = SHA-256 hash of user password + salt
// ═══════════════════════════════════════════════════════════════════

var _encKey = null;  // Set on login, cleared on logout

function setEncryptionKey(password) {
  // Derive a key from the password using SHA-256
  _encKey = _sha256(password + 'ss_salt_v1_smartstock');
}

function clearEncryptionKey() {
  _encKey = null;
}

function _xorEncrypt(text, key) {
  if (!key || !text) return text;
  var result = '';
  for (var i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  // Base64 encode to make it storable
  try { return btoa(unescape(encodeURIComponent(result))); } catch(e) { return text; }
}

function _xorDecrypt(encoded, key) {
  if (!key || !encoded) return encoded;
  try {
    var text = decodeURIComponent(escape(atob(encoded)));
    var result = '';
    for (var i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  } catch(e) { return encoded; }
}

function dbSaveEncrypted() {
  try {
    var json = JSON.stringify(DB);
    if (_encKey) {
      var encrypted = _xorEncrypt(json, _encKey);
      localStorage.setItem('ss_v4', 'enc:' + encrypted);
    } else {
      localStorage.setItem('ss_v4', json);
    }
  } catch(e) {
    console.warn('[Storage] Save failed:', e.message);
  }
}

function dbLoadDecrypted() {
  try {
    var raw = localStorage.getItem('ss_v4');
    if (!raw) return null;
    if (raw.startsWith('enc:')) {
      if (!_encKey) {
        // No key yet — can't decrypt. Return null to trigger Firebase pull
        console.warn('[Storage] Encrypted data found but no key set yet');
        return null;
      }
      var decrypted = _xorDecrypt(raw.slice(4), _encKey);
      return JSON.parse(decrypted);
    }
    // Unencrypted (old format or fresh) — parse normally
    return JSON.parse(raw);
  } catch(e) {
    console.warn('[Storage] Load/decrypt failed:', e.message);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════
//  RECYCLE BIN — 30-day soft delete for sales, expenses, products
// ═══════════════════════════════════════════════════════════════════

var TRASH_DAYS = 30;

function softDelete(record) {
  record.deletedAt  = Date.now();
  record.deletedBy  = CU ? CU.name : 'Unknown';
  record.status     = 'deleted';
  return record;
}

function isDeleted(record) {
  return record && record.status === 'deleted';
}

function isPermanentlyExpired(record) {
  if (!record || !record.deletedAt) return false;
  var age = Date.now() - record.deletedAt;
  return age > TRASH_DAYS * 24 * 60 * 60 * 1000;
}

// Auto-purge permanently expired records (run on dbLoad)
function purgExpiredTrash() {
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b) return;
  var purged = 0;
  ['sales','expenses','products'].forEach(function(type) {
    if (b[type]) {
      var before = b[type].length;
      b[type] = b[type].filter(function(r) {
        return !(isDeleted(r) && isPermanentlyExpired(r));
      });
      purged += before - b[type].length;
    }
  });
  if (purged > 0) {
    console.log('[Trash] Auto-purged ' + purged + ' expired records');
    try { dbSave(); } catch(e){}
  }
}

// Restore a deleted record
function restoreFromTrash(type, id) {
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b || !b[type]) return;
  var record = b[type].find(function(r){ return r.id === id; });
  if (!record) return;
  delete record.deletedAt;
  delete record.deletedBy;
  record.status = 'active';
  dbSave();
  toast('✅ Restored successfully', 'gd');
  if (typeof renderDash === 'function') renderDash();
}

// Get trash items (last 30 days)
function getTrashItems() {
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b) return [];
  var items = [];
  ['sales','expenses','products'].forEach(function(type) {
    (b[type] || []).filter(function(r){ return isDeleted(r) && !isPermanentlyExpired(r); })
    .forEach(function(r){ items.push({type:type, record:r}); });
  });
  items.sort(function(a,b){ return b.record.deletedAt - a.record.deletedAt; });
  return items;
}

// Count trash items
function getTrashCount() {
  return getTrashItems().length;
}


// ═══════════════════════════════════════════════════════════════════
//  EXPORT PROTECTION — admin PIN required before any data export
// ═══════════════════════════════════════════════════════════════════

function protectedExport(exportFn, label) {
  requireAdminPin(function() {
    addAdminLog('export', (label || 'Data export') + ' by ' + (CU ? CU.name : 'Unknown'), CU ? CU.name : '');
    try { exportFn(); } catch(e) { toast('Export error: ' + e.message, 'er'); }
  }, null, '🔐 ' + (label || 'Export') + ' — enter admin PIN to download');
}



// ─── RECYCLE BIN UI ───────────────────────────────────────
function openTrash() {
  renderTrashDrawer();
  openD('d-trash');
}

function renderTrashDrawer() {
  var items = getTrashItems();
  var body  = el('trash-body');
  var sub   = el('trash-dsub');
  if (sub) sub.textContent = items.length + ' item' + (items.length !== 1 ? 's' : '') + ' · auto-purge after 30 days';

  // Update sidebar badge
  var badge = el('trash-count-badge');
  if (badge) {
    if (items.length > 0) { badge.style.display = ''; badge.textContent = items.length; }
    else badge.style.display = 'none';
  }

  if (!body) return;
  if (!items.length) {
    body.innerHTML = '<div style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:40px;margin-bottom:10px">♻️</div>' +
      '<div style="font-size:14px;font-weight:700;color:var(--t2)">Recycle Bin is Empty</div>' +
      '<div style="font-size:12px;color:var(--t3);margin-top:6px">Deleted items appear here for 30 days</div>' +
    '</div>';
    return;
  }

  body.innerHTML = items.map(function(item) {
    var r = item.record;
    var typeIcon = item.type === 'sales' ? '🧾' : item.type === 'expenses' ? '💸' : '📦';
    var typeLbl  = item.type === 'sales' ? 'Sale' : item.type === 'expenses' ? 'Expense' : 'Product';
    var title    = r.customer || r.description || r.name || ('ID #' + r.id);
    var daysLeft = Math.max(0, 30 - Math.floor((Date.now() - r.deletedAt) / (1000*60*60*24)));
    var amount   = r.amount ? f$(r.amount) : (typeof sTotal === 'function' && item.type === 'sales' ? f$(sTotal(r)) : '');
    return '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--bd)">' +
      '<div style="font-size:22px;flex-shrink:0">' + typeIcon + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;font-weight:700;color:var(--t1)">' + esc(title) + '</div>' +
        '<div style="font-size:10px;color:var(--t3);margin-top:2px">' +
          typeLbl + ' · deleted by ' + esc(r.deletedBy || 'Unknown') + ' · ' + daysLeft + ' days left' +
        '</div>' +
      '</div>' +
      (amount ? '<div style="font-size:13px;font-weight:700;color:var(--wa);flex-shrink:0">' + amount + '</div>' : '') +
      '<button type="button" class="btn bok bsm" onclick="restoreFromTrash(\'' + item.type + '\',' + r.id + ');renderTrashDrawer()" ' +
        'style="flex-shrink:0;font-size:11px">↩ Restore</button>' +
    '</div>';
  }).join('');
}

function emptyTrash() {
  requireAdminPin(function() {
    var b = biz(); if(!b) return;
    ['sales','expenses','products'].forEach(function(type) {
      if (b[type]) b[type] = b[type].filter(function(r){ return r.status !== 'deleted'; });
    });
    dbSave();
    renderTrashDrawer();
    toast('Trash emptied permanently', 'gd');
  }, null, 'Empty Trash — enter admin PIN to permanently delete');
}



// ═══════════════════════════════════════════════════════════════════
//  FIREBASE AUTHENTICATION — Email + Password
//  Runs alongside custom auth for maximum security
// ═══════════════════════════════════════════════════════════════════

// Sign into Firebase Auth (called after our custom auth succeeds)
function fbAuthSignIn(email, password) {
  if (!FB_AUTH) return Promise.resolve(null);
  return FB_AUTH.signInWithEmailAndPassword(email, password)
    .then(function(cred) {
      console.log('[Firebase Auth] Signed in:', email);
      return cred;
    })
    .catch(function(err) {
      // If user doesn't exist in Firebase Auth yet, create them
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        return fbAuthCreateUser(email, password);
      }
      // Wrong password in Firebase Auth — update it to match our DB
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-login-credentials') {
        return fbAuthUpdatePassword(email, password);
      }
      console.warn('[Firebase Auth] Sign in error:', err.code);
      return null;
    });
}

// Create Firebase Auth user (for existing DB users migrating to Firebase Auth)
function fbAuthCreateUser(email, password) {
  // If FB_AUTH not ready yet — retry up to 10 times (5 seconds total)
  if (!FB_AUTH) {
    return new Promise(function(resolve) {
      var attempts = 0;
      var retry = setInterval(function() {
        attempts++;
        if (FB_AUTH) {
          clearInterval(retry);
          fbAuthCreateUser(email, password).then(resolve);
        } else if (attempts >= 10) {
          clearInterval(retry);
          console.warn('[Firebase Auth] FB_AUTH never became ready');
          resolve(null);
        }
      }, 500);
    });
  }

  return FB_AUTH.createUserWithEmailAndPassword(email, password)
    .then(function(cred) {
      console.log('[Firebase Auth] Created user:', email);
      if (cred.user && !cred.user.emailVerified) {
        var _actionSettings = {
          url: 'https://smartstock-pro.netlify.app?verified=1',
          handleCodeInApp: false
        };
        return cred.user.sendEmailVerification(_actionSettings)
          .then(function() {
            console.log('[Firebase Auth] Verification email sent to:', email);
            toast('📧 Verification email sent to ' + email + '. Please check your inbox.', 'gd');
            return cred;
          })
          .catch(function(verErr) {
            console.warn('[Firebase Auth] sendEmailVerification failed:', verErr.code, verErr.message);
            if (verErr.code === 'auth/too-many-requests') {
              toast('📧 Verification email already sent. Check your inbox or spam folder.', 'wa');
            } else {
              toast('⚠ Could not send verification email: ' + verErr.message, 'wa');
            }
            return cred;
          });
      }
      return cred;
    })
    .catch(function(err) {
      console.warn('[Firebase Auth] Create user error:', err.code, err.message);
      if (err.code === 'auth/email-already-in-use') {
        // User already exists — try to sign in and resend verification
        return FB_AUTH.signInWithEmailAndPassword(email, password)
          .then(function(cred) {
            if (cred.user && !cred.user.emailVerified) {
              return cred.user.sendEmailVerification()
                .then(function() {
                  toast('📧 Verification email resent to ' + email, 'gd');
                  return cred;
                });
            }
            return cred;
          })
          .catch(function(signInErr) {
            console.warn('[Firebase Auth] Sign-in for re-verify failed:', signInErr.code);
            return null;
          });
      }
      if (err.code === 'auth/operation-not-allowed') {
        console.warn('[Firebase Auth] Email/Password auth is NOT enabled in Firebase Console!');
        toast('⚠ Firebase Auth not enabled. Go to Firebase Console → Authentication → Enable Email/Password.', 'er');
      } else if (err.code === 'auth/network-request-failed') {
        toast('⚠ No internet connection. Verification email will be sent when online.', 'wa');
      } else {
        console.warn('[Firebase Auth] Unhandled error:', err.code, err.message);
      }
      return null;
    });
}

// Update Firebase Auth password (sync when our DB password changes)
function fbAuthUpdatePassword(email, password) {
  if (!FB_AUTH) return Promise.resolve(null);
  // Sign in with current Firebase creds to get user, then update
  return FB_AUTH.sendPasswordResetEmail(email).then(function() {
    // Can't update without old password - will sync on next login after reset
    return null;
  }).catch(function(err) {
    console.warn('[Firebase Auth] Update password error:', err.code);
    return null;
  });
}

// Sign out of Firebase Auth
function fbAuthSignOut() {
  if (!FB_AUTH) return;
  FB_AUTH.signOut().catch(function(e){
    console.warn('[Firebase Auth] Sign out error:', e);
  });
}

// Send password reset email
function fbAuthSendPasswordReset(email) {
  if (!FB_AUTH) {
    toast('Firebase Auth not available — refresh and try again', 'er');
    return Promise.reject('Not ready');
  }
  var _resetSettings = {
    url: 'https://smartstock-pro.netlify.app?reset=1',
    handleCodeInApp: false
  };
  return FB_AUTH.sendPasswordResetEmail(email, _resetSettings);
}

// Check if email is verified in Firebase Auth
function fbAuthIsEmailVerified() {
  if (!FB_AUTH || !FB_AUTH.currentUser) return false;
  return FB_AUTH.currentUser.emailVerified;
}

// Forgot password flow — opens a proper drawer
function openForgotPassword() {
  // Clear any login lockout when user opens forgot password
  // (they're already proving they know their email)
  try { localStorage.removeItem('ss_login_attempts'); } catch(e){}
  // Reset all field states
  var loginVal = el('lu') ? el('lu').value.trim() : '';
  if (loginVal.includes('@')) {
    sv('forgot-email', loginVal);
  } else {
    sv('forgot-email', '');
  }
  // Clear errors and success states
  ['forgot-err','forgot-ok','fp-err-code','fp-err-admin'].forEach(function(id){
    var e = el(id);
    if(e){ e.style.display = 'none'; e.textContent = ''; }
  });
  // Default to Email tab (primary recovery method)
  openD('d-forgot-pw');
  setTimeout(function(){
    if (typeof switchFpTab === 'function') switchFpTab('email');
    var inp = el('forgot-email');
    if (inp) inp.focus();
  }, 250);
}

function sendForgotPasswordReset() {
  var email = (el('forgot-email') ? el('forgot-email').value : '').trim().toLowerCase();
  var errEl = el('forgot-err');
  var okEl  = el('forgot-ok');
  var btn   = el('forgot-send-btn');

  function showErr(msg) {
    if (errEl) { errEl.textContent = msg; errEl.style.display = ''; }
    if (okEl)  okEl.style.display = 'none';
  }

  if (!email) { showErr('Please enter your email address'); return; }
  if (!email.includes('@') || !email.includes('.')) { showErr('Please enter a valid email address'); return; }

  // Check if email exists in our database
  var userMatch = (DB.users || []).find(function(u){
    return u.email && u.email.toLowerCase() === email;
  });
  if (!userMatch) {
    showErr('No account found with that email address');
    return;
  }

  if (!FB_AUTH) {
    showErr('Firebase Auth not ready — please refresh and try again');
    return;
  }

  // Disable button while sending
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  var _resetSettings = { url: 'https://smartstock-pro.netlify.app?reset=1', handleCodeInApp: false };
  FB_AUTH.sendPasswordResetEmail(email, _resetSettings)
    .then(function() {
      if (errEl) errEl.style.display = 'none';
      if (okEl) {
        okEl.innerHTML = '✅ <strong>Email sent!</strong><br>' +
          'Check <strong>' + esc(email) + '</strong> for a reset link from Firebase.<br>' +
          '<span style="font-size:11px;color:var(--t3)">Don\'t see it? Check your spam folder.</span>';
        okEl.style.display = '';
      }
      if (btn) { btn.disabled = false; btn.textContent = '✓ Sent — Send Again'; }
    })
    .catch(function(err) {
      if (btn) { btn.disabled = false; btn.textContent = '📧 Send Reset Email'; }
      if (err.code === 'auth/user-not-found') {
        showErr('This email is not registered with Firebase Auth yet. Try signing in with your username and password first.');
      } else if (err.code === 'auth/invalid-email') {
        showErr('Invalid email format');
      } else if (err.code === 'auth/too-many-requests') {
        showErr('Too many attempts. Please wait a few minutes and try again.');
      } else {
        showErr('Error: ' + (err.message || err.code));
      }
    });
}



// ─── Resend verification email ───────────────────────────
function resendVerificationEmail(email) {
  if (!FB_AUTH) { toast('Firebase Auth not available', 'er'); return; }
  // Sign in silently to get user object, then send verification
  var pwInput = document.getElementById('lp');
  var pw = pwInput ? pwInput.value : '';
  if (!pw) { toast('Enter your password first, then try resending', 'wa'); return; }
  FB_AUTH.signInWithEmailAndPassword(email, pw)
    .then(function(cred) {
      if (cred.user && !cred.user.emailVerified) {
        return cred.user.sendEmailVerification();
      }
    })
    .then(function() {
      toast('✅ Verification email resent to ' + email, 'gd');
    })
    .catch(function(err) {
      toast('Could not resend: ' + err.message, 'er');
    });
}



// ─── Resend verification email from profile ───────────────
function resendVerificationFromProfile() {
  if (!CU || !CU.email) {
    toast('No email on your account', 'er');
    return;
  }
  if (!FB_AUTH || !FB_AUTH.currentUser) {
    // Not signed into Firebase Auth — try to sign in first
    toast('Please sign out and sign back in with your email to resend verification.', 'wa');
    return;
  }
  if (FB_AUTH.currentUser.emailVerified) {
    toast('✅ Your email is already verified!', 'gd');
    return;
  }
  FB_AUTH.currentUser.sendEmailVerification()
    .then(function() {
      toast('📧 Verification email sent to ' + CU.email + '. Check your inbox and spam folder.', 'gd');
    })
    .catch(function(err) {
      if (err.code === 'auth/too-many-requests') {
        toast('Please wait a few minutes before requesting another email.', 'wa');
      } else {
        toast('Error: ' + err.message, 'er');
      }
    });
}



// ── Detect if running from local file ──────────────────────
(function() {
  var proto = window.location.protocol;
  if (proto === 'file:' || proto === 'content:' || window.location.href.indexOf('content://') === 0) {
    // Running from local file — show warning after page loads
    window.addEventListener('DOMContentLoaded', function() {
      var warn = document.getElementById('local-file-warning');
      if (warn) warn.style.display = '';
      // Also show on login screen if visible
      var loginEl = document.getElementById('login');
      if (loginEl && loginEl.style.display !== 'none') {
        var warn2 = document.getElementById('local-file-warning');
        if (warn2) warn2.style.display = '';
      }
    });
    // Also disable email verification requirement for local testing
    window._isLocalFile = true;
    console.warn('[SmartStock] Running from local file — Firebase Auth email features limited');
  }
})();



// ═══════════════════════════════════════════════════════════════════
//  FIREBASE STORAGE — Product photos, logos, profile pictures
// ═══════════════════════════════════════════════════════════════════

// Upload a file (base64 dataURL) to Firebase Storage
// Returns a Promise that resolves to the download URL
function fbStorageUpload(path, dataURL, onProgress) {
  return new Promise(function(resolve, reject) {
    if (!FB_STORAGE) {
      // Firebase Storage not available — keep base64 locally
      resolve(null);
      return;
    }
    if (!dataURL || !dataURL.startsWith('data:')) {
      resolve(null);
      return;
    }
    try {
      // Convert base64 dataURL to blob
      var parts  = dataURL.split(',');
      var mime   = parts[0].match(/:(.*?);/)[1];
      var bStr   = atob(parts[1]);
      var n      = bStr.length;
      var u8arr  = new Uint8Array(n);
      while (n--) u8arr[n] = bStr.charCodeAt(n);
      var blob   = new Blob([u8arr], {type: mime});

      var ref    = FB_STORAGE.ref(path);
      var task   = ref.put(blob, {contentType: mime});

      task.on('state_changed',
        function(snapshot) {
          if (onProgress) {
            var pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(pct);
          }
        },
        function(err) {
          console.warn('[Firebase Storage] Upload error:', err.code);
          resolve(null); // fail gracefully — keep local base64
        },
        function() {
          task.snapshot.ref.getDownloadURL().then(function(url) {
            console.log('[Firebase Storage] Uploaded:', path);
            resolve(url);
          }).catch(function(err) {
            console.warn('[Firebase Storage] getDownloadURL error:', err);
            resolve(null);
          });
        }
      );
    } catch(e) {
      console.warn('[Firebase Storage] Upload exception:', e.message);
      resolve(null);
    }
  });
}

// Delete a file from Firebase Storage by URL
function fbStorageDelete(url) {
  if (!FB_STORAGE || !url || !url.includes('firebasestorage')) return;
  try {
    FB_STORAGE.refFromURL(url).delete()
      .then(function(){ console.log('[Firebase Storage] Deleted:', url.slice(0,60)); })
      .catch(function(e){ console.warn('[Firebase Storage] Delete error:', e.code); });
  } catch(e){}
}

// Upload product photo and return {imgData, imgUrl}
// imgUrl = Firebase Storage URL (if online)
// imgData = base64 fallback (always set for offline)
async function uploadProductPhoto(base64DataURL, bizId, prodId) {
  if (!base64DataURL || !base64DataURL.startsWith('data:')) {
    return {imgData: '', imgUrl: ''};
  }
  // Always keep base64 locally for offline use
  var result = {imgData: base64DataURL, imgUrl: ''};
  try {
  // Also upload to Firebase Storage if available
  if (FB_STORAGE && bizId) {
    var ext  = base64DataURL.includes('image/png') ? 'png' : 'jpg';
    var path = 'products/' + bizId + '/' + (prodId || 'new') + '_' + Date.now() + '.' + ext;
    var url  = await fbStorageUpload(path, base64DataURL, null);
    if (url) {
      result.imgUrl  = url;
      result.imgData = ''; // clear base64 to save localStorage space
      console.log('[Storage] Product photo uploaded, base64 cleared');
    }
  }
  } catch(e) { console.warn('[uploadProductPhoto]',e.message); }
  return result;
}

// Get the best image src for a product (Storage URL first, fallback to base64)
function getProductImgSrc(prod) {
  if (!prod) return '';
  if (prod.imgUrl && prod.imgUrl.startsWith('http')) return prod.imgUrl;
  if (prod.imgData && prod.imgData.startsWith('data:')) return prod.imgData;
  return '';
}

// Upload profile photo to Firebase Storage
async function uploadProfilePhoto(base64DataURL, userId) {
  if (!base64DataURL || !base64DataURL.startsWith('data:')) return base64DataURL;
  if (!FB_STORAGE || !userId) return base64DataURL;
  var ext  = base64DataURL.includes('image/png') ? 'png' : 'jpg';
  var path = 'profiles/' + userId + '/photo.' + ext;
  var url  = await fbStorageUpload(path, base64DataURL, null);
  return url || base64DataURL; // fallback to base64 if upload fails
}

// Upload business logo to Firebase Storage
async function uploadBizLogo(base64DataURL, bizId) {
  if (!base64DataURL || !base64DataURL.startsWith('data:')) return base64DataURL;
  if (!FB_STORAGE || !bizId) return base64DataURL;
  var ext  = base64DataURL.includes('image/png') ? 'png' : 'jpg';
  var path = 'logos/' + bizId + '/logo.' + ext;
  var url  = await fbStorageUpload(path, base64DataURL, null);
  return url || base64DataURL;
}



// ─── Start Fresh — clear all data and restart ────────────
function confirmStartFresh() {
  showConf(
    '⚠️',
    'Start Fresh?',
    'This will delete ALL data on this device — accounts, sales, products, everything. This cannot be undone.\n\nOnly do this if you are completely locked out and want to start over.',
    function() {
      // Clear all SmartStock data from localStorage
      try {
        var keysToRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && (key.startsWith('ss_') || key === 'ss_v4')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(function(k){ localStorage.removeItem(k); });
        // Also clear the DB object in memory
        DB = { users: [], businesses: [], nextUserId: 1, nextBizId: 1 };
      } catch(e) {}
      // Show login fresh
      setTimeout(function(){ location.reload(); }, 300);
      toast('All data cleared. Starting fresh...', 'gd');
    }
  );
}



// ── Handle Firebase redirect callbacks ─────────────────────
(function handleFirebaseRedirects() {
  var params = new URLSearchParams(window.location.search);

  if (params.get('verified') === '1') {
    // User just clicked email verification link → show success
    window._showVerifiedSuccess = true;
    // Clean URL without reload
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (params.get('reset') === '1') {
    // User just clicked password reset link → show they can now log in
    window._showResetSuccess = true;
    window.history.replaceState({}, '', window.location.pathname);
  }
})();



// ── Login screen banner (success/error) ───────────────────
function showLoginBanner(msg, type) {
  var banner = document.getElementById('login-banner');
  if (!banner) return;
  banner.textContent = msg;
  banner.style.display = '';
  banner.style.background = type === 'ok'
    ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)';
  banner.style.borderColor = type === 'ok'
    ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)';
  banner.style.color = type === 'ok' ? 'var(--ok)' : 'var(--er)';
  // Auto-hide after 8 seconds
  setTimeout(function() {
    if (banner) banner.style.display = 'none';
  }, 8000);
}



// ── CONGRATULATION SCREEN ──────────────────────────────────
function showCongratsScreen(user, bizName) {
  var screen = document.getElementById('congrats-screen');
  if (!screen) return;

  // Fill in details
  var bizEl  = document.getElementById('congrats-biz-name');
  var nameEl = document.getElementById('congrats-name');
  var hintEl = document.getElementById('congrats-email-hint');

  if (bizEl)  bizEl.textContent  = bizName || '';
  if (nameEl) nameEl.textContent = 'Account created for ' + (user.name || user.username);
  if (hintEl) hintEl.innerHTML   =
    'We sent a verification link to<br>' +
    '<strong style="color:var(--t1)">' + esc(user.email || '') + '</strong><br><br>' +
    'Click the link in your email, then come back here and tap the button below.';

  // Show the screen
  screen.style.display = 'flex';

  // Store user for when they verify
  window._pendingVerifyUser = user;
  window._pendingVerifyBiz  = bizName;

  // Start polling for verification (check every 3 seconds)
  window._verifyPollInterval = setInterval(function() {
    if (FB_AUTH && FB_AUTH.currentUser) {
      FB_AUTH.currentUser.reload()
        .then(function() {
          if (FB_AUTH.currentUser.emailVerified) {
            clearInterval(window._verifyPollInterval);
            onEmailVerified();
          }
        })
        .catch(function(){});
    }
  }, 3000);
}

// Called when email is verified (auto-detected or button tapped)
function onEmailVerified() {
  var verifiedMsg = document.getElementById('congrats-verified-msg');
  var checkBtn    = document.getElementById('congrats-check-btn');
  if (verifiedMsg) verifiedMsg.style.display = '';
  if (checkBtn)    checkBtn.style.display     = 'none';

  // Wait 1.5s then log the user in
  setTimeout(function() {
    var screen = document.getElementById('congrats-screen');
    if (screen) screen.style.display = 'none';
    clearInterval(window._verifyPollInterval);

    // Log in the pending user
    var user = window._pendingVerifyUser;
    if (user) {
      loginAs(user);
      resetSessionTimer();
      toast('🎉 Welcome to SmartStock Pro, ' + (user.name || user.username) + '!', 'gd');
    }
    window._pendingVerifyUser = null;
    window._pendingVerifyBiz  = null;
  }, 1500);
}

// Manual check — user taps "I've verified my email"
function checkEmailVerificationStatus() {
  if (!FB_AUTH || !FB_AUTH.currentUser) {
    // No Firebase session — just let them in (offline/local file mode)
    var user = window._pendingVerifyUser;
    if (user) {
      var screen = document.getElementById('congrats-screen');
      if (screen) screen.style.display = 'none';
      clearInterval(window._verifyPollInterval);
      loginAs(user);
      resetSessionTimer();
      toast('🎉 Welcome, ' + (user.name || user.username) + '!', 'gd');
    }
    return;
  }

  var btn = document.getElementById('congrats-check-btn');
  if (btn) btn.textContent = 'Checking...';

  FB_AUTH.currentUser.reload()
    .then(function() {
      if (FB_AUTH.currentUser.emailVerified) {
        clearInterval(window._verifyPollInterval);
        onEmailVerified();
      } else {
        if (btn) btn.textContent = '✓ I\'ve verified my email — Continue';
        showLoginBanner('Email not verified yet. Please click the link in your email first.', 'er');
        toast('📧 Please click the verification link in your email first.', 'wa');
      }
    })
    .catch(function(err) {
      if (btn) btn.textContent = '✓ I\'ve verified my email — Continue';
      // On error (e.g. offline) — let them through
      var user = window._pendingVerifyUser;
      if (user) {
        var screen = document.getElementById('congrats-screen');
        if (screen) screen.style.display = 'none';
        clearInterval(window._verifyPollInterval);
        loginAs(user);
        resetSessionTimer();
      }
    });
}

// Resend verification email from congrats screen
function resendCongratsVerification() {
  if (!FB_AUTH || !FB_AUTH.currentUser) {
    toast('Firebase Auth not connected. Check your internet.', 'wa');
    return;
  }
  var actionSettings = {
    url: 'https://smartstock-pro.netlify.app?verified=1',
    handleCodeInApp: false
  };
  FB_AUTH.currentUser.sendEmailVerification(actionSettings)
    .then(function() {
      toast('📧 Verification email resent! Check your inbox.', 'gd');
    })
    .catch(function(err) {
      if (err.code === 'auth/too-many-requests') {
        toast('Please wait a few minutes before requesting another email.', 'wa');
      } else {
        toast('Error: ' + err.message, 'er');
      }
    });
}



// ── Prompt user to add email if missing ───────────────────
function promptAddEmail(userId, onSuccess) {
  var email = prompt(
    'Your account needs an email address for verification.\n\n' +
    'Please enter your email:'
  );
  if (!email || !email.includes('@') || !email.includes('.')) {
    toast('A valid email is required to continue.', 'er');
    return;
  }
  email = email.trim().toLowerCase();
  // Check not already taken
  var taken = (DB.users || []).find(function(u) {
    return u.id !== userId && u.email && u.email.toLowerCase() === email;
  });
  if (taken) {
    toast('That email is already used by another account.', 'er');
    return;
  }
  // Save email to user
  var user = (DB.users || []).find(function(u){ return u.id === userId; });
  if (user) {
    user.email = email;
    dbSave();
    try { if (typeof fbPushUsers === 'function') fbPushUsers(); } catch(e){}
    // Create Firebase Auth and send verification
    if (typeof fbAuthCreateUser === 'function') {
      fbAuthCreateUser(email, '').catch(function(){});
    }
    toast('📧 Email added! Verification email sent to ' + email, 'gd');
    if (onSuccess) onSuccess(user);
  }
}



// ═══════════════════════════════════════════════════════════════════
//  AI ASSISTANT — Chat with Claude about your business data
// ═══════════════════════════════════════════════════════════════════

var aiConversationHistory = [];
var aiIsTyping = false;

// Collect business data to send to AI
function getBusinessDataForAI() {
  var b = (typeof biz === 'function') ? biz() : null;
  if (!b) return {};

  var now = new Date();
  var todayStr = now.toISOString().split('T')[0];
  var monthStr = todayStr.slice(0, 7);

  // Products summary
  var products = (b.products || []).filter(function(p){ return p.status !== 'deleted'; });
  var lowStock = products.filter(function(p){ return p.qty <= (p.lowLevel || 5) && p.qty > 0; });
  var outOfStock = products.filter(function(p){ return p.qty <= 0; });

  // Sales summary
  var sales = (b.sales || []).filter(function(s){ return s.status !== 'deleted'; });
  var todaySales = sales.filter(function(s){ return s.date === todayStr; });
  var monthSales = sales.filter(function(s){ return s.date && s.date.startsWith(monthStr); });

  // Expenses
  var expenses = (b.expenses || []).filter(function(e){ return e.status !== 'deleted'; });
  var monthExp = expenses.filter(function(e){ return e.date && e.date.startsWith(monthStr); });

  // Credits (debtors)
  var credits = (b.credits || []).filter(function(c){ return c.status !== 'deleted'; });
  var unpaidCredits = credits.filter(function(c){ return (c.balance || 0) > 0; });

  // Calculate totals
  var f$ = function(n){ return '$' + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); };
  var sTotal = function(s){ return (s.total || (s.items||[]).reduce(function(a,i){return a+i.qty*i.unitPrice;},0)) - (s.discount||0); };

  var todayRevenue = todaySales.reduce(function(a,s){ return a + sTotal(s); }, 0);
  var monthRevenue = monthSales.reduce(function(a,s){ return a + sTotal(s); }, 0);
  var monthExpTotal = monthExp.reduce(function(a,e){ return a + (e.amount||0); }, 0);
  var totalCreditOwed = unpaidCredits.reduce(function(a,c){ return a + (c.balance||0); }, 0);

  // Top products by sales
  var prodSales = {};
  sales.forEach(function(s){
    (s.items||[]).forEach(function(i){
      prodSales[i.name] = (prodSales[i.name]||0) + i.qty * i.unitPrice;
    });
  });
  var topProducts = Object.entries(prodSales)
    .sort(function(a,b){ return b[1]-a[1]; })
    .slice(0,5)
    .map(function(e){ return { name: e[0], revenue: f$(e[1]) }; });

  return {
    businessName: b.name || 'Your business',
    businessType: b.type || 'Tile/Building Materials Store',
    location: b.location || '',
    currency: b.currency || 'USD',
    today: todayStr,
    currentMonth: monthStr,

    inventory: {
      totalProducts: products.length,
      lowStockItems: lowStock.map(function(p){ return { name: p.name, qty: p.qty, unit: p.unit, threshold: p.lowLevel||5 }; }),
      outOfStockItems: outOfStock.map(function(p){ return { name: p.name }; }),
      totalStockValue: f$(products.reduce(function(a,p){ return a + p.qty * (p.cost||p.price||0); }, 0)),
      allProducts: products.map(function(p){ return { name: p.name, qty: p.qty, unit: p.unit, price: f$(p.price), cost: f$(p.cost||0), category: p.category }; })
    },

    sales: {
      todayCount: todaySales.length,
      todayRevenue: f$(todayRevenue),
      monthCount: monthSales.length,
      monthRevenue: f$(monthRevenue),
      recentSales: sales.slice(0,10).map(function(s){ return { date: s.date, customer: s.customer||'Walk-in', total: f$(sTotal(s)), status: s.payStatus, items: (s.items||[]).length + ' items' }; })
    },

    expenses: {
      monthTotal: f$(monthExpTotal),
      monthProfit: f$(monthRevenue - monthExpTotal),
      recentExpenses: expenses.slice(0,10).map(function(e){ return { date: e.date, description: e.description, amount: f$(e.amount) }; })
    },

    credits: {
      totalOwed: f$(totalCreditOwed),
      debtors: unpaidCredits.map(function(c){ return { name: c.customerName||c.name, amount: f$(c.balance) }; })
    },

    topSellingProducts: topProducts,

    team: {
      totalMembers: (b.employees||[]).length,
      members: (b.employees||[]).map(function(e){ return { name: e.name, role: e.role }; })
    }
  };
}

// Send message to AI
async function sendAIMessage() {
  var input = document.getElementById('ai-input');
  var question = input ? input.value.trim() : '';
  if (!question || aiIsTyping) return;

  // Clear input
  input.value = '';
  if (input.style) input.style.height = 'auto';

  // Hide welcome screen
  var welcome = document.getElementById('ai-welcome');
  if (welcome) welcome.style.display = 'none';

  // Add user message to UI
  appendAIMessage('user', question);

  // Show typing indicator
  aiIsTyping = true;
  var typingId = 'ai-typing-' + Date.now();
  appendAITyping(typingId);

  // Add to history
  aiConversationHistory.push({ role: 'user', content: question });

  try {
    var businessData = getBusinessDataForAI();
    var response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        businessData: businessData,
        conversationHistory: aiConversationHistory.slice(-10)
      })
    });

    var data = await response.json();
    removeAITyping(typingId);
    aiIsTyping = false;

    if (data.answer) {
      appendAIMessage('assistant', data.answer);
      aiConversationHistory.push({ role: 'assistant', content: data.answer });
      // Keep history manageable
      if (aiConversationHistory.length > 20) aiConversationHistory = aiConversationHistory.slice(-20);
    } else {
      appendAIMessage('assistant', '⚠️ ' + (data.error || 'Something went wrong. Please try again.'));
    }
  } catch(e) {
    removeAITyping(typingId);
    aiIsTyping = false;
    appendAIMessage('assistant', '⚠️ Could not connect to AI. Please check your internet and try again.');
  }

  scrollAIToBottom();
}

// Quick question from chip buttons
function askAIQuick(question) {
  var input = document.getElementById('ai-input');
  if (input) input.value = question;
  sendAIMessage();
}

// Append a message bubble to AI chat
function appendAIMessage(role, text) {
  var msgs = document.getElementById('chat-ai-msgs');
  if (!msgs) return;

  var isUser = role === 'user';
  var div = document.createElement('div');
  div.style.cssText = 'display:flex;' + (isUser ? 'justify-content:flex-end' : 'justify-content:flex-start') + ';margin-bottom:4px';

  // Format markdown-like text
  var formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)/gm, '<li style="margin-left:14px;margin-bottom:3px">$1</li>')
    .replace(/^• (.+)/gm, '<li style="margin-left:14px;margin-bottom:3px">$1</li>')
    .replace(/\n/g, '<br>');

  div.innerHTML = '<div style="max-width:85%;padding:11px 14px;border-radius:' +
    (isUser ? '14px 14px 4px 14px;background:linear-gradient(135deg,var(--g),var(--g2));color:#060810' :
               '14px 14px 14px 4px;background:var(--s2);border:1px solid var(--bd);color:var(--t1)') +
    ';font-size:13px;line-height:1.6">' +
    (isUser ? '' : '<div style="font-size:10px;font-weight:700;color:var(--g);margin-bottom:5px;letter-spacing:.05em">🤖 SMARTSTOCK AI</div>') +
    formatted + '</div>';

  msgs.appendChild(div);
  scrollAIToBottom();
}

// Typing indicator
function appendAITyping(id) {
  var msgs = document.getElementById('chat-ai-msgs');
  if (!msgs) return;
  var div = document.createElement('div');
  div.id = id;
  div.style.cssText = 'display:flex;justify-content:flex-start;margin-bottom:4px';
  div.innerHTML = '<div style="padding:12px 16px;background:var(--s2);border:1px solid var(--bd);border-radius:14px 14px 14px 4px">' +
    '<div style="display:flex;gap:5px;align-items:center">' +
    '<span style="width:7px;height:7px;background:var(--g);border-radius:50%;animation:pulse 1s infinite"></span>' +
    '<span style="width:7px;height:7px;background:var(--g);border-radius:50%;animation:pulse 1s .2s infinite"></span>' +
    '<span style="width:7px;height:7px;background:var(--g);border-radius:50%;animation:pulse 1s .4s infinite"></span>' +
    '</div></div>';
  msgs.appendChild(div);
  scrollAIToBottom();
}

function removeAITyping(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
}

function scrollAIToBottom() {
  var msgs = document.getElementById('chat-ai-msgs');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

// Clear AI conversation
function clearAIChat() {
  aiConversationHistory = [];
  var msgs = document.getElementById('chat-ai-msgs');
  if (!msgs) return;
  msgs.innerHTML = '';
  // Re-add welcome
  var welcome = document.createElement('div');
  welcome.id = 'ai-welcome';
  welcome.style.cssText = 'text-align:center;padding:20px 10px';
  welcome.innerHTML = '<div style="font-size:40px;margin-bottom:10px">🤖</div>' +
    '<div style="font-family:var(--fd);font-size:18px;font-weight:800;color:var(--t1);margin-bottom:6px">SmartStock AI</div>' +
    '<div style="font-size:12px;color:var(--t3);line-height:1.7">Ask me anything about your business.</div>';
  msgs.appendChild(welcome);
}



// ── STOCKTAKE — direct quantity edit ──────────────────────
function openStocktake(prodId) {
  var b = biz(); if(!b) return;
  var p = (b.products||[]).find(function(x){ return x.id === prodId; });
  if(!p) return;

  var newQty = prompt(
    '📦 STOCKTAKE: ' + p.name + '\n\n' +
    'System quantity: ' + p.qty + ' ' + (p.unit||'') + '\n' +
    'Enter ACTUAL physical count:'
  );

  if (newQty === null) return; // cancelled
  var qty = parseFloat(newQty);
  if (isNaN(qty)) { toast('Invalid quantity', 'er'); return; }

  var diff = qty - p.qty;
  var oldQty = p.qty;
  p.qty = qty;

  // Track negative
  if(p.qty < 0 && oldQty >= 0) p.wentNegativeAt = Date.now();
  if(p.qty >= 0) p.wentNegativeAt = null;

  // Log the adjustment
  var b2 = biz();
  if(!b2.stockHistory) b2.stockHistory = [];
  b2.stockHistory.unshift({
    id: b2.nextHistId++,
    date: today(),
    type: 'ADJUST',
    prodName: p.name,
    qty: diff,
    by: CU ? CU.name : 'Unknown',
    ref: 'STKTK-' + Date.now(),
    notes: 'Stocktake · System: ' + oldQty + ' → Physical: ' + qty,
    ts: Date.now()
  });

  addAdminLog('stocktake', 'Stocktake · ' + p.name + ' · ' + oldQty + ' → ' + qty, CU ? CU.name : '');
  dbSave();
  renderProducts();
  renderDash();

  var msg = diff === 0
    ? '✅ ' + p.name + ': quantity confirmed at ' + qty
    : (diff > 0 ? '📈 ' : '📉 ') + p.name + ': adjusted ' + (diff > 0 ? '+' : '') + diff + ' (was ' + oldQty + ', now ' + qty + ')';
  toast(msg, 'gd');
}

// ── STOCK HISTORY VIEWER ──────────────────────────────────
function openStockHistory(prodId) {
  var b = biz(); if(!b) return;
  var p = (b.products||[]).find(function(x){ return x.id === prodId; });
  if(!p) return;

  var history = (b.stockHistory||[])
    .filter(function(h){ return h.prodName === p.name; })
    .slice(0, 30);

  if(!history.length) {
    toast('No stock history for ' + p.name, 'wa');
    return;
  }

  var rows = history.map(function(h) {
    var typeColor = h.type === 'IN' ? 'var(--ok)' : h.type === 'ADJUST' ? 'var(--wa)' : 'var(--er)';
    var typeLabel = h.type === 'IN' ? '▲ IN' : h.type === 'ADJUST' ? '⚖ ADJ' : h.type === 'SALE' ? '🛍 SALE' : '▼ OUT';
    var qtyStr = (h.qty > 0 ? '+' : '') + h.qty;
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--bd);font-size:12px">' +
      '<span style="font-weight:800;color:' + typeColor + ';width:60px;flex-shrink:0">' + typeLabel + '</span>' +
      '<span style="font-family:var(--fm);font-weight:700;color:' + typeColor + ';width:50px;flex-shrink:0">' + qtyStr + '</span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="color:var(--t2)">' + (h.notes||'') + '</div>' +
        '<div style="color:var(--t3);font-size:10px">' + h.date + ' · ' + (h.by||'') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Show in a simple overlay
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;padding:0';
  overlay.innerHTML =
    '<div style="width:100%;max-height:80vh;background:var(--s1);border-radius:18px 18px 0 0;overflow:hidden;display:flex;flex-direction:column">' +
      '<div style="padding:14px 16px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center">' +
        '<div>' +
          '<div style="font-family:var(--fd);font-size:16px;font-weight:900;color:var(--t1)">📋 Stock History</div>' +
          '<div style="font-size:11px;color:var(--t3)">' + p.name + ' · Last 30 movements</div>' +
        '</div>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:var(--s2);border:1px solid var(--bd);border-radius:99px;width:30px;height:30px;cursor:pointer;font-size:14px;color:var(--t2)">✕</button>' +
      '</div>' +
      '<div style="overflow-y:auto;flex:1">' + rows + '</div>' +
    '</div>';
  overlay.onclick = function(e){ if(e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ── LOW STOCK NOTIFICATION ─────────────────────────────────
function checkLowStockAlert() {
  var b = biz(); if(!b) return;
  var lowItems = (b.products||[]).filter(function(p){
    return p.status !== 'deleted' && p.qty <= (p.lowLevel||5);
  });
  var badge = el('low-stock-badge');
  if(badge) {
    badge.textContent = lowItems.length;
    badge.style.display = lowItems.length > 0 ? '' : 'none';
  }
  return lowItems;
}



// ═══════════════════════════════════════════════════════════════════
//  QUOTATION SYSTEM
// ═══════════════════════════════════════════════════════════════════

var quoteItems = [];
var editingQuoteId = null;

function openNewQuote() {
  editingQuoteId = null;
  quoteItems = [];
  sv('qt-cust',''); sv('qt-phone',''); sv('qt-disc','0'); sv('qt-terms','');
  sv('qt-date', today());
  el('qt-validity').value = '7';
  el('quote-drawer-title').textContent = 'New Quotation';
  el('quote-drawer-sub').textContent   = 'Fill in customer and products';
  renderQuoteItems();
  updateQuoteTotals();
  openD('d-quote');
  setTimeout(function(){ el('qt-cust') && el('qt-cust').focus(); }, 300);
}

function addQuoteItem() {
  var b = biz(); if(!b) return;
  var prods = (b.products||[]).filter(function(p){ return p.status !== 'deleted'; });
  if(!prods.length){ toast('Add products first','er'); return; }
  quoteItems.push({ prodId: prods[0].id, name: prods[0].name, qty: 1, unitPrice: prods[0].price||0, unit: prods[0].unit||'Box' });
  renderQuoteItems();
  updateQuoteTotals();
}

function removeQuoteItem(idx) {
  quoteItems.splice(idx, 1);
  renderQuoteItems();
  updateQuoteTotals();
}

function renderQuoteItems() {
  var b = biz(); if(!b) return;
  var prods = (b.products||[]).filter(function(p){ return p.status !== 'deleted'; });
  var cont = el('qt-items'); if(!cont) return;
  if(!quoteItems.length){
    cont.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--t3)">No products yet — tap + Add Product</div>';
    return;
  }
  cont.innerHTML = quoteItems.map(function(item, idx){
    var opts = prods.map(function(p){
      return '<option value="'+p.id+'"'+(p.id===item.prodId?' selected':'')+'>'+esc(p.name)+'</option>';
    }).join('');
    return '<div style="padding:10px 13px;border-bottom:1px solid var(--bd);display:grid;gap:6px">'+
      '<div style="display:flex;gap:6px;align-items:center">'+
        '<select class="fi" style="flex:1;padding:7px 9px;font-size:12px" onchange="onQuoteProdChange('+idx+',this.value)">'+opts+'</select>'+
        '<button type="button" onclick="removeQuoteItem('+idx+')" style="background:var(--erb);border:none;border-radius:8px;padding:6px 9px;color:var(--er);cursor:pointer;font-size:14px;flex-shrink:0">✕</button>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'+
        '<div><label style="font-size:9px;color:var(--t3);font-family:var(--fm);text-transform:uppercase;font-weight:700">Qty ('+esc(item.unit)+')</label>'+
          '<input type="number" class="fi" style="padding:7px 9px;font-size:13px" value="'+item.qty+'" min="0.01" step="0.01"'+
          ' oninput="quoteItems['+idx+'].qty=parseFloat(this.value)||0;updateQuoteTotals()"></div>'+
        '<div><label style="font-size:9px;color:var(--t3);font-family:var(--fm);text-transform:uppercase;font-weight:700">Unit Price ($)</label>'+
          '<input type="number" class="fi" style="padding:7px 9px;font-size:13px" value="'+item.unitPrice+'" min="0" step="0.01"'+
          ' oninput="quoteItems['+idx+'].unitPrice=parseFloat(this.value)||0;updateQuoteTotals()"></div>'+
      '</div>'+
      '<div style="text-align:right;font-size:12px;font-weight:700;color:var(--g)">Line total: '+f$(item.qty*item.unitPrice)+'</div>'+
    '</div>';
  }).join('');
}

function onQuoteProdChange(idx, prodId) {
  var b = biz(); if(!b) return;
  var p = (b.products||[]).find(function(x){ return x.id === parseInt(prodId); });
  if(p){
    quoteItems[idx].prodId    = p.id;
    quoteItems[idx].name      = p.name;
    quoteItems[idx].unitPrice = p.price || 0;
    quoteItems[idx].unit      = p.unit  || 'Box';
    renderQuoteItems();
    updateQuoteTotals();
  }
}

function updateQuoteTotals() {
  var sub  = quoteItems.reduce(function(a,i){ return a + i.qty * i.unitPrice; }, 0);
  var disc = parseFloat(el('qt-disc') ? el('qt-disc').value : 0) || 0;
  var tot  = Math.max(0, sub - disc);
  if(el('qt-subtotal')) el('qt-subtotal').textContent = f$(sub);
  if(el('qt-total'))    el('qt-total').textContent    = f$(tot);
}

function saveQuote(action) {
  var b = biz(); if(!b) return;
  var cust  = gv('qt-cust');
  var phone = gv('qt-phone');
  var date  = el('qt-date') ? el('qt-date').value : today();
  var valid = parseInt(el('qt-validity') ? el('qt-validity').value : 7);
  var disc  = parseFloat(gv('qt-disc')) || 0;
  var terms = gv('qt-terms');

  // No validation — save freely
  if(!cust) cust = 'Walk-in';

  var sub   = quoteItems.reduce(function(a,i){ return a + i.qty * i.unitPrice; }, 0);
  var total = Math.max(0, sub - disc);

  // Expiry date
  var expDate = new Date(date);
  expDate.setDate(expDate.getDate() + valid);
  var expStr  = expDate.toISOString().split('T')[0];

  var ref = 'QT-' + String(b.nextQuoteId||1).padStart(4,'0');

  var quote = {
    id:         b.nextQuoteId++,
    ref:        ref,
    date:       date,
    expiryDate: expStr,
    validDays:  valid,
    customer:   cust,
    phone:      phone,
    items:      quoteItems.map(function(i){ return { prodId:i.prodId, name:i.name, qty:i.qty, unitPrice:i.unitPrice, unit:i.unit }; }),
    subtotal:   sub,
    discount:   disc,
    total:      total,
    terms:      terms,
    status:     action === 'send' ? 'Sent' : 'Draft',
    createdAt:  Date.now(),
    createdBy:  CU ? CU.name : 'Unknown'
  };

  if(!b.quotations) b.quotations = [];
  b.quotations.unshift(quote);
  dbSave();
  closeD('d-quote');
  renderQuotes();
  toast(ref + ' saved' + (action==='send'?' — sending WhatsApp...':''), 'gd');

  if(action === 'send') {
    setTimeout(function(){ sendQuoteWhatsApp(quote); }, 500);
  }
}

function renderQuotes() {
  var b   = biz(); if(!b) return;
  var cont = el('quotes-list'); if(!cont) return;
  var quotes = (b.quotations||[]);

  if(!quotes.length){
    cont.innerHTML = '<div style="text-align:center;padding:40px 20px">'+
      '<div style="font-size:36px;margin-bottom:10px">📋</div>'+
      '<div style="font-size:14px;font-weight:700;color:var(--t2)">No quotations yet</div>'+
      '<div style="font-size:12px;color:var(--t3);margin-top:5px">Tap + New Quote to create one</div>'+
    '</div>';
    return;
  }

  var today_str = today();
  cont.innerHTML = quotes.map(function(q){
    var isExpired = q.status !== 'Converted' && q.status !== 'Cancelled' && q.expiryDate < today_str;
    var status    = isExpired ? 'Expired' : q.status;
    var stColor   = status==='Converted'?'var(--ok)': status==='Accepted'?'#3b82f6': status==='Rejected'||status==='Expired'||status==='Cancelled'?'var(--er)':'var(--wa)';
    return '<div style="background:var(--s2);border:1px solid var(--bd);border-radius:12px;padding:13px 14px;margin-bottom:9px;cursor:pointer" onclick="viewQuote('+q.id+')">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'+
        '<div>'+
          '<div style="font-size:13px;font-weight:800;color:var(--t1)">'+esc(q.customer)+'</div>'+
          '<div style="font-size:11px;color:var(--t3);font-family:var(--fm)">'+q.ref+' · '+q.date+'</div>'+
        '</div>'+
        '<div style="text-align:right">'+
          '<div style="font-size:13px;font-weight:800;color:var(--g)">'+f$(q.total)+'</div>'+
          '<div style="font-size:10px;font-weight:700;color:'+stColor+'">'+status+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--t3)">'+q.items.length+' product'+(q.items.length!==1?'s':'')+
        (status==='Draft'||status==='Sent'?' · Expires '+q.expiryDate:'')+
      '</div>'+
    '</div>';
  }).join('');
}

function viewQuote(id) {
  var b = biz(); if(!b) return;
  var q = (b.quotations||[]).find(function(x){ return x.id === id; });
  if(!q) return;

  var today_str = today();
  var isExpired = q.status !== 'Converted' && q.status !== 'Cancelled' && q.expiryDate < today_str;
  var status    = isExpired ? 'Expired' : q.status;

  el('qv-ref').textContent = q.ref;
  el('qv-status-sub').textContent = status + ' · ' + q.customer;

  var body = el('qv-body'); if(!body) return;
  body.innerHTML =
    '<div style="background:var(--s2);border:1px solid var(--bd);border-radius:10px;padding:13px;margin-bottom:12px">'+
      '<div style="font-size:12px;color:var(--t3);margin-bottom:3px;font-family:var(--fm)">CUSTOMER</div>'+
      '<div style="font-size:14px;font-weight:700;color:var(--t1)">'+esc(q.customer)+'</div>'+
      (q.phone?'<div style="font-size:12px;color:var(--t3)">📱 '+esc(q.phone)+'</div>':'')+
      '<div style="font-size:11px;color:var(--t3);margin-top:6px">Quote date: '+q.date+' · Valid until: <strong style="color:'+(isExpired?'var(--er)':'var(--ok)')+'">'+q.expiryDate+'</strong></div>'+
    '</div>'+
    '<div style="margin-bottom:12px">'+
      q.items.map(function(i){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd);font-size:13px">'+
          '<div><div style="font-weight:600;color:var(--t1)">'+esc(i.name)+'</div>'+
          '<div style="font-size:11px;color:var(--t3)">'+i.qty+' '+esc(i.unit||'')+'  ×  '+f$(i.unitPrice)+'</div></div>'+
          '<div style="font-weight:700;color:var(--g)">'+f$(i.qty*i.unitPrice)+'</div>'+
        '</div>';
      }).join('')+
    '</div>'+
    (q.discount>0?'<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--t3);margin-bottom:5px"><span>Discount</span><span>-'+f$(q.discount)+'</span></div>':'')+
    '<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;padding:10px 0;border-top:2px solid var(--bd)">'+
      '<span style="color:var(--t1)">TOTAL</span><span style="color:var(--g)">'+f$(q.total)+'</span>'+
    '</div>'+
    (q.terms?'<div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:10px;margin-top:8px;font-size:11px;color:var(--t2);line-height:1.6"><strong>📝 Notes:</strong> '+esc(q.terms)+'</div>':'');

  // Action buttons based on status
  var actions = el('qv-actions'); if(!actions) return;
  var btnHtml = '';

  if(status === 'Draft' || status === 'Sent'){
    btnHtml +=
      '<button type="button" class="btn bgh" style="flex:1" onclick="sendQuoteWhatsApp((biz().quotations||[]).find(function(x){return x.id==='+id+'}))">📱 WhatsApp</button>'+
      '<button type="button" class="btn bgh" style="flex:1" onclick="printQuote('+id+')">🖨 Print</button>'+
      '<button type="button" class="btn bg" style="flex:2" onclick="convertQuoteToSale('+id+')">✅ Convert to Sale</button>';
  }
  if(status === 'Draft' || status === 'Sent'){
    btnHtml += '</div><div style="display:flex;gap:8px;margin-top:6px">'+
      '<button type="button" class="btn bgh" style="flex:1" onclick="updateQuoteStatus('+id+',\'Accepted\')">👍 Mark Accepted</button>'+
      '<button type="button" class="btn ber" style="flex:1" onclick="updateQuoteStatus('+id+',\'Rejected\')">👎 Mark Rejected</button>';
  }
  if(status === 'Accepted'){
    btnHtml += '<button type="button" class="btn bg" style="flex:1" onclick="convertQuoteToSale('+id+')">✅ Convert to Sale</button>';
  }
  actions.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap">'+btnHtml+'</div>';

  openD('d-quote-view');
}

function updateQuoteStatus(id, newStatus) {
  var b = biz(); if(!b) return;
  var q = (b.quotations||[]).find(function(x){ return x.id === id; });
  if(!q) return;
  q.status = newStatus;
  q.updatedAt = Date.now();
  dbSave();
  closeD('d-quote-view');
  renderQuotes();
  toast('Quote ' + q.ref + ' marked as ' + newStatus, 'gd');
}

function convertQuoteToSale(id) {
  var b = biz(); if(!b) return;
  var q = (b.quotations||[]).find(function(x){ return x.id === id; });
  if(!q) return;

  // Pre-fill the New Sale drawer with quote data
  cartItems = q.items.map(function(i){
    return { prodId:i.prodId, name:i.name, qty:i.qty, unitPrice:i.unitPrice, unit:i.unit||'Box', cost:0, maxQty:9999 };
  });

  sv('scust', q.customer);
  sv('scont', q.phone || '');
  sv('sdisc', q.discount || '0');
  currentPayMode = 'Cash';

  // Update drawer title
  var titleEl = document.querySelector('#d-sale .dtitle');
  var subEl   = document.querySelector('#d-sale .dsub');
  if(titleEl) titleEl.textContent = 'Sale from ' + q.ref;
  if(subEl)   subEl.textContent   = 'Quote converted · ' + q.customer;

  // Mark quote as converted
  q.status = 'Converted';
  q.convertedAt = Date.now();
  dbSave();

  closeD('d-quote-view');
  renderCart();
  renderQuickProdGrid();
  updateCart();
  openD('d-sale');
  toast('Quote ' + q.ref + ' ready to complete as a sale', 'gd');
}

function sendQuoteWhatsApp(q) {
  if(!q) return;
  var b   = biz(); if(!b) return;
  var biz_name = b.name || 'SmartStock Pro';
  var biz_phone= b.phone || '';
  var biz_addr = b.address || '';

  var items = q.items.map(function(i){
    return '  • ' + i.name + '\n    ' + i.qty + ' ' + (i.unit||'Box') + '  ×  ' + f$(i.unitPrice) + ' = *' + f$(i.qty*i.unitPrice) + '*';
  }).join('\n');

  var msg =
    '🏪 *' + biz_name.toUpperCase() + '*\n' +
    (biz_addr ? '📍 ' + biz_addr + '\n' : '') +
    (biz_phone ? '📞 ' + biz_phone + '\n' : '') +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 *QUOTATION ' + q.ref + '*\n' +
    '📅 Date: ' + q.date + '\n' +
    '⏳ Valid Until: *' + q.expiryDate + '*\n' +
    '👤 Customer: *' + q.customer + '*\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '*PRODUCTS:*\n' + items + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    (q.discount > 0 ? '🏷 Discount: -' + f$(q.discount) + '\n' : '') +
    '💰 *TOTAL: ' + f$(q.total) + '*\n' +
    '━━━━━━━━━━━━━━━━\n' +
    (q.terms ? '📝 *Notes:* ' + q.terms + '\n' + '━━━━━━━━━━━━━━━━\n' : '') +
    '_To accept this quote, please reply or call us._\n' +
    '_Powered by SmartStock Pro_';

  var phone = (q.phone || '').replace(/[\s\-\(\)]/g,'');
  if(phone && !phone.startsWith('+') && !phone.startsWith('00')){
    phone = phone.startsWith('0') ? '+231' + phone.slice(1) : '+231' + phone;
  }
  var url = phone
    ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg)
    : 'https://wa.me/?text=' + encodeURIComponent(msg);

  window.open(url, '_blank');

  // Update status to Sent
  if(q.status === 'Draft'){
    q.status = 'Sent';
    dbSave();
    renderQuotes();
  }
}

function printQuote(id) {
  var b = biz(); if(!b) return;
  var q = (b.quotations||[]).find(function(x){ return x.id === id; });
  if(!q) return;

  var biz_name  = b.name || 'SmartStock Pro';
  var biz_phone = b.phone || '';
  var biz_addr  = b.address || '';

  var itemRows = q.items.map(function(i){
    return '<tr>'+
      '<td style="padding:8px 12px;border-bottom:1px solid #eee">'+i.name+'</td>'+
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">'+i.qty+' '+i.unit+'</td>'+
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">'+f$(i.unitPrice)+'</td>'+
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700">'+f$(i.qty*i.unitPrice)+'</td>'+
    '</tr>';
  }).join('');

  // Get business logo if available
  var biz_logo = b.logo || b.logoUrl || '';

  var w = window.open('','_blank','width=800,height=900');
  w.document.write('<!DOCTYPE html><html><head><title>'+q.ref+'</title>'+
  '<style>body{font-family:Arial,sans-serif;margin:0;padding:30px;color:#111;max-width:700px;margin:0 auto}'+
  'h1{font-size:24px;margin:0}'+
  'table{width:100%;border-collapse:collapse;margin:20px 0}'+
  'th{background:#f5f5f5;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em}'+
  'th.tr{text-align:right}.total-row{font-weight:700;font-size:16px}'+
  '.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700}'+
  '@media print{button{display:none}}</style></head><body>'+
  '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #1d4ed8;margin-bottom:20px">'+
    '<div style="display:flex;align-items:center;gap:14px">'+
    (biz_logo ? '<img src="'+biz_logo+'" style="width:64px;height:64px;object-fit:contain;border-radius:8px">' : '')+
    '<div><h1 style="color:#1d4ed8">'+biz_name+'</h1>'+
    (biz_addr?'<div style="color:#666;margin-top:4px;font-size:13px">📍 '+biz_addr+'</div>':'')+
    (biz_phone?'<div style="color:#666;font-size:13px">📞 '+biz_phone+'</div>':'')+
    '</div></div>'+
    '<div style="text-align:right">'+
      '<div style="font-size:20px;font-weight:900;color:#1d4ed8">QUOTATION</div>'+
      '<div style="font-size:18px;font-weight:700">'+q.ref+'</div>'+
      '<div style="color:#666;font-size:13px">Date: '+q.date+'</div>'+
      '<div style="color:#e11d48;font-size:13px">Valid Until: '+q.expiryDate+'</div>'+
    '</div>'+
  '</div>'+
  '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:20px">'+
    '<div style="font-size:11px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:4px">Bill To</div>'+
    '<div style="font-size:16px;font-weight:700">'+q.customer+'</div>'+
    (q.phone?'<div style="color:#666">'+q.phone+'</div>':'')+
  '</div>'+
  '<table><thead><tr>'+
    '<th>Product</th><th>Qty</th><th class="tr">Unit Price</th><th class="tr">Total</th>'+
  '</tr></thead><tbody>'+itemRows+'</tbody></table>'+
  (q.discount>0?'<div style="text-align:right;font-size:14px;color:#666;margin-bottom:6px">Discount: -'+f$(q.discount)+'</div>':'')+
  '<div style="text-align:right;font-size:22px;font-weight:900;padding:12px 0;border-top:2px solid #111">TOTAL: '+f$(q.total)+'</div>'+
  (q.terms?'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px;margin-top:16px;font-size:12px;color:#1e40af"><strong>📝 Notes:</strong><br>'+q.terms+'</div>':'')+
  '<div style="text-align:center;margin-top:30px;font-size:11px;color:#999">Generated by SmartStock Pro</div>'+
  '<div style="text-align:center;margin-top:10px"><button onclick="window.print()" style="padding:10px 24px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">🖨 Print</button></div>'+
  '</body></html>');
  w.document.close();
}



function openQuotesPage() {
  renderQuotes();
  openD('d-quotes-page');
}


// ═══════════════════════════════════════════════════════════════════
//  WAREHOUSE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

function openWarehousePage() {
  renderWarehouses();
  openD('d-warehouses');
}

function renderWarehouses() {
  var b = biz(); if(!b) return;
  var cont = el('wh-list'); if(!cont) return;
  var whs = b.warehouses || [];

  if(!whs.length) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">No warehouses yet</div>';
    return;
  }

  cont.innerHTML = whs.map(function(wh) {
    // Calculate total stock value in this warehouse
    var totalItems = 0;
    (b.products||[]).forEach(function(p) {
      if(p.warehouseStock && p.warehouseStock[wh.id]) totalItems += p.warehouseStock[wh.id];
    });
    return '<div style="background:var(--s2);border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:800;color:var(--t1)">🏭 ' + esc(wh.name) + (wh.isDefault?' <span style="font-size:10px;color:var(--g);font-weight:700">(Default)</span>':'') + '</div>' +
          (wh.location ? '<div style="font-size:12px;color:var(--t3);margin-top:3px">📍 ' + esc(wh.location) + '</div>' : '') +
        '</div>' +
        '<div style="text-align:right">' +
          '<div style="font-size:18px;font-weight:900;color:var(--g)">' + totalItems + '</div>' +
          '<div style="font-size:10px;color:var(--t3)">total units</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd);display:flex;gap:7px">' +
        '<button type="button" class="btn bgh bsm" style="flex:1" onclick="viewWarehouseStock(' + wh.id + ')">📦 View Stock</button>' +
        (!wh.isDefault ? '<button type="button" class="btn ber bsm" style="flex:1" onclick="deleteWarehouse(' + wh.id + ')">🗑 Remove</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function openNewWarehouse() {
  sv('wh-name',''); sv('wh-location','');
  el('wh-form-title').textContent = 'Add Warehouse';
  openD('d-new-wh');
  setTimeout(function(){ el('wh-name') && el('wh-name').focus(); }, 300);
}

function saveWarehouse(_saveMode) {
  var b = biz(); if(!b) return;
  var name = gv('wh-name');
  if(!name) { toast('Warehouse name required','er'); return; }
  var wh = { id: b.nextWhId++, name: name, location: gv('wh-location'), isDefault: false, createdAt: Date.now() };
  if(!b.warehouses) b.warehouses = [];
  b.warehouses.push(wh);
  // Initialize stock for all existing products
  (b.products||[]).forEach(function(p) {
    if(!p.warehouseStock) p.warehouseStock = {};
    if(!p.warehouseStock[wh.id]) p.warehouseStock[wh.id] = 0;
  });
  dbSave();
  renderWarehouses();
  toast('Warehouse "' + name + '" added', 'gd');
  if(_saveMode==='addnew'){ setTimeout(function(){openNewWarehouse();},150); }
  else { closeD('d-new-wh'); }
}

function deleteWarehouse(id) {
  var b = biz(); if(!b) return;
  var wh = (b.warehouses||[]).find(function(x){ return x.id === id; });
  if(!wh) return;
  showConf('🗑','Remove Warehouse?','All stock in this warehouse will be removed. This cannot be undone.', function() {
    b.warehouses = (b.warehouses||[]).filter(function(x){ return x.id !== id; });
    (b.products||[]).forEach(function(p) { if(p.warehouseStock) delete p.warehouseStock[id]; });
    dbSave(); renderWarehouses(); toast('Warehouse removed','gd');
  });
}

function viewWarehouseStock(whId) {
  var b = biz(); if(!b) return;
  var wh = (b.warehouses||[]).find(function(x){ return x.id === whId; });
  if(!wh) return;
  var prods = (b.products||[]).filter(function(p){ return p.status !== 'deleted'; });
  var rows = prods.map(function(p) {
    var qty = (p.warehouseStock && p.warehouseStock[whId]) ? p.warehouseStock[whId] : 0;
    var color = qty <= 0 ? 'var(--er)' : qty <= (p.lowLevel||5) ? 'var(--wa)' : 'var(--ok)';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--bd);font-size:13px">' +
      '<div style="font-weight:600;color:var(--t1)">' + esc(p.name) + '</div>' +
      '<div style="font-weight:800;color:' + color + '">' + qty + ' ' + (p.unit||'Box') + '</div>' +
    '</div>';
  }).join('');

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.7);display:flex;align-items:flex-end';
  overlay.innerHTML = '<div style="width:100%;max-height:80vh;background:var(--s1);border-radius:18px 18px 0 0;overflow:hidden;display:flex;flex-direction:column">' +
    '<div style="padding:14px 16px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center">' +
      '<div><div style="font-family:var(--fd);font-size:16px;font-weight:900;color:var(--t1)">🏭 ' + esc(wh.name) + '</div>' +
      '<div style="font-size:11px;color:var(--t3)">Current stock levels</div></div>' +
      '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:var(--s2);border:1px solid var(--bd);border-radius:99px;width:30px;height:30px;cursor:pointer;font-size:14px;color:var(--t2)">✕</button>' +
    '</div>' +
    '<div style="overflow-y:auto;flex:1">' + (rows||'<div style="padding:20px;text-align:center;color:var(--t3)">No products</div>') + '</div>' +
  '</div>';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════════════════════════════════
//  SUPPLIER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

var sInvItems = [];
var editingSuppId = null;

function openSuppliersPage() {
  renderSuppInvoices();
  renderSuppList();
  openD('d-suppliers');
}

function switchSuppTab(tab) {
  el('supp-tab-invoices').style.background  = tab==='invoices' ? 'var(--gd)' : 'transparent';
  el('supp-tab-invoices').style.color       = tab==='invoices' ? 'var(--g)'  : 'var(--t3)';
  el('supp-tab-invoices').style.borderBottomColor = tab==='invoices' ? 'var(--g)' : 'transparent';
  el('supp-tab-suppliers').style.background = tab==='suppliers' ? 'var(--gd)' : 'transparent';
  el('supp-tab-suppliers').style.color      = tab==='suppliers' ? 'var(--g)'  : 'var(--t3)';
  el('supp-tab-suppliers').style.borderBottomColor = tab==='suppliers' ? 'var(--g)' : 'transparent';
  el('supp-panel-invoices').style.display  = tab==='invoices'  ? '' : 'none';
  el('supp-panel-suppliers').style.display = tab==='suppliers' ? '' : 'none';
}

// ── Suppliers CRUD ─────────────────────────────────────────
function openNewSupplier(id) {
  var b = biz(); if(!b) return;
  editingSuppId = id || null;
  if(id) {
    var s = (b.suppliers||[]).find(function(x){ return x.id===id; });
    if(s){ sv('supp-name', s.name); sv('supp-phone', s.phone||''); }
    el('supp-form-title').textContent = 'Edit Supplier';
  } else {
    sv('supp-name',''); sv('supp-phone','');
    el('supp-form-title').textContent = 'Add Supplier';
  }
  openD('d-new-supplier');
  setTimeout(function(){ el('supp-name') && el('supp-name').focus(); }, 300);
}

function saveSupplier(_saveMode) {
  var b = biz(); if(!b) return;
  var name = gv('supp-name');
  if(!name){ toast('Supplier name required','er'); return; }
  if(editingSuppId) {
    var s = (b.suppliers||[]).find(function(x){ return x.id===editingSuppId; });
    if(s){ s.name=name; s.phone=gv('supp-phone'); }
  } else {
    if(!b.suppliers) b.suppliers=[];
    b.suppliers.push({ id:b.nextSuppId++, name:name, phone:gv('supp-phone'), totalOwed:0, createdAt:Date.now() });
  }
  dbSave(); renderSuppList();
  toast(editingSuppId ? 'Supplier updated' : 'Supplier added', 'gd');
  if(_saveMode==='addnew' && !editingSuppId){ setTimeout(function(){openNewSupplier();},150); }
  else { closeD('d-new-supplier'); }
}

function renderSuppList() {
  var b = biz(); if(!b) return;
  var cont = el('supp-list'); if(!cont) return;
  var supps = b.suppliers||[];
  if(!supps.length) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)"><div style="font-size:32px;margin-bottom:8px">🏭</div><div>No suppliers yet</div><div style="font-size:12px;margin-top:4px">Tap + Add Supplier</div></div>';
    return;
  }
  cont.innerHTML = supps.map(function(s) {
    var invCount = (b.suppInvoices||[]).filter(function(i){ return i.supplierId===s.id && i.status!=='Received'; }).length;
    return '<div style="background:var(--s2);border:1px solid var(--bd);border-radius:12px;padding:13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:center">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:800;color:var(--t1)">🏭 ' + esc(s.name) + '</div>' +
        (s.phone ? '<div style="font-size:12px;color:var(--t3)">📞 ' + esc(s.phone) + '</div>' : '') +
        (s.totalOwed>0 ? '<div style="font-size:12px;font-weight:700;color:var(--er);margin-top:3px">Owed: ' + f$(s.totalOwed) + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">' +
        (invCount>0 ? '<span style="background:var(--erb);color:var(--er);font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px">' + invCount + ' pending</span>' : '') +
        '<div style="display:flex;gap:5px">' +
          '<button type="button" class="btn bgh bsm" onclick="openNewSupplier(' + s.id + ')">✏️</button>' +
          '<button type="button" class="btn ber bsm" onclick="deleteSupplier(' + s.id + ')">🗑</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function deleteSupplier(id) {
  var b = biz(); if(!b) return;
  showConf('🗑','Remove Supplier?','Supplier will be removed. Invoices will remain.', function(){
    b.suppliers=(b.suppliers||[]).filter(function(x){return x.id!==id;});
    dbSave(); renderSuppList(); toast('Supplier removed','gd');
  });
}

// ── Supplier Invoices ──────────────────────────────────────
function openNewSuppInvoice() {
  var b = biz(); if(!b) return;
  sInvItems = [];
  // Fill supplier dropdown
  var suppSel = el('sinv-suppid');
  if(suppSel) {
    var supps = b.suppliers||[];
    if(!supps.length){ toast('Add a supplier first','er'); switchSuppTab('suppliers'); return; }
    suppSel.innerHTML = supps.map(function(s){ return '<option value="'+s.id+'">'+esc(s.name)+'</option>'; }).join('');
  }
  // Fill warehouse dropdown
  var whSel = el('sinv-whid');
  if(whSel) {
    whSel.innerHTML = (b.warehouses||[]).map(function(w){ return '<option value="'+w.id+'"'+(w.isDefault?' selected':'')+'>'+esc(w.name)+'</option>'; }).join('');
  }
  sv('sinv-date', today());
  sv('sinv-expected',''); sv('sinv-ref',''); sv('sinv-paydue','');
  renderSInvItems();
  updateSInvTotal();
  openD('d-sinv-new');
}

function addSInvItem() {
  var b = biz(); if(!b) return;
  var prods = (b.products||[]).filter(function(p){ return p.status!=='deleted'; });
  if(!prods.length){ toast('Add products first','er'); return; }
  sInvItems.push({ prodId:prods[0].id, name:prods[0].name, qtyOrdered:1, unitCost:prods[0].cost||0, unit:prods[0].unit||'Box', qtyReceived:0, status:'Pending' });
  renderSInvItems();
  updateSInvTotal();
}

function renderSInvItems() {
  var b = biz(); if(!b) return;
  var prods = (b.products||[]).filter(function(p){ return p.status!=='deleted'; });
  var cont = el('sinv-items'); if(!cont) return;
  if(!sInvItems.length){
    cont.innerHTML='<div style="padding:14px;text-align:center;font-size:12px;color:var(--t3)">No items — tap + Add Item</div>';
    return;
  }
  cont.innerHTML = sInvItems.map(function(item,idx){
    var opts = prods.map(function(p){ return '<option value="'+p.id+'"'+(p.id===item.prodId?' selected':'')+'>'+esc(p.name)+'</option>'; }).join('');
    return '<div style="padding:10px 13px;border-bottom:1px solid var(--bd);display:grid;gap:6px">' +
      '<div style="display:flex;gap:6px">' +
        '<select class="fi" style="flex:1;padding:7px 9px;font-size:12px" onchange="onSInvProdChange('+idx+',this.value)">'+opts+'</select>' +
        '<button type="button" onclick="sInvItems.splice('+idx+',1);renderSInvItems();updateSInvTotal()" style="background:var(--erb);border:none;border-radius:8px;padding:6px 9px;color:var(--er);cursor:pointer;flex-shrink:0">✕</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
        '<div><label style="font-size:9px;color:var(--t3);font-family:var(--fm);text-transform:uppercase;font-weight:700">Qty ('+esc(item.unit)+')</label>' +
        '<input type="number" class="fi" style="padding:7px 9px;font-size:13px" value="'+item.qtyOrdered+'" min="0.01" step="0.01" oninput="sInvItems['+idx+'].qtyOrdered=parseFloat(this.value)||0;updateSInvTotal()"></div>' +
        '<div><label style="font-size:9px;color:var(--t3);font-family:var(--fm);text-transform:uppercase;font-weight:700">Unit Cost ($)</label>' +
        '<input type="number" class="fi" style="padding:7px 9px;font-size:13px" value="'+item.unitCost+'" min="0" step="0.01" oninput="sInvItems['+idx+'].unitCost=parseFloat(this.value)||0;updateSInvTotal()"></div>' +
      '</div>' +
      '<div style="text-align:right;font-size:12px;font-weight:700;color:var(--g)">Line: '+f$(item.qtyOrdered*item.unitCost)+'</div>' +
    '</div>';
  }).join('');
}

function onSInvProdChange(idx, prodId) {
  var b=biz(); if(!b) return;
  var p=(b.products||[]).find(function(x){return x.id===parseInt(prodId);});
  if(p){sInvItems[idx].prodId=p.id;sInvItems[idx].name=p.name;sInvItems[idx].unitCost=p.cost||0;sInvItems[idx].unit=p.unit||'Box';renderSInvItems();updateSInvTotal();}
}

function updateSInvTotal() {
  var tot=sInvItems.reduce(function(a,i){return a+i.qtyOrdered*i.unitCost;},0);
  if(el('sinv-total'))el('sinv-total').textContent=f$(tot);
}

function saveSuppInvoice(_saveMode) {
  var b=biz();if(!b)return;
  var suppId=parseInt(el('sinv-suppid')?el('sinv-suppid').value:0);
  var whId=parseInt(el('sinv-whid')?el('sinv-whid').value:1);
  var date=el('sinv-date')?el('sinv-date').value:today();
  var expected=gv('sinv-expected');
  var ref=gv('sinv-ref');
  var paydue=gv('sinv-paydue');
  var total=sInvItems.reduce(function(a,i){return a+i.qtyOrdered*i.unitCost;},0);
  var inv={
    id:b.nextSInvId++,ref:'SINV-'+String(b.nextSInvId-1).padStart(4,'0'),
    supplierId:suppId,warehouseId:whId,date:date,expectedDate:expected,
    supplierRef:ref,paymentDueDate:paydue,
    status:'Open',
    items:sInvItems.map(function(i){return{prodId:i.prodId,name:i.name,qtyOrdered:i.qtyOrdered,qtyReceived:0,unitCost:i.unitCost,unit:i.unit,status:'Pending'};}),
    total:total,paid:0,
    createdAt:Date.now(),createdBy:CU?CU.name:'Unknown'
  };
  if(!b.suppInvoices)b.suppInvoices=[];
  b.suppInvoices.unshift(inv);
  // Add to supplier owed
  var supp=(b.suppliers||[]).find(function(s){return s.id===suppId;});
  if(supp)supp.totalOwed=(supp.totalOwed||0)+total;
  dbSave();renderSuppInvoices();
  toast(inv.ref+' created','gd');
  if(_saveMode==='addnew'){ setTimeout(function(){openNewSuppInvoice();},150); }
  else { closeD('d-sinv-new'); }
}

function renderSuppInvoices() {
  var b=biz();if(!b)return;
  var cont=el('sinv-list');if(!cont)return;
  var filter=el('sinv-filter')?el('sinv-filter').value:'';
  var invs=(b.suppInvoices||[]).filter(function(i){return !filter||i.status===filter;});
  if(!invs.length){
    cont.innerHTML='<div style="text-align:center;padding:30px;color:var(--t3)"><div style="font-size:32px;margin-bottom:8px">📋</div><div>No invoices yet</div></div>';
    return;
  }
  var stColor={'Open':'#3b82f6','In Transit':'var(--wa)','Received':'var(--ok)','Disputed':'var(--er)'};
  cont.innerHTML=invs.map(function(inv){
    var supp=(b.suppliers||[]).find(function(s){return s.id===inv.supplierId;});
    var wh=(b.warehouses||[]).find(function(w){return w.id===inv.warehouseId;});
    var pendingItems=inv.items.filter(function(i){return i.status!=='Received';}).length;
    var sc=stColor[inv.status]||'var(--t3)';
    return '<div style="background:var(--s2);border:1px solid var(--bd);border-left:3px solid '+sc+';border-radius:12px;padding:13px;margin-bottom:9px;cursor:pointer" onclick="viewSuppInvoice('+inv.id+')">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
        '<div><div style="font-size:13px;font-weight:800;color:var(--t1)">'+esc(inv.ref)+(inv.supplierRef?' · <span style="color:var(--t3);font-size:11px">'+esc(inv.supplierRef)+'</span>':'')+'</div>' +
        '<div style="font-size:11px;color:var(--t3)">'+esc(supp?supp.name:'Unknown Supplier')+' · '+inv.date+'</div></div>' +
        '<div style="text-align:right"><div style="font-size:13px;font-weight:800;color:var(--g)">'+f$(inv.total)+'</div>' +
        '<div style="font-size:10px;font-weight:700;color:'+sc+'">'+inv.status+'</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;font-size:11px;color:var(--t3)">' +
        '<span>🏭 '+(wh?esc(wh.name):'Warehouse')+'</span>' +
        (pendingItems>0?'<span style="color:var(--wa)">⏳ '+pendingItems+' item'+(pendingItems!==1?'s':'')+' pending</span>':'<span style="color:var(--ok)">✅ All received</span>')+
        (inv.paymentDueDate?'<span>💰 Due: '+inv.paymentDueDate+'</span>':'')+
      '</div>' +
    '</div>';
  }).join('');
}

function viewSuppInvoice(id) {
  var b=biz();if(!b)return;
  var inv=(b.suppInvoices||[]).find(function(x){return x.id===id;});
  if(!inv)return;
  var supp=(b.suppliers||[]).find(function(s){return s.id===inv.supplierId;});
  var wh=(b.warehouses||[]).find(function(w){return w.id===inv.warehouseId;});

  el('sinvd-ref').textContent=inv.ref;
  el('sinvd-sub').textContent=(supp?supp.name:'Supplier')+' · '+inv.status;

  var body=el('sinvd-body');if(!body)return;
  var stColor={'Open':'#3b82f6','In Transit':'var(--wa)','Received':'var(--ok)','Disputed':'var(--er)'};
  var sc=stColor[inv.status]||'var(--t3)';

  // Header info
  var info='<div style="padding:12px 14px;border-bottom:1px solid var(--bd);background:var(--s2)">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">' +
      '<div><span style="color:var(--t3)">Supplier: </span><strong>'+esc(supp?supp.name:'—')+'</strong></div>' +
      '<div><span style="color:var(--t3)">Warehouse: </span><strong>'+esc(wh?wh.name:'—')+'</strong></div>' +
      '<div><span style="color:var(--t3)">Date: </span><strong>'+inv.date+'</strong></div>' +
      (inv.expectedDate?'<div><span style="color:var(--t3)">Expected: </span><strong>'+inv.expectedDate+'</strong></div>':'')+
      (inv.paymentDueDate?'<div><span style="color:var(--t3)">Pay Due: </span><strong style="color:var(--er)">'+inv.paymentDueDate+'</strong></div>':'')+
      '<div><span style="color:var(--t3)">Status: </span><strong style="color:'+sc+'">'+inv.status+'</strong></div>' +
    '</div>' +
  '</div>';

  // Items with receive buttons
  var items=inv.items.map(function(item,idx){
    var isSt={'Pending':'var(--wa)','Partially Received':'#3b82f6','Received':'var(--ok)'};
    var ic=isSt[item.status]||'var(--t3)';
    var canReceive=item.status!=='Received';
    return '<div style="padding:11px 14px;border-bottom:1px solid var(--bd)">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
        '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--t1)">'+esc(item.name)+'</div>' +
        '<div style="font-size:11px;color:var(--t3)">Ordered: '+item.qtyOrdered+' '+esc(item.unit||'')+'  ·  '+f$(item.unitCost)+' each</div>' +
        '<div style="font-size:11px;font-weight:700;color:'+ic+'">'+item.status+' · Received: '+item.qtyReceived+'/'+item.qtyOrdered+'</div></div>' +
        '<div style="font-weight:700;font-size:13px;color:var(--g)">'+f$(item.qtyOrdered*item.unitCost)+'</div>' +
      '</div>' +
      (canReceive?
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<input type="number" id="rcv-qty-'+idx+'" class="fi" style="width:80px;padding:6px 9px;font-size:13px" placeholder="Qty" min="0.01" max="'+(item.qtyOrdered-item.qtyReceived)+'" value="'+(item.qtyOrdered-item.qtyReceived)+'">' +
          '<button type="button" class="btn bok bsm" style="flex:1" onclick="receiveItem('+id+','+idx+')">✅ Mark Received</button>' +
        '</div>'
      :'')+
    '</div>';
  }).join('');

  body.innerHTML=info+items+
    '<div style="padding:12px 14px;display:flex;justify-content:space-between;font-size:15px;font-weight:900;background:var(--s2)">' +
      '<span>Total</span><span style="color:var(--g)">'+f$(inv.total)+'</span>' +
    '</div>'+
    (inv.paid>0?'<div style="padding:8px 14px;font-size:12px;color:var(--t2)">Paid: '+f$(inv.paid)+' · Remaining: '+f$(inv.total-inv.paid)+'</div>':'');

  // Actions
  var actions=el('sinvd-actions');if(!actions)return;
  var btns='';
  if(inv.status==='Open')
    btns+='<button type="button" class="btn bgh" style="flex:1" onclick="updateSInvStatus('+id+',\'In Transit\')">🚛 Mark In Transit</button>';
  if(inv.status==='In Transit'||inv.status==='Open')
    btns+='<button type="button" class="btn ber" style="flex:1" onclick="updateSInvStatus('+id+',\'Disputed\')">⚠ Dispute</button>';
  btns+='<button type="button" class="btn bgh" style="flex:1" onclick="confirmDeliveryWhatsApp('+id+')">📱 WhatsApp</button>';
  btns+='<button type="button" class="btn bgh" style="flex:1" onclick="printSuppInvoice('+id+')">🖨 Print</button>';
  if(inv.status!=='Received')
    btns+='<button type="button" class="btn bg" style="flex:1" onclick="recordSuppPayment('+id+')">💰 Record Payment</button>';
  actions.innerHTML='<div style="display:flex;gap:7px;flex-wrap:wrap">'+btns+'</div>';

  openD('d-sinv-detail');
}

function receiveItem(invId, itemIdx) {
  var b=biz();if(!b)return;
  var inv=(b.suppInvoices||[]).find(function(x){return x.id===invId;});
  if(!inv)return;
  var item=inv.items[itemIdx];if(!item)return;
  var qtyInput=el('rcv-qty-'+itemIdx);
  var qty=parseFloat(qtyInput?qtyInput.value:0)||0;
  if(qty<=0){toast('Enter quantity to receive','er');return;}
  var maxQty=item.qtyOrdered-item.qtyReceived;
  if(qty>maxQty)qty=maxQty;

  item.qtyReceived+=qty;
  item.status=item.qtyReceived>=item.qtyOrdered?'Received':'Partially Received';

  // Auto-update warehouse stock
  var wh=(b.warehouses||[]).find(function(w){return w.id===inv.warehouseId;});
  var prod=(b.products||[]).find(function(p){return p.id===item.prodId;});
  if(prod){
    if(!prod.warehouseStock)prod.warehouseStock={};
    if(!prod.warehouseStock[inv.warehouseId])prod.warehouseStock[inv.warehouseId]=0;
    prod.warehouseStock[inv.warehouseId]+=qty;
    prod.qty+=qty; // update total
    // Log to stock history
    if(!b.stockHistory)b.stockHistory=[];
    b.stockHistory.unshift({id:b.nextHistId++,date:today(),type:'IN',prodName:prod.name,qty:qty,by:CU?CU.name:'Staff',ref:inv.ref,notes:'Supplier delivery · '+(wh?wh.name:'Warehouse'),ts:Date.now()});
  }

  // Check if all items received
  var allReceived=inv.items.every(function(i){return i.status==='Received';});
  if(allReceived)inv.status='Received';
  else if(inv.items.some(function(i){return i.qtyReceived>0;}))inv.status='In Transit';

  dbSave();
  toast(qty+' '+esc(item.unit||'units')+' of '+esc(item.name)+' received into '+(wh?wh.name:'warehouse'),'gd');
  viewSuppInvoice(invId); // refresh view
  renderSuppInvoices();
  renderProducts();
  renderDash();
}

function updateSInvStatus(id, status) {
  var b=biz();if(!b)return;
  var inv=(b.suppInvoices||[]).find(function(x){return x.id===id;});
  if(!inv)return;
  inv.status=status;inv.updatedAt=Date.now();
  dbSave();closeD('d-sinv-detail');renderSuppInvoices();
  toast('Invoice '+inv.ref+' marked '+status,'gd');
}

function recordSuppPayment(id) {
  var b=biz();if(!b)return;
  var inv=(b.suppInvoices||[]).find(function(x){return x.id===id;});
  if(!inv)return;
  var remaining=inv.total-inv.paid;
  var amt=prompt('Record payment for '+inv.ref+'\nRemaining: '+f$(remaining)+'\n\nEnter amount paid:');
  if(!amt)return;
  var amount=parseFloat(amt)||0;
  if(amount<=0)return;
  inv.paid+=amount;
  // Update supplier owed
  var supp=(b.suppliers||[]).find(function(s){return s.id===inv.supplierId;});
  if(supp)supp.totalOwed=Math.max(0,(supp.totalOwed||0)-amount);
  dbSave();toast('Payment of '+f$(amount)+' recorded','gd');
  viewSuppInvoice(id);
  renderSuppList();
}

function confirmDeliveryWhatsApp(id) {
  var b=biz();if(!b)return;
  var inv=(b.suppInvoices||[]).find(function(x){return x.id===id;});
  if(!inv)return;
  var supp=(b.suppliers||[]).find(function(s){return s.id===inv.supplierId;});
  var wh=(b.warehouses||[]).find(function(w){return w.id===inv.warehouseId;});
  var bname=b.name||'SmartStock Pro';
  var receivedItems=inv.items.filter(function(i){return i.qtyReceived>0;});
  var pendingItems=inv.items.filter(function(i){return i.status!=='Received';});

  var msg=
    '🏪 *'+bname.toUpperCase()+'*\n'+
    '━━━━━━━━━━━━━━━━\n'+
    '✅ *DELIVERY CONFIRMATION*\n'+
    '📋 Invoice: *'+inv.ref+'*'+(inv.supplierRef?' ('+inv.supplierRef+')':'')+'\n'+
    '📅 Date: '+today()+'\n'+
    '🏭 Warehouse: '+(wh?wh.name:'Main')+'\n'+
    '━━━━━━━━━━━━━━━━\n'+
    '*Items Received:*\n'+
    receivedItems.map(function(i){return '  ✅ '+i.name+': '+i.qtyReceived+'/'+i.qtyOrdered+' '+i.unit;}).join('\n')+'\n'+
    (pendingItems.length?'\n*Still Pending:*\n'+pendingItems.map(function(i){return '  ⏳ '+i.name+': '+(i.qtyOrdered-i.qtyReceived)+' '+i.unit+' remaining';}).join('\n')+'\n':'')+
    '━━━━━━━━━━━━━━━━\n'+
    '_Thank you — '+bname+'_';

  var phone=(supp&&supp.phone?supp.phone:'').replace(/[\s\-\(\)]/g,'');
  if(phone&&!phone.startsWith('+')&&!phone.startsWith('00')){
    phone=phone.startsWith('0')?'+231'+phone.slice(1):'+231'+phone;
  }
  var url=phone?'https://wa.me/'+phone+'?text='+encodeURIComponent(msg):'https://wa.me/?text='+encodeURIComponent(msg);
  window.open(url,'_blank');
}

function printSuppInvoice(id) {
  var b=biz();if(!b)return;
  var inv=(b.suppInvoices||[]).find(function(x){return x.id===id;});
  if(!inv)return;
  var supp=(b.suppliers||[]).find(function(s){return s.id===inv.supplierId;});
  var wh=(b.warehouses||[]).find(function(w){return w.id===inv.warehouseId;});
  var bname=b.name||'SmartStock Pro';
  var stColor={'Open':'#3b82f6','In Transit':'#d97706','Received':'#16a34a','Disputed':'#dc2626'};

  var rows=inv.items.map(function(i){
    var ic=stColor[i.status]||'#666';
    return '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">'+i.name+'</td>'+
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">'+i.qtyOrdered+' '+i.unit+'</td>'+
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">'+f$(i.unitCost)+'</td>'+
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:'+ic+'"><strong>'+i.status+'</strong><br><small>'+i.qtyReceived+'/'+i.qtyOrdered+' received</small></td>'+
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700">'+f$(i.qtyOrdered*i.unitCost)+'</td></tr>';
  }).join('');

  var w=window.open('','_blank','width=900,height=800');
  w.document.write('<!DOCTYPE html><html><head><title>'+inv.ref+'</title>'+
  '<style>body{font-family:Arial,sans-serif;margin:0;padding:30px;color:#111;max-width:750px;margin:0 auto}'+
  'table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#f5f5f5;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase}'+
  'th.tr{text-align:right}@media print{button{display:none}}</style></head><body>'+
  '<div style="display:flex;justify-content:space-between;padding-bottom:20px;border-bottom:3px solid #7c3aed;margin-bottom:20px">'+
    '<div><h1 style="color:#7c3aed;margin:0">'+bname+'</h1></div>'+
    '<div style="text-align:right"><div style="font-size:20px;font-weight:900;color:#7c3aed">SUPPLIER INVOICE</div>'+
    '<div style="font-size:18px;font-weight:700">'+inv.ref+'</div>'+
    (inv.supplierRef?'<div style="color:#666;font-size:13px">Supplier Ref: '+inv.supplierRef+'</div>':'')+
    '<div style="color:#666;font-size:13px">Date: '+inv.date+'</div>'+
    '<div style="font-weight:700;color:'+(stColor[inv.status]||'#666')+'">'+inv.status+'</div></div>'+
  '</div>'+
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">'+
    '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px">'+
    '<div style="font-size:11px;color:#666;font-weight:700;text-transform:uppercase;margin-bottom:4px">Supplier</div>'+
    '<div style="font-size:15px;font-weight:700">'+(supp?supp.name:'—')+'</div>'+
    (supp&&supp.phone?'<div style="color:#666">'+supp.phone+'</div>':'')+
    '</div>'+
    '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px">'+
    '<div style="font-size:11px;color:#666;font-weight:700;text-transform:uppercase;margin-bottom:4px">Destination</div>'+
    '<div style="font-size:15px;font-weight:700">🏭 '+(wh?wh.name:'Main Warehouse')+'</div>'+
    (inv.expectedDate?'<div style="color:#666;font-size:12px">Expected: '+inv.expectedDate+'</div>':'')+
    (inv.paymentDueDate?'<div style="color:#dc2626;font-size:12px;font-weight:700">Payment Due: '+inv.paymentDueDate+'</div>':'')+
    '</div>'+
  '</div>'+
  '<table><thead><tr><th>Product</th><th>Qty</th><th class="tr">Unit Cost</th><th>Status</th><th class="tr">Total</th></tr></thead>'+
  '<tbody>'+rows+'</tbody></table>'+
  '<div style="text-align:right;font-size:22px;font-weight:900;padding:12px 0;border-top:2px solid #111">TOTAL: '+f$(inv.total)+'</div>'+
  (inv.paid>0?'<div style="text-align:right;color:#16a34a;font-weight:700">Paid: '+f$(inv.paid)+' · Remaining: '+f$(inv.total-inv.paid)+'</div>':'')+
  '<div style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 24px;background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">🖨 Print</button></div>'+
  '</body></html>');
  w.document.close();
}



// ── Ask Admin reset request ───────────────────────────────
function sendResetRequest() {
  var un    = gv('fp-admin-user');
  var bname = gv('fp-admin-biz');
  var errEl = el('fp-err-admin');
  function showErr(msg){ if(errEl){errEl.textContent=msg;errEl.style.display='';} }
  if(!un)   { showErr('Enter your username'); return; }
  if(!bname){ showErr('Enter your business name'); return; }
  var matchedBiz = (DB.businesses||[]).find(function(b){
    return b.name && b.name.toLowerCase() === bname.toLowerCase();
  });
  if(!matchedBiz){ showErr('Business not found. Check the exact name.'); return; }
  var admins = (DB.users||[]).filter(function(u){
    return u.businessIds && u.businessIds.indexOf(matchedBiz.id)!==-1 &&
           (u.role==='primaryAdmin'||u.role==='admin');
  });
  if(!admins.length){ showErr('No admin found for this business.'); return; }
  admins.forEach(function(admin){
    if(!DB.notifications) DB.notifications=[];
    DB.notifications.unshift({
      id:Date.now(),type:'password_reset_request',
      message:un+' needs a password reset for '+matchedBiz.name,
      username:un,bizName:bname,for:admin.id,read:false,createdAt:Date.now()
    });
  });
  try{ dbSave(); }catch(e){}
  try{ if(typeof fbPush==='function') fbPush(); }catch(e){}
  if(errEl) errEl.style.display='none';
  toast('Reset request sent to your admin','gd');
  var panel=el('fp-panel-admin');
  if(panel){
    var ok=document.createElement('div');
    ok.style.cssText='background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:10px;font-size:12px;color:var(--ok);margin-top:10px;line-height:1.6';
    ok.innerHTML='✅ Request sent! Your admin will see it in their notifications and share a new temporary password with you.';
    panel.appendChild(ok);
  }
}



// ═══════════════════════════════════════════════════════════════════
//  ORDER FULFILLMENT & PARTIAL DELIVERY SYSTEM
// ═══════════════════════════════════════════════════════════════════

var _fulSaleId = null;  // current sale being fulfilled

// Fulfillment status colors
var FUL_COLORS = {
  'Pending':              '#6b7280',
  'Assigned':             '#3b82f6',
  'In Progress':          '#f59e0b',
  'Partially Fulfilled':  '#f97316',
  'Fulfilled':            '#10b981',
  'Completed':            '#059669',
  'Backordered':          '#dc2626'
};

// Open fulfillment form for a sale
function openFulfillment(saleId) {
  var b = biz(); if(!b) return;
  var s = (b.sales||[]).find(function(x){ return x.id === saleId; });
  if(!s) return;
  _fulSaleId = saleId;

  el('ful-inv-sub').textContent = s.inv + ' — ' + (s.customer||'Walk-in');
  el('ful-date').value = today();

  // Fill staff dropdown
  var staffSel = el('ful-staff');
  if(staffSel){
    var emps = (b.employees||[]).filter(function(e){ return e.status !== 'inactive'; });
    staffSel.innerHTML = '<option value="">— Unassigned —</option>' +
      emps.map(function(e){ return '<option value="'+esc(e.name)+'"'+(s.assignedStaff===e.name?' selected':'')+'>'+esc(e.name)+' ('+esc(e.role||'')+')</option>'; }).join('');
    if(s.assignedStaff) staffSel.value = s.assignedStaff;
  }
  sv('ful-notes','');

  // Order summary
  var totalOrdered = (s.items||[]).reduce(function(a,i){ return a+i.qty; }, 0);
  var totalFulfilled = getFulfilledQty(s);
  var pct = totalOrdered > 0 ? Math.round(totalFulfilled/totalOrdered*100) : 0;
  var stColor = FUL_COLORS[s.fulStatus||'Pending'];

  el('ful-order-summary').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">' +
      '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);font-family:var(--fm);text-transform:uppercase">Ordered</div>'+
        '<div style="font-size:18px;font-weight:900;color:var(--t1)">'+totalOrdered+'</div></div>' +
      '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);font-family:var(--fm);text-transform:uppercase">Delivered</div>'+
        '<div style="font-size:18px;font-weight:900;color:var(--ok)">'+totalFulfilled+'</div></div>' +
      '<div style="text-align:center"><div style="font-size:10px;color:var(--t3);font-family:var(--fm);text-transform:uppercase">Remaining</div>'+
        '<div style="font-size:18px;font-weight:900;color:var(--er)">'+(totalOrdered-totalFulfilled)+'</div></div>' +
    '</div>' +
    '<div style="background:rgba(255,255,255,.06);border-radius:99px;height:8px;overflow:hidden;margin-bottom:8px">'+
      '<div style="height:100%;background:linear-gradient(90deg,#059669,#10b981);width:'+pct+'%;border-radius:99px;transition:width .4s"></div>'+
    '</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:11px">' +
      '<span style="color:var(--t3)">'+pct+'% delivered</span>' +
      '<span style="font-weight:700;color:'+stColor+'">'+esc(s.fulStatus||'Pending')+'</span>' +
    '</div>';

  // Items list
  renderFulItems(s);
  renderFulPreview(s);
  openD('d-fulfil');
}

// Get total qty fulfilled so far for a sale
function getFulfilledQty(s) {
  var total = 0;
  (s.fulfillments||[]).forEach(function(f){
    (f.items||[]).forEach(function(i){ total += i.qtySupplied||0; });
  });
  return total;
}

// Get fulfilled qty for a specific product in a sale
function getFulfilledQtyForProd(s, prodId) {
  var qty = 0;
  (s.fulfillments||[]).forEach(function(f){
    (f.items||[]).forEach(function(i){ if(i.prodId===prodId) qty += i.qtySupplied||0; });
  });
  return qty;
}

// Render items in fulfillment form
function renderFulItems(s) {
  var cont = el('ful-items'); if(!cont) return;
  cont.innerHTML = (s.items||[]).map(function(item, idx){
    var fulfilled = getFulfilledQtyForProd(s, item.prodId);
    var remaining = Math.max(0, item.qty - fulfilled);
    var isDone    = remaining <= 0;
    var lineColor = isDone ? 'var(--ok)' : remaining < item.qty ? '#f97316' : 'var(--t2)';
    return '<div style="padding:11px 14px;border-bottom:1px solid var(--bd)'+(isDone?';opacity:.5':'')+'">'+
      '<div style="display:flex;justify-content:space-between;margin-bottom:7px">'+
        '<div>'+
          '<div style="font-size:13px;font-weight:700;color:var(--t1)">'+esc(item.name)+'</div>'+
          '<div style="font-size:11px;color:var(--t3)">'+
            'Ordered: <strong>'+item.qty+'</strong> · '+
            'Delivered: <strong style="color:var(--ok)">'+fulfilled+'</strong> · '+
            'Remaining: <strong style="color:'+lineColor+'">'+remaining+'</strong>'+
          '</div>'+
        '</div>'+
        '<div style="font-size:12px;font-weight:700;color:var(--g)">'+f$(item.qty*item.unitPrice)+'</div>'+
      '</div>'+
      (isDone ?
        '<div style="font-size:11px;font-weight:700;color:var(--ok);padding:5px 8px;background:var(--ok-dim);border-radius:7px">✅ Fully Delivered</div>' :
        '<div style="display:flex;align-items:center;gap:8px">'+
          '<label style="font-size:11px;color:var(--t3);white-space:nowrap;font-family:var(--fm)">QTY TO DELIVER</label>'+
          '<input type="number" id="ful-qty-'+idx+'" class="fi" style="padding:7px 10px;font-size:13px;font-weight:700;width:90px"'+
          ' value="'+remaining+'" min="0" max="'+remaining+'" step="0.01"'+
          ' oninput="renderFulPreview(null)">'+
          '<span style="font-size:11px;color:var(--t3);white-space:nowrap">of '+remaining+' remaining</span>'+
        '</div>'
      )+
    '</div>';
  }).join('');
}

// Fulfill all remaining items at once
function fulFillAll() {
  var b=biz();if(!b)return;
  var s=(b.sales||[]).find(function(x){return x.id===_fulSaleId;});
  if(!s)return;
  (s.items||[]).forEach(function(item,idx){
    var fulfilled=getFulfilledQtyForProd(s,item.prodId);
    var remaining=Math.max(0,item.qty-fulfilled);
    var input=el('ful-qty-'+idx);
    if(input) input.value=remaining;
  });
  renderFulPreview(null);
}

// Preview totals
function renderFulPreview(s) {
  if(!s){
    var b=biz();if(!b)return;
    s=(b.sales||[]).find(function(x){return x.id===_fulSaleId;});
  }
  if(!s)return;
  var totalNow=0;
  (s.items||[]).forEach(function(item,idx){
    var fulfilled=getFulfilledQtyForProd(s,item.prodId);
    var remaining=Math.max(0,item.qty-fulfilled);
    if(remaining<=0)return;
    var input=el('ful-qty-'+idx);
    var qty=parseFloat(input?input.value:0)||0;
    totalNow+=qty;
  });
  var prev=el('ful-preview');
  if(!prev)return;
  prev.innerHTML=
    '<div style="display:flex;justify-content:space-between;font-size:13px">'+
      '<span style="color:var(--t3)">Items to deliver this session</span>'+
      '<span style="font-weight:800;color:var(--ok)">'+totalNow+' units</span>'+
    '</div>';
}

// Save a fulfillment record
function saveFulfillment(_saveMode) {
  var b=biz();if(!b)return;
  var s=(b.sales||[]).find(function(x){return x.id===_fulSaleId;});
  if(!s)return;

  // Build items supplied this session
  var sessionItems=[];
  (s.items||[]).forEach(function(item,idx){
    var fulfilled=getFulfilledQtyForProd(s,item.prodId);
    var remaining=Math.max(0,item.qty-fulfilled);
    if(remaining<=0)return;
    var input=el('ful-qty-'+idx);
    var qty=parseFloat(input?input.value:0)||0;
    if(qty<=0)return;
    qty=Math.min(qty,remaining); // cap at remaining
    sessionItems.push({prodId:item.prodId,name:item.name,qtyOrdered:item.qty,qtySupplied:qty,unitPrice:item.unitPrice});
  });

  if(!sessionItems.length){toast('Enter quantity to deliver for at least one item','er');return;}

  var staff=el('ful-staff')?el('ful-staff').value:'';
  var date=el('ful-date')?el('ful-date').value:today();
  var notes=gv('ful-notes');
  var ref='FUL-'+s.inv+'-'+String((s.fulfillments||[]).length+1).padStart(2,'0');

  // Create fulfillment record
  var fulfillment={
    id:ref,
    date:date,
    staff:staff,
    notes:notes,
    items:sessionItems,
    totalSupplied:sessionItems.reduce(function(a,i){return a+i.qtySupplied;},0),
    createdAt:Date.now(),
    createdBy:CU?CU.name:'Unknown'
  };

  if(!s.fulfillments)s.fulfillments=[];
  s.fulfillments.push(fulfillment);
  if(staff)s.assignedStaff=staff;

  // Update assigned staff if changed
  if(staff)s.assignedStaff=staff;

  // Auto-calculate fulfillment status
  s.fulStatus=calcFulStatus(s);
  s.updatedAt=Date.now();

  addAdminLog('fulfillment','Delivered '+fulfillment.totalSupplied+' units for '+s.inv,CU?CU.name:'Staff');
  dbSave();
  renderSales();
  renderDash();

  toast(ref+' recorded — '+fulfillment.totalSupplied+' units delivered','gd');

  if(_saveMode==='addnew'){
    // Reset and reopen
    sv('ful-notes','');
    el('ful-date').value=today();
    renderFulItems(s);
    renderFulPreview(s);
    // Update summary
    openFulfillment(_fulSaleId);
  } else {
    closeD('d-fulfil');
  }
}

// Calculate overall fulfillment status based on items delivered
function calcFulStatus(s) {
  var items=s.items||[];
  if(!items.length)return 'Pending';
  var totalOrdered=items.reduce(function(a,i){return a+i.qty;},0);
  var totalFulfilled=getFulfilledQty(s);
  if(totalFulfilled<=0)return 'Pending';
  if(totalFulfilled>=totalOrdered){
    // All delivered — check payment
    return s.payStatus==='PAID'?'Completed':'Fulfilled';
  }
  // Check for backorder (product qty was 0 when sold)
  var hasBackorder=items.some(function(i){
    var b=biz();var p=(b.products||[]).find(function(x){return x.id===i.prodId;});
    return p&&p.qty<0;
  });
  return hasBackorder?'Backordered':'Partially Fulfilled';
}

// View fulfillment history for a sale
function viewFulfillmentHistory(saleId) {
  var b=biz();if(!b)return;
  var s=(b.sales||[]).find(function(x){return x.id===saleId;});
  if(!s)return;

  el('fulfil-hist-sub').textContent=s.inv+' — '+(s.customer||'Walk-in');

  var fuls=s.fulfillments||[];
  var totalOrdered=(s.items||[]).reduce(function(a,i){return a+i.qty;},0);
  var totalFulfilled=getFulfilledQty(s);
  var pct=totalOrdered>0?Math.round(totalFulfilled/totalOrdered*100):0;
  var stColor=FUL_COLORS[s.fulStatus||'Pending'];

  var html=
    // Progress header
    '<div style="padding:14px;background:var(--s2);border-bottom:1px solid var(--bd)">'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">'+
        '<div style="text-align:center"><div style="font-size:9px;color:var(--t3);font-family:var(--fm);text-transform:uppercase">Ordered</div>'+
          '<div style="font-size:20px;font-weight:900;color:var(--t1)">'+totalOrdered+'</div></div>'+
        '<div style="text-align:center"><div style="font-size:9px;color:var(--t3);font-family:var(--fm);text-transform:uppercase">Delivered</div>'+
          '<div style="font-size:20px;font-weight:900;color:var(--ok)">'+totalFulfilled+'</div></div>'+
        '<div style="text-align:center"><div style="font-size:9px;color:var(--t3);font-family:var(--fm);text-transform:uppercase">Remaining</div>'+
          '<div style="font-size:20px;font-weight:900;color:var(--er)">'+(totalOrdered-totalFulfilled)+'</div></div>'+
      '</div>'+
      '<div style="background:rgba(255,255,255,.06);border-radius:99px;height:8px;overflow:hidden;margin-bottom:6px">'+
        '<div style="height:100%;background:linear-gradient(90deg,#059669,#10b981);width:'+pct+'%;border-radius:99px"></div>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:11px">'+
        '<span style="color:var(--t3)">'+pct+'% fulfilled</span>'+
        '<span style="font-weight:700;color:'+stColor+'">'+esc(s.fulStatus||'Pending')+'</span>'+
      '</div>'+
    '</div>'+

    // Item status table
    '<div style="padding:12px 14px;border-bottom:1px solid var(--bd)">'+
      '<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;font-family:var(--fm);margin-bottom:8px">Item Status</div>'+
      (s.items||[]).map(function(item){
        var ful=getFulfilledQtyForProd(s,item.prodId);
        var rem=Math.max(0,item.qty-ful);
        var isDone=rem<=0;
        var pct2=item.qty>0?Math.round(ful/item.qty*100):0;
        return '<div style="margin-bottom:10px">'+
          '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">'+
            '<span style="font-weight:600;color:var(--t1)">'+esc(item.name)+'</span>'+
            '<span style="color:var(--t3)">'+ful+'/'+item.qty+(isDone?' ✅':'')+'</span>'+
          '</div>'+
          '<div style="background:rgba(255,255,255,.06);border-radius:99px;height:5px;overflow:hidden">'+
            '<div style="height:100%;background:'+(isDone?'#059669':'#f97316')+';width:'+pct2+'%;border-radius:99px"></div>'+
          '</div>'+
        '</div>';
      }).join('')+
    '</div>';

    // Fulfillment sessions
    if(!fuls.length){
      html+='<div style="padding:24px;text-align:center;color:var(--t3)"><div style="font-size:28px;margin-bottom:8px">📦</div><div>No deliveries recorded yet</div></div>';
    } else {
      html+='<div style="padding:0">'+
        '<div style="padding:10px 14px;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;font-family:var(--fm);border-bottom:1px solid var(--bd)">Delivery Sessions</div>'+
        fuls.map(function(f){
          return '<div style="padding:12px 14px;border-bottom:1px solid var(--bd)">'+
            '<div style="display:flex;justify-content:space-between;margin-bottom:6px">'+
              '<div>'+
                '<div style="font-size:12px;font-weight:800;color:var(--t1)">'+esc(f.id)+'</div>'+
                '<div style="font-size:11px;color:var(--t3)">'+f.date+(f.staff?' · 👤 '+esc(f.staff):'')+'</div>'+
              '</div>'+
              '<div style="font-size:13px;font-weight:800;color:var(--ok)">'+f.totalSupplied+' units</div>'+
            '</div>'+
            '<div style="display:flex;flex-wrap:wrap;gap:5px">'+
              (f.items||[]).map(function(i){
                return '<span style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);border-radius:6px;padding:3px 8px;font-size:11px;color:#10b981">'+
                  esc(i.name)+': +'+i.qtySupplied+
                '</span>';
              }).join('')+
            '</div>'+
            (f.notes?'<div style="font-size:11px;color:var(--t3);margin-top:5px">📝 '+esc(f.notes)+'</div>':'')+
          '</div>';
        }).join('')+
      '</div>';
    }
    html+='<div style="padding:12px 14px;border-top:1px solid var(--bd)">'+
      '<button type="button" class="btn bg bbl" onclick="openFulfillment('+saleId+');closeD(\'d-fulfil-hist\')" style="width:100%">📦 Record New Delivery</button>'+
    '</div>';

  el('fulfil-hist-body').innerHTML=html;
  openD('d-fulfil-hist');
}

// Get fulfillment badge HTML for sale cards
function getFulBadge(s) {
  var st = s.fulStatus || 'Pending';
  var color = FUL_COLORS[st] || '#6b7280';
  var bg = st==='Completed'?'rgba(5,150,105,.12)':st==='Fulfilled'?'rgba(16,185,129,.12)':st==='Partially Fulfilled'?'rgba(249,115,22,.12)':st==='Backordered'?'rgba(220,38,38,.12)':'rgba(107,114,128,.1)';
  return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;color:'+color+';background:'+bg+';border:1px solid '+color+'40">'+
    (st==='Completed'?'✅':st==='Fulfilled'?'📦':st==='Partially Fulfilled'?'🔶':st==='Backordered'?'⚠️':'⏳')+
    ' '+esc(st)+
  '</span>';
}



// ── Fulfillment dashboard summary ─────────────────────────
function renderFulfillmentSummary() {
  var b = biz(); if(!b) return;
  var sales = (b.sales||[]).filter(function(s){ return s.status !== 'deleted' && s.status !== 'cancelled'; });
  var pending    = sales.filter(function(s){ return !s.fulStatus || s.fulStatus==='Pending' || s.fulStatus==='Assigned'; }).length;
  var partial    = sales.filter(function(s){ return s.fulStatus==='Partially Fulfilled' || s.fulStatus==='In Progress'; }).length;
  var backordered= sales.filter(function(s){ return s.fulStatus==='Backordered'; }).length;
  var completed  = sales.filter(function(s){ return s.fulStatus==='Completed' || s.fulStatus==='Fulfilled'; }).length;

  // Update fulfillment stat card if it exists
  var pc = document.getElementById('ful-stat-pending');
  var pp = document.getElementById('ful-stat-partial');
  var pb = document.getElementById('ful-stat-back');
  if(pc) pc.textContent = pending;
  if(pp) pp.textContent = partial;
  if(pb) pb.textContent = backordered;
}

// ── Pending fulfillments report ────────────────────────────
function openPendingFulfillments() {
  var b = biz(); if(!b) return;
  var sales = (b.sales||[]).filter(function(s){
    return s.status !== 'deleted' &&
           s.fulStatus !== 'Completed' &&
           s.fulStatus !== 'Fulfilled';
  });

  var rows = sales.map(function(s){
    var totalOrdered   = (s.items||[]).reduce(function(a,i){return a+i.qty;},0);
    var totalFulfilled = getFulfilledQty(s);
    var remaining      = totalOrdered - totalFulfilled;
    var pct = totalOrdered>0?Math.round(totalFulfilled/totalOrdered*100):0;
    var stColor = FUL_COLORS[s.fulStatus||'Pending'];
    return '<div style="padding:12px 14px;border-bottom:1px solid var(--bd);cursor:pointer" onclick="viewFulfillmentHistory('+s.id+')">'+
      '<div style="display:flex;justify-content:space-between;margin-bottom:5px">'+
        '<div><div style="font-size:13px;font-weight:700;color:var(--t1)">'+esc(s.customer||'Walk-in')+'</div>'+
          '<div style="font-size:11px;color:var(--t3)">'+esc(s.inv)+' · '+s.date+(s.assignedStaff?' · 👤 '+esc(s.assignedStaff):'')+'</div></div>'+
        '<div style="text-align:right">'+
          '<span style="font-size:10px;font-weight:700;color:'+stColor+'">'+esc(s.fulStatus||'Pending')+'</span>'+
          '<div style="font-size:12px;color:var(--t3)">'+remaining+' units left</div>'+
        '</div>'+
      '</div>'+
      '<div style="background:rgba(255,255,255,.06);border-radius:99px;height:5px;overflow:hidden">'+
        '<div style="height:100%;background:linear-gradient(90deg,#059669,#10b981);width:'+pct+'%;border-radius:99px"></div>'+
      '</div>'+
    '</div>';
  }).join('');

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.7);display:flex;align-items:flex-end';
  overlay.innerHTML = '<div style="width:100%;max-height:85vh;background:var(--s1);border-radius:18px 18px 0 0;overflow:hidden;display:flex;flex-direction:column">'+
    '<div style="padding:14px 16px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center">'+
      '<div><div style="font-family:var(--fd);font-size:16px;font-weight:900;color:var(--t1)">📦 Pending Fulfillments</div>'+
        '<div style="font-size:11px;color:var(--t3)">'+sales.length+' orders need attention</div></div>'+
      '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:var(--s2);border:1px solid var(--bd);border-radius:99px;width:30px;height:30px;cursor:pointer;font-size:14px;color:var(--t2)">✕</button>'+
    '</div>'+
    '<div style="overflow-y:auto;flex:1">'+(rows||'<div style="padding:24px;text-align:center;color:var(--t3)">✅ All orders fulfilled!</div>')+'</div>'+
  '</div>';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}



// ═══════════════════════════════════════════════════════════════════
//  ORDER FULFILLMENT & PARTIAL DELIVERY SYSTEM
// ═══════════════════════════════════════════════════════════════════

var _fulSaleId = null;  // current sale being fulfilled
var _fulItems  = [];    // items with their fulfillment quantities

// Fulfillment status colors
function fulColor(st) {
  return {'Pending':'var(--t3)','Assigned':'#3b82f6','In Progress':'var(--wa)',
          'Partially Fulfilled':'var(--wa)','Fulfilled':'var(--ok)',
          'Completed':'var(--ok)','Backordered':'var(--er)'}[st]||'var(--t3)';
}

// ── Open Fulfillment Drawer ────────────────────────────────
function openFulfillment(saleId) {
  var b = biz(); if(!b) return;
  var s = (b.sales||[]).find(function(x){ return x.id === saleId; });
  if(!s) return;

  _fulSaleId = saleId;

  // Build per-item fulfilled quantities
  _fulItems = (s.items||[]).map(function(item) {
    var totalSupplied = (s.fulfillments||[]).reduce(function(acc, f) {
      var fi = (f.items||[]).find(function(x){ return x.prodId === item.prodId; });
      return acc + (fi ? fi.qtySupplied : 0);
    }, 0);
    return {
      prodId:       item.prodId,
      name:         item.name,
      qtyOrdered:   item.qty,
      qtySupplied:  totalSupplied,
      qtyRemaining: Math.max(0, item.qty - totalSupplied),
      qtyThisRound: Math.max(0, item.qty - totalSupplied),  // default = all remaining
      unitPrice:    item.unitPrice,
      unit:         item.unit || 'Box'
    };
  });

  // Fill staff dropdown
  var staffSel = el('ful-staff');
  if(staffSel) {
    var staff = (b.employees||[]).filter(function(e){ return e.status !== 'deleted'; });
    staffSel.innerHTML = '<option value="">Select Staff Member</option>' +
      staff.map(function(e){ return '<option value="'+esc(e.name)+'"'+(s.assignedStaff===e.name?' selected':'')+'>'+esc(e.name)+'</option>'; }).join('');
    // Also allow owner
    staffSel.innerHTML += '<option value="Owner">Owner / Admin</option>';
  }

  el('ful-date').value = today();
  sv('ful-notes', '');

  // Update title
  el('ful-title').textContent = 'Fulfill Order — ' + esc(s.inv||'');
  el('ful-sub').textContent   = 'Customer: ' + esc(s.customer||'Walk-in') + ' · ' + (s.fulStatus||'Pending');

  renderFulItems();
  renderFulSummary(s);
  openD('d-fulfill');
}

function renderFulSummary(s) {
  var div = el('ful-summary'); if(!div) return;
  var tot = sTotal(s);
  var allSupplied = _fulItems.reduce(function(a,i){ return a + i.qtySupplied; }, 0);
  var allOrdered  = _fulItems.reduce(function(a,i){ return a + i.qtyOrdered; }, 0);
  var allRemain   = _fulItems.reduce(function(a,i){ return a + i.qtyRemaining; }, 0);
  var pct = allOrdered > 0 ? Math.round((allSupplied/allOrdered)*100) : 0;

  div.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<span style="font-size:12px;font-weight:700;color:var(--t1)">Fulfillment Progress</span>' +
      '<span style="font-size:12px;font-weight:800;color:'+fulColor(s.fulStatus||'Pending')+'">'+
        (s.fulStatus||'Pending')+'</span>'+
    '</div>'+
    '<div style="height:8px;background:var(--bd);border-radius:4px;overflow:hidden;margin-bottom:8px">' +
      '<div style="height:100%;border-radius:4px;background:linear-gradient(90deg,#0891b2,#0e7490);width:'+pct+'%;transition:width .4s"></div>' +
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px;text-align:center">' +
      '<div><div style="font-weight:800;font-size:16px;color:var(--ok)">'+allSupplied+'</div><div style="color:var(--t3)">Delivered</div></div>' +
      '<div><div style="font-weight:800;font-size:16px;color:var(--wa)">'+allRemain+'</div><div style="color:var(--t3)">Remaining</div></div>' +
      '<div><div style="font-weight:800;font-size:16px;color:var(--t1)">'+allOrdered+'</div><div style="color:var(--t3)">Total Ordered</div></div>' +
    '</div>';

  // Progress bar indicator
  var prog = el('ful-progress');
  if(prog) prog.textContent = pct + '% delivered · ' + _fulItems.length + ' products';
}

function renderFulItems() {
  var cont = el('ful-items'); if(!cont) return;
  if(!_fulItems.length) {
    cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3)">No items</div>';
    return;
  }
  cont.innerHTML = _fulItems.map(function(item, idx) {
    var remaining = item.qtyRemaining;
    var isFullyDone = remaining <= 0;
    var pct = item.qtyOrdered > 0 ? Math.round((item.qtySupplied/item.qtyOrdered)*100) : 0;
    var barColor = pct === 100 ? 'var(--ok)' : pct > 0 ? 'var(--wa)' : 'var(--er)';

    return '<div style="padding:11px 13px;border-bottom:1px solid var(--bd);'+(isFullyDone?'opacity:.5':'')+'">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
        '<div style="flex:1">' +
          '<div style="font-size:13px;font-weight:700;color:var(--t1)">'+esc(item.name)+'</div>'+
          '<div style="font-size:11px;color:var(--t3)">Ordered: <strong>'+item.qtyOrdered+'</strong> · Supplied: <strong style="color:var(--ok)">'+item.qtySupplied+'</strong> · Remaining: <strong style="color:'+(remaining>0?'var(--wa)':'var(--ok)')+'">'+remaining+'</strong></div>'+
          '<div style="height:4px;background:var(--bd);border-radius:2px;margin-top:5px;overflow:hidden">' +
            '<div style="height:100%;border-radius:2px;background:'+barColor+';width:'+pct+'%"></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      (isFullyDone ?
        '<div style="text-align:center;font-size:11px;font-weight:700;color:var(--ok);padding:4px">✅ Fully Delivered</div>' :
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<label style="font-size:11px;color:var(--t3);flex-shrink:0">Qty to deliver now:</label>' +
          '<input type="number" class="fi" style="width:90px;padding:6px 9px;font-size:13px;font-weight:700" ' +
            'id="ful-qty-'+idx+'" value="'+item.qtyThisRound+'" min="0" max="'+remaining+'" step="0.01" ' +
            'oninput="_fulItems['+idx+'].qtyThisRound=parseFloat(this.value)||0">'+
          '<span style="font-size:11px;color:var(--t3)">/ '+remaining+' remaining</span>'+
        '</div>'
      )+
    '</div>';
  }).join('');
}

// ── Save Fulfillment ──────────────────────────────────────
function saveFulfillment(_saveMode) {
  var b = biz(); if(!b) return;
  var s = (b.sales||[]).find(function(x){ return x.id === _fulSaleId; });
  if(!s) return;

  var staffName = el('ful-staff') ? el('ful-staff').value : '';
  var date      = el('ful-date') ? el('ful-date').value : today();
  var notes     = gv('ful-notes');

  // Validate at least one item has qty > 0
  var hasItems = _fulItems.some(function(i){ return i.qtyThisRound > 0; });
  if(!hasItems) { toast('Enter quantity to deliver for at least one item','er'); return; }

  // Build fulfillment record
  var fulRecord = {
    id:        Date.now(),
    date:      date,
    staffName: staffName,
    notes:     notes,
    createdBy: CU ? CU.name : 'Unknown',
    items: _fulItems
      .filter(function(i){ return i.qtyThisRound > 0; })
      .map(function(i) {
        return {
          prodId:       i.prodId,
          name:         i.name,
          qtyOrdered:   i.qtyOrdered,
          qtySupplied:  i.qtyThisRound,
          qtyRemaining: Math.max(0, i.qtyRemaining - i.qtyThisRound),
          unitPrice:    i.unitPrice
        };
      })
  };

  // Save to sale
  if(!s.fulfillments) s.fulfillments = [];
  s.fulfillments.push(fulRecord);

  // Update assigned staff
  if(staffName) s.assignedStaff = staffName;

  // Recalculate fulStatus
  var updatedItems = (s.items||[]).map(function(item) {
    var totalSup = (s.fulfillments||[]).reduce(function(acc, f) {
      var fi = (f.items||[]).find(function(x){ return x.prodId === item.prodId; });
      return acc + (fi ? fi.qtySupplied : 0);
    }, 0);
    return { qtyOrdered: item.qty, totalSupplied: totalSup };
  });

  var allFulfilled  = updatedItems.every(function(i){ return i.totalSupplied >= i.qtyOrdered; });
  var someFulfilled = updatedItems.some(function(i){ return i.totalSupplied > 0; });
  var payDue        = (s.due || 0) > 0;

  if(allFulfilled && !payDue)       s.fulStatus = 'Completed';
  else if(allFulfilled && payDue)   s.fulStatus = 'Fulfilled';
  else if(someFulfilled)            s.fulStatus = 'Partially Fulfilled';
  else if(staffName)                s.fulStatus = 'Assigned';
  else                              s.fulStatus = 'Pending';

  s.updatedAt = Date.now();

  // Stock history log
  if(!b.stockHistory) b.stockHistory = [];
  fulRecord.items.forEach(function(item) {
    b.stockHistory.unshift({
      id: b.nextHistId++, date: date, type: 'DELIVERY',
      prodName: item.name, qty: -item.qtySupplied,
      by: staffName||'Staff', ref: s.inv||'',
      notes: 'Delivered to ' + (s.customer||'customer') + (notes?' · '+notes:''),
      ts: Date.now()
    });
  });

  addAdminLog('fulfillment', 'Fulfillment · '+s.inv+' · '+s.fulStatus+' · '+( staffName||'Unassigned'), CU?CU.name:'System');
  dbSave();
  renderSales();
  renderDash();

  var itemCount = fulRecord.items.length;
  toast('✅ Delivery recorded — '+ s.fulStatus, 'gd');

  if(_saveMode === 'addnew') {
    // Reopen with reset for same order
    setTimeout(function(){ openFulfillment(_fulSaleId); }, 300);
  } else {
    closeD('d-fulfill');
    // Auto-show history
    setTimeout(function(){ viewFulfillmentHistory(_fulSaleId); }, 400);
  }
}

// ── Fulfillment History ────────────────────────────────────
function viewFulfillmentHistory(saleId) {
  var b = biz(); if(!b) return;
  var s = (b.sales||[]).find(function(x){ return x.id === saleId; });
  if(!s) return;

  el('fulh-title').textContent = 'Delivery History — ' + esc(s.inv||'');
  el('fulh-sub').textContent   = esc(s.customer||'Walk-in') + ' · Status: ' + (s.fulStatus||'Pending');

  // "New Delivery" button wires to openFulfillment
  var newBtn = el('ful-new-btn');
  if(newBtn) {
    newBtn.onclick = function(){ closeD('d-ful-history'); openFulfillment(saleId); };
    // Disable if fully completed
    newBtn.style.opacity = (s.fulStatus==='Completed') ? '.4' : '1';
    newBtn.disabled = (s.fulStatus==='Completed');
  }

  var body = el('fulh-body'); if(!body) return;
  var fuls = s.fulfillments||[];

  // Overall summary
  var allItems = (s.items||[]).map(function(item) {
    var totalSup = fuls.reduce(function(acc, f) {
      var fi = (f.items||[]).find(function(x){ return x.prodId === item.prodId; });
      return acc + (fi ? fi.qtySupplied : 0);
    }, 0);
    return { name: item.name, qtyOrdered: item.qty, totalSupplied: totalSup,
             qtyRemaining: Math.max(0, item.qty - totalSup) };
  });

  var allFulPct = allItems.length > 0
    ? Math.round((allItems.reduce(function(a,i){ return a + i.totalSupplied; }, 0) /
       allItems.reduce(function(a,i){ return a + i.qtyOrdered; }, 0)) * 100) : 0;

  var fc = fulColor(s.fulStatus||'Pending');

  var summary =
    '<div style="padding:12px 14px;background:var(--s2);border-bottom:1px solid var(--bd)">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:8px">' +
        '<span style="font-size:13px;font-weight:700">Overall Progress</span>' +
        '<span style="font-size:12px;font-weight:800;color:'+fc+'">'+(s.fulStatus||'Pending')+'</span>' +
      '</div>'+
      '<div style="height:8px;background:var(--bd);border-radius:4px;overflow:hidden;margin-bottom:10px">' +
        '<div style="height:100%;border-radius:4px;background:linear-gradient(90deg,#0891b2,#0e7490);width:'+allFulPct+'%"></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11px;text-align:center">' +
        allItems.map(function(i) {
          var pc = i.qtyOrdered > 0 ? Math.round((i.totalSupplied/i.qtyOrdered)*100) : 0;
          var ic = pc===100?'var(--ok)':pc>0?'var(--wa)':'var(--er)';
          return '<div style="background:var(--s1);border:1px solid var(--bd);border-radius:8px;padding:6px">' +
            '<div style="font-weight:800;color:'+ic+';font-size:13px">'+i.totalSupplied+'/'+i.qtyOrdered+'</div>'+
            '<div style="color:var(--t3);font-size:10px;margin-top:1px">'+esc(i.name.slice(0,18))+'</div>'+
          '</div>';
        }).join('')+
      '</div>'+
    '</div>';

  var assigned = s.assignedStaff
    ? '<div style="padding:8px 14px;border-bottom:1px solid var(--bd);font-size:12px;color:var(--t2)">👤 Assigned to: <strong style="color:var(--t1)">'+esc(s.assignedStaff)+'</strong></div>'
    : '';

  // Fulfillment entries
  var entries = '';
  if(!fuls.length) {
    entries = '<div style="padding:24px;text-align:center;color:var(--t3)"><div style="font-size:28px;margin-bottom:8px">📦</div><div>No deliveries recorded yet</div></div>';
  } else {
    entries = fuls.map(function(f, idx) {
      var itemRows = (f.items||[]).map(function(i) {
        return '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid var(--bd)">' +
          '<span style="color:var(--t1)">'+esc(i.name)+'</span>'+
          '<span><strong style="color:var(--ok)">'+i.qtySupplied+' delivered</strong>'+
            (i.qtyRemaining>0?' · <span style="color:var(--wa)">'+i.qtyRemaining+' remaining</span>':'')+
          '</span>'+
        '</div>';
      }).join('');
      return '<div style="padding:12px 14px;border-bottom:2px solid var(--bd)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<div>'+
            '<div style="font-size:13px;font-weight:800;color:var(--t1)">Delivery #'+(idx+1)+'</div>'+
            '<div style="font-size:11px;color:var(--t3)">📅 '+f.date+(f.staffName?' · 👤 '+esc(f.staffName):'')+' · By '+esc(f.createdBy||'')+' </div>'+
          '</div>'+
          '<span style="font-size:10px;background:rgba(8,145,178,.15);color:#0891b2;padding:3px 9px;border-radius:99px;font-weight:700">'+f.items.length+' item'+(f.items.length!==1?'s':'')+'</span>'+
        '</div>'+
        itemRows+
        (f.notes?'<div style="margin-top:6px;font-size:11px;color:var(--t3)">📝 '+esc(f.notes)+'</div>':'')+
      '</div>';
    }).join('');
  }

  body.innerHTML = summary + assigned + entries;
  openD('d-ful-history');
}

// ── Quick staff assign from receipt ─────────────────────────
function assignStaffToSale(saleId, staffName) {
  var b = biz(); if(!b) return;
  var s = (b.sales||[]).find(function(x){ return x.id === saleId; });
  if(!s) return;
  s.assignedStaff = staffName;
  if(s.fulStatus === 'Pending' && staffName) s.fulStatus = 'Assigned';
  dbSave();
  renderSales();
  toast('Assigned to '+staffName,'gd');
}


try { initTheme(); } catch(e) { console.warn('initTheme error:',e); }

try { dbLoad(); } catch(e) { console.warn('dbLoad error:',e); }
try { updateTopbar(); } catch(e) { console.warn('updateTopbar error:',e); }

// ═══════════════════════════════════════════════════════════
// AUTO-CONNECT FIREBASE SILENTLY
// If Firebase config is saved, connect on startup so all devices
// share data without anyone needing to touch the Sync menu
// ═══════════════════════════════════════════════════════════
(function autoConnectFirebase() {
  try {
    var raw = localStorage.getItem('ss_fb_config');
    if (!raw) {
      console.log('[Auto-FB] No saved config, skipping');
      return;
    }
    // Make sure fbInit exists
    if (typeof fbInit !== 'function') {
      console.log('[Auto-FB] fbInit not defined yet, retrying...');
      setTimeout(autoConnectFirebase, 800);
      return;
    }
    console.log('[Auto-FB] Connecting silently to Firebase...');
    fbInit();
  } catch(e) {
    console.warn('[Auto-FB] error:', e);
  }
})();

// ═══════════════════════════════════════════════════════════
// AUTO-LOGIN FROM SAVED SESSION
// If a previous session exists, log the user in automatically
// (stays logged in until they manually tap Sign Out)
// ═══════════════════════════════════════════════════════════
(function tryAutoLogin() {

  function showLogin() {
    // Remove instant-restore CSS so login shows normally
    var ir = document.getElementById('instant-restore-css');
    if (ir) ir.remove();
    var sp = document.getElementById('splash-restore');
    var sh = document.getElementById('shell');
    var lg = document.getElementById('login');
    if (sp) sp.style.display = 'none';
    if (sh) sh.style.display = 'none';
    if (lg) lg.style.display = 'flex';
  }

  function failRestore(reason) {
    console.warn('[Session] Restore failed:', reason);
    localStorage.removeItem('ss_session');
    showLogin();
  }

  function doRestore(user) {
    try {
      loginAs(user);
      // Hide splash if it was showing
      var sp = document.getElementById('splash-restore');
      if (sp) sp.style.display = 'none';
    } catch(e) {
      console.warn('[Session] loginAs error:', e);
      failRestore('Login error: ' + e.message);
    }
  }

  // ── Check session ──
  var raw, session;
  try {
    raw = localStorage.getItem('ss_session');
  } catch(e) { showLogin(); return; }

  if (!raw) { showLogin(); return; }

  try { session = JSON.parse(raw); } catch(e) { showLogin(); return; }
  if (!session || !session.uid) { showLogin(); return; }

  // ── Try to find user, retrying for Firebase sync ──
  var attempts = 0;
  var MAX = 40;  // 40 × 150ms = 6 seconds max

  function findUser() {
    attempts++;

    var user = (typeof DB !== 'undefined' && DB && DB.users || [])
      .find(function(u){ return u.id === session.uid; });

    if (user) {
      if (user.status === 'pending') { failRestore('Account pending'); return; }
      doRestore(user);
      return;
    }

    if (attempts < MAX) {
      setTimeout(findUser, 150);
    } else {
      failRestore('User not found in database');
    }
  }

  findUser();

})();