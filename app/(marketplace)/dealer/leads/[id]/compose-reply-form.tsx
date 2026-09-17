"use client";

import { useActionState, useEffect, useRef } from "react";
import { composeReplyAction, type ActionState } from "@/app/(marketplace)/dealer/actions";
import { ErrorNote } from "@/components/marketplace/ui";

const initial: ActionState = { ok: false };

/** Free-text reply box for when there's no AI draft to approve — the only
 *  other way a dealer message can reach the buyer (see sendDealerReply). */
export function ComposeReplyForm({ enquiryId }: { enquiryId: string }) {
  const [state, action, pending] = useActionState(composeReplyAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="enquiry_id" value={enquiryId} />
      <textarea
        name="reply_text"
        rows={6}
        placeholder="Write a reply to the buyer…"
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
        aria-label="Write a reply to the buyer"
      />
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok ? <p className="text-xs text-green-600">Sent.</p> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Sent to the buyer as your reply and logged in the conversation.
        </p>
        <button
          disabled={pending}
          className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </form>
  );
}
