import "server-only";

import { headers } from "next/headers";

/**
 * Abuse protection for public marketplace forms (enquiries, dealer signup).
 *
 * This deliberately mirrors the pattern already shipped in app/api/lead/route.ts
 * — honeypot field + in-memory IP rate limiting — so the new public write
 * surfaces carry the same posture as the landing page's form. The original
 * route is untouched; this module extends the pattern, it does not replace it.
 *
 * Same known limitation as the original: the in-memory store resets on cold
 * start. Upgrade path is Cloudflare KV (see docs/form-security.md).
 */

const stores = new Map<string, Map<string, number[]>>();

export interface RateLimitRule {
  /** Distinct bucket, e.g. "enquiry" | "dealer-register". */
  scope: string;
  windowMs: number;
  max: number;
}

/** Client IP from the same header chain the /api/lead route trusts. */
export async function getClientIP(): Promise<string> {
  const h = await headers();
  const cfConnectingIp = h.get("cf-connecting-ip");
  const xForwardedFor = h.get("x-forwarded-for");
  const xRealIp = h.get("x-real-ip");
  return (
    cfConnectingIp || xForwardedFor?.split(",")[0]?.trim() || xRealIp || "127.0.0.1"
  );
}

/** True if this IP is still within the rule's allowance (and records the hit). */
export function checkRateLimit(ip: string, rule: RateLimitRule): boolean {
  let store = stores.get(rule.scope);
  if (!store) {
    store = new Map();
    stores.set(rule.scope, store);
  }
  const now = Date.now();
  const valid = (store.get(ip) ?? []).filter((ts) => now - ts < rule.windowMs);
  if (valid.length >= rule.max) return false;
  valid.push(now);
  store.set(ip, valid);
  return true;
}

/**
 * Honeypot check — same field name and semantics as the landing form: a
 * populated "website" field means a bot. Callers should silently succeed.
 */
export function honeypotTripped(value: FormDataEntryValue | null): boolean {
  return Boolean(value && String(value).trim().length > 0);
}
