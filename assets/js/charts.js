/* === charts.js === */
/* SmartStock Pro V5 — Charts (Real Data) */
var Charts = {

  /* ── CSS BAR CHART ────────────────────────────────────────────────────── */
  bar: function(data, labels, color, currency) {
    color    = color    || 'gold';
    currency = currency || '';
    var max  = Math.max.apply(null, data.concat([1]));
    var bars = data.map(function(v, i) {
      var pct  = Math.max(3, Math.round((v/max)*100));
      var disp = '';
      if (v > 0) {
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
    var bars = lbls.map(function(lbl,i){
      var rPct = Math.max(3, Math.round((revData[i]/max)*100));
      var ePct = Math.max(3, Math.round((expData[i]/max)*100));
      return '<div class="bar-col" style="flex:1;min-width:0">'
        + '<div style="display:flex;gap:2px;align-items:flex-end;height:80px;margin-bottom:4px">'
        + '<div style="flex:1;background:var(--ok);border-radius:4px 4px 0 0;height:'+rPct+'%;min-height:3px" title="Rev: '+c+revData[i].toFixed(0)+'"></div>'
        + '<div style="flex:1;background:var(--er);border-radius:4px 4px 0 0;height:'+ePct+'%;min-height:3px" title="Exp: '+c+expData[i].toFixed(0)+'"></div>'
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
      var disp = p.rev >= 1000 ? c+(p.rev/1000).toFixed(1)+'k' : c+p.rev.toFixed(0);
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
