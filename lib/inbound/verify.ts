/**
 * Verifies the HMAC-SHA256 signature the email-inbound Worker attaches to its
 * POST /api/inbound/email request. Pure and dependency-free (Web Crypto only),
 * so it runs unchanged under the Workers runtime and under Node in tests.
 *
 * Scheme (must match workers/email-inbound/src/sign.ts):
 *   - The Worker signs the string  `${unixSeconds}.${rawJsonBody}`.
 *   - It sends the exact same rawJsonBody as the request body, plus:
 *       X-UsedCarsNZ-Timestamp: <unixSeconds>
 *       X-UsedCarsNZ-Signature: sha256=<lowercase hex>
 *   - We recompute over the RAW body bytes we received (never a re-serialised
 *     object) so there is no canonicalisation to disagree about, and compare
 *     via crypto.subtle.verify (constant-time).
 *
 * Binding the timestamp INTO the signed string means a captured request can't
 * be replayed with a fresh timestamp header — the signature would no longer
 * match. Stale timestamps are additionally rejected outright.
 */

export const INBOUND_SIGNATURE_HEADER = "x-usedcarsnz-signature";
export const INBOUND_TIMESTAMP_HEADER = "x-usedcarsnz-timestamp";
export const DEFAULT_MAX_SKEW_SECONDS = 300;

export interface VerifyInput {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  secret: string;
  /** Current time in ms; injectable for deterministic tests. Defaults to Date.now(). */
  now?: number;
  maxSkewSeconds?: number;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function verifyInboundSignature(input: VerifyInput): Promise<VerifyResult> {
  const { rawBody, signatureHeader, timestampHeader, secret } = input;
  if (!secret) return { ok: false, reason: "server_secret_unset" };
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };
  if (!timestampHeader) return { ok: false, reason: "missing_timestamp" };

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || !Number.isInteger(ts)) return { ok: false, reason: "bad_timestamp" };

  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  const maxSkew = input.maxSkewSeconds ?? DEFAULT_MAX_SKEW_SECONDS;
  if (Math.abs(nowSeconds - ts) > maxSkew) return { ok: false, reason: "stale_timestamp" };

  const match = /^sha256=([0-9a-f]+)$/i.exec(signatureHeader.trim());
  if (!match) return { ok: false, reason: "bad_signature_format" };
  const sigBytes = hexToBytes(match[1]);
  if (!sigBytes || sigBytes.length !== 32) return { ok: false, reason: "bad_signature_format" };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // sigBytes is a fresh 32-byte view (built in hexToBytes), so it's already a
  // clean BufferSource — pass it straight in.
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(`${ts}.${rawBody}`));
  return valid ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}
