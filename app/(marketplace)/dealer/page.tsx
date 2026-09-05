import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { EnquiryRow, ListingRow } from "@/lib/db/types";
import { dealerMetrics, isSampleData } from "@/lib/metrics-views";
import { duration, listingTitle, timeNZ } from "@/lib/format";
import { Badge, Stat, Btn, Empty } from "@/components/marketplace/ui";
import { SampleDataBadge } from "@/components/marketplace/metrics";

type ActionLead = Pick<
  EnquiryRow,
  "id" | "buyer_name" | "listing_id" | "status" | "created_at"
>;

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dealer dashboard" };

export default async function DealerDashboard() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const dealer = viewer.dealers[0];
  if (!dealer) redirect("/register-dealer");

  const m = await dealerMetrics(dealer.id);
  const sample = isSampleData();

  // Leads needing a human. RLS scopes both reads to this dealership's own rows
  // (never the service role). A pending AI draft is the click that keeps your
  // first-response time honest, so those surface first.
  const sb = await supabaseServer();
  const [{ data: enquiryRows }, { data: pendingDraftRows }] = await Promise.all([
    sb
      .from("enquiries")
      .select("id, buyer_name, listing_id, status, created_at")
      .in("status", ["new", "contacted", "viewing_booked"])
      .order("created_at", { ascending: false })
      .limit(50),
    sb.from("ai_drafts").select("enquiry_id").eq("status", "pending"),
  ]);
  const openLeads = (enquiryRows ?? []) as ActionLead[];
  const pendingSet = new Set(
    (pendingDraftRows ?? []).map((d) => d.enquiry_id as string),
  );
  const pendingCount = pendingSet.size;

  const actionable = openLeads
    .filter((e) => pendingSet.has(e.id) || e.status === "new")
    .sort((a, b) => {
      const aPending = pendingSet.has(a.id) ? 0 : 1;
      const bPending = pendingSet.has(b.id) ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending; // drafts first
      return b.created_at.localeCompare(a.created_at); // then newest
    })
    .slice(0, 6);

  const shownListingIds = Array.from(new Set(actionable.map((e) => e.listing_id)));
  const { data: listingRows } = shownListingIds.length
    ? await sb
        .from("listings")
        .select("id, title, year, make, model")
        .in("id", shownListingIds)
    : { data: [] };
  const listingById = new Map(
    ((listingRows ?? []) as Pick<
      ListingRow,
      "id" | "title" | "year" | "make" | "model"
    >[]).map((l) => [l.id, l]),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dealer.business_name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={dealer.status === "approved" ? "ok" : "pending"}>
              {dealer.status}
            </Badge>
            {dealer.verified ? <Badge tone="ok">verified</Badge> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Btn href="/dealer/metrics" kind="quiet">
            Conversion metrics
          </Btn>
          <Btn href="/dealer/leads" kind="quiet">
            Lead inbox
          </Btn>
          <Btn href="/dealer/listings" kind="quiet">
            Listings
          </Btn>
          <Btn href="/dealer/listings/new">New listing</Btn>
        </div>
      </div>

      {dealer.status !== "approved" ? (
        <p className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-4 text-sm text-slate-700">
          Your dealership is pending approval — you can prepare listings, and
          they&apos;ll go live once you&apos;re approved.
        </p>
      ) : null}

      {/* What to do next: the leads waiting on a human, drafts first. */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Leads needing action</h2>
          <div className="flex items-center gap-3">
            {pendingCount > 0 ? (
              <span className="tabular-nums text-xs font-medium text-orange-600">
                {pendingCount} draft{pendingCount === 1 ? "" : "s"} awaiting
                approval
              </span>
            ) : null}
            <Btn href="/dealer/leads" kind="quiet">
              Open inbox
            </Btn>
          </div>
        </div>

        {actionable.length === 0 ? (
          <div className="mt-4">
            <Empty
              title="You're all caught up"
              body="No leads waiting on a human right now. New enquiries land here — already acknowledged in under a minute."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {actionable.map((e) => {
              const l = listingById.get(e.listing_id);
              const hasDraft = pendingSet.has(e.id);
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{e.buyer_name}</p>
                    <p className="tabular-nums mt-0.5 text-xs text-slate-500">
                      {l ? listingTitle(l) : "—"} · {timeNZ(e.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasDraft ? (
                      <Badge tone="signal">draft ready</Badge>
                    ) : (
                      <Badge tone={e.status === "new" ? "signal" : "neutral"}>
                        {e.status.replace("_", " ")}
                      </Badge>
                    )}
                    <Link
                      href={`/dealer/leads/${e.id}`}
                      className="rounded text-sm font-medium text-slate-900 underline"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The conversion instrument panel — your numbers, measured, exportable. */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Your conversion proof</h2>
          <div className="flex items-center gap-2">
            {sample ? <SampleDataBadge /> : null}
            <p className="tabular-nums text-xs text-slate-500">
              live · from the immutable event log
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-5">
          <Stat
            label="median first response"
            value={duration(m.medianFirstResponseSeconds)}
            hot
          />
          <Stat label="enquiries" value={String(m.enquiries)} />
          <Stat label="appointments" value={String(m.appointments)} />
          <Stat label="sold" value={String(m.sold)} />
          <Stat
            label="enquiry → appointment"
            value={
              m.enquiryToAppointmentRate != null
                ? `${Math.round(m.enquiryToAppointmentRate * 100)}%`
                : "—"
            }
          />
        </div>
        <p className="mt-6 text-xs text-slate-500">
          The industry-average first response is measured in <em>hours</em>.
          Yours is the number above — and it&apos;s the number we publish,
          aggregated, as the platform&apos;s proof metric.
        </p>
      </section>

      <p className="mt-6 text-sm text-slate-500">
        Need help?{" "}
        <Link href="/dealer/leads" className="rounded text-slate-900 underline">
          Answer your open leads
        </Link>{" "}
        — approving the AI&apos;s draft takes seconds and keeps your response
        time honest.
      </p>
    </main>
  );
}
