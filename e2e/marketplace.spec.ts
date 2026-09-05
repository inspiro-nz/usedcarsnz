import { test, expect } from "@playwright/test";

// Listing detail links are /cars/<make>/<model>/<year>/<id> (lib/format:listingPath).
// A card is any anchor under <main> with 4+ path segments after /cars/.
const LISTING_LINK = 'main a[href^="/cars/"]';

test.describe("marketplace", () => {
  test("listing index renders results or an empty state", async ({ page }) => {
    const res = await page.goto("/cars");
    expect(res?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: "Browse used cars" }),
    ).toBeVisible();

    // Data-independent: with stock we show cards; empty DB shows the empty state.
    const cards = page.locator(LISTING_LINK);
    const emptyState = page.getByText("No cars match those filters");
    const hasCards = (await cards.count()) > 0;
    expect(
      hasCards || (await emptyState.isVisible()),
      "expected either listing cards or the empty state",
    ).toBeTruthy();
  });

  test("a listing detail page loads", async ({ page }) => {
    await page.goto("/cars");
    const firstCard = page.locator(LISTING_LINK).first();

    if ((await page.locator(LISTING_LINK).count()) === 0) {
      test.skip(true, "No listings in this environment — seed the DB to cover detail.");
      return;
    }

    await firstCard.click();
    await expect(page).toHaveURL(/\/cars\/[^/]+\/[^/]+\/[^/]+\/[^/]+/);
    // Spec sheet labels render for every listing regardless of data.
    await expect(page.getByText("Odometer", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

/**
 * ISR proof (PROMPT-11). The two public demand-surface routes — listing detail
 * and dealer storefront — declare `revalidate = 300`, and the whole point of
 * that is a cache hit on the second request. Before PROMPT-11 the marketplace
 * header read auth cookies inside the shared layout, which under a production
 * build turned listing detail into a 500 ("Page changed from static to dynamic
 * at runtime, reason: cookies") and kept the storefront force-dynamic. `next
 * dev` never reproduces either, so these assertions are only meaningful against
 * `next build` + `next start` — which is what playwright.config.ts now boots.
 *
 * `x-nextjs-cache` is the header `next start` emits for ISR routes
 * (HIT | STALE | MISS | REVALIDATED). HIT or STALE both mean "served from the
 * cache"; a missing header means the route was rendered dynamically.
 */
const SERVED_FROM_CACHE = /^(HIT|STALE)$/;
const DEALER_LOC = /<loc>([^<]*\/dealers\/[^<]+)<\/loc>/;

test.describe("ISR cache (production server)", () => {
  test("listing detail is served from the cache on the second request", async ({ page, request }) => {
    await page.goto("/cars");
    if ((await page.locator(LISTING_LINK).count()) === 0) {
      test.skip(true, "No listings in this environment — seed the DB to cover ISR.");
      return;
    }
    const href = await page.locator(LISTING_LINK).first().getAttribute("href");
    expect(href).toBeTruthy();

    const first = await request.get(href!);
    expect(first.status(), "first request must not 500 (static→dynamic regression)").toBe(200);
    const second = await request.get(href!);
    expect(second.status()).toBe(200);
    expect(
      second.headers()["x-nextjs-cache"] ?? "(absent: rendered dynamically, not cached)",
      "second request must be served from the ISR cache",
    ).toMatch(SERVED_FROM_CACHE);
  });

  test("dealer storefront is served from the cache on the second request", async ({ request }) => {
    // Discover a storefront via the sitemap, which lists every approved dealer
    // and does not depend on listing detail rendering (it 500'd before this
    // fix — routing discovery through it would turn a failure into a skip).
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const loc = sitemap.match(DEALER_LOC)?.[1] ?? null;
    if (!loc) {
      test.skip(true, "No dealers in the sitemap — seed the DB to cover the storefront.");
      return;
    }
    const href = new URL(loc).pathname; // sitemap URLs carry NEXT_PUBLIC_SITE_URL's host

    const first = await request.get(href);
    expect(first.status()).toBe(200);
    const second = await request.get(href);
    expect(second.status()).toBe(200);
    expect(
      second.headers()["x-nextjs-cache"] ?? "(absent: rendered dynamically, not cached)",
      "second request must be served from the ISR cache",
    ).toMatch(SERVED_FROM_CACHE);
  });
});
