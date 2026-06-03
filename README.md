# SmartStock Pro v2

> **Run Your Business Like a Pro** — Mobile-first PWA

## Live Site
```
https://ramidassen-pixel.github.io/smart-stock-pro
```

## Structure
```
smartstock-pro/
├── index.html              ← Single entry point
├── css/
│   ├── variables.css       ← All design tokens & CSS variables
│   ├── layout.css          ← App shell, topbar, bottom nav, sidebar
│   ├── components.css      ← Cards, buttons, badges, lists
│   ├── forms.css           ← Drawers, form inputs
│   └── responsive.css      ← Mobile breakpoints
├── js/
│   ├── config.js           ← ⚙️ Edit this — API keys & company info
│   ├── utils.js            ← Shared helpers
│   ├── data.js             ← Mock data (replace with DB calls)
│   ├── toast.js            ← Toast notifications
│   ├── app.js              ← App shell, navigation, sidebar
│   └── pages/
│       ├── home.js         ← Dashboard
│       ├── inventory.js    ← Products & stock
│       ├── sales.js        ← Invoices & POS
│       ├── customers.js    ← Customer management
│       ├── reports.js      ← P&L, cash flow, expenses
│       ├── ai.js           ← AI assistant (Claude)
│       └── more.js         ← More features & settings
├── services/
│   ├── db.js               ← Database service (swap MockData for Supabase)
│   └── ai-service.js       ← Anthropic Claude API
├── pwa/
│   ├── manifest.json       ← PWA manifest (installable)
│   └── service-worker.js   ← Offline support
└── database/schema.sql     ← PostgreSQL schema for Supabase
```

## Setup
1. Edit `js/config.js` — add your company name, currency, API keys
2. Go to **More → Settings** to enter your Anthropic API key
3. That's it — the app works with mock data out of the box

## Deploy
Push to GitHub, enable GitHub Pages from main branch root.
Your live URL: `https://YOUR_USERNAME.github.io/REPO_NAME`

## Connect Supabase
1. Create project at supabase.com
2. Run `database/schema.sql`
3. In `services/db.js` replace `MockData.*` with Supabase queries
