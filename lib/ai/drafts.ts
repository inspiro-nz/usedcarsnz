
import type { EnquiryRow, ListingRow, Qualification } from "@/lib/db/types";

/**
 * AI reply drafting — bounded per strategy §7 / architecture.md §6.
 *
 * TWO outputs, two rules:
 *  1. The instant first touch (composeFirstTouch) is sent WITHOUT human review,
 *     so it must contain NOTHING vehicle-specific: acknowledgement +
 *     qualification questions only. It is a template on purpose — a template
 *     cannot hallucinate a vehicle claim.
 *  2. The dealer-facing reply (draftDealerReply) may reference the vehicle, so
 *     it is NEVER auto-sent: it lands in ai_drafts as `pending` and a human
 *     approves/edits before anything reaches the buyer.
 *
 * An LLM provider can replace draftDealerReply later (OPENAI_API_KEY is already
 * in the env schema). The compliance boundary — draft-not-send — lives in the
 * lead engine and does not change with the provider.
 */

/** Output 1 — generic, compliant, auto-sent. No vehicle facts, ever. */
export function composeFirstTouch(input: {
  buyerName: string;
  dealerName: string | null;
  listingTitle: string;
}): string {
  const seller = input.dealerName ?? "the seller";
  return [
    `Kia ora ${input.buyerName},`,
    ``,
    `Thanks for your enquiry about the ${input.listingTitle}. Your message has been passed straight to ${seller}, and a team member will come back to you personally.`,
    ``,
    `So they can help you faster, it's useful to know your rough budget, whether you'd like finance, if you have a trade-in, and when you're looking to buy — you can include any of that by replying to this email.`,
    ``,
    `This is an automated acknowledgement from UsedCarsNZ's AI assistant. A human will follow up with anything about the vehicle itself.`,
  ].join("\n");
}

/**
 * Output 2 — vehicle-aware DRAFT for the dealer. Requires human approval.
 *
 * `listing` is NULL for inbound-email leads whose vehicle lives off-platform
 * (§5.3): there is no listing to name. In that case the opening invents NO
 * vehicle — it leaves a [DEALER TO CONFIRM] marker instead (§7). With a listing,
 * the output is unchanged.
 */
export function draftDealerReply(input: {
  enquiry: Pick<EnquiryRow, "buyer_name" | "message" | "qualification">;
  listing: Pick<ListingRow, "year" | "make" | "model" | "variant" | "suburb" | "city"> | null;
  dealerName: string | null;
}): string {
  const l = input.listing;
  const name = l ? [l.year, l.make, l.model, l.variant].filter(Boolean).join(" ") : null;
  const where = l ? [l.suburb, l.city].filter(Boolean).join(", ") : "";
  const q = summariseQualification(input.enquiry.qualification);

  const opening = name
    ? `Thanks for getting in touch about the ${name}${where ? ` here in ${where}` : ""}. It's available to view — happy to arrange a time that suits you for a look and a test drive.`
    : `Thanks for getting in touch. [DEALER TO CONFIRM: which vehicle ${input.enquiry.buyer_name} is enquiring about] — once we've confirmed the details, we'd be happy to arrange a time for a look and a test drive.`;

  return [
    `Hi ${input.enquiry.buyer_name},`,
    ``,
    opening,
    q ? `` : null,
    q,
    ``,
    `[Dealer: add anything about this specific vehicle yourself — condition, history, and spec statements must come from you, not the assistant.]`,
    ``,
    `${input.dealerName ?? "The team"}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function summariseQualification(q: Qualification | null): string {
  if (!q) return "";
  const bits: string[] = [];
  if (q.budget_nzd) bits.push(`budget around $${q.budget_nzd.toLocaleString("en-NZ")}`);
  if (q.finance === "yes") bits.push("interested in finance options");
  if (q.trade_in === "yes") bits.push("has a possible trade-in");
  if (q.timeline === "this_week") bits.push("looking to buy this week");
  if (q.timeline === "this_month") bits.push("looking to buy this month");
  if (bits.length === 0) return "";
  return `From your enquiry it sounds like you're ${bits.join(", ")} — we can cover all of that when you come in.`;
}
