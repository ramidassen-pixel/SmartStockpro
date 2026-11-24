// SmartStock Pro — Scan Receipt (Supabase Edge Function, Deno)
//
// A staff member photographs a paper receipt they wrote. This function reads the photo with an AI model that can see
// images, and returns what is written on it: customer, date, items, discount, total, payment. Each written item is
// matched to a product in the business's own stock list.
//
// Nothing is saved here. The app fills the New Sale form with the result, the staff member checks every line against
// the paper, and only their "Save Invoice" tap records the sale (through record_sale, like any other sale).
//
// Which AI reads the photo (same Supabase secrets as ai-agent-v2):
//   AI_API_KEY / GEMINI_API_KEY / GROQ_API_KEY   free key. Gemini → gemini-2.5-flash; Groq → its vision model
//   ANTHROPIC_API_KEY                            Claude (paid), used when no free key is set
//   AI_PROVIDER = "free" | "claude"              choose when both are set
//   SCAN_MODEL                                   optional: the model to use for receipts
// Deploy with JWT verification ON.
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Row = Record<string, any>;
const clean = (v: string | undefined) => (v || "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
const ENV = Deno.env.toObject();
const SUPABASE_URL = ENV.SUPABASE_URL || "";
const SUPABASE_ANON = ENV.SUPABASE_ANON_KEY || "";
const CLAUDE_KEY = clean(ENV.ANTHROPIC_API_KEY);
const FREE_KEY_NAME = ["AI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_AI_API_KEY", "GROQ_API_KEY"].find((n) => clean(ENV[n]))
  || Object.keys(ENV).find((n) => /(gemini|google|groq|ai[_ ]?api)/i.test(n) && /key/i.test(n) && !/anthropic|supabase/i.test(n) && clean(ENV[n]))
  || "";
const FREE_KEY = FREE_KEY_NAME ? clean(ENV[FREE_KEY_NAME]) : "";
const FREE_IS_GROQ = FREE_KEY.startsWith("gsk_");
const FREE_IS_GEMINI = !!FREE_KEY && !FREE_IS_GROQ && !clean(ENV.AI_BASE_URL);
const FREE_BASE = (clean(ENV.AI_BASE_URL)
  || (FREE_IS_GEMINI ? "https://generativelanguage.googleapis.com/v1beta/openai" : "https://api.groq.com/openai/v1")).replace(/\/+$/, "");
const FREE_NAME = FREE_IS_GEMINI ? "Google Gemini" : FREE_IS_GROQ ? "Groq" : "the free AI provider";
const CHOICE = clean(ENV.AI_PROVIDER).toLowerCase();
const PROVIDER: "free" | "claude" | "" = CHOICE === "claude" && CLAUDE_KEY ? "claude" : CHOICE === "free" && FREE_KEY ? "free"
  : FREE_KEY ? "free" : CLAUDE_KEY ? "claude" : "";
const SCAN_MODEL = clean(ENV.SCAN_MODEL);
const MAX_IMAGE_CHARS = 6_000_000; // ~4.5 MB of JPEG; the app sends ~200–500 KB

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

// ── The business's own products (read with the caller's token, so row-level security applies) ─────────
type Product = { id: string; name: string; sku: string; price: number; qty: number };
async function loadProducts(auth: string): Promise<Product[]> {
  const url = `${SUPABASE_URL}/rest/v1/biz_products?select=id,data&deleted=eq.false&limit=3000`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: auth } });
  if (!res.ok) return [];
  const rows = await res.json().catch(() => []);
  return (Array.isArray(rows) ? rows : [])
    .filter((r: Row) => String(r.data?.status || "active") !== "inactive")
    .map((r: Row) => ({
      id: String(r.id), name: String(r.data?.name || "").trim(), sku: String(r.data?.sku || ""),
      price: Number(r.data?.price) || 0, qty: Number(r.data?.qty) || 0,
    }))
    .filter((p) => p.name);
}

