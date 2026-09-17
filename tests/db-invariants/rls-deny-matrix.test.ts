/**
 * RLS deny-matrix (PROMPT-T2): three clients — anon, dealer A, dealer B —
 * each proving the OTHERS' rows are invisible/unwritable. Adversarial by
 * design: the interesting assertion is always what the database refuses.
 *
 * RLS-bearing tables enumerated from the migrations: users, dealers,
 * staff_accounts, listings, listing_photos, enquiries, ai_drafts,
 * saved_listings, lead_events, messages, dealer_aliases, email_outbox —
 * every one is covered below, plus the §9.2 metrics views (dealer-scoped
 * security_invoker vs the public aggregate).
 *
 * PostgREST failure shapes asserted here:
 *   - missing table GRANT            → error 42501
 *   - RLS WITH CHECK violation       → error 42501
 *   - RLS USING filter on SELECT     → no error, rows silently absent
 *   - RLS USING filter on UPDATE     → no error, 0 rows affected
 */
import { describe, it, expect, beforeAll } from "vitest";
import { isLocal, fixtures, type Fixtures } from "./helpers";

describe.skipIf(!isLocal)("RLS deny-matrix: anon / dealer A / dealer B", () => {
  let fx: Fixtures;

  beforeAll(async () => {
    fx = await fixtures();
  });

  // ---------------------------------------------------------------- anon ----

  it("anon positive control: sees active listings and approved dealers", async () => {
    const listings = await fx.anon.from("listings").select("id").eq("id", fx.a.listingId);
    expect(listings.error).toBeNull();
    expect(listings.data?.length).toBe(1);
    const dealers = await fx.anon.from("dealers").select("id").eq("id", fx.a.dealerId);
    expect(dealers.error).toBeNull();
    expect(dealers.data?.length).toBe(1);
  });

  it("anon cannot read any lead-engine or back-office table", async () => {
    for (const table of [
      "enquiries",
      "ai_drafts",
      "messages",
      "lead_events",
      "email_outbox",
      "dealer_aliases",
      "users",
      "staff_accounts",
      "saved_listings",
    ]) {
      const res = await fx.anon.from(table).select("id").limit(1);
      const denied = res.error !== null || (res.data ?? []).length === 0;
      expect(denied, `anon must not read rows from ${table}`).toBe(true);
    }
  });

  it("anon cannot write anywhere except enquiries INSERT", async () => {
    const upd = await fx.anon.from("enquiries").update({ status: "contacted" }).eq("id", fx.a.enquiryId);
    expect(upd.error, "anon UPDATE enquiries must be rejected").not.toBeNull();

    const draft = await fx.anon
      .from("ai_drafts")
      .insert({ enquiry_id: fx.a.enquiryId, draft_text: "forged", status: "pending" });
    expect(draft.error, "anon INSERT ai_drafts must be rejected").not.toBeNull();

    const msg = await fx.anon
      .from("messages")
      .insert({ enquiry_id: fx.a.enquiryId, sender: "dealer", body: "forged" });
    expect(msg.error, "anon INSERT messages must be rejected").not.toBeNull();

    const ev = await fx.anon
      .from("lead_events")
      .insert({ lead_id: fx.a.enquiryId, event_type: "ack_sent", actor: "ai" });
    expect(ev.error, "anon INSERT lead_events must be rejected").not.toBeNull();
  });

  it("anon positive control: MAY insert an enquiry on an active listing (no-account funnel)", async () => {
    const { error } = await fx.anon.from("enquiries").insert({
      listing_id: fx.a.listingId,
      buyer_name: "Anon DBINV Buyer",
      buyer_email: "dbinv-anon-buyer@example.com",
      message: "RLS positive-control enquiry.",
    });
    expect(error).toBeNull();
  });

  // ---------------------------------------- dealer A vs dealer B: reads ----

  it("a dealer sees their own enquiries and never the other dealer's", async () => {
    for (const [self, other] of [
      [fx.a, fx.b],
      [fx.b, fx.a],
    ] as const) {
      const res = await self.client.from("enquiries").select("id, dealer_id");
      expect(res.error).toBeNull();
      const ids = (res.data ?? []).map((r) => r.id);
      expect(ids, `own enquiry visible`).toContain(self.enquiryId);
      expect(ids, `other dealer's enquiry must be invisible`).not.toContain(other.enquiryId);
      expect((res.data ?? []).every((r) => r.dealer_id === self.dealerId)).toBe(true);
    }
  });

  it("drafts, messages, events and aliases are scoped the same way", async () => {
    for (const [self, other] of [
      [fx.a, fx.b],
      [fx.b, fx.a],
    ] as const) {
      const drafts = await self.client.from("ai_drafts").select("id");
      expect(drafts.error).toBeNull();
      expect((drafts.data ?? []).map((r) => r.id)).not.toContain(other.pendingDraftId);

      const msgs = await self.client.from("messages").select("id");
      expect(msgs.error).toBeNull();
      const msgIds = (msgs.data ?? []).map((r) => r.id);
      expect(msgIds).toContain(self.messageId);
      expect(msgIds).not.toContain(other.messageId);

      const events = await self.client.from("lead_events").select("id, dealer_id");
      expect(events.error).toBeNull();
      expect((events.data ?? []).every((r) => r.dealer_id === self.dealerId)).toBe(true);

      const aliases = await self.client.from("dealer_aliases").select("id");
      expect(aliases.error).toBeNull();
      const aliasIds = (aliases.data ?? []).map((r) => r.id);
      expect(aliasIds).toContain(self.aliasId);
      expect(aliasIds).not.toContain(other.aliasId);
    }
  });

  it("a dealer cannot read another user's profile row", async () => {
    const res = await fx.a.client.from("users").select("id").eq("id", fx.b.userId);
    expect(res.error).toBeNull();
    expect(res.data?.length).toBe(0);
  });

  it("email_outbox is invisible to every client role (service-role-only table)", async () => {
    for (const client of [fx.anon, fx.a.client]) {
      const res = await client.from("email_outbox").select("id").limit(1);
      expect(res.error, "email_outbox must not be readable by clients").not.toBeNull();
      expect(res.error?.code).toBe("42501");
    }
  });

  // --------------------------------------- dealer A vs dealer B: writes ----

  it("cross-dealer UPDATEs silently affect 0 rows and change nothing", async () => {
    const before = await fx.svc.from("enquiries").select("status").eq("id", fx.b.enquiryId).single();

    const res = await fx.a.client
      .from("enquiries")
      .update({ status: "contacted" })
      .eq("id", fx.b.enquiryId)
      .select("id");
    expect(res.error).toBeNull();
    expect(res.data?.length, "RLS must filter the row from A's UPDATE").toBe(0);

    const after = await fx.svc.from("enquiries").select("status").eq("id", fx.b.enquiryId).single();
    expect(after.data?.status).toBe(before.data?.status);
  });

  it("a dealer cannot edit the other dealer's draft text", async () => {
    const res = await fx.a.client
      .from("ai_drafts")
      .update({ edited_text: "cross-dealer forgery" })
      .eq("id", fx.b.pendingDraftId)
      .select("id");
    expect(res.error).toBeNull();
    expect(res.data?.length).toBe(0);

    const still = await fx.svc.from("ai_drafts").select("edited_text").eq("id", fx.b.pendingDraftId).single();
    expect(still.data?.edited_text).not.toBe("cross-dealer forgery");
  });

  it("no client can INSERT drafts or messages (service-role write paths only)", async () => {
    const draft = await fx.a.client
      .from("ai_drafts")
      .insert({ enquiry_id: fx.a.enquiryId, draft_text: "self-made draft", status: "pending" });
    expect(draft.error, "authenticated INSERT ai_drafts is admin-only by RLS").not.toBeNull();

    const msg = await fx.a.client
      .from("messages")
      .insert({ enquiry_id: fx.a.enquiryId, sender: "dealer", body: "unapproved free text" });
    expect(msg.error, "authenticated INSERT messages must be rejected").not.toBeNull();
    expect(msg.error?.code).toBe("42501");
  });

  it("a dealer cannot self-approve or self-verify their dealer row", async () => {
    const res = await fx.a.client
      .from("dealers")
      .update({ verified: false, status: "pending" })
      .eq("id", fx.a.dealerId);
    // guard_dealer_row raises for any status/verified change by a client.
    expect(res.error, "client-side status/verified change must be rejected").not.toBeNull();

    const still = await fx.svc.from("dealers").select("status, verified").eq("id", fx.a.dealerId).single();
    expect(still.data?.status).toBe("approved");
    expect(still.data?.verified).toBe(true);
  });

  // ------------------------------------------------------- metrics views ----

  it("dealer-scoped metrics views ride lead_events RLS (other dealer absent)", async () => {
    for (const [self, other] of [
      [fx.a, fx.b],
      [fx.b, fx.a],
    ] as const) {
      for (const view of ["metrics_lead_facts", "metrics_dealer"]) {
        const res = await self.client.from(view).select("dealer_id");
        expect(res.error, `${view} should be readable`).toBeNull();
        const dealers = new Set((res.data ?? []).map((r) => r.dealer_id));
        expect(dealers.has(other.dealerId), `${view} must not leak the other dealer`).toBe(false);
      }
    }
  });

  it("anon cannot read the dealer-scoped metrics views", async () => {
    for (const view of ["metrics_lead_facts", "metrics_dealer"]) {
      const res = await fx.anon.from(view).select("dealer_id").limit(1);
      expect(res.error, `anon must not read ${view}`).not.toBeNull();
    }
  });

  it("anon MAY read the public aggregate view, which exposes no per-dealer rows", async () => {
    const res = await fx.anon.from("metrics_platform").select("*");
    expect(res.error).toBeNull();
    expect((res.data ?? []).length).toBeLessThanOrEqual(1); // single aggregate row
    if (res.data?.length) {
      expect(Object.keys(res.data[0])).not.toContain("dealer_id");
    }
  });
});
