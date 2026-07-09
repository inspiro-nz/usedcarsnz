import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getServerEnv } from "@/lib/env";

/**
 * Provider-agnostic LLM interface (strategy §7, invariant 6).
 *
 * Two adapters live behind this interface: 'workers-ai' (default — the AI
 * binding, billed from the free Neuron allocation) and 'anthropic' (the
 * tested escalation path, flipped on per-lane via AI_PROVIDER_QUALIFY /
 * AI_PROVIDER_DRAFT). Callers never branch on provider name; only
 * getProvider() and the two adapter factories below know which one they are.
 *
 * Structured output is deliberately NOT done via provider-native tool-calling
 * — Workers AI and Anthropic have incompatible tool-call shapes, so the
 * common denominator is plain text. Callers (lib/ai/prompts) instruct the
 * model to return JSON in its prose and zod-parse the text; this keeps both
 * adapters symmetric and lets the same JSON-parse-and-retry logic serve both.
 */

export type AiProviderName = "workers-ai" | "anthropic";
export type AiLane = "qualify" | "draft";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  /** Kept low per invariant 6 (0-0.3) — structured, compliance-bounded output, not creative prose. */
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  provider: AiProviderName;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  generate(opts: GenerateOptions): Promise<GenerateResult>;
  /** Yields text deltas; the final value carries the same metadata as generate(). */
  stream(opts: GenerateOptions): AsyncGenerator<string, GenerateResult, void>;
}

const HARD_TIMEOUT_MS = 10_000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 1024;

export class AiTimeoutError extends Error {
  constructor(provider: string) {
    super(`${provider}: request exceeded the ${HARD_TIMEOUT_MS}ms hard timeout`);
    this.name = "AiTimeoutError";
  }
}

export class AiProviderError extends Error {
  constructor(provider: string, cause: unknown) {
    super(`${provider}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "AiProviderError";
  }
}

function jitterMs(): number {
  return 100 + Math.floor(Math.random() * 250); // 100-350ms
}

async function withTimeout<T>(providerName: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) throw new AiTimeoutError(providerName);
    throw new AiProviderError(providerName, err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Timeout for a STREAMED response, where the abort must stay armed for the
 * whole read loop rather than just the call that opens the stream. Callers
 * must `clear()` once the stream is fully drained, and treat an aborted
 * signal surfacing mid-loop as AiTimeoutError.
 */
function armStreamTimeout(providerName: string): { signal: AbortSignal; clear: () => void; check: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
    check: () => {
      if (controller.signal.aborted) throw new AiTimeoutError(providerName);
    },
  };
}

/** Single retry with jitter, shared by every adapter's generate(). Streaming is not retried mid-stream. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, jitterMs()));
    return fn();
  }
}

// ============================================================================
// workers-ai adapter
// ============================================================================

interface WorkersAiRunResult {
  response?: string | Record<string, unknown>;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * For some hosted models the AI binding returns an OpenAI-chat-completions
 * shape whose `response` field is already parsed into an object rather than
 * the raw JSON string `response` is documented to carry (confirmed live,
 * 2026-07 — @cf/meta/llama-3.3-70b-instruct-fp8-fast). The actual model text
 * is `choices[0].message.content` in that case; fall back to it (or a
 * stringified `response`) so callers always get the raw text to parse.
 */
function extractResponseText(result: WorkersAiRunResult): string {
  if (typeof result.response === "string") return result.response;
  return result.choices?.[0]?.message?.content ?? JSON.stringify(result.response ?? "");
}

function workersAiAdapter(model: string): AiProvider {
  if (!model.startsWith("@cf/")) {
    throw new Error(
      `AI_MODEL_QUALIFY/AI_MODEL_DRAFT must be a @cf/-prefixed hosted model for the workers-ai adapter; got "${model}". Proxied catalog models bill at provider rates with no free allocation.`,
    );
  }

  async function run(opts: GenerateOptions, stream: boolean) {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.AI) {
      throw new Error("The AI binding is not available — add \"ai\": { \"binding\": \"AI\" } to wrangler.jsonc.");
    }
    return env.AI.run(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- model id union is generated per-account; @cf/ prefix is enforced above
      model as any,
      {
        messages: [
          { role: "system", content: opts.system },
          ...opts.messages,
        ],
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        stream,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AiOptions type varies by @cf/ binding version
    ) as any;
  }

  return {
    name: "workers-ai",
    model,
    async generate(opts) {
      const started = Date.now();
      const result = await withRetry(() =>
        withTimeout("workers-ai", async () => (await run(opts, false)) as WorkersAiRunResult),
      );
      return {
        text: extractResponseText(result),
        provider: "workers-ai",
        model,
        latencyMs: Date.now() - started,
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
      };
    },
    async *stream(opts) {
      const started = Date.now();
      const timeout = armStreamTimeout("workers-ai");
      let full = "";
      try {
        const raw = (await run(opts, true)) as ReadableStream<Uint8Array>;
        const reader = raw.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          for (;;) {
            timeout.check();
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const data = line.replace(/^data:\s*/, "").trim();
              if (!data || data === "[DONE]") continue;
              try {
                const chunk = JSON.parse(data) as { response?: string };
                if (chunk.response) {
                  full += chunk.response;
                  yield chunk.response;
                }
              } catch {
                // Non-JSON keepalive line — ignore.
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } finally {
        timeout.clear();
      }
      return {
        text: full,
        provider: "workers-ai",
        model,
        latencyMs: Date.now() - started,
      };
    },
  };
}

// ============================================================================
// anthropic adapter
// ============================================================================

function anthropicAdapter(model: string): AiProvider {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — required when AI_PROVIDER_QUALIFY/DRAFT=anthropic.");
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  return {
    name: "anthropic",
    model,
    async generate(opts) {
      const started = Date.now();
      const msg = await withRetry(() =>
        withTimeout("anthropic", (signal) =>
          client.messages.create(
            {
              model,
              max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
              temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
              system: opts.system,
              messages: opts.messages,
            },
            { signal },
          ),
        ),
      );
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return {
        text,
        provider: "anthropic",
        model,
        latencyMs: Date.now() - started,
        inputTokens: msg.usage?.input_tokens,
        outputTokens: msg.usage?.output_tokens,
      };
    },
    async *stream(opts) {
      const started = Date.now();
      const timeout = armStreamTimeout("anthropic");
      let full = "";
      try {
        const s = client.messages.stream(
          {
            model,
            max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
            temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
            system: opts.system,
            messages: opts.messages,
          },
          { signal: timeout.signal },
        );
        for await (const event of s) {
          timeout.check();
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            yield event.delta.text;
          }
        }
        const final = await s.finalMessage();
        return {
          text: full,
          provider: "anthropic",
          model,
          latencyMs: Date.now() - started,
          inputTokens: final.usage?.input_tokens,
          outputTokens: final.usage?.output_tokens,
        };
      } finally {
        timeout.clear();
      }
    },
  };
}

// ============================================================================
// Lane-scoped resolution
// ============================================================================

/** Resolves the configured adapter for a lane, per AI_PROVIDER_* / AI_MODEL_* env vars. */
export function getProvider(lane: AiLane): AiProvider {
  const env = getServerEnv();
  const provider = lane === "qualify" ? env.AI_PROVIDER_QUALIFY : env.AI_PROVIDER_DRAFT;
  const model = lane === "qualify" ? env.AI_MODEL_QUALIFY : env.AI_MODEL_DRAFT;
  return provider === "anthropic" ? anthropicAdapter(model) : workersAiAdapter(model);
}
