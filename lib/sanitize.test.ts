import { describe, expect, it } from "vitest";
import { escapeHtml } from "./sanitize";

describe("escapeHtml", () => {
  it("escapes the five HTML-special characters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#x27;y&#x27;&lt;/script&gt;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Bea Buyer")).toBe("Bea Buyer");
  });
});
