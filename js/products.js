function renderProducts(){
  var b=biz();if(!b)return;
  var q=(document.getElementById('pq')?document.getElementById('pq').value||'':'').toLowerCase();
  var allProds=b.products||[];
  var prods=allProds.filter(function(p){
    return !q||
      p.name.toLowerCase().includes(q)||
      (p.sku||'').toLowerCase().includes(q)||
      (p.size||'').toLowerCase().includes(q);
  });
  if(prodCat!=='all') prods=prods.filter(function(p){return p.category===prodCat;});

  // Category chips
  var cats=['all'].concat([...new Set(allProds.map(function(p){return p.category;}))]);
  var pchips=el('pchips');
  if(pchips) pchips.innerHTML=cats.map(function(c){
    return '<div class="chip'+(prodCat===c?' on':'')+'" onclick="setProdCat(\''+c+'\')">'+
      (c==='all'?'All Products ('+allProds.length+')':c)+'</div>';
  }).join('');

  var e=el('plist');if(!e)return;
  var lv=b.lowStock||5;
  var adminUser=isAdmin();

  if(!prods.length){
    e.innerHTML='<div style="padding:40px 20px;text-align:center">'+
      '<div style="font-size:44px;margin-bottom:12px;opacity:.25">📦</div>'+
      '<div style="font-family:var(--fd);font-size:16px;font-weight:700;color:var(--t3);margin-bottom:6px">No Products Yet</div>'+
      '<div style="font-size:12px;color:var(--t4)">Tap the + button to add your first product</div></div>';
    return;
  }

  // Build the product list
  e.innerHTML='<div class="card">'+prods.map(function(p){
    var neg    = p.qty < 0;   // oversold — needs restocking
    var low    = !neg && p.qty<=(p.lowLevel||lv);
    var out    = !neg && p.qty<=0;
    var locked = isProdLocked(p);
    var margin = (p.price>0&&p.cost>0) ? Math.round(((p.price-p.cost)/p.price)*100) : -1;

    // Icon/image
    var imgHtml = getProductImgSrc(p)
      ? '<div class="ci" style="padding:0;overflow:hidden;border:none;flex-shrink:0">'+
          '<img src="'+getProductImgSrc(p)+'" style="width:40px;height:40px;object-fit:cover;border-radius:var(--r10)"></div>'
      : '<div class="ci" style="background:'+(neg?'rgba(239,68,68,.25)':out?'var(--erb)':low?'var(--wab)':'var(--gd)')+';flex-shrink:0">'+
          (locked?'🔒':(CATI[p.category]||'📦'))+'</div>';

    // Status badges
    var badges = '<span class="bdg bdf">'+esc(p.category)+'</span>';
    if(p.sku)   badges += ' <span class="bdg bdf mono">'+esc(p.sku)+'</span>';
    if(p.size)  badges += ' <span class="bdg bg0">'+esc(p.size)+'</span>';
    if(out)     badges += ' <span class="bdg ber0">OUT</span>';
    else if(low)badges += ' <span class="bdg bwa0">LOW</span>';
    if(locked)  badges += ' <span class="bdg bloc" style="font-size:9px">🔒</span>';

    // Margin pill
    var marginHtml = '';
    if(margin >= 0){
      var mc = margin>=40?'var(--ok)':margin>=20?'var(--wa)':'var(--er)';
      var mb = margin>=40?'var(--okb)':margin>=20?'var(--wab)':'var(--erb)';
      marginHtml = '<div style="font-size:9px;font-weight:700;color:'+mc+';background:'+mb+';padding:1px 6px;border-radius:99px;margin-top:3px;display:inline-block;font-family:var(--fm)">'+margin+'% margin</div>';
    }

    // Admin action buttons (always visible for admin)
    var adminBtns = adminUser
      ? '<div style="display:flex;gap:5px;margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">' +
          '<button type="button" class="act-btn" style="flex:1;justify-content:center" onclick="event.stopPropagation();openEditProd('+p.id+')">✏️ Edit</button>' +
          '<button type="button" class="act-btn danger" style="flex:1;justify-content:center" onclick="event.stopPropagation();reqDelProdById('+p.id+',\''+esc(p.name).replace(/'/g,"\\'")+'\')" >🗑️ Delete</button>' +
        '</div>'
      : '';

    return '<div class="cr" style="flex-direction:column;align-items:stretch;padding:12px 14px;border-bottom:1px solid var(--bd);cursor:pointer" onclick="openEditProd('+p.id+')">'+
      '<div style="display:flex;align-items:center;gap:11px">'+
        imgHtml+
        '<div style="flex:1;min-width:0">'+
          '<div class="ct">'+esc(p.name)+'</div>'+
          '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">'+badges+'</div>'+
        '</div>'+
        '<div style="text-align:right;flex-shrink:0">'+
          '<div class="cv c-g prod-price">'+ ((typeof hasPerm==='function' && !hasPerm('see_product_price')) ? '<span style="color:var(--t3);font-size:12px">🔒</span>' : f$(p.price)) +'</div>'+
          (function(){
      if(!neg) return '<div class="cm" style="color:'+(out?'var(--er)':low?'var(--wa)':'var(--t3)')+'">'+p.qty+' '+p.unit+'</div>';
      var shortage = Math.abs(p.qty);
      var restockCost = (p.cost > 0) ? (shortage * p.cost) : -1;
      var daysAgo = '';
      if(p.wentNegativeAt){
        var d = Math.floor((Date.now()-p.wentNegativeAt)/(1000*60*60*24));
        daysAgo = d <= 0 ? ' · today' : ' · '+d+' day'+(d!==1?'s':'')+' ago';
      }
      return '<div style="margin-top:4px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:6px 8px">'+
        '<div style="font-size:11px;font-weight:800;color:var(--er);display:flex;align-items:center;gap:5px">'+
          '<span>⚠</span><span>SHORT '+shortage+' '+p.unit+daysAgo+'</span>'+
        '</div>'+
        (restockCost>0?'<div style="font-size:10px;color:var(--t3);margin-top:2px">Est. restock cost: '+f$(restockCost)+'</div>':'')+
        '<div style="font-size:10px;color:var(--wa);margin-top:2px;font-weight:600">▲ Add stock to cover shortage</div>'+
      '</div>';
    })() +
          marginHtml+
        '</div>'+
      '</div>'+
      adminBtns+
    '</div>';
  }).join('')+'</div>';
}




// ════════════════════════════════════════════════════════
//  FIREBASE REAL-TIME SYNC ENGINE
//  All staff see the same data on all devices, live.
// ════════════════════════════════════════════════════════
var FB_APP    = null;
var FB_DB     = null;
var FB_REF    = null;
var FB_AUTH    = null;   // Firebase Authentication
var FB_STORAGE = null;   // Firebase Storage (product photos)
var FB_CONFIG  = null;
var FB_READY  = false;
var FB_SYNCING = false;

// ── Load saved Firebase config ──
// ── Hardcoded Firebase config (auto-connects on every load) ──
var FB_DEFAULT_CONFIG = {"apiKey": "AIzaSyDkLLktUImqCsmfqUymkJRkbioiZObLwFY", "authDomain": "smart-stock-cc2a1.firebaseapp.com", "databaseURL": "https://smart-stock-cc2a1-default-rtdb.firebaseio.com", "projectId": "smart-stock-cc2a1", "storageBucket": "smart-stock-cc2a1.firebasestorage.app", "messagingSenderId": "610390619990", "appId": "1:610390619990:web:7a79521319e57d2446c8f7", "measurementId": "G-7CXT3TY4Z4"};

function fbLoadConfig() {
  // Always use the hardcoded config (no manual paste needed)
  FB_CONFIG = FB_DEFAULT_CONFIG;
  // Also persist to localStorage as backup
  try { localStorage.setItem('ss_fb_config', JSON.stringify(FB_CONFIG)); } catch(e) {}
  return true;
}

// ── Save Firebase config ──
function fbSaveConfig(cfg) {
  try { localStorage.setItem('ss_fb_config', JSON.stringify(cfg)); } catch(e) {}
  FB_CONFIG = cfg;
}

// ── Initialize Firebase ──
function fbInit() {
  if (!FB_CONFIG) return false;
  // If Firebase SDK not loaded yet, retry after a short delay
  if (typeof firebase === 'undefined') {
    console.warn('[Firebase] SDK not ready, retrying in 1s...');
    setTimeout(fbInit, 1000);
    return false;
  }
  try {
    // Avoid re-initializing
    if (firebase.apps && firebase.apps.length > 0) {
      FB_APP = firebase.apps[0];
    } else {
      FB_APP = firebase.initializeApp(FB_CONFIG);
    }
    FB_DB  = firebase.database(FB_APP);
    FB_REF = FB_DB.ref('smartstock');
    // Initialize Firebase Auth
    FB_AUTH = firebase.auth(FB_APP);
    // Initialize Firebase Storage
    try {
      FB_STORAGE = firebase.storage(FB_APP);
      console.log('[Firebase Storage] Ready ✓');
    } catch(e) {
      console.warn('[Firebase Storage] Not available:', e.message);
    }
    FB_AUTH.languageCode = 'en';
    // Listen for auth state changes
    FB_AUTH.onAuthStateChanged(function(user) {
      if (user) {
        console.log('[Firebase Auth] User signed in:', user.email);
        // Store Firebase UID in session for reference
        try {
          var sess = JSON.parse(localStorage.getItem('ss_session') || '{}');
          if (sess && sess.uid) {
            sess.fbUid = user.uid;
            localStorage.setItem('ss_session', JSON.stringify(sess));
          }
        } catch(e){}
      } else {
        console.log('[Firebase Auth] User signed out');
      }
    });
    FB_READY = true;
    fbSetupListener();
    setSyncStatus('connected');
    console.log('[Firebase] Connected ✓');
    // If we're on login screen with no users, show sync notice
    try {
      if ((!DB.users || DB.users.length === 0) && !CU) {
        var note = document.getElementById('login-sync-note');
        if (note) note.style.display = '';
      }
    } catch(e){}
    return true;
  } catch(e) {
    console.warn('[Firebase] Init failed:', e.message);
    setSyncStatus('error');
    return false;
  }
}

// ── Real-time listener — updates ALL devices instantly ──
function fbSetupListener() {
  if (!FB_REF) return;
  FB_REF.on('value', function(snapshot) {
    var data = snapshot.val();
    if (!data) { return; }
    if (FB_SYNCING) return;
    try {
      var remote = typeof data === 'string' ? JSON.parse(data) : data;
      if (remote && remote.businesses) {
        // ── ALWAYS keep local users — local is authoritative for passwords ──
        // Firebase stores business data; users/passwords are local-first
        var localUsers      = DB.users && DB.users.length > 0 ? DB.users : null;
        var localNextUserId = DB.nextUserId || 1;

        DB = remote;

        // ALWAYS restore local users (never let Firebase overwrite passwords)
        if (localUsers && localUsers.length > 0) {
          // Merge: use local users as base, add any NEW users from Firebase
          // that don't exist locally (e.g. new staff signed up on another device)
          var mergedUsers = localUsers.slice();  // start with local
          (remote.users || []).forEach(function(remoteUser) {
            var existsLocally = mergedUsers.some(function(lu) {
              return lu.id === remoteUser.id || lu.username === remoteUser.username;
            });
            if (!existsLocally) {
              // Genuinely new user from another device — add them
              mergedUsers.push(remoteUser);
            }
            // If user exists locally: keep local version (preserves password changes)
          });
          DB.users = mergedUsers;
          DB.nextUserId = Math.max(localNextUserId, remote.nextUserId || 1);
        } else if (!DB.users || DB.users.length === 0) {
          // No local users AND no remote users — fresh install
          DB.users = [];
          DB.nextUserId = 1;
        }
        // else: remote has users and we have none locally — keep remote users

        migrateDB();
        try { refreshCurrentPage(); } catch(e2) {}
        setSyncStatus('synced');
      }
    } catch(e) {
      console.warn('[Firebase] Parse error:', e.message);
    }
  }, function(err) {
    console.warn('[Firebase] Listener error:', err.message);
    setSyncStatus('offline');
  });
}

// ── Push local data to Firebase ──
function fbPush() {
  if (!FB_READY || !FB_REF) return;
  if (typeof firebase === 'undefined') return;

  // ── VALIDATE DATA before pushing to Firebase ──
  if (!DB || typeof DB !== 'object') {
    console.warn('[Firebase] Invalid DB — skipping push');
    return;
  }
  // Users array must be valid
  if (DB.users && !Array.isArray(DB.users)) {
    console.warn('[Firebase] DB.users is not an array — skipping push');
    return;
  }
  // All users must have required fields
  var invalidUser = (DB.users || []).find(function(u) {
    return !u || !u.id || !u.username || !u.password;
  });
  if (invalidUser) {
    console.warn('[Firebase] Invalid user data — skipping push:', invalidUser);
    return;
  }
  // All passwords must be hashed (or marked for migration)
  var unhashedUser = (DB.users || []).find(function(u) {
    return u.password && !u.password.startsWith('sha256:') && u.password.length < 60;
    // Plain passwords are shorter than hashes — these need upgrade
  });
  if (unhashedUser && unhashedUser.password.length < 20) {
    // Very short — likely plain text, log warning but allow (migration)
    console.warn('[Firebase] Plain-text password detected for:', unhashedUser.username, '(will upgrade on next login)');
  }

  FB_SYNCING = true;
  FB_REF.set(DB, function(err) {
    FB_SYNCING = false;
    if (err) {
      console.warn('[Firebase] Push failed:', err.message);
      setSyncStatus('offline');
    } else {
      setSyncStatus('synced');
    }
  });
}

// Push ONLY the users array (for password changes — faster + no race condition)
function fbPushUsers() {
  if (!FB_READY || !FB_REF) return;
  if (typeof firebase === 'undefined') return;
  // Validate users before pushing
  if (!Array.isArray(DB.users)) {
    console.warn('[Firebase] Users is not an array — skipping push');
    return;
  }
  // All users must have at minimum: id, username, password
  var allValid = DB.users.every(function(u) {
    return u && u.id && u.username && u.password;
  });
  if (!allValid) {
    console.warn('[Firebase] Some users are invalid — skipping push');
    return;
  }
  try {
    FB_REF.child('users').set(DB.users);
    FB_REF.child('nextUserId').set(DB.nextUserId || 1);
  } catch(e) {
    console.warn('[Firebase] fbPushUsers failed:', e.message);
  }
}

// ── Refresh whichever page is currently showing ──
function refreshCurrentPage() {
  var pages = ['dash','sales','products','customers','expenses','reports','salary','calc','more','gallery','chat','docexp'];
  for (var i = 0; i < pages.length; i++) {
    var pg = document.getElementById('pg-' + pages[i]);
    if (pg && pg.classList.contains('on')) {
      try { goTo(pages[i]); } catch(e) {}
      break;
    }
  }
}

// ── Sync status indicator ──
function setSyncStatus(status) {
  var dot  = document.getElementById('sync-dot');
  var lbl  = document.getElementById('sync-lbl');
  var dot2 = document.getElementById('fb-status-dot');
  var txt2 = document.getElementById('fb-status-text');
  var disconnWrap = document.getElementById('fb-disconnect-wrap');

  var states = {
    connected: { color:'#22C55E', text:'Live',    title:'Connected to shared database',        label:'Connected — syncing live' },
    synced:    { color:'#22C55E', text:'Synced',  title:'All changes saved and synced',        label:'All data synced ✓' },
    saving:    { color:'#F59E0B', text:'Saving…', title:'Saving to database…',                 label:'Saving to database…' },
    offline:   { color:'#EF4444', text:'Offline', title:'No internet — changes saved locally', label:'Offline — saved locally' },
    error:     { color:'#EF4444', text:'Error',   title:'Database error — check config',       label:'Error — check config' },
    local:     { color:'#6B7280', text:'Local',   title:'Using local storage (no Firebase)',   label:'Not configured' }
  };
  var s = states[status] || states.local;

  if (dot)  { dot.style.background  = s.color; dot.title = s.title; }
  if (lbl)  { lbl.textContent = s.text; }
  if (dot2) { dot2.style.background = s.color; }
  if (txt2) { txt2.textContent = s.label; txt2.style.color = s.color; }
  if (disconnWrap) {
    disconnWrap.style.display = (status !== 'local') ? '' : 'none';
  }
}

// ── Open Firebase Setup UI ──
function openFBSetup() {
  // ── DATABASE SYNC HIDDEN ──
  // The Firebase config menu has been removed from the app UI for everyone.
  // Firebase still auto-connects silently on startup from saved localStorage config.
  // This function is kept as a no-op so any legacy calls don\'t crash.
  // To re-enable manual access, restore the menu item in the sidebar and remove this gate.
  console.log("[openFBSetup] Menu is hidden — auto-connect runs silently.");
  return;
}

// ── Save Firebase config from UI ──
function saveFBConfig() {
  var input = document.getElementById('fb-config-input');
  if (!input || !input.value.trim()) { toast('Paste your Firebase config first', 'er'); return; }
  var raw = input.value.trim();
  // Accept both JSON object and the firebaseConfig = {...} format
  raw = raw.replace(/^.*?=\s*/, '').replace(/;?\s*$/, '');
  try {
    var cfg = JSON.parse(raw);
    if (!cfg.apiKey || !cfg.databaseURL) {
      toast('Config missing apiKey or databaseURL', 'er');
      return;
    }
    fbSaveConfig(cfg);
    document.getElementById('d-fbsetup').classList.remove('on');
    // Re-initialize with new config
    FB_APP = null; FB_DB = null; FB_REF = null; FB_READY = false;
    // Delete existing app if present, then re-init
    try {
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        firebase.apps[0].delete().then(function() { setTimeout(fbInit, 300); });
      } else {
        setTimeout(fbInit, 300);
      }
    } catch(e) {
      setTimeout(fbInit, 500);
    }
    // Push current local data to the new database
    setTimeout(fbPush, 1000);
    toast('Firebase connected! Syncing data…', 'gd');
  } catch(e) {
    toast('Invalid config — paste the full JSON object', 'er');
  }
}

