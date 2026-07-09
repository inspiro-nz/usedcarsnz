import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import type { EnquiryRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your enquiry" };

/**
 * Placeholder buyer thread page (brief: "route can be a placeholder page
 * this session"). The ack email links here; a later session (ai-service)
 * replaces this with the live AI qualification chat.
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
    .select("id, buyer_name, created_at")
    .eq("id", id)
    .maybeSingle<Pick<EnquiryRow, "id" | "buyer_name" | "created_at">>();
  if (!enquiry) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">
        AI assistant
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        Thanks, {enquiry.buyer_name} — we&apos;ve got your enquiry.
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        A team member will follow up with you personally. This page will soon
        let you chat with our AI assistant to help the seller get back to you
        faster — check back shortly.
      </p>
    </main>
  );
}
