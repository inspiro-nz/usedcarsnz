import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
      <p className="mt-1 text-sm text-slate-500">
        We&apos;ll email you a link to set a new one.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
