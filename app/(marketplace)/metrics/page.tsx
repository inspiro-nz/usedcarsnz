import type { Metadata } from "next";
import { platformMetrics, isSampleData } from "@/lib/metrics-views";
import { applyPublishGate } from "@/lib/metrics-publish";
import { duration } from "@/lib/format";
import { Stat } from "@/components/marketplace/ui";
import { SampleDataBadge } from "@/components/marketplace/metrics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "How fast NZ dealers reply — measured",
  description:
    "The UsedCarsNZ platform first-response time, measured from an immutable event log. Not a survey, not a claim — the number itself.",
};

function pct(rate: number | null): string {
  return rate != null ? `${Math.round(rate * 100)}%` : "—";
}

export default async function PublicMetricsPage() {
  const published = applyPublishGate(await platformMetrics());
  const { sufficient, minN, metrics } = published;
  const sample = isSampleData();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          The number we publish
        </h1>
        {sample ? <SampleDataBadge /> : null}
      </div>
      <p className="mt-3 text-slate-600">
        Every enquiry on UsedCarsNZ is acknowledged automatically, and the moment
        it happens is written to an append-only log. This is the median of those
        first responses across the whole platform — measured, not claimed.
      </p>

      {sufficient ? (
        <section className="mt-10 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
          <div className="text-sm uppercase tracking-wider text-slate-500">
            Median first response
          </div>
          <div className="mt-2 text-6xl font-bold tabular-nums text-orange-500">
            {duration(metrics.medianFirstResponseSeconds)}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            across {metrics.firstResponses.toLocaleString("en-NZ")} measured first
            responses · p90 {duration(metrics.p90FirstResponseSeconds)}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <Stat label="enquiry → appointment" value={pct(metrics.enquiryToAppointmentRate)} />
            <Stat label="appointment → sold" value={pct(metrics.appointmentToSoldRate)} />
            <Stat
              label="median time on market"
              value={
                metrics.medianDaysOnMarket != null
                  ? `${Math.round(metrics.medianDaysOnMarket)}`
                  : "—"
              }
              unit={metrics.medianDaysOnMarket != null ? "days" : undefined}
            />
          </div>
        </section>
      ) : (
        <section className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl font-bold text-slate-400">Insufficient data</div>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
            We publish this number only once the event log holds at least {minN}{" "}
            measured first responses. So far it holds{" "}
            {metrics.firstResponses.toLocaleString("en-NZ")}. Until then we show
            nothing rather than a number the log can&apos;t substantiate.
          </p>
        </section>
      )}

      <p className="mt-8 text-xs leading-relaxed text-slate-400">
        Methodology: measured from the immutable event log — the interval between
        each enquiry and its first acknowledgement, taken as a median across all
        co-listed vehicles on the platform. No survey, no self-report, no
        estimate. Below {minN} measured responses we publish &ldquo;insufficient
        data&rdquo; rather than a hollow figure.
      </p>
    </main>
  );
}
