var AI = {
  history: [],
  busy: false,
  inited: false,
  KEY: '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',

  render() {
    const pg = Utils.get('pg-ai');
    if (!pg) return;
    // display handled by Router via .active class
    pg.innerHTML = `
      <div class="ai-wrap">
        <div class="ai-head">
          <div class="ai-brand">
            <div class="ai-avatar">🤖</div>
            <div style="flex:1">
              <div class="ai-title">SmartStock AI</div>
              <div class="ai-status">
                <span class="ai-status-dot"></span>
                <span id="ai-status-txt">Ready — Ask me anything</span>
              </div>
            </div>
            <button class="btn-ghost btn-sm" onclick="AI.clear()">Clear</button>
          </div>
          <div class="ai-chips">
            <div class="ai-chip" onclick="AI.ask('What products are low in stock?')">📦 Low stock?</div>
            <div class="ai-chip" onclick="AI.ask('Give me a full business summary')">📊 Summary</div>
            <div class="ai-chip" onclick="AI.ask('How much did I earn today?')">💰 Today?</div>
            <div class="ai-chip" onclick="AI.ask('Which products sell the most?')">🏆 Top sellers?</div>
            <div class="ai-chip" onclick="AI.ask('Who owes me money?')">💸 Debtors?</div>
            <div class="ai-chip" onclick="AI.ask('Am I making a profit?')">📈 Profitable?</div>
            <div class="ai-chip" onclick="AI.ask('What should I restock urgently?')">🚨 Restock?</div>
            <div class="ai-chip" onclick="AI.ask('Analyze my expenses this month')">💡 Expenses?</div>
          </div>
        </div>
        <div class="ai-msgs" id="ai-msgs"></div>
        <div class="ai-input-row">
          <textarea class="ai-input" id="ai-inp" placeholder="Ask anything about your business..."
            rows="1"
            onkeydown="if(event.keyCode===13&&!event.shiftKey){event.preventDefault();AI.send();}"
            oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"></textarea>
          <button class="ai-send" id="ai-send-btn" onclick="AI.send()">➤</button>
        </div>
      </div>`;
    // height handled by CSS
    if (!this.inited) {
      this.inited = true;
      this._addBot("👋 Hi! I'm SmartStock AI, your business assistant.\n\nI have access to your live data and can help with:\n• 📦 Inventory & stock analysis\n• 💰 Sales & revenue insights\n• 📊 Profit & expense reports\n• 💡 Smart recommendations\n\nUse the quick buttons above or type your question!");
    }
  },

  _context() {
    try {
      const s = DB.stats();
      const settings = DB.getSettings();
      const cur = settings.currency||'$';
      const prods = DB.getProducts().filter(p=>p.status!=='inactive');
      const sales = DB.getSales();
      const exps = DB.getExpenses();
      const month = Utils.today().slice(0,7);
      const custs = DB.getCustomers();
      return [
        'Business: ' + (settings.bizName||'My Store'),
        'Currency: ' + cur,
        'Products: ' + prods.length + ' active',
        'Low stock (' + s.lowStock.length + '): ' + s.lowStock.slice(0,5).map(p=>p.name+'('+p.qty+')').join(', '),
        'Out of stock (' + s.outStock.length + '): ' + s.outStock.slice(0,3).map(p=>p.name).join(', '),
        'Total revenue this month: ' + cur + s.totalRev.toFixed(2),
        'Total expenses this month: ' + cur + s.totalExp.toFixed(2),
        'Net profit: ' + cur + s.netProfit.toFixed(2),
        'Today revenue: ' + cur + s.todayRev.toFixed(2) + ' (' + s.todayCount + ' sales)',
        'Total customers: ' + custs.length,
        'Total sales (all time): ' + sales.length,
      ].join('\n');
    } catch(e) { return 'Business data unavailable.'; }
  },

  async send() {
    if (this.busy) return;
    const inp = Utils.get('ai-inp');
    const q = inp ? inp.value.trim() : '';
    if (!q) return;
    inp.value = ''; inp.style.height = 'auto';
    this._addUser(q);
    this.history.push({role:'user', content:q});
    this.busy = true;
    const btn = Utils.get('ai-send-btn');
    if (btn) btn.textContent = '⏳';
    this._setStatus('Thinking…', '#F59E0B');
    const tid = 'at-' + Date.now();
    this._addTyping(tid);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: 'You are SmartStock AI — expert business assistant.\n\nLIVE DATA:\n' + this._context() + '\n\nBe concise, practical, and use bullet points.',
          messages: this.history.slice(-10),
        }),
      });
      const data = await res.json();
      this._rmTyping(tid);
      this.busy = false;
      if (btn) btn.textContent = '➤';
      this._setStatus('Ready', 'var(--ok)');
      if (data.content && data.content[0] && data.content[0].text) {
        const ans = data.content[0].text;
        this._addBot(ans);
        this.history.push({role:'assistant', content:ans});
        if (this.history.length > 20) this.history = this.history.slice(-20);
      } else {
        this._addBot('⚠️ ' + (data.error ? data.error.message : 'No response. Please try again.'));
      }
    } catch(err) {
      this._rmTyping(tid);
      this.busy = false;
      if (btn) btn.textContent = '➤';
      this._setStatus('Error', 'var(--err)');
      this._addBot('⚠️ Error: ' + err.message + '\nCheck your internet connection.');
    }
  },

  ask(q) { const inp = Utils.get('ai-inp'); if(inp) { inp.value=q; this.send(); } },

  clear() {
    this.history = []; this.inited = false;
    const msgs = Utils.get('ai-msgs'); if (msgs) msgs.innerHTML = '';
    this.inited = false; this.render();
  },

  _setStatus(t, c) {
    const dot = Utils.q('.ai-status-dot'); const txt = Utils.get('ai-status-txt');
    if (dot) dot.style.background = c;
    if (txt) txt.textContent = t;
  },

  _addUser(text) {
    const msgs = Utils.get('ai-msgs'); if (!msgs) return;
    const d = document.createElement('div'); d.className = 'ai-user'; d.textContent = text;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _addBot(text) {
    const msgs = Utils.get('ai-msgs'); if (!msgs) return;
    const d = document.createElement('div'); d.className = 'ai-bot';
    const html = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/^[•\-\*] (.+)/gm,'<span class="ai-bot-li">• $1</span>')
      .replace(/\n/g,'<br>');
    d.innerHTML = html;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _addTyping(id) {
    const msgs = Utils.get('ai-msgs'); if (!msgs) return;
    const d = document.createElement('div'); d.id = id; d.className = 'ai-bot';
    d.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  },

  _rmTyping(id) { const e = Utils.get(id); if(e) e.remove(); },
};
