import "server-only";

import { supabaseService } from "@/lib/supabase/service";
import { logLeadEvent } from "@/lib/leads";
import { sendEmail } from "@/lib/email";
import { getProvider } from "@/lib/ai/provider";
import { generateStructured } from "@/lib/ai/structured";
import { DraftOutputSchema } from "@/lib/ai/schema";
import { DRAFT_PROMPT_VERSION, buildDraftSystemPrompt, buildDraftUserTurn } from "@/lib/ai/prompts/draft.v1";
import { draftDealerReply } from "@/lib/ai/drafts";
import type { DealerRow, EnquiryRow, ListingRow, MessageRow } from "@/lib/db/types";

/**
 * Lane 2 — dealer-facing draft reply (strategy §7). NEVER auto-sent: lands in
 * ai_drafts as status='pending' (the existing §7 human-approval state — see
 * migration comment) for a human to review, edit, and send via the existing
 * approveAndSendDraft() path (lib/leads.ts), which this session does not
 * touch.
 */
export async function generateDraft(enquiryId: string): Promise<void> {
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

  let dealer: DealerRow | null = null;
  if (listing.dealer_id) {
    const { data } = await svc.from("dealers").select("*").eq("id", listing.dealer_id).single<DealerRow>();
    dealer = data ?? null;
  }

  const { data: messageRows } = await svc
    .from("messages")
    .select("*")
    .eq("enquiry_id", enquiryId)
    .order("created_at", { ascending: true });
  const routedQuestions = ((messageRows ?? []) as MessageRow[])
    .map((m) => m.meta?.dealer_question)
    .filter((q): q is string => Boolean(q));

  const listingFacts = labelledListingFacts(listing);

  try {
    const provider = getProvider("draft");
    const system = buildDraftSystemPrompt({
      dealerName: dealer?.business_name ?? null,
      buyerName: enquiry.buyer_name,
      listingFacts,
      qualification: enquiry.qualification,
      routedQuestions,
      buyerMessage: enquiry.message,
    });
    const { data, result } = await generateStructured(
      provider,
      {
        system,
        messages: [{ role: "user", content: buildDraftUserTurn(enquiry.message) }],
        temperature: 0.3,
      },
      DraftOutputSchema,
    );

    const { data: draftRow, error: dErr } = await svc
      .from("ai_drafts")
      .insert({
        enquiry_id: enquiryId,
        draft_text: data.draft_text,
        status: "pending",
        provider: result.provider,
        model_id: result.model,
        prompt_version: DRAFT_PROMPT_VERSION,
      })
      .select("id")
      .single<{ id: string }>();
    if (dErr || !draftRow) throw new Error(`draft insert: ${dErr?.message}`);

    await logLeadEvent(enquiryId, "draft_created", "ai", {
      draft_id: draftRow.id,
      prompt_version: DRAFT_PROMPT_VERSION,
      provider: result.provider,
    });
  } catch (err) {
    // Inference-unavailable is a designed state (§7): mark the draft failed
    // and notify the dealer, rather than silently having no draft at all.
    // No lead_event is logged for the failure — draft_created must stay a
    // true "the dealer has something to review" signal for the funnel.
    console.error(`[ai:draft] generation failed for ${enquiryId}, using safe path:`, err);
    const fallback = draftDealerReply({
      enquiry: { buyer_name: enquiry.buyer_name, message: enquiry.message, qualification: enquiry.qualification },
      listing,
      dealerName: dealer?.business_name ?? null,
    });
    await svc.from("ai_drafts").insert({
      enquiry_id: enquiryId,
      draft_text: fallback,
      status: "generation_failed",
      prompt_version: DRAFT_PROMPT_VERSION,
    });
    if (dealer?.email) {
      await sendEmail({
        to: dealer.email,
        subject: `Action needed — AI draft failed for a lead`,
        text: `The AI reply draft for ${enquiry.buyer_name}'s enquiry couldn't be generated automatically. A template draft has been left on the lead for you to write from scratch: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/dealer/leads/${enquiryId}`,
      });
    }
  }
}

function labelledListingFacts(listing: ListingRow): Record<string, string> {
  return {
    Title: listing.title ?? "",
    Year: String(listing.year),
    Make: listing.make,
    Model: listing.model,
    Variant: listing.variant ?? "",
    "Body type": listing.body_type ?? "",
    Fuel: listing.fuel ?? "",
    Transmission: listing.transmission ?? "",
    "Odometer (km)": listing.odometer_km != null ? String(listing.odometer_km) : "",
    Colour: listing.colour ?? "",
    "WOF expiry": listing.wof_expiry ?? "",
    "Rego expiry": listing.rego_expiry ?? "",
    "Import origin": listing.import_origin ?? "",
    Price: listing.is_poa ? "POA" : listing.price_nzd != null ? `$${listing.price_nzd}` : "",
    Location: [listing.suburb, listing.city].filter(Boolean).join(", "),
    Description: listing.description ?? "",
  };
}
