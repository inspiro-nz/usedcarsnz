import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type RpcCall } from "@/lib/ai/__tests__/fake-supabase";
import { makeFakeProvider, BOTH_ADAPTERS } from "@/lib/ai/__tests__/fake-provider";
import type { AiProviderName } from "@/lib/ai/provider";

vi.mock("@/lib/supabase/service", () => ({ supabaseService: vi.fn() }));
vi.mock("@/lib/ai/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/provider")>();
  return { ...actual, getProvider: vi.fn() };
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: false }) }));

const ENQUIRY_ID = "33333333-3333-3333-3333-333333333333";
const LISTING_ID = "44444444-4444-4444-4444-444444444444";
const DEALER_ID = "55555555-5555-5555-5555-555555555555";

function seedListing(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: LISTING_ID,
    dealer_id: DEALER_ID,
    seller_type: "dealer",
    title: null,
    year: 2019,
    make: "Toyota",
    model: "Corolla",
    variant: "GX",
    body_type: "Sedan",
    fuel: "petrol",
    transmission: "automatic",
    odometer_km: 45000,
    colour: "Silver",
    wof_expiry: null, // deliberately absent — must NOT be fabricated
    rego_expiry: null,
    import_origin: "NZ new",
    price_nzd: 18500,
    is_poa: false,
    suburb: "Newmarket",
    city: "Auckland",
    description: null,
    ...overrides,
  };
}

async function setup(opts: { message?: string; qualification?: Record<string, unknown> | null } = {}) {
  const { db, rpcCalls, client } = createFakeDb({
    enquiries: [
      {
        id: ENQUIRY_ID,
        listing_id: LISTING_ID,
        buyer_name: "Jamie",
        message: opts.message ?? "Hi, still available?",
        qualification: opts.qualification ?? null,
      },
    ],
    listings: [seedListing()],
    dealers: [{ id: DEALER_ID, business_name: "Newmarket Motors", email: "sales@newmarketmotors.example" }],
    messages: [],
  });
  const { supabaseService } = await import("@/lib/supabase/service");
  (supabaseService as unknown as ReturnType<typeof vi.fn>).mockReturnValue(client);
  return { db, rpcCalls };
}

