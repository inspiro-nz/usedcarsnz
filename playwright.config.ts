import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// The app server (webServer) loads .env.local on its own, but the Playwright
// *runner* process (this config + the specs) is plain Node and does not. Load
// it here with Next's own loader so specs can read env-gated creds like
// E2E_TEST_EMAIL / E2E_TEST_PASSWORD (else signin.spec.ts always skips).
loadEnvConfig(process.cwd());

/**
 * Browser smoke tests — run locally and in CI (.github/workflows/e2e.yml
 * boots an ephemeral Supabase stack in the runner; see docs/testing.md).
 *
 * Deliberately thin: a safety net over the highest-value journeys (landing,
 * marketplace, sign-in, the money shot), not an exhaustive suite. Chromium
 * only for v1.
 *
 * Specs live in e2e/ and are kept out of the Vitest run (vitest.config.ts
 * excludes e2e/**) so the two runners never trip over each other.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Production server: routes are precompiled, so no dev-compile headroom.
    // Still generous because ISR routes render on first hit against a cold DB.
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // PRODUCTION server (`next build` then `next start`), in CI and locally when
  // nothing is already listening on :3000. This is deliberate (PROMPT-11):
  // `next dev` never enforces static/dynamic route semantics, so it hid a real
  // production 500 — the ISR listing-detail page went dynamic at runtime
  // because the marketplace header read auth cookies. The suite now runs
  // against the same server behaviour production has, and
  // e2e/marketplace.spec.ts asserts the ISR routes actually cache
  // (x-nextjs-cache: HIT on a second request) — an assertion that is only
  // meaningful, and only passes, under `next start`.
  //
  // Locally, `reuseExistingServer` still lets you point the suite at a server
  // you started yourself — make that `npm run build` + `npm run start`, not
  // `npm run dev`, or the cache assertions will (correctly) fail.
  //
  // The build inherits the runner's env: e2e.yml exports the local Supabase
  // keys into $GITHUB_ENV before this step, so NEXT_PUBLIC_* are inlined.
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
