/**
 * tests/db-invariants/helpers.ts — shared gate, clients and fixtures for the
 * SQL-boundary invariant suite (PROMPT-T2).
 *
 * Env-gated like scripts/metrics-views.integration.test.ts: every suite SKIPS
 * unless a LOCAL Supabase stack is configured and reachable. In ci.yml's gate
 * (no stack) they skip; in e2e.yml (stack booted) they run.
 *
 * Fixtures are deterministic and idempotent (stable UUIDs + upsert/ignore),
 * so parallel Vitest workers and repeated local runs are safe. Nothing here is
 * a secret: the keys are the CLI's public local-dev defaults and the dealer
 * passwords are derived throwaway values that only ever exist on an ephemeral
 * local stack (the same posture as E2E_TEST_EMAIL/PASSWORD in e2e.yml).
 */
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvLocal, checkDemoTarget } from "@/scripts/demo-data";

loadEnvLocal();

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

/** Direct owner connection for SQL PostgREST can't express (TRUNCATE, SET ROLE).
 * Public local-dev default from supabase/config.toml ([db].port = 54322). */
export const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const isLocal =
  checkDemoTarget({ url, appEnv: process.env.NEXT_PUBLIC_APP_ENV, secretKey }).ok &&
  /127\.0\.0\.1|localhost|:54321/.test(url) &&
  Boolean(publishableKey);

/** Deterministic UUID from a stable key (mirrors scripts/demo-data.ts du()). */
export function suid(key: string): string {
  const h = createHash("sha1").update("usedcarsnz-dbinv:" + key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Derived throwaway password — deliberately reproducible, local-stack-only. */
function pw(tag: string): string {
  return "dbinv-" + createHash("sha1").update("usedcarsnz-dbinv-pass:" + tag).digest("hex").slice(0, 16);
}

export interface DealerFixture {
  userId: string;
  email: string;
  dealerId: string;
  listingId: string;
  enquiryId: string;
  /** A draft that STAYS pending — deny-matrix tests must not consume it. */
  pendingDraftId: string;
  aliasId: string;
  messageId: string;
  client: SupabaseClient; // authenticated as this dealer's owner
}

export interface Fixtures {
  svc: SupabaseClient;
  anon: SupabaseClient;
  a: DealerFixture;
  b: DealerFixture;
}

export function serviceClient(): SupabaseClient {
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** create-or-repair an auth user; race-safe across parallel workers. */
async function ensureUser(svc: SupabaseClient, email: string, password: string): Promise<string> {
  const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.error && created.data.user) return created.data.user.id;

  const list = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw new Error(`listUsers: ${list.error.message}`);
  const existing = list.data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`createUser failed (${created.error?.message}) and ${email} not found`);
  const updated = await svc.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (updated.error) throw new Error(`updateUser ${email}: ${updated.error.message}`);
  return existing.id;
}

async function ensureDealerSide(svc: SupabaseClient, tag: "a" | "b"): Promise<Omit<DealerFixture, "client">> {
  const email = `dbinv-dealer-${tag}@example.com`;
  const userId = await ensureUser(svc, email, pw(tag));

  // Profile row (the local auth trigger usually creates it; upsert to be sure).
  await svc.from("users").upsert(
    { id: userId, role: "buyer", full_name: `DBINV Dealer ${tag.toUpperCase()}`, email },
    { onConflict: "id", ignoreDuplicates: true },
  );

  const dealerId = suid(`dealer:${tag}`);
  await svc.from("dealers").upsert(
    {
      id: dealerId,
      owner_user_id: userId,
      business_name: `DBINV Motors ${tag.toUpperCase()}`,
      email: `sales-${tag}@dbinv.example`,
      city: "Auckland",
      region: "Auckland",
      status: "approved",
      verified: true,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  const listingId = suid(`listing:${tag}`);
  await svc.from("listings").upsert(
    {
      id: listingId,
      seller_type: "dealer",
      dealer_id: dealerId,
      make: "Toyota",
      model: tag === "a" ? "Aqua" : "Vitz",
      year: 2018,
      odometer_km: 80_000,
      price_nzd: 12_990,
      is_poa: false,
      city: "Auckland",
      region: "Auckland",
      description: "DB-invariant fixture listing.",
      in_trade: true,
      cin_link: `https://example.com/cin/dbinv-${tag}`,
      status: "active",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  const enquiryId = suid(`enquiry:${tag}`);
  await svc.from("enquiries").upsert(
    {
      id: enquiryId,
      listing_id: listingId,
      buyer_name: "DBINV Buyer",
      buyer_email: `dbinv-buyer-${tag}@example.com`,
      message: "Fixture enquiry for the SQL-boundary suite.",
      status: "new",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  const pendingDraftId = suid(`draft-pending:${tag}`);
  await svc.from("ai_drafts").upsert(
    { id: pendingDraftId, enquiry_id: enquiryId, draft_text: "Fixture pending draft.", status: "pending" },
    { onConflict: "id", ignoreDuplicates: true },
  );

  const aliasId = suid(`alias:${tag}`);
  await svc.from("dealer_aliases").upsert(
    { id: aliasId, dealer_id: dealerId, alias: `dbinv-${tag}` },
    { onConflict: "id", ignoreDuplicates: true },
  );

  const messageId = suid(`message:${tag}`);
  await svc.from("messages").upsert(
    { id: messageId, enquiry_id: enquiryId, sender: "ai", body: `Fixture thread message (${tag}).` },
    { onConflict: "id", ignoreDuplicates: true },
  );

  return { userId, email, dealerId, listingId, enquiryId, pendingDraftId, aliasId, messageId };
}

let memo: Promise<Fixtures> | null = null;

/** Build (or reuse) the two-dealer fixture set and signed-in clients. */
export function fixtures(): Promise<Fixtures> {
  memo ??= (async () => {
    const svc = serviceClient();
    const [a, b] = await Promise.all([ensureDealerSide(svc, "a"), ensureDealerSide(svc, "b")]);

    async function signIn(email: string, password: string): Promise<SupabaseClient> {
      const client = createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`signIn ${email}: ${error.message}`);
      return client;
    }

    return {
      svc,
      anon: anonClient(),
      a: { ...a, client: await signIn(a.email, pw("a")) },
      b: { ...b, client: await signIn(b.email, pw("b")) },
    };
  })();
  return memo;
}

/** Count draft_approved events for a draft id (via the service role). */
export async function draftApprovedEvents(svc: SupabaseClient, draftId: string): Promise<number> {
  const { data, error } = await svc
    .from("lead_events")
    .select("id, payload")
    .eq("event_type", "draft_approved");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r) => (r.payload as { draft_id?: string })?.draft_id === draftId).length;
}