// ── Matching a written item to a product, in code (used to check and fill in the model's choice) ────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
function words(s: string) { return norm(s).split(" ").filter((w) => w.length > 1 || /\d/.test(w)); }
function similarity(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (!A.length || !B.length) return 0;
  let hit = 0;
  for (const w of A) {
    if (B.some((x) => x === w || (w.length >= 4 && (x.startsWith(w) || w.startsWith(x))))) hit++;
  }
  return hit / Math.max(A.length, B.length) * 0.7 + hit / A.length * 0.3;
}
function bestMatch(written: string, products: Product[]): { p: Product | null; score: number } {
  let best: Product | null = null, score = 0;
  for (const p of products) {
    const s = Math.max(similarity(written, p.name), p.sku && norm(written).includes(norm(p.sku)) ? 0.9 : 0);
    if (s > score) { score = s; best = p; }
  }
  return { p: best, score };
}

// ── What the model must return ───────────────────────────────────────────────
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_receipt", "legibility", "receipt_no", "date", "customer_name", "customer_phone", "items",
    "discount_amount", "total_written", "amount_paid", "payment_method", "unreadable", "notes"],
  properties: {
    is_receipt: { type: "boolean", description: "false if the photo is not a sales receipt or invoice" },
    legibility: { type: "string", enum: ["good", "fair", "poor"] },
    receipt_no: { type: "string", description: "receipt / invoice number written or printed on it, or empty" },
    date: { type: "string", description: "date on the receipt as YYYY-MM-DD, or empty if none" },
    customer_name: { type: "string", description: "customer name, or empty" },
    customer_phone: { type: "string", description: "customer phone number exactly as written, or empty" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["written", "qty", "unit_price", "line_total", "product_id", "sure"],
        properties: {
          written: { type: "string", description: "the item exactly as written" },
          qty: { type: "number", description: "quantity (1 if not written)" },
          unit_price: { type: "number", description: "price for one, or 0 if not written" },
          line_total: { type: "number", description: "amount written for this line, or 0 if not written" },
          product_id: { type: "string", description: "id of the matching product from the PRODUCTS list, or empty if none clearly matches" },
          sure: { type: "boolean", description: "true only if every part of this line was clearly readable and the product match is clear" },
        },
      },
    },
    discount_amount: { type: "number", description: "discount written on the receipt as an amount of money, or 0" },
    total_written: { type: "number", description: "the grand total written on the receipt, or 0 if none" },
    amount_paid: { type: "number", description: "amount the customer paid if written separately, or -1 if not written" },
    payment_method: { type: "string", enum: ["Cash", "Mobile Money", "Bank Transfer", "Credit", ""] },
    unreadable: { type: "array", items: { type: "string" }, description: "short notes on anything that could not be read" },
    notes: { type: "string", description: "any other note written on the receipt, or empty" },
  },
};

function prompt(products: Product[], today: string): string {
  const list = products.slice(0, 1500).map((p) => `${p.id} | ${p.name}${p.sku ? " | " + p.sku : ""} | ${p.price}`).join("\n");
  return `You read a photo of a paper sales receipt from a shop in Liberia (handwritten or printed). Today is ${today}.
Copy what is written. Do not invent anything: if a value is not on the receipt, leave it empty (or 0 / -1 as described).
For each item line give the text exactly as written, the quantity, the unit price and the line amount.
Then pick the product from PRODUCTS that the line refers to (shop staff abbreviate: "coca 35" = "Coca-Cola 35cl"). Leave product_id empty if no product clearly matches; never guess between two similar products.
Set "sure" to false for any line where a number or word is hard to read, or the product match is not clear.
Amounts are in US dollars unless the receipt says LRD / L$; if it is in LRD, say so in "notes".
Return only the JSON object.

PRODUCTS (id | name | sku | price):
${list || "(no products)"}`;
}

// ── Reading with Claude ─────────────────────────────────────────────────────
async function readWithClaude(image: string, mediaType: string, text: string): Promise<Row> {
  const client = new Anthropic({ apiKey: CLAUDE_KEY });
  const response = await client.beta.messages.create({
    model: SCAN_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text },
      ],
    }],
  } as any);
  if (response.stop_reason === "refusal") throw new ScanError(422, "The AI could not read this photo. Please type the sale in by hand.");
  const out = (response.content as Row[]).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { data: parse(out), model: response.model };
}

