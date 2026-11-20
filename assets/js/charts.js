/* === charts.js === */
/* SmartStock Pro V5 — Charts (Real Data) */
var Charts = {
  // Hide amount labels while the privacy lock is on
  _hide: function() { return typeof Privacy !== 'undefined' && Privacy.masked(); },

  /* ── CSS BAR CHART ────────────────────────────────────────────────────── */
  bar: function(data, labels, color, currency) {
    color    = color    || 'gold';
    currency = currency || '';
    var max  = Math.max.apply(null, data.concat([1]));
    var bars = data.map(function(v, i) {
      var pct  = Math.max(3, Math.round((v/max)*100));
      var disp = '';
      if (v > 0 && currency && Charts._hide()) disp = '••';
      else if (v > 0) {
        disp = currency
          ? (currency + (v >= 1000 ? (v/1000).toFixed(1)+'k' : Math.round(v)))
          : Math.round(v);
      }
      return '<div class="bar-col">'
        + '<div style="font-size:9px;color:var(--t3);text-align:center;margin-bottom:2px;min-height:13px;line-height:13px">' + disp + '</div>'
        + '<div class="bar-fill ' + color + '" style="height:' + pct + '%" title="' + labels[i] + ': ' + disp + '"></div>'
        + '<div class="bar-lbl">' + labels[i] + '</div>'
        + '</div>';
    }).join('');
    return '<div class="bar-chart">' + bars + '</div>';
  },

  /* ── 7-DAY REVENUE ────────────────────────────────────────────────────── */
  weekBars: function(sales, cur) {
    var days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var today = new Date();
    var data  = [];
    var lbls  = [];
    for (var i = 6; i >= 0; i--) {
      var d  = new Date(today); d.setDate(d.getDate() - i);
      var ds = d.toISOString().slice(0,10);
      var v  = sales.filter(function(s){ return s.date===ds; })
                    .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
      data.push(v);
      lbls.push(days[d.getDay()]);
    }
    return Charts.bar(data, lbls, 'gold', cur||'$');
  },

  /* ── 6-MONTH REVENUE ──────────────────────────────────────────────────── */
  monthBars: function(sales, cur, color) {
    var today = new Date();
    var data = []; var lbls = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(today.getFullYear(), today.getMonth()-i, 1);
      var m = d.toISOString().slice(0,7);
      var v = sales.filter(function(s){ return s.date&&s.date.startsWith(m); })
                   .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
      data.push(v); lbls.push(d.toLocaleString('default',{month:'short'}));
    }
    return Charts.bar(data, lbls, color||'gold', cur||'$');
  },

  /* ── REVENUE vs EXPENSES side-by-side ────────────────────────────────── */
  revenueVsExpenses: function(sales, expenses, cur) {
    var today = new Date();
    var revData=[]; var expData=[]; var lbls=[];
    for (var i=5; i>=0; i--) {
      var d = new Date(today.getFullYear(), today.getMonth()-i, 1);
      var m = d.toISOString().slice(0,7);
      var rev = sales.filter(function(s){ return s.date&&s.date.startsWith(m); })
                     .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
      var exp = expenses.filter(function(e){ return e.date&&e.date.startsWith(m); })
                        .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
      revData.push(rev); expData.push(exp);
      lbls.push(d.toLocaleString('default',{month:'short'}));
    }
    var max = Math.max.apply(null, revData.concat(expData).concat([1]));
    var c   = cur||'$';
    var hideAmt = Charts._hide();
    var bars = lbls.map(function(lbl,i){
      var rPct = Math.max(3, Math.round((revData[i]/max)*100));
      var ePct = Math.max(3, Math.round((expData[i]/max)*100));
      return '<div class="bar-col" style="flex:1;min-width:0">'
        + '<div style="display:flex;gap:2px;align-items:flex-end;height:80px;margin-bottom:4px">'
        + '<div style="flex:1;background:var(--ok);border-radius:4px 4px 0 0;height:'+rPct+'%;min-height:3px" title="Rev: '+(hideAmt?c+'••':c+revData[i].toFixed(0))+'"></div>'
        + '<div style="flex:1;background:var(--er);border-radius:4px 4px 0 0;height:'+ePct+'%;min-height:3px" title="Exp: '+(hideAmt?c+'••':c+expData[i].toFixed(0))+'"></div>'
        + '</div><div class="bar-lbl">'+lbl+'</div></div>';
    }).join('');
    return '<div style="display:flex;gap:4px;height:110px;align-items:flex-end">' + bars + '</div>'
      + '<div style="display:flex;gap:16px;justify-content:center;margin-top:8px">'
      + '<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--t2)"><div style="width:10px;height:10px;background:var(--ok);border-radius:2px"></div>Revenue</div>'
      + '<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--t2)"><div style="width:10px;height:10px;background:var(--er);border-radius:2px"></div>Expenses</div>'
      + '</div>';
  },

  /* ── TOP 5 PRODUCTS horizontal progress bars ─────────────────────────── */
  topProducts: function(sales, cur) {
    var prodMap = {};
    sales.forEach(function(s){
      (s.items||[]).forEach(function(item){
        var k = item.name||'Unknown';
        if (!prodMap[k]) prodMap[k] = {rev:0, qty:0};
        prodMap[k].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
        prodMap[k].qty += parseInt(item.qty)||1;
      });
    });
    var sorted = Object.keys(prodMap).map(function(k){
      return {name:k, rev:prodMap[k].rev, qty:prodMap[k].qty};
    }).sort(function(a,b){ return b.rev-a.rev; }).slice(0,5);

    if (!sorted.length) {
      return '<div style="text-align:center;padding:20px;color:var(--t3);font-size:12px">No sales data yet</div>';
    }
    var maxRev = sorted[0].rev;
    var c = cur||'$';
    return sorted.map(function(p,i){
      var pct  = Math.max(4, Math.round((p.rev/maxRev)*100));
      var disp = Charts._hide() ? c+'••••' : (p.rev >= 1000 ? c+(p.rev/1000).toFixed(1)+'k' : c+p.rev.toFixed(0));
      return '<div style="margin-bottom:12px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
        + '<div style="display:flex;align-items:center;gap:6px">'
        + '<div style="width:18px;height:18px;border-radius:50%;background:var(--gb);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:var(--g)">'+(i+1)+'</div>'
        + '<span style="font-size:12px;font-weight:600;color:var(--t1);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+Utils.esc(p.name)+'</span>'
        + '</div>'
        + '<div style="text-align:right">'
        + '<span style="font-size:13px;font-weight:800;color:var(--g)">'+disp+'</span>'
        + '<span style="font-size:10px;color:var(--t3);margin-left:4px">'+p.qty+' units</span>'
        + '</div></div>'
        + '<div style="background:var(--bd);border-radius:99px;height:6px">'
        + '<div style="background:linear-gradient(90deg,var(--g),#F0C866);border-radius:99px;height:6px;width:'+pct+'%;transition:width .6s ease"></div>'
        + '</div></div>';
    }).join('');
  },

  /* ── 7-DAY SALES TREND (SVG area chart, dashboard) ───────────────────── */
  salesTrend: function(sales, cur, showMoney) {
    cur = cur || '$';
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var vals = [], lbls = [], dates = [];
    var now = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now); d.setDate(d.getDate() - i);
      var ds = d.toISOString().slice(0, 10);
      dates.push(ds);
      lbls.push(i === 0 ? 'Today' : days[d.getDay()]);
      vals.push(sales.filter(function(s){ return s.date === ds; })
        .reduce(function(a, s){ return a + (parseFloat(s.total) || 0); }, 0));
    }
    var total = vals.reduce(function(a, v){ return a + v; }, 0);
    // previous 7 days for the % change badge
    var prevStart = new Date(now); prevStart.setDate(prevStart.getDate() - 13);
    var ps = prevStart.toISOString().slice(0, 10), pe = dates[0];
    var prev = sales.filter(function(s){ return s.date >= ps && s.date < pe; })
      .reduce(function(a, s){ return a + (parseFloat(s.total) || 0); }, 0);
    var chg = prev > 0 ? Math.round(((total - prev) / prev) * 100) : null;

    function compact(v) {
      if (v >= 1e6) return cur + (v / 1e6).toFixed(1) + 'M';
      if (v >= 1e3) return cur + (v / 1e3).toFixed(1) + 'k';
      return cur + Math.round(v);
    }
    // Draw narrower on phones so labels stay readable instead of shrinking
    var narrow = (window.innerWidth || 1024) < 640;
    var W = narrow ? 340 : 640, H = narrow ? 190 : 210, padX = narrow ? 18 : 22, top = 30, bottom = 30;
    var max = Math.max.apply(null, vals.concat([1])) * 1.12;
    var step = (W - padX * 2) / 6;
    var pts = vals.map(function(v, i) {
      return [padX + i * step, top + (H - top - bottom) * (1 - v / max)];
    });
    var line = pts.map(function(p, i){ return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var base = H - bottom;
    var area = line + ' L' + pts[6][0].toFixed(1) + ' ' + base + ' L' + pts[0][0].toFixed(1) + ' ' + base + ' Z';
    var grid = [0, 0.5, 1].map(function(f){
      var y = (top + (H - top - bottom) * f).toFixed(1);
      return '<line class="grid" x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke-dasharray="' + (f === 1 ? '0' : '3 5') + '"/>';
    }).join('');
    var marks = pts.map(function(p, i) {
      var tip = lbls[i] + ' (' + dates[i] + '): ' + (showMoney ? cur + vals[i].toFixed(2) : 'hidden');
      return '<g><title>' + tip + '</title>'
        + '<rect class="hit" x="' + (p[0] - step / 2).toFixed(1) + '" y="0" width="' + step.toFixed(1) + '" height="' + H + '"/>'
        + (showMoney && vals[i] > 0 ? '<text class="val" x="' + p[0].toFixed(1) + '" y="' + (p[1] - 10).toFixed(1) + '" text-anchor="middle">' + compact(vals[i]) + '</text>' : '')
        + '<circle class="dot' + (i === 6 ? ' today' : '') + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (i === 6 ? 5 : 4) + '"/>'
        + '<text class="axis" x="' + p[0].toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle"' + (i === 6 ? ' style="fill:var(--g);font-weight:700"' : '') + '>' + lbls[i] + '</text>'
        + '</g>';
    }).join('');
    var badge = chg === null ? ''
      : '<span class="trend-chg ' + (chg >= 0 ? 'up' : 'down') + '">' + (chg >= 0 ? '▲ ' : '▼ ') + Math.abs(chg) + '% vs last week</span>';

    return '<div class="trend-card">'
      + '<div class="trend-head"><div>'
      + '<div class="trend-title">' + Icons.svg('chart-line', 18) + 'Sales — last 7 days</div>'
      + '<div class="trend-total">' + (showMoney ? Utils.cur(total, cur) : '— — —') + '</div>'
      + '</div>' + (showMoney ? badge : '') + '</div>'
      + '<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sales for the last 7 days">'
      + '<defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">'
      + '<stop offset="0%" style="stop-color:var(--g);stop-opacity:.32"/><stop offset="100%" style="stop-color:var(--g);stop-opacity:0"/>'
      + '</linearGradient></defs>'
      + grid
      + '<path d="' + area + '" fill="url(#trendFill)"/>'
      + '<path class="line" d="' + line + '"/>'
      + marks
      + '</svg></div>';
  },

  /* ── PROFIT TREND (7-day sparkline) ──────────────────────────────────── */
  profitSparkline: function(sales, expenses, cur) {
    var today = new Date();
    var data  = []; var lbls = [];
    for (var i=6; i>=0; i--) {
      var d  = new Date(today); d.setDate(d.getDate()-i);
      var ds = d.toISOString().slice(0,10);
      var rev = sales.filter(function(s){ return s.date===ds; })
                     .reduce(function(a,s){ return a+(parseFloat(s.total)||0); }, 0);
      var exp = expenses.filter(function(e){ return e.date===ds; })
                        .reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
      data.push(rev - exp);
      var days=['Su','Mo','Tu','We','Th','Fr','Sa'];
      lbls.push(days[d.getDay()]);
    }
    var max = Math.max.apply(null, data.map(function(v){return Math.abs(v);}).concat([1]));
    return data.map(function(v,i){
      var pct  = Math.max(3, Math.round((Math.abs(v)/max)*100));
      var col  = v >= 0 ? 'var(--ok)' : 'var(--er)';
      return '<div class="bar-col">'
        + '<div style="background:'+col+';border-radius:4px 4px 0 0;height:'+pct+'%;min-height:3px;margin-top:auto"></div>'
        + '<div class="bar-lbl">'+lbls[i]+'</div></div>';
    }).join('');
  },
};
