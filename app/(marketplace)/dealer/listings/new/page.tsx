import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { NewListingForm } from "./new-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New listing" };

export default async function NewListingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const dealer = viewer.dealers[0];
  if (!dealer) redirect("/register-dealer");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">New listing</h1>
      <p className="mt-1 text-sm text-slate-500">
        Photos and bulk import arrive with the Motorcentral / CSV pipeline —
        this form covers the core fields so the enquiry engine can go to work.
      </p>
      <div className="mt-6">
        <NewListingForm dealerId={dealer.id} />
      </div>
    </main>
  );
}
