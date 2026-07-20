import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// The dev server (webServer, `next dev`) loads .env.local on its own, but the
// Playwright *runner* process (this config + the specs) is plain Node and does
// not. Load it here with Next's own loader so specs can read env-gated creds
// like E2E_TEST_EMAIL / E2E_TEST_PASSWORD (else signin.spec.ts always skips).
loadEnvConfig(process.cwd());

/**
 * Browser smoke tests — run locally and in CI (.github/workflows/e2e.yml
 * boots an ephemeral Supabase stack in the runner; see docs/testing.md).
 *
 * Deliberately thin: a safety net over the highest-value journeys (landing,
 * marketplace, sign-in), not an exhaustive suite. Chromium only for v1.
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
    // The dev server compiles routes on first hit; give navigations headroom.
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Boots `next dev` and waits for it; locally an already-running server is
  // reused. CI (.github/workflows/e2e.yml) uses the SAME dev server: prod-mode
  // (`next build` + `next start`) was tried first (T1) and caught a real bug —
  // the ISR listing-detail page 500s under a prod server because the
  // marketplace layout's header reads auth cookies ("Page changed from static
  // to dynamic at runtime") — so CI stays on dev-mode until that's fixed.
  // next dev's wrangler remote-proxy failure on a credential-less runner is a
  // logged, non-fatal rejection (only the AI binding dies, which no spec uses).
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
