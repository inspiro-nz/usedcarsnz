import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Register your dealership" };

export default async function RegisterDealerPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Register your dealership
      </h1>
      <p className="mt-2 text-sm text-slate-700">
        Free while we prove the numbers. Keep your Trade Me listings — add us,
        get every enquiry answered in under a minute, and see your real
        conversion on a dashboard you can hold us to.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </main>
  );
}
