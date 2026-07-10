import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke tests — LOCAL ONLY for now (see docs/testing.md).
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
  // Boots `next dev` and waits for it. Locally, reuse an already-running server.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
