// SmartStock Pro — AI agent v2 (Supabase Edge Function, Deno)
//
// Answers questions about the business with Claude, which looks up real figures through
// read-only tools:
//   business_snapshot  headline figures + what the data can't answer   (rpc ai_snapshot)
//   query_data         filter / group / total any ai.* view              (rpc ai_query)
//   profit_and_loss    sales, cost of goods, expenses, payroll for a period
//   app_help           how to use the app
//
// Date words ("last week", "this month") are turned into exact dates HERE, in code, not by the model.
// Every lookup uses the caller's own sign-in token, so row-level security limits it to their business.
// Nothing is ever written.
//
// Secrets: ANTHROPIC_API_KEY (required) · AI_MODEL (optional, default claude-opus-5-5)
//          AI_EFFORT (optional: low | medium | high, default medium) · BUSINESS_TZ (default Africa/Monrovia)
// Deploy with JWT verification ON.
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";

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
const API_KEY = clean(Deno.env.get("ANTHROPIC_API_KEY"));
const MODEL = clean(Deno.env.get("AI_MODEL")) || "claude-opus-5-5";
const EFFORT = (["low", "medium", "high"].includes(clean(Deno.env.get("AI_EFFORT"))) ? clean(Deno.env.get("AI_EFFORT")) : "medium") as
  "low" | "medium" | "high";
const TZ = clean(Deno.env.get("BUSINESS_TZ")) || "Africa/Monrovia";
const MAX_STEPS = 8;              // model turns per question
const MAX_TOOL_CHARS = 20000;     // per tool result

type Row = Record<string, any>;

function signedIn(req: Request): boolean {
  const part = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").split(".")[1];
  if (!part) return false;
  try {
    const c = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return c.role === "authenticated" && typeof c.sub === "string";
  } catch {
    return false;
  }
}

// ── Dates (worked out in code so the model never does date maths) ────────────
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monthStart = (s: string, back = 0) => { const d = new Date(s.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - back); return iso(d); };
const monthEnd = (s: string) => addDays(monthStart(s, -1), -1);
function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const weekday = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

const PERIODS = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "same_days_last_month",
  "this_year", "last_year", "last_7_days", "last_30_days", "last_90_days", "last_12_months", "all_time"];