async function setProvider(name: AiProviderName, respond: Parameters<typeof makeFakeProvider>[1]) {
  const { getProvider } = await import("@/lib/ai/provider");
  (getProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeFakeProvider(name, respond));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(BOTH_ADAPTERS)("Lane 2 (generateDraft) — adapter=%s", (adapterName) => {
  it("stores the draft as status='pending' with provider/model/prompt_version recorded", async () => {
    const { db, rpcCalls } = await setup();
    await setProvider(adapterName, () =>
      JSON.stringify({ draft_text: "Hi Jamie, thanks for your interest! [DEALER TO CONFIRM: WOF status]" }),
    );
    const { generateDraft } = await import("@/lib/ai/generate-draft");
    await generateDraft(ENQUIRY_ID);

    const draft = db.ai_drafts[0];
    expect(draft.status).toBe("pending");
    expect(draft.provider).toBe(adapterName);
    expect(draft.prompt_version).toBeTruthy();
    expect(draft.draft_text).toContain("[DEALER TO CONFIRM");
    expect(rpcCalls.some((c: RpcCall) => c.args.p_event_type === "draft_created")).toBe(true);
  });

  it("never puts a missing listing fact (e.g. WOF expiry) into the prompt as a real value", async () => {
    await setup();
    let capturedPrompt = "";
    await setProvider(adapterName, (opts) => {
      capturedPrompt = opts.system;
      return JSON.stringify({ draft_text: "ok" });
    });
    const { generateDraft } = await import("@/lib/ai/generate-draft");
    await generateDraft(ENQUIRY_ID);

    expect(capturedPrompt).not.toMatch(/WOF expiry:\s*\S/);
    expect(capturedPrompt).toContain("DEALER TO CONFIRM");
  });

  it("routes buyer questions flagged needs_dealer from Lane 1 into the Lane 2 prompt", async () => {
    const { db } = await setup();
    db.messages.push({
      id: "m1",
      enquiry_id: ENQUIRY_ID,
      sender: "ai",
      body: "safe deferral",
      meta: { dealer_question: "Buyer asked whether the car has ever been in an accident." },
      created_at: new Date().toISOString(),
    });
    let capturedPrompt = "";
    await setProvider(adapterName, (opts) => {
      capturedPrompt = opts.system;
      return JSON.stringify({ draft_text: "ok" });
    });
    const { generateDraft } = await import("@/lib/ai/generate-draft");
    await generateDraft(ENQUIRY_ID);

    expect(capturedPrompt).toContain("ever been in an accident");
  });

  it("falls back to a template draft with status='generation_failed' and notifies the dealer when generation fails", async () => {
    const { db } = await setup();
    const { sendEmail } = await import("@/lib/email");
    await setProvider(adapterName, () => "not valid json");
    const { generateDraft } = await import("@/lib/ai/generate-draft");
    await generateDraft(ENQUIRY_ID);

    const draft = db.ai_drafts[0];
    expect(draft.status).toBe("generation_failed");
    expect(draft.draft_text).toBeTruthy(); // the existing template fallback, not empty
    expect(sendEmail).toHaveBeenCalled();
  });

  it("does not log draft_created when generation fails (funnel integrity)", async () => {
    const { rpcCalls } = await setup();
    await setProvider(adapterName, () => "not valid json");
    const { generateDraft } = await import("@/lib/ai/generate-draft");
    await generateDraft(ENQUIRY_ID);

    expect(rpcCalls.some((c: RpcCall) => c.args.p_event_type === "draft_created")).toBe(false);
  });
});

async function setupEmail(opts: { message?: string; qualification?: Record<string, unknown> | null } = {}) {
  const { db, rpcCalls, client } = createFakeDb({
    enquiries: [
      {
        id: ENQUIRY_ID,
        listing_id: null, // listing-less inbound-email lead
        dealer_id: DEALER_ID, // set directly by set_enquiry_denorm (Prompt 5)
        buyer_name: "Jamie",
        message: opts.message ?? "Hi, still available?",
        qualification: opts.qualification ?? null,
      },
    ],
    dealers: [{ id: DEALER_ID, business_name: "Newmarket Motors", email: "sales@newmarketmotors.example" }],
    messages: [],
    // deliberately NO listings row.
  });
  const { supabaseService } = await import("@/lib/supabase/service");
  (supabaseService as unknown as ReturnType<typeof vi.fn>).mockReturnValue(client);
  return { db, rpcCalls };
}

describe("Lane 2 — listing-less inbound-email leads draft without a listing (§5.3, §7)", () => {
  it("generates a REAL draft (pending + draft_created) with a listing-less prompt that names no vehicle", async () => {
    const { db, rpcCalls } = await setupEmail();
    let capturedPrompt = "";
    await setProvider("workers-ai", (opts) => {
      capturedPrompt = opts.system;
      return JSON.stringify({ draft_text: "Hi Jamie — happy to help. [DEALER TO CONFIRM: which vehicle you're asking about]" });
    });
    const { generateDraft } = await import("@/lib/ai/generate-draft");
    await generateDraft(ENQUIRY_ID);

    const draft = db.ai_drafts[0];
    expect(draft.status).toBe("pending");
    expect(rpcCalls.some((c: RpcCall) => c.args.p_event_type === "draft_created")).toBe(true);
    // Listing-less prompt: no facts on file, no fabricated vehicle facts.
    expect(capturedPrompt).toContain("(no listing facts on file)");
    expect(capturedPrompt).not.toMatch(/-\s*(Make|Model|Year):/);
    expect(capturedPrompt).toContain("DEALER TO CONFIRM");
  });

  it("generation-failure fallback: safe template, generation_failed, no throw on null listing, invents no vehicle", async () => {
    const { db } = await setupEmail();
    const { sendEmail } = await import("@/lib/email");
    await setProvider("anthropic", () => "not valid json");
    const { generateDraft } = await import("@/lib/ai/generate-draft");
    await expect(generateDraft(ENQUIRY_ID)).resolves.toBeUndefined();

    const draft = db.ai_drafts[0];
    expect(draft.status).toBe("generation_failed");
    const text = String(draft.draft_text);
    // Uses a confirm marker instead of naming a vehicle it has no data for.
    expect(text).toContain("[DEALER TO CONFIRM");
    // No fabricated vehicle name, and no null/undefined leakage from the null listing.
    expect(text).not.toMatch(/undefined|null|Toyota|Corolla/);
    expect(sendEmail).toHaveBeenCalled();
  });

  it("neither a listing NOR a dealer: keeps throwing so the swallowing .catch owns it", async () => {
    const { client } = createFakeDb({
      enquiries: [{ id: ENQUIRY_ID, listing_id: null, dealer_id: null, buyer_name: "Jamie", message: "hi", qualification: null }],
      dealers: [],
      messages: [],
    });
    const { supabaseService } = await import("@/lib/supabase/service");
    (supabaseService as unknown as ReturnType<typeof vi.fn>).mockReturnValue(client);
    await setProvider("workers-ai", () => JSON.stringify({ draft_text: "x" }));
    const { generateDraft } = await import("@/lib/ai/generate-draft");
    await expect(generateDraft(ENQUIRY_ID)).rejects.toThrow(/neither a listing nor a dealer/);
  });
});
