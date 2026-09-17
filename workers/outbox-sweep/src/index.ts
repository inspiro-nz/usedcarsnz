/**
 * Outbox-sweep Cron Worker (Prompt 7).
 *
 * Standalone scheduler that POSTs the app's protected /api/cron/outbox-sweep
 * endpoint on a schedule to drain the ack retry queue (email_outbox). It lives
 * in its own Worker because the OpenNext app worker exports only `fetch` — a
 * cron trigger there would fire into a void. Mirrors workers/keepalive.
 *
 * The real work (Resend send + ack_sent emission) stays in the app, behind a
 * shared CRON_SECRET. If the target app is behind Cloudflare Access, set the
 * Access service-token secrets too and they are sent as headers.
 *
 * Secrets (never in wrangler.jsonc): CRON_SECRET, and optionally
 * CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET. Set with `wrangler secret put`.
 */
export interface Env {
  TARGET_URL: string; // var: the /api/cron/outbox-sweep URL
  CRON_SECRET: string; // secret: shared with the app endpoint
  CF_ACCESS_CLIENT_ID?: string; // secret: only if the target is behind Access
  CF_ACCESS_CLIENT_SECRET?: string; // secret: only if the target is behind Access
}

async function trigger(env: Env): Promise<number> {
  if (!env.TARGET_URL || !env.CRON_SECRET) {
    console.error("outbox-sweep: TARGET_URL / CRON_SECRET not configured");
    return 500;
  }
  const headers: Record<string, string> = {
    authorization: `Bearer ${env.CRON_SECRET}`,
    "content-type": "application/json",
  };
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }
  const res = await fetch(env.TARGET_URL, { method: "POST", headers });
  // Log status only — never the secret or response body.
  console.log(`outbox-sweep: POST ${env.TARGET_URL} -> ${res.status}`);
  return res.status;
}

const handler = {
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(trigger(env));
  },
  async fetch(_req: Request, env: Env): Promise<Response> {
    const status = await trigger(env);
    const ok = status > 0 && status < 400;
    return new Response(`outbox-sweep -> ${status}\n`, { status: ok ? 200 : 502 });
  },
};

export default handler;
