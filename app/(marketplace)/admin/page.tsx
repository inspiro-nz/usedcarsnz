import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { DealerRow } from "@/lib/db/types";
import { timeNZ } from "@/lib/format";
import { Badge, Empty } from "@/components/marketplace/ui";
import { approveDealerAction, rejectDealerAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!viewer.isAdmin) redirect("/");

  const sb = await supabaseServer();
  const { data } = await sb
    .from("dealers")
    .select("*")
    .order("created_at", { ascending: false });
  const dealers = (data ?? []) as DealerRow[];
  const pending = dealers.filter((d) => d.status === "pending");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-slate-500">
        Dealer approval queue. Verify the NZBN before approving (§9.6) — approval
        turns on the verified badge and lets listings go live.
      </p>

      <section className="mt-6">
        <h2 className="font-semibold text-slate-900">
          Pending approval{" "}
          <span className="text-sm font-bold tabular-nums text-orange-600">{pending.length}</span>
        </h2>
        <div className="mt-3 space-y-3">
          {pending.length === 0 ? (
            <Empty title="Queue clear" body="No dealers waiting on approval." />
          ) : (
            pending.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white shadow-sm p-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{d.business_name}</p>
                  <p className="tabular-nums mt-0.5 text-xs text-slate-500">
                    NZBN {d.nzbn ?? "—"} · {d.city ?? "—"} · registered{" "}
                    {timeNZ(d.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveDealerAction}>
                    <input type="hidden" name="dealer_id" value={d.id} />
                    <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700">
                      Approve & verify
                    </button>
                  </form>
                  <form action={rejectDealerAction}>
                    <input type="hidden" name="dealer_id" value={d.id} />
                    <button className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-slate-900">All dealers</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Dealer</th>
                <th className="px-4 py-3">NZBN</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {dealers.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{d.business_name}</td>
                  <td className="tabular-nums px-4 py-3 text-xs">{d.nzbn ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{d.city ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={d.status === "approved" ? "ok" : d.status === "pending" ? "pending" : "neutral"}>
                      {d.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
