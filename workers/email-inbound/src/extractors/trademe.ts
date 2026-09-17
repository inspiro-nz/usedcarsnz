import { type Extracted, type ParsedMessage, firstEmail, firstPhone, tidy } from "./types";
import { extractGeneric } from "./generic";

/**
 * Extractor for Trade Me Motors lead-notification emails.
 *
 * IMPORTANT: we do NOT have confirmed real Trade Me samples. This is written
 * against SYNTHETIC fixtures (fixtures/trademe-*.eml) whose structure is our
 * best-effort reconstruction. Real emails WILL drift from it, so every field is
 * parsed independently and defensively: a miss falls back to the generic
 * heuristics, never throws, and lowers parse_confidence rather than dropping the
 * lead. When the shape is unrecognisable it degrades fully to extractGeneric.
 *
 * TODO(fixtures): replace/augment fixtures/trademe-synthetic.eml with a real
 * (redacted) Trade Me lead email once the pilot produces one, then tighten the
 * label patterns below to match. See fixtures/README.md.
 */

const LABEL = {
  from: /^\s*(?:from|buyer|name)\s*:\s*(.+)$/im,
  email: /^\s*(?:e-?mail|email address)\s*:\s*(.+)$/im,
  phone: /^\s*(?:phone|mobile|contact(?:\s*number)?)\s*:\s*(.+)$/im,
  listing: /^\s*listing\s*(?:number|#|id)\s*:\s*([A-Z0-9-]+)/im,
};
const LISTING_URL_RE = /trademe\.co\.nz\/[^\s]*?(?:listing\/|-)(\d{6,})/i;
// Everything after a "Message:" / "Question:" label, up to a footer sentinel.
const MESSAGE_BLOCK_RE = /^\s*(?:message|question|enquiry|comments?)\s*:\s*([\s\S]*)$/im;
const FOOTER_RE = /\n\s*(?:--\s*\n|this (?:message|email) was sent via trade\s?me|reply directly|to reply to this)/i;

export function looksLikeTradeMe(msg: ParsedMessage): boolean {
  const fromAddr = msg.from?.address?.toLowerCase() ?? "";
  if (fromAddr.includes("trademe.co.nz")) return true;
  const hay = `${msg.subject ?? ""}\n${msg.text ?? ""}`.toLowerCase();
  return /trade\s?me/.test(hay) && /(listing (number|#|id)|trademe\.co\.nz\/)/i.test(hay);
}

function listingRef(msg: ParsedMessage): string | null {
  const body = `${msg.text ?? ""}\n${msg.html ?? ""}`;
  const labelled = LABEL.listing.exec(body);
  if (labelled) return tidy(labelled[1]);
  const url = LISTING_URL_RE.exec(body);
  return url ? url[1] : null;
}

function messageBlock(text: string | null): string | null {
  if (!text) return null;
  const m = MESSAGE_BLOCK_RE.exec(text);
  if (!m) return null;
  let block = m[1];
  const footer = FOOTER_RE.exec(block);
  if (footer) block = block.slice(0, footer.index);
  return tidy(block);
}

export function extractTrademe(msg: ParsedMessage): Extracted {
  const text = msg.text ?? "";
  const generic = extractGeneric(msg);

  const fromLabel = LABEL.from.exec(text);
  const emailLabel = LABEL.email.exec(text);
  const phoneLabel = LABEL.phone.exec(text);

  const name = tidy(fromLabel?.[1]) ?? generic.name;
  const email = firstEmail(emailLabel?.[1]) ?? generic.email;
  const phone = firstPhone(phoneLabel?.[1]) ?? firstPhone(text) ?? generic.phone;
  const ref = listingRef(msg);
  const message = messageBlock(text) ?? generic.message;

  // Count the Trade-Me-specific signals we actually matched; if essentially
  // none, this isn't the shape we think it is — hand back the generic result so
  // we don't over-claim confidence on a drifted email.
  const structuredHits = [Boolean(fromLabel), Boolean(emailLabel), Boolean(ref), Boolean(messageBlock(text))].filter(
    Boolean,
  ).length;
  if (structuredHits === 0) {
    return { ...generic, listingRef: ref };
  }

  const confidence = Math.min(0.4 + structuredHits * 0.15, 1);
  return { name, email, phone, message, listingRef: ref, confidence };
}
