import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import type { EnquiryRow, MessageRow } from "@/lib/db/types";
import { ThreadChat } from "./thread-chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your enquiry" };

/**
 * The buyer thread page — the link the ack email sends them to ("You can
 * follow the conversation here any time"). Loads the real message history
 * (buyer/ai/dealer, chronological) and hands it to ThreadChat so the buyer
 * sees the same conversation the dealer sees on /dealer/leads/[id], AI
 * replies and dealer replies alike, and can keep chatting with the AI from
 * where they left off.
 *
 * Capability-URL model, deliberately: enquiries_select RLS only grants to
 * `authenticated` buyers whose buyer_user_id matches, but most buyers submit
 * with no account at all — so the RLS-scoped client would 404 the very buyer
 * the ack email just linked. The enquiry UUID itself is the credential here
 * (unguessable, single-purpose), same posture as the no-account enquiry
 * form; the service client is the only way to honour that for anon buyers.
 */
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = supabaseService();
  const { data: enquiry } = await sb
    .from("enquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle<EnquiryRow>();
  if (!enquiry) notFound();

  // Dealer name for ThreadChat's "AI assistant of {dealer}" label — same
  // listing-backed vs listing-less split as lib/ai/trigger.ts's loadContext.
  let dealerName: string | null = null;
  if (enquiry.listing_id) {
    const { data: listing } = await sb
      .from("listings")
      .select("dealer_id")
      .eq("id", enquiry.listing_id)
      .maybeSingle<{ dealer_id: string | null }>();
    if (listing?.dealer_id) {
      const { data: dealer } = await sb
        .from("dealers")
        .select("business_name")
        .eq("id", listing.dealer_id)
        .maybeSingle<{ business_name: string }>();
      dealerName = dealer?.business_name ?? null;
    }
  } else if (enquiry.dealer_id) {
    const { data: dealer } = await sb
      .from("dealers")
      .select("business_name")
      .eq("id", enquiry.dealer_id)
      .maybeSingle<{ business_name: string }>();
    dealerName = dealer?.business_name ?? null;
  }

  const { data: messages } = await sb
    .from("messages")
    .select("*")
    .eq("enquiry_id", id)
    .order("created_at", { ascending: true });

  const initialMessages = ((messages ?? []) as MessageRow[]).map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.created_at,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">
          AI assistant
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Thanks, {enquiry.buyer_name} — here&apos;s your conversation.
        </h1>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <ThreadChat
          enquiryId={enquiry.id}
          dealerName={dealerName}
          initialMessages={initialMessages}
        />
      </div>
    </main>
  );
}
