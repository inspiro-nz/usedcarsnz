import "server-only";

import type { InboundPayload } from "@/lib/inbound/payload";
import type { FirstTouchInput } from "@/lib/enquiries/first-touch";
import type { EnquirySource } from "@/lib/db/types";

/**
 * Turns a verified inbound-email payload into a lead, running the SAME first
 * touch as the platform form (lib/enquiries/first-touch.ts). Honest failure
 * handling is the priority (§5.3): the Worker must never get a 500 it will
 * retry into a storm, so every "can't process this one" outcome is a 2xx with a
 * reason, and the founder is notified out-of-band.
 *
 * Dependencies are injected so this is unit-testable without a live DB / Resend
 * / storage — the route wires the real ones.
 */

interface QueryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}
interface SelectChain {
  eq(col: string, val: unknown): SelectChain;
  maybeSingle<T>(): Promise<QueryResult<T>>;
}
interface InsertChain {
  select(cols: string): InsertChain;
  single<T>(): Promise<QueryResult<T>>;
}
interface InboundTable {
  select(cols: string): SelectChain;
  insert(row: Record<string, unknown>): InsertChain;
}
export interface InboundDb {
  from(table: string): InboundTable;
}

export interface IngestDeps {
  svc: InboundDb;
  /** Persists the raw MIME to the private retention bucket. Best-effort. */
  persistRaw: (objectKey: string, rawEmail: string) => Promise<void>;
  /** The shared ack + qualification hand-off. */
  runFirstTouch: (input: FirstTouchInput) => Promise<void>;
  /** Out-of-band notice to the founder for anything a human should look at. */
  notifyFounder: (subject: string, text: string) => Promise<void>;
  /** ctx.waitUntil — passed through to runFirstTouch for qualification. */
  waitUntil: (promise: Promise<unknown>) => void;
}

export interface IngestResult {
  status: 200 | 202;
  body: { ok: boolean; enquiryId?: string; reason?: string; deduped?: boolean };
}

interface AliasRow {
  dealer_id: string;
  source_hint: "trademe" | "generic";
  active: boolean;
}
interface DealerRow {
  business_name: string;
  email: string | null;
  logo_url: string | null;
  email_ack_enabled: boolean;
}