type Range = { from?: string; to?: string; label: string };
function resolvePeriod(p: string | undefined, t = todayLocal()): Range | null {
  if (!p) return null;
  const k = String(p).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const mon = addDays(t, -((new Date(t + "T00:00:00Z").getUTCDay() + 6) % 7)); // Monday of this week
  switch (k) {
    case "today": return { from: t, to: t, label: "today" };
    case "yesterday": { const y = addDays(t, -1); return { from: y, to: y, label: "yesterday" }; }
    case "this_week": return { from: mon, to: t, label: "this week (Monday to today)" };
    case "last_week": return { from: addDays(mon, -7), to: addDays(mon, -1), label: "last week (Monday to Sunday)" };
    case "this_month": return { from: monthStart(t), to: t, label: "this month so far" };
    case "last_month": return { from: monthStart(t, 1), to: monthEnd(monthStart(t, 1)), label: "last month" };
    case "same_days_last_month": {
      const lm = monthStart(t, 1), days = Math.round((Date.parse(t) - Date.parse(monthStart(t))) / 864e5);
      const end = addDays(lm, days), lmEnd = monthEnd(lm);
      return { from: lm, to: end < lmEnd ? end : lmEnd, label: "the same days of last month" };
    }
    case "this_year": return { from: t.slice(0, 4) + "-01-01", to: t, label: "this year so far" };
    case "last_year": { const y = +t.slice(0, 4) - 1; return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` }; }
    case "last_7_days": return { from: addDays(t, -6), to: t, label: "the last 7 days" };
    case "last_30_days": return { from: addDays(t, -29), to: t, label: "the last 30 days" };
    case "last_90_days": return { from: addDays(t, -89), to: t, label: "the last 90 days" };
    case "last_12_months": return { from: monthStart(t, 11), to: t, label: "the last 12 months" };
    case "all_time": return { label: "all time" };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return { from: k, to: k, label: k };
  if (/^\d{4}_\d{2}$/.test(k)) { const m = k.replace("_", "-"); return { from: m + "-01", to: monthEnd(m + "-01"), label: m }; }
  if (/^\d{4}$/.test(k)) return { from: `${k}-01-01`, to: `${k}-12-31`, label: k };
  throw new Error(`Unknown period "${p}". Use one of ${PERIODS.join(", ")}, or YYYY-MM, YYYY, YYYY-MM-DD, or date_from/date_to.`);
}

function rangeFrom(a: Row): Range | null {
  if (a.date_from || a.date_to) return { from: a.date_from, to: a.date_to, label: `${a.date_from || "start"} to ${a.date_to || "today"}` };
  return resolvePeriod(a.period);
}

// ── Database calls (caller's token → RLS) ────────────────────────────────────
async function rpc(auth: string, fn: string, body: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error((data && (data.message || data.hint)) || `Database error ${res.status}`);
  return data;
}
const query = (auth: string, spec: Row) => rpc(auth, "ai_query", { spec });

// ── Tools ────────────────────────────────────────────────────────────────────
const VIEWS = ["sales", "sale_items", "payments", "customers", "products", "stock_movements", "expenses", "allocations",
  "suppliers", "supplier_bills", "purchase_orders", "grns", "grn_items", "quotations", "quotation_items", "employees",
  "payroll", "daily_summary", "monthly_pnl", "business", "data_quality"];

const periodProp = {
  type: "string",
  description: `Time range, worked out exactly by the server: ${PERIODS.join(", ")}; or a month "YYYY-MM", a year "YYYY", a day "YYYY-MM-DD". Use date_from/date_to for any other range.`,
};

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "business_snapshot",
    description: "Headline figures in one call: business name, currency, today's date, sales today / this month / last month / all time, money owed by customers, expenses, stock value, low and out-of-stock counts, customers, payment methods used, and data_notes that say what the records can't answer (e.g. sales saved without item lines). Call it first in a conversation.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "query_data",
    description: "Read any view, filtered by period, optionally grouped with totals. Examples: total sales last week → {view:'sales', period:'last_week', metrics:[{fn:'sum',column:'total'},{fn:'count'}]}. Sales by month → {view:'sales', group_by:['month'], metrics:[{fn:'sum',column:'total'}]}. Top customers → {view:'customers', columns:['name','total_spent','purchases'], order_by:[{column:'total_spent'}], limit:5}. Busiest weekday → group_by:['weekday']. Results include matching_rows or groups (the full count) and, when grouped, grand totals.",
    input_schema: {
      type: "object",
      properties: {
        view: { type: "string", enum: VIEWS },
        period: periodProp,
        date_from: { type: "string", description: "YYYY-MM-DD, inclusive (instead of period)" },
        date_to: { type: "string", description: "YYYY-MM-DD, inclusive (instead of period)" },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              op: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "is_null", "not_null"] },
              value: { description: "A value, or an array for op 'in'. Text matching is case-insensitive." },
            },
            required: ["column", "op"],
          },
        },
        group_by: { type: "array", items: { type: "string" }, description: "Column names, or day / week / month / year / weekday of the view's date column" },
        metrics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fn: { type: "string", enum: ["count", "sum", "avg", "min", "max", "count_distinct"] },
              column: { type: "string", description: "Not needed for a plain count" },
            },
            required: ["fn"],
          },
          description: "Result names are fn_column, e.g. sum_total, avg_total; a plain count is 'count'",
        },
        columns: { type: "array", items: { type: "string" }, description: "Columns to list when not grouping (default: all)" },
        order_by: {
          type: "array",
          items: { type: "object", properties: { column: { type: "string" }, dir: { type: "string", enum: ["asc", "desc"] } }, required: ["column"] },
          description: "A column, a group_by name or a metric name like sum_total (default desc)",
        },
        limit: { type: "integer", description: "Rows or groups to return, default 25, max 200" },
      },
      required: ["view"],
    },
  },
  {
    name: "profit_and_loss",
    description: "Profit for a period: sales, discounts, cost of goods (only where sales have item lines, with a coverage %), a rough cost-of-goods estimate from current product margins, expenses by category, payroll and net profit. Use for any profit, margin or 'am I making money' question.",
    input_schema: {
      type: "object",
      properties: { period: periodProp, date_from: { type: "string" }, date_to: { type: "string" } },
    },
  },
  {
    name: "app_help",
    description: "How to use SmartStock Pro: where things are and how to do tasks (make a sale, add products, record a debt payment, print invoices, quotations, backups, users, privacy lock...).",
    input_schema: { type: "object", properties: { topic: { type: "string" } } },
  },
];

const APP_GUIDE = `SmartStock Pro pages (menu / sidebar):
- Dashboard: today's and this month's figures, charts, alerts. The eye icon hides/shows the money figures (privacy PIN or fingerprint).
- Products: add/edit products (name, SKU, category, cost, price, quantity, low-stock level). Stock Movement page: adjust stock, restock (GRN), damage, returns, history.
- Sales: "New Sale" -> pick products, customer (name + phone), discount (% or amount), payment method (Cash, Mobile Money, Bank Transfer, Credit), amount paid; Save Invoice -> print/share invoice or receipt. Invoice numbers continue automatically. Filters screen: date, payment mode, customer, staff, invoice. Select several invoices to delete. Record a balance payment by opening the invoice.
- Customers: customer list, purchase history, debts; record a payment against what a customer owes.
- Suppliers / Supply: suppliers, purchase orders, goods received (GRN), supplier bills and payments.
- Expenses: record expenses by category; Allocations spread a big cost (e.g. a year's rent) over days. Salary: employees, payroll and loans.
- Finance & Reports: profit and loss, sales by payment method, exports and printing. Closing: daily closing report (cash vs mobile money).
- Quotations: create, edit and send quotes (WhatsApp, as a photo) and convert them into sales.
- AI Assistant: this chat; "Full Business Report" writes a printable report.
- Settings: business name, currency, invoice settings, theme, privacy PIN, data backup. User management: invite staff and set roles.
- Data syncs between phone and laptop when online; sales made offline upload later. The server takes a nightly backup.`;

async function profitAndLoss(auth: string, a: Row) {
  const r = rangeFrom(a);
  const dr = r ? { date_from: r.from, date_to: r.to } : {};
  const [s, withItems, cogs, exp, pay, margin] = await Promise.all([
    query(auth, { view: "sales", ...dr, metrics: [{ fn: "sum", column: "total" }, { fn: "sum", column: "discount_amount" }, { fn: "count" }] }),
    query(auth, { view: "sales", ...dr, filters: [{ column: "item_lines", op: "gt", value: 0 }], metrics: [{ fn: "sum", column: "total" }] }),
    query(auth, { view: "sale_items", ...dr, metrics: [{ fn: "sum", column: "line_cost" }, { fn: "sum", column: "line_total" }] }),
    query(auth, { view: "expenses", ...dr, group_by: ["category"], metrics: [{ fn: "sum", column: "amount" }], limit: 8 }),
    query(auth, { view: "payroll", ...dr, metrics: [{ fn: "sum", column: "net_pay" }] }),
    query(auth, { view: "products", filters: [{ column: "cost", op: "gt", value: 0 }, { column: "status", op: "neq", value: "inactive" }],
                  metrics: [{ fn: "sum", column: "stock_value_cost" }, { fn: "sum", column: "stock_value_price" }] }),
  ]);
  const n = (x: any) => Number(x) || 0;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const sales = n(s.rows[0]?.sum_total), covered = n(withItems.rows[0]?.sum_total);
  const cogsKnown = n(cogs.rows[0]?.sum_line_cost);
  const expenses = n(exp.totals?.sum_amount), payroll = n(pay.rows[0]?.sum_net_pay);
  const coverage = sales > 0 ? r2((covered / sales) * 100) : 0;
  const mc = n(margin.rows[0]?.sum_stock_value_cost), mp = n(margin.rows[0]?.sum_stock_value_price);
  const costRatio = mp > 0 ? mc / mp : null;   // cost ÷ price of current stock
  const uncovered = sales - covered;
  const cogsEstimate = costRatio === null ? null : r2(cogsKnown + uncovered * costRatio);
  const out: Row = {
    period: r ? { from: r.from, to: r.to, label: r.label } : { label: "all time" },
    invoices: n(s.rows[0]?.count),
    sales: r2(sales),
    discounts_given: r2(n(s.rows[0]?.sum_discount_amount)),
    cost_of_goods_recorded: r2(cogsKnown),
    cogs_coverage_pct: coverage,
    expenses: r2(expenses),
    expenses_by_category: exp.rows,
    payroll: r2(payroll),
    sales_minus_expenses_and_payroll: r2(sales - expenses - payroll),
  };
  if (coverage < 100) {
    out.estimated_cost_of_goods = cogsEstimate;
    out.estimated_net_profit = cogsEstimate === null ? null : r2(sales - cogsEstimate - expenses - payroll);
    out.estimate_basis = costRatio === null ? "No product costs recorded, so cost of goods can't be estimated."
      : `Sales without item lines are costed at the current stock's average cost/price ratio (${r2(costRatio * 100)}% of the selling price, i.e. a ${r2((1 - costRatio) * 100)}% gross margin).`;
    out.warning = `Only ${coverage}% of these sales have item lines, so the real cost of goods is not recorded. 'sales_minus_expenses_and_payroll' is NOT profit: it ignores what the goods cost. Show the estimate and say clearly that it is an estimate.`;
  } else {
    out.gross_profit = r2(sales - cogsKnown);
    out.net_profit = r2(sales - cogsKnown - expenses - payroll);
  }
  return out;
}

async function runTool(name: string, a: Row, auth: string): Promise<unknown> {
  switch (name) {
    case "business_snapshot":
      return await rpc(auth, "ai_snapshot", {});
    case "query_data": {
      const r = rangeFrom(a);
      const spec: Row = { view: a.view, filters: a.filters, group_by: a.group_by, metrics: a.metrics, columns: a.columns, order_by: a.order_by, limit: a.limit };
      if (r?.from) spec.date_from = r.from;
      if (r?.to) spec.date_to = r.to;
      for (const k of Object.keys(spec)) if (spec[k] === undefined || spec[k] === null) delete spec[k];
      const res = await query(auth, spec);
      if (r) res.period = r.label;
      return res;
    }
    case "profit_and_loss":
      return await profitAndLoss(auth, a);
    case "app_help":
      return APP_GUIDE;
  }
  throw new Error("Unknown tool " + name);
}

// ── Instructions (static, so they are cached between requests) ───────────────
const SYSTEM = `You are SmartStock AI, the assistant inside SmartStock Pro, a stock and sales app used by shops in Liberia. You answer the owner's and staff's questions about their own business and about using the app.

How to work:
- For any fact about the business (sales, money, customers, stock, expenses, suppliers, staff), look it up with the tools. Never invent, estimate or remember figures; if a tool returns nothing, say so plainly.
- Call business_snapshot first in a conversation. Its data_notes tell you what the records can't answer.
- Use the period parameter for dates ("last week" → period "last_week"); the server works out exact dates and returns them. Mention the dates you used when it helps.
- Use as few tool calls as needed. Independent lookups can be made in the same turn.
- If a tool returns an error, fix the request (it names the valid views and columns) and try again.
- Product-level questions (best-selling product, units sold, profit per product) need sale item lines. If data_notes show sales_without_items, say that the sales were saved without item details, so this can't be answered from sales, and offer what can be (e.g. stock levels, product margins from cost and price).
- For profit, always use profit_and_loss and follow its warning: never present sales minus expenses as profit when cost of goods is missing.
- You can only read data. If asked to add, change or delete something, say you can't do that and tell them where in the app to do it (app_help).
- Customer and staff details are the business's own records; share them with the user who asks.

How to answer:
- Direct answer first, with the key numbers in **bold**, then a few short bullet points if useful. Tables only when comparing several rows, at most 4 columns.
- Money with the business currency (usually $) and 2 decimals where needed; use thousands separators.
- Short and clear: these are busy shop owners, often on a phone.
- Answer in the language the user writes in.

Data views for query_data (all limited to the user's business; deleted records excluded):
- sales: id, invoice_no, has_invoice_no, sale_date, customer_id, customer_name ('Walk-in Customer' if none), customer_phone, subtotal, discount_amount, total, amount_paid, balance (still owed), status (Paid/Partial/Credit), payment_method (as typed), payment_group (Cash / Mobile money / Bank / Online / Credit), notes, created_by_name (staff), item_lines (number of items saved), created_at
- sale_items: sale_id, sale_date, line_no, product_id, product_name, qty, unit_price, unit_cost, line_total, line_cost, line_profit
- payments (customer payments incl. debt repayments): id, sale_id, invoice_ref, customer_id, customer_name, amount, method, method_group, note ('Initial payment' = paid at the sale), paid_date
- customers: id, name, phone, email, address, status, created_on, purchases, total_spent, total_paid, amount_owed, first_purchase, last_purchase, days_since_last_purchase (date filter applies to last_purchase)
- products: id, name, sku, barcode, category, unit, qty, cost, price, low_level, status, stock_value_cost, stock_value_price, margin_pct, stock_state (ok/low/out), default_supplier_id
- stock_movements: id, move_date, product_id, product_name, type (restock/adjustment/return/damage/sale...), qty (+in/-out), qty_before, qty_after, ref_type, note
- expenses: id, expense_date, amount, category, description, notes, payment_method, recurring, created_by_name
- allocations (costs spread over time): id, name, category, amount, daily_amount, days, start_date, end_date
- suppliers: id, name, contact, phone, whatsapp, email, balance (owed to them), status
- supplier_bills: id, ref, supplier_name, supplier_id, bill_date, due_date, total, balance, status, overdue
- purchase_orders: id, supplier_name, supplier_id, order_date, expected_date, total, status, item_lines, notes
- grns (goods received): id, supplier_name, supplier_id, po_ref, delivery_ref, received_date, total, status
- grn_items: grn_id, received_date, product_id, product_name, ordered_qty, received_qty, cost_price, condition
- quotations: id, client_name, client_phone, customer_id, quote_date, expiry_date, subtotal, tax_amount, total, status, expired, item_lines
- quotation_items: quotation_id, product_name, qty, unit_price, discount, tax
- employees: id, name, role, phone, monthly_salary, start_date, status
- payroll: id, employee_id, employee_name, pay_month, paid_date, base_salary, bonus, deduction, loan_deduction, net_pay, method
- daily_summary (one row per day with activity): day, weekday (1=Mon…7=Sun), invoices, sales, collected_at_sale, credit_given, discounts, cash_sales, mobile_money_sales, expenses, sales_minus_expenses
- monthly_pnl: month (YYYY-MM), invoices, sales, discounts, collected_at_sale, cogs_known, cogs_coverage_pct, expenses, payroll, gross_profit_known_cogs, net_profit_known_cogs
- business: business_name, currency, address, phone, default_low_stock, tax_pct, lrd_rate (Liberian dollars per US dollar), cogs_enabled
- data_quality: sales, sales_without_items, sales_without_invoice_no, walk_in_sales, first_sale_date, last_sale_date, products, products_without_cost, customers, customers_without_phone`;

// ── Request handler ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!signedIn(req)) return json({ error: "Please sign in to use the AI assistant.", type: "not_signed_in" }, 401);
  if (!API_KEY) return json({ error: "The AI is not set up yet: add the ANTHROPIC_API_KEY secret in Supabase (Edge Functions → Secrets).", type: "not_configured" }, 500);

  const body = (await req.json().catch(() => ({}))) as Row;
  const isReport = body.mode === "report";
  const history: Anthropic.Beta.BetaMessageParam[] = (Array.isArray(body.messages) ? body.messages
      : body.prompt ? [{ role: "user", content: String(body.prompt) }] : [])
    .filter((m: Row) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m: Row) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) return json({ error: "Missing question", type: "bad_request" }, 400);

  const auth = req.headers.get("authorization") || "";
  const t = todayLocal();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: `Today is ${weekday(t)} ${t} (${TZ}).` },
  ];
  // The report button sends a ready-made data summary as extra context
  if (isReport && typeof body.system === "string" && body.system) system.push({ type: "text", text: body.system.slice(0, 40000) });

  const client = new Anthropic({ apiKey: API_KEY, maxRetries: 2 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history];
  const used: string[] = [];
  const trace: Row[] = [];
  const usage = { input: 0, output: 0, cache_read: 0, cache_write: 0 };

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: isReport ? 16000 : 8000,
        output_config: { effort: isReport ? "high" : EFFORT },
        system,
        tools: TOOLS,
        messages,
        // If a safety classifier declines, the API retries on a suitable fallback model
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      usage.input += response.usage.input_tokens || 0;
      usage.output += response.usage.output_tokens || 0;
      usage.cache_read += response.usage.cache_read_input_tokens || 0;
      usage.cache_write += response.usage.cache_creation_input_tokens || 0;

      if (response.stop_reason === "refusal") {
        return json({ error: "The AI declined to answer this request. Try rephrasing it.", type: "refusal" }, 200);
      }
      const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || !calls.length) {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text).join("\n").trim();
        console.log(JSON.stringify({ event: "ai_agent_v2", model: response.model, steps: step + 1, tools: used, usage }));
        if (!text) return json({ error: "The AI returned an empty answer. Please try again.", type: "empty" }, 502);
        return json({
          content: [{ type: "text", text }],
          truncated: response.stop_reason === "max_tokens",
          tools_used: used, model: response.model, steps: step + 1,
          ...(body.debug ? { trace, usage } : {}),
        });
      }

      // Keep the whole assistant turn (thinking blocks included) and answer every tool call in one message
      messages.push({ role: "assistant", content: response.content });
      const results = await Promise.all(calls.map(async (c): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        used.push(c.name);
        const input = (c.input && typeof c.input === "object" ? c.input : {}) as Row;
        try {
          const result = await runTool(c.name, input, auth);
          let out = typeof result === "string" ? result : JSON.stringify(result);
          if (out.length > MAX_TOOL_CHARS) out = out.slice(0, MAX_TOOL_CHARS) + "…(cut short — ask with a smaller limit, filters or grouping)";
          trace.push({ tool: c.name, input, chars: out.length });
          return { type: "tool_result", tool_use_id: c.id, content: out };
        } catch (e) {
          const msg = String((e as Error).message || e);
          trace.push({ tool: c.name, input, error: msg });
          return { type: "tool_result", tool_use_id: c.id, content: msg, is_error: true };
        }
      }));
      messages.push({ role: "user", content: results });
    }
    return json({ error: "The question needed too many steps. Try asking it more simply.", type: "too_many_steps", tools_used: used }, 200);
  } catch (error) {
    console.log(JSON.stringify({ event: "ai_agent_v2_error", model: MODEL, status: (error as { status?: number }).status, message: String((error as Error).message).slice(0, 300) }));
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: "The Anthropic API key saved in Supabase was rejected. Create a new key (it starts with sk-ant-api) and save it again.", type: "invalid_api_key" }, 502);
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      return json({ error: "The Anthropic account doesn't have access to this model or has run out of credit. Check Plans & Billing at console.anthropic.com.", type: "permission_denied" }, 502);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: "The AI is busy right now. Please wait a minute and try again.", type: "rate_limited" }, 429);
    }
    if (error instanceof Anthropic.BadRequestError) {
      return json({ error: "The AI could not process this request: " + error.message, type: "bad_request" }, 400);
    }
    if (error instanceof Anthropic.APIError) {
      return json({ error: "The AI service had a problem (" + error.status + "). Please try again shortly.", type: "upstream_error" }, 502);
    }
    return json({ error: "The AI service could not be reached. Please try again.", type: "network" }, 502);
  }
});
