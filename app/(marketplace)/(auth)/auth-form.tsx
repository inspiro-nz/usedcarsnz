"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ErrorNote, Field, inputCls } from "@/components/marketplace/ui";

export function AuthForm({
  mode,
  next,
}: {
  mode: "sign-in" | "sign-up";
  /** Optional in-app return-to, forwarded to the role router on success. */
  next?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const sb = supabaseBrowser();
      if (mode === "sign-up") {
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`,
          },
        });
        if (error) setError(error.message);
        else setDone(true);
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        else {
          // Route through the server-side role router so a dealer lands on
          // their dashboard, a buyer on their account — never the marketing
          // page. `next` (if any) is validated there, not trusted here.
          router.push(next ? `/home?next=${encodeURIComponent(next)}` : "/home");
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 text-sm text-slate-900">
        Account created. If email confirmation is enabled for this environment,
        check your inbox to confirm, then sign in.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "sign-up" ? (
        <Field label="Full name">
          <input
            className={inputCls}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </Field>
      ) : null}
      <Field label="Email">
        <input
          className={inputCls}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </Field>
      <Field label="Password">
        <input
          className={inputCls}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        />
      </Field>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <button
        disabled={busy}
        className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {busy ? "Working…" : mode === "sign-up" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
