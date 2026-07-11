import { describe, expect, it, vi } from "vitest";
import { makeOllamaProvider } from "./ollama-provider";

// structured.ts is server-only; hoisted mock so the static import resolves.
vi.mock("server-only", () => ({}));

import { generateStructured } from "@/lib/ai/structured";
import { QualifyOutputSchema } from "@/lib/ai/schema";
import { buildQualifySystemPrompt, buildQualifyUserTurn } from "@/lib/ai/prompts/qualify.v1";
import { guardReply } from "@/lib/ai/guard";

/**
 * LIVE-OPTIONAL Ollama semantic smoke (deliverable B).
 *
 * Runs ONLY with AI_LIVE_OLLAMA=1 (and a local Ollama serving AI_OLLAMA_MODEL);
 * otherwise the whole describe SKIPS — exactly like the Playwright sign-in spec
 * skips without a test user. It NEVER runs in the default `vitest run` or CI, so
 * the offline suite consumes no network, no Neurons, and needs no API key.
 *
 * ⚠ This asserts only that the pipeline SEMANTICALLY works against a real local
 * model (valid structured JSON comes back and the guard can screen it). It is
 * NOT a compliance assertion: a strong local model ≠ the deployed Workers AI
 * open model, so a green run here proves nothing about §7 compliance. That is
 * proven by the mock feeding the guard bad output on purpose (deliverable A).
 */

const LIVE = process.env.AI_LIVE_OLLAMA === "1";
const MODEL = process.env.AI_OLLAMA_MODEL ?? "llama3.1";

// Real local inference — cold model load plus generateStructured's up-to-two
// attempts — comfortably exceeds vitest's 5s default. This lane is opt-in and
// local, so a generous ceiling is fine.
const LIVE_TIMEOUT_MS = 120_000;

describe.skipIf(!LIVE)(
  "Ollama live SEMANTIC smoke [AI_LIVE_OLLAMA=1, local Ollama] — NOT a compliance assertion",
  () => {
    it("returns a parseable qualify JSON that the guard can screen", async () => {
      const provider = makeOllamaProvider({ model: MODEL });
      const system = buildQualifySystemPrompt({
        dealerName: "Test Motors",
        listingTitle: "2020 Ford Ranger Wildtrak",
        approvedFacts: {},
        qualificationSoFar: null,
      });

      const { data } = await generateStructured(
        provider,
        {
          system,
          messages: [{ role: "user", content: buildQualifyUserTurn("Hi, is this still available? What's your best price?") }],
          temperature: 0.2,
        },
        QualifyOutputSchema,
      );

      expect(data.reply_text.length).toBeGreaterThan(0);
      // The guard runs; whether it blocks is irrelevant to the smoke — a green
      // (unblocked) result here is NOT evidence of compliance (see file header).
      const guard = guardReply(data.reply_text);
      expect(typeof guard.blocked).toBe("boolean");
    }, LIVE_TIMEOUT_MS);
  },
);
