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
