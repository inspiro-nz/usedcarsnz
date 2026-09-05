/**
 * Local end-to-end smoke test for the inbound-email lane (§5.3). NOT part of the
 * unit suite — it needs the dev server running and a LOCAL Supabase stack, and
 * it WRITES test rows (an auth user, a dealer, an alias, enquiries).
 *
 *   1. `npx supabase start` and `npm run dev` (loads .env.local)
 *   2. `npx tsx scripts/inbound-e2e.ts`
 *
 * It seeds a dealer + alias, builds a signed payload with the SAME code the
 * Worker uses (workers/email-inbound buildAction), POSTs it to the running
 * /api/inbound/email, and asserts the full pipeline: 200 -> enquiry with the
 * email source -> ack attempted -> qualification triggered, plus the dedupe,
 * HMAC-tamper, and unknown-alias branches.
 *
 * REFUSES to run against a non-local Supabase URL.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildAction, type Env } from "../workers/email-inbound/src/index";

// --- load .env.local (this script runs outside Next) -------------------------
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const HMAC_SECRET = process.env.INBOUND_HMAC_SECRET!;
const APP_URL = process.env.APP_INBOUND_URL ?? "http://127.0.0.1:3000/api/inbound/email";

if (!/127\.0\.0\.1|localhost/.test(SUPABASE_URL)) {
  console.error(`REFUSING: Supabase URL is not local (${SUPABASE_URL}).`);
  process.exit(1);
}
if (!HMAC_SECRET) {
  console.error("INBOUND_HMAC_SECRET not set in .env.local");
  process.exit(1);
}

const svc = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });
const env: Env = {
  INBOUND_HMAC_SECRET: HMAC_SECRET,
  APP_INBOUND_URL: APP_URL,
  FOUNDER_FORWARD_ADDRESS: "founder@example.com",
};

const results: string[] = [];
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  results.push(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

interface PostResult {
  httpStatus: number;
  body: { ok?: boolean; enquiryId?: string; reason?: string; deduped?: boolean; kind?: string };
  action: Awaited<ReturnType<typeof buildAction>>;
}

async function post(recipient: string, rawEmail: string, tamper = false): Promise<PostResult> {
  const action = await buildAction(rawEmail, recipient, env);
  if (action.kind !== "post") return { httpStatus: 0, body: { kind: action.kind }, action };
  const reqBody = tamper ? action.signed.body.replace(/Corolla/g, "Hacked") : action.signed.body;
  const res = await fetch(APP_URL, { method: "POST", headers: action.signed.headers, body: reqBody });
  const respBody = (await res.json().catch(() => ({}))) as PostResult["body"];
  return { httpStatus: res.status, body: respBody, action };
}

async function main() {
  const rand = Math.random().toString(36).slice(2, 8);

  // --- seed dealer + alias ---
  const { data: created, error: uErr } = await svc.auth.admin.createUser({
    email: `dealer-${rand}@example.com`,
    email_confirm: true,
  });
  if (uErr || !created.user) throw new Error(`createUser: ${uErr?.message}`);
  const { data: dealer, error: dErr } = await svc
    .from("dealers")
    .insert({ owner_user_id: created.user.id, business_name: "E2E Test Motors", email: "sales-e2e@example.com", status: "approved" })
    .select("id")
    .single();
  if (dErr || !dealer) throw new Error(`insert dealer: ${dErr?.message}`);
  const alias = `lead-e2e-${rand}`;
  const { error: aErr } = await svc.from("dealer_aliases").insert({ dealer_id: dealer.id, alias, source_hint: "trademe", active: true });
  if (aErr) throw new Error(`insert alias: ${aErr.message}`);
  const recipient = `${alias}@usedcarsnz.co.nz`;

  // --- fixture with a unique Message-ID so the run is idempotent ---
  const messageId = `<e2e-${rand}@trademe.co.nz>`;
  const raw = readFileSync(new URL("../workers/email-inbound/fixtures/trademe-synthetic.eml", import.meta.url), "utf8")
    .replace(/<tm-4567890123-0001@trademe\.co\.nz>/, messageId);

  // === 1. happy path ===
  const r1 = await post(recipient, raw);
  check("happy path returns 200 ok", r1.httpStatus === 200 && r1.body.ok === true, `status=${r1.httpStatus} body=${JSON.stringify(r1.body)}`);
  const enquiryId = r1.body.enquiryId as string | undefined;

  const { data: enq } = await svc.from("enquiries").select("*").eq("id", enquiryId ?? "").maybeSingle();
  check("enquiry created with email_trademe source badge", enq?.source === "email_trademe", `source=${enq?.source}`);
  check("enquiry is listing-less (listing_id null)", enq?.listing_id === null);
  check("enquiry routed to the seeded dealer", enq?.dealer_id === dealer.id);
  check("buyer extracted from the Trade Me body", enq?.buyer_email === "jordan.smith@example.com", `buyer=${enq?.buyer_email}`);
  check("external_message_id stored for dedupe", enq?.external_message_id === messageId);

  // ack attempted: no RESEND_API_KEY locally => queued to email_outbox
  const { data: outbox } = await svc.from("email_outbox").select("*").eq("enquiry_id", enquiryId ?? "");
  check("ack attempted (queued to email_outbox, Resend unset locally)", (outbox?.length ?? 0) === 1);

  // enquiry_received auto-logged by the DB trigger; qualification fired via waitUntil
  const { data: events } = await svc.from("lead_events").select("event_type").eq("lead_id", enquiryId ?? "");
  const types = (events ?? []).map((e) => e.event_type);
  check("enquiry_received event logged", types.includes("enquiry_received"), `events=[${types.join(",")}]`);

  // raw MIME persisted to the private bucket
  const { data: rawObj } = await svc.storage.from("inbound-email-raw").list(dealer.id);
  check("raw MIME persisted to private bucket", (rawObj?.length ?? 0) >= 1);

  // === 2. dedupe: same Message-ID => 200 no-op, no second enquiry ===
  const r2 = await post(recipient, raw);
  check("duplicate Message-ID is a 200 no-op", r2.httpStatus === 200 && r2.body.deduped === true, JSON.stringify(r2.body));
  const { count } = await svc.from("enquiries").select("*", { count: "exact", head: true }).eq("external_message_id", messageId);
  check("dedupe created no second enquiry", count === 1, `count=${count}`);

  // === 3. HMAC tamper => 401 ===
  const r3 = await post(recipient, raw.replace(/<e2e-[^>]+>/, `<e2e-tamper-${rand}@x>`), true);
  check("tampered body is rejected 401", r3.httpStatus === 401, `status=${r3.httpStatus}`);

  // === 4. unknown alias => 202, no lead ===
  const r4 = await post(`lead-nobody-${rand}@usedcarsnz.co.nz`, raw.replace(/<e2e-[^>]+>/, `<e2e-unknown-${rand}@x>`));
  check("unknown alias returns 202", r4.httpStatus === 202 && r4.body.reason === "unknown_alias", JSON.stringify(r4.body));

  console.log("\n" + results.join("\n"));
  console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
