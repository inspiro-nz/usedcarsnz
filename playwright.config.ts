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
  // Boots the app and waits for it. Locally: `next dev`, reusing an already-
  // running server. In CI (.github/workflows/e2e.yml): the PRODUCTION server —
  // the workflow runs `next build` first, then `npm run start` here. CI cannot
  // use `next dev` because initOpenNextCloudflareForDev() (next.config.js)
  // spawns a wrangler proxy that needs Cloudflare auth the runner doesn't have.
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
