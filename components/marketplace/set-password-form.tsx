"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ErrorNote, Field, inputCls, Btn } from "@/components/marketplace/ui";

export function SetPasswordForm({
  onSuccessRedirect,
  submitLabel = "Update password",
}: {
  onSuccessRedirect: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.auth.updateUser({ password });
      if (error) setError(error.message);
      else {
        setDone(true);
        router.push(onSuccessRedirect);
        router.refresh();
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
        Password updated.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="New password">
        <input
          className={inputCls}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          className={inputCls}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Btn type="submit" disabled={busy}>
        {busy ? "Working…" : submitLabel}
      </Btn>
    </form>
  );
}
