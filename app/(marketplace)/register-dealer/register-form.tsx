"use client";

import { useActionState } from "react";
import { registerDealer, type RegisterState } from "./actions";
import { ErrorNote, Field, inputCls } from "@/components/marketplace/ui";

const initial: RegisterState = { ok: false };

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerDealer, initial);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
        <h2 className="font-semibold text-slate-900">Registration received</h2>
        <p className="mt-2 text-sm text-slate-700">
          Your dealership is <strong>pending approval</strong>. We verify every
          dealer against the NZBN register before listings go live — you&apos;ll
          be able to list as soon as you&apos;re approved.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <input name="business_name" required className={inputCls} />
        </Field>
        <Field label="NZBN" hint="Used to verify your dealership.">
          <input name="nzbn" className={inputCls} inputMode="numeric" />
        </Field>
        <Field label="Contact name">
          <input name="contact_name" className={inputCls} />
        </Field>
        <Field label="Contact email">
          <input name="email" type="email" className={inputCls} />
        </Field>
        <Field label="Phone">
          <input name="phone" className={inputCls} />
        </Field>
        <Field label="Suburb">
          <input name="suburb" className={inputCls} />
        </Field>
        <Field label="City">
          <input name="city" className={inputCls} defaultValue="Christchurch" />
        </Field>
        <Field label="Region">
          <input name="region" className={inputCls} defaultValue="Canterbury" />
        </Field>
      </div>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Register dealership"}
      </button>
    </form>
  );
}
