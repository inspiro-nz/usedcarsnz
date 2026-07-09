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
