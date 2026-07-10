import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildAction, type Env } from "../src/index";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from "../src/sign";
import { verifyInboundSignature } from "@/lib/inbound/verify";

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
}

const ENV: Env = {
  INBOUND_HMAC_SECRET: "shared-secret-for-tests",
  APP_INBOUND_URL: "http://localhost/api/inbound/email",
  FOUNDER_FORWARD_ADDRESS: "founder@example.com",
};
const NOW = 1_800_000_000_000; // fixed ms for deterministic signatures

const LEAD_RCPT = "lead-addington-autos@usedcarsnz.co.nz";

describe("buildAction — routing", () => {
  it("forwards non-lead recipients to the founder", async () => {
    const action = await buildAction(fixture("generic.eml"), "hello@usedcarsnz.co.nz", ENV, NOW);
    expect(action.kind).toBe("forward");
  });

  it("forwards a Gmail forwarding-confirmation instead of creating a lead", async () => {
    const action = await buildAction(fixture("forwarding-confirmation.eml"), LEAD_RCPT, ENV, NOW);
    expect(action.kind).toBe("forward");
    if (action.kind === "forward") expect(action.reason).toMatch(/forwarding/i);
  });
});

describe("buildAction — Trade Me lead payload + signature", () => {
  it("produces a signed POST payload the app verifier accepts", async () => {
    const action = await buildAction(fixture("trademe-synthetic.eml"), LEAD_RCPT, ENV, NOW);
    expect(action.kind).toBe("post");
    if (action.kind !== "post") return;

    expect(action.payload.parser).toBe("trademe");
    expect(action.payload.alias).toBe("lead-addington-autos");
    // postal-mime returns the Message-ID verbatim, angle brackets included —
    // fine for dedupe as long as it's stable for the same email.
    expect(action.payload.message_id).toBe("<tm-4567890123-0001@trademe.co.nz>");
    expect(action.payload.buyer.email).toBe("jordan.smith@example.com");
    expect(action.payload.listing_ref).toBe("4567890123");
    expect(action.payload.raw_email).toContain("Trade Me");

    // The exact body bytes + headers the Worker would send must verify.
    const result = await verifyInboundSignature({
      rawBody: action.signed.body,
      signatureHeader: action.signed.headers[SIGNATURE_HEADER],
      timestampHeader: action.signed.headers[TIMESTAMP_HEADER],
      secret: ENV.INBOUND_HMAC_SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("signature fails if the body is tampered in flight", async () => {
    const action = await buildAction(fixture("trademe-synthetic.eml"), LEAD_RCPT, ENV, NOW);
    if (action.kind !== "post") throw new Error("expected post");

    const tampered = action.signed.body.replace("18,000", "1,000");
    const result = await verifyInboundSignature({
      rawBody: tampered,
      signatureHeader: action.signed.headers[SIGNATURE_HEADER],
      timestampHeader: action.signed.headers[TIMESTAMP_HEADER],
      secret: ENV.INBOUND_HMAC_SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(false);
  });

  it("signature fails under a different secret", async () => {
    const action = await buildAction(fixture("trademe-synthetic.eml"), LEAD_RCPT, ENV, NOW);
    if (action.kind !== "post") throw new Error("expected post");

    const result = await verifyInboundSignature({
      rawBody: action.signed.body,
      signatureHeader: action.signed.headers[SIGNATURE_HEADER],
      timestampHeader: action.signed.headers[TIMESTAMP_HEADER],
      secret: "the-wrong-secret",
      now: NOW,
    });
    expect(result.ok).toBe(false);
  });
});
