import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * Cloudflare Turnstile verification for POST /api/enquiries.
 *
 * lib/security.ts is frozen (invariant 2) and has no Turnstile export — the
 * only existing implementation is inline in the frozen app/api/lead/route.ts.
 * This module is a new, shared home for the same verification call so
 * /api/enquiries doesn't reimplement it inline; it deliberately does not
 * touch lib/security.ts or the landing route.
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const env = getServerEnv();
  if (!env.TURNSTILE_SECRET_KEY) {
    console.error("TURNSTILE_SECRET_KEY not configured");
    return false;
  }
  if (!token) return false;

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    const data = (await response.json()) as { success: boolean; error_codes?: string[] };
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}
