/**
 * Skeleton primitives for route-level loading.tsx files. Content-shaped
 * placeholders (not spinners) so the layout is stable before data arrives and
 * there is zero layout shift when it does — the skeleton occupies the same box
 * the real content will. Pure CSS pulse; no client JS.
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-100 ${className}`} />;
}

/** Mirrors ListingCard: fixed-aspect image panel + three text lines. */
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <SkeletonBlock className="aspect-[16/10] rounded-none" />
      <div className="space-y-2 p-4">
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-5 w-1/3" />
        <SkeletonBlock className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/** A responsive grid of card skeletons (listing index / results). */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Table-row skeletons for the dealer lead inbox. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-3 w-40" />
          <SkeletonBlock className="ml-auto h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
