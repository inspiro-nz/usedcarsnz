import "server-only";

import { supabaseService } from "@/lib/supabase/service";
import { logLeadEvent } from "@/lib/leads";
import { getProvider } from "@/lib/ai/provider";
import { generateStructured } from "@/lib/ai/structured";
import { QualifyOutputSchema, type QualifyOutput } from "@/lib/ai/schema";
import { guardReply, type GuardResult } from "@/lib/ai/guard";
import { QUALIFY_PROMPT_VERSION, buildQualifySystemPrompt, buildQualifyUserTurn } from "@/lib/ai/prompts/qualify.v1";
import { generateDraft } from "@/lib/ai/generate-draft";
import type { DealerRow, EnquiryRow, ListingRow, LeadEventType, Qualification } from "@/lib/db/types";

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
  /** NULL for listing-less inbound-email leads (§5.3) — dealer comes from the enquiry instead. */
  listing: ListingRow | null;
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

  let listing: ListingRow | null = null;
  let dealer: DealerRow | null = null;

  if (enquiry.listing_id) {
    // Platform-form lead: the listing is authoritative, and the dealer is
    // derived from it (unchanged path).
    const { data, error: lErr } = await svc
      .from("listings")
      .select("*")
      .eq("id", enquiry.listing_id)
      .single<ListingRow>();
    if (lErr || !data) throw new Error(`listing not found: ${lErr?.message}`);
    listing = data;
    if (listing.dealer_id) {
      const { data: d } = await svc.from("dealers").select("*").eq("id", listing.dealer_id).single<DealerRow>();
      dealer = d ?? null;
    }
  } else if (enquiry.dealer_id) {
    // Listing-less inbound-email lead (§5.3): alias-routed straight to a dealer.
    // There is no vehicle to load — qualify on the non-vehicle topics using the
    // dealer context that set_enquiry_denorm put on the enquiry.
    const { data: d } = await svc.from("dealers").select("*").eq("id", enquiry.dealer_id).single<DealerRow>();
    dealer = d ?? null;
  } else {
    // Neither a listing nor a dealer: there is genuinely nothing to qualify
    // against. Throw so the caller's safe-handoff path owns it.
    throw new Error(`enquiry ${enquiryId} has neither a listing nor a dealer`);
  }

  return { enquiry, listing, dealer };
}

function listingTitle(listing: ListingRow): string {
  return listing.title ?? [listing.year, listing.make, listing.model, listing.variant].filter(Boolean).join(" ");
}

/**
 * Canonical topic order (strategy §7's budget/finance/trade-in/timeline/
 * location list). Control flow — which ONE topic gets asked this turn — is
 * decided HERE, from the qualification row already on the DB, rather than
 * left to the model's own read of a "known so far" text summary: a small,
 * fast model re-deciding topic order from scratch every turn is exactly
 * what produced the same question being asked 2-3 times in a row in
 * practice (confirmed live, 2026-09-12). The model still gets to phrase the
 * question and extract the answer, just not to pick which topic is next.
 */
const TOPIC_ORDER: ReadonlyArray<{ topic: QualifyOutput["next_topic"]; field: keyof Qualification }> = [
  { topic: "budget", field: "budget_nzd" },
  { topic: "finance", field: "finance" },
  { topic: "trade_in", field: "trade_in" },
  { topic: "timeline", field: "timeline" },
  { topic: "location", field: "location" },
];

function nextMissingTopic(q: Qualification | null): QualifyOutput["next_topic"] {
  for (const { topic, field } of TOPIC_ORDER) {
    if (q?.[field] == null) return topic;
  }
  return "complete";
}

/**
 * Deterministic fallback for a plain yes/no reply to a yes/no topic
 * (finance, trade_in). The model's own structured extraction missed bare
 * answers like "yes i am" in practice; this catches the common phrasings a
 * regex can safely own, without touching anything the model already
 * extracted (only fills the field if the model left it blank).
 */
function fallbackYesNo(topic: QualifyOutput["next_topic"], buyerMessage: string): "yes" | "no" | null {
  if (topic !== "finance" && topic !== "trade_in") return null;
  const text = buyerMessage.trim().toLowerCase();
  if (/^(yes|yeah|yep|yup|sure|definitely|please|ok|okay|correct)\b/.test(text)) return "yes";
  if (/^(no|nope|nah|not really|not interested)\b/.test(text)) return "no";
  return null;
}

/** Runs one qualify-lane turn. Never throws — any failure resolves to the safe-path outcome. */
async function runQualifyTurn(ctx: TurnContext, buyerMessage: string): Promise<TurnOutcome> {
  const targetTopic = nextMissingTopic(ctx.enquiry.qualification);
  try {
    const provider = getProvider("qualify");
    const system = buildQualifySystemPrompt({
      dealerName: ctx.dealer?.business_name ?? null,
      listingTitle: ctx.listing ? listingTitle(ctx.listing) : null,
      approvedFacts: ctx.dealer?.approved_facts ?? {},
      qualificationSoFar: ctx.enquiry.qualification,
      targetTopic,
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

    const fallback = fallbackYesNo(targetTopic, buyerMessage);
    const fields =
      fallback && data.fields[targetTopic === "finance" ? "finance" : "trade_in"] == null
        ? { ...data.fields, [targetTopic === "finance" ? "finance" : "trade_in"]: fallback }
        : data.fields;

    return {
      replyText: guard.safeText,
      guard,
      needsDealer,
      dealerQuestion,
      // Owned by app code, not echoed from the model (see targetTopic above) —
      // this is what completeTurn/mergeQualification and the "done" flag key off.
      nextTopic: targetTopic,
      fields,
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

  // Persist the buyer's own turn BEFORE the AI's reply, so both the dealer
  // lead page and the buyer's own thread page show the real back-and-forth —
  // previously only the AI's replies ever landed in `messages`, so a
  // dealer reading the conversation could see the AI's answers but never
  // what the buyer had actually said to prompt them.
  await svc.from("messages").insert({ enquiry_id: enquiryId, sender: "buyer", body: buyerMessage });
  await logLeadEvent(enquiryId, "buyer_message_received", "system", {});

  // A buyer replying on a lead that was closed (manually, or by
  // closeStaleLeads()'s 7-day timeout) means they came back — reopen it
  // rather than leaving the conversation running against a dead lead.
  if (ctx.enquiry.status === "closed") {
    await svc.from("enquiries").update({ status: "contacted" }).eq("id", enquiryId);
    await logLeadEvent(enquiryId, "lead_reopened", "system", { reason: "buyer_replied" });
  }

  const outcome = await runQualifyTurn(ctx, buyerMessage);
  return completeTurn(svc, ctx, outcome, "ai_message_sent");
}
