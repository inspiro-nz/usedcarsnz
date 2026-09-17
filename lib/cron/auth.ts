import "server-only";

/**
 * Shared auth for the /api/cron/* maintenance endpoints.
 *
 * These endpoints do privileged backend work (draining the ack outbox, purging
 * old raw MIME). They are triggered by standalone Cron Workers (workers/*), NOT
 * by the app worker, which has no scheduled handler. The Worker holds a shared
 * CRON_SECRET and sends it as `Authorization: Bearer <secret>`; the endpoint
 * verifies it and FAILS CLOSED (503) if the secret is unset — it never runs the
 * maintenance work for an unauthenticated caller.
 */

/** Constant-time string compare (Workers-safe; no node:crypto). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function verifyCronRequest(req: Request): CronAuthResult {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return { ok: false, status: 503, error: "CRON_SECRET not configured" };

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !timingSafeEqual(token, secret)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}
