import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db';

test.describe('E2E Trip Planning Flow', () => {
  test.setTimeout(60000);

  test('Complete flow: Auth -> Create Trip', async ({ page }) => {
    // 1. Create a unique test user
    const testEmail = `e2e_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'E2E Test User',
      }
    });

    try {
      // 2. Login programmatically
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();

      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: {
          email: testEmail,
          secret: 'E2E_TEST_SECRET',
          csrfToken,
        },
      });
      expect(loginRes.ok()).toBeTruthy();

      // Verify session is active by navigating to a protected route
      await page.goto('/dashboard');
      await expect(page.locator('text=Welcome back')).toBeVisible();

      // 3. Navigate to new trip page with destination
      await page.goto('/trips/new?destination=Jaipur');
      await expect(page.getByRole('heading', { name: 'Trip Details' })).toBeVisible();

      // 4. Fill form
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const after3Days = new Date();
      after3Days.setDate(after3Days.getDate() + 4);

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(after3Days.toISOString().split('T')[0]);
      await page.locator('#budget').fill('20000');
      await page.locator('#accessibilityNotes').fill('I use a wheelchair and I love food and culture');

      // 6. Click 'Generate My Trip'
      const createButton = page.getByRole('button', { name: 'Generate My Trip' });
      await expect(createButton).toBeVisible();
      await createButton.click();

      // 7. Wait for navigation to the trip dashboard (not /trips/new)
      await expect(page).not.toHaveURL(/trips\/new/, { timeout: 30000 });
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+(\/itinerary)?$/, { timeout: 30000 });
      
      // 8. Assert DB State
      // Fetch the trip from the DB
      const trip = await prisma.trip.findFirst({
        where: { creatorId: user.id },
        include: {
          groupMembers: { include: { travelerPreferences: true } },
          
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(trip).not.toBeNull();
      expect(trip?.title).toContain('Jaipur');
      expect(trip?.maxTravelers).toBe(2); 
      expect(trip?.groupMembers[0]?.accessibilityNotes).toContain('wheelchair');

      
    } finally {
      // Cleanup
      await prisma.user.delete({ where: { id: user.id } });
    }

  });
});
