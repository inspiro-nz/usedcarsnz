import { SkeletonBlock } from "@/components/marketplace/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="h-9 w-64" />
      </div>
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SkeletonBlock className="h-5 w-48" />
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBlock className="h-8 w-20" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
