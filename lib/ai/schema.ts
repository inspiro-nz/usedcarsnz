import { z } from "zod";

/**
 * Structured-output contracts for both lanes (strategy §7). The model is
 * instructed (lib/ai/prompts) to return exactly one of these as JSON; the
 * text response is parsed and validated here, with one retry on parse
 * failure before falling back to the safe path (lib/ai/trigger,
 * lib/ai/generate-draft).
 */

export const QUALIFY_TOPICS = [
  "budget",
  "finance",
  "trade_in",
  "timeline",
  "location",
  "intent",
  "complete",
] as const;

export const QualifyFieldsSchema = z.object({
  budget_nzd: z.number().positive().nullish(),
  finance: z.enum(["yes", "no", "unsure"]).nullish(),
  trade_in: z.enum(["yes", "no"]).nullish(),
  timeline: z.enum(["this_week", "this_month", "browsing"]).nullish(),
  location: z.string().min(1).max(120).nullish(),
  intent_score: z.number().min(0).max(1).nullish(),
});

export const QualifyOutputSchema = z.object({
  reply_text: z.string().min(1).max(2000),
  next_topic: z.enum(QUALIFY_TOPICS),
  fields: QualifyFieldsSchema.default({}),
  needs_dealer: z.boolean(),
  dealer_question: z.string().min(1).max(1000).nullish(),
});
export type QualifyOutput = z.infer<typeof QualifyOutputSchema>;

export const DraftOutputSchema = z.object({
  draft_text: z.string().min(1).max(4000),
});
export type DraftOutput = z.infer<typeof DraftOutputSchema>;

/**
 * Extracts the first {...} JSON object from a model response (models
 * sometimes wrap JSON in prose or code fences despite instructions) and
 * validates it against `schema`. Throws on failure — callers retry once,
 * then fall back to the safe path (§7 "Structured outputs ... retried once
 * on parse failure, then routed to the safe path").
 */
export interface ParseableSchema<T> {
  parse(data: unknown): T;
}

export function parseStructured<T>(schema: ParseableSchema<T>, text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  const json = JSON.parse(candidate.slice(start, end + 1));
  return schema.parse(json);
}
