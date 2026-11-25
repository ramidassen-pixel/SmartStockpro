// send-email — app notification emails, sent through the Brevo email API.
//
// Only two emails can be sent, and the server decides who gets them and what
// they say (the app can no longer pass its own "to" address or HTML):
//   { type: 'approved', userId }  → tells a staff member their account was
//      approved. The caller must be an active primary_admin of that staff
//      member's business.
//   { type: 'support', ticketId } → tells the platform owner about a new
//      support ticket. The ticket must belong to the caller and be under
//      15 minutes old.
//
// The caller must be signed in (Bearer user token).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   BREVO_API_KEY  — Brevo → SMTP & API → API Keys
//   SENDER_EMAIL   — the sender address verified in Brevo
//   SUPPORT_EMAIL  — where new-ticket alerts go (defaults to SENDER_EMAIL)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || '';
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || '';
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || SENDER_EMAIL;
const APP_URL = 'https://ramidassen-pixel.github.io/SmartStockpro/';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const svc = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

async function one(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: svc });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+\.\S+\.\S+$/.test(auth)) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY || SERVICE_ROLE_KEY, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && typeof u.id === 'string' ? u.id : null;
}

function frame(icon: string, color: string, title: string, inner: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#0a0d1c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:0 auto;padding:20px"><div style="background:#111525;border:1px solid rgba(212,168,67,.2);border-radius:20px;overflow:hidden">
<div style="background:linear-gradient(135deg,#0d1a2e,#060b14);padding:28px 24px;text-align:center"><div style="font-size:44px;margin-bottom:8px">${icon}</div>
<div style="color:${color};font-size:18px;font-weight:800;letter-spacing:.15em">SmartStock Pro</div></div>
<div style="padding:28px 24px;color:#c9d0e4;font-size:14px;line-height:1.6"><h1 style="font-size:21px;color:#f0f3ff;margin:0 0 12px;text-align:center">${title}</h1>${inner}</div>
<div style="padding:14px 24px;text-align:center;border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:#424e6a">SmartStock Pro &mdash; Monrovia, Liberia</div>
</div></div></body></html>`;
}

async function brevo(to: string, toName: string, subject: string, html: string, replyTo?: string) {
  const body: Record<string, unknown> = {
    sender: { name: 'SmartStock Pro', email: SENDER_EMAIL },
    to: [{ email: to, name: toName || undefined }],
    subject,
    htmlContent: html,
  };
  if (replyTo) body.replyTo = { email: replyTo };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) console.error('Brevo error', r.status, JSON.stringify(data));
  return r.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Server not configured', sent: false }, 500);
    const uid = await callerId(req);
    if (!uid) return json({ error: 'Sign in required', sent: false }, 401);
    if (!BREVO_API_KEY || !SENDER_EMAIL) return json({ error: 'Email service not configured', sent: false }, 503);

    const body = await req.json().catch(() => ({}));
    const type = body?.type;

    if (type === 'approved') {
      const userId = typeof body.userId === 'string' ? body.userId : '';
      if (!userId) return json({ error: 'Missing userId', sent: false }, 400);
      const target = await one(`platform_users?id=eq.${encodeURIComponent(userId)}&select=name,email,business_id,status`);
      if (!target || !target.email || target.status !== 'active') return json({ error: 'User not found or not active', sent: false }, 404);
      const admin = await one(`platform_users?id=eq.${encodeURIComponent(uid)}&business_id=eq.${encodeURIComponent(target.business_id)}&role=eq.primary_admin&status=eq.active&select=id`);
      if (!admin) return json({ error: 'Not allowed', sent: false }, 403);
      const biz = await one(`platform_businesses?id=eq.${encodeURIComponent(target.business_id)}&select=name`);
      const bizName = (biz && biz.name) || 'SmartStock Pro';
      const html = frame('✅', '#0FD47D', 'Account Approved!',
        `<p style="text-align:center">Hello <strong style="color:#f0f3ff">${esc(target.name || 'there')}</strong>, your account for <strong style="color:#0FD47D">${esc(bizName)}</strong> has been approved. You can now sign in.</p>
<p style="text-align:center;margin:24px 0 4px"><a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#F0C866,#8C6A18);color:#07080D;font-weight:800;padding:15px 34px;border-radius:12px;text-decoration:none">Open SmartStock Pro →</a></p>`);
      const ok = await brevo(target.email, target.name || '', 'Your SmartStock Pro account has been approved', html);
      return json({ success: ok, sent: ok }, ok ? 200 : 502);
    }

    if (type === 'support') {
      const ticketId = typeof body.ticketId === 'string' ? body.ticketId : '';
      if (!ticketId) return json({ error: 'Missing ticketId', sent: false }, 400);
      const t = await one(`support_tickets?id=eq.${encodeURIComponent(ticketId)}&user_id=eq.${encodeURIComponent(uid)}&select=*`);
      if (!t) return json({ error: 'Ticket not found', sent: false }, 404);
      if (Date.now() - new Date(t.created_at).getTime() > 15 * 60 * 1000) return json({ error: 'Ticket too old', sent: false }, 409);
      const row = (k: string, v: unknown) => `<tr><td style="padding:4px 10px 4px 0;color:#7e8ba8;white-space:nowrap">${k}</td><td style="padding:4px 0;color:#f0f3ff">${esc(v)}</td></tr>`;
      const html = frame('🎫', '#D4A843', 'New Support Ticket',
        `<table style="font-size:14px;border-collapse:collapse;margin:0 auto 16px">${row('Ticket', t.ticket_number)}${row('From', `${t.user_name || ''}${t.user_email ? ' (' + t.user_email + ')' : ''}`)}${row('Business', t.business_name)}${row('Category', t.category)}${row('Priority', t.priority)}${row('Subject', t.subject)}</table>
<div style="background:#0b0f1c;border-radius:12px;padding:14px;white-space:pre-wrap;color:#f0f3ff">${esc(String(t.message || '').slice(0, 4000))}</div>`);
      const subject = `[SmartStock Support] ${t.ticket_number}: ${String(t.subject || '').slice(0, 120)}`;
      const replyTo = typeof t.user_email === 'string' && t.user_email.includes('@') ? t.user_email : undefined;
      const ok = await brevo(SUPPORT_EMAIL, 'SmartStock Support', subject, html, replyTo);
      return json({ success: ok, sent: ok }, ok ? 200 : 502);
    }

    return json({ error: 'Unknown email type', sent: false }, 400);
  } catch (err) {
    console.error('send-email error', (err as Error).message);
    return json({ error: 'Server error', sent: false }, 500);
  }
});
