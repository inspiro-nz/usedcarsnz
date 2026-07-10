import { test, expect } from "@playwright/test";

/**
 * Sign-in smoke — the priority journey.
 *
 * Guards the two-part regression that recently broke this page:
 *   1. `sb.auth.signInWithPassword is not a function` (the browser client was a
 *      stub) — asserted absent on both the happy and error paths.
 *   2. Good credentials must produce a *real* authenticated session, proven by
 *      the auth-gated /account page rendering instead of bouncing to /sign-in.
 *
 * Needs a known Supabase test user. Credentials come from env — never hardcoded.
 * Without them the specs SKIP (they don't fail): see docs/testing.md for how to
 * create the user and set E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;
const MISSING_CREDS =
  "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD and create the Supabase test user (see docs/testing.md).";

// Design-system token for the shared ErrorNote banner (components/marketplace/ui).
const ERROR_BANNER = "div.bg-red-50";
const NOT_A_FUNCTION = /is not a function/i;

test.describe("sign-in", () => {
  test("valid credentials reach an authenticated area", async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, MISSING_CREDS);

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    // On success the form redirects to "/". Wait for that, but don't hang if it
    // instead surfaces an error — we diagnose that case explicitly below.
    await page
      .waitForURL((u) => u.pathname === "/", { timeout: 30_000 })
      .catch(() => {});

    if (new URL(page.url()).pathname.startsWith("/sign-in")) {
      const banner = page.locator(ERROR_BANNER);
      const msg = (await banner.count()) ? await banner.innerText() : "(no error shown)";
      if (/not configured/i.test(msg)) {
        throw new Error(
          `App is missing NEXT_PUBLIC_SUPABASE_* so the browser client is a stub: ${msg}`,
        );
      }
      throw new Error(`Sign-in did not redirect. Banner said: ${msg}`);
    }

    // The exact regression must never appear.
    await expect(page.locator(ERROR_BANNER)).toHaveCount(0);

    // Real proof of session: the auth-gated account page renders (it redirects
    // to /sign-in when unauthenticated).
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "My account" }),
    ).toBeVisible();
  });

  test("bad credentials show an error, not a crash", async ({ page }) => {
    test.skip(!EMAIL, MISSING_CREDS);

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(EMAIL!);
    await page
      .getByLabel("Password", { exact: true })
      .fill("definitely-not-the-password-000");
    await page.getByRole("button", { name: "Sign in" }).click();

    // An error banner appears...
    const banner = page.locator(ERROR_BANNER);
    await expect(banner).toBeVisible();
    // ...and it is a real auth error, NOT the "is not a function" regression,
    // and NOT the "not configured" stub message.
    await expect(banner).not.toContainText(NOT_A_FUNCTION);
    await expect(banner).not.toContainText(/not configured/i);
    // We stayed on the sign-in page (no navigation, no crash).
    expect(new URL(page.url()).pathname).toContain("/sign-in");
    expect(pageErrors, `unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});
