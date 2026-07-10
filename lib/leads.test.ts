import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The §7 compliance-envelope gate (strategy v5.3 §7, audit §6/§10.4).
 *
 * These tests assert the INVARIANT, not the comments: no code path may put a
 * free-text dealer reply on the wire unless the draft is status='approved' with
 * an approver on record, and that pending -> approved transition happens ONLY
 * via the approve_draft() DB state machine.
 *
 * The fake below models the two role boundaries faithfully:
 *   - supabaseServer()  = the signed-in dealer (RLS-scoped): reads/writes are
 *     filtered by is_dealer_member/seller_user_id/is_admin, and rpc('approve_draft')
 *     mirrors migration 13 — it authorizes, requires status='pending', flips the
 *     row to 'approved' with approved_by=auth.uid(), AND logs draft_approved itself.
 *   - supabaseService() = the backend (RLS-bypass): used only to send + finalize.
 * Both clients operate over ONE shared world, so what the dealer approves is what
 * the send step reads.
 */

type Row = Record<string, unknown>;

interface EventRow {
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
}

interface World {
  enquiries: Row[];
  ai_drafts: Row[];
  events: EventRow[];
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
}

interface Auth {
  authUid: string | null;
  memberDealerIds: Set<string>;
  isAdmin: boolean;
}

const H = vi.hoisted(() => ({
  state: null as { world: World; auth: Auth } | null,
  sendEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ sendEmail: H.sendEmail }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => makeAuthedClient(),
}));
vi.mock("@/lib/supabase/service", () => ({
  supabaseService: () => makeServiceClient(),
}));

import { approveAndSendDraft, sendApprovedReply } from "@/lib/leads";

function world(): World {
  if (!H.state) throw new Error("test world not seeded");
  return H.state.world;
}
function auth(): Auth {
  if (!H.state) throw new Error("test auth not seeded");
  return H.state.auth;
}

/** Mirrors the RLS predicate on enquiries/ai_drafts (migration 07). */
function canAccess(a: Auth, row: Row): boolean {
  if (!a.authUid) return false;
  if (a.isAdmin) return true;
  if (typeof row.dealer_id === "string" && a.memberDealerIds.has(row.dealer_id))
    return true;
  if (row.seller_user_id && row.seller_user_id === a.authUid) return true;
  return false;
}

class Builder {
  private filters: [string, unknown][] = [];
  private mode: "select" | "update" = "select";
  private patch: Row | null = null;

  constructor(
    private rows: Row[],
    private rls: boolean,
  ) {}

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  private match(): Row[] {
    return this.rows.filter(
      (r) =>
        this.filters.every(([c, v]) => r[c] === v) &&
        (!this.rls || canAccess(auth(), r)),
    );
  }

  single<T = Row>() {
    const data = (this.match()[0] as T | undefined) ?? null;
    return Promise.resolve({ data, error: null });
  }

  then<R1 = { data: unknown; error: null }, R2 = never>(
    onfulfilled?:
      | ((v: { data: unknown; error: null }) => R1 | PromiseLike<R1>)
      | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const rows = this.match();
    if (this.mode === "update" && this.patch) {
      for (const r of rows) Object.assign(r, this.patch);
    }
    return Promise.resolve({ data: rows, error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function makeAuthedClient() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: auth().authUid ? { id: auth().authUid } : null },
      }),
    },
    from(table: keyof World) {
      return new Builder(world()[table] as Row[], true);
    },
    rpc(fn: string, args: Record<string, unknown>) {
      world().rpcCalls.push({ fn, args });
      if (fn === "approve_draft") return approveDraftRpc(args);
      return Promise.resolve({ data: null, error: null });
    },
  };
}

