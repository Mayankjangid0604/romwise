import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db';

test.describe('Phase D - Logistics & Accommodations', () => {
  test.setTimeout(60000);

  test('User can add travel segments and accommodations', async ({ page }) => {
    const testEmail = `e2e_logistics_${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email: testEmail, name: 'E2E Logistics User' }
    });

    // Create a trip for this user directly in DB
    const trip = await prisma.trip.create({
      data: {
        title: 'Test Logistics Trip',
        destination: 'Goa',
        budgetInr: 50000,
        paceLevel: 'balanced',
        maxTravelers: 2,
        creatorId: user.id,
        groupMembers: {
          create: {
            userId: user.id,
            role: 'creator',
          }
        }
      }
    });

    try {
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();

      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: { email: testEmail, secret: 'E2E_TEST_SECRET', csrfToken },
      });
      expect(loginRes.ok()).toBeTruthy();

      await page.goto(`/trips/${trip.id}`);
      
      // Add a Travel Segment
      await page.click('button:has-text("Add Flight")');
      await page.fill('input[name="originName"]', 'DEL');
      await page.fill('input[name="destinationName"]', 'GOI');
      await page.click('button:has-text("Save Transit")');

      // Assert it appears on screen
      await expect(page.locator('text=DEL')).toBeVisible();
      await expect(page.locator('text=GOI')).toBeVisible();

      // Add Accommodation
      await page.click('button:has-text("Add Stay")');
      await page.fill('input[name="name"]', 'Taj Exotica');
      await page.fill('input[name="location"]', 'South Goa');
      await page.click('button:has-text("Save Stay")');

      // Assert it appears on screen
      await expect(page.locator('text=Taj Exotica')).toBeVisible();
      
    } finally {
      await prisma.user.delete({ where: { email: testEmail } });
    }
  });
});
