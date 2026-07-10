import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkRateLimitMock,
  honeypotTrippedMock,
  verifyTurnstileMock,
  sendEmailMock,
  insertOutboxRowMock,
  emitLeadEventMock,
  triggerQualificationMock,
  waitUntilMock,
  serverInsertMock,
} = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => true),
  honeypotTrippedMock: vi.fn(() => false),
  verifyTurnstileMock: vi.fn(async () => true),
  sendEmailMock: vi.fn(async () => ({ sent: true }) as { sent: boolean; error?: string }),
  insertOutboxRowMock: vi.fn(async () => {}),
  emitLeadEventMock: vi.fn(async () => "event-id"),
  triggerQualificationMock: vi.fn(async () => {}),
  waitUntilMock: vi.fn(),
  serverInsertMock: vi.fn(),
}));

// Chainable, awaitable mock so both `.insert(x).select(y).single()` and a
// bare `await ....insert(x)` work against the same fake table.
function makeChain(finalResult: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => finalResult),
    maybeSingle: vi.fn(async () => finalResult),
    insert: vi.fn((...args: unknown[]) => {
      serverInsertMock(...args);
      return chain;
    }),
    then: (resolve: (v: unknown) => void) => resolve(finalResult),
  };
  return chain;
}

vi.mock("next/headers", () => ({
  headers: async () => new Map(),
}));

vi.mock("@/lib/security", () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIP: async () => "127.0.0.1",
  honeypotTripped: honeypotTrippedMock,
}));

vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: verifyTurnstileMock }));
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/lib/email/outbox", () => ({ insertOutboxRow: insertOutboxRowMock }));
vi.mock("@/lib/leads/events", () => ({ emitLeadEvent: emitLeadEventMock }));
vi.mock("@/lib/ai/trigger", () => ({ triggerQualification: triggerQualificationMock }));

vi.mock("@/lib/env", () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ ctx: { waitUntil: waitUntilMock } }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: vi.fn(() =>
      makeChain({
        data: { id: "enquiry-1", created_at: new Date().toISOString() },
        error: null,
      }),
    ),
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  supabaseService: () => ({
    from: vi.fn((table: string) => {
      if (table === "listings") {
        return makeChain({ data: { dealer_id: null }, error: null });
      }
      if (table === "dealers") {
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    }),
  }),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest accepts a plain Request at runtime
  }) as any;
}

const validBody = {
  listing_id: "11111111-1111-1111-1111-111111111111",
  name: "Bea Buyer",
  email: "bea@example.com",
  phone: "",
  message: "Is it still available?",
  token: "test-token",
  website: "",
};

beforeEach(() => {
  checkRateLimitMock.mockReset().mockReturnValue(true);
  honeypotTrippedMock.mockReset().mockReturnValue(false);
  verifyTurnstileMock.mockReset().mockResolvedValue(true);
  sendEmailMock.mockReset().mockResolvedValue({ sent: true });
  insertOutboxRowMock.mockReset();
  emitLeadEventMock.mockReset();
  triggerQualificationMock.mockReset();
  waitUntilMock.mockReset();
  serverInsertMock.mockReset();
});

describe("POST /api/enquiries", () => {
  it("honeypot hit: returns ok without writing an enquiry row", async () => {
    honeypotTrippedMock.mockReturnValue(true);

    const res = await POST(request({ ...validBody, website: "http://spam.example" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; error?: string; enquiryId?: string };
    expect(body.ok).toBe(true);
    expect(serverInsertMock).not.toHaveBeenCalled();
  });

  it("rate limit exceeded: 429, writes no enquiry row", async () => {
    checkRateLimitMock.mockReturnValue(false);

    const res = await POST(request(validBody));

    expect(res.status).toBe(429);
    const body = (await res.json()) as { ok?: boolean; error?: string; enquiryId?: string };
    expect(body.error).toBeTruthy();
    expect(serverInsertMock).not.toHaveBeenCalled();
  });

  it("turnstile failure: 400, writes no enquiry row", async () => {
    verifyTurnstileMock.mockResolvedValue(false);

    const res = await POST(request(validBody));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok?: boolean; error?: string; enquiryId?: string };
    expect(body.error).toBeTruthy();
    expect(serverInsertMock).not.toHaveBeenCalled();
  });

  it("validation failure: 400, writes no enquiry row", async () => {
    const res = await POST(request({ ...validBody, email: "not-an-email" }));

    expect(res.status).toBe(400);
    expect(serverInsertMock).not.toHaveBeenCalled();
  });

  it("resend failure: enquiry still succeeds, ack goes to outbox, no ack_sent event", async () => {
    sendEmailMock.mockResolvedValue({ sent: false, error: "502 upstream" });

    const res = await POST(request(validBody));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; error?: string; enquiryId?: string };
    expect(body.ok).toBe(true);
    expect(insertOutboxRowMock).toHaveBeenCalledTimes(1);
    expect(emitLeadEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "ack_sent" }),
    );
  });

  it("success path: emits ack_sent with a numeric ms_since_received and kicks off qualification via waitUntil", async () => {
    const res = await POST(request(validBody));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; error?: string; enquiryId?: string };
    expect(body.ok).toBe(true);
    expect(body.enquiryId).toBe("enquiry-1");

    expect(emitLeadEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "enquiry-1",
        eventType: "ack_sent",
        actor: "ai",
        metadata: expect.objectContaining({
          channel: "email",
          ms_since_received: expect.any(Number),
        }),
      }),
    );
    expect(waitUntilMock).toHaveBeenCalledTimes(1);
  });
});
