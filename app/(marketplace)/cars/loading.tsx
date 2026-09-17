import { SkeletonBlock, SkeletonCardGrid } from "@/components/marketplace/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <SkeletonBlock className="h-8 w-56" />
      <SkeletonBlock className="mt-2 h-3 w-72" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <SkeletonBlock className="hidden h-96 w-full rounded-2xl lg:block" />
        <SkeletonCardGrid />
      </div>
    </main>
  );
}
