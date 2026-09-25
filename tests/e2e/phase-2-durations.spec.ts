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

      await page.goto('/trips/new?destination=Jaipur');
      await expect(page.getByRole('heading', { name: 'Trip Details' })).toBeVisible();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const after3Days = new Date();
      after3Days.setDate(after3Days.getDate() + 4);

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(after3Days.toISOString().split('T')[0]);
      await page.locator('#budget').fill('20000');
      await page.getByLabel('Trip Duration / Type').selectOption('PICNIC');
      await page.getByRole('button', { name: 'Generate My Trip' }).click();
      
      // Button is already clicked

      await expect(page).not.toHaveURL(/trips\/new/, { timeout: 30000 });
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+(\/itinerary)?$/, { timeout: 30000 });

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

      await page.goto('/trips/new?destination=Jaipur');
      await expect(page.getByRole('heading', { name: 'Trip Details' })).toBeVisible();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const after3Days = new Date();
      after3Days.setDate(after3Days.getDate() + 4);

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(after3Days.toISOString().split('T')[0]);
      await page.locator('#budget').fill('20000');
      await page.getByLabel('Trip Duration / Type').selectOption('OVERNIGHT');
      await page.getByRole('button', { name: 'Generate My Trip' }).click();
      
      // Button is already clicked

      await expect(page).not.toHaveURL(/trips\/new/, { timeout: 30000 });
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+(\/itinerary)?$/, { timeout: 30000 });

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

      await page.goto('/trips/new?destination=Jaipur');
      await expect(page.getByRole('heading', { name: 'Trip Details' })).toBeVisible();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const after3Days = new Date();
      after3Days.setDate(after3Days.getDate() + 4);

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(after3Days.toISOString().split('T')[0]);
      await page.locator('#budget').fill('20000');
      await page.getByLabel('Trip Duration / Type').selectOption('WEEKEND');
      await page.getByRole('button', { name: 'Generate My Trip' }).click();
      
      // Button is already clicked

      await expect(page).not.toHaveURL(/trips\/new/, { timeout: 30000 });
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+(\/itinerary)?$/, { timeout: 30000 });

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

      await page.goto('/trips/new?destination=Jaipur');
      await expect(page.getByRole('heading', { name: 'Trip Details' })).toBeVisible();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const after3Days = new Date();
      after3Days.setDate(after3Days.getDate() + 4);

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(after3Days.toISOString().split('T')[0]);
      await page.locator('#budget').fill('20000');
      await page.getByLabel('Trip Duration / Type').selectOption('DAY_TRIP');
      await page.getByRole('button', { name: 'Generate My Trip' }).click();
      
      // Button is already clicked

      await expect(page).not.toHaveURL(/trips\/new/, { timeout: 30000 });
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+(\/itinerary)?$/, { timeout: 30000 });

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