// ── Disconnect Firebase ──
function fbDisconnect() {
  localStorage.removeItem('ss_fb_config');
  FB_CONFIG = null; FB_READY = false;
  if (FB_REF) { try { FB_REF.off(); } catch(e) {} }
  FB_REF = null; FB_DB = null; FB_APP = null;
  setSyncStatus('local');
  toast('Disconnected — using local storage');
  document.getElementById('d-fbsetup').classList.remove('on');
}

// ── Export / import full backup ──
function exportBackup() {
  var json = JSON.stringify(DB, null, 2);
  var blob = new Blob([json], {type:'application/json'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'SmartStock_backup_' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Backup downloaded!', 'gd');
}


// ════════════════════════════════════════════════════════
//  IMAGE CROPPER ENGINE
//  Touch + mouse support, pinch-to-zoom, drag to pan
// ════════════════════════════════════════════════════════
var _cropCallback = null;
var _cropImg      = new Image();
var _cropCtx      = null;
var _cropCanvas   = null;
var _cropFrame    = null;
var _cropScale    = 1.0;
var _cropOffX     = 0;
var _cropOffY     = 0;
var _cropDragging = false;
var _cropLastX    = 0;
var _cropLastY    = 0;
var _cropPinchDist = 0;
var _cropFrameSize = 0;

function openCropModal(imageSrc, callback) {
  _cropCallback = callback;
  _cropCanvas   = document.getElementById('crop-canvas');
  _cropFrame    = document.getElementById('crop-frame');
  _cropCtx      = _cropCanvas ? _cropCanvas.getContext('2d') : null;
  if (!_cropCanvas || !_cropCtx) {
    // Fallback: no canvas support, use image directly
    callback(imageSrc);
    return;
  }

  _cropImg = new Image();
  _cropImg.onload = function() {
    // Set canvas size to fill the viewport
    var wrap = document.getElementById('crop-canvas-wrap');
    var ww   = wrap ? wrap.offsetWidth  : window.innerWidth;
    var wh   = wrap ? wrap.offsetHeight : window.innerHeight - 160;
    _cropCanvas.width  = ww;
    _cropCanvas.height = wh;

    // Frame = square, 80% of smaller dimension
    _cropFrameSize = Math.floor(Math.min(ww, wh) * 0.80);
    var fx = (ww - _cropFrameSize) / 2;
    var fy = (wh - _cropFrameSize) / 2;
    if (_cropFrame) {
      _cropFrame.style.left   = fx + 'px';
      _cropFrame.style.top    = fy + 'px';
      _cropFrame.style.width  = _cropFrameSize + 'px';
      _cropFrame.style.height = _cropFrameSize + 'px';
    }

    // Fit image to fill the frame initially
    var imgAspect = _cropImg.width / _cropImg.height;
    if (imgAspect >= 1) {
      _cropScale = _cropFrameSize / _cropImg.height;
    } else {
      _cropScale = _cropFrameSize / _cropImg.width;
    }
    // Center image
    _cropOffX = (ww - _cropImg.width * _cropScale) / 2;
    _cropOffY = (wh - _cropImg.height * _cropScale) / 2;

    // Reset zoom slider
    var slider = document.getElementById('crop-zoom-slider');
    if (slider) slider.value = 100;

    drawCrop();
    setupCropEvents();
    document.getElementById('crop-modal').classList.add('on');
  };
  _cropImg.src = imageSrc;
}

function drawCrop() {
  if (!_cropCtx || !_cropCanvas) return;
  var w = _cropCanvas.width;
  var h = _cropCanvas.height;
  _cropCtx.clearRect(0, 0, w, h);
  _cropCtx.drawImage(
    _cropImg,
    _cropOffX, _cropOffY,
    _cropImg.width * _cropScale,
    _cropImg.height * _cropScale
  );
}

function setupCropEvents() {
  var c = _cropCanvas;
  if (!c) return;

  // Remove old listeners by cloning
  var newC = c.cloneNode(true);
  c.parentNode.replaceChild(newC, c);
  _cropCanvas = newC;
  _cropCtx    = _cropCanvas.getContext('2d');

  // Touch events (mobile)
  _cropCanvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      _cropDragging = true;
      _cropLastX = e.touches[0].clientX;
      _cropLastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      _cropPinchDist = getPinchDist(e);
    }
  }, { passive: false });

  _cropCanvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (e.touches.length === 1 && _cropDragging) {
      var dx = e.touches[0].clientX - _cropLastX;
      var dy = e.touches[0].clientY - _cropLastY;
      _cropOffX += dx;
      _cropOffY += dy;
      _cropLastX = e.touches[0].clientX;
      _cropLastY = e.touches[0].clientY;
      drawCrop();
    } else if (e.touches.length === 2) {
      var newDist = getPinchDist(e);
      if (_cropPinchDist > 0) {
        var ratio = newDist / _cropPinchDist;
        var cx = (_cropCanvas.width  / 2 - _cropOffX) / _cropScale;
        var cy = (_cropCanvas.height / 2 - _cropOffY) / _cropScale;
        _cropScale = Math.max(0.3, Math.min(5, _cropScale * ratio));
        _cropOffX  = _cropCanvas.width  / 2 - cx * _cropScale;
        _cropOffY  = _cropCanvas.height / 2 - cy * _cropScale;
        var slider = document.getElementById('crop-zoom-slider');
        if (slider) slider.value = Math.round(_cropScale * 100);
        drawCrop();
      }
      _cropPinchDist = newDist;
    }
  }, { passive: false });

  _cropCanvas.addEventListener('touchend', function(e) {
    _cropDragging = false;
    _cropPinchDist = 0;
  });

  // Mouse events (desktop)
  _cropCanvas.addEventListener('mousedown', function(e) {
    _cropDragging = true;
    _cropLastX = e.clientX;
    _cropLastY = e.clientY;
  });
  _cropCanvas.addEventListener('mousemove', function(e) {
    if (!_cropDragging) return;
    _cropOffX += e.clientX - _cropLastX;
    _cropOffY += e.clientY - _cropLastY;
    _cropLastX = e.clientX;
    _cropLastY = e.clientY;
    drawCrop();
  });
  _cropCanvas.addEventListener('mouseup', function() { _cropDragging = false; });
}

