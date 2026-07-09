import "server-only";

import { supabaseService } from "@/lib/supabase/service";
import { logLeadEvent } from "@/lib/leads";
import { getProvider } from "@/lib/ai/provider";
import { generateStructured } from "@/lib/ai/structured";
import { QualifyOutputSchema, type QualifyOutput } from "@/lib/ai/schema";
import { guardReply, type GuardResult } from "@/lib/ai/guard";
import { QUALIFY_PROMPT_VERSION, buildQualifySystemPrompt, buildQualifyUserTurn } from "@/lib/ai/prompts/qualify.v1";
import { generateDraft } from "@/lib/ai/generate-draft";
import type { DealerRow, EnquiryRow, ListingRow, LeadEventType } from "@/lib/db/types";

/**
 * Lane 1 — buyer-facing qualification chat (strategy §7).
 *
 * Two entry points share one turn pipeline:
 *  - triggerQualification: the sub-60s first touch, invoked once via
 *    ctx.waitUntil from POST /api/enquiries, using the buyer's original
 *    enquiry message as the first turn. Logs ai_first_response_sent.
 *  - handleChatTurn: every subsequent buyer message on the thread page
 *    (POST /api/ai/chat). Logs ai_message_sent.
 *
 * Both chain getProvider("qualify") -> generateStructured -> guardReply
 * (which runs on EVERY output, win-always) -> persist to messages (sender
 * 'ai') -> merge enquiries.qualification -> emit lead_events. ANY failure
 * (provider throw, structured-output parse failure after its own retry)
 * is caught here and routed to a templated safe-path reply with
 * needs_dealer=true — the thread never breaks and the SLA event still fires.
 */

const SAFE_HANDOFF_TEXT =
  "Thanks for reaching out — I've passed your message on to the team and they'll be in touch shortly.";

export interface ChatTurnResult {
  replyText: string;
  guardBlocked: boolean;
  needsDealer: boolean;
  dealerQuestion: string | null;
  done: boolean;
}

interface TurnContext {
  enquiry: EnquiryRow;
  listing: ListingRow;
  dealer: DealerRow | null;
}

interface TurnOutcome {
  replyText: string;
  guard: GuardResult;
  needsDealer: boolean;
  dealerQuestion: string | null;
  nextTopic: QualifyOutput["next_topic"] | null;
  fields: QualifyOutput["fields"] | null;
  provider: string | null;
  model: string | null;
}

async function loadContext(
  svc: ReturnType<typeof supabaseService>,
  enquiryId: string,
): Promise<TurnContext> {
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

  let dealer: DealerRow | null = null;
  if (listing.dealer_id) {
    const { data } = await svc.from("dealers").select("*").eq("id", listing.dealer_id).single<DealerRow>();
    dealer = data ?? null;
  }

  return { enquiry, listing, dealer };
}

function listingTitle(listing: ListingRow): string {
  return listing.title ?? [listing.year, listing.make, listing.model, listing.variant].filter(Boolean).join(" ");
}

/** Runs one qualify-lane turn. Never throws — any failure resolves to the safe-path outcome. */
async function runQualifyTurn(ctx: TurnContext, buyerMessage: string): Promise<TurnOutcome> {
  try {
    const provider = getProvider("qualify");
    const system = buildQualifySystemPrompt({
      dealerName: ctx.dealer?.business_name ?? null,
      listingTitle: listingTitle(ctx.listing),
      approvedFacts: ctx.dealer?.approved_facts ?? {},
      qualificationSoFar: ctx.enquiry.qualification,
    });
    const { data, result } = await generateStructured(
      provider,
      {
        system,
        messages: [{ role: "user", content: buildQualifyUserTurn(buyerMessage) }],
        temperature: 0.2,
      },
      QualifyOutputSchema,
    );

    const guard = guardReply(data.reply_text);
    const needsDealer = data.needs_dealer || guard.blocked;
    const dealerQuestion = guard.blocked ? (data.dealer_question ?? buyerMessage) : (data.dealer_question ?? null);

    return {
      replyText: guard.safeText,
      guard,
      needsDealer,
      dealerQuestion,
      nextTopic: data.next_topic,
      fields: data.fields,
      provider: result.provider,
      model: result.model,
    };
  } catch (err) {
    console.error(`[ai:qualify] generation failed for ${ctx.enquiry.id}, using safe path:`, err);
    return {
      replyText: SAFE_HANDOFF_TEXT,
      guard: { blocked: false, safeText: SAFE_HANDOFF_TEXT },
      needsDealer: true,
      dealerQuestion: null,
      nextTopic: null,
      fields: null,
      provider: null,
      model: null,
    };
  }
}

