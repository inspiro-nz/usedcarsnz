import type { AiProvider, AiProviderName, GenerateOptions, GenerateResult } from "@/lib/ai/provider";

/**
 * A scripted AiProvider double. Tests supply a queue of raw text responses
 * (or a function of the incoming prompt) so the same red-team scenarios can
 * be run against a provider named 'workers-ai' and one named 'anthropic' —
 * proving the qualify/draft pipeline is adapter-agnostic, without any
 * network access.
 */
export function makeFakeProvider(
  name: AiProviderName,
  respond: string | ((opts: GenerateOptions, callIndex: number) => string),
): AiProvider {
  let callIndex = 0;
  function next(opts: GenerateOptions): string {
    const text = typeof respond === "function" ? respond(opts, callIndex) : respond;
    callIndex += 1;
    return text;
  }
  return {
    name,
    model: `fake-${name}`,
    async generate(opts: GenerateOptions): Promise<GenerateResult> {
      return {
        text: next(opts),
        provider: name,
        model: `fake-${name}`,
        latencyMs: 1,
        inputTokens: 10,
        outputTokens: 10,
      };
    },
    async *stream(opts: GenerateOptions) {
      const text = next(opts);
      yield text;
      return {
        text,
        provider: name,
        model: `fake-${name}`,
        latencyMs: 1,
      };
    },
  };
}

/** Both adapters, so a red-team scenario runs identically against each. */
export const BOTH_ADAPTERS: AiProviderName[] = ["workers-ai", "anthropic"];
