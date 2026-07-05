import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  AiDraftRow,
  EnquiryRow,
  LeadEventRow,
  ListingRow,
} from "@/lib/db/types";
import { listingTitle, nzd, timeNZ } from "@/lib/format";
import { Badge } from "@/components/marketplace/ui";
import { ApproveDraftForm } from "./approve-form";
import { bookViewingAction, markSoldAction } from "@/app/(marketplace)/dealer/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead" };

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const { id } = await params;
  const sb = await supabaseServer();

  // RLS is the authorizer: this read only succeeds for the owning dealer/admin.
  const { data: enquiry } = await sb
    .from("enquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle<EnquiryRow>();
  if (!enquiry) notFound();

  const [{ data: listing }, { data: drafts }, { data: events }] =
    await Promise.all([
      sb
        .from("listings")
        .select("*")
        .eq("id", enquiry.listing_id)
        .maybeSingle<ListingRow>(),
      sb
        .from("ai_drafts")
        .select("*")
        .eq("enquiry_id", id)
        .order("created_at", { ascending: true }),
      sb
        .from("lead_events")
        .select("*")
        .eq("lead_id", id)
        .order("occurred_at", { ascending: true }),
    ]);

  const pendingDraft = ((drafts ?? []) as AiDraftRow[]).find(
    (d) => d.status === "pending",
  );
  const q = enquiry.qualification;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-slate-500">Lead</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {enquiry.buyer_name} · {listing ? listingTitle(listing) : "—"}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Badge tone={enquiry.status === "new" ? "signal" : "neutral"}>
          {enquiry.status.replace("_", " ")}
        </Badge>
        <span className="tabular-nums text-xs">{timeNZ(enquiry.created_at)}</span>
        <span>{enquiry.buyer_email}</span>
        {enquiry.buyer_phone ? (
          <span className="tabular-nums">{enquiry.buyer_phone}</span>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Buyer message + qualification */}
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Buyer&apos;s message
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-900">
              {enquiry.message ?? "(no message — enquiry only)"}
            </p>
            {q ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
                <QualItem label="Budget" value={q.budget_nzd ? nzd(q.budget_nzd) : "—"} />
                <QualItem label="Finance" value={q.finance ?? "—"} />
                <QualItem label="Trade-in" value={q.trade_in ?? "—"} />
                <QualItem label="Timeline" value={q.timeline?.replace("_", " ") ?? "—"} />
              </dl>
            ) : null}
          </section>

          {/* The human-approval gate */}
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                AI-drafted reply — awaiting your approval
              </h2>
              <Badge tone="signal">draft, not sent</Badge>
            </div>
            <div className="mt-3">
              {pendingDraft ? (
                <ApproveDraftForm
                  enquiryId={enquiry.id}
                  draftId={pendingDraft.id}
                  draftText={pendingDraft.draft_text}
                />
              ) : (
                <p className="text-sm text-slate-500">
                  No draft awaiting approval
                  {(drafts ?? []).length
                    ? " — the reply for this lead has been sent."
                    : "."}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Timeline + lifecycle actions */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Next step
            </h2>
            <div className="mt-3 space-y-3">
              {enquiry.status !== "sold" ? (
                <>
                  <form action={bookViewingAction}>
                    <input type="hidden" name="enquiry_id" value={enquiry.id} />
                    <button className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900">
                      Viewing booked
                    </button>
                  </form>
                  <form action={markSoldAction} className="space-y-2">
                    <input type="hidden" name="enquiry_id" value={enquiry.id} />
                    <input
                      name="sold_price"
                      type="number"
                      min={0}
                      step={100}
                      placeholder="Sold price (optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
                    />
                    <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700">
                      Mark sold to this buyer
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-green-600">Sold. Nice one.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Event log
            </h2>
            <ol className="mt-3 space-y-2">
              {((events ?? []) as LeadEventRow[]).map((ev) => (
                <li key={ev.id} className="text-xs">
                  <span className="tabular-nums text-slate-500">
                    {timeNZ(ev.occurred_at)}
                  </span>
                  <div className="tabular-nums mt-0.5 font-medium text-slate-900">
                    {ev.event_type}
                    <span className="ml-1 font-normal text-slate-500">
                      · {ev.actor}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              Append-only. This log is what your dashboard — and our public
              metric — is computed from.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function QualItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="tabular-nums mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}
