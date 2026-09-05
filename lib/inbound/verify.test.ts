import { describe, it, expect } from "vitest";
import { verifyInboundSignature } from "@/lib/inbound/verify";
import { signPayload, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "../../workers/email-inbound/src/sign";

const SECRET = "shared-secret";
const NOW = 1_800_000_000_000;

async function sign(body: string, nowMs = NOW) {
  const s = await signPayload(body, SECRET, nowMs);
  return {
    signatureHeader: s.headers[SIGNATURE_HEADER],
    timestampHeader: s.headers[TIMESTAMP_HEADER],
    body: s.body,
  };
}

describe("verifyInboundSignature", () => {
  it("accepts a correctly signed request", async () => {
    const s = await sign('{"hello":"world"}');
    const r = await verifyInboundSignature({
      rawBody: s.body,
      signatureHeader: s.signatureHeader,
      timestampHeader: s.timestampHeader,
      secret: SECRET,
      now: NOW,
    });
    expect(r).toEqual({ ok: true });
  });

  it("rejects a tampered body (signature mismatch)", async () => {
    const s = await sign('{"amount":18000}');
    const r = await verifyInboundSignature({
      rawBody: '{"amount":1}',
      signatureHeader: s.signatureHeader,
      timestampHeader: s.timestampHeader,
      secret: SECRET,
      now: NOW,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a stale timestamp beyond the skew window", async () => {
    const s = await sign('{"a":1}', NOW - 10 * 60 * 1000); // signed 10 min ago
    const r = await verifyInboundSignature({
      rawBody: s.body,
      signatureHeader: s.signatureHeader,
      timestampHeader: s.timestampHeader,
      secret: SECRET,
      now: NOW,
      maxSkewSeconds: 300,
    });
    expect(r).toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("resists replay: reusing an old signature with a fresh timestamp header fails", async () => {
    const s = await sign('{"a":1}', NOW - 60 * 1000);
    const freshTs = Math.floor(NOW / 1000).toString();
    const r = await verifyInboundSignature({
      rawBody: s.body,
      signatureHeader: s.signatureHeader, // signed over the OLD ts
      timestampHeader: freshTs, // attacker swaps in a current ts
      secret: SECRET,
      now: NOW,
    });
    expect(r.ok).toBe(false); // ts is bound into the signature, so it won't match
  });

  it("rejects when the shared secret is unset (fail closed)", async () => {
    const s = await sign("{}");
    const r = await verifyInboundSignature({
      rawBody: s.body,
      signatureHeader: s.signatureHeader,
      timestampHeader: s.timestampHeader,
      secret: "",
      now: NOW,
    });
    expect(r).toEqual({ ok: false, reason: "server_secret_unset" });
  });

  it("rejects missing / malformed headers", async () => {
    const base = { rawBody: "{}", secret: SECRET, now: NOW };
    expect(await verifyInboundSignature({ ...base, signatureHeader: null, timestampHeader: "1" }))
      .toEqual({ ok: false, reason: "missing_signature" });
    expect(await verifyInboundSignature({ ...base, signatureHeader: "sha256=ab", timestampHeader: null }))
      .toEqual({ ok: false, reason: "missing_timestamp" });
    expect(
      await verifyInboundSignature({ ...base, signatureHeader: "not-a-sig", timestampHeader: "1", maxSkewSeconds: 1e12 }),
    ).toEqual({ ok: false, reason: "bad_signature_format" });
  });
});
