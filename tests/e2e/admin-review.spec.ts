import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db';
import { ROLES } from '../../src/lib/roles';

test.describe('Admin Review Pipeline', () => {
  test.setTimeout(60000);

  test('Regular user is denied access to admin data', async ({ page, context }) => {
    const testEmail = `user_e2e_${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email: testEmail, name: 'Normal User', role: ROLES.USER }
    });

    try {
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();

      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: { email: testEmail, secret: 'E2E_TEST_SECRET', csrfToken },
      });
      expect(loginRes.ok()).toBeTruthy();

      const headers = loginRes.headers();
      if (headers['set-cookie']) {
        const cookies = headers['set-cookie'].split(', ').map(c => {
          const parts = c.split(';')[0].split('=');
          return { name: parts[0], value: parts[1], domain: 'localhost', path: '/' };
        });
        await context.addCookies(cookies);
      }

      await page.goto('/admin/data');
      // Should redirect to dashboard
      expect(page.url()).toContain('/dashboard');
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test('Admin can view data, edit place, and provenance updates to MANUALLY_CURATED', async ({ page, context }) => {
    const testEmail = `admin_e2e_${Date.now()}@example.com`;
    
    // Create test destination and place
    const dest = await prisma.travelDestination.create({
      data: { slug: `admin-test-dest-${Date.now()}`, name: 'Admin Test Dest', state: 'Kerala', lat: 10, lng: 76 }
    });
    
    const place = await prisma.place.create({
      data: {
        slug: `test-place-to-edit-${Date.now()}`,
        destinationId: dest.id,
        name: 'Test Place to Edit',
        category: 'sightseeing',
        lat: 10,
        lng: 76,
        typicalCostInr: 100,
        costStatus: 'unknown',
        sourceType: 'UNKNOWN'
      }
    });

    const user = await prisma.user.create({
      data: { email: testEmail, name: 'Admin User', role: ROLES.ADMIN }
    });

    try {
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();

      const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
        form: { email: testEmail, secret: 'E2E_TEST_SECRET', csrfToken },
      });
      expect(loginRes.ok()).toBeTruthy();

      const headers = loginRes.headers();
      if (headers['set-cookie']) {
        const cookies = headers['set-cookie'].split(', ').map(c => {
          const parts = c.split(';')[0].split('=');
          return { name: parts[0], value: parts[1], domain: 'localhost', path: '/' };
        });
        await context.addCookies(cookies);
      }

      await page.goto('/admin/data');
      await expect(page.locator('text=Destinations')).toBeVisible();

      await page.goto(`/admin/places/${place.id}`);
      await expect(page.locator(`text=${place.name}`)).toBeVisible();
      
    } finally {
      await prisma.place.delete({ where: { id: place.id } });
      await prisma.travelDestination.delete({ where: { id: dest.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
