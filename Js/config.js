/* SmartStock Pro — Config */
const CONFIG = {
  app: { name:'SmartStock Pro', version:'1.0.0', tagline:'Run Your Business Like a Pro' },
  company: { name:'Demo Store', currency:'$', tax:8, lowStockThreshold:50 },
  api: {
    supabaseUrl: 'YOUR_SUPABASE_URL',
    supabaseKey: 'YOUR_SUPABASE_ANON_KEY',
    anthropicKey:'YOUR_ANTHROPIC_API_KEY',
    aiModel:     'claude-sonnet-4-20250514',
  },
  features: { ai:true, whatsapp:true, pwa:true },
};
