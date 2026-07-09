import "server-only";

import type { AiProvider, GenerateOptions, GenerateResult } from "@/lib/ai/provider";
import { parseStructured, type ParseableSchema } from "@/lib/ai/schema";

export class StructuredOutputError extends Error {
  constructor(cause: unknown) {
    super(`structured output failed after one retry: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "StructuredOutputError";
  }
}

export interface StructuredResult<T> {
  data: T;
  result: GenerateResult;
}

/**
 * generate() + JSON-parse + zod-validate, with ONE retry on parse/validation
 * failure only (transport retries already happened inside provider.generate).
 * Throws StructuredOutputError if the second attempt also fails — callers
 * catch this and take the safe path (§7 "routed to the safe path").
 */
export async function generateStructured<T>(
  provider: AiProvider,
  opts: GenerateOptions,
  schema: ParseableSchema<T>,
): Promise<StructuredResult<T>> {
  let lastResult: GenerateResult | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await provider.generate(opts);
    lastResult = result;
    try {
      const data = parseStructured(schema, result.text);
      return { data, result };
    } catch {
      // fall through to retry
    }
  }
  throw new StructuredOutputError(`could not parse valid JSON from: ${lastResult?.text.slice(0, 200)}`);
}
