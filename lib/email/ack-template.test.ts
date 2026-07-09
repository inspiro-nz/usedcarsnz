import { describe, expect, it } from "vitest";
import { buildAckEmail } from "./ack-template";

describe("buildAckEmail (compliance envelope)", () => {
  const email = buildAckEmail({
    buyerName: "Bea Buyer",
    dealerName: "Addington Autos",
    dealerLogoUrl: null,
    threadUrl: "http://localhost:3000/thread/enquiry-1",
  });

  it("labels the AI assistant by dealer name", () => {
    expect(email.text).toMatch(/AI assistant of Addington Autos/);
    expect(email.html).toMatch(/AI assistant of Addington Autos/);
  });

  it("links to the buyer thread", () => {
    expect(email.text).toContain("http://localhost:3000/thread/enquiry-1");
    expect(email.html).toContain("http://localhost:3000/thread/enquiry-1");
  });

  it("contains no vehicle-condition or warranty claims", () => {
    const forbidden = /\b(mint|no accidents|warrant|mechanically sound|wof|rego)\b/i;
    expect(email.text).not.toMatch(forbidden);
    expect(email.html).not.toMatch(forbidden);
  });

  it("escapes the dealer name in the HTML body", () => {
    const xss = buildAckEmail({
      buyerName: "Bea",
      dealerName: `<script>alert(1)</script>`,
      dealerLogoUrl: null,
      threadUrl: "http://localhost:3000/thread/enquiry-1",
    });
    expect(xss.html).not.toContain("<script>alert(1)</script>");
  });
});
