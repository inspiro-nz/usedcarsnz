import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { dealerMetrics, isSampleData } from "@/lib/metrics-views";
import { duration } from "@/lib/format";
import { Stat, Btn } from "@/components/marketplace/ui";
import { SampleDataBadge, FirstResponseStrip } from "@/components/marketplace/metrics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversion metrics" };

function pct(rate: number | null): string {
  return rate != null ? `${Math.round(rate * 100)}%` : "—";
}

export default async function DealerMetricsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const dealer = viewer.dealers[0];
  if (!dealer) redirect("/register-dealer");

  // Single scoped read: RLS + the dealer_id filter return exactly this dealer's
  // numbers, all computed by the views from the immutable event log.
  const m = await dealerMetrics(dealer.id);
  const sample = isSampleData();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Conversion metrics
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <p className="tabular-nums text-xs text-slate-500">
              {dealer.business_name} · from the immutable event log
            </p>
            {sample ? <SampleDataBadge /> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Btn href="/dealer" kind="quiet">
            Dashboard
          </Btn>
          <a
            href="/api/metrics?format=csv"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* The four §9.2 headline cards. */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat
            label="median first response"
            value={duration(m.medianFirstResponseSeconds)}
            hot
          />
          <Stat label="enquiry → appointment" value={pct(m.enquiryToAppointmentRate)} />
          <Stat label="appointment → sold" value={pct(m.appointmentToSoldRate)} />
          <Stat
            label="median time on market"
            value={
              m.medianDaysOnMarket != null
                ? `${Math.round(m.medianDaysOnMarket)}`
                : "—"
            }
            unit={m.medianDaysOnMarket != null ? "days" : undefined}
          />
        </div>
        <p className="mt-6 text-xs text-slate-500">
          p90 first response{" "}
          <span className="font-semibold text-slate-700">
            {duration(m.p90FirstResponseSeconds)}
          </span>{" "}
          · {m.enquiries} enquiries · {m.appointments} appointments · {m.sold} sold
          · {m.soldListings} listings sold
        </p>
      </section>

      {/* 30-day first-response distribution strip. */}
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900">
            First response, last 30 days
          </h2>
          {sample ? <SampleDataBadge /> : null}
        </div>
        <div className="mt-6">
          <FirstResponseStrip buckets={m.firstResponse30d} />
        </div>
      </section>

      {/* The v5.1 §12.2 audience kill-criterion number, surfaced from day one. */}
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900">
            Enquiries per listing / month
          </h2>
          <span className="text-2xl font-bold tabular-nums text-slate-900">
            {m.enquiriesPerListing != null ? m.enquiriesPerListing.toFixed(2) : "—"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          The demand-density number the strategy tracks as an audience
          kill-criterion (§12.2). Counts only enquiries on your on-platform
          listings — off-platform email leads are excluded so the ratio stays
          honest.
        </p>
      </section>
    </main>
  );
}
