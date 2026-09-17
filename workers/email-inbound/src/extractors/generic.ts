import { type Extracted, type ParsedMessage, firstEmail, firstPhone, tidy } from "./types";

/**
 * Fallback extractor for any lead email we don't have a bespoke parser for.
 * Trusts the well-defined MIME headers (From / Reply-To / Subject) and treats
 * the whole body as the buyer's message. Deliberately dumb and hard to break —
 * it is the safety net the Trade Me extractor falls back to on shape drift.
 */
export function extractGeneric(msg: ParsedMessage): Extracted {
  // A buyer replying via their own client: From is the buyer. Reply-To, when
  // present, is the better reply address, so prefer it for the email.
  const email = firstEmail(msg.replyTo?.address, msg.from?.address, msg.text, msg.html);
  const name = tidy(msg.from?.name) ?? tidy(msg.replyTo?.name);
  const message = tidy(msg.text) ?? tidy(msg.html?.replace(/<[^>]+>/g, " "));
  const phone = firstPhone(msg.text);

  // Confidence reflects how much of the essential shape we actually got.
  let confidence = 0.3;
  if (email) confidence += 0.3;
  if (name) confidence += 0.2;
  if (message) confidence += 0.2;

  return {
    name,
    email,
    phone,
    message,
    listingRef: null,
    confidence: Math.min(confidence, 1),
  };
}
