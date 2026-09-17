/**
 * The canonical payload the Worker signs and POSTs to POST /api/inbound/email.
 * MUST stay in lockstep with lib/inbound/payload.ts on the app side (that file
 * zod-validates exactly this shape). Kept as a plain type + builder here so the
 * Worker bundle stays dependency-light.
 */
export const INBOUND_PAYLOAD_VERSION = 1 as const;

export interface InboundPayload {
  version: typeof INBOUND_PAYLOAD_VERSION;
  message_id: string;
  alias: string;
  recipient: string | null;
  parser: "trademe" | "generic";
  parse_confidence: number;
  buyer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  message: string | null;
  listing_ref: string | null;
  subject: string | null;
  received_at: string;
  raw_email: string;
}

export interface BuildPayloadInput {
  messageId: string;
  alias: string;
  recipient: string | null;
  parser: "trademe" | "generic";
  parseConfidence: number;
  buyer: { name: string | null; email: string | null; phone: string | null };
  message: string | null;
  listingRef: string | null;
  subject: string | null;
  receivedAt: string;
  rawEmail: string;
}

export function buildPayload(input: BuildPayloadInput): InboundPayload {
  return {
    version: INBOUND_PAYLOAD_VERSION,
    message_id: input.messageId,
    alias: input.alias,
    recipient: input.recipient,
    parser: input.parser,
    parse_confidence: input.parseConfidence,
    buyer: input.buyer,
    message: input.message,
    listing_ref: input.listingRef,
    subject: input.subject,
    received_at: input.receivedAt,
    raw_email: input.rawEmail,
  };
}
