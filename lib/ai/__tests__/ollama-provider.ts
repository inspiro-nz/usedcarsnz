import type { AiProvider, GenerateOptions, GenerateResult } from "@/lib/ai/provider";

/**
 * TEST-ONLY, LIVE-OPTIONAL Ollama adapter (deliverable B).
 *
 * Conforms to the AiProvider interface ONLY so a smoke test can inject it
 * directly (like the fake provider). It is deliberately NOT in the production
 * AI_PROVIDER enum or getProvider() selection (invariant 4) and must never be
 * reachable from a deployed request path — it lives under __tests__ and is
 * imported only by lib/ai/__tests__/ollama.live.test.ts.
 *
 * Talks to a local Ollama server with a plain fetch to /api/chat — no shipping
 * dependency (invariant 3). Config is read from the environment HERE ONLY, and
 * never by lib/env.ts / any request-path code (invariant 5).
 *
 * ⚠ SEMANTIC SMOKE ONLY. A green Ollama run means "the pipeline roughly works
 * against a real local model"; it is NEVER a compliance assertion. If the local
 * model follows instructions better than the deployed Workers AI open model, a
 * green run gives FALSE compliance confidence. Compliance is proven by feeding
 * the guard deliberately bad output via the mock (deliverable A), full stop.
 */

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

/** Structural placeholder — the interface's `name` is a production-provider
 * union that (correctly) does not include Ollama; the real identity of this
 * adapter is carried in `model` (e.g. "ollama:llama3.1"). */
const PLACEHOLDER_NAME = "workers-ai" as const;

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaProviderOptions {
  /** Ollama model tag, e.g. "llama3.1" or "qwen2.5:7b". */
  model: string;
  /** Defaults to $AI_OLLAMA_BASE_URL, then http://localhost:11434. */
  baseUrl?: string;
}

export function makeOllamaProvider(opts: OllamaProviderOptions): AiProvider {
  const baseUrl = (opts.baseUrl ?? process.env.AI_OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "");
  const model = opts.model;
  const modelId = `ollama:${model}`;

  async function chat(o: GenerateOptions, stream: boolean): Promise<Response> {
    return fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream,
        options: { temperature: o.temperature ?? 0.2, num_predict: o.maxTokens ?? 1024 },
        messages: [{ role: "system", content: o.system }, ...o.messages],
      }),
    });
  }

  return {
    name: PLACEHOLDER_NAME,
    model: modelId,
    async generate(o): Promise<GenerateResult> {
      const started = Date.now();
      const res = await chat(o, false);
      if (!res.ok) throw new Error(`ollama /api/chat ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as OllamaChatResponse;
      return {
        text: body.message?.content ?? "",
        provider: PLACEHOLDER_NAME,
        model: modelId,
        latencyMs: Date.now() - started,
        inputTokens: body.prompt_eval_count,
        outputTokens: body.eval_count,
      };
    },
    async *stream(o) {
      const started = Date.now();
      const res = await chat(o, true);
      if (!res.ok || !res.body) throw new Error(`ollama /api/chat ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try {
              const chunk = JSON.parse(t) as OllamaChatResponse;
              const piece = chunk.message?.content ?? "";
              if (piece) {
                full += piece;
                yield piece;
              }
            } catch {
              // Ollama streams one JSON object per line; ignore any non-JSON keepalive.
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      return { text: full, provider: PLACEHOLDER_NAME, model: modelId, latencyMs: Date.now() - started };
    },
  };
}
