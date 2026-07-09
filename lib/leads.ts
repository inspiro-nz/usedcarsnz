import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import type { EnquiryRow, LeadEventType, LeadActor } from "@/lib/db/types";

/**
 * The lead engine (strategy §9.1 · architecture.md §4).
 *
 * Every function here runs server-side. Privileged writes use the service_role
 * client, but ONLY after the caller's right to act has been proven with an
 * RLS-scoped read (the "authorize with RLS, act with service" pattern).
 * Every state change is appended to lead_events via the log_lead_event RPC —
 * the sanctioned, forge-proof path (ADR-0004).
 *
 * The instant first-touch + draft generation this file used to own
 * (runFirstTouch, the WP-1 Prompt-2 stub) now lives in lib/ai/trigger.ts
 * (triggerQualification) and lib/ai/generate-draft.ts — the bounded AI layer
 * (strategy §7). logLeadEvent is exported so that code can append to the
 * same append-only log through the same sanctioned RPC.
 */

export async function logLeadEvent(
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

  await logLeadEvent(input.enquiryId, "draft_approved", "human", {
    draft_id: draft.id,
    approved_by: userId,
    edited,
  });

  await sendEmail({
    to: enquiry.buyer_email,
    subject: "About the car you enquired on",
    text: finalText,
  });
  await logLeadEvent(input.enquiryId, "reply_sent", "human", {
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
  await logLeadEvent(enquiryId, "viewing_booked", "human", {});
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
  await logLeadEvent(enquiryId, "marked_sold", "human", {
    ...(soldPrice != null ? { sold_price: soldPrice } : {}),
  });
}
