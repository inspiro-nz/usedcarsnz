import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { EnquiryRow, ListingRow } from "@/lib/db/types";
import { listingTitle, timeNZ } from "@/lib/format";
import { Badge, Empty } from "@/components/marketplace/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead inbox" };

const statusTone: Record<string, "neutral" | "ok" | "signal" | "pending"> = {
  new: "signal",
  contacted: "neutral",
  viewing_booked: "pending",
  sold: "ok",
  closed: "neutral",
};

export default async function LeadsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!viewer.dealers[0] && !viewer.isAdmin) redirect("/register-dealer");

  const sb = await supabaseServer();
  const { data: enquiries } = await sb
    .from("enquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (enquiries ?? []) as EnquiryRow[];

  const listingIds = Array.from(new Set(rows.map((r) => r.listing_id)));
  const { data: listings } = listingIds.length
    ? await sb.from("listings").select("*").in("id", listingIds)
    : { data: [] };
  const byId = new Map(
    ((listings ?? []) as ListingRow[]).map((l) => [l.id, l]),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Lead inbox</h1>
      <p className="mt-1 text-sm text-slate-500">
        Every lead has already had its instant AI acknowledgement — your job is
        the human reply. New leads have a draft waiting for approval.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="p-6">
            <Empty
              title="No leads yet"
              body="When a buyer enquires on one of your cars, it lands here — already acknowledged and qualified."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const l = byId.get(e.listing_id);
                return (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="tabular-nums px-4 py-3 text-xs text-slate-500">
                      {timeNZ(e.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {e.buyer_name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {l ? listingTitle(l) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[e.status] ?? "neutral"}>
                        {e.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dealer/leads/${e.id}`}
                        className="rounded font-medium text-slate-900 underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
