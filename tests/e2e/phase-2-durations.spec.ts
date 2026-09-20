import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db';

test.describe('Phase 2 - Durations & Flexible Trips', () => {
  test.setTimeout(60000);

  test('can create a PICNIC trip', async ({ page }) => {
    const testEmail = `e2e_${Date.now()}_picnic@example.com`;
    const user = await prisma.user.create({
      data: { email: testEmail, name: 'E2E Picnic User' }
    });

    try {
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();
      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: { email: testEmail, secret: 'E2E_TEST_SECRET', csrfToken },
      });
      expect(loginRes.ok()).toBeTruthy();

      await page.goto('/trips/new');
      const chatInput = page.getByPlaceholder(/E.g., I want to go/i);
      await expect(chatInput).toBeVisible();

      await chatInput.fill('I want to go to Jaipur for a picnic today. Just me. We like nature.');
      await chatInput.press('Enter');

      await expect(page.locator('.animate-bounce').first()).toBeHidden({ timeout: 20000 });
      
      const createButton = page.getByRole('button', { name: 'Create Trip' });
      await expect(createButton).toBeVisible();
      await createButton.click();

      await expect(page).not.toHaveURL(/\/trips\/new$/);
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+/, { timeout: 30000 });

      const trip = await prisma.trip.findFirst({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      expect(trip).not.toBeNull();
      expect(trip?.tripType).toBe('PICNIC');
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test('can create an OVERNIGHT trip', async ({ page }) => {
    const testEmail = `e2e_${Date.now()}_overnight@example.com`;
    const user = await prisma.user.create({
      data: { email: testEmail, name: 'E2E Overnight User' }
    });

    try {
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();
      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: { email: testEmail, secret: 'E2E_TEST_SECRET', csrfToken },
      });
      expect(loginRes.ok()).toBeTruthy();

      await page.goto('/trips/new');
      const chatInput = page.getByPlaceholder(/E.g., I want to go/i);
      await expect(chatInput).toBeVisible();

      await chatInput.fill('I want to go to Jaipur for an overnight trip starting tomorrow. Just me. We like history.');
      await chatInput.press('Enter');

      await expect(page.locator('.animate-bounce').first()).toBeHidden({ timeout: 20000 });
      
      const createButton = page.getByRole('button', { name: 'Create Trip' });
      await expect(createButton).toBeVisible();
      await createButton.click();

      await expect(page).not.toHaveURL(/\/trips\/new$/);
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+/, { timeout: 30000 });

      const trip = await prisma.trip.findFirst({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      expect(trip).not.toBeNull();
      expect(trip?.tripType).toBe('OVERNIGHT');
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test('can create a WEEKEND trip', async ({ page }) => {
    const testEmail = `e2e_${Date.now()}_weekend@example.com`;
    const user = await prisma.user.create({
      data: { email: testEmail, name: 'E2E Weekend User' }
    });

    try {
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();
      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: { email: testEmail, secret: 'E2E_TEST_SECRET', csrfToken },
      });
      expect(loginRes.ok()).toBeTruthy();

      await page.goto('/trips/new');
      const chatInput = page.getByPlaceholder(/E.g., I want to go/i);
      await expect(chatInput).toBeVisible();

      await chatInput.fill('I want to go to Jaipur for the weekend this Friday to Sunday. Just me. We like food.');
      await chatInput.press('Enter');

      await expect(page.locator('.animate-bounce').first()).toBeHidden({ timeout: 20000 });
      
      const createButton = page.getByRole('button', { name: 'Create Trip' });
      await expect(createButton).toBeVisible();
      await createButton.click();

      await expect(page).not.toHaveURL(/\/trips\/new$/);
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+/, { timeout: 30000 });

      const trip = await prisma.trip.findFirst({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      expect(trip).not.toBeNull();
      expect(trip?.tripType).toBe('WEEKEND');
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test('can create a DAY_TRIP trip', async ({ page }) => {
    const testEmail = `e2e_${Date.now()}_daytrip@example.com`;
    const user = await prisma.user.create({
      data: { email: testEmail, name: 'E2E DayTrip User' }
    });

    try {
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();
      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: { email: testEmail, secret: 'E2E_TEST_SECRET', csrfToken },
      });
      expect(loginRes.ok()).toBeTruthy();

      await page.goto('/trips/new');
      const chatInput = page.getByPlaceholder(/E.g., I want to go/i);
      await expect(chatInput).toBeVisible();

      await chatInput.fill('I want to go to Jaipur for a day trip starting at 9 AM and ending at 9 PM. Just me. We like history.');
      await chatInput.press('Enter');

      await expect(page.locator('.animate-bounce').first()).toBeHidden({ timeout: 20000 });
      
      const createButton = page.getByRole('button', { name: 'Create Trip' });
      await expect(createButton).toBeVisible();
      await createButton.click();

      await expect(page).not.toHaveURL(/\/trips\/new$/);
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+/, { timeout: 30000 });

      const trip = await prisma.trip.findFirst({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      expect(trip).not.toBeNull();
      expect(trip?.tripType).toBe('DAY_TRIP');
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
