/**
 * HMAC-SHA256 request signing. The verification side is lib/inbound/verify.ts —
 * the scheme is documented there. In one line: we sign `${unixSeconds}.${body}`
 * and send the timestamp + `sha256=<hex>` as headers alongside the exact body
 * bytes we signed. Web Crypto only, so it runs on the Workers runtime.
 */
export const SIGNATURE_HEADER = "X-UsedCarsNZ-Signature";
export const TIMESTAMP_HEADER = "X-UsedCarsNZ-Timestamp";

function bytesToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export interface SignedRequest {
  body: string;
  headers: Record<string, string>;
}

export async function signPayload(
  body: string,
  secret: string,
  nowMs: number = Date.now(),
): Promise<SignedRequest> {
  const timestamp = Math.floor(nowMs / 1000).toString();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${body}`));
  return {
    body,
    headers: {
      "Content-Type": "application/json",
      [TIMESTAMP_HEADER]: timestamp,
      [SIGNATURE_HEADER]: `sha256=${bytesToHex(sig)}`,
    },
  };
}
