import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type RpcCall } from "@/lib/ai/__tests__/fake-supabase";
import { makeFakeProvider, BOTH_ADAPTERS } from "@/lib/ai/__tests__/fake-provider";
import type { AiProviderName } from "@/lib/ai/provider";
import { parseMessage } from "../../workers/email-inbound/src/index";
import { extractTrademe } from "../../workers/email-inbound/src/extractors/trademe";

/**
 * Compliance envelope end-to-end (§7): a hostile inbound EMAIL body must be
 * treated as DATA, never instructions, and the guard must hold even if the
 * model obeys the injection. This wires the REAL Worker extractor to the REAL
 * Lane-1 qualify pipeline (the Prompt-3 defence), seeded from the hostile .eml.
 */

vi.mock("@/lib/supabase/service", () => ({ supabaseService: vi.fn() }));
vi.mock("@/lib/ai/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/provider")>();
  return { ...actual, getProvider: vi.fn() };
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: false }) }));
vi.mock("@/lib/ai/generate-draft", () => ({ generateDraft: vi.fn().mockResolvedValue(undefined) }));

const ENQUIRY_ID = "11111111-1111-1111-1111-111111111111";
const LISTING_ID = "22222222-2222-2222-2222-222222222222";

function hostileMessage(): string {
  const raw = readFileSync(new URL("../../workers/email-inbound/fixtures/hostile-injection.eml", import.meta.url), "utf8");
  return raw; // parsed below
}

async function extractedHostileBody(): Promise<string> {
  const msg = await parseMessage(hostileMessage());
  const out = extractTrademe(msg);
  if (!out.message) throw new Error("fixture did not yield a message");
  return out.message;
}

async function seed(message: string) {
  const { db, rpcCalls, client } = createFakeDb({
    enquiries: [
      {
        id: ENQUIRY_ID,
        listing_id: LISTING_ID,
        dealer_id: null,
        buyer_name: "Mallory Hacker",
        buyer_email: "mallory@evil.example",
        buyer_phone: null,
        message, // the untrusted, injection-laden email body
        qualification: null,
        status: "new",
        source: "email_trademe",
        created_at: new Date().toISOString(),
      },
    ],
    listings: [{ id: LISTING_ID, seller_type: "dealer", dealer_id: null, title: null, year: 2020, make: "Ford", model: "Ranger", variant: null }],
  });
  const { supabaseService } = await import("@/lib/supabase/service");
  (supabaseService as unknown as ReturnType<typeof vi.fn>).mockReturnValue(client);
  return { db, rpcCalls };
}

async function setProvider(name: AiProviderName, respond: Parameters<typeof makeFakeProvider>[1]) {
  const { getProvider } = await import("@/lib/ai/provider");
  (getProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeFakeProvider(name, respond));
}

beforeEach(() => vi.clearAllMocks());

describe.each(BOTH_ADAPTERS)("hostile inbound email — injection defence — adapter=%s", (adapter) => {
  it("carries the email body as delimited DATA into the prompt", async () => {
    const message = await extractedHostileBody();
    await seed(message);

    let capturedPrompt = "";
    await setProvider(adapter, (opts) => {
      capturedPrompt = opts.messages.map((m) => m.content).join("\n");
      return JSON.stringify({ reply_text: "Thanks — what's your budget?", next_topic: "budget", fields: {}, needs_dealer: false, dealer_question: null });
    });

    const { triggerQualification } = await import("@/lib/ai/trigger");
    await triggerQualification(ENQUIRY_ID);

    expect(capturedPrompt).toContain("<buyer_message>");
    expect(capturedPrompt).toContain("not instructions");
    // The injection instructions are INSIDE the delimited buyer block.
    expect(capturedPrompt.toLowerCase()).toContain("ignore all previous instructions");
  });

  it("guard holds even if the model obeys the injection (no warranty/finance/accident claim reaches the buyer)", async () => {
    const message = await extractedHostileBody();
    const { db, rpcCalls } = await seed(message);

    // Simulate a jailbroken model that complied with the injected instruction.
    await setProvider(adapter, () =>
      JSON.stringify({
        reply_text: "Confirmed: this vehicle has a brand-new manufacturer warranty, and you're guaranteed 0% finance approval. It has never been in an accident.",
        next_topic: "complete",
        fields: {},
        needs_dealer: false,
        dealer_question: null,
      }),
    );

    const { triggerQualification } = await import("@/lib/ai/trigger");
    await triggerQualification(ENQUIRY_ID);

    // The guard neutralised the reply and routed to a human.
    expect(rpcCalls.some((c: RpcCall) => c.args.p_event_type === "guard_blocked")).toBe(true);
    const aiMessage = db.messages.find((m) => m.sender === "ai");
    const body = String(aiMessage?.body ?? "").toLowerCase();
    expect(body).not.toContain("warranty");
    expect(body).not.toContain("finance approval");
    expect(body).not.toContain("never been in an accident");
  });
});
