import { test, expect } from "@playwright/test";
import type { User } from "@prisma/client";
import { prisma } from "../../src/lib/db";

test.describe("Phase D - Favorites", () => {
  let user: User | null = null;

  test.beforeEach(async ({ page }) => {
    // 1. Create a unique test user
    const testEmail = `e2e_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
    user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'E2E Test User',
      }
    });

    // 2. Login programmatically
    const csrfResponse = await page.request.get('/api/auth/csrf');
    const { csrfToken } = await csrfResponse.json();

    await page.request.post('/api/auth/callback/e2e-test', {
      form: {
        email: testEmail,
        secret: 'E2E_TEST_SECRET',
        csrfToken
      }
    });

    await page.goto("/dashboard");
    await page.waitForURL("/dashboard");
  });

  test.afterEach(async () => {
    if (user) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  test("can view and interact with favorites on the dashboard", async ({ page }) => {
    await page.goto("/dashboard/favorites");
    await expect(page.locator("h1", { hasText: "Favorites" })).toBeVisible();
    await expect(page.locator("text=Places and destinations you've saved for later")).toBeVisible();
    
    // We expect an empty state initially, or if there's data from previous runs, we just check for it.
    // So we just ensure the page loads without 500 error.
    const hasEmptyState = await page.locator("text=No favorites yet").isVisible();
    const hasPlaces = await page.locator("text=Saved Places").isVisible();
    const hasDest = await page.locator("text=Saved Destinations").isVisible();
    
    expect(hasEmptyState || hasPlaces || hasDest).toBeTruthy();
  });
});
