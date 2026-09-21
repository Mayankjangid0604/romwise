import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db';

test.describe('Phase D - Templates & Overrides', () => {
  test.setTimeout(60000);

  test('Templates inject text and user can override', async ({ page }) => {
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
      await page.goto('/trips/new');
      
      // Wait for chat interface to be ready
      const chatInput = page.getByPlaceholder(/E.g., I want to go/i);
      await expect(chatInput).toBeVisible();

      // Click the "Family Vacation" template
      await page.click('text=Family Vacation');
      
      // Check that the input has the template text
      await expect(chatInput).toHaveValue(/Plan a 5-day family trip to Jaipur for 4 people \(2 adults, 2 kids\)/i);

      // User decides to override pace and budget manually in the input
      await chatInput.fill('Plan a 5-day family trip to Jaipur for 4 people (2 adults, 2 kids), FULL PACE, budget 100000');
      await chatInput.pressSequentially('.');
      await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
      const responsePromise = page.waitForResponse(r => r.url().includes('/api/chat/planner') && r.status() === 200);
      await chatInput.press('Enter');
      await responsePromise;

      // Wait for AI to process and state to update
      await expect(page.locator('.animate-bounce').first()).toBeHidden({ timeout: 20000 });
      
      // Now click "Create Trip"
      const createButton = page.getByRole('button', { name: /Create Trip/i });
      await expect(createButton).toBeVisible();
      await createButton.click();
      
      // Wait for redirect to /trips/[id]
      await page.waitForURL(url => url.pathname.startsWith('/trips/') && !url.pathname.endsWith('/new'), { timeout: 30000 });
      const tripId = page.url().split('/').pop();
      
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
