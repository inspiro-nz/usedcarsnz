/**
 * Integration verification for the §9.2 metric views against the LOCAL Supabase.
 *
 * It reads the RAW lead_events, hand-computes each dealer's median first-response
 * and enquiry->appointment / appointment->sold rates in TypeScript, then asserts
 * the SQL views return exactly the same numbers — proving the views, not just
 * assuming them. Also proves the per-listing view excludes null-listing email
 * leads.
 *
 * Offline-by-default: SKIPS unless a local Supabase is configured and reachable
 * (matches the repo's offline-first test posture). To run it:
 *   npx supabase start && npm run seed:demo && npm run test
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvLocal, checkDemoTarget } from "./demo-data";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";
const isLocal =
  checkDemoTarget({ url, appEnv: process.env.NEXT_PUBLIC_APP_ENV, secretKey: key }).ok &&
  /127\.0\.0\.1|localhost|:54321/.test(url);

interface RawEvent {
  lead_id: string;
  dealer_id: string | null;
  listing_id: string | null;
  event_type: string;
  occurred_at: string;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Mirror metrics_lead_facts: earliest of each event per lead.
function perLeadFacts(events: RawEvent[]) {
  const byLead = new Map<string, { dealer: string | null; enquiry?: number; ack?: number; appt?: number; sold?: number }>();
  for (const e of events) {
    let f = byLead.get(e.lead_id);
    if (!f) { f = { dealer: e.dealer_id }; byLead.set(e.lead_id, f); }
    if (e.dealer_id) f.dealer = e.dealer_id;
    const t = new Date(e.occurred_at).getTime();
    const keep = (cur: number | undefined) => (cur === undefined ? t : Math.min(cur, t));
    if (e.event_type === "enquiry_received") f.enquiry = keep(f.enquiry);
    else if (e.event_type === "ack_sent") f.ack = keep(f.ack);
    else if (e.event_type === "viewing_booked" || e.event_type === "appointment_booked") f.appt = keep(f.appt);
    else if (e.event_type === "marked_sold") f.sold = keep(f.sold);
  }
  return byLead;
}

describe.skipIf(!isLocal)("metrics views match a hand-computation from raw lead_events", () => {
  let svc: SupabaseClient;
  let events: RawEvent[] = [];

  beforeAll(async () => {
    svc = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await svc
      .from("lead_events")
      .select("lead_id, dealer_id, listing_id, event_type, occurred_at")
      .limit(100000);
    if (error) throw new Error(error.message);
    events = (data ?? []) as RawEvent[];
    if (events.length === 0) {
      throw new Error("No lead_events found — run `npm run seed:demo` before this test.");
    }
  });

  it("median first-response + funnel rates match metrics_dealer, per dealer", async () => {
    const facts = perLeadFacts(events);

    // Hand-compute per dealer.
    const byDealer = new Map<string, { fr: number[]; enq: number; appt: number; sold: number }>();
    for (const f of facts.values()) {
      if (!f.dealer) continue;
      let d = byDealer.get(f.dealer);
      if (!d) { d = { fr: [], enq: 0, appt: 0, sold: 0 }; byDealer.set(f.dealer, d); }
      if (f.enquiry !== undefined) d.enq += 1;
      if (f.enquiry !== undefined && f.ack !== undefined && f.ack >= f.enquiry) {
        d.fr.push((f.ack - f.enquiry) / 1000);
      }
      if (f.appt !== undefined) d.appt += 1;
      if (f.sold !== undefined) d.sold += 1;
    }

    const { data: viewRows, error } = await svc.from("metrics_dealer").select("*");
    expect(error).toBeNull();
    const view = new Map((viewRows ?? []).map((r) => [r.dealer_id as string, r]));

    expect(view.size).toBe(byDealer.size);

    for (const [dealerId, hand] of byDealer) {
      const v = view.get(dealerId);
      expect(v, `view row for dealer ${dealerId}`).toBeTruthy();

      // median first response — exact match (percentile_cont(0.5) == our median)
      const handMedian = median(hand.fr);
      if (handMedian === null) {
        expect(v.median_first_response_seconds).toBeNull();
      } else {
        expect(Number(v.median_first_response_seconds)).toBeCloseTo(handMedian, 2);
      }

      expect(Number(v.enquiries)).toBe(hand.enq);
      expect(Number(v.appointments)).toBe(hand.appt);
      expect(Number(v.sold)).toBe(hand.sold);

      const eToA = hand.enq > 0 ? Number((hand.appt / hand.enq).toFixed(4)) : null;
      const aToS = hand.appt > 0 ? Number((hand.sold / hand.appt).toFixed(4)) : null;
      expect(v.enquiry_to_appointment_rate === null ? null : Number(v.enquiry_to_appointment_rate)).toBe(eToA);
      expect(v.appointment_to_sold_rate === null ? null : Number(v.appointment_to_sold_rate)).toBe(aToS);
    }
  });

  it("per-listing view EXCLUDES null-listing email leads", async () => {
    // Hand: enquiry_received events that DO have a listing, per dealer.
    const listingScoped = new Map<string, number>();
    let nullListingEnquiries = 0;
    for (const e of events) {
      if (e.event_type !== "enquiry_received") continue;
      if (e.listing_id === null) { nullListingEnquiries += 1; continue; }
      if (!e.dealer_id) continue;
      listingScoped.set(e.dealer_id, (listingScoped.get(e.dealer_id) ?? 0) + 1);
    }
    expect(nullListingEnquiries).toBeGreaterThan(0); // the seed includes email-lane leads

    const { data: rows, error } = await svc
      .from("metrics_enquiries_per_listing_dealer")
      .select("dealer_id, enquiries");
    expect(error).toBeNull();

    // Sum the view's numerator per dealer; it must equal the listing-scoped hand count
    // (i.e. the null-listing leads are absent from the numerator entirely).
    const viewByDealer = new Map<string, number>();
    for (const r of rows ?? []) {
      viewByDealer.set(r.dealer_id as string, (viewByDealer.get(r.dealer_id as string) ?? 0) + Number(r.enquiries));
    }
    for (const [dealerId, count] of listingScoped) {
      expect(viewByDealer.get(dealerId) ?? 0).toBe(count);
    }
    // And the grand total excludes every null-listing lead.
    const viewTotal = [...viewByDealer.values()].reduce((a, b) => a + b, 0);
    const handTotal = [...listingScoped.values()].reduce((a, b) => a + b, 0);
    expect(viewTotal).toBe(handTotal);
  });
});
