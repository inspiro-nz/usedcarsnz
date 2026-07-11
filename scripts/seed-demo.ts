/**
 * scripts/seed-demo.ts — idempotent demo seed for the conversion-metrics story.
 *
 *   npx tsx scripts/seed-demo.ts
 *
 * HARD-GUARDED to local/demo only (scripts/demo-data.ts assertDemoTarget). Never
 * touches production. Safe to run repeatedly: everything keys off deterministic
 * UUIDs and a SEED_PREFIX tag, and per-lead events are only appended for
 * enquiries that did NOT already exist — so re-running never double-logs.
 *
 * What it builds (deliverable E):
 *   - 3 approved+verified dealers, 30 listings across realistic NZ makes/bands,
 *     each with a placeholder photo.
 *   - ~120 historical enquiries over 60 days in two cohorts:
 *       * BASELINE era (60–31 days ago): multi-hour human first responses.
 *       * PLATFORM era (30–1 days ago): 40–90s acks — the sub-60s lift.
 *     with plausible enquiry -> viewing_booked -> marked_sold funnels.
 *   - A few email-lane leads (NULL listing_id) so the per-listing view is PROVEN
 *     to exclude them.
 *   - A handful of live-state leads (New + a pending draft) so the inbox looks
 *     worked-in.
 *
 * All timestamps are backdated: enquiry_received is auto-logged by the DB trigger
 * at enquiries.created_at, and every later event is appended via log_lead_event
 * with an explicit occurred_at. The immutable log is written the sanctioned way.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadEnvLocal,
  makeServiceClient,
  du,
  rng,
  SEED_PREFIX,
  DEMO_DEALERS,
  VEHICLE_POOL,
  type DemoDealer,
} from "./demo-data";

loadEnvLocal();

const DAY = 86_400_000;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

const BUYER_FIRST = ["Jack", "Emma", "Liam", "Olivia", "Noah", "Charlotte", "Mia", "Leo", "Ruby", "Kauri", "Anahera", "Wiremu", "Grace", "Tane", "Isla"];
const BUYER_LAST = ["Wilson", "Smith", "Tui", "Chen", "Patel", "Williams", "Ngata", "Brown", "Kumar", "Taylor", "Reti", "Singh"];

async function main() {
  const svc = makeServiceClient();
  console.log("Seeding demo data (local/demo target confirmed)…\n");

  for (const dealer of DEMO_DEALERS) {
    await ensureDealer(svc, dealer);
  }
  const listings = await ensureListings(svc);
  console.log(`  dealers: ${DEMO_DEALERS.length}, listings: ${listings.length}`);

  const existing = await existingSeedKeys(svc);
  let created = 0;
  let events = 0;

  // ---- historical cohorts -------------------------------------------------
  const rand = rng(20260711);
  const HISTORICAL = 120;
  for (let i = 0; i < HISTORICAL; i++) {
    const platformEra = i >= 60; // second half = platform era
    const listing = listings[i % listings.length];
    const key = `hist:${i}`;
    if (existing.has(SEED_PREFIX + key)) continue;

    // Enquiry age: baseline 60–31d ago, platform 30–1d ago.
    const ageDays = platformEra ? 1 + rand() * 29 : 31 + rand() * 29;
    const enquiryAt = now - ageDays * DAY;

    // First-response latency: platform 40–90s; baseline 2–6h.
    const ackSeconds = platformEra ? 40 + rand() * 50 : (2 + rand() * 4) * 3600;

    const leadId = du(`enq:${key}`);
    await insertEnquiry(svc, {
      leadId,
      listingId: listing.id,
      dealerId: null, // derived from listing by the denorm trigger
      key,
      buyer: buyerFor(rand),
      createdAt: enquiryAt,
      status: "contacted",
    });
    created++;

    // ack_sent (the first response) — actor 'ai', mirrors lib/enquiries/first-touch.
    await logEvent(svc, leadId, "ack_sent", "ai", enquiryAt + ackSeconds * 1000, {
      channel: "email",
      template: "first-touch-v1",
      ms_since_received: Math.round(ackSeconds * 1000),
    });
    events++;

    // Funnel: ~40% book a viewing; ~50% of those sell.
    const books = rand() < 0.4;
    if (books) {
      const apptAt = enquiryAt + (1 + rand() * 4) * DAY;
      await logEvent(svc, leadId, "viewing_booked", "human", apptAt, {});
      events++;
      const sells = rand() < 0.5;
      if (sells) {
        const soldAt = apptAt + (1 + rand() * 6) * DAY;
        const soldPrice = Math.round(listing.price * (0.93 + rand() * 0.05));
        await logEvent(svc, leadId, "marked_sold", "human", soldAt, { sold_price: soldPrice });
        events++;
        await markListingSold(svc, listing.id, soldAt, soldPrice);
        await svc.from("enquiries").update({ status: "sold" }).eq("id", leadId);
      } else {
        await svc.from("enquiries").update({ status: "viewing_booked" }).eq("id", leadId);
      }
    }
  }

  // ---- email-lane leads (NULL listing_id) — prove per-listing exclusion ----
  for (let i = 0; i < 5; i++) {
    const key = `email:${i}`;
    if (existing.has(SEED_PREFIX + key)) continue;
    const enquiryAt = now - (1 + i * 3) * DAY;
    const leadId = du(`enq:${key}`);
    await insertEnquiry(svc, {
      leadId,
      listingId: null, // email lane: no on-platform listing
      dealerId: DEMO_DEALERS[0].id, // alias-resolved dealer (authoritative for listing-less)
      key,
      buyer: buyerFor(rng(1000 + i)),
      createdAt: enquiryAt,
      status: "contacted",
      source: "email_trademe",
    });
    created++;
    const ackSeconds = 45 + i * 5;
    await logEvent(svc, leadId, "ack_sent", "ai", enquiryAt + ackSeconds * 1000, {
      channel: "email",
      template: "first-touch-v1",
      ms_since_received: ackSeconds * 1000,
    });
    events++;
  }

  // ---- live-state leads: New + a pending draft (worked-in inbox) -----------
  for (let i = 0; i < 4; i++) {
    const key = `live:${i}`;
    if (existing.has(SEED_PREFIX + key)) continue;
    const listing = listings[i];
    const enquiryAt = now - (2 + i) * 3600_000; // a few hours ago
    const leadId = du(`enq:${key}`);
    await insertEnquiry(svc, {
      leadId,
      listingId: listing.id,
      dealerId: null,
      key,
      buyer: buyerFor(rng(2000 + i)),
      createdAt: enquiryAt,
      status: "new",
      message: "Hi, is this still available? Keen to view this week.",
    });
    created++;
    const ackSeconds = 50 + i * 8;
    await logEvent(svc, leadId, "ack_sent", "ai", enquiryAt + ackSeconds * 1000, {
      channel: "email",
      template: "first-touch-v1",
      ms_since_received: ackSeconds * 1000,
    });
    events++;
    // Pending draft awaiting the dealer's approval.
    const draftId = du(`draft:${key}`);
    await svc.from("ai_drafts").upsert(
      {
        id: draftId,
        enquiry_id: leadId,
        draft_text:
          "Kia ora! Yes, it's still available. We're open 9–5:30 weekdays and " +
          "10–4 Saturdays — happy to hold a time for you to view. What day suits?",
        status: "pending",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    await logEvent(svc, leadId, "draft_created", "ai", enquiryAt + (ackSeconds + 3) * 1000, {
      draft_id: draftId,
    });
    events++;
  }

  console.log(`  enquiries created: ${created}, events appended: ${events}`);
  console.log("\nDone. Re-running is a no-op for already-seeded rows.");
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function buyerFor(rand: () => number): { name: string; email: string } {
  const first = BUYER_FIRST[Math.floor(rand() * BUYER_FIRST.length)];
  const last = BUYER_LAST[Math.floor(rand() * BUYER_LAST.length)];
  const tag = Math.floor(rand() * 9000 + 1000);
  return { name: `${first} ${last}`, email: `${first}.${last}.${tag}@example.com`.toLowerCase() };
}

async function ensureDealer(svc: SupabaseClient, dealer: DemoDealer): Promise<void> {
  const { data: existing } = await svc.from("dealers").select("id").eq("id", dealer.id).maybeSingle();
  if (existing) return;

  // Owner auth user — reuse if the email already exists.
  let ownerId = await findUserIdByEmail(svc, dealer.ownerEmail);
  if (!ownerId) {
    const { data, error } = await svc.auth.admin.createUser({
      email: dealer.ownerEmail,
      email_confirm: true,
      user_metadata: { full_name: dealer.ownerName },
    });
    if (error || !data.user) throw new Error(`createUser(${dealer.ownerEmail}): ${error?.message}`);
    ownerId = data.user.id;
  }

  const { error } = await svc.from("dealers").insert({
    id: dealer.id,
    owner_user_id: ownerId,
    business_name: dealer.businessName,
    contact_name: dealer.contactName,
    email: dealer.email,
    suburb: dealer.suburb,
    city: dealer.city,
    region: dealer.region,
    status: "approved",
    verified: true,
  });
  if (error) throw new Error(`insert dealer ${dealer.businessName}: ${error.message}`);
}

async function findUserIdByEmail(svc: SupabaseClient, email: string): Promise<string | null> {
  // public.users mirrors auth.users (email synced by the auth trigger).
  const { data } = await svc.from("users").select("id").eq("email", email).maybeSingle<{ id: string }>();
  if (data?.id) return data.id;
  // Fall back to the auth admin list (small demo scale).
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return list?.users.find((u) => u.email === email)?.id ?? null;
}

interface SeededListing {
  id: string;
  dealerId: string;
  price: number;
  createdAt: number;
}

async function ensureListings(svc: SupabaseClient): Promise<SeededListing[]> {
  const listings: SeededListing[] = [];
  const rows: Record<string, unknown>[] = [];
  const photoRows: Record<string, unknown>[] = [];
  const perDealer = 10;

  for (const dealer of DEMO_DEALERS) {
    for (let n = 0; n < perDealer; n++) {
      const v = VEHICLE_POOL[(dealer.idx * perDealer + n) % VEHICLE_POOL.length];
      const id = du(`listing:${dealer.idx}:${n}`);
      const createdAt = now - (70 + n) * DAY; // listed before the enquiries, for time-on-market
      listings.push({ id, dealerId: dealer.id, price: v.price, createdAt });
      rows.push({
        id,
        seller_type: "dealer",
        dealer_id: dealer.id,
        make: v.make,
        model: v.model,
        year: v.year,
        variant: v.variant,
        body_type: v.bodyType,
        fuel: v.fuel,
        transmission: v.transmission,
        odometer_km: v.odometerKm,
        colour: v.colour,
        price_nzd: v.price,
        is_poa: false,
        suburb: dealer.suburb,
        city: dealer.city,
        region: dealer.region,
        description: `${v.year} ${v.make} ${v.model} ${v.variant ?? ""}. Tidy example, full history, ready to view at ${dealer.businessName}.`.trim(),
        in_trade: true,
        cin_link: `https://example.com/cin/${id}`,
        status: "active",
        created_at: iso(createdAt),
      });
      photoRows.push({
        id: du(`photo:${dealer.idx}:${n}`),
        listing_id: id,
        storage_path: `demo/${v.make}-${v.model}.jpg`.toLowerCase(),
        position: 0,
        is_primary: true,
      });
    }
  }

  const { error } = await svc.from("listings").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`upsert listings: ${error.message}`);
  const { error: pErr } = await svc.from("listing_photos").upsert(photoRows, { onConflict: "id", ignoreDuplicates: true });
  if (pErr) throw new Error(`upsert listing_photos: ${pErr.message}`);
  return listings;
}

async function existingSeedKeys(svc: SupabaseClient): Promise<Set<string>> {
  const { data } = await svc
    .from("enquiries")
    .select("external_message_id")
    .like("external_message_id", `${SEED_PREFIX}%`);
  return new Set((data ?? []).map((r) => (r as { external_message_id: string }).external_message_id));
}

async function insertEnquiry(
  svc: SupabaseClient,
  input: {
    leadId: string;
    listingId: string | null;
    dealerId: string | null;
    key: string;
    buyer: { name: string; email: string };
    createdAt: number;
    status: string;
    source?: string;
    message?: string;
  },
): Promise<void> {
  const { error } = await svc.from("enquiries").insert({
    id: input.leadId,
    listing_id: input.listingId,
    dealer_id: input.dealerId, // ignored by the denorm trigger when listing present
    buyer_name: input.buyer.name,
    buyer_email: input.buyer.email,
    message: input.message ?? null,
    status: input.status,
    source: input.source ?? "platform_form",
    external_message_id: SEED_PREFIX + input.key,
    created_at: iso(input.createdAt),
  });
  if (error) throw new Error(`insert enquiry ${input.key}: ${error.message}`);
}

async function logEvent(
  svc: SupabaseClient,
  leadId: string,
  eventType: string,
  actor: string,
  occurredAtMs: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await svc.rpc("log_lead_event", {
    p_lead_id: leadId,
    p_event_type: eventType,
    p_actor: actor,
    p_payload: payload,
    p_occurred_at: iso(occurredAtMs),
  });
  if (error) throw new Error(`log_lead_event(${eventType}) for ${leadId}: ${error.message}`);
}

async function markListingSold(
  svc: SupabaseClient,
  listingId: string,
  soldAtMs: number,
  soldPrice: number,
): Promise<void> {
  const { error } = await svc
    .from("listings")
    .update({ status: "sold", sold_at: iso(soldAtMs), sold_price: soldPrice })
    .eq("id", listingId);
  if (error) throw new Error(`mark listing sold ${listingId}: ${error.message}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
