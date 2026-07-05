import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Buyers can browse and enquire without one — you only need an account to
        save cars or to list as a dealer.
      </p>
      <div className="mt-6">
        <AuthForm mode="sign-up" />
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Already have one?{" "}
        <Link href="/sign-in" className="rounded text-slate-900 underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
