/**
 * Demo keep-alive Worker (Prompt 7).
 *
 * The demo Supabase project is on the FREE tier, which pauses after 7 days of no
 * activity. This standalone Worker runs on a daily Cron Trigger (see
 * wrangler.jsonc) and inserts one row into public.keepalive_ping via the demo
 * project's PostgREST endpoint. Any write resets the 7-day inactivity timer, so
 * the demo is never paused when a dealer meeting starts.
 *
 * It is deployed SEPARATELY from the Next.js app Worker because the OpenNext-
 * generated app worker exports only a `fetch` handler (no `scheduled`), so a cron
 * on that worker would fire into a void. This mirrors workers/email-inbound.
 *
 * Secrets: SUPABASE_SECRET_KEY is a SECRET (never in wrangler.jsonc); set it with
 *   wrangler secret put SUPABASE_SECRET_KEY   (run in this directory).
 * SUPABASE_URL is non-secret config (the demo project's REST base URL).
 */
export interface Env {
  // The demo Supabase project base URL, e.g. https://<demo-ref>.supabase.co
  SUPABASE_URL: string;
  // The demo project's service (secret) key — bypasses RLS to write the ping.
  SUPABASE_SECRET_KEY: string;
}

async function ping(env: Env): Promise<number> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    // Fail loud in logs but never print the key itself.
    console.error("keepalive: SUPABASE_URL / SUPABASE_SECRET_KEY not configured");
    return 500;
  }
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/keepalive_ping`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      "content-type": "application/json",
      // Don't ask PostgREST to return the row — we only need the timer reset.
      prefer: "return=minimal",
    },
    body: JSON.stringify({ source: "cron" }),
  });
  // Log only the status code — never the key or response body.
  console.log(`keepalive: insert keepalive_ping -> ${res.status}`);
  return res.status;
}

const handler = {
  // Daily Cron Trigger — the whole point of this Worker.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(ping(env));
  },

  // Manual trigger for the 'verify the wall' smoke test in the runbook. Returns
  // the PostgREST status so the founder can confirm the wiring without waiting a
  // day for the cron. No auth here: the Worker holds no reusable secret in its
  // response, and it is only reachable at its workers.dev URL / a private route.
  async fetch(_req: Request, env: Env): Promise<Response> {
    const status = await ping(env);
    const ok = status > 0 && status < 400;
    return new Response(`keepalive ping -> ${status}\n`, { status: ok ? 200 : 502 });
  },
};

export default handler;
