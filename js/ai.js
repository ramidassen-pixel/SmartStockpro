/* SmartStock Pro — AI Assistant Page */
const AIPage = {
  messages: [
    {role:'ai', text:"Hello! I'm your SmartStock Pro AI analyst. Ask me about inventory levels, sales trends, customer insights, profit forecasts, or any business question. What would you like to explore today?"}
  ],
  loading: false,

  render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">AI Business Assistant</h1>
          <p class="page-subtitle">Powered by Claude · Real-time intelligence</p></div>
        <span class="badge badge-gold"><span style="width:6px;height:6px;background:var(--color-gold);border-radius:50%;display:inline-block;animation:pulse 2s infinite"></span> Live</span>
      </div>
      <div class="grid g-2-1" style="align-items:start;gap:16px">
        <!-- Chat Panel -->
        <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;display:flex;flex-direction:column;height:480px;overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:10px">
            <div style="width:8px;height:8px;background:var(--color-gold);border-radius:50%;animation:pulse 2s infinite"></div>
            <span class="font-display" style="font-size:13px;font-weight:600">SmartStock Intelligence</span>
            <span class="text-sec text-xs" style="margin-left:auto">claude-sonnet</span>
          </div>
          <div id="ai-messages" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px"></div>
          <div style="padding:12px 14px;border-top:1px solid var(--color-border);display:flex;gap:8px;align-items:flex-end">
            <textarea id="ai-input"
              style="flex:1;background:var(--color-bg);border:1px solid var(--color-border);border-radius:8px;padding:9px 12px;color:var(--color-text);font-size:13px;font-family:var(--font-body);outline:none;resize:none;min-height:38px;max-height:100px;transition:border-color 0.15s"
              placeholder="Ask about inventory, sales, forecasts..."
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();AIPage.send();}"
              onfocus="this.style.borderColor='var(--color-gold)'"
              onblur="this.style.borderColor='var(--color-border)'"
              rows="1"></textarea>
            <button class="btn btn-primary" id="ai-send-btn" onclick="AIPage.send()" style="padding:9px 14px;flex-shrink:0">
              ${Components.icon('send',14)}
            </button>
          </div>
        </div>

        <!-- Sidebar -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card animate-in">
            <div class="font-display mb-3" style="font-size:12px;font-weight:600">Quick Questions</div>
            ${[
              'Analyze my low stock situation',
              'Which customers have overdue invoices?',
              'How can I improve profit margin?',
              'Top revenue-generating products?',
              'Expense reduction recommendations',
            ].map(q=>`<button onclick="AIPage.quickAsk('${q.replace(/'/g,"\\\'")}')"
              style="display:block;width:100%;text-align:left;padding:8px 10px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:7px;color:var(--color-text-sec);font-size:12px;cursor:pointer;margin-bottom:6px;transition:all 0.15s;font-family:var(--font-body)"
              onmouseover="this.style.borderColor='var(--color-gold)';this.style.color='var(--color-text)'"
              onmouseout="this.style.borderColor='var(--color-border)';this.style.color='var(--color-text-sec)'">
              💡 ${q}</button>`).join('')}
          </div>
          <div class="card animate-in">
            <div class="font-display mb-3" style="font-size:12px;font-weight:600">Business Snapshot</div>
            ${[
              {label:'Revenue',     val:'$84,320', color:'var(--color-gold)'   },
              {label:'Expenses',    val:'$18,940', color:'var(--color-error)'  },
              {label:'Net Profit',  val:'$20,180', color:'var(--color-success)'},
              {label:'Stock Alerts',val:'3 items', color:'var(--color-warning)'},
              {label:'Overdue',     val:'$14,820', color:'var(--color-error)'  },
            ].map(s=>`<div class="flex items-center justify-between" style="padding:6px 0;border-bottom:1px solid var(--color-border);font-size:12px">
              <span class="text-sec">${s.label}</span>
              <span style="font-weight:600;color:${s.color}">${s.val}</span></div>`).join('')}
            <button class="btn btn-ghost btn-sm w-full mt-3" onclick="AIService.reset();Toast.show('Chat cleared','info')">Clear History</button>
          </div>
        </div>
      </div>`;

    this.renderMessages();
  },

  renderMessages() {
    const container = document.getElementById('ai-messages');
    if (!container) return;
    container.innerHTML = this.messages.map(m=>`
      <div style="max-width:88%;padding:10px 13px;border-radius:10px;font-size:13px;line-height:1.6;animation:fadeIn 0.3s ease;
        ${m.role==='user'
          ? 'background:var(--color-gold-glow);border:1px solid rgba(232,160,32,0.3);align-self:flex-end;color:var(--color-gold);margin-left:auto'
          : 'background:rgba(0,0,0,0.3);border:1px solid var(--color-border);align-self:flex-start;color:var(--color-text)'}">
        ${m.loading
          ? `<div style="display:flex;gap:4px;align-items:center;padding:2px 0">
               <span style="width:6px;height:6px;background:var(--color-text-sec);border-radius:50%;animation:pulse 1.4s ease infinite;display:inline-block"></span>
               <span style="width:6px;height:6px;background:var(--color-text-sec);border-radius:50%;animation:pulse 1.4s ease 0.2s infinite;display:inline-block"></span>
               <span style="width:6px;height:6px;background:var(--color-text-sec);border-radius:50%;animation:pulse 1.4s ease 0.4s infinite;display:inline-block"></span>
             </div>`
          : m.text.replace(/\n/g,'<br>')}
      </div>`).join('');
    container.scrollTop = container.scrollHeight;
  },

  quickAsk(q) {
    const input = document.getElementById('ai-input');
    if (input) { input.value = q; this.send(); }
  },

  async send() {
    const input = document.getElementById('ai-input');
    const text = input?.value.trim();
    if (!text || this.loading) return;
    input.value = '';
    this.messages.push({role:'user', text});
    this.messages.push({role:'ai', text:'', loading:true});
    this.loading = true;
    this.renderMessages();

    try {
      const reply = await AIService.chat(text);
      this.messages.pop();
      this.messages.push({role:'ai', text:reply});
    } catch(e) {
      this.messages.pop();
      this.messages.push({role:'ai', text:'⚠️ Connection error. Please add your API key to js/config.js and try again.'});
    }
    this.loading = false;
    this.renderMessages();
  },
};
