# SmartStock Pro V5

<div align="center">
  <img src="pwa/icon-512.png" alt="SmartStock Pro" width="120" height="120" style="border-radius:24px">
  
  **Professional Business Management System**
  
  Built for Rock Stone — Monrovia, Liberia 🇱🇷
  
  [![Live App](https://img.shields.io/badge/Live%20App-GitHub%20Pages-brightgreen)](https://ramidassen-pixel.github.io/SmartStockpro/)
  [![PWA](https://img.shields.io/badge/PWA-Installable-blue)](https://ramidassen-pixel.github.io/SmartStockpro/)
  [![AI Powered](https://img.shields.io/badge/AI-Claude%20Sonnet-gold)](https://anthropic.com)
</div>

---

## 🌐 Live App

```
https://ramidassen-pixel.github.io/SmartStockpro/
```

> ⚠️ Always open from the live URL above — do not open index.html from a local downloads folder.

---

## 📱 Features

### 💰 Sales & Invoicing
- Point-of-sale with customer auto-fill
- Partial payments & credit tracking
- Professional invoice printing (A4)
- Payment receipt generation
- Outstanding balance management

### 📦 Inventory Management
- Full product CRUD with categories
- Low stock alerts & reorder notifications
- Cost price & selling price tracking
- Stock value calculations
- Barcode/SKU support

### 👥 Customer Management
- Customer profiles with purchase history
- Invoice & payment history
- Debt tracking & collections
- Search by name, phone, invoice number

### 🏭 Supply Management
- Purchase Orders (PO-YYYY-XXXX)
- Goods Received Notes (GRN)
- Supplier invoice & bill tracking
- Reorder alerts with Auto-PO generation
- Weighted average cost calculation

### 📄 Quotations
- Professional quotations (QT-YYYY-XXXX)
- Per-item discount & tax support
- Convert quotation → invoice in one tap
- Client auto-sync to customer database
- Professional A4 print layout

### 📊 Financial Reports
- Profit & Loss statement
- Cash Available calculation
- COGS breakdown by product
- Expense analysis by category
- 6-month revenue trend chart
- Daily & monthly reports

### 🤖 AI Business Assistant
- Powered by Claude Sonnet (Anthropic)
- Full Daily Business Management Report
- Real-time analysis of your live data
- Executive Summary, Health Score /100
- Actionable recommendations

### ⚙️ More Modules
- Expense tracking & allocations
- Salary & payroll management
- Supplier management
- Settings with logo & profile upload
- Dark/Light theme toggle
- Data export & backup

---

## 🗂️ Project Structure

```
SmartStockpro/
│
├── index.html                    ← Entry point (links external CSS + JS)
├── admin.html                    ← Platform admin portal
├── sw.js                         ← Service worker (root scope, offline cache)
├── README.md
│
├── assets/
│   ├── css/
│   │   ├── variables.css         ← Design tokens, colors, animations
│   │   ├── reset.css             ← CSS reset & base styles
│   │   ├── layout.css            ← Shell, topbar, nav, modals
│   │   ├── components.css        ← Forms, buttons, cards, lists
│   │   ├── pages.css             ← Module-specific styles
│   │   └── responsive.css        ← Tablet/desktop + print
│   │
│   └── js/
│       ├── utils.js              ← Utilities & helpers
│       ├── database.js           ← Cloud-sync database engine (Supabase + localStorage)
│       ├── auth.js               ← Supabase Auth: login, signup, password reset
│       ├── quickcreate.js        ← Inline supplier/product creation
│       ├── router.js             ← Page routing
│       ├── notifications.js      ← Stock & alert system
│       ├── charts.js             ← Chart helpers
│       ├── app.js                ← App boot & shell management
│       ├── rbac.js               ← Role-based access control
│       ├── platform.js           ← Platform/multi-business layer
│       ├── globalsearch.js       ← Global search
│       └── boot.js               ← Splash, error guard, SW registration
│
├── modules/
│   ├── dashboard/dashboard.js    ← KPIs, breakdown card, toggles
│   ├── products/products.js      ← Product CRUD
│   ├── products/stock.js         ← Stock movements
│   ├── sales/sales.js            ← POS, invoicing, receipts
│   ├── customers/customers.js    ← Customer profiles
│   ├── suppliers/
│   │   ├── suppliers.js          ← Supplier management
│   │   └── supply.js             ← PO, GRN, bills, reorder
│   ├── expenses/
│   │   ├── expenses.js           ← Expense tracking
│   │   └── allocations.js        ← Recurring cost allocations
│   ├── salary/salary.js          ← Payroll management
│   ├── finance/finance.js        ← P&L, cash flow
│   ├── reports/reports.js        ← Financial & daily reports
│   ├── quotations/quotations.js  ← Quotation system
│   ├── ai/ai.js                  ← AI assistant & reports
│   ├── closing/closing.js        ← Day/month closing
│   ├── support/support.js        ← Support module
│   ├── users/usermgmt.js         ← User management
│   └── settings/
│       ├── settings.js           ← App configuration
│       ├── more.js               ← More menu
│       └── backup.js             ← Data export & backup
│
└── pwa/
    ├── manifest.json             ← PWA manifest
    ├── icon-192.png              ← App icon (192×192)  ⚠️ add your icons
    └── icon-512.png              ← App icon (512×512)  ⚠️ add your icons
```

---

## 🚀 Getting Started

### First Time
1. Open the live app URL
2. Tap **Create Account**
3. Enter your **Business Name**, full name, username and password
4. Start adding products and recording sales

### Install as App (Android)
1. Open in Chrome
2. Tap ⋮ menu → **Add to Home Screen**
3. SmartStock Pro installs as a native-like app

### Forgot Password
1. On the login screen, tap **Forgot password?**
2. Enter your username
3. Set a new password

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES5+) |
| Styling | Custom CSS with CSS Variables |
| Storage | localStorage (client-side) |
| AI | Anthropic Claude Sonnet API |
| Hosting | GitHub Pages |
| PWA | Service Worker + Web App Manifest |

---

## 📋 Data & Privacy

- All business data is stored **locally on your device** in localStorage
- No data is sent to any server (except AI queries to Anthropic)
- Export a backup anytime: Settings → Export Data
- Import backup: Settings → Import Backup

---

## 🔧 Development

Built by **Ramie** for Rock Stone, Monrovia, Liberia.  
Developed using Claude AI (Anthropic) as the development assistant.

**Business:** Rock Stone — Tile & Building Materials  
**Location:** Monrovia, Liberia 🇱🇷

---

<div align="center">
  <sub>SmartStock Pro V5 — © 2026 Rock Stone, Monrovia, Liberia</sub>
</div>
