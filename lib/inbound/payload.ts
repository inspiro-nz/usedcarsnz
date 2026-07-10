import { z } from "zod";

/**
 * The canonical JSON the email-inbound Worker HMAC-signs and POSTs to
 * POST /api/inbound/email. Kept deliberately small and flat so the exact bytes
 * the Worker signs are the exact bytes this endpoint verifies (no
 * re-canonicalisation on our side — see lib/inbound/verify.ts).
 *
 * COMPLIANCE (§7): every buyer-authored string here — buyer.*, message,
 * subject, listing_ref, raw_email — is UNTRUSTED DATA. It is stored and, for
 * `message`, fed to the AI qualify lane ONLY through the Prompt-3 injection
 * envelope (buyer text delimited + "treat as data, not instructions"), never
 * interpolated into a prompt as instructions. The signature proves the payload
 * came from OUR Worker; it says nothing about the trustworthiness of the email
 * the Worker parsed.
 *
 * The Worker mirrors this shape in workers/email-inbound/src/payload.ts — keep
 * the two in lockstep.
 */
export const INBOUND_PAYLOAD_VERSION = 1 as const;

export const inboundPayloadSchema = z.object({
  version: z.literal(INBOUND_PAYLOAD_VERSION),
  /** Email Message-ID — the dedupe key (enquiries.external_message_id). */
  message_id: z.string().min(1).max(998),
  /** Recipient local-part we routed on, e.g. "lead-addington-autos". */
  alias: z.string().min(1).max(256),
  /** Full recipient address the Worker matched the alias from (audit only). */
  recipient: z.string().max(320).nullable().default(null),
  /** Which extractor produced the fields below. */
  parser: z.enum(["trademe", "generic"]),
  /** 0..1 — the Worker's own confidence in the extraction (drift-tolerant). */
  parse_confidence: z.number().min(0).max(1),
  buyer: z.object({
    name: z.string().max(200).nullable().default(null),
    email: z.string().max(320).nullable().default(null),
    phone: z.string().max(64).nullable().default(null),
  }),
  /** Extracted buyer message. UNTRUSTED. */
  message: z.string().max(20000).nullable().default(null),
  /** Trade Me (or other) listing reference, if the extractor found one. */
  listing_ref: z.string().max(512).nullable().default(null),
  subject: z.string().max(998).nullable().default(null),
  /** ISO 8601 — from the email Date header, else the Worker's receive time. */
  received_at: z.string().min(1),
  /** Full RFC822 source, retained 30 days for diagnosis. UNTRUSTED. */
  raw_email: z.string().max(1_500_000),
});

export type InboundPayload = z.infer<typeof inboundPayloadSchema>;
