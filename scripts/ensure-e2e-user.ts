/**
 * scripts/ensure-e2e-user.ts — create/repair the Playwright test users.
 *
 *   npx tsx scripts/ensure-e2e-user.ts     (or: npm run e2e:setup)
 *
 * Two idempotent fixtures:
 *   1. The SIGN-IN user (E2E_TEST_EMAIL / E2E_TEST_PASSWORD) — required; the
 *      sign-in spec skips without it. A `supabase db reset` wipes the user,
 *      which makes the spec fail environmentally; re-run this any time.
 *   2. The DEALER user + dealership + one active listing
 *      (E2E_DEALER_EMAIL / E2E_DEALER_PASSWORD) — optional; provisioned only
 *      when those env vars are set. The money-shot spec
 *      (e2e/money-shot.spec.ts) drives the full enquiry → inbox → approve
 *      journey against this self-contained dealership (deterministic IDs, so
 *      re-runs are no-ops). The user must OWN the dealership: getViewer()
 *      resolves dealer membership via dealers.owner_user_id only.
 *
 * HARD-GUARDED TO LOCAL: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is the
 * local Docker stack. E2E users must never be created in demo or prod.
 */
import { createHash } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const email = process.env.E2E_TEST_EMAIL ?? "";
const password = process.env.E2E_TEST_PASSWORD ?? "";

function fail(msg: string): never {
  console.error(`ensure-e2e-user: ${msg}`);
  process.exit(1);
}

if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) {
  fail(
    `refusing to run: NEXT_PUBLIC_SUPABASE_URL is "${url || "(unset)"}" — ` +
      `this script only ever targets the LOCAL Supabase stack (http://127.0.0.1:54321).`,
  );
}
if (!secretKey) fail("SUPABASE_SECRET_KEY is unset (use the LOCAL stack's secret key).");
if (!email || !password) {
  fail("E2E_TEST_EMAIL / E2E_TEST_PASSWORD are unset in .env.local — see docs/testing.md.");
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Deterministic UUID for the dealer fixtures, so re-runs are no-ops. */
function e2eId(key: string): string {
  const h = createHash("sha1").update("usedcarsnz-e2e:" + key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** create-or-repair one confirmed auth user; returns its id. */
async function ensureUser(userEmail: string, userPassword: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: userEmail,
    password: userPassword,
    email_confirm: true,
  });
  if (!created.error && created.data.user) {
    console.log(`ensure-e2e-user: created confirmed user ${userEmail}`);
    return created.data.user.id;
  }

  // Already exists (or races) — find it and reset the password to the env value.
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) fail(`could not list users: ${list.error.message}`);
  const existing = list.data.users.find(
    (u) => (u.email ?? "").toLowerCase() === userEmail.toLowerCase(),
  );
  if (!existing) fail(`createUser failed (${created.error?.message}) and user not found.`);

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password: userPassword,
    email_confirm: true,
  });
  if (updated.error) fail(`could not update existing user: ${updated.error.message}`);
  console.log(`ensure-e2e-user: user ${userEmail} already existed — password re-synced to env.`);
  return existing.id;
}

/** The money-shot spec's self-contained dealership (owner + one active listing). */
async function ensureDealerFixture(ownerId: string, ownerEmail: string): Promise<void> {
  // Profile row: the local auth trigger normally creates it; upsert to be sure.
  const profile = await admin.from("users").upsert(
    { id: ownerId, role: "buyer", full_name: "E2E Dealer Owner", email: ownerEmail },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (profile.error) fail(`dealer profile: ${profile.error.message}`);

  const dealerId = e2eId("dealer");
  const dealer = await admin.from("dealers").upsert(
    {
      id: dealerId,
      owner_user_id: ownerId,
      business_name: "E2E Demo Motors",
      email: "sales@e2e-demo-motors.example",
      city: "Auckland",
      region: "Auckland",
      status: "approved", // service role is trusted by guard_dealer_row
      verified: true,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (dealer.error) fail(`dealer row: ${dealer.error.message}`);

  const listing = await admin.from("listings").upsert(
    {
      id: e2eId("listing"),
      seller_type: "dealer",
      dealer_id: dealerId,
      make: "Honda",
      model: "Jazz",
      year: 2019,
      variant: "RS",
      odometer_km: 45_000,
      price_nzd: 16_990,
      is_poa: false,
      city: "Auckland",
      region: "Auckland",
      description: "E2E money-shot fixture listing. Not a real car.",
      in_trade: true,
      cin_link: "https://example.com/cin/e2e-money-shot",
      status: "active",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (listing.error) fail(`dealer listing: ${listing.error.message}`);
  console.log(`ensure-e2e-user: dealer fixture ready (E2E Demo Motors, listing ${e2eId("listing")}).`);
}

async function main() {
  await ensureUser(email, password);

  const dealerEmail = process.env.E2E_DEALER_EMAIL ?? "";
  const dealerPassword = process.env.E2E_DEALER_PASSWORD ?? "";
  if (dealerEmail && dealerPassword) {
    const ownerId = await ensureUser(dealerEmail, dealerPassword);
    await ensureDealerFixture(ownerId, dealerEmail);
  } else {
    console.log(
      "ensure-e2e-user: E2E_DEALER_EMAIL/PASSWORD unset — skipping the dealer fixture (money-shot spec will skip).",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
