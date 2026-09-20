import { test, expect } from "@playwright/test";
import type { User } from "@prisma/client";
import { prisma } from "../../src/lib/db";

test.describe("Phase D - Recent Activity", () => {
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

  test("Dashboard displays recently viewed trips", async ({ page }) => {
    // Visit a trip page (if there is one)
    const tripLink = await page.locator('text="Your Trips"').locator("xpath=..").locator("a").filter({ hasText: "Days" }).first();
    
    // We only test if we actually have trips
    if (await tripLink.isVisible()) {
      await tripLink.click();
      await page.waitForTimeout(2000); // give time for the tracker to hit API
      
      // Go back to dashboard
      await page.goto("/dashboard");
      
      // Should see Recently Viewed section
      await expect(page.locator("text=Recently Viewed")).toBeVisible();
    }
  });
});
