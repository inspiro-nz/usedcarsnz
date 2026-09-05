import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseMessage } from "../src/index";
import { extractGeneric } from "../src/extractors/generic";
import { extractTrademe, looksLikeTradeMe } from "../src/extractors/trademe";

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
}

describe("extractTrademe (synthetic fixture)", () => {
  it("pulls buyer name, email, phone, message and listing ref from a labelled Trade Me email", async () => {
    const msg = await parseMessage(fixture("trademe-synthetic.eml"));
    expect(looksLikeTradeMe(msg)).toBe(true);

    const out = extractTrademe(msg);
    expect(out.name).toBe("Jordan Smith");
    expect(out.email).toBe("jordan.smith@example.com");
    expect(out.phone).toMatch(/021\s*555\s*0143/);
    expect(out.listingRef).toBe("4567890123");
    expect(out.message).toMatch(/is the Corolla still available/i);
    // The Trade Me footer must be stripped from the buyer message.
    expect(out.message?.toLowerCase()).not.toContain("sent via trade me");
    expect(out.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

describe("extractGeneric (direct buyer email)", () => {
  it("uses From + body as the lead, finds a phone in the text", async () => {
    const msg = await parseMessage(fixture("generic.eml"));
    expect(looksLikeTradeMe(msg)).toBe(false);

    const out = extractGeneric(msg);
    expect(out.email).toBe("pat.buyer@example.com");
    expect(out.name).toBe("Pat Buyer");
    expect(out.phone).toMatch(/022\s*123\s*4567/);
    expect(out.message).toMatch(/Hilux still for sale/i);
  });
});

describe("malformed email — defensive degradation", () => {
  it("never throws; yields low confidence and no buyer email", async () => {
    const msg = await parseMessage(fixture("malformed.eml"));
    const out = extractGeneric(msg);
    expect(out.email).toBeNull();
    expect(out.confidence).toBeLessThan(0.6);
  });

  it("the Trade Me extractor also degrades (no structured hits) without throwing", async () => {
    const msg = await parseMessage(fixture("malformed.eml"));
    // Not really a Trade Me email, but prove extractTrademe is safe if selected.
    expect(() => extractTrademe(msg)).not.toThrow();
    const out = extractTrademe(msg);
    expect(out.email).toBeNull();
  });
});

describe("hostile injection is extracted as plain DATA", () => {
  it("captures the injection text verbatim into message, with contact fields intact", async () => {
    const msg = await parseMessage(fixture("hostile-injection.eml"));
    const out = extractTrademe(msg);
    // The extractor does not interpret the body — it just carries it.
    expect(out.message?.toLowerCase()).toContain("ignore all previous instructions");
    expect(out.email).toBe("mallory@evil.example");
    expect(out.listingRef).toBe("9998887776");
  });
});
