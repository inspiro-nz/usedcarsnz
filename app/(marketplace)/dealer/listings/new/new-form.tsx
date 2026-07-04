"use client";

import { useActionState } from "react";
import { createListingAction, type ActionState } from "@/app/(marketplace)/dealer/actions";
import { ErrorNote, Field, inputCls } from "@/components/marketplace/ui";

const initial: ActionState = { ok: false };

export function NewListingForm({ dealerId }: { dealerId: string }) {
  const [state, action, pending] = useActionState(createListingAction, initial);

  if (state.ok) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 text-sm text-green-600">
        Listing created and live. Its title was auto-generated from
        year/make/model — you can refine details any time.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
      <input type="hidden" name="dealer_id" value={dealerId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Make">
          <input name="make" required className={inputCls} placeholder="Toyota" />
        </Field>
        <Field label="Model">
          <input name="model" required className={inputCls} placeholder="Aqua" />
        </Field>
        <Field label="Year">
          <input name="year" type="number" required min={1980} max={2026} className={inputCls} />
        </Field>
        <Field label="Variant (optional)">
          <input name="variant" className={inputCls} placeholder="S Hybrid" />
        </Field>
        <Field label="Body type">
          <input name="body_type" className={inputCls} placeholder="Hatchback" />
        </Field>
        <Field label="Colour">
          <input name="colour" className={inputCls} />
        </Field>
        <Field label="Fuel">
          <select name="fuel" className={inputCls} defaultValue="">
            <option value="">—</option>
            {["petrol", "diesel", "hybrid", "phev", "ev", "other"].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Transmission">
          <select name="transmission" className={inputCls} defaultValue="">
            <option value="">—</option>
            <option value="automatic">automatic</option>
            <option value="manual">manual</option>
            <option value="other">other</option>
          </select>
        </Field>
        <Field label="Odometer (km)">
          <input name="odometer_km" type="number" min={0} className={inputCls} />
        </Field>
        <Field label="Price (NZD)" hint="Leave empty for POA.">
          <input name="price_nzd" type="number" min={0} step={100} className={inputCls} />
        </Field>
        <Field label="Suburb">
          <input name="suburb" className={inputCls} />
        </Field>
        <Field label="City">
          <input name="city" className={inputCls} defaultValue="Christchurch" />
        </Field>
      </div>
      <Field label="Region">
        <input name="region" className={inputCls} defaultValue="Canterbury" />
      </Field>
      <Field label="Description" hint="Up to 2000 characters. Statements here are yours — keep them accurate (Fair Trading Act).">
        <textarea name="description" rows={5} maxLength={2000} className={inputCls} />
      </Field>
      <Field
        label="Consumer Information Notice (CIN) link"
        hint="Required on dealer listings. A placeholder is used if left blank — replace it before advertising."
      >
        <input name="cin_link" type="url" className={inputCls} placeholder="https://…" />
      </Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create listing"}
      </button>
    </form>
  );
}
