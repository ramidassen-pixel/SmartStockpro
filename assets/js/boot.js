(function() {
  var msgs = ['Loading...','Database ready...','Almost there...','Welcome!'];
  var el = document.getElementById('splash-txt');
  msgs.forEach(function(m,i){ setTimeout(function(){ if(el) el.textContent=m; }, i*700+300); });
  function showError(msg) {
    var loader = document.getElementById('loader');
    if (!loader) return;
    loader.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px;text-align:center">'
      + '<div style="font-size:48px;margin-bottom:16px">⚠️</div>'
      + '<div style="color:#FF4D6A;font-size:16px;font-weight:700;margin-bottom:12px">App Error</div>'
      + '<div style="color:#aaa;font-size:12px;max-width:280px;line-height:1.7">' + msg + '</div>'
      + '<button onclick="location.reload()" style="margin-top:24px;background:#D4A843;color:#07080D;border:none;padding:14px 32px;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer">↻ Reload</button>'
      + '</div>';
  }
  setTimeout(function() {
    try {
      if (typeof DB  === 'undefined') { showError('DB missing. Clear cache and reload.'); return; }
      if (typeof App === 'undefined') { showError('App missing. Clear cache and reload.'); return; }
      DB.load(); App.boot();
    } catch(e) { showError((e && e.message) ? e.message : String(e)); }
  }, 3000);
  if ('serviceWorker' in navigator) {
    // When a new app version takes over, reload once so this device runs the new code
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (!hadController || reloaded) { hadController = true; return; }
      reloaded = true;
      // Don't interrupt someone in the middle of a form
      if (document.querySelector('#modal-overlay.open, #modal-overlay:not(.hidden)')) {
        document.addEventListener('visibilitychange', function once() {
          if (document.visibilityState === 'hidden') { document.removeEventListener('visibilitychange', once); location.reload(); }
        });
      } else {
        location.reload();
      }
    });
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function(reg) {
        // Check for a new version whenever the app is brought back to the front
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState === 'visible') reg.update().catch(function(){});
        });
      }).catch(function(){});
    });
  }
})();
