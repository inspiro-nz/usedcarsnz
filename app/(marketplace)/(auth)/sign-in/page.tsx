import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">
        Dealers and buyers with an account.
      </p>
      <div className="mt-6">
        <AuthForm mode="sign-in" />
      </div>
      <p className="mt-4 text-sm text-slate-500">
        New here?{" "}
        <Link href="/sign-up" className="rounded text-slate-900 underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
