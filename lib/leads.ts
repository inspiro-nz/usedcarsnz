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

/**
 * The §7 human-approval gate. A dealer reviews (optionally edits) the AI draft,
 * then approves and sends it to the buyer.
 *
 * The approval boundary is a DB state machine, not app logic (strategy v5.3 §7):
 *
 *   1. Persist the dealer's edit via the column-scoped GRANT UPDATE (edited_text)
 *      the harden migration (13) allows for authenticated dealers. draft_text —
 *      the original AI proposal — is never overwritten, so the audit trail keeps
 *      both what the model wrote and what the human actually sent.
 *   2. Move pending -> approved ONLY via the approve_draft() RPC, called as the
 *      authenticated dealer (auth.uid() must resolve, so NOT the service_role
 *      client). That RPC atomically sets status/approved_by/approved_at AND logs
 *      the draft_approved lead_event in one statement — we do not hand-roll that
 *      logging here anymore.
 *   3. Only then does sendApprovedReply() send — and it re-checks status='approved'
 *      in the DB and THROWS otherwise, so an unapproved draft can never be sent.
 */
export async function approveAndSendDraft(input: {
  enquiryId: string;
  draftId: string;
  editedText: string;
}): Promise<void> {
  const { enquiry } = await authorizeLeadAccess(input.enquiryId);

  // Act as the signed-in dealer: approve_draft() and the edited_text grant are
  // both scoped to `authenticated`, and approve_draft() reads auth.uid().
  const sb = await supabaseServer();

  const { data: draft, error: dErr } = await sb
    .from("ai_drafts")
    .select("id, status, draft_text, edited_text")
    .eq("id", input.draftId)
    .eq("enquiry_id", input.enquiryId)
    .single<{
      id: string;
      status: string;
      draft_text: string;
      edited_text: string | null;
    }>();
  if (dErr || !draft) throw new Error("Draft not found or not accessible.");
  if (draft.status !== "pending") {
    throw new Error(`Draft is ${draft.status}, not pending — cannot approve.`);
  }

  // Persist the human's edit (if any) as edited_text; keep draft_text intact.
  const trimmed = input.editedText.trim();
  const edited = trimmed.length > 0 && trimmed !== draft.draft_text;
  if (edited) {
    const { error: eErr } = await sb
      .from("ai_drafts")
      .update({ edited_text: trimmed })
      .eq("id", draft.id);
    if (eErr) throw new Error(`persist edited text: ${eErr.message}`);
  }

  // The ONLY sanctioned pending -> approved transition. Authorizes against
  // dealer_id/seller_user_id and logs draft_approved atomically (migration 13).
  const { error: aErr } = await sb.rpc("approve_draft", {
    p_draft_id: draft.id,
  });
  if (aErr) throw new Error(`approve_draft: ${aErr.message}`);

  // Now — and only now that the draft is status='approved' — send it.
  await sendApprovedReply({
    enquiryId: input.enquiryId,
    draftId: draft.id,
    buyerEmail: enquiry.buyer_email,
  });

  if (enquiry.status === "new") {
    await supabaseService()
      .from("enquiries")
      .update({ status: "contacted" })
      .eq("id", input.enquiryId);
  }
}

/**
 * The ONE free-text send function (strategy §7 compliance envelope). It refuses —
 * throws — to send unless the draft has already cleared the DB approval state
 * machine (status='approved' with an approver on record via approve_draft()).
 * That guard lives IN this function, not in its callers: no code path may put
 * free-text dealer reply text on the wire for an unapproved draft.
 *
 * Sends exactly what was approved — the dealer's edited_text if they edited it,
 * otherwise the original AI draft_text — then records the send (status='sent',
 * sent_at) and appends the reply_sent event (actor='human').
 */
export async function sendApprovedReply(input: {
  enquiryId: string;
  draftId: string;
  buyerEmail: string;
}): Promise<void> {
  const svc = supabaseService();

  const { data: draft, error: dErr } = await svc
    .from("ai_drafts")
    .select("id, status, draft_text, edited_text, approved_by, sent_at")
    .eq("id", input.draftId)
    .eq("enquiry_id", input.enquiryId)
    .single<{
      id: string;
      status: string;
      draft_text: string;
      edited_text: string | null;
      approved_by: string | null;
      sent_at: string | null;
    }>();
  if (dErr || !draft) throw new Error("Draft not found.");

  // Structural gate: an unapproved draft CANNOT be sent, full stop.
  if (draft.status !== "approved" || !draft.approved_by) {
    throw new Error(
      `Refusing to send: draft ${input.draftId} is ${draft.status}, not approved.`,
    );
  }

  const finalText = draft.edited_text ?? draft.draft_text;

  await sendEmail({
    to: input.buyerEmail,
    subject: "About the car you enquired on",
    text: finalText,
  });

  const { error: uErr } = await svc
    .from("ai_drafts")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", draft.id);
  if (uErr) throw new Error(`mark draft sent: ${uErr.message}`);

  await logLeadEvent(input.enquiryId, "reply_sent", "human", {
    draft_id: draft.id,
    channel: "email",
  });
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
