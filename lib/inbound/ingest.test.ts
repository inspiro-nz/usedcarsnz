import { describe, it, expect, vi } from "vitest";
import { ingestInboundEmail, type IngestDeps, type InboundDb } from "@/lib/inbound/ingest";
import { INBOUND_PAYLOAD_VERSION, type InboundPayload } from "@/lib/inbound/payload";

interface AliasSeed {
  dealer_id: string;
  source_hint: "trademe" | "generic";
  active: boolean;
}
interface DealerSeed {
  business_name: string;
  email: string | null;
  logo_url: string | null;
  email_ack_enabled: boolean;
}
interface FakeSeed {
  existingByMessageId?: Record<string, { id: string }>;
  aliases?: Record<string, AliasSeed>;
  dealers?: Record<string, DealerSeed>;
}

function makeFakeDb(seed: FakeSeed) {
  const inserted: Record<string, unknown>[] = [];
  const db: InboundDb = {
    from(table: string) {
      if (table === "enquiries") {
        return {
          select() {
            return {
              eq(col: string, val: unknown) {
                return {
                  async maybeSingle<T>() {
                    if (col === "external_message_id") {
                      const hit = seed.existingByMessageId?.[val as string] ?? null;
                      return { data: (hit as T) ?? null, error: null };
                    }
                    return { data: null, error: null };
                  },
                } as never;
              },
            } as never;
          },
          insert(row: Record<string, unknown>) {
            return {
              select() {
                return {
                  async single<T>() {
                    const created = { id: "enq-new", created_at: "2026-07-10T00:00:00.000Z", ...row };
                    inserted.push(created);
                    return { data: { id: created.id, created_at: created.created_at } as T, error: null };
                  },
                } as never;
              },
            } as never;
          },
        } as never;
      }
      if (table === "dealer_aliases") {
        return {
          select() {
            return {
              eq(_col: string, val: unknown) {
                return {
                  async maybeSingle<T>() {
                    return { data: (seed.aliases?.[val as string] as T) ?? null, error: null };
                  },
                } as never;
              },
            } as never;
          },
        } as never;
      }
      if (table === "dealers") {
        return {
          select() {
            return {
              eq(_col: string, val: unknown) {
                return {
                  async maybeSingle<T>() {
                    return { data: (seed.dealers?.[val as string] as T) ?? null, error: null };
                  },
                } as never;
              },
            } as never;
          },
        } as never;
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { db, inserted };
}

function makeDeps(db: InboundDb) {
  return {
    svc: db,
    persistRaw: vi.fn<(key: string, raw: string) => Promise<void>>(async () => {}),
    runFirstTouch: vi.fn<IngestDeps["runFirstTouch"]>(async () => {}),
    notifyFounder: vi.fn<(subject: string, text: string) => Promise<void>>(async () => {}),
    waitUntil: vi.fn<(promise: Promise<unknown>) => void>(),
  };
}

function payload(overrides: Partial<InboundPayload> = {}): InboundPayload {
  return {
    version: INBOUND_PAYLOAD_VERSION,
    message_id: "msg-1@trademe.co.nz",
    alias: "lead-addington-autos",
    recipient: "lead-addington-autos@usedcarsnz.co.nz",
    parser: "trademe",
    parse_confidence: 0.9,
    buyer: { name: "Jordan Smith", email: "jordan@example.com", phone: "021 555 0143" },
    message: "Is it still available?",
    listing_ref: "4567890123",
    subject: "New enquiry",
    received_at: "2026-07-10T09:15:00.000Z",
    raw_email: "From: ...\n\nbody",
    ...overrides,
  };
}

const DEALER_ID = "dealer-abc";
const knownAlias = { [`lead-addington-autos`]: { dealer_id: DEALER_ID, source_hint: "trademe" as const, active: true } };
const knownDealer = {
  [DEALER_ID]: { business_name: "Addington Autos", email: "sales@addington.example", logo_url: null, email_ack_enabled: true },
};

describe("ingestInboundEmail", () => {
  it("happy path: creates a listing-less lead and runs the shared first touch", async () => {
    const { db, inserted } = makeFakeDb({ aliases: knownAlias, dealers: knownDealer });
    const deps = makeDeps(db);
    const res = await ingestInboundEmail(payload(), deps);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, enquiryId: "enq-new" });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      listing_id: null,
      dealer_id: DEALER_ID,
      buyer_email: "jordan@example.com",
      source: "email_trademe",
      external_message_id: "msg-1@trademe.co.nz",
    });

    expect(deps.persistRaw).toHaveBeenCalledWith(`${DEALER_ID}/enq-new.eml`, expect.any(String));
    expect(deps.runFirstTouch).toHaveBeenCalledTimes(1);
    const ft = deps.runFirstTouch.mock.calls[0][0];
    expect(ft.ackEnabled).toBe(true);
    expect(ft.ackFrom).toMatch(/Addington Autos via UsedCarsNZ/);
    expect(ft.dealer).toEqual({ name: "Addington Autos", email: "sales@addington.example", logoUrl: null });
  });

  it("maps a generic-source alias to source=email_other", async () => {
    const { db, inserted } = makeFakeDb({
      aliases: { "lead-x": { dealer_id: DEALER_ID, source_hint: "generic", active: true } },
      dealers: knownDealer,
    });
    await ingestInboundEmail(payload({ alias: "lead-x", parser: "generic" }), makeDeps(db));
    expect(inserted[0].source).toBe("email_other");
  });

  it("unknown alias: 202, notifies founder, creates nothing", async () => {
    const { db, inserted } = makeFakeDb({ aliases: {}, dealers: {} });
    const deps = makeDeps(db);
    const res = await ingestInboundEmail(payload({ alias: "lead-nope" }), deps);

    expect(res.status).toBe(202);
    expect(res.body.reason).toBe("unknown_alias");
    expect(inserted).toHaveLength(0);
    expect(deps.runFirstTouch).not.toHaveBeenCalled();
    expect(deps.notifyFounder).toHaveBeenCalledTimes(1);
  });

  it("inactive alias: 202 unknown_alias (never routes to a disabled alias)", async () => {
    const { db } = makeFakeDb({
      aliases: { "lead-off": { dealer_id: DEALER_ID, source_hint: "trademe", active: false } },
      dealers: knownDealer,
    });
    const res = await ingestInboundEmail(payload({ alias: "lead-off" }), makeDeps(db));
    expect(res.status).toBe(202);
    expect(res.body.reason).toBe("unknown_alias");
  });

  it("duplicate Message-ID: 200 no-op, no new lead", async () => {
    const { db, inserted } = makeFakeDb({
      existingByMessageId: { "dupe@x": { id: "existing-1" } },
      aliases: knownAlias,
      dealers: knownDealer,
    });
    const deps = makeDeps(db);
    const res = await ingestInboundEmail(payload({ message_id: "dupe@x" }), deps);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, enquiryId: "existing-1", deduped: true });
    expect(inserted).toHaveLength(0);
    expect(deps.runFirstTouch).not.toHaveBeenCalled();
  });

  it("no buyer email: 202, notifies founder, creates nothing", async () => {
    const { db, inserted } = makeFakeDb({ aliases: knownAlias, dealers: knownDealer });
    const deps = makeDeps(db);
    const res = await ingestInboundEmail(
      payload({ buyer: { name: "No Email", email: null, phone: null } }),
      deps,
    );
    expect(res.status).toBe(202);
    expect(res.body.reason).toBe("no_buyer_email");
    expect(inserted).toHaveLength(0);
    expect(deps.notifyFounder).toHaveBeenCalledTimes(1);
  });

  it("respects the per-dealer ack opt-out (email_ack_enabled=false)", async () => {
    const { db } = makeFakeDb({
      aliases: knownAlias,
      dealers: {
        [DEALER_ID]: { business_name: "Quiet Motors", email: null, logo_url: null, email_ack_enabled: false },
      },
    });
    const deps = makeDeps(db);
    const res = await ingestInboundEmail(payload(), deps);

    expect(res.status).toBe(200);
    expect(deps.runFirstTouch).toHaveBeenCalledTimes(1);
    expect(deps.runFirstTouch.mock.calls[0][0].ackEnabled).toBe(false);
  });
});
