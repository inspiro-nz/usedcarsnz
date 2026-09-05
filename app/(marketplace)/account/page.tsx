import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { EnquiryRow, ListingRow } from "@/lib/db/types";
import { listingTitle, timeNZ } from "@/lib/format";
import { signOutAction } from "@/app/(marketplace)/(auth)/actions";
import { SetPasswordForm } from "@/components/marketplace/set-password-form";
import { Badge, Btn, Empty, ErrorNote } from "@/components/marketplace/ui";
import { DeleteAccountForm } from "./delete-account-form";

const statusTone: Record<string, "neutral" | "ok" | "signal" | "pending"> = {
  new: "signal",
  contacted: "neutral",
  viewing_booked: "pending",
  sold: "ok",
  closed: "neutral",
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const params = await searchParams;
  const dealer = viewer.dealers[0] ?? null;

  // The buyer's own enquiries — RLS grants a buyer their rows where
  // buyer_user_id matches; the explicit filter keeps this to "enquiries I made
  // as a buyer" even for an account that also belongs to a dealership.
  const sb = await supabaseServer();
  const { data: enquiryRows } = await sb
    .from("enquiries")
    .select("id, listing_id, status, created_at")
    .eq("buyer_user_id", viewer.user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const enquiries = (enquiryRows ?? []) as Pick<
    EnquiryRow,
    "id" | "listing_id" | "status" | "created_at"
  >[];
  const listingIds = Array.from(new Set(enquiries.map((e) => e.listing_id)));
  const { data: listingRows } = listingIds.length
    ? await sb
        .from("listings")
        .select("id, title, year, make, model")
        .in("id", listingIds)
    : { data: [] };
  const listingById = new Map(
    ((listingRows ?? []) as Pick<
      ListingRow,
      "id" | "title" | "year" | "make" | "model"
    >[]).map((l) => [l.id, l]),
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">My account</h1>

      {params.error === "owns-dealer" ? (
        <div className="mt-4">
          <ErrorNote>
            You can&apos;t delete your account while you own a dealership.
            Transfer ownership or contact us to wind it down first.
          </ErrorNote>
        </div>
      ) : null}
      {params.error === "delete-failed" ? (
        <div className="mt-4">
          <ErrorNote>
            Something went wrong deleting your account. Please try again or
            contact us.
          </ErrorNote>
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Your enquiries</h2>
          <Btn href="/cars" kind="quiet">
            Browse cars
          </Btn>
        </div>

        {enquiries.length === 0 ? (
          <div className="mt-4">
            <Empty
              title="No enquiries yet"
              body="Found something you like? Send an enquiry and the dealer's AI assistant acknowledges you in under a minute."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {enquiries.map((e) => {
              const l = listingById.get(e.listing_id);
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {l ? listingTitle(l) : "A vehicle"}
                    </p>
                    <p className="tabular-nums mt-0.5 text-xs text-slate-500">
                      {timeNZ(e.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={statusTone[e.status] ?? "neutral"}>
                      {e.status.replace("_", " ")}
                    </Badge>
                    <Link
                      href={`/thread/${e.id}`}
                      className="rounded text-sm font-medium text-slate-900 underline"
                    >
                      View
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
        <h2 className="font-semibold text-slate-900">Profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Name</dt>
            <dd className="text-slate-900">{viewer.user.full_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-900">{viewer.user.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Account type</dt>
            <dd>
              <Badge tone={viewer.isAdmin ? "signal" : "neutral"}>
                {viewer.user.role}
              </Badge>
            </dd>
          </div>
        </dl>

        {dealer ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {dealer.business_name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={dealer.status === "approved" ? "ok" : "pending"}>
                    {dealer.status}
                  </Badge>
                  {dealer.verified ? <Badge tone="ok">verified</Badge> : null}
                </div>
              </div>
              <Btn href="/dealer" kind="quiet">
                Dashboard
              </Btn>
            </div>
          </div>
        ) : (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">
              Not listing yet?{" "}
              <a href="/register-dealer" className="text-slate-900 underline">
                Register your dealership
              </a>
              .
            </p>
          </div>
        )}

        <form action={signOutAction} className="mt-6 border-t border-slate-100 pt-4">
          <button className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
            Sign out
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
        <h2 className="font-semibold text-slate-900">Change password</h2>
        <div className="mt-4">
          <SetPasswordForm onSuccessRedirect="/account" />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-red-100 bg-white shadow-sm p-6">
        <h2 className="font-semibold text-slate-900">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-500">
          Permanently delete your account and profile data. This can&apos;t be
          undone.
        </p>
        <div className="mt-4">
          <DeleteAccountForm />
        </div>
      </section>
    </main>
  );
}
