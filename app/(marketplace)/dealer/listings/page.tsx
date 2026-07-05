import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { ListingRow } from "@/lib/db/types";
import { listingTitle, nzd, timeNZ } from "@/lib/format";
import { Badge, Btn, Empty } from "@/components/marketplace/ui";
import { setListingStatusAction } from "@/app/(marketplace)/dealer/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your listings" };

export default async function DealerListingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const dealer = viewer.dealers[0];
  if (!dealer && !viewer.isAdmin) redirect("/register-dealer");

  const sb = await supabaseServer();
  // RLS: a dealer member sees all own listings (any status) + others' active.
  // Scope to this dealer explicitly for the management view.
  const { data } = dealer
    ? await sb
        .from("listings")
        .select("*")
        .eq("dealer_id", dealer.id)
        .order("created_at", { ascending: false })
    : await sb.from("listings").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as ListingRow[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your listings</h1>
        <Btn href="/dealer/listings/new">New listing</Btn>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="p-6">
            <Empty
              title="No listings yet"
              body="Add your first car — it takes a couple of minutes, and enquiries start getting answered the moment it's live."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Listed</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {listingTitle(l)}
                  </td>
                  <td className="tabular-nums px-4 py-3">{nzd(l.price_nzd, l.is_poa)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        l.status === "active"
                          ? "ok"
                          : l.status === "sold"
                            ? "signal"
                            : "neutral"
                      }
                    >
                      {l.status}
                    </Badge>
                  </td>
                  <td className="tabular-nums px-4 py-3 text-xs text-slate-500">
                    {timeNZ(l.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.status === "active" || l.status === "paused" ? (
                      <form action={setListingStatusAction} className="inline">
                        <input type="hidden" name="listing_id" value={l.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={l.status === "active" ? "paused" : "active"}
                        />
                        <button className="rounded text-slate-700 underline hover:text-slate-900">
                          {l.status === "active" ? "Pause" : "Reactivate"}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
