import { describe, expect, it } from "vitest";
import { parseStructured, QualifyOutputSchema, DraftOutputSchema } from "@/lib/ai/schema";

describe("parseStructured", () => {
  it("parses a bare JSON object", () => {
    const out = parseStructured(QualifyOutputSchema, JSON.stringify({
      reply_text: "hi",
      next_topic: "budget",
      fields: {},
      needs_dealer: false,
    }));
    expect(out.reply_text).toBe("hi");
  });

  it("extracts JSON from a fenced code block despite instructions", () => {
    const text = [
      "Sure, here you go:",
      "```json",
      JSON.stringify({ reply_text: "hi", next_topic: "complete", fields: {}, needs_dealer: false }),
      "```",
    ].join("\n");
    const out = parseStructured(QualifyOutputSchema, text);
    expect(out.next_topic).toBe("complete");
  });

  it("extracts the first {...} object from surrounding prose", () => {
    const text = `Here's my answer: ${JSON.stringify({ reply_text: "hi", next_topic: "complete", fields: {}, needs_dealer: false })} — hope that helps!`;
    const out = parseStructured(QualifyOutputSchema, text);
    expect(out.reply_text).toBe("hi");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStructured(QualifyOutputSchema, "not json at all")).toThrow();
  });

  it("throws on JSON that fails schema validation", () => {
    expect(() =>
      parseStructured(QualifyOutputSchema, JSON.stringify({ reply_text: "hi" /* missing required fields */ })),
    ).toThrow();
  });

  it("rejects an out-of-range intent_score", () => {
    expect(() =>
      parseStructured(
        QualifyOutputSchema,
        JSON.stringify({
          reply_text: "hi",
          next_topic: "budget",
          fields: { intent_score: 5 },
          needs_dealer: false,
        }),
      ),
    ).toThrow();
  });

  it("parses draft output", () => {
    const out = parseStructured(DraftOutputSchema, JSON.stringify({ draft_text: "Hi there [DEALER TO CONFIRM: WOF status]" }));
    expect(out.draft_text).toContain("[DEALER TO CONFIRM");
  });
});
