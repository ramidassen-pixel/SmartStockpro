#!/usr/bin/env node
// SmartStock AI — test runner.
// Asks the AI agent every question in questions.json and grades the answer against expected.json
// (made by answer_key.sql on the same day).
//
// Sign in with ONE of:
//   SSP_TOKEN=<access token>                      (from a signed-in app session)
//   SSP_EMAIL=<email>  SSP_PASSWORD=<password>    (the script signs in for you)
//
// Usage:
//   node ai-eval/run.mjs                    all questions
//   node ai-eval/run.mjs --only q01,q07     some questions
//   node ai-eval/run.mjs --delay 6000       wait between questions (free AI limits; default 4000 ms)
//   node ai-eval/run.mjs --endpoint ai-agent-v2   test a different edge function
//
// Writes ai-eval/results/run-<time>.json and ai-eval/results/latest.md

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// ── Settings ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : d; };
const only = opt("only", "") ? opt("only").split(",").map((s) => s.trim()) : null;
const delay = Number(opt("delay", 4000));
const endpoint = opt("endpoint", "ai-agent");

const platform = readFileSync(join(root, "assets/js/platform.js"), "utf8");
const SUPABASE_URL = process.env.SSP_URL || (platform.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const SUPABASE_ANON = (platform.match(/SUPABASE_ANON\s*=\s*'([^']+)'/) || [])[1];
if (!SUPABASE_URL || !SUPABASE_ANON) die("Could not read SUPABASE_URL / SUPABASE_ANON from assets/js/platform.js");

const expectedPath = join(here, "expected.json");
if (!existsSync(expectedPath)) die("ai-eval/expected.json is missing. Run ai-eval/answer_key.sql in the Supabase SQL editor and save its result there.");
const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
const questions = JSON.parse(readFileSync(join(here, "questions.json"), "utf8")).questions
  .filter((q) => !only || only.includes(q.id));

const today = new Date().toISOString().slice(0, 10);
if (expected.generated_on && expected.generated_on !== today) {
  console.warn(`⚠  expected.json was made on ${expected.generated_on}, today is ${today}. Answers about "today", "this month" or "last week" may not match. Re-run answer_key.sql first.\n`);
}

function die(msg) { console.error("✖ " + msg); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Sign in ─────────────────────────────────────────────────────────────────
async function token() {
  if (process.env.SSP_TOKEN) return process.env.SSP_TOKEN.trim();
  const email = process.env.SSP_EMAIL, password = process.env.SSP_PASSWORD;
  if (!email || !password) die("Set SSP_TOKEN, or SSP_EMAIL and SSP_PASSWORD, before running.");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) die("Sign-in failed: " + (body.error_description || body.msg || res.status));
  return body.access_token;
}

// ── Ask the agent ───────────────────────────────────────────────────────────
async function ask(auth, text) {
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 429 && attempt === 0) { console.log("   (AI limit reached — waiting 60 s and trying once more)"); await sleep(60000); continue; }
    const answer = body.content?.[0]?.text || "";
    return { ok: res.ok && !!answer, status: res.status, answer, error: body.error, tools: body.tools_used || [], model: body.model, ms: Date.now() - started };
  }
}

// ── Grading ─────────────────────────────────────────────────────────────────
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();

// All numbers in the answer. "1.2k" / "1.06 million" are expanded and marked as rounded.
function numbersIn(text) {
  const out = [];
  const re = /(-?\d[\d,]*(?:\.\d+)?)\s*(k|thousand|m|million|mn)?\b/gi;
  for (const m of text.matchAll(re)) {
    let v = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(v)) continue;
    const unit = (m[2] || "").toLowerCase();
    if (unit === "k" || unit === "thousand") v *= 1e3;
    if (unit === "m" || unit === "million" || unit === "mn") v *= 1e6;
    out.push({ v, rounded: !!unit });
  }
  return out;
}

const NOTHING = /\b(no|zero|none|nothing|not any|haven't|have not|didn't|did not)\b/i;

function numberFound(n, found, text) {
  if (n === 0 && NOTHING.test(text)) return true;
  return found.some(({ v, rounded }) => {
    if (Number.isInteger(n) && Math.abs(n) < 10000 && !rounded) return v === n || Math.abs(v - n) < 0.006;
    const tol = rounded ? Math.abs(n) * 0.01 : Math.max(0.011, Math.abs(n) * 0.001, Math.abs(n) >= 100 ? 0.5 : 0);
    return Math.abs(v - n) <= tol;
  });
}

