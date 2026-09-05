import { SkeletonBlock } from "@/components/marketplace/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <SkeletonBlock className="h-3 w-56" />
        </div>
        <div className="flex min-h-[240px] flex-col gap-3 px-5 py-4">
          <SkeletonBlock className="h-10 w-3/5" />
          <SkeletonBlock className="ml-auto h-10 w-2/5" />
          <SkeletonBlock className="h-14 w-4/5" />
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          <SkeletonBlock className="h-9 w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}
