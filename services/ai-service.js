const AIService = {
  history: [],
  systemPrompt() {
    const prods = MockData.products;
    return `You are SmartStock Pro AI analyst for a tile/building materials store.
LIVE DATA: ${prods.length} products. Low stock: ${prods.filter(p=>p.status==='Low Stock').map(p=>p.name).join(', ')||'none'}.
Out of stock: ${prods.filter(p=>p.status==='Out of Stock').map(p=>p.name).join(', ')||'none'}.
Revenue: ~$84,320/month. Net profit: ~$20,180 (24%). Customers: ${MockData.customers.length}.
Be concise, use bullet points, professional and data-driven.`;
  },
  async chat(msg) {
    this.history.push({role:'user',content:msg});
    const res = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':CONFIG.api.anthropicKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:CONFIG.api.aiModel,max_tokens:1000,system:this.systemPrompt(),messages:this.history})
    });
    const data = await res.json();
    const reply = data.content?.[0]?.text || 'Unable to process. Check your API key in js/config.js.';
    this.history.push({role:'assistant',content:reply});
    return reply;
  },
  reset(){ this.history=[]; }
};