var AI = {
  history: [],
  busy: false,
  inited: false,
  KEY: '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',

  render: function() {
    var pg = Utils.get('pg-ai');
    if (!pg) return;
    pg.innerHTML = '<div class="ai-wrap">'
      + '<div class="ai-head">'
      + '<div class="ai-brand">'
      + '<div class="ai-avatar">🤖</div>'
      + '<div style="flex:1">'
      + '<div class="ai-title">SmartStock AI</div>'
      + '<div class="ai-status">'
      + '<span class="ai-status-dot"></span>'
      + '<span id="ai-status-txt">Ready — Ask me anything</span>'
      + '</div></div>'
      + '<button class="btn-ghost btn-sm" onclick="AI.clear()">Clear</button>'
      + '</div>'
      // Quick chips
      + '<div class="ai-chips">'
      + '<div class="ai-chip ai-chip-report" onclick="AI.generateFullReport()" style="background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.05));border:1px solid rgba(201,168,76,.3);color:var(--g);font-weight:700">📋 Full Business Report</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'What products are low in stock?\')">📦 Low stock?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Give me a full business summary\')">📊 Summary</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'How much did I earn today?\')">💰 Today?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Which products sell the most?\')">🏆 Top sellers?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Who owes me money?\')">💸 Debtors?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Am I making a profit?\')">📈 Profitable?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'What should I restock urgently?\')">🚨 Restock?</div>'
      + '<div class="ai-chip" onclick="AI.ask(\'Analyze my expenses this month\')">💡 Expenses?</div>'
      + '</div>'
      + '</div>'
      + '<div class="ai-msgs" id="ai-msgs"></div>'
      + '<div class="ai-input-row">'
      + '<textarea class="ai-input" id="ai-inp" placeholder="Ask anything about your business..." rows="1"'
      + ' onkeydown="if(event.keyCode===13&&!event.shiftKey){event.preventDefault();AI.send();}"'
      + ' oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,100)+\'px\'"></textarea>'
      + '<button class="ai-send" id="ai-send-btn" onclick="AI.send()">➤</button>'
      + '</div>'
      + '</div>';

    if (!this.inited) {
      this.inited = true;
      this._addBot('👋 Hi! I\'m SmartStock AI, your business assistant.\n\nI have access to your live data and can help with:\n• 📦 Inventory & stock analysis\n• 💰 Sales & revenue insights\n• 📊 Profit & expense reports\n• 💡 Smart recommendations\n• 📋 **Full Daily Business Report** — tap the gold button above\n\nUse the quick buttons above or type your question!');
    }
  },

  // ── BUILD FULL BUSINESS DATA CONTEXT ────────────────────────────────────────
  _buildFullContext: function() {
    try {
      var s        = DB.stats();
      var settings = DB.getSettings();
      var cur      = settings.currency || '$';
      var today    = Utils.today();
      var month    = today.slice(0,7);
      var now      = new Date();

      var prods    = DB.getProducts().filter(function(p){ return p.status!=='inactive'; });
      var sales    = DB.getSales();
      var expenses = DB.getExpenses();
      var custs    = DB.getCustomers();
      var suppliers= DB.getSuppliers();
      var payroll  = DB.getPayroll ? DB.getPayroll() : [];
      var allocs   = DB.getAllocatedDaily ? DB.getAllocatedDaily() : [];

      // Today
      var todaySales  = sales.filter(function(s){ return s.date===today; });
      var todayRev    = todaySales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
      var todayExp    = expenses.filter(function(e){ return e.date===today; }).reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
      var todayCOGS   = todaySales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0); },0);
      var allocDay    = allocs.reduce(function(a,x){ return a+(parseFloat(x.daily)||0); },0);

      // Month
      var monthSales  = sales.filter(function(s){ return s.date&&s.date.startsWith(month); });
      var monthRev    = monthSales.reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
      var monthExp    = expenses.filter(function(e){ return e.date&&e.date.startsWith(month); }).reduce(function(a,e){ return a+(parseFloat(e.amount)||0); },0);
      var monthCOGS   = monthSales.reduce(function(a,s){ return a+(s.items||[]).reduce(function(b,i){ return b+(parseFloat(i.cost)||0)*(parseInt(i.qty)||1); },0); },0);
      var monthGross  = monthRev - monthCOGS;
      var monthNet    = monthGross - monthExp - (allocDay*30);

      // Payment methods
      var payMethods = {};
      todaySales.forEach(function(s){ var m=s.payment||'Cash'; payMethods[m]=(payMethods[m]||0)+(parseFloat(s.total)||0); });

      // Top products today
      var prodMap = {};
      todaySales.forEach(function(s){ (s.items||[]).forEach(function(item){
        if(!prodMap[item.name]) prodMap[item.name]={qty:0,rev:0,cost:0};
        prodMap[item.name].qty += parseInt(item.qty)||1;
        prodMap[item.name].rev += (parseFloat(item.price)||0)*(parseInt(item.qty)||1);
        prodMap[item.name].cost+= (parseFloat(item.cost)||0)*(parseInt(item.qty)||1);
      }); });
      var topProds = Object.keys(prodMap).map(function(k){ return {name:k,qty:prodMap[k].qty,rev:prodMap[k].rev,profit:prodMap[k].rev-prodMap[k].cost}; })
        .sort(function(a,b){ return b.rev-a.rev; }).slice(0,5);

      // Customer debts
      var debtSales = sales.filter(function(s){ return s.status!=='Paid'; });
      var totalDebt = debtSales.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
      var debtCustMap = {};
      debtSales.forEach(function(s){ var k=s.customer||'Walk-in'; debtCustMap[k]=(debtCustMap[k]||0)+(parseFloat(s.balance)||0); });
      var topDebtors = Object.keys(debtCustMap).map(function(k){ return {name:k,debt:debtCustMap[k]}; }).sort(function(a,b){ return b.debt-a.debt; }).slice(0,5);

      // Supplier debts
      var suppDebt = suppliers.reduce(function(a,s){ return a+(parseFloat(s.balance)||0); },0);
      var topSuppDebt = suppliers.filter(function(s){ return (parseFloat(s.balance)||0)>0; }).sort(function(a,b){ return (parseFloat(b.balance)||0)-(parseFloat(a.balance)||0); }).slice(0,3);

      // Expense categories this month
      var expCats = {};
      expenses.filter(function(e){ return e.date&&e.date.startsWith(month); }).forEach(function(e){ expCats[e.category]=(expCats[e.category]||0)+(parseFloat(e.amount)||0); });

      // Stock value
      var stockValue = prods.reduce(function(a,p){ return a+(parseFloat(p.cost)||0)*(parseInt(p.qty)||0); },0);
      var lowStock   = prods.filter(function(p){ return p.qty<=(p.lowLevel||5)&&p.qty>0; });
      var outStock   = prods.filter(function(p){ return p.qty===0; });

      // Cash available
      var cashCollected = sales.filter(function(s){ return s.status==='Paid'; }).reduce(function(a,s){ return a+(parseFloat(s.total)||0); },0);
      var partCollected = sales.filter(function(s){ return s.status==='Partial'; }).reduce(function(a,s){ return a+(parseFloat(s.amountPaid)||0); },0);
      var salaryPaid    = payroll.reduce(function(a,p){ return a+(parseFloat(p.amount)||0); },0);
      var cashAvail     = cashCollected + partCollected - monthExp - salaryPaid;

      var lines = [
        '=== BUSINESS INFORMATION ===',
        'Business Name: ' + (settings.bizName||'Rock Stone'),
        'Address: ' + (settings.bizAddress||'Monrovia, Liberia'),
        'Phone: ' + (settings.bizPhone||'N/A'),
        'Report Date: ' + now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}),
        'Currency: ' + cur,
        '',
        '=== TODAY\'S PERFORMANCE ===',
        'Today Sales: ' + cur + todayRev.toFixed(2) + ' (' + todaySales.length + ' transactions)',
        'Today COGS: ' + cur + todayCOGS.toFixed(2),
        'Today Gross Profit: ' + cur + (todayRev-todayCOGS).toFixed(2),
        'Today Manual Expenses: ' + cur + todayExp.toFixed(2),
        'Today Allocated Expenses: ' + cur + allocDay.toFixed(2) + '/day',
        'Today Net Profit: ' + cur + (todayRev-todayCOGS-todayExp-allocDay).toFixed(2),
        'Payment methods today: ' + JSON.stringify(payMethods),
        '',
        '=== THIS MONTH\'S PERFORMANCE ===',
        'Month Revenue: ' + cur + monthRev.toFixed(2) + ' (' + monthSales.length + ' sales)',
        'Month COGS: ' + cur + monthCOGS.toFixed(2),
        'Month Gross Profit: ' + cur + monthGross.toFixed(2) + ' (' + (monthRev>0?((monthGross/monthRev)*100).toFixed(1):0) + '% margin)',
        'Month Expenses: ' + cur + monthExp.toFixed(2),
        'Month Net Profit: ' + cur + monthNet.toFixed(2) + ' (' + (monthRev>0?((monthNet/monthRev)*100).toFixed(1):0) + '% margin)',
        '',
        '=== TOP PRODUCTS TODAY ===',
        topProds.map(function(p,i){ return (i+1)+'. '+p.name+': '+cur+p.rev.toFixed(2)+' ('+p.qty+' units, profit: '+cur+p.profit.toFixed(2)+')'; }).join('\n') || 'No sales today',
        '',
        '=== EXPENSE BREAKDOWN (MONTH) ===',
        Object.keys(expCats).map(function(k){ return k+': '+cur+expCats[k].toFixed(2); }).join('\n') || 'No expenses this month',
        'Allocated (recurring): ' + cur + (allocDay*30).toFixed(2) + '/month (' + cur + allocDay.toFixed(2) + '/day)',
        '',
        '=== CASH & COLLECTIONS ===',
        'Cash Available (est.): ' + cur + cashAvail.toFixed(2),
        'Total Collected (Paid invoices): ' + cur + cashCollected.toFixed(2),
        'Partial Payments Collected: ' + cur + partCollected.toFixed(2),
        'Outstanding Customer Debt: ' + cur + totalDebt.toFixed(2),
        'Outstanding Supplier Debt: ' + cur + suppDebt.toFixed(2),
        'Net Receivable: ' + cur + (totalDebt-suppDebt).toFixed(2),
        '',
        '=== TOP CUSTOMER DEBTORS ===',
        topDebtors.map(function(d,i){ return (i+1)+'. '+d.name+': '+cur+d.debt.toFixed(2); }).join('\n') || 'No outstanding debts',
        '',
        '=== SUPPLIER BALANCES ===',
        topSuppDebt.map(function(s,i){ return (i+1)+'. '+s.name+': '+cur+(parseFloat(s.balance)||0).toFixed(2); }).join('\n') || 'All suppliers paid',
        'Total suppliers: ' + suppliers.length,
        '',
        '=== INVENTORY STATUS ===',
        'Total products: ' + prods.length,
        'Stock value (at cost): ' + cur + stockValue.toFixed(2),
        'Low stock products (' + lowStock.length + '): ' + lowStock.slice(0,5).map(function(p){ return p.name+'('+p.qty+')'; }).join(', '),
        'Out of stock (' + outStock.length + '): ' + outStock.slice(0,5).map(function(p){ return p.name; }).join(', '),
        '',
        '=== CUSTOMERS ===',
        'Total customers: ' + custs.length,
        'Customers with debt: ' + topDebtors.length,
        '',
        '=== SALARY ===',
        'Total salary paid: ' + cur + salaryPaid.toFixed(2),
        'Employees: ' + (DB.getEmployees ? DB.getEmployees().length : 0),
      ];

      return lines.join('\n');
    } catch(e) {
      return 'Error gathering business data: ' + e.message;
    }
  },

  // ── SIMPLE CONTEXT for regular chat ─────────────────────────────────────────
  _context: function() {
    try {
      var s = DB.stats();
      var settings = DB.getSettings();
      var cur = settings.currency||'$';
      var custs = DB.getCustomers();
      var sales = DB.getSales();
      return [
        'Business: ' + (settings.bizName||'My Store'),
        'Currency: ' + cur,
        'Products: ' + DB.getProducts().filter(function(p){ return p.status!=='inactive'; }).length + ' active',
        'Low stock (' + s.lowStock.length + '): ' + s.lowStock.slice(0,5).map(function(p){ return p.name+'('+p.qty+')'; }).join(', '),
        'Out of stock (' + s.outStock.length + '): ' + s.outStock.slice(0,3).map(function(p){ return p.name; }).join(', '),
        'Total revenue this month: ' + cur + s.totalRev.toFixed(2),
        'Total expenses this month: ' + cur + s.totalExp.toFixed(2),
        'Net profit: ' + cur + s.netProfit.toFixed(2),
        'Today revenue: ' + cur + s.todayRev.toFixed(2) + ' (' + s.todayCount + ' sales)',
        'Total customers: ' + custs.length,
        'Total sales (all time): ' + sales.length,
      ].join('\n');
    } catch(e) { return 'Business data unavailable.'; }
  },

  // ── GENERATE FULL BUSINESS REPORT ──────────────────────────────────────────
  generateFullReport: function() {
    if (this.busy) { Toast.show('AI is busy, please wait','warn'); return; }
    var settings = DB.getSettings();
    var bizName  = settings.bizName || 'Rock Stone';
    var today    = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

    // Show a loading card in the chat
    this._addUser('📋 Generate Full Daily Business Management Report for ' + today);
    this.history.push({role:'user', content:'Generate a complete professional Daily Business Management Report as a Chartered Accountant and Financial Analyst. Use ALL the business data provided. Include: Executive Summary, Sales Analysis, Profit Analysis (Gross & Net), Expense Analysis, Cash Flow Analysis, Debt Analysis (customer & supplier), Inventory Analysis, Business Health Score out of 100, and AI Accountant Recommendations. Use professional accounting standards. Format clearly with sections, show all calculations, highlight profits in positive terms and losses clearly. End with a Final Management Summary table.'});

    var systemPrompt = 'You are a Professional Chartered Accountant, Financial Analyst, Inventory Auditor, and Business Consultant reporting directly to the business owner.\n\nBUSINESS DATA (LIVE FROM SYSTEM):\n' + this._buildFullContext() + '\n\nGENERATE A COMPLETE DAILY BUSINESS MANAGEMENT REPORT following this structure:\n1. EXECUTIVE SUMMARY\n2. SALES ANALYSIS (revenue, transactions, avg value, payment methods, top products)\n3. PROFIT ANALYSIS (Gross Profit, Gross Margin%, Net Profit, Net Margin%)\n4. EXPENSE ANALYSIS (by category, largest expense, % of revenue)\n5. CASH FLOW ANALYSIS (cash in, cash out, available cash, outstanding debts)\n6. DEBT ANALYSIS (customer debts top 5, supplier balances, net receivable position)\n7. INVENTORY ANALYSIS (stock value, low stock, out of stock, recommendations)\n8. BUSINESS HEALTH SCORE /100 (score profitability, cash flow, inventory, debt, sales, expenses)\n9. AI ACCOUNTANT RECOMMENDATIONS (5-7 specific actionable recommendations)\n10. FINAL MANAGEMENT SUMMARY TABLE\n\nUse professional language. Show all formulas and calculations. Be specific with numbers from the data. Mark profits with ✅, losses with ❌, warnings with ⚠️.';

    this.busy = true;
    var btn = Utils.get('ai-send-btn');
    if (btn) btn.textContent = '⏳';
    this._setStatus('Generating report…', '#F59E0B');
    var tid = 'at-' + Date.now();
    this._addTyping(tid);

    var self = this;
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI.KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{role:'user', content:'Generate the complete Daily Business Management Report now. Be thorough and professional.'}],
      }),
    }).then(function(res){ return res.json(); })
    .then(function(data) {
      self._rmTyping(tid);
      self.busy = false;
      if (btn) btn.textContent = '➤';
      if (data.content && data.content[0] && data.content[0].text) {
        var report = data.content[0].text;
        self._addReport(report, bizName, today);
        self.history.push({role:'assistant', content:report});
        self._setStatus('Report ready ✓', 'var(--ok)');
        Toast.show('Full business report generated ✓','ok');
      } else {
        var errMsg = data.error ? (data.error.message + ' [type:' + (data.error.type||'?') + ']') : 'Could not generate report.';
        console.error('AI API Error:', JSON.stringify(data));
        if (errMsg.toLowerCase().includes('api-key') || errMsg.toLowerCase().includes('api key') || errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('invalid')) {
          errMsg = '🔑 API key rejected by Anthropic. Key: ' + AI.KEY.slice(0,20) + '...';
        }
        self._addBot('⚠️ ' + errMsg);
        self._setStatus('Ready', 'var(--ok)');
      }
    }).catch(function(err) {
      self._rmTyping(tid);
      self.busy = false;
      if (btn) btn.textContent = '➤';
      self._setStatus('Error', 'var(--er)');
      self._addBot('⚠️ Error: ' + err.message);
    });
  },

  // ── RENDER THE REPORT WITH RICH FORMATTING ───────────────────────────────────
  _addReport: function(text, bizName, date) {
    var msgs = Utils.get('ai-msgs'); if (!msgs) return;

    // Build the formatted report card
    var d = document.createElement('div');
    d.className = 'ai-bot';
    d.style.cssText = 'background:var(--bg2);border:1px solid rgba(201,168,76,.25);border-radius:var(--r14);padding:0;overflow:hidden;max-width:100%';

    // Report header
    var header = '<div style="background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.05));border-bottom:1px solid rgba(201,168,76,.2);padding:14px 16px;display:flex;align-items:center;justify-content:space-between">'
      + '<div>'
      + '<div style="font-size:13px;font-weight:800;color:var(--g);letter-spacing:.04em">📋 DAILY BUSINESS MANAGEMENT REPORT</div>'
      + '<div style="font-size:11px;color:var(--t2);margin-top:2px">' + bizName + ' · ' + date + '</div>'
      + '</div>'
      + '<button onclick="AI.printReport(this)" style="background:var(--gb);border:1px solid rgba(201,168,76,.3);color:var(--g);padding:6px 12px;border-radius:var(--r8);font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0">🖨 Print</button>'
      + '</div>';

    // Format the report body
    var body = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      // Section headers (lines starting with === or ##)
      .replace(/={3,}([^=]+)={3,}/g, function(m, title) {
        return '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;padding:14px 16px 6px;margin-top:4px;border-top:1px solid var(--bd)">' + title.trim() + '</div>';
      })
      .replace(/^#{1,3} (.+)$/gm, function(m, title) {
        return '<div style="font-size:11px;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:.1em;padding:14px 16px 6px;margin-top:4px;border-top:1px solid var(--bd)">' + title + '</div>';
      })
      // Bold text
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      // Profit indicator lines
      .replace(/(✅[^\n]+)/g,'<span style="color:var(--ok);font-weight:600">$1</span>')
      .replace(/(❌[^\n]+)/g,'<span style="color:var(--er);font-weight:600">$1</span>')
      .replace(/(⚠️[^\n]+)/g,'<span style="color:var(--wa);font-weight:600">$1</span>')
      // Bullet points
      .replace(/^[•\-\*] (.+)$/gm,'<div style="padding:3px 16px 3px 24px;font-size:13px;color:var(--t1)">• $1</div>')
      // Number lines (metrics)
      .replace(/^(\d+\.\s.+)$/gm,'<div style="padding:3px 16px;font-size:13px;color:var(--t1)">$1</div>')
      // Table rows (| separated)
      .replace(/^\|(.+)\|$/gm, function(m, cells) {
        var cols = cells.split('|').map(function(c){ return c.trim(); });
        var isHeader = cols.some(function(c){ return /^[-:]+$/.test(c); });
        if (isHeader) return '';
        var tdHtml = cols.map(function(c,i){
          var color = '';
          if (c.match(/^\d/) || c.match(/^\$/)) {
            if (c.match(/^-/) || c.match(/loss|❌/i)) color = 'color:var(--er)';
            else color = 'color:var(--ok)';
          }
          return '<td style="padding:6px 10px;border:1px solid var(--bd);font-size:12px;font-weight:'+(i===0?'600':'400')+';'+color+'">' + c + '</td>';
        }).join('');
        return '<tr>' + tdHtml + '</tr>';
      })
      // Wrap all table rows in a table
      .replace(/(<tr>[\s\S]*?<\/tr>)+/g, function(rows) {
        return '<div style="padding:8px 16px;overflow-x:auto"><table style="width:100%;border-collapse:collapse">' + rows + '</table></div>';
      })
      // Newlines to paragraphs
      .replace(/\n\n+/g,'</p><p style="padding:4px 16px;font-size:13px;color:var(--t1)">')
      .replace(/\n/g,'<br>');

    var bodyHtml = '<div style="padding:4px 0 14px">'
      + '<p style="padding:4px 16px;font-size:13px;color:var(--t1)">' + body + '</p>'
      + '</div>';

    d.innerHTML = header + bodyHtml;
    // Store raw text for printing
    d.dataset.reportText = text;
    d.dataset.reportBiz  = bizName;
    d.dataset.reportDate = date;

    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  },

  // ── PRINT REPORT ──────────────────────────────────────────────────────────
  printReport: function(btn) {
    var card = btn ? btn.closest('.ai-bot') : null;
    var text = card ? card.dataset.reportText : '';
    var biz  = card ? card.dataset.reportBiz  : (DB.getSettings().bizName||'Rock Stone');
    var date = card ? card.dataset.reportDate  : new Date().toLocaleDateString();
    var settings = DB.getSettings();

    var logoHtml = settings.bizLogo
      ? '<div style="text-align:center;margin-bottom:8px"><img src="'+settings.bizLogo+'" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid #ddd"></div>'
      : '';

    var css = 'body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:15mm;max-width:210mm;margin:0 auto}'
      + 'h1{font-size:20px;font-weight:900;margin:0 0 2px;text-align:center}'
      + 'h2{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #333;padding-bottom:4px;margin:16px 0 6px;color:#333}'
      + 'p{font-size:12px;line-height:1.6;margin:4px 0}'
      + 'ul,ol{margin:4px 0 4px 18px;font-size:12px}'
      + 'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}'
      + 'th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}'
      + 'th{background:#f0f0f0;font-weight:700}'
      + '.ok{color:#16a34a;font-weight:700}.er{color:#dc2626;font-weight:700}.wa{color:#d97706;font-weight:700}'
      + '@media print{@page{size:A4;margin:12mm}}';

    // Format text for print
    var printBody = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/={3,}([^=]+)={3,}/g,'<h2>$1</h2>')
      .replace(/^#{1,3} (.+)$/gm,'<h2>$1</h2>')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/(✅[^\n]+)/g,'<span class="ok">$1</span>')
      .replace(/(❌[^\n]+)/g,'<span class="er">$1</span>')
      .replace(/(⚠️[^\n]+)/g,'<span class="wa">$1</span>')
      .replace(/^\|(.+)\|$/gm, function(m, cells) {
        var cols = cells.split('|').map(function(c){ return c.trim(); });
        if (cols.every(function(c){ return /^[-: ]+$/.test(c); })) return '';
        return '<tr>' + cols.map(function(c){ return '<td>'+c+'</td>'; }).join('') + '</tr>';
      })
      .replace(/(<tr>[\s\S]*?<\/tr>)+/g,'<table>$&</table>')
      .replace(/\n/g,'<br>');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Business Report</title><style>'+css+'</style></head><body>'
      + logoHtml
      + '<h1>' + biz + '</h1>'
      + '<p style="text-align:center;color:#555;font-size:11px">DAILY BUSINESS MANAGEMENT REPORT &nbsp;|&nbsp; ' + date + '</p>'
      + '<p style="text-align:center;color:#555;font-size:10px">Generated by SmartStock AI &nbsp;|&nbsp; ' + new Date().toLocaleString() + '</p>'
      + '<hr style="border:1px solid #333;margin:10px 0">'
      + printBody
      + '</body></html>';

    if (typeof Sales !== 'undefined' && Sales._printHtml) {
      Sales._printHtml(html, 'ai-report-frame');
    } else {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
      setTimeout(function(){ try{f.contentWindow.print();}catch(e){ window.open('data:text/html;charset=utf-8,'+encodeURIComponent(html),'_blank'); } }, 600);
    }
  },

  // ── REGULAR CHAT SEND ────────────────────────────────────────────────────────
  send: async function() {
    if (this.busy) return;
    var inp = Utils.get('ai-inp');
    var q   = inp ? inp.value.trim() : '';
    if (!q) return;
    inp.value = ''; inp.style.height = 'auto';
    this._addUser(q);
    this.history.push({role:'user', content:q});
    this.busy = true;
    var btn = Utils.get('ai-send-btn');
    if (btn) btn.textContent = '⏳';
    this._setStatus('Thinking…', '#F59E0B');
    var tid = 'at-' + Date.now();
    this._addTyping(tid);
    var self = this;
    try {
      var res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': AI.KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: 'You are SmartStock AI — expert business assistant and accountant.\n\nLIVE DATA:\n' + this._context() + '\n\nBe concise, practical, and use bullet points. Always give specific numbers from the data.',
          messages: this.history.slice(-10),
        }),
      });
      var data = await res.json();
      this._rmTyping(tid);
      this.busy = false;
      if (btn) btn.textContent = '➤';
      this._setStatus('Ready', 'var(--ok)');
      if (data.content && data.content[0] && data.content[0].text) {
        var ans = data.content[0].text;
        this._addBot(ans);
        this.history.push({role:'assistant', content:ans});
        if (this.history.length > 20) this.history = this.history.slice(-20);
      } else {
        var errMsg2 = data.error ? (data.error.message + ' [type:' + (data.error.type||'?') + ']') : 'No response.';
        console.error('AI Chat Error:', JSON.stringify(data));
        if (errMsg2.toLowerCase().includes('api-key') || errMsg2.toLowerCase().includes('auth') || errMsg2.toLowerCase().includes('invalid')) {
          errMsg2 = '🔑 API key rejected. Key starts with: ' + AI.KEY.slice(0,20) + '...';
        }
        this._addBot('⚠️ ' + errMsg2);
      }
    } catch(err) {
      this._rmTyping(tid);
      this.busy = false;
      if (btn) btn.textContent = '➤';
      this._setStatus('Error', 'var(--er)');
      this._addBot('⚠️ Error: ' + err.message + '\nCheck your internet connection.');
    }
  },

  ask: function(q) { var inp = Utils.get('ai-inp'); if(inp){ inp.value=q; this.send(); } },

  clear: function() {
    this.history = []; this.inited = false;
    var msgs = Utils.get('ai-msgs'); if(msgs) msgs.innerHTML = '';
    this.render();
  },

  _setStatus: function(t,c) {
    var dot = document.querySelector('.ai-status-dot');
    var txt = Utils.get('ai-status-txt');
    if (dot) dot.style.background = c;
    if (txt) txt.textContent = t;
  },

  _addUser: function(text) {
    var msgs = Utils.get('ai-msgs'); if (!msgs) return;
    var d = document.createElement('div'); d.className = 'ai-user'; d.textContent = text;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _addBot: function(text) {
    var msgs = Utils.get('ai-msgs'); if (!msgs) return;
    var d = document.createElement('div'); d.className = 'ai-bot';
    var html = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/^[•\-\*] (.+)/gm,'<span class="ai-bot-li">• $1</span>')
      .replace(/(✅[^\n]+)/g,'<span style="color:var(--ok)">$1</span>')
      .replace(/(❌[^\n]+)/g,'<span style="color:var(--er)">$1</span>')
      .replace(/(⚠️[^\n]+)/g,'<span style="color:var(--wa)">$1</span>')
      .replace(/\n/g,'<br>');
    d.innerHTML = html;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _addTyping: function(id) {
    var msgs = Utils.get('ai-msgs'); if (!msgs) return;
    var d = document.createElement('div'); d.id = id; d.className = 'ai-bot';
    d.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _rmTyping: function(id) { var e = Utils.get(id); if(e) e.remove(); },
};
