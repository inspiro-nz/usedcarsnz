"use client";

import { useActionState } from "react";
import { approveDraftAction, type ActionState } from "@/app/(marketplace)/dealer/actions";
import { ErrorNote } from "@/components/marketplace/ui";

const initial: ActionState = { ok: false };

/** The §7 human-approval gate, as UI: review, edit, approve & send. */
export function ApproveDraftForm({
  enquiryId,
  draftId,
  draftText,
}: {
  enquiryId: string;
  draftId: string;
  draftText: string;
}) {
  const [state, action, pending] = useActionState(approveDraftAction, initial);

  if (state.ok) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 text-sm text-green-600">
        Reply approved and sent. Logged as <span className="tabular-nums">draft_approved → reply_sent</span>.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="enquiry_id" value={enquiryId} />
      <input type="hidden" name="draft_id" value={draftId} />
      <textarea
        name="reply_text"
        defaultValue={draftText}
        rows={10}
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
        aria-label="AI-drafted reply — edit before sending"
      />
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          You are the approval step. Statements about this vehicle&apos;s
          condition, history, or spec are yours, not the assistant&apos;s.
        </p>
        <button
          disabled={pending}
          className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Approve & send"}
        </button>
      </div>
    </form>
  );
}