// ── Reading with a free provider (OpenAI-compatible) ────────────────────────
let groqVisionModel = "";
async function freeModel(): Promise<string> {
  if (SCAN_MODEL) return SCAN_MODEL;
  if (FREE_IS_GEMINI) return "gemini-2.5-flash";
  if (!FREE_IS_GROQ) return clean(ENV.AI_MODEL);
  if (groqVisionModel) return groqVisionModel;
  // Groq changes its vision models over time: pick one it offers now
  const res = await fetch(`${FREE_BASE}/models`, { headers: { Authorization: `Bearer ${FREE_KEY}` } });
  const list: Row[] = res.ok ? ((await res.json()).data || []) : [];
  const ids = list.filter((m) => m.active !== false).map((m) => String(m.id));
  console.log(JSON.stringify({ event: "scan_receipt_groq_models", ids }));
  groqVisionModel = ids.find((id) => /llama-4-maverick/i.test(id)) || ids.find((id) => /llama-4-scout/i.test(id))
    || ids.find((id) => /vision|[-_/]vl\b|-vl-|qwen.*vl|gemma-?3|kimi.*vl/i.test(id))
    // Qwen 3.5 and later read images too
    || ids.find((id) => /qwen3\.([5-9]|\d\d)/i.test(id)) || "";
  if (!groqVisionModel) {
    throw new ScanError(502, "Groq has no model that can read photos right now. Add a free Gemini key (AI_API_KEY) or set SCAN_MODEL.");
  }
  return groqVisionModel;
}

async function readWithFree(image: string, mediaType: string, text: string): Promise<Row> {
  const model = await freeModel();
  const body: Row = {
    model,
    temperature: 0,
    max_tokens: 4000,
    messages: [
      { role: "system", content: "You return only a JSON object that follows this JSON schema:\n" + JSON.stringify(SCHEMA) },
      { role: "user", content: [
        { type: "image_url", image_url: { url: `data:${mediaType};base64,${image}` } },
        { type: "text", text },
      ] },
    ],
    response_format: { type: "json_object" },
  };
  const res = await fetch(`${FREE_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FREE_KEY}` },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data: Row = {};
  try { data = JSON.parse(raw); } catch { /* keep raw */ }
  if (Array.isArray(data)) data = data[0] || {};
  if (!res.ok) {
    const msg = String((data.error && (data.error.message || data.error)) || raw).slice(0, 300);
    console.log(JSON.stringify({ event: "scan_receipt_free_error", provider: FREE_NAME, model, status: res.status, message: msg }));
    if (res.status === 429) throw new ScanError(429, `${FREE_NAME} is busy (free limit reached). Wait a minute and try again.`);
    if (res.status === 401 || res.status === 403) throw new ScanError(502, `${FREE_NAME} rejected the AI key. Check the AI key in Supabase secrets.`);
    if (res.status === 404 || /vision|image|multimodal/i.test(msg)) {
      throw new ScanError(502, `The AI model "${model}" can't read photos. Set the SCAN_MODEL secret to a vision model.`);
    }
    throw new ScanError(502, `${FREE_NAME} could not read the photo (${res.status}). Please try again.`);
  }
  return { data: parse(String(data.choices?.[0]?.message?.content || "")), model: data.model || model };
}

class ScanError extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }

function parse(text: string): Row {
  const s = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  try { return JSON.parse(a >= 0 ? s.slice(a, b + 1) : s); } catch { throw new ScanError(502, "The AI's answer could not be understood. Please try again."); }
}

// ── Tidy the result and check it in code (money and matches are never taken on trust) ─────────────────
const num = (v: unknown, d = 0) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : d; };
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const money = (n: number) => Math.round(n * 100) / 100;

