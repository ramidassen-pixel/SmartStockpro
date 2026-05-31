/* SmartStock Pro — AI Service (Anthropic Claude) */
const AIService = {
  history: [],

  systemPrompt() {
    const inv = MockData.inventory;
    const lowStock = inv.filter(p=>p.status==='Low Stock').map(p=>p.name).join(', ');
    const outStock  = inv.filter(p=>p.status==='Out of Stock').map(p=>p.name).join(', ');
    return `You are SmartStock Pro's AI business analyst for a tile/building materials store.

LIVE DATA:
- Products: ${inv.length} total. Low stock: ${lowStock||'none'}. Out of stock: ${outStock||'none'}.
- Monthly revenue: ~$84,320. Net profit: ~$20,180 (24% margin).
- Expenses: $18,940/month. Payroll: $14,000.
- Customers: ${MockData.customers.length}. VIP: ${MockData.customers.filter(c=>c.status==='VIP').map(c=>c.name).join(', ')}.
- Overdue invoices: ${MockData.sales.filter(s=>s.status==='Overdue').length}.

Respond concisely with bullet points. Be professional, data-driven, and actionable.`;
  },

  async chat(userMessage) {
    this.history.push({ role:'user', content:userMessage });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.api.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CONFIG.api.aiModel,
        max_tokens: 1000,
        system: this.systemPrompt(),
        messages: this.history,
      }),
    });
    const data = await res.json();
    const reply = data.content?.[0]?.text || 'Unable to process request.';
    this.history.push({ role:'assistant', content:reply });
    return reply;
  },

  reset() { this.history = []; },
};
