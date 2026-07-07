import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  supabaseService: () => ({ rpc: rpcMock }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ from: fromMock }),
}));

import { emitLeadEvent, readTimeline } from "./events";

describe("emitLeadEvent", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: "event-id-123", error: null });
  });

  it("maps a typed input to the log_lead_event RPC shape", async () => {
    const id = await emitLeadEvent({
      leadId: "lead-1",
      eventType: "marked_sold",
      actor: "human",
      metadata: { sold_price: 15000 },
    });

    expect(id).toBe("event-id-123");
    expect(rpcMock).toHaveBeenCalledWith("log_lead_event", {
      p_lead_id: "lead-1",
      p_event_type: "marked_sold",
      p_actor: "human",
      p_payload: { sold_price: 15000 },
    });
  });

  it("passes occurredAt through as p_occurred_at only when given", async () => {
    await emitLeadEvent({
      leadId: "lead-1",
      eventType: "buyer_message_received",
      actor: "system",
      metadata: { channel: "email" },
      occurredAt: "2026-07-01T00:00:00.000Z",
    });

    expect(rpcMock).toHaveBeenCalledWith("log_lead_event", {
      p_lead_id: "lead-1",
      p_event_type: "buyer_message_received",
      p_actor: "system",
      p_payload: { channel: "email" },
      p_occurred_at: "2026-07-01T00:00:00.000Z",
    });
  });

  it("carries the compliance-envelope ack_sent metadata (templated ack, no vehicle content)", async () => {
    await emitLeadEvent({
      leadId: "lead-1",
      eventType: "ack_sent",
      actor: "ai",
      metadata: { channel: "email", template: "first-touch-v1" },
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "log_lead_event",
      expect.objectContaining({
        p_event_type: "ack_sent",
        p_actor: "ai",
        p_payload: { channel: "email", template: "first-touch-v1" },
      }),
    );
  });

  it("carries the draft_approved audit metadata (human actor, approver on record)", async () => {
    await emitLeadEvent({
      leadId: "lead-1",
      eventType: "draft_approved",
      actor: "human",
      metadata: { draft_id: "draft-1", approved_by: "user-1", edited: true },
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "log_lead_event",
      expect.objectContaining({
        p_event_type: "draft_approved",
        p_actor: "human",
        p_payload: { draft_id: "draft-1", approved_by: "user-1", edited: true },
      }),
    );
  });

  it("throws a descriptive error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(
      emitLeadEvent({
        leadId: "lead-1",
        eventType: "lead_closed",
        actor: "human",
        metadata: { reason: "buyer withdrew" },
      }),
    ).rejects.toThrow(/lead_closed.*boom/);
  });

  // Never invoked — exists purely so `npm run typecheck` proves the
  // discriminated union rejects a metadata shape that doesn't match its
  // event_type. If a shape below stops being an error, typecheck fails on
  // the unused @ts-expect-error, which is exactly the point.
  function _typeAssertions() {
    void emitLeadEvent({
      leadId: "x",
      eventType: "marked_sold",
      actor: "ai",
      // @ts-expect-error qualification fields don't belong to marked_sold's metadata
      metadata: { finance: "yes" },
    });
    void emitLeadEvent({
      leadId: "x",
      eventType: "appointment_booked",
      actor: "human",
      // @ts-expect-error appointment_booked requires AppointmentBookedMeta, not a string
      metadata: "nope",
    });
  }
  void _typeAssertions;
});

describe("readTimeline", () => {
  it("reads lead_events for the enquiry, oldest first, via the caller's RLS-scoped client", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "e1", lead_id: "lead-1", event_type: "enquiry_received", occurred_at: "t0" },
      ],
      error: null,
    });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    fromMock.mockReturnValue({ select: selectMock });

    const rows = await readTimeline("lead-1");

    expect(fromMock).toHaveBeenCalledWith("lead_events");
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(eqMock).toHaveBeenCalledWith("lead_id", "lead-1");
    expect(orderMock).toHaveBeenCalledWith("occurred_at", { ascending: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe("enquiry_received");
  });

  it("throws a descriptive error when the read fails", async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } });
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ order: orderMock }) }),
    });

    await expect(readTimeline("lead-1")).rejects.toThrow(/lead-1.*denied/);
  });
});
