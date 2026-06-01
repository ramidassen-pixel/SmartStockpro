const AIPage = {
  msgs: [{role:'ai',text:"Hello! I'm your SmartStock Pro AI analyst. I can analyze your inventory, sales, expenses, and give you actionable business recommendations. What would you like to explore?"}],
  loading: false,

  render() {
    const quick = ['Analyze my low stock','Which invoices are overdue?','How to improve profit margin?','Top selling products?','Reduce my expenses'];
    const html = `
<div style="display:flex;flex-direction:column;height:calc(100vh - var(--topH) - var(--botH) - var(--safe-b));overflow:hidden">
  <!-- Header -->
  <div style="padding:14px;border-bottom:1px solid var(--bd);background:var(--s1);flex-shrink:0">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,var(--g),var(--g3));display:flex;align-items:center;justify-content:center;font-size:18px">🤖</div>
      <div>
        <div style="font-size:14px;font-weight:800;color:var(--t1)">AI Business Assistant</div>
        <div style="font-size:10px;color:var(--ok);font-family:var(--fm);display:flex;align-items:center;gap:5px">
          <span style="width:6px;height:6px;background:var(--ok);border-radius:50%;display:inline-block;animation:pulse 2s infinite"></span>
          Powered by Claude · Live
        </div>
      </div>
      <button class="act-btn" style="margin-left:auto" onclick="AIService.reset();AIPage.msgs=[{role:'ai',text:'Chat cleared. How can I help?'}];AIPage.render()">Clear</button>
    </div>
    <!-- Quick prompts -->
    <div style="display:flex;gap:6px;overflow-x:auto;margin-top:10px;padding-bottom:2px;scrollbar-width:none">
      ${quick.map(q=>`<button onclick="AIPage.ask('${q.replace(/'/g,"\\\'")}')" style="flex-shrink:0;padding:6px 12px;border-radius:99px;background:var(--s2);border:1px solid var(--bd);color:var(--t2);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s" onmouseover="this.style.borderColor='var(--g)';this.style.color='var(--g)'" onmouseout="this.style.borderColor='var(--bd)';this.style.color='var(--t2)'">${q}</button>`).join('')}
    </div>
  </div>
  <!-- Messages -->
  <div id="ai-msgs" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--bg)"></div>
  <!-- Input -->
  <div style="padding:10px 12px;padding-bottom:calc(10px + var(--safe-b));background:var(--s1);border-top:1px solid var(--bd);display:flex;gap:8px;align-items:flex-end;flex-shrink:0">
    <textarea id="ai-input" rows="1" placeholder="Ask about your business..."
      style="flex:1;background:var(--s2);border:1.5px solid var(--bd);border-radius:99px;padding:10px 16px;font-size:14px;color:var(--t1);outline:none;resize:none;min-height:42px;max-height:90px;transition:border-color .18s;font-family:var(--ff)"
      onfocus="this.style.borderColor='var(--g)'" onblur="this.style.borderColor='var(--bd)'"
      onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();AIPage.send();}"></textarea>
    <button id="ai-send" onclick="AIPage.send()" style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--g),var(--g3));border:none;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:var(--gsh);transition:transform .18s" onmousedown="this.style.transform='scale(.9)'" onmouseup="this.style.transform='scale(1)'">➤</button>
  </div>
</div>`;
    Utils.set('pg-ai', html);
    this.renderMsgs();
  },

  renderMsgs() {
    const el = document.getElementById('ai-msgs');
    if (!el) return;
    el.innerHTML = this.msgs.map(m=>`
    <div style="max-width:84%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.55;word-wrap:break-word;
      ${m.role==='user'
        ? 'align-self:flex-end;background:linear-gradient(135deg,var(--g),var(--g3));color:#060810;font-weight:600;border-bottom-right-radius:4px;margin-left:auto'
        : 'align-self:flex-start;background:var(--s1);border:1px solid var(--bd);color:var(--t1);border-bottom-left-radius:4px'}">
      ${m.loading
        ? '<span style="display:flex;gap:4px;align-items:center;padding:2px 0"><span style="width:7px;height:7px;background:var(--t3);border-radius:50%;animation:pulse 1.4s ease infinite;display:inline-block"></span><span style="width:7px;height:7px;background:var(--t3);border-radius:50%;animation:pulse 1.4s ease .2s infinite;display:inline-block"></span><span style="width:7px;height:7px;background:var(--t3);border-radius:50%;animation:pulse 1.4s ease .4s infinite;display:inline-block"></span></span>'
        : m.text.replace(/\n/g,'<br>')}
    </div>`).join('');
    el.scrollTop = el.scrollHeight;
  },

  ask(q) { const inp=document.getElementById('ai-input');if(inp){inp.value=q;this.send();} },

  async send() {
    const inp = document.getElementById('ai-input');
    const text = inp?.value.trim();
    if (!text || this.loading) return;
    inp.value = '';
    this.msgs.push({role:'user',text});
    this.msgs.push({role:'ai',text:'',loading:true});
    this.loading = true;
    this.renderMsgs();
    try {
      const reply = await AIService.chat(text);
      this.msgs.pop();
      this.msgs.push({role:'ai',text:reply});
    } catch(e) {
      this.msgs.pop();
      this.msgs.push({role:'ai',text:'⚠️ Connection error. Add your API key in js/config.js to enable AI.'});
    }
    this.loading = false;
    this.renderMsgs();
  },
};