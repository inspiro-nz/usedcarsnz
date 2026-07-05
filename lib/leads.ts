import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { composeFirstTouch, draftDealerReply } from "@/lib/ai/drafts";
import { sendEmail } from "@/lib/email";
import { listingTitle } from "@/lib/format";
import type {
  EnquiryRow,
  LeadEventType,
  LeadActor,
  ListingRow,
  Qualification,
} from "@/lib/db/types";

/**
 * The lead engine (strategy §9.1 · architecture.md §4).
 *
 * Every function here runs server-side. Privileged writes use the service_role
 * client, but ONLY after the caller's right to act has been proven with an
 * RLS-scoped read (the "authorize with RLS, act with service" pattern).
 * Every state change is appended to lead_events via the log_lead_event RPC —
 * the sanctioned, forge-proof path (ADR-0004).
 */

async function logEvent(
  leadId: string,
  eventType: LeadEventType,
  actor: LeadActor,
  payload: Record<string, unknown> = {},
) {
  const svc = supabaseService();
  const { error } = await svc.rpc("log_lead_event", {
    p_lead_id: leadId,
    p_event_type: eventType,
    p_actor: actor,
    p_payload: payload,
  });
  if (error) throw new Error(`log_lead_event(${eventType}): ${error.message}`);
}

/**
 * Runs immediately after an enquiry INSERT (the trigger has already logged
 * enquiry_received). Sends the AI's sub-60s first touch, records the
 * qualification, and creates the human-approval draft.
 *
 * Compliance shape (§7): the auto-sent message is generic; the vehicle-aware
 * text is only ever a DRAFT.
 */
export async function runFirstTouch(enquiryId: string): Promise<void> {
  const svc = supabaseService();

  const { data: enquiry, error: eErr } = await svc
    .from("enquiries")
    .select("*")
    .eq("id", enquiryId)
    .single<EnquiryRow>();
  if (eErr || !enquiry) throw new Error(`enquiry not found: ${eErr?.message}`);

  const { data: listing, error: lErr } = await svc
    .from("listings")
    .select("*")
    .eq("id", enquiry.listing_id)
    .single<ListingRow>();
  if (lErr || !listing) throw new Error(`listing not found: ${lErr?.message}`);

  let dealerName: string | null = null;
  if (listing.dealer_id) {
    const { data: dealer } = await svc
      .from("dealers")
      .select("business_name")
      .eq("id", listing.dealer_id)
      .single<{ business_name: string }>();
    dealerName = dealer?.business_name ?? null;
  }

  // 1) The instant, generic, compliant first touch — the wedge itself.
  const firstTouch = composeFirstTouch({
    buyerName: enquiry.buyer_name,
    dealerName,
    listingTitle: listingTitle(listing),
  });
  await sendEmail({
    to: enquiry.buyer_email,
    subject: `We're onto it — your enquiry about the ${listingTitle(listing)}`,
    text: firstTouch,
  });
  await logEvent(enquiryId, "ai_first_response_sent", "ai", {
    channel: "email",
  });

  // 2) Structured qualification captured with the enquiry (§9.1).
  if (hasQualification(enquiry.qualification)) {
    await logEvent(enquiryId, "qualification_completed", "ai", {
      ...enquiry.qualification,
    });
  }

  // 3) Vehicle-aware reply — DRAFT ONLY, pending human approval (§7).
  const draft = draftDealerReply({ enquiry, listing, dealerName });
  const { data: draftRow, error: dErr } = await svc
    .from("ai_drafts")
    .insert({ enquiry_id: enquiryId, draft_text: draft })
    .select("id")
    .single<{ id: string }>();
  if (dErr || !draftRow) throw new Error(`draft insert: ${dErr?.message}`);
  await logEvent(enquiryId, "draft_created", "ai", { draft_id: draftRow.id });
}

function hasQualification(q: Qualification | null): boolean {
  if (!q) return false;
  return Boolean(q.budget_nzd || q.finance || q.trade_in || q.timeline);
}

/**
 * Proves the signed-in user may act on this enquiry: an RLS-scoped read only
 * returns the row if the caller is a member of the owning dealer (or the
 * private seller, or an admin). Returns the enquiry or throws.
 */
export async function authorizeLeadAccess(
  enquiryId: string,
): Promise<{ enquiry: EnquiryRow; userId: string }> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: enquiry, error } = await sb
    .from("enquiries")
    .select("*")
    .eq("id", enquiryId)
    .single<EnquiryRow>();
  if (error || !enquiry) {
    throw new Error("Lead not found or you do not have access to it.");
  }
  return { enquiry, userId: user.id };
}

/** Human approves (optionally edits) the AI draft; the reply goes to the buyer. */
export async function approveAndSendDraft(input: {
  enquiryId: string;
  draftId: string;
  editedText: string;
}): Promise<void> {
  const { enquiry, userId } = await authorizeLeadAccess(input.enquiryId);
  const svc = supabaseService();

  const { data: draft, error: dErr } = await svc
    .from("ai_drafts")
    .select("id, status, draft_text")
    .eq("id", input.draftId)
    .eq("enquiry_id", input.enquiryId)
    .single<{ id: string; status: string; draft_text: string }>();
  if (dErr || !draft) throw new Error("Draft not found.");
  if (draft.status !== "pending") throw new Error("Draft is not pending.");

  const finalText = input.editedText.trim() || draft.draft_text;
  const edited = finalText !== draft.draft_text;
  const now = new Date().toISOString();

  const { error: uErr } = await svc
    .from("ai_drafts")
    .update({
      status: "sent",
      edited_text: edited ? finalText : null,
      approved_by: userId,
      approved_at: now,
      sent_at: now,
    })
    .eq("id", draft.id);
  if (uErr) throw new Error(`draft update: ${uErr.message}`);

  await logEvent(input.enquiryId, "draft_approved", "human", {
    draft_id: draft.id,
    approved_by: userId,
    edited,
  });

  await sendEmail({
    to: enquiry.buyer_email,
    subject: "About the car you enquired on",
    text: finalText,
  });
  await logEvent(input.enquiryId, "reply_sent", "human", {
    draft_id: draft.id,
    channel: "email",
  });

  if (enquiry.status === "new") {
    await svc
      .from("enquiries")
      .update({ status: "contacted" })
      .eq("id", input.enquiryId);
  }
}

/** Dealer books a viewing / test drive — the funnel's appointment step. */
export async function bookViewing(enquiryId: string): Promise<void> {
  await authorizeLeadAccess(enquiryId);
  const svc = supabaseService();
  await svc
    .from("enquiries")
    .update({ status: "viewing_booked" })
    .eq("id", enquiryId);
  await logEvent(enquiryId, "viewing_booked", "human", {});
}

/** Dealer marks the vehicle sold against this lead — the conversion. */
export async function markSold(
  enquiryId: string,
  soldPrice: number | null,
): Promise<void> {
  const { enquiry } = await authorizeLeadAccess(enquiryId);
  const svc = supabaseService();

  await svc
    .from("listings")
    .update({
      status: "sold",
      sold_price: soldPrice,
      sold_at: new Date().toISOString(),
    })
    .eq("id", enquiry.listing_id);
  await svc.from("enquiries").update({ status: "sold" }).eq("id", enquiryId);
  await logEvent(enquiryId, "marked_sold", "human", {
    ...(soldPrice != null ? { sold_price: soldPrice } : {}),
  });
}