function tidy(raw: Row, products: Product[]): Row {
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 60).map((it: Row) => {
    const written = str(it.written, 120);
    let qty = num(it.qty, 1); if (!(qty > 0)) qty = 1;
    let unit = Math.max(0, num(it.unit_price));
    const line = Math.max(0, num(it.line_total));
    if (!unit && line) unit = money(line / qty);
    let sure = !!it.sure;
    const warnings: string[] = [];
    let p = byId.get(str(it.product_id)) || null;
    const check = bestMatch(written, products);
    if (p) {
      // The model's pick must look like what was written; otherwise prefer a clear match found in code
      if (similarity(written, p.name) < 0.2 && check.p && check.p.id !== p.id && check.score >= 0.5) { p = check.p; sure = false; }
    } else if (check.p && check.score >= 0.6) {
      p = check.p; sure = false; warnings.push("Matched by name — check it is the right product");
    }
    if (!p) { sure = false; warnings.push("No matching product found"); }
    if (unit && line && Math.abs(unit * qty - line) > 0.02) { sure = false; warnings.push(`Written line amount ${line} ≠ ${qty} × ${unit}`); }
    if (!unit && p) { unit = p.price; sure = false; warnings.push("No price written — stock price used"); }
    if (p && p.qty < qty) warnings.push(`Only ${p.qty} in stock`);
    return {
      written, qty, unit_price: money(unit), line_total: money(line || unit * qty),
      product_id: p?.id || "", product_name: p?.name || "", stock_price: p?.price ?? null, sure, warnings,
    };
  });
  const sum = money(items.reduce((a: number, i: Row) => a + i.unit_price * i.qty, 0));
  const discount = Math.max(0, num(raw.discount_amount));
  const total = Math.max(0, num(raw.total_written));
  const paid = num(raw.amount_paid, -1);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(raw.date)) ? str(raw.date) : "";
  const methods = ["Cash", "Mobile Money", "Bank Transfer", "Credit"];
  return {
    is_receipt: raw.is_receipt !== false,
    legibility: ["good", "fair", "poor"].includes(raw.legibility) ? raw.legibility : "fair",
    receipt_no: str(raw.receipt_no, 40),
    date,
    customer_name: str(raw.customer_name, 80),
    customer_phone: str(raw.customer_phone, 30),
    items,
    items_sum: sum,
    discount_amount: money(discount),
    total_written: money(total),
    total_matches: !total || Math.abs(sum - discount - total) <= 0.05,
    amount_paid: paid >= 0 ? money(paid) : null,
    payment_method: methods.includes(raw.payment_method) ? raw.payment_method : "",
    unreadable: (Array.isArray(raw.unreadable) ? raw.unreadable : []).map((x: unknown) => str(x, 120)).filter(Boolean).slice(0, 10),
    notes: str(raw.notes, 300),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!signedIn(req)) return json({ error: "Please sign in again." }, 401);
  if (!PROVIDER) {
    return json({ error: "No AI key is set up. In Supabase → Edge Functions → Secrets, add AI_API_KEY (free Gemini key) or ANTHROPIC_API_KEY.", type: "no_key" }, 500);
  }

  let body: Row = {};
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ""));
  if (!m) return json({ error: "Send the receipt photo as a JPEG, PNG or WebP image." }, 400);
  if (m[2].length > MAX_IMAGE_CHARS) return json({ error: "The photo is too large. Take it again a little further away." }, 413);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || "")) ? String(body.today) : new Date().toISOString().slice(0, 10);

  const auth = req.headers.get("authorization") || "";
  const started = Date.now();
  try {
    const products = await loadProducts(auth);
    const text = prompt(products, today);
    let out: Row;
    if (PROVIDER === "claude") out = await readWithClaude(m[2], m[1], text);
    else {
      try { out = await readWithFree(m[2], m[1], text); } catch (e) {
        // The free provider can't read photos: use Claude when its key is set too
        if (CLAUDE_KEY && e instanceof ScanError && /read photos/.test(e.message)) out = await readWithClaude(m[2], m[1], text);
        else throw e;
      }
    }
    const result = tidy(out.data, products);
    console.log(JSON.stringify({
      event: "scan_receipt", provider: PROVIDER === "claude" ? "Claude" : FREE_NAME, model: out.model, ms: Date.now() - started,
      items: result.items.length, unsure: result.items.filter((i: Row) => !i.sure).length, total_matches: result.total_matches,
    }));
    return json({ ...result, model: out.model });
  } catch (e) {
    const status = e instanceof ScanError ? e.status : (e as { status?: number }).status || 500;
    console.log(JSON.stringify({ event: "scan_receipt_error", provider: PROVIDER, status, message: String((e as Error).message).slice(0, 300) }));
    if (e instanceof ScanError) return json({ error: e.message }, e.status);
    if (status === 401) return json({ error: "Claude rejected the API key. Check ANTHROPIC_API_KEY in Supabase secrets." }, 502);
    if (status === 429) return json({ error: "The AI is busy. Wait a minute and try again." }, 429);
    return json({ error: "The receipt could not be read. Please try again." }, 502);
  }
});
