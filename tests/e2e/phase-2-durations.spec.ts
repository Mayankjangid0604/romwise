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
      
      // PICNIC is a same-day trip
      const startDate = tomorrow.toISOString().split('T')[0];
      const endDate = startDate;

      await page.locator('#startDate').fill(startDate);
      await page.locator('#endDate').fill(endDate);
      await page.locator('#budget').fill('20000');
      await page.getByRole('button', { name: 'Generate My Trip' }).click();
      
      // Button is already clicked

      await expect(page).not.toHaveURL(/trips\/new/, { timeout: 30000 });
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+(\/itinerary)?$/, { timeout: 30000 });

      const trip = await prisma.trip.findFirst({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      expect(trip).not.toBeNull();
      expect(trip?.tripType).toBe('DAY_TRIP'); // Derived trip type for same day
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
      const after1Day = new Date(tomorrow);
      after1Day.setDate(after1Day.getDate() + 1);

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(after1Day.toISOString().split('T')[0]);
      await page.locator('#budget').fill('20000');
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

  // A 3-calendar-day range is a MULTI_DAY trip: it used to be stored as WEEKEND, whose fixed
  // 2-day duration made the planner drop the last day (see PROGRESS.md, item 9).
  test('a 3-day date range is planned as a 3-day MULTI_DAY trip', async ({ page }) => {
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
      const after2Days = new Date(tomorrow);
      after2Days.setDate(after2Days.getDate() + 2);

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(after2Days.toISOString().split('T')[0]);
      await page.locator('#budget').fill('20000');
      await page.getByRole('button', { name: 'Generate My Trip' }).click();
      
      // Button is already clicked

      await expect(page).not.toHaveURL(/trips\/new/, { timeout: 30000 });
      await expect(page).toHaveURL(/\/trips\/[a-zA-Z0-9_-]+(\/itinerary)?$/, { timeout: 30000 });

      const trip = await prisma.trip.findFirst({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      expect(trip).not.toBeNull();
      expect(trip?.tripType).toBe('MULTI_DAY');
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

      await page.locator('#startDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#endDate').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('#budget').fill('20000');
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
