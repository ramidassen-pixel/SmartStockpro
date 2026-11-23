// admin-data — platform-owner reads (and support-ticket updates) for the Admin page
// and the Support Center admin view.
//
// Access: the caller must be signed in AND listed in public.platform_admins
// (checked with the database function is_platform_admin() using the caller's
// own token). The old owner PIN is no longer accepted: it was visible in the
// app's public code.
//
// Allowed: read platform_* and support_* tables; update support_tickets only.
// "ping" (update your own last-seen time) stays open to any app instance.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const READ_TABLES = new Set([
  'platform_businesses', 'platform_users', 'platform_activity',
  'support_tickets', 'support_messages',
]);
const UPDATE_TABLES = new Set(['support_tickets']);
const TICKET_FIELDS = new Set(['status', 'priority', 'updated_at']);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function svcHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
}

// Only simple PostgREST filters: column=op.value pairs plus order/limit
function safeFilter(f: unknown): string | null {
  if (f == null || f === '') return '';
  if (typeof f !== 'string' || f.length > 300) return null;
  for (const part of f.split('&')) {
    if (!/^(order|limit|offset|[a-z_]+)=[^&]*$/.test(part)) return null;
    if (/^select=/.test(part)) return null;
  }
  return f;
}

async function isPlatformAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+\.\S+\.\S+$/.test(auth)) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_platform_admin`, {
    method: 'POST',
    headers: { apikey: ANON_KEY || SERVICE_ROLE_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) return false;
  return (await r.json().catch(() => false)) === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Server not configured' }, 500);
    const body = await req.json().catch(() => ({}));
    const { action, table, filter, data } = body ?? {};

    // Heartbeat: update one id's last-seen time, nothing else
    if (action === 'ping') {
      const { userId, bizId } = body;
      const tasks: Promise<unknown>[] = [];
      if (typeof userId === 'string' && userId) {
        tasks.push(fetch(`${SUPABASE_URL}/rest/v1/platform_users?id=eq.${encodeURIComponent(userId)}`, {
          method: 'PATCH', headers: svcHeaders(), body: JSON.stringify({ last_login_at: new Date().toISOString() }),
        }));
      }
      if (typeof bizId === 'string' && bizId) {
        tasks.push(fetch(`${SUPABASE_URL}/rest/v1/platform_businesses?id=eq.${encodeURIComponent(bizId)}`, {
          method: 'PATCH', headers: svcHeaders(), body: JSON.stringify({ last_active_at: new Date().toISOString() }),
        }));
      }
      await Promise.allSettled(tasks);
      return json({ ok: true });
    }

    if (!(await isPlatformAdmin(req))) return json({ error: 'Unauthorized' }, 401);

    const f = safeFilter(filter);
    if (f === null) return json({ error: 'Filter not allowed' }, 400);

    if (action === 'select') {
      if (!READ_TABLES.has(table)) return json({ error: 'Table not allowed' }, 400);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*${f ? '&' + f : ''}`, { headers: svcHeaders() });
      return json(await res.json(), res.status);
    }

    if (action === 'update') {
      if (!UPDATE_TABLES.has(table)) return json({ error: 'Table not allowed' }, 400);
      if (!f || !/^id=eq\./.test(f) || f.includes('&')) return json({ error: 'Update one ticket by id' }, 400);
      if (!data || typeof data !== 'object') return json({ error: 'Missing data' }, 400);
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) if (TICKET_FIELDS.has(k)) clean[k] = v;
      if (!Object.keys(clean).length) return json({ error: 'Nothing to update' }, 400);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${f}`, {
        method: 'PATCH', headers: { ...svcHeaders(), Prefer: 'return=representation' }, body: JSON.stringify(clean),
      });
      return json(await res.json(), res.status);
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