/** "Addington Autos" -> `"Addington Autos via UsedCarsNZ" <no-reply@usedcarsnz.co.nz>`. */
function ackFromLabel(dealerName: string | null): string | undefined {
  if (!dealerName) return undefined;
  const safe = dealerName.replace(/[\r\n"]/g, " ").trim();
  if (!safe) return undefined;
  return `"${safe} via UsedCarsNZ" <no-reply@usedcarsnz.co.nz>`;
}

function fallbackBuyerName(name: string | null, email: string): string {
  if (name && name.trim()) return name.trim();
  const local = email.split("@")[0];
  return local && local.trim() ? local.trim() : "Email enquiry";
}

export async function ingestInboundEmail(
  payload: InboundPayload,
  deps: IngestDeps,
): Promise<IngestResult> {
  const { svc } = deps;

  // We can't create a routable, ack-able lead without a buyer email address —
  // enquiries.buyer_email is NOT NULL and the whole point is to reply. Ack the
  // Worker (2xx, no retry) and flag it for a human.
  const buyerEmail = payload.buyer.email?.trim() || null;
  if (!buyerEmail) {
    await deps.notifyFounder(
      "Inbound email: no buyer address extracted",
      `alias=${payload.alias} message_id=${payload.message_id} parser=${payload.parser}\n` +
        `Subject: ${payload.subject ?? "(none)"}\nNo buyer email could be extracted; not creating a lead.`,
    );
    return { status: 202, body: { ok: false, reason: "no_buyer_email" } };
  }

  // Dedupe: a re-delivered / re-forwarded copy of the same Message-ID is a
  // 200 no-op (the unique partial index enquiries_external_message_id_key is
  // the backstop for the race below).
  const existing = await svc
    .from("enquiries")
    .select("id")
    .eq("external_message_id", payload.message_id)
    .maybeSingle<{ id: string }>();
  if (existing.data?.id) {
    return { status: 200, body: { ok: true, enquiryId: existing.data.id, deduped: true } };
  }

  // Resolve the dealer from the alias — the ONLY trusted routing signal. An
  // unknown/inactive alias is a 202 (ack + notify), never a 500.
  const aliasRes = await svc
    .from("dealer_aliases")
    .select("dealer_id, source_hint, active")
    .eq("alias", payload.alias)
    .maybeSingle<AliasRow>();
  const alias = aliasRes.data;
  if (!alias || !alias.active) {
    await deps.notifyFounder(
      "Inbound email: unknown alias",
      `An email arrived for alias "${payload.alias}" (message_id=${payload.message_id}) ` +
        `but no active dealer_aliases row matched. No lead was created.`,
    );
    return { status: 202, body: { ok: false, reason: "unknown_alias" } };
  }

  const dealerRes = await svc
    .from("dealers")
    .select("business_name, email, logo_url, email_ack_enabled")
    .eq("id", alias.dealer_id)
    .maybeSingle<DealerRow>();
  const dealer = dealerRes.data;

  const source: EnquirySource = alias.source_hint === "trademe" ? "email_trademe" : "email_other";

  // Create the lead (service-role). listing_id is NULL — set_enquiry_denorm
  // (migration 16) trusts our alias-resolved dealer_id for listing-less leads.
  const insertRes = await svc
    .from("enquiries")
    .insert({
      listing_id: null,
      dealer_id: alias.dealer_id,
      buyer_name: fallbackBuyerName(payload.buyer.name, buyerEmail),
      buyer_email: buyerEmail,
      buyer_phone: payload.buyer.phone?.trim() || null,
      message: payload.message,
      source,
      external_message_id: payload.message_id,
    })
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();

  if (insertRes.error || !insertRes.data) {
    // Lost the dedupe race (concurrent insert of the same Message-ID) -> treat
    // as the no-op it is.
    if (insertRes.error?.code === "23505") {
      const dup = await svc
        .from("enquiries")
        .select("id")
        .eq("external_message_id", payload.message_id)
        .maybeSingle<{ id: string }>();
      return { status: 200, body: { ok: true, enquiryId: dup.data?.id, deduped: true } };
    }
    await deps.notifyFounder(
      "Inbound email: enquiry insert failed",
      `alias=${payload.alias} message_id=${payload.message_id}\nError: ${insertRes.error?.message ?? "unknown"}`,
    );
    return { status: 202, body: { ok: false, reason: "insert_failed" } };
  }
  const enquiry = insertRes.data;

  // Retention: persist the raw MIME. Best-effort — a storage hiccup must not
  // lose the lead we already created.
  try {
    await deps.persistRaw(`${alias.dealer_id}/${enquiry.id}.eml`, payload.raw_email);
  } catch (err) {
    console.error(`[inbound] raw-MIME persist failed for ${enquiry.id}:`, err);
  }

  // Same first touch as the platform form: templated ack (per-dealer opt-in for
  // this lane) + qualification hand-off. From is labelled as the dealer.
  await deps.runFirstTouch({
    enquiry: { id: enquiry.id, created_at: enquiry.created_at },
    buyer: { name: fallbackBuyerName(payload.buyer.name, buyerEmail), email: buyerEmail },
    dealer: {
      name: dealer?.business_name ?? null,
      email: dealer?.email ?? null,
      logoUrl: dealer?.logo_url ?? null,
    },
    ackEnabled: dealer?.email_ack_enabled ?? true,
    ackFrom: ackFromLabel(dealer?.business_name ?? null),
    channel: "email",
    waitUntil: deps.waitUntil,
  });

  return { status: 200, body: { ok: true, enquiryId: enquiry.id } };
}
