# SmartStock Pro V5

> Complete rebuild — clean architecture, no legacy code

## Live Site
```
https://ramidassen-pixel.github.io/smart-stock-pro
```

## Structure
```
smartstock-pro/
├── index.html              ← Entry point
├── assets/
│   ├── css/                ← 6 CSS files (variables, reset, layout, components, pages, responsive)
│   └── js/                 ← 7 core JS files (utils, database, auth, router, notifs, charts, app)
├── modules/
│   ├── dashboard/          ← Dashboard with KPIs, charts, alerts
│   ├── products/           ← Full product CRUD
│   ├── sales/              ← POS + invoicing
│   ├── customers/          ← Customer management
│   ├── suppliers/          ← Supplier management
│   ├── expenses/           ← Expense tracking
│   ├── salary/             ← Payroll system
│   ├── finance/            ← P&L, Cash Flow, charts
│   ├── reports/            ← Reports + CSV export
│   ├── ai/                 ← AI Business Assistant (Claude)
│   └── settings/           ← App settings + More page
├── pwa/                    ← PWA manifest + service worker
└── database/schema.sql     ← Supabase PostgreSQL schema
```

## First Time Setup
1. Open the app → tap Create Account
2. Enter your business name and credentials
3. Start adding products, recording sales!

## AI Assistant
- Go to More → AI Assistant (or sidebar)
- Your Anthropic API key is pre-configured
- Ask anything about your business

## Deploy to GitHub Pages
1. Upload all files to your GitHub repo
2. Settings → Pages → Source: main / root
3. Access at: `https://USERNAME.github.io/REPO-NAME`
