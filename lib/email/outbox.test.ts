import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock, emitLeadEventMock, insertMock, updateMock, eqMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  emitLeadEventMock: vi.fn(async () => "event-id"),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/lib/leads/events", () => ({ emitLeadEvent: emitLeadEventMock }));

const pendingRow = {
  id: "outbox-1",
  enquiry_id: "enquiry-1",
  to: "bea@example.com",
  reply_to: null,
  subject: "We're onto it",
  body_text: "text body",
  body_html: "<p>html body</p>",
  attempts: 0,
  created_at: "2026-07-09T00:00:00.000Z",
};

vi.mock("@/lib/supabase/service", () => ({
  supabaseService: () => ({
    from: vi.fn((table: string) => {
      if (table === "email_outbox") {
        return {
          insert: (...args: unknown[]) => {
            insertMock(...args);
            return Promise.resolve({ error: null });
          },
          select: () => ({
            is: () => ({
              order: () => ({
                limit: async () => ({ data: [pendingRow], error: null }),
              }),
            }),
          }),
          update: (...args: unknown[]) => {
            updateMock(...args);
            return { eq: (...eqArgs: unknown[]) => (eqMock(...eqArgs), Promise.resolve({ error: null })) };
          },
        };
      }
      if (table === "enquiries") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { created_at: "2026-07-09T00:00:00.000Z" }, error: null }),
            }),
          }),
        };
      }
      if (table === "messages") {
        return { insert: (...args: unknown[]) => (insertMock(...args), Promise.resolve({ error: null })) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  }),
}));

import { insertOutboxRow, sweepOutbox } from "./outbox";

beforeEach(() => {
  sendEmailMock.mockReset();
  emitLeadEventMock.mockReset();
  insertMock.mockReset();
  updateMock.mockReset();
  eqMock.mockReset();
});

describe("insertOutboxRow", () => {
  it("writes the ack with attempts=1 and the failure reason", async () => {
    await insertOutboxRow({
      enquiryId: "enquiry-1",
      to: "bea@example.com",
      subject: "We're onto it",
      text: "text",
      html: "<p>html</p>",
      lastError: "502 upstream",
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enquiry_id: "enquiry-1",
        to: "bea@example.com",
        attempts: 1,
        last_error: "502 upstream",
      }),
    );
  });
});

describe("sweepOutbox", () => {
  it("on send success: marks sent_at, inserts the thread message, and emits ack_sent", async () => {
    sendEmailMock.mockResolvedValue({ sent: true });

    const result = await sweepOutbox();

    expect(result).toEqual({ attempted: 1, sent: 1, failed: 0 });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ sent_at: expect.any(String) }));
    expect(emitLeadEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "enquiry-1",
        eventType: "ack_sent",
        metadata: expect.objectContaining({ via_outbox_retry: true, ms_since_received: expect.any(Number) }),
      }),
    );
  });

  it("on send failure: bumps attempts/last_error and emits no ack_sent", async () => {
    sendEmailMock.mockResolvedValue({ sent: false, error: "still down" });

    const result = await sweepOutbox();

    expect(result).toEqual({ attempted: 1, sent: 0, failed: 1 });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 1, last_error: "still down" }),
    );
    expect(emitLeadEventMock).not.toHaveBeenCalled();
  });
});
