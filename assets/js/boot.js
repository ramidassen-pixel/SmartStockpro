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
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }
})();
