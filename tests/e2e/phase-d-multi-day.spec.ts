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

      // 3. Navigate to new trip page
      await page.goto('/trips/new');
      
      // Wait for chat interface to be ready
      const chatInput = page.getByPlaceholder(/E.g., I want to go/i);
      await expect(chatInput).toBeVisible();

      // 4. Send a message to start planning
      await chatInput.fill('I want to go to Tokyo for 3 days. I use a wheelchair and I love food and culture');
      await chatInput.pressSequentially('.');
      await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
      const responsePromise = page.waitForResponse(r => r.url().includes('/api/chat/planner') && r.status() === 200);
      await chatInput.press('Enter');
      await responsePromise;

      // 5. Wait for AI response
      await expect(page.locator('.animate-bounce').first()).toBeHidden({ timeout: 20000 });

      const assistantMessages = page.locator('.bg-white.border-ink-100');
      await expect(assistantMessages).toHaveCount(2);
      
      const aiResponse = await assistantMessages.nth(1).textContent();
      expect(aiResponse?.length).toBeGreaterThan(0);

      // 6. Click 'Create Trip'
      const createButton = page.getByRole('button', { name: 'Create Trip' });
      await expect(createButton).toBeVisible();
      await createButton.click();

      // 7. Wait for navigation to the trip dashboard (not /trips/new)
      await expect(page).not.toHaveURL(/\/trips\/new$/, { timeout: 30000 });
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+/, { timeout: 30000 });
      
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
      expect(trip?.title).toContain('Tokyo');
      expect(trip?.maxTravelers).toBe(2); 
      expect(trip?.groupMembers[0]?.accessibilityNotes).toContain('wheelchair');
      expect(trip?.groupMembers[0]?.travelerPreferences.length).toBeGreaterThan(0);
      
      const prefCategories = trip?.groupMembers[0]?.travelerPreferences.map((p: { category: string }) => p.category);
      expect(prefCategories).toContain('dining');
      expect(prefCategories).toContain('culture');

      
    } finally {
      // Cleanup
      await prisma.user.delete({ where: { id: user.id } });
    }

  });
});
