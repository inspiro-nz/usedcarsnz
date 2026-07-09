import { describe, expect, it } from "vitest";
import { guardReply } from "@/lib/ai/guard";

describe("guardReply — canned forbidden phrasings (strategy §7)", () => {
  const vehicleCondition = [
    "No, it has never had any accidents.",
    "It's in mint condition throughout.",
    "The engine is mechanically sound.",
    "It has new tyres all round.",
    "The WOF is current until next year.",
    "Rego runs out in March.",
    "Yes, it's exactly as described in the listing.",
    "The odometer reads 45,000km and that's accurate.",
    "It runs great and has a full service history.",
  ];

  const warrantyCga = [
    "No warranty is included with this vehicle.",
    "It comes with a 3-month warranty.",
    "That's covered under the Consumer Guarantees Act.",
    "Your rights are protected under the CGA.",
  ];

  const financeOpinion = [
    "You'll qualify for finance easily with your income.",
    "We can get you the best loan rate available.",
    "I'd recommend you get finance through our partner — it's cheaper than the bank.",
    "You should go with our lender, they have a lower-interest rate than others.",
    "Based on your budget, you can afford this easily.",
  ];

  it.each(vehicleCondition)("blocks vehicle-condition claim: %s", (text) => {
    const result = guardReply(text);
    expect(result.blocked).toBe(true);
    expect(result.category).toBe("vehicle_condition");
    expect(result.safeText).not.toBe(text);
  });

  it.each(warrantyCga)("blocks warranty/CGA statement: %s", (text) => {
    const result = guardReply(text);
    expect(result.blocked).toBe(true);
    expect(result.category).toBe("warranty_cga");
  });

  it.each(financeOpinion)("blocks finance/insurance opinion: %s", (text) => {
    const result = guardReply(text);
    expect(result.blocked).toBe(true);
    expect(result.category).toBe("finance_opinion");
  });

  it("does not block compliant qualification copy", () => {
    const compliant = [
      "Thanks for reaching out! What's your rough budget for this purchase?",
      "Would you be interested in being connected with a finance partner? It's a no-obligation intro.",
      "Do you have a vehicle you're looking to trade in?",
      "When are you hoping to buy — this week, this month, or just browsing?",
      "That's a great question — it's not something I can confirm myself, so I've flagged it for the team.",
    ];
    for (const text of compliant) {
      const result = guardReply(text);
      expect(result.blocked).toBe(false);
      expect(result.safeText).toBe(text);
    }
  });

  it("returns the same safe deferral text for every block, never the model's original text", () => {
    const a = guardReply("It has no accidents.");
    const b = guardReply("There is no warranty.");
    expect(a.safeText).toBe(b.safeText);
  });
});
