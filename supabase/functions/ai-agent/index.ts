// SmartStock Pro — AI agent (Supabase Edge Function, Deno) — the ORIGINAL assistant.
//
// When the ANTHROPIC_API_KEY secret is set, every request is handed to ai-agent-v2 (Claude), so
// older app versions that still call this function get the new assistant. Otherwise it
// answers questions about the business by letting a free / low-cost AI model call
// read-only "tools" that look up the real numbers. Works with any OpenAI-compatible
// chat API (Groq, Google Gemini, OpenRouter, ...), chosen with Supabase secrets:
//   AI_API_KEY   (required)  the provider's API key
//   AI_BASE_URL  (optional)  default https://api.groq.com/openai/v1
//   AI_MODEL     (optional)  default openai/gpt-oss-120b
//
// Data is read with the caller's own sign-in token, so the database's row-level
// security limits every lookup to the caller's business. Nothing is ever written.
// Deploy with JWT verification ON.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const clean = (v: string | undefined) => (v || "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const AI_KEY = clean(Deno.env.get("AI_API_KEY"));
const AI_BASE = (clean(Deno.env.get("AI_BASE_URL")) || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const AI_MODEL = clean(Deno.env.get("AI_MODEL")) || "openai/gpt-oss-120b";
const MAX_STEPS = 6;          // tool rounds per question
const MAX_TOOL_CHARS = 6000;  // keep tool results small (free tiers have low token limits)

type Row = Record<string, any>;

function userClaims(req: Request): { sub: string } | null {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const c = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return c.role === "authenticated" && typeof c.sub === "string" ? c : null;
  } catch {
    return null;
  }
}

// ── Data access (caller's token → RLS keeps it to their business) ─────────────
class Data {
  private cache = new Map<string, Promise<Row[]>>();
  private auth: string;
  constructor(auth: string) { this.auth = auth; }

  table(name: string): Promise<Row[]> {
    if (!this.cache.has(name)) this.cache.set(name, this.fetchAll(name));
    return this.cache.get(name)!;
  }