function makeServiceClient() {
  return {
    from(table: keyof World) {
      return new Builder(world()[table] as Row[], false);
    },
    rpc(fn: string, args: Record<string, unknown>) {
      world().rpcCalls.push({ fn, args });
      if (fn === "log_lead_event") {
        world().events.push({
          event_type: String(args.p_event_type),
          actor: String(args.p_actor),
          payload: (args.p_payload ?? {}) as Record<string, unknown>,
        });
        return Promise.resolve({ data: "event-id", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

/** Faithful stand-in for approve_draft() (migration 13). */
function approveDraftRpc(args: Record<string, unknown>) {
  const d = world().ai_drafts.find((r) => r.id === args.p_draft_id);
  if (!d) {
    return Promise.resolve({
      data: null,
      error: { message: `unknown draft ${String(args.p_draft_id)}` },
    });
  }
  if (!canAccess(auth(), d)) {
    return Promise.resolve({
      data: null,
      error: { message: "not authorized", code: "42501" },
    });
  }
  if (d.status !== "pending") {
    return Promise.resolve({
      data: null,
      error: { message: `draft is ${String(d.status)} (must be pending)` },
    });
  }
  d.status = "approved";
  d.approved_by = auth().authUid;
  d.approved_at = new Date().toISOString();
  world().events.push({
    event_type: "draft_approved",
    actor: "human",
    payload: { draft_id: d.id },
  });
  return Promise.resolve({ data: null, error: null });
}

// --- fixtures -------------------------------------------------------------

const DEALER = "dealer-1";
const OTHER_DEALER = "dealer-2";
const USER = "user-1";

function seed(opts: {
  auth?: Partial<Auth>;
  draftStatus?: string;
  draftDealer?: string;
  enquiryDealer?: string;
  enquiryStatus?: string;
  editedText?: string | null;
} = {}) {
  const enquiry: Row = {
    id: "enq-1",
    dealer_id: opts.enquiryDealer ?? DEALER,
    seller_user_id: null,
    buyer_email: "buyer@example.com",
    status: opts.enquiryStatus ?? "new",
  };
  const draft: Row = {
    id: "draft-1",
    enquiry_id: "enq-1",
    dealer_id: opts.draftDealer ?? DEALER,
    seller_user_id: null,
    draft_text: "Original AI proposal.",
    edited_text: opts.editedText ?? null,
    status: opts.draftStatus ?? "pending",
    approved_by: null,
    approved_at: null,
    sent_at: null,
  };
  H.state = {
    world: { enquiries: [enquiry], ai_drafts: [draft], events: [], rpcCalls: [] },
    auth: {
      authUid: USER,
      memberDealerIds: new Set([DEALER]),
      isAdmin: false,
      ...opts.auth,
    },
  };
  return { enquiry, draft };
}

function eventsOf(type: string) {
  return world().events.filter((e) => e.event_type === type);
}

beforeEach(() => {
  H.sendEmail.mockReset();
  H.sendEmail.mockResolvedValue({ sent: true });
});

describe("§7 approve-gate — no free-text reply without an approved draft", () => {
  it("refuses to send an unapproved (pending) draft — throws, no email, no reply_sent", async () => {
    seed({ draftStatus: "pending" });

    await expect(
      sendApprovedReply({
        enquiryId: "enq-1",
        draftId: "draft-1",
        buyerEmail: "buyer@example.com",
      }),
    ).rejects.toThrow(/not approved/i);

    expect(H.sendEmail).not.toHaveBeenCalled();
    expect(eventsOf("reply_sent")).toHaveLength(0);
    expect(world().ai_drafts[0].status).toBe("pending");
  });

  it("refuses to send a draft marked approved but with no approver on record", async () => {
    const { draft } = seed({ draftStatus: "approved" });
    draft.approved_by = null; // the CHECK-constraint-violating shape must never send

    await expect(
      sendApprovedReply({
        enquiryId: "enq-1",
        draftId: "draft-1",
        buyerEmail: "buyer@example.com",
      }),
    ).rejects.toThrow(/not approved/i);
    expect(H.sendEmail).not.toHaveBeenCalled();
  });

  it("approves via approve_draft() then sends — exactly one draft_approved (from the RPC) and one reply_sent (actor=human)", async () => {
    seed({ draftStatus: "pending" });

    await approveAndSendDraft({
      enquiryId: "enq-1",
      draftId: "draft-1",
      editedText: "",
    });

    // The sanctioned transition ran, and only it.
    expect(world().rpcCalls.some((c) => c.fn === "approve_draft")).toBe(true);
    expect(eventsOf("draft_approved")).toHaveLength(1);
    expect(eventsOf("draft_approved")[0].actor).toBe("human");

    // The reply was sent, once, as the human.
    const replySent = eventsOf("reply_sent");
    expect(replySent).toHaveLength(1);
    expect(replySent[0].actor).toBe("human");
    expect(H.sendEmail).toHaveBeenCalledTimes(1);

    // Draft is now sent, with the approver and timestamps set by the RPC/finalize.
    const draft = world().ai_drafts[0];
    expect(draft.status).toBe("sent");
    expect(draft.approved_by).toBe(USER);
    expect(draft.sent_at).toBeTruthy();

    // No free text left the building before the draft was approved: the email
    // carries the approved text, and the send happened after approval.
    expect(H.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Original AI proposal." }),
    );
  });

  it("rejects a dealer approving a lead they do not own (RLS + auth boundary) — nothing sent, draft stays pending", async () => {
    seed({
      enquiryDealer: OTHER_DEALER,
      draftDealer: OTHER_DEALER,
      // signed-in dealer is a member of DEALER only, not OTHER_DEALER
      auth: { authUid: USER, memberDealerIds: new Set([DEALER]), isAdmin: false },
    });

    await expect(
      approveAndSendDraft({
        enquiryId: "enq-1",
        draftId: "draft-1",
        editedText: "hi",
      }),
    ).rejects.toThrow(/not found|access/i);

    expect(H.sendEmail).not.toHaveBeenCalled();
    expect(eventsOf("draft_approved")).toHaveLength(0);
    expect(eventsOf("reply_sent")).toHaveLength(0);
    expect(world().ai_drafts[0].status).toBe("pending");
    expect(world().ai_drafts[0].approved_by).toBeNull();
  });

  it("aborts the send if the DB state machine (approve_draft) refuses the transition", async () => {
    // Draft is already non-pending in the DB — approve_draft() would raise. The
    // pre-check reflects that too, but the point is: no send without approval.
    seed({ draftStatus: "sent" });

    await expect(
      approveAndSendDraft({
        enquiryId: "enq-1",
        draftId: "draft-1",
        editedText: "hi",
      }),
    ).rejects.toThrow(/not pending/i);
    expect(H.sendEmail).not.toHaveBeenCalled();
    expect(eventsOf("reply_sent")).toHaveLength(0);
  });

  it("sends and persists the dealer's edited text while retaining the original AI text for audit", async () => {
    seed({ draftStatus: "pending" });

    await approveAndSendDraft({
      enquiryId: "enq-1",
      draftId: "draft-1",
      editedText: "Human-edited final reply — this is what the buyer gets.",
    });

    // The buyer receives exactly the edited text.
    expect(H.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Human-edited final reply — this is what the buyer gets.",
      }),
    );

    const draft = world().ai_drafts[0];
    // Edit persisted...
    expect(draft.edited_text).toBe(
      "Human-edited final reply — this is what the buyer gets.",
    );
    // ...and the original AI proposal is retained untouched for the audit trail.
    expect(draft.draft_text).toBe("Original AI proposal.");
    expect(draft.status).toBe("sent");
  });

  it("advances the enquiry from new -> contacted on a successful send", async () => {
    seed({ draftStatus: "pending", enquiryStatus: "new" });

    await approveAndSendDraft({
      enquiryId: "enq-1",
      draftId: "draft-1",
      editedText: "",
    });

    expect(world().enquiries[0].status).toBe("contacted");
  });
});
