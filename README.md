# SmartStock Pro V5

<div align="center">
  <img src="pwa/icon-512.png" alt="SmartStock Pro" width="120" height="120" style="border-radius:24px">
  
  **Professional Business Management System**
  
  Built for Rock Stone — Monrovia, Liberia 🇱🇷
  
  [![Live App](https://img.shields.io/badge/Live%20App-GitHub%20Pages-brightgreen)](https://ramidassen-pixel.github.io/SmartStockpro/)
  [![PWA](https://img.shields.io/badge/PWA-Installable-blue)](https://ramidassen-pixel.github.io/SmartStockpro/)
  [![Backend](https://img.shields.io/badge/Backend-Supabase-3ecf8e)](https://supabase.com)
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
- **Receipt scan:** photograph a handwritten paper receipt (or scan it from the computer with the phone's camera via a QR code) and the New Sale form fills itself. Staff check every line before saving.

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
- Day and month closing

### 🤖 AI Business Assistant
- Ask questions about your business in plain English or French
- Answers come from your real figures: the AI looks them up through read-only database tools, it doesn't guess
- Daily business report with Executive Summary, Health Score /100 and recommendations
- Can *propose* a WhatsApp message or a draft purchase order — nothing happens until you confirm
- Runs on a free AI provider (Google Gemini or Groq) or on Claude (Anthropic), set on the server

### 👔 Team & Businesses
- Email sign-up; the person who creates a business becomes its owner
- Staff join an existing business and wait for the owner's approval
- Roles and permissions for each team member
- One account can belong to more than one business

### 💳 Plans & Billing
- Free trial, then **Shop** ($9/month, 1 shop, up to 3 staff) or **Business** ($19/month, up to 10 staff, suppliers, purchase orders, salary)
- Pay by Mobile Money, then submit the transaction ID in the app; the platform owner approves it

### ⚙️ More Modules
- Expense tracking & allocations
- Salary & payroll management
- Supplier management
- Support center
- Settings with logo & profile upload
- Dark/Light theme toggle
- Data export & backup

---

## 🗂️ Project Structure

```
SmartStockpro/
│
├── index.html                    ← The app (loads the CSS, assets/js and modules)
├── landing.html                  ← Public landing page
├── confirm.html                  ← Email confirmation page
├── forgot.html                   ← "Send me a reset link" page
├── reset.html                    ← Set a new password (from the email link)
├── sw.js                         ← Service worker (root scope, offline cache)
├── README.md
│
├── assets/
│   ├── css/                      ← variables, reset, layout, components, pages, responsive, desktop
│   └── js/
│       ├── utils.js              ← Utilities & helpers
│       ├── icons.js              ← Icon set
│       ├── qr.js                 ← QR codes (phone-camera receipt scan)
│       ├── database.js           ← Cloud-sync engine (Supabase + offline cache & upload queue)
│       ├── auth.js               ← Supabase Auth: sign-in, sign-up, join, confirmation
│       ├── quickcreate.js        ← Inline supplier/product creation
│       ├── router.js             ← Page routing
│       ├── notifications.js      ← Stock & alert system
│       ├── charts.js             ← Chart helpers
│       ├── app.js                ← App boot & shell management
│       ├── rbac.js               ← Role-based access control
│       ├── platform.js           ← Multi-business layer
│       ├── globalsearch.js       ← Global search
│       ├── privacy.js            ← Privacy notice
│       ├── sidebar.js            ← Desktop sidebar
│       ├── install.js            ← "Install app" prompt
│       └── boot.js               ← Splash, error guard, SW registration
│
├── modules/
│   ├── dashboard/                ← KPIs, breakdown card, toggles
│   ├── products/                 ← Product CRUD, stock movements
│   ├── sales/                    ← POS, invoicing, receipts, receipt scan
│   ├── customers/                ← Customer profiles
│   ├── suppliers/                ← Suppliers; PO, GRN, bills, reorder
│   ├── expenses/                 ← Expenses, recurring cost allocations
│   ├── salary/                   ← Payroll
│   ├── finance/                  ← P&L, cash flow
│   ├── reports/                  ← Financial & daily reports
│   ├── quotations/               ← Quotations
│   ├── billing/                  ← Plans & Mobile Money payments
│   ├── ai/                       ← AI assistant & reports
│   ├── closing/                  ← Day/month closing
│   ├── support/                  ← Support center
│   ├── usermgmt/                 ← User management
│   └── settings/                 ← Settings, More menu, backup/export
│
├── supabase/
│   ├── functions/                ← Edge Functions (Deno)
│   │   ├── ai-agent-v2/          ← AI assistant (the one the app uses)
│   │   ├── ai-agent/, ai-proxy/  ← Older AI endpoints
│   │   ├── scan-receipt/         ← Reads receipt photos with AI
│   │   ├── send-email/           ← App emails through the Brevo API
│   │   └── admin-data/           ← Platform-owner admin & support data
│   └── migrations/               ← Database changes (security, sales/stock, AI views, plans, backups)
│
├── ai-eval/                      ← 45-question test suite for the AI assistant (see ai-eval/README.md)
├── marketing/                    ← Landing page copy & outreach messages
│
└── pwa/
    ├── manifest.json             ← PWA manifest
    ├── service-worker.js
    ├── icon-192.png
    └── icon-512.png
```

---

## 🚀 Getting Started

### First Time
1. Open the live app URL
2. Tap **Create Account**
3. Enter your **Business Name**, your name, **email** and a password
4. Confirm your email from the link we send (check Spam too)
5. Sign in and start adding products and recording sales

### Join a Business as Staff
1. Tap **Create Account** and choose to join an existing business
2. Search for the business and send your request
3. The owner approves you, then you can sign in

### Install as App (Android)
1. Open in Chrome
2. Tap ⋮ menu → **Add to Home Screen**
3. SmartStock Pro installs as a native-like app

### Forgot Password
1. On the login screen, tap **Forgot password?**
2. Enter your registered **email**
3. Open the link in the email and set a new password

Passwords found in known data breaches are refused at sign-up, join, reset and change password.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript, no framework or build step |
| Styling | Custom CSS with CSS Variables |
| Database & Auth | Supabase (PostgreSQL, row-level security, Auth) |
| Server code | Supabase Edge Functions (Deno) |
| Offline | localStorage cache + upload queue, service worker |
| AI | Google Gemini / Groq (free) or Anthropic Claude, chosen by server secrets |
| Email | Brevo API |
| Hosting | GitHub Pages |
| PWA | Service Worker + Web App Manifest |

---

## 📋 Data & Privacy

- Business data is stored in a **Supabase cloud database**, which is the source of truth. Every business only sees its own records: row-level security enforces this in the database itself.
- A copy is cached on the device (localStorage) so the app keeps working offline. Changes made offline are queued and uploaded when the connection returns. The top bar shows the sync status.
- The database is backed up every night at 02:00 (Liberia time). Backups are kept for 30 days in a private schema that the app and the internet cannot read.
- AI questions and receipt photos are sent to the AI provider configured on the server (Google, Groq or Anthropic) to get an answer. AI keys live only in Supabase secrets, never in the app.
- App emails (confirmation, password reset) are sent through Brevo.
- Export a backup anytime: Settings → Export Data. Import: Settings → Import Backup.

---

## 🔧 Development

### Run locally
Serve the folder over HTTP (opening `index.html` directly won't work):

```
python -m http.server 8766 --bind 127.0.0.1
```

Then open http://127.0.0.1:8766. The local copy talks to the live Supabase project.

### Supabase
- Database changes go in `supabase/migrations/` (one dated `.sql` file each).
- Edge Functions are deployed with JWT verification **on**. AI and email keys are Supabase secrets: `AI_API_KEY` (or `GEMINI_API_KEY` / `GROQ_API_KEY`), `ANTHROPIC_API_KEY`, optional `AI_PROVIDER`, `AI_MODEL`, `SCAN_MODEL`, `BUSINESS_TZ`.

### Test the AI assistant
See `ai-eval/README.md`: make the day's answer key from the database, then run `ai-eval/run.mjs` to grade the agent on 45 questions.

---

Built by **Ramie** for Rock Stone, Monrovia, Liberia.  
Developed using Claude AI (Anthropic) as the development assistant.

**Business:** Rock Stone — Tile & Building Materials  
**Location:** Monrovia, Liberia 🇱🇷

---

<div align="center">
  <sub>SmartStock Pro V5 — © 2026 Rock Stone, Monrovia, Liberia</sub>
</div>