function getPinchDist(e) {
  var dx = e.touches[0].clientX - e.touches[1].clientX;
  var dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

function onCropZoom(val) {
  var newScale = val / 100;
  var cx = (_cropCanvas.width  / 2 - _cropOffX) / _cropScale;
  var cy = (_cropCanvas.height / 2 - _cropOffY) / _cropScale;
  _cropScale = Math.max(0.3, Math.min(5, newScale));
  _cropOffX  = _cropCanvas.width  / 2 - cx * _cropScale;
  _cropOffY  = _cropCanvas.height / 2 - cy * _cropScale;
  drawCrop();
}

function applyCrop() {
  if (!_cropCanvas || !_cropCtx || !_cropCallback) { closeCropModal(); return; }
  var w   = _cropCanvas.width;
  var h   = _cropCanvas.height;
  var fs  = _cropFrameSize;
  var fx  = (w - fs) / 2;
  var fy  = (h - fs) / 2;

  // Create output canvas (square 600×600 for good quality)
  var out = document.createElement('canvas');
  out.width  = 600;
  out.height = 600;
  var octx = out.getContext('2d');
  octx.drawImage(_cropCanvas, fx, fy, fs, fs, 0, 0, 600, 600);

  var result = out.toDataURL('image/jpeg', 0.85);
  closeCropModal();
  _cropCallback(result);
}

function closeCropModal() {
  var modal = document.getElementById('crop-modal');
  if (modal) modal.classList.remove('on');
  _cropCallback  = null;
  _cropDragging  = false;
  _cropPinchDist = 0;
}


// ════════════════════════════════════════════════════════
//  LIVE PRODUCT PREVIEW
// ════════════════════════════════════════════════════════
function updateProdPreview() {
  var card = document.getElementById('prod-preview-card');
  if (!card) return;

  // Read all field values
  var name   = gv('pname');
  var sku    = gv('psku');
  var catEl  = document.getElementById('pcat');
  var cat    = catEl ? catEl.value : 'Other';
  if (cat === '__custom__') { var cc = gv('pcat-custom'); if (cc) cat = cc; }
  var cost   = parseFloat(document.getElementById('pcost')  ? document.getElementById('pcost').value  : 0) || 0;
  var price  = parseFloat(document.getElementById('pprice') ? document.getElementById('pprice').value : 0) || 0;
  var qty    = parseInt(document.getElementById('pqty')    ? document.getElementById('pqty').value    : 0) || 0;
  var unitEl = document.getElementById('punit');
  var unit   = unitEl ? unitEl.value : 'Box';
  var size   = gv('psize');
  var lowEl  = document.getElementById('plow');
  var low    = parseInt(lowEl ? lowEl.value : 5) || 5;

  // Check if there's anything to preview
  var hasContent = name || price > 0 || qty > 0 || sku;
  card.style.display = hasContent ? '' : 'none';
  if (!hasContent) return;

  // ── Name ──
  var nameEl = document.getElementById('prev-name');
  if (nameEl) nameEl.textContent = name || 'Product Name';

  // ── Category badge + icon ──
  var catBadge = document.getElementById('prev-cat-badge');
  var catIcon  = document.getElementById('prev-cat-icon');
  if (catBadge) catBadge.textContent = cat;
  if (catIcon) {
    var CATI2 = {Tiles:'🟦',Cement:'🏗️',Tools:'🔧',Paint:'🎨',Plumbing:'🚰',Electrical:'⚡',Accessories:'🔩',Other:'📦',General:'📦'};
    catIcon.textContent = CATI2[cat] || '📦';
  }

  // ── Image preview in card ──
  var imgWrap = document.getElementById('prev-img-wrap');
  var thumb   = document.getElementById('pimgthumb');
  if (imgWrap) {
    if (thumb && thumb.src && thumb.src.length > 100) {
      imgWrap.innerHTML = '<img src="' + thumb.src + '" style="width:100%;height:100%;object-fit:cover">';
    } else {
      var CATI3 = {Tiles:'🟦',Cement:'🏗️',Tools:'🔧',Paint:'🎨',Plumbing:'🚰',Electrical:'⚡',Accessories:'🔩',Other:'📦',General:'📦'};
      imgWrap.innerHTML = '<span id="prev-cat-icon" style="font-size:22px">' + (CATI3[cat] || '📦') + '</span>';
    }
  }

  // ── SKU badge ──
  var skuBadge = document.getElementById('prev-sku-badge');
  if (skuBadge) {
    skuBadge.textContent = sku;
    skuBadge.style.display = sku ? '' : 'none';
  }

  // ── Size badge ──
  var sizeBadge = document.getElementById('prev-size-badge');
  if (sizeBadge) {
    sizeBadge.textContent = size;
    sizeBadge.style.display = size ? '' : 'none';
  }

  // ── Stock badge ──
  var stockBadge = document.getElementById('prev-stock-badge');
  if (stockBadge) {
    if (qty <= 0) {
      stockBadge.textContent = 'OUT OF STOCK';
      stockBadge.style.background = 'var(--erb)';
      stockBadge.style.color      = 'var(--er)';
      stockBadge.style.border     = '1px solid var(--erbd)';
      stockBadge.style.display    = '';
    } else if (qty <= low) {
      stockBadge.textContent = 'LOW STOCK';
      stockBadge.style.background = 'var(--wab)';
      stockBadge.style.color      = 'var(--wa)';
      stockBadge.style.border     = '1px solid var(--wabd)';
      stockBadge.style.display    = '';
    } else {
      stockBadge.textContent = 'IN STOCK';
      stockBadge.style.background = 'var(--okb)';
      stockBadge.style.color      = 'var(--ok)';
      stockBadge.style.border     = '1px solid var(--okbd)';
      stockBadge.style.display    = '';
    }
  }

  // ── Price ──
  var priceEl = document.getElementById('prev-price');
  if (priceEl) {
    priceEl.textContent = price > 0 ? f$(price) : '--';
    priceEl.style.color = 'var(--g)';
  }

  // ── Qty ──
  var qtyEl = document.getElementById('prev-qty');
  if (qtyEl) {
    qtyEl.textContent = qty + ' ' + unit;
    qtyEl.style.color = qty <= 0 ? 'var(--er)' : qty <= low ? 'var(--wa)' : 'var(--t3)';
  }

  // ── Margin bar ──
  var barWrap   = document.getElementById('prev-margin-bar-wrap');
  var costBar   = document.getElementById('prev-cost-bar');
  var marginPct = document.getElementById('prev-margin-pct');
  var costLbl   = document.getElementById('prev-cost-lbl');
  var priceLbl2 = document.getElementById('prev-price-lbl');
  var marginEl  = document.getElementById('prev-margin');

  if (cost > 0 && price > 0) {
    if (barWrap) barWrap.style.display = '';
    var pct    = Math.round(((price - cost) / price) * 100);
    var costPc = Math.round((cost / price) * 100);
    if (costBar)   costBar.style.width   = Math.min(costPc, 100) + '%';
    if (costLbl)   costLbl.textContent   = f$(cost);
    if (priceLbl2) priceLbl2.textContent = f$(price);
    if (marginPct) {
      marginPct.textContent = pct + '% margin';
      marginPct.style.color = pct >= 40 ? 'var(--ok)' : pct >= 20 ? 'var(--wa)' : 'var(--er)';
    }
    if (marginEl) {
      marginEl.style.display    = '';
      marginEl.textContent      = pct + '%';
      marginEl.style.background = pct >= 40 ? 'var(--okb)'  : pct >= 20 ? 'var(--wab)'  : 'var(--erb)';
      marginEl.style.color      = pct >= 40 ? 'var(--ok)'   : pct >= 20 ? 'var(--wa)'   : 'var(--er)';
    }
  } else {
    if (barWrap) barWrap.style.display = 'none';
    if (marginEl) marginEl.style.display = 'none';
  }
}



// ── RESTORED PRODUCT FUNCTIONS ──
function openAddProd(){
  if(!canAccess('products')){toast('No access','er');return;}
  editProdId=null;el('dp-ttl').textContent='Add Product';el('psavebtn').textContent='Save Product';el('prod-lock-banner').style.display='none';
  ['pname','psku','pcost','pprice','pqty','plow','pdesc','psize'].forEach(id=>sv(id,''));sv('pcat','Tiles');sv('punit','Box');
  el('pdelbtn').style.display='none';el('pshtbtn').style.display='none';if(el('pcat-custom'))el('pcat-custom').style.display='none';if(el('pcat'))el('pcat').value='Tiles';clearProdImg();openD('d-prod');setTimeout(()=>el('pname')?.focus(),300);
}

function saveProd(_saveMode){
  const b=biz();if(!b)return;const name=gv('pname'),price=parseFloat(el('pprice')?.value)||0;
  if(!name){toast('Product name required','er');return;}if(price<=0){toast('Selling price required','er');return;}
  const imgDataRaw=getProdImgData();const now=Date.now();
  const prod={name,sku:gv('psku'),category:getProdCat(),cost:parseFloat(el('pcost')?.value)||0,price,qty:parseFloat(el('pqty')?.value)||0,unit:el('punit')?.value||'Box',lowLevel:parseInt(el('plow')?.value)||(b.lowStock||5),desc:gv('pdesc'),size:gv('psize'),imgData:imgDataRaw,imgUrl:'',updatedAt:now,status:'active'};
  if(editProdId!==null){
    const i=(b.products||[]).findIndex(x=>x.id===editProdId);
    if(i>-1){
      const oldName=b.products[i].name;
      b.products[i]={...b.products[i],...prod};
      if(b.products[i].adminUnlocked){delete b.products[i].adminUnlocked;delete b.products[i].adminUnlockedBy;}
      DB.changeRequests.filter(r=>r.prodId===editProdId&&r.status==='approved').forEach(r=>{r.status='completed';r.resolvedAt=now;});
      // Sync name change to all existing sales
      if(oldName!==name){
        (b.sales||[]).forEach(function(s){
          (s.items||[]).forEach(function(it){if(it.prodId===editProdId)it.name=name;});
        });
      }
    }
    addAdminLog('edit_prod','Edited: '+name,CU.name);toast('Product updated!');
  }else{
    if(!b.products)b.products=[];prod.id=b.nextProdId++;prod.createdAt=now;b.products.unshift(prod);
    addAdminLog('add_prod','Added: '+name,CU.name);addNotif('product','📦 New: '+name+' by '+CU.name);toast('Product added!');
  }
  dbSave();renderProducts();renderDash();renderGallery();checkNotif();
  if(_saveMode==='addnew'){ toast('Saved! Add another product','gd'); setTimeout(function(){openAddProd();},150); }
  else { closeD('d-prod'); }
}

function setProdCat(c){prodCat=c;renderProducts();}

function clearProdImg(){['pimg-cam','pimg-gal'].forEach(id=>{const e=el(id);if(e){e.dataset.img='';e.value='';}});const w=el('pimg-prev-wrap');if(w)w.style.display='none';const u=el('pimg-upload-area');if(u)u.style.display='';}

function openEditProd(id){
  if(!canAccess('products')){toast('No access','er');return;}
  const b=biz();const p=(b.products||[]).find(x=>x.id===id);if(!p)return;
  const locked=isProdLocked(p);
  if(locked&&!isAdmin()){
    pendingCRProdId=id;el('cr-prod-name').textContent=`"${p.name}" — locked for ${prodLockRem(p)} more`;
    sv('cr-changes','');sv('cr-urgency','normal');openD('d-changereq');return;
  }
  editProdId=id;el('dp-ttl').textContent='Edit Product';el('psavebtn').textContent='Update Product';
  el('prod-lock-banner').style.display=locked&&isAdmin()?'':'none';
  sv('pname',p.name);sv('psku',p.sku||'');sv('pcat-custom','');
  const stdCats=['Tiles','Cement','Tools','Paint','Plumbing','Electrical','Accessories','Other'];
  const catSel=el('pcat');
  if(catSel){if(stdCats.includes(p.category))catSel.value=p.category;else{catSel.value='__custom__';sv('pcat-custom',p.category);if(el('pcat-custom'))el('pcat-custom').style.display='';}};sv('pcost',p.cost);sv('pprice',p.price);sv('pqty',p.qty);sv('punit',p.unit);sv('plow',p.lowLevel||'');sv('pdesc',p.desc||'');sv('psize',p.size||'');
  el('pdelbtn').style.display=canDel()?'':'none';el('pshtbtn').style.display='';
  if(p.imgData){['pimg-cam','pimg-gal'].forEach(x=>{const e2=el(x);if(e2)e2.dataset.img=p.imgData;});el('pimgthumb').src=p.imgData;el('pimg-prev-wrap').style.display='';el('pimg-upload-area').style.display='none';}else clearProdImg();
  openD('d-prod');
}

function reqDelProd(){
  const b=biz();const p=(b.products||[]).find(x=>x.id===editProdId);if(!p)return;
  showConf('🗑️','Delete Product?',`"${p.name}" will be permanently removed.`,()=>{
    b.products=b.products.filter(x=>x.id!==p.id);addAdminLog('del_prod','Deleted: '+p.name,CU.name);
    dbSave();closeD('d-prod');renderProducts();renderGallery();renderDash();toast('Product deleted');
  });
}

function downloadSheet(){
  const b=biz();const p=(b.products||[]).find(x=>x.id===editProdId);if(!p)return;
  const w=window.open('','_blank');if(!w)return;const mg=p.price-p.cost,mp=p.cost>0?((mg/p.price)*100).toFixed(1):0;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${p.name}</title><style>body{font-family:Georgia,serif;max-width:580px;margin:36px auto;padding:20px;color:#111}*{box-sizing:border-box}h1{font-size:19px;font-weight:900;color:#B8900A}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:13px 0}.fl{font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.1em;display:block;margin-bottom:3px}.fv{font-size:17px;font-weight:900;color:#D4A520}.img{width:100px;height:100px;border-radius:10px;border:2px solid #D4A520;display:flex;align-items:center;justify-content:center;font-size:38px;background:#f5f0e6;float:left;margin:0 14px 10px 0;overflow:hidden}.img img{width:100%;height:100%;object-fit:cover;border-radius:8px}hr{border:none;border-top:3px solid #D4A520;margin:11px 0}.foot{text-align:center;font-size:10px;color:#999;margin-top:11px}@media print{button{display:none}}</style></head><body><div class="img">${p.imgData?`<img src="${p.imgData}">`:(CATI[p.category]||'📦')}</div><h1>${p.name}</h1><div style="font-size:11px;color:#B8900A;font-family:monospace;margin-bottom:4px">SKU: ${p.sku||'N/A'}</div>${p.size?`<div style="font-size:12px;color:#666;margin-bottom:5px">Size: <strong>${p.size}</strong></div>`:''}<span style="background:#f5f0e6;border:1px solid #D4A520;border-radius:99px;padding:2px 11px;font-size:11px;font-weight:700;color:#B8900A">${p.category}</span><hr style="clear:both"><div class="grid"><div><span class="fl">Cost</span><span class="fv">${sym()}${p.cost.toFixed(2)}</span></div><div><span class="fl">Sell Price</span><span class="fv">${sym()}${p.price.toFixed(2)}</span></div><div><span class="fl">Margin</span><span class="fv">${mp}%</span></div><div><span class="fl">In Stock</span><span class="fv">${p.qty} ${p.unit}</span></div><div><span class="fl">Low Alert</span><span class="fv">${p.lowLevel||b.lowStock||5}</span></div><div><span class="fl">Status</span><span class="fv" style="color:${p.qty<=0?'#EF4444':p.qty<=(p.lowLevel||5)?'#F59E0B':'#22C55E'}">${p.qty<=0?'OUT':p.qty<=(p.lowLevel||5)?'LOW':'OK'}</span></div></div>${p.desc?`<div style="background:#f9f7f2;border:1px solid #e8e0cc;border-radius:8px;padding:11px;font-size:13px;color:#555;line-height:1.6;margin-bottom:11px">${p.desc}</div>`:''}<div class="foot">${b.name} · Printed ${new Date().toLocaleString()}</div><br><button onclick="window.print()" style="background:#D4A520;color:#000;border:none;padding:9px 22px;border-radius:8px;font-weight:700;cursor:pointer">🖨 Print</button>` + '</bo' + 'dy></ht' + 'ml>');w.document.close();
}

// ── EXPENSES (admin edit) ──


function triggerPWAInstall() {
  if (window.triggerPWAInstall && window.triggerPWAInstall !== triggerPWAInstall) {
    window.triggerPWAInstall();
  } else {
    window.showManualInstallGuide ? window.showManualInstallGuide() :
    alert('Tap the 3-dot menu (⋮) in Chrome→ "Add to Home screen" → "Add"');
  }
}

// ── EXPENSES (admin edit) ──
function fillExpSummary(){const b=biz();if(!b)return;const e=(b.expenses||[]).filter(x=>x.status!=='cancelled');const ts=arr=>arr.reduce((a,b)=>a+(b.amount||0),0);el('et').textContent=f$(ts(e.filter(x=>isToday(x.date))));el('ew').textContent=f$(ts(e.filter(x=>isWeek(x.date))));el('em').textContent=f$(ts(e.filter(x=>isMon(x.date))));}
function setEF(f,e){expFilter=f;document.querySelectorAll('#pg-expenses .chip').forEach(c=>c.classList.remove('on'));e&&e.classList.add('on');renderExpenses();}
function renderExpenses(){
  var b=biz();
  if(!b){var _ew=el('elist');if(_ew)_ew.innerHTML='<div style="padding:30px;text-align:center"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-weight:700;color:var(--t1)">Loading data...</div><div style="font-size:12px;color:var(--t3);margin-top:6px">If stuck: tap More → Sync → Reconnect</div></div>';return;}fillExpSummary();
  var exps=(b.expenses||[]).filter(function(e){
    return e.status!=='cancelled'&&(
      expFilter==='all'||
      (expFilter==='today'&&isToday(e.date))||
      (expFilter==='week' &&isWeek(e.date))||
      (expFilter==='month'&&isMon(e.date)));
  }).sort(function(a,b){return b.id-a.id;});
  var wrap=el('elist');if(!wrap)return;
  var dn=getDailyNet(today());
  var allocOn = (b.allocationsEnabled !== false);
  var allocCalcLine = '';
  if (allocOn && dn.allocExp > 0.01) {
    allocCalcLine =
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--t3);padding-left:10px"><span>↳ Cash expenses</span><span>'+f$(dn.actualExp)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--wa);padding-left:10px"><span>↳ 📋 Allocated</span><span>'+f$(dn.allocExp)+'</span></div>';
  }
  var h2=
    '<div class="card" style="margin-bottom:10px;padding:13px">'+
      '<div style="font-size:10px;font-weight:700;color:var(--g);text-transform:uppercase;letter-spacing:.08em;margin-bottom:9px">Today\'s Net Calculation</div>'+
      '<div style="display:flex;flex-direction:column;gap:5px">'+
        '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--t2)">Gross Sales</span><span class="fw7 c-ok">'+f$(dn.gross)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--t2)">Total Expenses</span><span class="fw7 c-er">− '+f$(dn.exp)+'</span></div>'+
        allocCalcLine+
        '<div style="height:1px;background:var(--bd);margin:4px 0"></div>'+
        '<div style="display:flex;justify-content:space-between;font-size:15px"><span class="fw7">Net Sales</span>'+
          '<span class="fw9 disp" style="color:'+(dn.net>=dn.gross*0.7?'var(--ok)':'var(--wa)')+'">'+f$(dn.net)+'</span>'+
        '</div>'+
      '</div>'+
    '</div>';
  if(!exps.length && (!allocOn || dn.allocExp <= 0.01)){h2+=em('No expenses. Tap + to add.');wrap.innerHTML=h2;return;}
  h2+='<div class="card">';
  exps.forEach(function(e){
    var safeDesc=(e.description||'Expense').replace(/['"]/g,'');
    var editBadge=e.editLog&&e.editLog.length?' <span class="bdg bin0" style="font-size:9px">&#9999;'+e.editLog.length+'</span>':'';
    var lockBadge=(!isAdmin()&&isRecordLocked(e))?' <span class="bdg bwa0" style="font-size:9px">&#9203;</span>':'';
    var adminBtns=
      '<button type="button" class="edit-btn" style="margin-top:4px" onclick="openEditExp('+e.id+')">&#9998;</button> '+
      '<button type="button" class="edit-btn" style="margin-top:4px;color:var(--er);border-color:var(--erbd);background:var(--erb)" onclick="deleteExpense('+e.id+')">&#128465;</button>';
    var pendingBtns=hasPendingCR('expense',e.id)
      ?'<span class="pending-badge" style="margin-top:4px;display:block">&#9203; Pending</span>'
      :'<button type="button" class="edit-btn" style="margin-top:4px;color:var(--wa);border-color:var(--wabd);background:var(--wab)" onclick="openRecordChangeRequest(\'expense\','+e.id+',\''+safeDesc+'\')">&#9203; Req</button>';
    var editBtns=
      '<button type="button" class="edit-btn" style="margin-top:4px" onclick="openEditExp('+e.id+')">&#9998;</button> '+
      '<button type="button" class="edit-btn" style="margin-top:4px;color:var(--er);border-color:var(--erbd);background:var(--erb)" onclick="deleteExpense('+e.id+')">&#128465;</button>';
    var actionBtns=isAdmin()?adminBtns:(isRecordLocked(e)?pendingBtns:editBtns);
    h2+=
      '<div style="display:flex;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid rgba(212,165,32,.06)">'+
        '<div class="ci" style="background:var(--erb)">&#128424;</div>'+
        '<div class="cb">'+
          '<div class="ct">'+esc(e.description)+editBadge+lockBadge+'</div>'+
          '<div class="cs">'+esc(e.category||'General')+' · '+e.date+' · by '+esc(e.by||'')+'</div>'+
        '</div>'+
        '<div style="text-align:right;flex-shrink:0">'+
          '<div class="fw9 c-er" style="font-family:var(--fd);font-size:14px">&#8722;'+f$(e.amount)+'</div>'+
          actionBtns+
        '</div>'+
      '</div>';
  });
  h2+='</div>';
  // ── ALLOCATED ENTRIES (read-only, only when toggle ON) ──
  if (allocOn && typeof getDayAllocations === 'function') {
    // Determine date range based on filter
    var allocStart, allocEnd;
    if (expFilter === 'today') { allocStart = allocEnd = today(); }
    else if (expFilter === 'week') {
      var dW = new Date(today() + 'T00:00:00');
      var wa = new Date(dW); wa.setDate(dW.getDate() - 6);
      allocStart = wa.toISOString().split('T')[0];
      allocEnd = today();
    } else if (expFilter === 'month') {
      var dM = new Date(today() + 'T00:00:00');
      allocStart = new Date(dM.getFullYear(), dM.getMonth(), 1).toISOString().split('T')[0];
      allocEnd = today();
    } else { /* all */
      allocStart = '1900-01-01';
      allocEnd = today();
    }
    // Aggregate allocations per source across the range
    var sourceMap = {};
    var cur = new Date(allocStart + 'T00:00:00');
    var endD = new Date(allocEnd + 'T00:00:00');
    while (cur <= endD) {
      var iso = cur.toISOString().split('T')[0];
      var a = getDayAllocations(iso);
      if (a && a.breakdown && a.breakdown.length) {
        a.breakdown.forEach(function(b2){
          var key = b2.type + '-' + b2.id;
          if (!sourceMap[key]) {
            sourceMap[key] = { type: b2.type, name: b2.name, id: b2.id, days: 0, total: 0 };
          }
          sourceMap[key].days++;
          sourceMap[key].total += b2.amount;
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
    var allocList = Object.values(sourceMap);
    if (allocList.length) {
      h2 += '<div class="card" style="margin-top:14px">'+
        '<div style="padding:11px 14px;background:rgba(245,158,11,.06);border-bottom:1px solid rgba(245,158,11,.2);display:flex;align-items:center;justify-content:space-between">'+
          '<div>'+
            '<div style="font-size:11px;font-weight:800;color:var(--wa);text-transform:uppercase;letter-spacing:.08em;font-family:var(--fm)">📋 Allocated Expenses</div>'+
            '<div style="font-size:10px;color:var(--t3);margin-top:1px">Read-only · auto-calculated from documents &amp; salaries</div>'+
          '</div>'+
        '</div>';
      allocList.forEach(function(a){
        var icon = a.type === 'doc' ? '📋' : '👤';
        var sourceLbl = a.type === 'doc' ? 'Documentation' : 'Salary';
        var editPage = a.type === 'doc' ? 'docexp' : 'salary';
        h2 += '<div style="display:flex;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid rgba(212,165,32,.06)">'+
          '<div class="ci" style="background:rgba(245,158,11,.12)">'+icon+'</div>'+
          '<div class="cb">'+
            '<div class="ct">'+esc(a.name)+' <span class="bdg bwa0" style="font-size:9px">🔒 read-only</span></div>'+
            '<div class="cs">'+sourceLbl+' · '+a.days+' day'+(a.days!==1?'s':'')+' · '+
              (isAdmin() ? '<a onclick="closeSidebarMenu();goTo(\''+editPage+'\')" style="color:var(--in);cursor:pointer;text-decoration:underline">edit in '+sourceLbl+'</a>' : 'manage in '+sourceLbl)+
            '</div>'+
          '</div>'+
          '<div style="text-align:right;flex-shrink:0">'+
            '<div class="fw9 c-wa" style="font-family:var(--fd);font-size:14px">−'+f$(a.total)+'</div>'+
            '<div style="font-size:9px;color:var(--t3);margin-top:2px">'+f$(a.total/a.days)+'/day</div>'+
          '</div>'+
        '</div>';
      });
      h2 += '</div>';
    }
  }
  wrap.innerHTML=h2;
}
function openAddExp(){
  if(!canAccess('expenses')){toast('No access','er');return;}
  editingExpId=null;el('exp-dr-ttl').textContent='Add Expense';el('exp-reason-wrap').style.display='none';el('exp-save-btn').textContent='💸 Save Expense';el('exp-save-btn').className='btn ber bbl mt8';
  sv('exd',today());sv('exa','');sv('exdesc','');sv('exc','General');sv('exp-reason','');
  openD('d-exp');setTimeout(()=>el('exa')?.focus(),300);
}
function openEditExp(expId){
  const b=biz();const e=(b.expenses||[]).find(x=>x.id===expId);if(!e)return;
  // If record is locked AND user is not admin AND no admin unlock
  if(isRecordLocked(e)&&!isAdmin()&&!e.adminUnlocked){
    openRecordChangeRequest('expense',expId,e.description||('Expense #'+expId));return;
  }
  if(!isAdmin()){toast('Admin access required','er');return;}
  // Skip PIN if expense is within the 3-hour grace window
  var __doEditExp = function(){
    editingExpId=expId;el('exp-dr-ttl').textContent='Edit Expense (Admin)';el('exp-reason-wrap').style.display='';el('exp-save-btn').textContent='💾 Update Expense';el('exp-save-btn').className='btn bg bbl mt8';
    sv('exd',e.date);sv('exa',e.amount);sv('exdesc',e.description);sv('exc',e.category||'General');sv('exp-reason','');
    openD('d-exp');setTimeout(()=>el('exp-reason')?.focus(),300);
  };
  if (!isRecordLocked(e)) { __doEditExp(); return; }
  requireAdminPin(__doEditExp, null, 'Edit Expense — enter admin password (locked: older than 3h)');
}
function saveExpense(_saveMode){
  const b=biz();if(!b)return;const date=el('exd')?.value||today(),amount=parseFloat(el('exa')?.value)||0,desc=gv('exdesc'),cat=el('exc')?.value||'General';
  if(amount<=0){toast('Enter a valid amount','er');return;}if(!desc){toast('Description required','er');return;}const now=Date.now();
  if(editingExpId){
    const reason=gv('exp-reason');if(!reason){toast('Reason for edit required','er');return;}
    const e=(b.expenses||[]).find(x=>x.id===editingExpId);if(!e)return;
    const before={date:e.date,amount:e.amount,description:e.description,category:e.category};
    e.date=date;e.amount=amount;e.description=desc;e.category=cat;e.updatedAt=now;
    if(!e.editLog)e.editLog=[];e.editLog.push({by:CU.name,at:now,reason,before});
    addAdminLog('edit_exp',`Edited Expense: ${f$(amount)} — ${desc} (${reason})`,CU.name);toast('Expense updated!');
  }else{
    if(!b.expenses)b.expenses=[];if(!b.nextExpId)b.nextExpId=1;
    b.expenses.unshift({id:b.nextExpId++,date,amount,description:desc,category:cat,by:CU?.name||'unknown',createdAt:now,updatedAt:now,status:'active',editLog:[]});
    addAdminLog('add_exp',`Expense: ${f$(amount)} — ${desc}`,CU.name);addNotif('expense',`💸 ${f$(amount)} — ${desc}`);toast(`Expense ${f$(amount)} saved`);
  }
  dbSave();fillExpSummary();renderExpenses();renderDash();checkNotif();editingExpId=null;
  if(_saveMode==='addnew'){ toast('Saved! Add another expense','gd'); setTimeout(function(){openAddExp();},150); }
  else { closeD('d-exp'); }
}
function deleteExpense(id){
  if(!isAdmin()){
    const b=biz();const e=(b.expenses||[]).find(x=>x.id===id);
    if(!e)return;
    if(isRecordLocked(e)){openRecordChangeRequest('expense',id,e.description||('Expense #'+id));el('rec-cr-action').value='delete';return;}
    toast('Admin access required','er');return;
  }
  requireAdminPin(function(){
    showConf('🗑️','Delete Expense?','This expense will be permanently removed.',function(){
      var b=biz();
      var expToDelete=(b.expenses||[]).find(function(x){return x.id===id;});
      if(expToDelete){ softDelete(expToDelete); }
      addAdminLog('del_exp','Deleted expense',CU.name);dbSave();renderExpenses();fillExpSummary();renderDash();toast('Deleted');
    });
  }, null, 'Delete Expense — enter admin PIN to confirm');
}

// ── GALLERY ──
function setGalCat(c){galCat=c;renderGallery();}
function renderGallery(){
  const b=biz();if(!b)return;const q=(el('galq')?.value||'').toLowerCase(),sort=el('galsort')?.value||'def',stk=el('galstk')?.value||'all',lv=b.lowStock||5;
  const cats=['all',...new Set((b.products||[]).map(p=>p.category))];
  el('galchips').innerHTML=cats.map(c=>`<div class="chip${galCat===c?' on':''}" onclick="setGalCat('${c}')">${c==='all'?'All':c}</div>`).join('');
  let prods=(b.products||[]).filter(p=>{const mq=!q||p.name.toLowerCase().includes(q)||(p.size||'').toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q);const mc=galCat==='all'||p.category===galCat;const ms=stk==='all'||(stk==='in'&&p.qty>(p.lowLevel||lv))||(stk==='low'&&p.qty>0&&p.qty<=(p.lowLevel||lv))||(stk==='out'&&p.qty<=0);return mq&&mc&&ms;});
  if(sort==='az')prods=[...prods].sort((a,b)=>a.name.localeCompare(b.name));else if(sort==='qa')prods=[...prods].sort((a,b)=>a.qty-b.qty);else if(sort==='qd')prods=[...prods].sort((a,b)=>b.qty-a.qty);else if(sort==='new')prods=[...prods].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const wrap=el('galwrap');if(!wrap)return;
  if(!prods.length){wrap.innerHTML='<div style="padding:20px">'+em('No products match filters')+'</div>';return;}
  wrap.innerHTML=`<div class="gg">${prods.map(p=>{const isLow=p.qty>0&&p.qty<=(p.lowLevel||lv),isOut=p.qty<=0,locked=isProdLocked(p);const badge=isOut?'<div class="gbadge" style="background:var(--er);color:#fff">OUT</div>':isLow?'<div class="gbadge" style="background:var(--wa);color:#fff">LOW</div>':locked?'<div class="gbadge" style="background:var(--lock);color:#fff">🔒</div>':'';return `<div class="gcard${locked?' locked':''}" onclick="openGalDetail(${p.id})"><div class="gimg">${p.imgData?`<img src="${p.imgData}" alt="${esc(p.name)}">`:CATI[p.category]||'📦'}${badge}</div><div class="ginfo"><div class="gname">${esc(p.name)}</div><div class="gprice">${f$(p.price)}</div><div class="gqty" style="color:${isOut?'var(--er)':isLow?'var(--wa)':'var(--t3)'}">${p.qty} ${p.unit} in stock</div>${p.size?`<div><span class="bdg bg0" style="font-size:9px;margin-top:2px">${esc(p.size)}</span></div>`:''}</div></div>`;}).join('')}</div>`;
}
function openGalDetail(id){
  const b=biz();const p=(b.products||[]).find(x=>x.id===id);if(!p)return;const lv=p.lowLevel||b.lowStock||5,isLow=p.qty>0&&p.qty<=lv,isOut=p.qty<=0,locked=isProdLocked(p);
  el('gdttl').textContent=p.name;el('gdimg').innerHTML=p.imgData?`<img src="${p.imgData}" style="width:100%;height:200px;object-fit:cover">`:`<div style="width:100%;height:200px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:56px">${CATI[p.category]||'📦'}</div>`;
  el('gdinfo').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px"><div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r10);padding:11px;text-align:center"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">In Stock</div><div class="fw9 disp" style="font-size:20px;color:${isOut?'var(--er)':isLow?'var(--wa)':'var(--ok)'}">${p.qty}<br><span style="font-size:10px;font-weight:400;color:var(--t3)">${p.unit}</span></div></div><div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r10);padding:11px;text-align:center"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Price</div><div class="fw9 disp c-g" style="font-size:20px">${f$(p.price)}</div></div><div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r10);padding:11px;text-align:center"><div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px">Category</div><div style="font-size:20px">${CATI[p.category]||'📦'}</div></div></div>${p.size?`<div style="margin-bottom:9px"><span class="bdg bg0">${esc(p.size)}</span></div>`:''}${p.sku?`<div style="margin-bottom:9px;font-family:var(--fm);font-size:12px;color:var(--t2)">SKU: ${esc(p.sku)}</div>`:''}${locked?`<div class="lock-banner"><div class="li">🔒</div><div class="lt">Locked · ${prodLockRem(p)} remaining<br>${isAdmin()?'Admin can override edit.':'Submit a change request.'}</div></div>`:''}<button type="button" class="btn bgh bsm" onclick="closeD('d-galdet');openEditProd(${p.id})">✏ Edit Product</button>`;
  openD('d-galdet');
}

// ── SALARY ──
function fillSalMonths(){const sel=el('smonsel');if(!sel)return;const ms=months();sel.innerHTML=ms.map(m=>`<option value="${m}">${m}</option>`).join('');sel.value=thisMonth();}