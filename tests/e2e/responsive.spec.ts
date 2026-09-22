import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

/** Check that no horizontal page overflow exists on the page. */
async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow, "page has horizontal overflow").toBe(false);
}

/** Returns count of visible global nav header elements. */
async function countGlobalNavHeaders(page: Page) {
  return page.locator("header").count();
}

for (const vp of VIEWPORTS) {
  test.describe(`responsive – ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("dashboard – no overflow, single global nav", async ({ page }) => {
      await page.goto("/dashboard", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
      const navCount = await countGlobalNavHeaders(page);
      expect(navCount, "global nav appears more than once").toBe(1);
    });

    test("new trip page – no overflow", async ({ page }) => {
      await page.goto("/trips/new", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
    });

    test("discovery – no overflow, single global nav", async ({ page }) => {
      await page.goto("/discovery", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
      const navCount = await countGlobalNavHeaders(page);
      expect(navCount).toBe(1);
    });

    if (vp.width < 768) {
      test("mobile – desktop nav hidden, mobile hamburger visible", async ({ page }) => {
        await page.goto("/dashboard", { waitUntil: "networkidle" });
        // Desktop nav links hidden
        const desktopNav = page.locator("header nav.hidden");
        await expect(desktopNav.first()).toBeHidden();
        // Mobile hamburger visible
        const hamburger = page.locator("button[aria-label='Toggle menu']");
        await expect(hamburger).toBeVisible();
      });
    } else {
      test("desktop/tablet – desktop nav visible, hamburger hidden", async ({ page }) => {
        await page.goto("/dashboard", { waitUntil: "networkidle" });
        // Mobile hamburger hidden
        const hamburger = page.locator("button[aria-label='Toggle menu']");
        await expect(hamburger).toBeHidden();
      });
    }
  });
}
