import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared marketplace primitives, styled to the live site's design system:
 * white cards with slate-100 borders and rounded-2xl corners, slate text
 * scale, orange-500 primary actions, and bold tabular-nums for data readouts
 * (the same treatment as the Hero stat cards). Focus styling comes from the
 * existing global :focus-visible rule plus the form focus-ring classes below —
 * globals.css is untouched.
 */

export function Btn({
  children,
  href,
  kind = "primary",
  type,
  disabled,
}: {
  children: ReactNode;
  href?: string;
  kind?: "primary" | "quiet" | "danger";
  type?: "submit" | "button";
  disabled?: boolean;
}) {
  const cls =
    kind === "primary"
      ? "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700"
      : kind === "danger"
        ? "border border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50"
        : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900";
  const base = `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${cls}`;
  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "submit"} disabled={disabled} className={base}>
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "signal" | "pending";
}) {
  const cls =
    tone === "ok"
      ? "bg-green-50 text-green-700"
      : tone === "signal"
        ? "bg-orange-50 text-orange-700"
        : tone === "pending"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

/** Data readout stat — bold, tabular-nums, orange when hot (Hero stat treatment). */
export function Stat({
  label,
  value,
  unit,
  hot = false,
}: {
  label: string;
  value: string;
  unit?: string;
  hot?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className={`text-2xl font-bold tabular-nums sm:text-3xl ${hot ? "text-orange-500" : "text-slate-900"}`}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>
        ) : null}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

/** Exact input treatment from the Founding Dealer form (PilotFormClient). */
export const inputCls =
  "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition";

/** Error banner — the live form's red-50 treatment. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}
