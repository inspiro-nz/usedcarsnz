import { SkeletonBlock } from "@/components/marketplace/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <SkeletonBlock className="aspect-[16/10] w-full rounded-lg" />
          <SkeletonBlock className="mt-6 h-8 w-2/3" />
          <SkeletonBlock className="mt-2 h-4 w-1/3" />
          <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
        <SkeletonBlock className="h-72 w-full rounded-2xl" />
      </div>
    </main>
  );
}
