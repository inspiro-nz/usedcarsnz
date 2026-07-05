// Unit-verify the pure lead-engine logic against the same fixture the SQL
// tests used: enquiry at t0, AI response at t0+40s, viewing +2d, sold +3d.
import { computeFunnel } from "../lib/funnel.ts";
import { composeFirstTouch, draftDealerReply } from "../lib/ai/drafts.ts";

const t0 = new Date("2026-07-01T09:00:00Z").getTime();
const iso = (ms) => new Date(ms).toISOString();
const L = "lead-1";

const events = [
  { lead_id: L, event_type: "enquiry_received",       occurred_at: iso(t0) },
  { lead_id: L, event_type: "ai_first_response_sent", occurred_at: iso(t0 + 40_000) },
  { lead_id: L, event_type: "qualification_completed",occurred_at: iso(t0 + 70_000) },
  { lead_id: L, event_type: "viewing_booked",         occurred_at: iso(t0 + 2 * 86400_000) },
  { lead_id: L, event_type: "marked_sold",            occurred_at: iso(t0 + 3 * 86400_000) },
  // a second lead with no response yet — median must ignore it, counts must not
  { lead_id: "lead-2", event_type: "enquiry_received", occurred_at: iso(t0 + 60_000) },
];

const m = computeFunnel(events);
const checks = [
  ["enquiries = 2",                 m.enquiries === 2],
  ["firstResponses = 1",            m.firstResponses === 1],
  ["median first response = 40s",   m.medianFirstResponseSeconds === 40],
  ["viewings = 1",                  m.viewingsBooked === 1],
  ["sold = 1",                      m.sold === 1],
  ["enquiry→viewing = 0.5",         m.enquiryToViewingRate === 0.5],
  ["viewing→sale = 1",              m.viewingToSaleRate === 1],
];

// Compliance shape of the two AI outputs
const ft = composeFirstTouch({ buyerName: "Bea", dealerName: "Addington Autos", listingTitle: "2016 Toyota Aqua" });
checks.push(["first touch labelled as AI",            /AI assistant/.test(ft)]);
checks.push(["first touch: no condition claims",      !/mint|excellent condition|no accidents|full service/i.test(ft)]);

const dr = draftDealerReply({
  enquiry: { buyer_name: "Bea", message: "Still available?", qualification: { budget_nzd: 15000, finance: "yes", trade_in: null, timeline: "this_week" } },
  listing: { year: 2016, make: "Toyota", model: "Aqua", variant: null, suburb: "Addington", city: "Christchurch" },
  dealerName: "Addington Autos",
});
checks.push(["draft carries dealer-ownership notice", /must come from you, not the assistant/.test(dr)]);
checks.push(["draft summarises qualification",        /budget around \$15,000/.test(dr) && /this week/.test(dr)]);

let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) fail++;
}
process.exit(fail ? 1 : 0);
