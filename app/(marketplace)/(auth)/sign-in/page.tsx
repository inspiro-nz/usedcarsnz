import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">
        Dealers and buyers with an account.
      </p>
      {params.deleted ? (
        <p className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-4 text-sm text-slate-700">
          Your account has been deleted.
        </p>
      ) : null}
      {params.error === "auth-callback-failed" ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          That link has expired or already been used. Please try again.
        </p>
      ) : null}
      <div className="mt-6">
        <AuthForm mode="sign-in" />
      </div>
      <p className="mt-4 text-sm text-slate-500">
        <Link href="/forgot-password" className="rounded text-slate-900 underline">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-slate-500">
        New here?{" "}
        <Link href="/sign-up" className="rounded text-slate-900 underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
