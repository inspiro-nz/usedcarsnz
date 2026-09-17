import { BUCKET_ORDER, type FirstResponseBuckets } from "@/lib/metrics-publish";

/**
 * Presentational metric primitives, in the marketplace's slate/orange system
 * (components/marketplace/ui.tsx). Server-safe — no client hooks.
 */

/**
 * The mandatory demo honesty marker (§9.2): whenever DEMO_SAMPLE_DATA is set,
 * every metric surface renders this so a seeded number can never be mistaken for
 * a measured one. Amber, unmissable, always adjacent to the numbers it qualifies.
 */
export function SampleDataBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Sample data — not measured results
    </span>
  );
}

/**
 * The 30-day first-response distribution strip. Six latency buckets; the sub-60s
 * bucket (the product's whole claim) is orange, the rest slate. Bar height is
 * proportional to the bucket's share of the busiest bucket. Pure render from the
 * view-derived counts — no maths beyond scaling for display.
 */
export function FirstResponseStrip({ buckets }: { buckets: FirstResponseBuckets }) {
  const counts = BUCKET_ORDER.map((b) => buckets[b.key]);
  const max = Math.max(1, ...counts);
  const under1mShare =
    buckets.total > 0 ? Math.round((buckets.under1m / buckets.total) * 100) : null;

  if (buckets.total === 0) {
    return (
      <p className="text-sm text-slate-500">
        No first responses in the last 30 days yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height: "112px" }}>
        {BUCKET_ORDER.map((b, i) => {
          const count = counts[i];
          const heightPct = Math.round((count / max) * 100);
          const hot = b.key === "under1m";
          return (
            <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="tabular-nums text-xs font-semibold text-slate-600">
                {count}
              </span>
              <div
                className={`w-full rounded-t ${hot ? "bg-orange-500" : "bg-slate-200"}`}
                style={{ height: `${Math.max(count > 0 ? 6 : 2, heightPct)}%` }}
                title={`${b.label}: ${count}`}
              />
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
      {under1mShare != null ? (
        <p className="mt-4 text-xs text-slate-500">
          <span className="font-semibold text-orange-600">{under1mShare}%</span> of
          the last 30 days&apos; first responses went out in under a minute
          {" "}({buckets.total} total).
        </p>
      ) : null}
    </div>
  );
}
