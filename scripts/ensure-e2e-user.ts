/**
 * scripts/ensure-e2e-user.ts — create/repair the Playwright sign-in test user.
 *
 *   npx tsx scripts/ensure-e2e-user.ts     (or: npm run e2e:setup)
 *
 * The sign-in E2E spec needs a real, confirmed Supabase user matching
 * E2E_TEST_EMAIL / E2E_TEST_PASSWORD (.env.local). A `supabase db reset` wipes
 * that user, which makes the spec fail with "Invalid login credentials" for an
 * environmental reason, not a code one. This script makes the user existence
 * idempotent: run it any time; it creates the user (auto-confirmed) or resets
 * its password to the env value if it already exists.
 *
 * HARD-GUARDED TO LOCAL: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is the
 * local Docker stack. E2E users must never be created in demo or prod.
 */
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

async function main() {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!created.error) {
    console.log(`ensure-e2e-user: created confirmed user ${email}`);
    return;
  }

  // Already exists (or races) — find it and reset the password to the env value.
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) fail(`could not list users: ${list.error.message}`);
  const existing = list.data.users.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (!existing) fail(`createUser failed (${created.error.message}) and user not found.`);

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updated.error) fail(`could not update existing user: ${updated.error.message}`);
  console.log(`ensure-e2e-user: user ${email} already existed — password re-synced to env.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
