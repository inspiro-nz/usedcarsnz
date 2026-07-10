/**
 * Normalised view of a parsed email, decoupled from postal-mime's types so the
 * extractors are pure and unit-testable against fixtures. src/index.ts builds
 * this from the PostalMime result.
 */
export interface ParsedMessage {
  from: { name: string | null; address: string | null } | null;
  replyTo: { name: string | null; address: string | null } | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
  date: string | null;
}

export interface Extracted {
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  listingRef: string | null;
  /**
   * 0..1. The app stores this on the payload; low confidence is a signal, not a
   * rejection — a partially-parsed lead is still a lead worth a human's eyes.
   */
  confidence: number;
}

// --- shared, defensive helpers (never throw on odd input) --------------------

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// NZ-ish phone: +64 / 0xx, spaces/dashes/parens tolerated, 7-12 digits.
const PHONE_RE = /(\+?64|0)[\s\-()]*\d(?:[\s\-()]*\d){6,11}/;

export function firstEmail(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = EMAIL_RE.exec(c);
    if (m) return m[0].toLowerCase();
  }
  return null;
}

export function firstPhone(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = PHONE_RE.exec(text);
  if (!m) return null;
  const digits = m[0].replace(/[^\d+]/g, "");
  return digits.length >= 8 ? m[0].trim() : null;
}

/** Collapse whitespace and trim; null-safe. */
export function tidy(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return t.length ? t : null;
}
