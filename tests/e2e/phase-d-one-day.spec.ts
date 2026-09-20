import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db';

test.describe('Trip Constraints', () => {
  test('Planner API should enforce rate limiting deterministically', async ({ request }) => {
    // 1. Create a unique test user
    const testEmail = `ratelimit_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Rate Limit Test User',
      }
    });

    try {
      // 2. Login using E2E credentials provider
      const csrfResponse = await request.get('/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();

      const loginRes = await request.post('/api/auth/callback/e2e-test', {
        form: {
          email: testEmail,
          secret: 'E2E_TEST_SECRET',
          csrfToken,
        }
      });
      
      expect(loginRes.ok()).toBeTruthy();

      // 3. Execute N requests to consume the quota (MAX_ATTEMPTS = 5)
      // We send an invalid body (no messages array) so we get a 400 Bad Request
      // instead of hitting the upstream Gemini API and consuming real quota.
      // The rate limit check happens before validation, so this correctly consumes the rate limit.
      for (let i = 0; i < 5; i++) {
        const res = await request.post('/api/chat/planner', {
          data: {}
        });
        expect(res.status()).toBe(400); // Bad Request (invalid messages format)
      }

      // 4. Execute N+1 request and expect 429
      const rateLimitedRes = await request.post('/api/chat/planner', {
        data: {}
      });
      
      expect(rateLimitedRes.status()).toBe(429);
      
      const responseData = await rateLimitedRes.json();
      expect(responseData.error).toMatch(/Too many requests/);
    } finally {
      // 5. Cleanup
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