function grade(q, key, answer) {
  const text = answer || "";
  const t = norm(text);
  const found = numbersIn(text);
  const checks = [];
  const k = key || {};
  const hasKey = (k.numbers && k.numbers.length) || (k.names_all && k.names_all.length) || (k.names_any && k.names_any.length);

  if (k.numbers?.length) for (const n of k.numbers) checks.push({ what: `number ${n}`, pass: numberFound(Number(n), found, text) });
  if (k.names_all?.length) for (const n of k.names_all) checks.push({ what: `name "${n}"`, pass: t.includes(norm(n)) });
  if (k.names_any?.length) checks.push({ what: `one of ${k.names_any.slice(0, 4).map((x) => `"${x}"`).join(", ")}…`, pass: k.names_any.some((n) => t.includes(norm(n))) });
  // Questions whose honest answer is "none / can't": look for the expected wording
  if (!hasKey && q.keywords_any?.length) checks.push({ what: `says one of ${q.keywords_any.slice(0, 4).map((x) => `"${x}"`).join(", ")}…`, pass: q.keywords_any.some((w) => t.includes(norm(w))), soft: true });
  // Profit questions must warn that the cost of goods is not fully known
  if (q.id === "q20") checks.push({ what: "warns cost of goods is unknown", pass: /\b(cost of goods|cogs|item|product cost|cost price|estimate)/i.test(text) });

  if (!checks.length) return { result: "REVIEW", checks };
  const pass = checks.every((c) => c.pass);
  return { result: pass ? (checks.some((c) => c.soft) ? "PASS*" : "PASS") : "FAIL", checks };
}

// ── Run ─────────────────────────────────────────────────────────────────────
const fill = (s) => s.replace(/\{(\w+)\}/g, (_, v) => expected.vars?.[v] ?? `{${v}}`);

const auth = await token();
console.log(`Testing ${endpoint} with ${questions.length} questions (business ${expected.business_id}, key from ${expected.generated_on})\n`);
const results = [];
for (const [i, q] of questions.entries()) {
  const text = fill(q.question);
  const r = await ask(auth, text);
  const g = r.ok ? grade(q, expected.answers?.[q.id], r.answer) : { result: "ERROR", checks: [] };
  results.push({ id: q.id, category: q.category, question: text, ...g, answer: r.answer, error: r.error, status: r.status, tools: r.tools, model: r.model, ms: r.ms });
  const icon = { PASS: "✔", "PASS*": "✔", FAIL: "✖", ERROR: "!", REVIEW: "?" }[g.result];
  console.log(`${icon} ${q.id} ${g.result.padEnd(6)} ${(r.ms / 1000).toFixed(1)}s  ${text}`);
  if (g.result === "FAIL") g.checks.filter((c) => !c.pass).forEach((c) => console.log(`        missing ${c.what}`));
  if (g.result === "ERROR") console.log(`        ${r.status} ${r.error || "empty answer"}`);
  if (i < questions.length - 1) await sleep(delay);
}

// ── Report ──────────────────────────────────────────────────────────────────
const count = (f) => results.filter(f).length;
const passed = count((r) => r.result.startsWith("PASS"));
const graded = count((r) => r.result !== "REVIEW");
const byCat = {};
for (const r of results) {
  const c = (byCat[r.category] ||= { pass: 0, total: 0 });
  if (r.result !== "REVIEW") { c.total++; if (r.result.startsWith("PASS")) c.pass++; }
}
const score = graded ? Math.round((passed / graded) * 100) : 0;
console.log(`\nScore: ${passed}/${graded} (${score}%)  — errors: ${count((r) => r.result === "ERROR")}, to review by hand: ${count((r) => r.result === "REVIEW")}`);

const dir = join(here, "results");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
writeFileSync(join(dir, `run-${stamp}.json`), JSON.stringify({ endpoint, ran_at: new Date().toISOString(), key_date: expected.generated_on, score, passed, graded, results }, null, 2));

const esc = (s) => String(s || "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
const md = [
  `# AI agent test — ${endpoint}`,
  ``,
  `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · answer key from ${expected.generated_on} · model ${results.find((r) => r.model)?.model || "?"}`,
  ``,
  `**Score: ${passed}/${graded} (${score}%)**  ·  PASS* = passed on wording only, worth a quick read`,
  ``,
  `| Category | Passed |`, `|---|---|`,
  ...Object.entries(byCat).map(([c, v]) => `| ${c} | ${v.pass}/${v.total} |`),
  ``,
  `| # | Result | Question | What was missing | Answer (start) |`, `|---|---|---|---|---|`,
  ...results.map((r) => `| ${r.id} | ${r.result} | ${esc(r.question)} | ${esc(r.checks.filter((c) => !c.pass).map((c) => c.what).join("; ") || r.error || "")} | ${esc((r.answer || "").slice(0, 160))} |`),
  ``,
].join("\n");
writeFileSync(join(dir, "latest.md"), md);
console.log(`Report: ai-eval/results/latest.md`);
