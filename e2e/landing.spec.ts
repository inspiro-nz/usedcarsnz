import { test, expect } from "@playwright/test";

// Third-party / environment noise we don't want to fail a smoke test on:
// Turnstile widget chatter, favicon 404s, and network hiccups to external hosts.
const BENIGN_CONSOLE = /turnstile|challenges\.cloudflare|favicon|net::ERR_|Failed to load resource/i;

test.describe("landing page", () => {
  test("renders hero + CTA, returns 200, no console/page errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const res = await page.goto("/");
    expect(res?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Help every enquiry get a professional response",
    );
    await expect(
      page.getByRole("link", { name: "Join the Founding Dealer Program" }).first(),
    ).toBeVisible();

    // Uncaught exceptions are always a failure. Console errors are filtered down
    // to app-originated ones (external widget noise is expected without keys).
    expect(pageErrors, `unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
    const appErrors = consoleErrors.filter((t) => !BENIGN_CONSOLE.test(t));
    expect(appErrors, `unexpected console errors: ${appErrors.join(" | ")}`).toEqual([]);
  });
});
