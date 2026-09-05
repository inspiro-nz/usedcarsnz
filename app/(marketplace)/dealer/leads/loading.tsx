import { SkeletonBlock, SkeletonRows } from "@/components/marketplace/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <SkeletonBlock className="h-8 w-44" />
      <SkeletonBlock className="mt-2 h-3 w-96 max-w-full" />
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <SkeletonRows />
      </div>
    </main>
  );
}
