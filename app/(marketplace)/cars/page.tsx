import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase/public";
import type { ListingRow } from "@/lib/db/types";
import { ListingCard } from "@/components/marketplace/listing-card";
import { Empty, Field, inputCls } from "@/components/marketplace/ui";

// Dynamic: results depend on searchParams (filters), so this page can't be a
// single ISR entry. The two reads below run in parallel (no waterfall).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Browse used cars" };

interface Search {
  q?: string;
  make?: string;
  price_max?: string;
  year_min?: string;
  fuel?: string;
  transmission?: string;
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const sb = supabasePublic();

  let query = sb
    .from("listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  if (params.q) {
    const q = params.q.trim();
    query = query.or(`make.ilike.%${q}%,model.ilike.%${q}%,title.ilike.%${q}%`);
  }
  if (params.make) query = query.ilike("make", params.make);
  if (params.price_max) query = query.lte("price_nzd", Number(params.price_max));
  if (params.year_min) query = query.gte("year", Number(params.year_min));
  if (params.fuel) query = query.eq("fuel", params.fuel);
  if (params.transmission) query = query.eq("transmission", params.transmission);

  // Results and the makes facet are independent — fetch them in parallel so the
  // page never waits on one read before starting the other.
  const [{ data }, { data: makesRaw }] = await Promise.all([
    query,
    sb.from("listings").select("make").eq("status", "active").limit(500),
  ]);
  const listings = (data ?? []) as ListingRow[];
  const makes = Array.from(
    new Set(((makesRaw ?? []) as { make: string }[]).map((m) => m.make)),
  ).sort();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Browse used cars</h1>
      <p className="tabular-nums mt-1 text-xs text-slate-500">
        {listings.length} result{listings.length === 1 ? "" : "s"} · every
        enquiry answered in &lt;60s
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filter rail */}
        <form className="h-fit space-y-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
          <Field label="Keyword">
            <input name="q" defaultValue={params.q ?? ""} className={inputCls} placeholder="Make, model…" />
          </Field>
          <Field label="Make">
            <select name="make" defaultValue={params.make ?? ""} className={inputCls}>
              <option value="">Any</option>
              {makes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Max price (NZD)">
            <input name="price_max" type="number" min={0} step={500} defaultValue={params.price_max ?? ""} className={inputCls} />
          </Field>
          <Field label="Year from">
            <input name="year_min" type="number" min={1980} max={2026} defaultValue={params.year_min ?? ""} className={inputCls} />
          </Field>
          <Field label="Fuel">
            <select name="fuel" defaultValue={params.fuel ?? ""} className={inputCls}>
              <option value="">Any</option>
              {["petrol", "diesel", "hybrid", "phev", "ev"].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Transmission">
            <select name="transmission" defaultValue={params.transmission ?? ""} className={inputCls}>
              <option value="">Any</option>
              <option value="automatic">automatic</option>
              <option value="manual">manual</option>
            </select>
          </Field>
          <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700">
            Apply filters
          </button>
        </form>

        {/* Results */}
        <div>
          {listings.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <Empty
              title="No cars match those filters"
              body="Loosen a filter or clear the search — new stock lands daily once dealers are live."
            />
          )}
        </div>
      </div>
    </main>
  );
}
