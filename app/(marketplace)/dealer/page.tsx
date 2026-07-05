import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { dealerFunnelMetrics } from "@/lib/metrics";
import { duration } from "@/lib/format";
import { Badge, Stat, Btn } from "@/components/marketplace/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dealer dashboard" };

export default async function DealerDashboard() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const dealer = viewer.dealers[0];
  if (!dealer) redirect("/register-dealer");

  const m = await dealerFunnelMetrics();

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

      {/* The conversion instrument panel — your numbers, measured, exportable. */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900">Your conversion proof</h2>
          <p className="tabular-nums text-xs text-slate-500">
            live · from the immutable event log
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-5">
          <Stat
            label="median first response"
            value={
              m.medianFirstResponseSeconds != null
                ? duration(m.medianFirstResponseSeconds)
                : "—"
            }
            hot
          />
          <Stat label="enquiries" value={String(m.enquiries)} />
          <Stat label="viewings booked" value={String(m.viewingsBooked)} />
          <Stat label="sold" value={String(m.sold)} />
          <Stat
            label="enquiry → viewing"
            value={
              m.enquiryToViewingRate != null
                ? `${Math.round(m.enquiryToViewingRate * 100)}%`
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
