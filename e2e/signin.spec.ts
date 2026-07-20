import { test, expect } from "@playwright/test";

/**
 * Sign-in smoke — the priority journey.
 *
 * Guards the two-part regression that recently broke this page:
 *   1. `sb.auth.signInWithPassword is not a function` (the browser client was a
 *      stub) — asserted absent on both the happy and error paths.
 *   2. Good credentials must produce a *real* authenticated session AND land
 *      the user on a purposeful, role-aware home — never the founding-dealer
 *      marketing page ("/"). A buyer reaches /account; a dealer reaches /dealer.
 *      (Before PROMPT-10 both were dumped on "/".)
 *
 * Needs a known Supabase test user. Credentials come from env — never hardcoded.
 * Without them the specs SKIP (they don't fail): see docs/testing.md for how to
 * create the users and set E2E_TEST_EMAIL/PASSWORD (buyer) and
 * E2E_DEALER_EMAIL/PASSWORD (dealer, via `npm run e2e:setup`).
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;
const DEALER_EMAIL = process.env.E2E_DEALER_EMAIL;
const DEALER_PASSWORD = process.env.E2E_DEALER_PASSWORD;
const MISSING_CREDS =
  "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD and create the Supabase test user (see docs/testing.md).";
const MISSING_DEALER =
  "Set E2E_DEALER_EMAIL + E2E_DEALER_PASSWORD and run `npm run e2e:setup` (see docs/testing.md).";

// Design-system token for the shared ErrorNote banner (components/marketplace/ui).
const ERROR_BANNER = "div.bg-red-50";
const NOT_A_FUNCTION = /is not a function/i;

test.describe("sign-in", () => {
  test("a buyer lands on their account home, not the marketing page", async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, MISSING_CREDS);

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    // The role router (/home) forwards a buyer to /account. Wait for that, but
    // don't hang if it instead surfaces an error — diagnosed explicitly below.
    await page
      .waitForURL((u) => u.pathname === "/account", { timeout: 30_000 })
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

    // NEW destination proof: a buyer lands on /account — never stranded on "/".
    expect(new URL(page.url()).pathname).toBe("/account");
    // The exact regression must never appear.
    await expect(page.locator(ERROR_BANNER)).toHaveCount(0);

    // Real proof of session AND that this is the buyer HOME: the auth-gated
    // account page (redirects to /sign-in when unauthenticated) renders its
    // heading and the buyer-home "Your enquiries" section.
    await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your enquiries" })).toBeVisible();
  });

  test("a dealer lands on their dashboard home, not the marketing page", async ({ page }) => {
    test.skip(!DEALER_EMAIL || !DEALER_PASSWORD, MISSING_DEALER);

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(DEALER_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(DEALER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    // A dealer (owns a dealership) is routed to the dealer home — the app they
    // signed in to work, not their own sales pitch.
    await page.waitForURL((u) => u.pathname === "/dealer", { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe("/dealer");
    await expect(page.locator(ERROR_BANNER)).toHaveCount(0);

    // The dealer home opens on work-to-do, with the inbox one click away.
    await expect(
      page.getByRole("heading", { name: "Leads needing action" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open inbox" })).toBeVisible();
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