  private async fetchAll(name: string): Promise<Row[]> {
    const out: Row[] = [];
    const filter = name === "biz_settings" ? "" : "&deleted=eq.false";
    for (let from = 0; from < 50000; from += 1000) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=data${filter}`, {
        headers: { apikey: SUPABASE_ANON, Authorization: this.auth, Range: `${from}-${from + 999}`, "Range-Unit": "items" },
      });
      if (!res.ok) throw new Error(`Could not read ${name} (${res.status})`);
      const rows = (await res.json()) as { data: Row }[];
      rows.forEach((r) => out.push(r.data || {}));
      if (rows.length < 1000) break;
    }
    return out;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const num = (v: unknown) => { const n = parseFloat(String(v ?? "")); return isFinite(n) ? n : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const has = (hay: unknown, needle?: string) => !needle || String(hay ?? "").toLowerCase().includes(needle.toLowerCase());
const inRange = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to);
const today = () => new Date().toISOString().slice(0, 10);
const lim = (n: unknown, d: number, max = 50) => Math.max(1, Math.min(max, Math.floor(num(n) || d)));
const saleDate = (s: Row) => String(s.date || s.createdAt || "").slice(0, 10);

function group<T>(items: T[], key: (x: T) => string, val: (x: T) => number, extra?: (acc: Row, x: T) => void) {
  const m = new Map<string, Row>();
  for (const x of items) {
    const k = key(x) || "(none)";
    const a = m.get(k) || { key: k, count: 0, total: 0 };
    a.count++; a.total += val(x);
    if (extra) extra(a, x);
    m.set(k, a);
  }
  return [...m.values()].map((a) => { for (const f in a) if (typeof a[f] === "number") a[f] = r2(a[f]); return a; });
}

function filterSales(sales: Row[], a: Row) {
  return sales.filter((s) => {
    const d = saleDate(s);
    return inRange(d, a.from, a.to) && has(s.customer, a.customer) && has(s.payment || "Cash", a.payment)
      && has(s.status, a.status) && (!a.invoice_no || String(s.invoiceNo || s.id) === String(a.invoice_no))
      && (!a.product || (s.items || []).some((i: Row) => has(i.name, a.product)));
  });
}

// ── Tools ────────────────────────────────────────────────────────────────────
const dateProps = {
  from: { type: "string", description: "Start date YYYY-MM-DD (inclusive). Omit for all time." },
  to: { type: "string", description: "End date YYYY-MM-DD (inclusive)." },
};

const TOOLS = [
  {
    name: "business_overview",
    description: "Headline figures: today, this month, last month and all-time sales, money collected, money owed by customers, expenses, stock value, low/out-of-stock counts, number of customers and products, currency and business name. Call this first for general questions.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "sales_summary",
    description: "Totals for sales matching filters, optionally grouped. Use for 'how much did I sell', 'sales by month', 'mobile money vs cash', 'best customers', 'best selling products'.",
    parameters: {
      type: "object",
      properties: {
        ...dateProps,
        customer: { type: "string", description: "Part of the customer name" },
        payment: { type: "string", description: "Payment method, e.g. Cash, Mobile Money, Bank Transfer, Credit" },
        status: { type: "string", description: "Paid, Partial or Credit" },
        product: { type: "string", description: "Only sales containing this product (part of name)" },
        group_by: { type: "string", enum: ["none", "day", "month", "customer", "payment", "status", "product", "staff"] },
        sort: { type: "string", enum: ["total", "count", "key"], description: "Order of groups (default total, high to low; key = by date/name)" },
        limit: { type: "integer", description: "Max groups to return (default 15)" },
      },
    },
  },
  {
    name: "list_sales",
    description: "List individual invoices/sales with invoice number, date, customer, total, paid, balance, payment and items. Use to find a specific invoice or show recent/largest sales.",
    parameters: {
      type: "object",
      properties: {
        ...dateProps,
        customer: { type: "string" }, payment: { type: "string" }, status: { type: "string" },
        product: { type: "string" }, invoice_no: { type: "string", description: "Exact invoice number" },
        sort: { type: "string", enum: ["newest", "oldest", "largest", "smallest"] },
        limit: { type: "integer", description: "Default 10, max 50" },
      },
    },
  },
  {
    name: "customers",
    description: "Customers with phone, number of purchases, total spent, amount still owed and last purchase date (calculated from sales). Use for 'who owes me', 'top customers', 'customer X details'.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Part of the name or phone" },
        sort: { type: "string", enum: ["spent", "purchases", "owed", "recent", "name"] },
        only_owing: { type: "boolean" },
        limit: { type: "integer", description: "Default 10" },
      },
    },
  },
  {
    name: "products",
    description: "Products with stock quantity, cost price, selling price, category, stock value and low-stock level. Use for stock, prices, restocking, inventory value.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Part of product name, SKU or category" },
        stock: { type: "string", enum: ["all", "low", "out", "in"] },
        sort: { type: "string", enum: ["name", "qty", "value", "price"] },
        include_inactive: { type: "boolean" },
        limit: { type: "integer", description: "Default 20" },
      },
    },
  },
  {
    name: "expenses",
    description: "Expense totals and entries, optionally grouped by category, month or day, or searched by description.",
    parameters: {
      type: "object",
      properties: {
        ...dateProps,
        search: { type: "string", description: "Part of description, category or notes" },
        group_by: { type: "string", enum: ["none", "category", "month", "day"] },
        limit: { type: "integer", description: "Max groups or entries (default 15)" },
      },
    },
  },
  {
    name: "payments_and_stock_history",
    description: "Customer payment records (debt repayments) and stock movement history (restocks, adjustments, damage, sales).",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["payments", "stock_movements"] },
        ...dateProps,
        search: { type: "string", description: "Customer, product or note text" },
        limit: { type: "integer", description: "Default 15" },
      },
      required: ["kind"],
    },
  },
  {
    name: "suppliers_and_staff",
    description: "Suppliers (with balances owed to them) and employees/payroll.",
    parameters: {
      type: "object",
      properties: { kind: { type: "string", enum: ["suppliers", "employees", "payroll"] }, search: { type: "string" } },
      required: ["kind"],
    },
  },
  {
    name: "app_help",
    description: "How to use SmartStock Pro: where things are and how to do tasks (make a sale, add products, record payments, print invoices, backups, users, privacy lock...).",
    parameters: { type: "object", properties: { topic: { type: "string" } } },
  },
];

const APP_GUIDE = `SmartStock Pro pages (menu / sidebar):
- Dashboard: today's and this month's figures, charts, alerts. The eye icon hides/shows the 5 money figures (privacy PIN or fingerprint).
- Products: add/edit products (name, SKU, category, cost, price, quantity, low-stock level). Stock Movement page: adjust stock, restock (GRN), damage, returns, history.
- Sales: "New Sale" -> pick products, customer (name + phone), discount (% or amount), payment method (Cash, Mobile Money, Bank Transfer, Credit), amount paid; Save Invoice -> print/share invoice or receipt. Invoice numbers continue automatically. Select several invoices to delete (all, by day, by month). Record a balance payment from the invoice.
- Customers: customer list, purchase history, debts, record payments.
- Suppliers / Supply: suppliers, purchase orders, goods received, supplier bills and payments.
- Expenses: record expenses by category. Salary: employees and payroll.
- Finance & Reports: profit and loss, sales by payment method, exports and printing. Closing: daily closing report (cash vs mobile money).
- Quotations: create quotes and convert them into sales.
- AI Assistant: this chat; "Full Business Report" button writes a printable report.
- Settings: business name, currency, invoice settings, theme, privacy PIN, data backup. User management: invite staff and set their roles.
- Data syncs between phone and laptop automatically when online; sales made offline upload later. The server takes a nightly backup.`;

async function runTool(name: string, a: Row, db: Data): Promise<unknown> {
  switch (name) {
    case "business_overview": {
      const [sales, exps, prods, custs, sets] = await Promise.all([
        db.table("biz_sales"), db.table("biz_expenses"), db.table("biz_products"), db.table("biz_customers"), db.table("biz_settings"),
      ]);
      const t = today(), m = t.slice(0, 7);
      const lm = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 2, 1)).toISOString().slice(0, 7);
      const sum = (rows: Row[], f: string) => r2(rows.reduce((x, r) => x + num(r[f]), 0));
      const sl = (pred: (d: string) => boolean) => sales.filter((s) => pred(saleDate(s)));
      const period = (rows: Row[]) => ({ invoices: rows.length, sales: sum(rows, "total"), collected: sum(rows, "amountPaid") });
      const active = prods.filter((p) => p.status !== "inactive");
      const s0 = sets[0] || {};
      return {
        business: s0.bizName || s0.businessName || "", currency: s0.currency || "$", today: t,
        today_sales: period(sl((d) => d === t)), this_month: period(sl((d) => d.startsWith(m))),
        last_month: period(sl((d) => d.startsWith(lm))), all_time: period(sales),
        first_sale_date: sales.map(saleDate).filter(Boolean).sort()[0] || null,
        owed_by_customers: sum(sales.filter((s) => num(s.balance) > 0), "balance"),
        expenses_today: sum(exps.filter((e) => e.date === t), "amount"),
        expenses_this_month: sum(exps.filter((e) => String(e.date).startsWith(m)), "amount"),
        expenses_all_time: sum(exps, "amount"),
        products_active: active.length,
        stock_units: active.reduce((x, p) => x + num(p.qty), 0),
        stock_value_cost: r2(active.reduce((x, p) => x + num(p.cost) * num(p.qty), 0)),
        stock_value_price: r2(active.reduce((x, p) => x + num(p.price) * num(p.qty), 0)),
        low_stock: active.filter((p) => num(p.qty) > 0 && num(p.qty) <= (num(p.lowLevel) || 5)).length,
        out_of_stock: active.filter((p) => num(p.qty) <= 0).length,
        customers: custs.length,
      };
    }
    case "sales_summary": {
      const rows = filterSales(await db.table("biz_sales"), a);
      const g = a.group_by || "none";
      const out: Row = {
        invoices: rows.length,
        total_sales: r2(rows.reduce((x, s) => x + num(s.total), 0)),
        collected: r2(rows.reduce((x, s) => x + num(s.amountPaid), 0)),
        still_owed: r2(rows.reduce((x, s) => x + num(s.balance), 0)),
        discounts: r2(rows.reduce((x, s) => x + num(s.discountAmount), 0)),
        sales_with_item_lines: rows.filter((s) => (s.items || []).length).length,
      };
      if (g !== "none") {
        let groups: Row[];
        if (g === "product") {
          const items = rows.flatMap((s) => (s.items || []).map((i: Row) => i));
          groups = group(items, (i) => String(i.name || ""), (i) => num(i.price) * num(i.qty || 1), (acc, i) => {
            acc.units = (acc.units || 0) + num(i.qty || 1);
            acc.profit = (acc.profit || 0) + (num(i.price) - num(i.cost)) * num(i.qty || 1);
          });
        } else {
          const key = (s: Row) => g === "day" ? saleDate(s) : g === "month" ? saleDate(s).slice(0, 7)
            : g === "customer" ? String(s.customer || "Walk-in Customer") : g === "payment" ? String(s.payment || "Cash")
            : g === "staff" ? String(s.createdByName || "") : String(s.status || "");
          groups = group(rows, key, (s) => num(s.total));
        }
        const sort = a.sort || (g === "day" || g === "month" ? "key" : "total");
        groups.sort((x, y) => sort === "key" ? String(y.key).localeCompare(String(x.key)) : num(y[sort]) - num(x[sort]));
        out.group_count = groups.length;
        out.groups = groups.slice(0, lim(a.limit, 15));
      }
      return out;
    }
    case "list_sales": {
      const rows = filterSales(await db.table("biz_sales"), a);
      const s = a.sort || "newest";
      rows.sort((x, y) => s === "largest" ? num(y.total) - num(x.total) : s === "smallest" ? num(x.total) - num(y.total)
        : s === "oldest" ? saleDate(x).localeCompare(saleDate(y)) : saleDate(y).localeCompare(saleDate(x)));
      return {
        matching: rows.length,
        sales: rows.slice(0, lim(a.limit, 10)).map((x) => ({
          invoice: x.invoiceNo || x.id, date: saleDate(x), customer: x.customer, phone: x.customerPhone || undefined,
          total: num(x.total), paid: num(x.amountPaid), balance: num(x.balance), payment: x.payment || "Cash", status: x.status,
          items: (x.items || []).map((i: Row) => `${i.qty}x ${i.name} @ ${i.price}`).join("; ") || undefined,
          notes: x.notes || undefined, by: x.createdByName || undefined,
        })),
      };
    }
    case "customers": {
      const [custs, sales] = await Promise.all([db.table("biz_customers"), db.table("biz_sales")]);
      const stats = new Map<string, Row>();
      for (const s of sales) {
        const k = String(s.customerId || s.customer || "").toLowerCase();
        if (!k || k === "walk-in customer") continue;
        const st = stats.get(k) || { spent: 0, purchases: 0, owed: 0, last: "" };
        st.spent += num(s.total); st.purchases++; st.owed += num(s.balance);
        if (saleDate(s) > st.last) st.last = saleDate(s);
        stats.set(k, st);
      }
      let list = custs.map((c) => {
        const st = stats.get(String(c.id).toLowerCase()) || stats.get(String(c.name || "").toLowerCase()) || { spent: 0, purchases: 0, owed: 0, last: "" };
        return { name: c.name, phone: c.phone || undefined, purchases: st.purchases, spent: r2(st.spent), owed: r2(st.owed), last_purchase: st.last || undefined, status: c.status };
      }).filter((c) => (has(c.name, a.search) || has(c.phone, a.search)) && (!a.only_owing || c.owed > 0));
      const s = a.sort || (a.only_owing ? "owed" : "spent");
      list.sort((x, y) => s === "name" ? String(x.name).localeCompare(String(y.name)) : s === "recent"
        ? String(y.last_purchase || "").localeCompare(String(x.last_purchase || "")) : num((y as Row)[s]) - num((x as Row)[s]));
      return { matching: list.length, customers: (list = list.slice(0, lim(a.limit, 10))) };
    }
    case "products": {
      const prods = await db.table("biz_products");
      const st = a.stock || "all";
      const list = prods.filter((p) => (a.include_inactive || p.status !== "inactive")
        && (has(p.name, a.search) || has(p.sku, a.search) || has(p.category, a.search))
        && (st === "all" || (st === "out" ? num(p.qty) <= 0 : st === "in" ? num(p.qty) > 0
          : num(p.qty) > 0 && num(p.qty) <= (num(p.lowLevel) || 5))))
        .map((p) => ({ name: p.name, sku: p.sku || undefined, category: p.category || undefined, qty: num(p.qty),
          cost: num(p.cost), price: num(p.price), stock_value_cost: r2(num(p.cost) * num(p.qty)),
          low_level: num(p.lowLevel) || 5, status: p.status || "active" }));
      const s = a.sort || "name";
      list.sort((x, y) => s === "name" ? String(x.name).localeCompare(String(y.name)) : s === "qty" ? x.qty - y.qty
        : s === "value" ? y.stock_value_cost - x.stock_value_cost : y.price - x.price);
      return { matching: list.length, total_units: list.reduce((x, p) => x + p.qty, 0),
        total_value_cost: r2(list.reduce((x, p) => x + p.stock_value_cost, 0)), products: list.slice(0, lim(a.limit, 20)) };
    }
    case "expenses": {
      const rows = (await db.table("biz_expenses")).filter((e) => inRange(String(e.date || ""), a.from, a.to)
        && (has(e.description, a.search) || has(e.category, a.search) || has(e.notes, a.search)));
      const out: Row = { entries: rows.length, total: r2(rows.reduce((x, e) => x + num(e.amount), 0)) };
      const g = a.group_by || "none";
      if (g === "none") {
        out.latest = rows.sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, lim(a.limit, 15))
          .map((e) => ({ date: e.date, amount: num(e.amount), description: e.description, category: e.category }));
      } else {
        const key = (e: Row) => g === "category" ? String(e.category || "") : g === "month" ? String(e.date).slice(0, 7) : String(e.date);
        const groups = group(rows, key, (e) => num(e.amount));
        groups.sort((x, y) => g === "category" ? y.total - x.total : String(y.key).localeCompare(String(x.key)));
        out.groups = groups.slice(0, lim(a.limit, 15));
      }
      return out;
    }
    case "payments_and_stock_history": {
      if (a.kind === "payments") {
        const rows = (await db.table("biz_payments")).filter((p) => inRange(String(p.paidAt || p.date || "").slice(0, 10), a.from, a.to)
          && (has(p.note, a.search) || has(p.customer, a.search) || has(p.method, a.search)));
        return { count: rows.length, total: r2(rows.reduce((x, p) => x + num(p.amount), 0)),
          latest: rows.sort((x, y) => String(y.paidAt || "").localeCompare(String(x.paidAt || ""))).slice(0, lim(a.limit, 15))
            .map((p) => ({ date: String(p.paidAt || "").slice(0, 10), amount: num(p.amount), method: p.method, note: p.note, sale: p.saleId })) };
      }
      const rows = (await db.table("biz_stock_movements")).filter((m) => inRange(String(m.date || ""), a.from, a.to)
        && (has(m.productName, a.search) || has(m.note, a.search) || has(m.type, a.search)));
      return { count: rows.length, latest: rows.sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, lim(a.limit, 15))
        .map((m) => ({ date: m.date, product: m.productName, type: m.type, qty: num(m.qty), before: m.qtyBefore, after: m.qtyAfter, note: m.note })) };
    }
    case "suppliers_and_staff": {
      const t = a.kind === "suppliers" ? "biz_suppliers" : a.kind === "employees" ? "biz_employees" : "biz_payroll";
      const rows = (await db.table(t)).filter((r) => has(JSON.stringify(r), a.search));
      // Drop bulky/sensitive fields
      return { count: rows.length, rows: rows.slice(0, 30).map((r) => { const { photo, avatar, password, pin, ...rest } = r; return rest; }) };
    }
    case "app_help":
      return APP_GUIDE;
  }
  return { error: "Unknown tool " + name };
}

// ── The agent loop ───────────────────────────────────────────────────────────
function systemPrompt() {
  return `You are SmartStock AI, the assistant inside SmartStock Pro, a stock and sales app used by a shop in Liberia.
Today is ${today()}. Answer ANY question the user asks about their business or about using the app.
Rules:
- For facts about the business (sales, money, customers, stock, expenses, staff) ALWAYS call the tools to get real numbers. Never invent or estimate figures. If a tool returns nothing, say so.
- Work out date ranges yourself (e.g. "last week", "in March" = YYYY-MM-DD from/to).
- For "how do I..." questions about the app, use app_help.
- Show money with the business currency (usually $) and 2 decimals where needed.
- Be short and clear: a direct answer first, then a few bullet points if useful. Use **bold** for key numbers. No tables wider than 4 columns.
- You can only read data; you cannot change, add or delete anything. If asked to, explain where in the app to do it.
- Answer in the language the user writes in.`;
}

async function callModel(messages: Row[], withTools: boolean, maxTokens: number) {
  const body: Row = { model: AI_MODEL, messages, max_tokens: maxTokens, temperature: 0.2 };
  if (withTools) {
    body.tools = TOOLS.map((t) => ({ type: "function", function: t }));
    body.tool_choice = "auto";
  }
  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Row = {};
  try { data = JSON.parse(text); } catch { /* keep raw text for the error */ }
  if (!res.ok) {
    const msg = (data.error && (data.error.message || data.error)) || text.slice(0, 300);
    const err = new Error(String(msg)) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!userClaims(req)) return json({ error: "Please sign in to use the AI assistant.", type: "not_signed_in" }, 401);

  // The Claude agent (ai-agent-v2) is the main assistant now. Whenever its key is set, hand the
  // question over to it, so app versions that still call this function get the new assistant too.
  if (clean(Deno.env.get("ANTHROPIC_API_KEY"))) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-agent-v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON,
          Authorization: req.headers.get("authorization") || "",
        },
        body: await req.text(),
      });
      return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      console.log(JSON.stringify({ event: "ai_agent_forward_failed", message: String((e as Error).message).slice(0, 200) }));
      return json({ error: "The AI service could not be reached. Please try again.", type: "network" }, 502);
    }
  }
  if (!AI_KEY) {
    return json({
      error: "The AI assistant is not set up yet. In Supabase, open Edge Functions → Secrets and add ANTHROPIC_API_KEY (your Claude API key from console.anthropic.com, it starts with sk-ant-api).",
      type: "not_configured",
    }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as Row;
  const isReport = body.mode === "report";
  const history: Row[] = (Array.isArray(body.messages) ? body.messages : body.prompt ? [{ role: "user", content: String(body.prompt) }] : [])
    .filter((m: Row) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content)
    .slice(-12)
    .map((m: Row) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  if (!history.length) return json({ error: "Missing question", type: "bad_request" }, 400);

  const db = new Data(req.headers.get("authorization") || "");
  const messages: Row[] = [{ role: "system", content: systemPrompt() }];
  // The report button sends a ready-made data summary; chat relies on the tools instead
  if (typeof body.system === "string" && body.system && isReport) messages.push({ role: "system", content: body.system.slice(0, 20000) });
  messages.push(...history);

  const used: string[] = [];
  try {
    for (let step = 0; step <= MAX_STEPS; step++) {
      const data = await callModel(messages, step < MAX_STEPS, isReport ? 4000 : 1500);
      const msg = data.choices?.[0]?.message || {};
      const calls = msg.tool_calls || [];
      if (!calls.length) {
        const text = String(msg.content || "").trim();
        if (!text) return json({ error: "The AI returned an empty answer. Please try again.", type: "empty" }, 502);
        return json({ content: [{ type: "text", text }], tools_used: used, model: data.model || AI_MODEL });
      }
      messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
      for (const c of calls) {
        let args: Row = {};
        try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* use defaults */ }
        let result: unknown;
        try { result = await runTool(c.function?.name, args, db); } catch (e) { result = { error: String((e as Error).message || e) }; }
        used.push(c.function?.name);
        let out = typeof result === "string" ? result : JSON.stringify(result);
        if (out.length > MAX_TOOL_CHARS) out = out.slice(0, MAX_TOOL_CHARS) + "…(truncated — ask with narrower filters)";
        messages.push({ role: "tool", tool_call_id: c.id, content: out });
      }
    }
    return json({ error: "The question needed too many steps. Try asking it more simply.", type: "too_many_steps" }, 200);
  } catch (e) {
    const status = (e as { status?: number }).status || 0;
    console.log(JSON.stringify({ event: "ai_agent_error", status, base: AI_BASE, model: AI_MODEL, message: String((e as Error).message).slice(0, 300) }));
    if (status === 401 || status === 403) return json({ error: "The AI_API_KEY saved in Supabase was rejected by the AI provider. Create a new key and save it again.", type: "invalid_api_key" }, 502);
    if (status === 429) return json({ error: "The free AI limit has been reached for now. Please wait a minute (or until tomorrow if the daily limit is used up) and try again.", type: "rate_limited" }, 429);
    if (status === 404) return json({ error: `The AI model "${AI_MODEL}" was not found at the provider. Check the AI_MODEL secret.`, type: "bad_model" }, 502);
    if (status) return json({ error: "The AI provider had a problem (" + status + "): " + String((e as Error).message).slice(0, 200), type: "upstream_error" }, 502);
    return json({ error: "The AI service could not be reached. Please try again.", type: "network" }, 502);
  }
});
