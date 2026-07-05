import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { SetPasswordForm } from "@/components/marketplace/set-password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/forgot-password");

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <div className="mt-6">
        <SetPasswordForm onSuccessRedirect="/account" submitLabel="Set new password" />
      </div>
    </main>
  );
}
