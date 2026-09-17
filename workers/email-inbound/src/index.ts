import PostalMime, { type Email } from "postal-mime";
import { buildPayload, type InboundPayload } from "./payload";
import { signPayload, type SignedRequest } from "./sign";
import { extractGeneric } from "./extractors/generic";
import { extractTrademe, looksLikeTradeMe } from "./extractors/trademe";
import type { ParsedMessage } from "./extractors/types";

/**
 * Cloudflare Email Worker for the inbound-lead lane (§5.3).
 *
 * A dealer sets ONE auto-forward rule sending their Trade Me lead emails to
 * lead-{slug}@usedcarsnz.co.nz. Email Routing's catch-all hands the message to
 * this Worker, which:
 *   - forwards non-lead / system mail (e.g. the Gmail/Outlook forwarding
 *     confirmation) to a founder address so a human completes setup;
 *   - for a lead-{slug} address, parses the MIME, extracts the buyer, HMAC-signs
 *     a canonical JSON payload, and POSTs it to the app's /api/inbound/email.
 *
 * The email body is UNTRUSTED (§7): the Worker only ever treats it as data to
 * extract from, and never as instructions.
 */

export interface Env {
  INBOUND_HMAC_SECRET: string;
  APP_INBOUND_URL: string;
  FOUNDER_FORWARD_ADDRESS: string;
}

export type InboundAction =
  | { kind: "forward"; reason: string }
  | { kind: "post"; payload: InboundPayload; signed: SignedRequest }
  | { kind: "skip"; reason: string };

const LEAD_PREFIX = "lead-";

function aliasFromRecipient(recipient: string): string {
  return (recipient.split("@")[0] ?? "").trim().toLowerCase();
}

function normalize(email: Email): ParsedMessage {
  const rt = Array.isArray(email.replyTo) ? email.replyTo[0] : email.replyTo;
  return {
    from: email.from ? { name: email.from.name ?? null, address: email.from.address ?? null } : null,
    replyTo: rt ? { name: rt.name ?? null, address: rt.address ?? null } : null,
    subject: email.subject ?? null,
    text: email.text ?? null,
    html: email.html ?? null,
    messageId: email.messageId ?? null,
    date: email.date ?? null,
  };
}

/** Parse raw RFC822 to the normalised shape the extractors consume. Exposed for tests. */
export async function parseMessage(rawEmail: string): Promise<ParsedMessage> {
  return normalize(await new PostalMime().parse(rawEmail));
}

/** Gmail/Outlook (and similar) forwarding-setup confirmations must reach a human. */
function isForwardingConfirmation(msg: ParsedMessage): boolean {
  const from = msg.from?.address?.toLowerCase() ?? "";
  const subject = msg.subject?.toLowerCase() ?? "";
  const known =
    from.includes("forwarding-noreply@google.com") ||
    from.includes("microsoft.com") ||
    from.includes("outlook.com");
  const looksLikeConfirmation = /forwarding|confirm|verification code/.test(subject);
  return (known && looksLikeConfirmation) || /forwarding[-\s]?confirmation/.test(subject);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isoDate(value: string | null, nowMs: number): string {
  if (value) {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return new Date(nowMs).toISOString();
}

/**
 * Pure decision core: raw email + recipient -> what to do. Kept separate from
 * the Cloudflare `email()` glue so it can be unit-tested against .eml fixtures.
 */
export async function buildAction(
  rawEmail: string,
  recipient: string,
  env: Env,
  nowMs: number = Date.now(),
): Promise<InboundAction> {
  const alias = aliasFromRecipient(recipient);
  if (!alias.startsWith(LEAD_PREFIX)) {
    return { kind: "forward", reason: "non-lead recipient" };
  }

  let email: Email;
  try {
    email = await new PostalMime().parse(rawEmail);
  } catch (err) {
    // Unparseable MIME: don't drop it silently — send it to a human.
    return { kind: "forward", reason: `parse failed: ${(err as Error).message}` };
  }
  const msg = normalize(email);

  if (isForwardingConfirmation(msg)) {
    return { kind: "forward", reason: "forwarding confirmation" };
  }

  const useTrademe = looksLikeTradeMe(msg);
  const extracted = useTrademe ? extractTrademe(msg) : extractGeneric(msg);
  const parser = useTrademe ? "trademe" : "generic";

  const messageId = msg.messageId?.trim() || `sha256:${await sha256Hex(rawEmail)}`;

  const payload = buildPayload({
    messageId,
    alias,
    recipient,
    parser,
    parseConfidence: extracted.confidence,
    buyer: { name: extracted.name, email: extracted.email, phone: extracted.phone },
    message: extracted.message,
    listingRef: extracted.listingRef,
    subject: msg.subject,
    receivedAt: isoDate(msg.date, nowMs),
    rawEmail,
  });

  const signed = await signPayload(JSON.stringify(payload), env.INBOUND_HMAC_SECRET, nowMs);
  return { kind: "post", payload, signed };
}

const handler = {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const rawEmail = await new Response(message.raw).text();
    const action = await buildAction(rawEmail, message.to, env);

    if (action.kind === "forward") {
      console.log(`[email-inbound] forwarding to founder: ${action.reason}`);
      await message.forward(env.FOUNDER_FORWARD_ADDRESS);
      return;
    }
    if (action.kind === "skip") {
      console.log(`[email-inbound] skipped: ${action.reason}`);
      return;
    }

    // Await the POST so the handler stays alive until it resolves and the
    // forward-on-failure fallback below can run.
    try {
      const res = await fetch(env.APP_INBOUND_URL, {
        method: "POST",
        headers: action.signed.headers,
        body: action.signed.body,
      });
      if (!res.ok) {
        // App couldn't accept it (5xx/misconfig). Don't lose the lead — hand the
        // original to a human. (A 2xx-with-reason from the app is NOT an error.)
        console.error(`[email-inbound] app POST ${res.status}; forwarding original to founder`);
        await message.forward(env.FOUNDER_FORWARD_ADDRESS);
      }
    } catch (err) {
      console.error(`[email-inbound] app POST threw; forwarding original to founder:`, err);
      await message.forward(env.FOUNDER_FORWARD_ADDRESS);
    }
  },
};

export default handler;
