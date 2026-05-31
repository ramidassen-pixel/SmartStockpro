# SmartStock Pro

> **Run Your Business Like a Pro**

Enterprise business management platform for tile stores, hardware shops, wholesale & retail.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/smartstock-pro.git
cd smartstock-pro

# 2. Open locally (no build step needed!)
open index.html
# or: npx serve .
```

## Project Structure

```
smartstock-pro/
├── index.html              ← Entry point
├── css/
│   ├── variables.css       ← Design tokens & CSS variables
│   ├── layout.css          ← Sidebar, topbar, main area
│   ├── components.css      ← Cards, buttons, badges, modals
│   ├── forms.css           ← Form elements
│   ├── tables.css          ← Table styles
│   ├── dashboard.css       ← Dashboard-specific styles
│   └── responsive.css      ← Mobile breakpoints
├── js/
│   ├── config.js           ← ⚙️  App configuration (edit this!)
│   ├── utils.js            ← Shared helpers
│   ├── mock-data.js        ← Sample data (replace with DB calls)
│   ├── components.js       ← HTML component builders
│   ├── toast.js            ← Toast notifications
│   ├── router.js           ← Client-side routing
│   ├── app.js              ← App shell & navigation
│   ├── auth.js             ← Authentication (stub)
│   ├── dashboard.js        ← Dashboard page
│   ├── inventory.js        ← Inventory management
│   ├── sales.js            ← Sales & invoices
│   ├── customers.js        ← Customer management
│   ├── suppliers.js        ← Supplier management
│   ├── expenses.js         ← Expense tracking
│   ├── payroll.js          ← Payroll system
│   ├── reports.js          ← Financial reports
│   ├── analytics.js        ← Analytics & charts
│   ├── ai.js               ← AI assistant page
│   ├── settings.js         ← Settings page
│   └── notifications.js    ← Notifications
├── services/
│   ├── database.js         ← DB service (wraps MockData → swap for Supabase)
│   ├── auth-service.js     ← Auth service
│   ├── notification-service.js
│   └── ai-service.js       ← Anthropic API integration
├── pwa/
│   ├── manifest.json       ← PWA manifest
│   └── service-worker.js   ← Offline support
└── database/
    └── schema.sql          ← PostgreSQL schema for Supabase
```

## Configuration

Edit `js/config.js`:

```js
const CONFIG = {
  api: {
    supabaseUrl:  'https://xxxx.supabase.co',
    supabaseKey:  'your-anon-key',
    anthropicKey: 'sk-ant-...',  // use a backend proxy in production!
  },
  company: {
    name:     'Your Store Name',
    currency: '$',
    tax:      8,
  },
};
```

## Deploy to GitHub Pages

1. Push to GitHub
2. Go to **Settings → Pages → Source: main branch / root**
3. Done — live at `https://USERNAME.github.io/smartstack-pro`

## Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy .
```

Or connect the GitHub repo in the Cloudflare Pages dashboard.

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `database/schema.sql` in the SQL editor
3. Add your URL + anon key to `js/config.js`
4. In `services/database.js`, replace `MockData.*` calls with:
   ```js
   const { data, error } = await supabase.from('products').select('*');
   ```

## Features

| Module | Status |
|---|---|
| Dashboard with KPIs & charts | ✅ |
| Inventory (CRUD, search, filters) | ✅ |
| Sales & Invoices | ✅ |
| Customer Management | ✅ |
| Supplier Management | ✅ |
| Expense Tracking | ✅ |
| Payroll System | ✅ |
| Financial Reports (P&L, Cash Flow) | ✅ |
| Analytics & Charts | ✅ |
| AI Assistant (Claude API) | ✅ |
| Settings & User Management | ✅ |
| PWA (installable, offline) | ✅ |
| Responsive / Mobile | ✅ |

## Tech Stack

- **Frontend**: Vanilla HTML5 + CSS3 + ES6 JavaScript (zero dependencies, zero build step)
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API
- **Hosting**: GitHub Pages / Cloudflare Pages

---
MIT License · Built with SmartStock Pro
