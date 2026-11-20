// SmartStock Pro — AI proxy (Supabase Edge Function, Deno)
// The Anthropic API key lives only in the Supabase secret ANTHROPIC_API_KEY — never in the app.
// Deploy with JWT verification ON: only signed-in SmartStock users can call this.
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// The platform has already verified the JWT signature (verify_jwt = true).
// The public anon key is also a valid JWT, so additionally require a real signed-in user.
function isSignedInUser(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return false;
  try {
    const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return claims.role === "authenticated" && typeof claims.sub === "string";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isSignedInUser(req)) return json({ error: "Please sign in to use the AI assistant.", type: "not_signed_in" }, 401);

  // Tolerate copy-paste mistakes: surrounding spaces, line breaks or quotes
  const rawKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  const apiKey = rawKey.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  // What kind of value is saved (never the value itself) — for clear error messages
  const keyKind = apiKey.startsWith("sk-ant-api") ? "api"
    : apiKey.startsWith("sk-ant-admin") ? "admin"
    : apiKey.startsWith("sk-ant-oat") ? "oauth"
    : "other";
  if (!apiKey) {
    return json({ error: "The AI service is not set up yet: ANTHROPIC_API_KEY is missing in Supabase.", type: "not_configured" }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const { prompt, messages, system, mode } = body as Record<string, unknown>;

  let finalMessages: Anthropic.Beta.BetaMessageParam[];
  if (Array.isArray(messages) && messages.length) {
    finalMessages = (messages as Anthropic.Beta.BetaMessageParam[]).slice(-20);
  } else if (typeof prompt === "string" && prompt) {
    finalMessages = [{ role: "user", content: prompt }];
  } else {
    return json({ error: "Missing prompt or messages", type: "bad_request" }, 400);
  }

  const isReport = mode === "report";
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      // thinking is always on for this model and counts toward max_tokens, so leave room
      max_tokens: isReport ? 12000 : 4000,
      output_config: { effort: isReport ? "medium" : "low" },
      system: typeof system === "string" && system ? system.slice(0, 120000) : undefined,
      messages: finalMessages,
      // If a safety classifier declines, let the API retry on a suitable fallback model
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "The AI declined to answer this request. Try rephrasing it.", type: "refusal" }, 200);
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return json({ error: "The AI returned an empty answer. Please try again.", type: "empty" }, 502);

    // Same shape the app already reads: data.content[0].text
    return json({
      content: [{ type: "text", text }],
      truncated: response.stop_reason === "max_tokens",
      model: response.model,
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      // Diagnostics only — kind and length, never the key
      console.log(JSON.stringify({ event: "anthropic_auth_failed", keyKind, keyLength: apiKey.length, cleanedPaste: rawKey !== apiKey }));
      const hint = keyKind === "admin"
        ? " The saved value is an Admin key (starts with sk-ant-admin). Admin keys can't be used for chat: create a normal key under API Keys (it starts with sk-ant-api)."
        : keyKind === "oauth"
        ? " The saved value is a Claude subscription token (starts with sk-ant-oat), not an API key. Create a key under API Keys at console.anthropic.com (it starts with sk-ant-api)."
        : keyKind === "other"
        ? " The saved value doesn't look like an Anthropic API key — it should start with sk-ant-api. Copy the whole key again."
        : " The key looks correct in format but Anthropic rejected it: it may have been deleted or disabled, or copied incompletely. Create a new key and save it again.";
      return json({ error: "The Anthropic API key saved in Supabase was rejected." + hint, type: "invalid_api_key", key_kind: keyKind }, 502);
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      return json({ error: "The Anthropic account doesn't have access to this model or has run out of credit. Check Plans & Billing at console.anthropic.com.", type: "permission_denied" }, 502);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: "The AI is busy right now. Please wait a minute and try again.", type: "rate_limited" }, 429);
    }
    if (error instanceof Anthropic.BadRequestError) {
      // e.g. "Your credit balance is too low…" — Anthropic's own wording is clear enough to show
      return json({ error: "The AI could not process this request: " + error.message, type: "bad_request" }, 400);
    }
    if (error instanceof Anthropic.APIError) {
      return json({ error: "The AI service had a problem (" + error.status + "). Please try again shortly.", type: "upstream_error" }, 502);
    }
    return json({ error: "The AI service could not be reached. Please try again.", type: "network" }, 502);
  }
});
