import { test, expect, type Page } from "@playwright/test";
import type { User } from "@prisma/client";
import { prisma } from "../../src/lib/db";

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

/** Returns the number of visible global app nav headers (the one with the Roamwise brand). */
async function countAppNavHeaders(page: Page) {
  return page.locator("header").filter({ hasText: "Roamwise" }).count();
}

/** Asserts no horizontal page overflow (intentional horizontal scroll containers are excluded). */
async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow, "page has horizontal overflow").toBe(false);
}

for (const vp of VIEWPORTS) {
  test.describe(`responsive – ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    let user: User | null = null;

    test.beforeEach(async ({ page }) => {
      const testEmail = `e2e_responsive_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
      user = await prisma.user.create({
        data: { email: testEmail, name: "E2E Responsive User" },
      });

      const csrfResponse = await page.request.get("/api/auth/csrf");
      const { csrfToken } = await csrfResponse.json();

      await page.request.post("/api/auth/callback/e2e-test", {
        form: { email: testEmail, secret: "E2E_TEST_SECRET", csrfToken },
      });

      await page.goto("/dashboard");
      await page.waitForURL("/dashboard");
    });

    test.afterEach(async () => {
      if (user) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
        user = null;
      }
    });

    test("dashboard – no overflow, single global nav", async ({ page }) => {
      await page.goto("/dashboard", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
      const navCount = await countAppNavHeaders(page);
      expect(navCount, "global app nav should appear exactly once").toBe(1);
    });

    test("new trip page – no overflow", async ({ page }) => {
      await page.goto("/trips/new", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
    });

    test("discovery – no overflow, single global nav", async ({ page }) => {
      await page.goto("/discovery", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
      const navCount = await countAppNavHeaders(page);
      expect(navCount, "global app nav should appear exactly once").toBe(1);
    });

    if (vp.width < 768) {
      test("mobile – hamburger visible, desktop nav links hidden", async ({ page }) => {
        await page.goto("/dashboard", { waitUntil: "networkidle" });
        const hamburger = page.locator("button[aria-label='Toggle menu']");
        await expect(hamburger).toBeVisible();
        // Desktop nav links are md:flex (hidden below md)
        const desktopNav = page.locator("header nav.hidden");
        await expect(desktopNav.first()).toBeHidden();
      });
    } else {
      test("desktop/tablet – hamburger hidden", async ({ page }) => {
        await page.goto("/dashboard", { waitUntil: "networkidle" });
        const hamburger = page.locator("button[aria-label='Toggle menu']");
        await expect(hamburger).toBeHidden();
      });
    }
  });
}
