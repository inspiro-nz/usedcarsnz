/**
 * ai_drafts approval state machine (§7 compliance envelope), asserted at the
 * SQL boundary. What the DB must REFUSE:
 *   - status='approved' without BOTH approved_by and approved_at (CHECK
 *     ai_drafts_approved_requires_approver) — even for service_role.
 *   - any bare column UPDATE of status/approved_by/approved_at by an
 *     authenticated client (migration 13 revoked table-level UPDATE and
 *     re-granted edited_text ONLY) — approve_draft() is the single path.
 * And what must hold atomically: approve_draft() flips the status AND appends
 * the draft_approved lead_event together, or a failed approval writes neither.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { isLocal, fixtures, suid, draftApprovedEvents, type Fixtures } from "./helpers";

async function freshPendingDraft(fx: Fixtures, key: string): Promise<string> {
  // Random per run: approval consumes a draft, so re-runs need a new one.
  const id = crypto.randomUUID();
  const { error } = await fx.svc.from("ai_drafts").insert({
    id,
    enquiry_id: fx.a.enquiryId,
    draft_text: `Approval-test draft (${key}).`,
    status: "pending",
  });
  if (error) throw new Error(`fixture draft: ${error.message}`);
  return id;
}

describe.skipIf(!isLocal)("ai_drafts approval state machine (SQL boundary)", () => {
  let fx: Fixtures;

  beforeAll(async () => {
    fx = await fixtures();
  });

  it("CHECK: even service_role cannot set status='approved' without approver fields", async () => {
    const draftId = await freshPendingDraft(fx, "check-both-null");
    const res = await fx.svc.from("ai_drafts").update({ status: "approved" }).eq("id", draftId);
    expect(res.error, "approved without approved_by/approved_at must violate the CHECK").not.toBeNull();
    expect(res.error?.code).toBe("23514");

    // Partial approver info must fail too (CHECK requires BOTH).
    const res2 = await fx.svc
      .from("ai_drafts")
      .update({ status: "approved", approved_by: fx.a.userId })
      .eq("id", draftId);
    expect(res2.error?.code).toBe("23514");

    const still = await fx.svc.from("ai_drafts").select("status").eq("id", draftId).single();
    expect(still.data?.status).toBe("pending");
  });

  it("authenticated dealer cannot forge an approval via bare UPDATE (column grant is edited_text only)", async () => {
    const res = await fx.a.client
      .from("ai_drafts")
      .update({ status: "approved", approved_by: fx.a.userId, approved_at: new Date().toISOString() })
      .eq("id", fx.a.pendingDraftId);
    expect(res.error, "bare status UPDATE by a client must be rejected").not.toBeNull();
    expect(res.error?.code).toBe("42501");

    const still = await fx.svc.from("ai_drafts").select("status").eq("id", fx.a.pendingDraftId).single();
    expect(still.data?.status).toBe("pending");
  });

  it("...but the same dealer MAY edit edited_text on their own draft (exactly what the grant allows)", async () => {
    const text = `edited at ${Date.now()}`;
    const res = await fx.a.client
      .from("ai_drafts")
      .update({ edited_text: text })
      .eq("id", fx.a.pendingDraftId)
      .select("edited_text")
      .single();
    expect(res.error).toBeNull();
    expect(res.data?.edited_text).toBe(text);
  });

  it("approve_draft(): approval writes the status change AND the draft_approved event atomically", async () => {
    const draftId = await freshPendingDraft(fx, "happy-path");
    expect(await draftApprovedEvents(fx.svc, draftId)).toBe(0);

    const { error } = await fx.a.client.rpc("approve_draft", { p_draft_id: draftId });
    expect(error).toBeNull();

    const after = await fx.svc
      .from("ai_drafts")
      .select("status, approved_by, approved_at")
      .eq("id", draftId)
      .single();
    expect(after.data?.status).toBe("approved");
    expect(after.data?.approved_by).toBe(fx.a.userId);
    expect(after.data?.approved_at).toBeTruthy();
    expect(await draftApprovedEvents(fx.svc, draftId)).toBe(1);
  });

  /**
   * ── KNOWN HOLE — T2 FINDING #1 (founder decision; do not fix in this package) ──
   * approve_draft()'s guard fails OPEN for dealer-lane drafts. seller_user_id
   * is NULL on every dealer draft, so `v_draft.seller_user_id = auth.uid()`
   * evaluates to NULL and `IF NOT (false OR NULL OR false)` is NULL → the
   * RAISE is skipped (SQL three-valued logic). ANY authenticated user — even
   * an unrelated buyer account — can approve ANY dealer's pending draft,
   * forging approved_by/approved_at and a draft_approved lead_event.
   * Fix (new migration): coalesce the equality, e.g.
   *   or coalesce(v_draft.seller_user_id = (select auth.uid()), false)
   * This is `it.fails`: it asserts the INTENDED behaviour and is expected to
   * fail while the hole exists. When a migration fixes approve_draft, this
   * test will flip to "unexpectedly passing" — change it to a plain `it` then.
   * (RLS policies with the same NULL comparison are safe — a NULL USING/CHECK
   * fails CLOSED; only this plpgsql IF fails open.)
   */
  it.fails("approve_draft(): an unauthorized approval writes NEITHER the status nor the event [KNOWN HOLE — see comment]", async () => {
    const draftId = await freshPendingDraft(fx, "unauthorized");

    // Dealer B is not a member of dealer A — must be refused.
    const { error } = await fx.b.client.rpc("approve_draft", { p_draft_id: draftId });
    expect(error, "cross-dealer approve_draft must be rejected").not.toBeNull();

    const still = await fx.svc
      .from("ai_drafts")
      .select("status, approved_by, approved_at")
      .eq("id", draftId)
      .single();
    expect(still.data?.status).toBe("pending");
    expect(still.data?.approved_by).toBeNull();
    expect(still.data?.approved_at).toBeNull();
    expect(await draftApprovedEvents(fx.svc, draftId)).toBe(0);
  });

  it("approve_draft(): re-approving a non-pending draft fails and writes no second event", async () => {
    const draftId = await freshPendingDraft(fx, "double-approve");
    const first = await fx.a.client.rpc("approve_draft", { p_draft_id: draftId });
    expect(first.error).toBeNull();

    const second = await fx.a.client.rpc("approve_draft", { p_draft_id: draftId });
    expect(second.error, "second approval must be rejected (must be pending)").not.toBeNull();
    expect(await draftApprovedEvents(fx.svc, draftId)).toBe(1);
  });

  it("anon cannot execute approve_draft at all", async () => {
    const { error } = await fx.anon.rpc("approve_draft", { p_draft_id: suid("draft-pending:a") });
    expect(error, "anon approve_draft must be rejected").not.toBeNull();
  });
});