async function mergeQualification(
  svc: ReturnType<typeof supabaseService>,
  enquiry: EnquiryRow,
  fields: QualifyOutput["fields"] | null,
): Promise<void> {
  if (!fields) return;
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return;

  const hadQualification = Boolean(enquiry.qualification && Object.keys(enquiry.qualification).length > 0);
  const merged = { ...(enquiry.qualification ?? {}), ...Object.fromEntries(entries) };

  await svc.from("enquiries").update({ qualification: merged }).eq("id", enquiry.id);
  await logLeadEvent(
    enquiry.id,
    hadQualification ? "qualification_updated" : "qualification_completed",
    "ai",
    merged,
  );
}

/** Persists the AI's turn, merges qualification, emits audit events, and kicks the Lane 2 side-quest. */
async function completeTurn(
  svc: ReturnType<typeof supabaseService>,
  ctx: TurnContext,
  outcome: TurnOutcome,
  firstTouchEventType: LeadEventType,
): Promise<ChatTurnResult> {
  await svc.from("messages").insert({
    enquiry_id: ctx.enquiry.id,
    sender: "ai",
    body: outcome.replyText,
    meta: {
      needs_dealer: outcome.needsDealer,
      dealer_question: outcome.dealerQuestion,
      next_topic: outcome.nextTopic,
      guard_blocked: outcome.guard.blocked,
      ...(outcome.provider ? { provider: outcome.provider } : {}),
      ...(outcome.model ? { model: outcome.model } : {}),
      prompt_version: QUALIFY_PROMPT_VERSION,
    },
  });

  await mergeQualification(svc, ctx.enquiry, outcome.fields);

  if (outcome.guard.blocked) {
    await logLeadEvent(ctx.enquiry.id, "guard_blocked", "ai", {
      category: outcome.guard.category ?? null,
    });
  }

  await logLeadEvent(ctx.enquiry.id, firstTouchEventType, "ai", {
    prompt_version: QUALIFY_PROMPT_VERSION,
    ...(outcome.provider ? { provider: outcome.provider } : {}),
  });

  // Best-effort side-quest: a routed question or total AI failure both mean
  // the dealer needs something to act on — get a Lane 2 draft ready for
  // their queue without blocking or failing this turn if it can't.
  if (outcome.needsDealer) {
    void generateDraft(ctx.enquiry.id).catch((err) => {
      console.error(`[ai:qualify] side-quest generateDraft failed for ${ctx.enquiry.id}:`, err);
    });
  }

  return {
    replyText: outcome.replyText,
    guardBlocked: outcome.guard.blocked,
    needsDealer: outcome.needsDealer,
    dealerQuestion: outcome.dealerQuestion,
    done: outcome.nextTopic === "complete",
  };
}

/**
 * The real Lane 1 kickoff (strategy §7). Invoked once via ctx.waitUntil by
 * POST /api/enquiries, after the templated sub-5s ack has already gone out
 * synchronously — this never gates the buyer-facing SLA.
 */
export async function triggerQualification(enquiryId: string): Promise<void> {
  const svc = supabaseService();
  const ctx = await loadContext(svc, enquiryId);
  const outcome = await runQualifyTurn(ctx, ctx.enquiry.message ?? "");
  await completeTurn(svc, ctx, outcome, "ai_first_response_sent");
}

/** Per-turn handler for the buyer thread page (POST /api/ai/chat). */
export async function handleChatTurn(enquiryId: string, buyerMessage: string): Promise<ChatTurnResult> {
  const svc = supabaseService();
  const ctx = await loadContext(svc, enquiryId);
  const outcome = await runQualifyTurn(ctx, buyerMessage);
  return completeTurn(svc, ctx, outcome, "ai_message_sent");
}
