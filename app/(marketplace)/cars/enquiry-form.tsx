"use client";

import { useActionState } from "react";
import { submitEnquiry, type EnquiryFormState } from "./actions";
import { ErrorNote, Field, inputCls } from "@/components/marketplace/ui";

const initial: EnquiryFormState = { ok: false };

export function EnquiryForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState(submitEnquiry, initial);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 tabular-nums">
          answered in {state.respondedInSeconds}s
        </p>
        <h3 className="mt-2 font-semibold text-slate-900">
          Enquiry sent — and already acknowledged.
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          Our AI assistant has confirmed your enquiry by email and passed it to
          the seller as a qualified lead. A human will reply about the vehicle
          itself. That first-touch time is recorded on our public metric.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
      <input type="hidden" name="listing_id" value={listingId} />
      {/* Honeypot — hidden from real users, catches autofill bots (matches the landing form) */}
      <input
        type="text"
        name="website"
        style={{ display: "none" }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div>
        <h3 className="font-semibold text-slate-900">Enquire about this car</h3>
        <p className="mt-1 text-xs text-slate-500">
          No account needed. First response in under 60 seconds — it&apos;s
          what we measure ourselves on.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required className={inputCls} autoComplete="name" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className={inputCls} autoComplete="email" />
        </Field>
      </div>
      <Field label="Phone (optional)">
        <input name="phone" className={inputCls} autoComplete="tel" />
      </Field>
      <Field label="Message (optional)">
        <textarea name="message" rows={3} className={inputCls} placeholder="Ask anything — is it available, can I view it…" />
      </Field>

      <fieldset className="rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Help the seller help you (optional)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rough budget (NZD)">
            <input name="budget_nzd" type="number" min={0} step={500} className={inputCls} />
          </Field>
          <Field label="Interested in finance?">
            <select name="finance" className={inputCls} defaultValue="">
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unsure">Not sure yet</option>
            </select>
          </Field>
          <Field label="Trade-in?">
            <select name="trade_in" className={inputCls} defaultValue="">
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="When are you buying?">
            <select name="timeline" className={inputCls} defaultValue="">
              <option value="">—</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="browsing">Just browsing</option>
            </select>
          </Field>
        </div>
      </fieldset>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <button
        disabled={pending}
        className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send enquiry"}
      </button>
      <p className="text-xs text-slate-500">
        You&apos;ll get an instant automated acknowledgement from our clearly
        labelled AI assistant. Anything about this specific vehicle comes from
        the seller, approved by a human.
      </p>
    </form>
  );
}
