import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db';

test.describe('Phase D - Templates & Overrides', () => {
  test.setTimeout(60000);

  test('User can manually configure pace and budget', async ({ page }) => {
    // 1. Create a unique test user
    const testEmail = `e2e_tpl_${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email: testEmail, name: 'E2E Template User' }
    });

    try {
      // 2. Login programmatically
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();

      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: { email: testEmail, secret: 'E2E_TEST_SECRET', csrfToken },
      });
      expect(loginRes.ok()).toBeTruthy();

      // 3. Navigate to new trip page
      await page.goto('/trips/new?destination=Jaipur');
      await expect(page.getByRole('heading', { name: 'Trip Details' })).toBeVisible();

      // Configure budget, travelers, pace, and dates
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const after3Days = new Date();
      after3Days.setDate(after3Days.getDate() + 4);

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(after3Days.toISOString().split('T')[0]);
      await page.locator('#budget').fill('100000');
      await page.locator('#maxTravelers').fill('4');
      await page.getByLabel('Pace Level').selectOption('full');

      // Now click "Generate My Trip"
      const createButton = page.getByRole('button', { name: /Generate My Trip/i });
      await expect(createButton).toBeVisible();
      await createButton.click();
      
      // Wait for redirect to /trips/[id]
      await page.waitForURL(url => url.pathname.startsWith('/trips/') && !url.pathname.endsWith('/new'), { timeout: 30000 });
      const urlParts = page.url().split('/');
      const tripId = urlParts[urlParts.length - 1] === 'itinerary' ? urlParts[urlParts.length - 2] : urlParts[urlParts.length - 1];
      
      // Verify in the database that the explicit override was respected
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
      });
      
      expect(trip).toBeDefined();
      expect(trip?.budgetInr).toBe(100000);
      expect(trip?.paceLevel).toBe('full');
      expect(trip?.maxTravelers).toBe(4);
      
    } finally {
      // Cleanup
      await prisma.user.delete({ where: { email: testEmail } });
    }
  });
});
