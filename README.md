# SmartStock Pro — Multi-File Version

> This is the **multi-file version** of SmartStock Pro FINAL, split for easy editing on GitHub.

## 🔗 Live Site
```
https://ramidassen-pixel.github.io/smart-stock-pro
```

## 📁 File Structure
```
smart-stock-pro/
├── index.html              ← Main entry point (loads everything)
├── css/
│   └── app.css             ← All styles (extracted from original)
├── js/
│   ├── init.js             ← App init, auth, DB, Firebase, theme
│   ├── dashboard.js        ← Dashboard rendering
│   ├── products.js         ← Inventory management
│   ├── expenses-salary.js  ← Expenses & payroll
│   ├── customers.js        ← Customer management
│   ├── reports.js          ← Financial reports
│   └── utils-extra.js      ← AI, chat, utilities, password hashing
├── pwa/
│   ├── manifest.json       ← PWA manifest
│   └── service-worker.js   ← Offline support
└── README.md
```

## ✏️ How to Edit
- **Change colors/theme** → edit `css/app.css` (search for `:root {`)
- **Change dashboard** → edit `js/dashboard.js`
- **Change products page** → edit `js/products.js`
- **Change expenses/salary** → edit `js/expenses-salary.js`
- **Change customers** → edit `js/customers.js`
- **Change reports** → edit `js/reports.js`
- **Change AI / chat / utils** → edit `js/utils-extra.js`

## 🚀 Deploy to GitHub Pages
1. Upload all files to your repository
2. Settings → Pages → Source: main branch / root
3. Your site: `https://ramidassen-pixel.github.io/smart-stock-pro`

## ⚙️ Configuration
All settings are in `js/init.js`:
- Search for `seedDB` to change default data
- Search for `fbInit` to configure Firebase
- Search for `CONFIG` for app settings
