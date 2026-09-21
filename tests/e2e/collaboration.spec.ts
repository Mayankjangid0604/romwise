import { test, expect, Page, BrowserContext } from '@playwright/test';
import { prisma } from '../../src/lib/db';
import crypto from 'crypto';

test.describe('Collaborative Trip Planning', () => {
  let tripId: string;
  let shareToken: string;
  let suffix: string;
  let u1Email: string;
  let u2Email: string;
  let u3Email: string;

  async function loginAs(page: Page, context: BrowserContext, email: string) {
    const csrfResponse = await page.request.get('/api/auth/csrf');
    const { csrfToken } = await csrfResponse.json();

    const loginRes = await page.request.post('/api/auth/callback/e2e-test', {
      form: { email, secret: 'E2E_TEST_SECRET', csrfToken },
    });
    expect(loginRes.ok()).toBeTruthy();

    const headers = loginRes.headers();
    if (headers['set-cookie']) {
      const cookies = headers['set-cookie'].split(', ').map((c: string) => {
        const parts = c.split(';')[0].split('=');
        return { name: parts[0], value: parts[1], domain: 'localhost', path: '/' };
      });
      await context.addCookies(cookies);
    }
  }

  test.beforeAll(async () => {
    suffix = crypto.randomBytes(4).toString('hex');
    u1Email = `user1_${suffix}@example.com`;
    u2Email = `user2_${suffix}@example.com`;
    u3Email = `user3_${suffix}@example.com`;

    const user1 = await prisma.user.create({
      data: { id: `user-1-${suffix}`, email: u1Email, name: 'User 1' }
    });
    
    const user2 = await prisma.user.create({
      data: { id: `user-2-${suffix}`, email: u2Email, name: 'User 2' }
    });
    
    const user3 = await prisma.user.create({
      data: { id: `user-3-${suffix}`, email: u3Email, name: 'User 3' }
    });

    // Setup initial data for User 1 (creator)
    const trip = await prisma.trip.create({
      data: {
        id: `collab-trip-${suffix}`,
        title: 'Collab Trip',
        destination: 'Goa',
        startDate: new Date('2024-11-01'),
        endDate: new Date('2024-11-05'),
        creatorId: user1.id,
        status: 'planning',
        groupMembers: {
          create: {
            userId: user1.id,
            role: 'creator'
          }
        },
        itineraryDays: {
          create: {
            dayNumber: 1,
            date: new Date('2024-11-01'),
            items: {
              create: {
                title: 'Beach Visit',
                category: 'activity',
                order: 0,
                description: 'Visit the beach',
                startTime: '10:00',
                endTime: '12:00',
                reasoning: ''
              }
            }
          }
        },
        budgetInr: 0
      }
    });
    tripId = trip.id;
  });

  test('Creator shares link, Member joins and interacts, link gets revoked', async ({ browser }) => {
    // 1. Creator generates share link
    const contextCreator = await browser.newContext();
    const pageCreator = await contextCreator.newPage();
    
    // Login as creator
    await loginAs(pageCreator, contextCreator, u1Email);
    await pageCreator.goto('/dashboard');
    await expect(pageCreator.locator('h1')).toContainText('Welcome back');

    await pageCreator.goto(`/trips/${tripId}/group`);
    
    // Create Share Link
    await pageCreator.locator('div').filter({ hasText: 'Member Link' }).locator('button', { hasText: 'Copy Link' }).first().click();
    
    // Wait for the token to be generated in the DB
    await expect.poll(async () => {
      const share = await prisma.tripShare.findFirst({ where: { tripId, role: 'member' } });
      if (share) shareToken = share.token;
      return !!share;
    }, {
      timeout: 10000,
    }).toBeTruthy();
    
    const shareUrl = `/trips/join/${shareToken}`;

    // 2. User 2 joins using token
    const contextUser2 = await browser.newContext();
    const pageUser2 = await contextUser2.newPage();
    pageUser2.on('console', msg => console.log('User 2 console:', msg.text()));
    
    // Login as user 2
    await loginAs(pageUser2, contextUser2, u2Email);
    await pageUser2.goto('/dashboard');
    await expect(pageUser2.locator('h1')).toContainText('Welcome back');

    // Visit join URL
    await pageUser2.goto(shareUrl);

    // Should redirect to trip page
    await expect(pageUser2).toHaveURL(new RegExp(`/trips/${tripId}`));
    await pageUser2.waitForLoadState('domcontentloaded');
    
    // 3. User 2 votes and comments
    await pageUser2.goto(`/trips/${tripId}/itinerary`, { waitUntil: 'domcontentloaded' });
    await expect(pageUser2.locator('text="Beach Visit"').first()).toBeVisible();

    // Expand the collaboration widget if needed or just interact
    const count = await pageUser2.getByTestId('upvote-btn').count();
    if (count === 0) {
      console.log('NO UPVOTE BTN FOUND, PAGE CONTENT:', await pageUser2.content());
    }
    const thumbsUp = pageUser2.getByTestId('upvote-btn').first();
    await thumbsUp.click({ timeout: 5000 });
    await expect(thumbsUp).toContainText('1');

    // Comment
    const commentToggle = pageUser2.getByTestId('comment-btn').first();
    await commentToggle.click();
    
    const commentInput = pageUser2.locator('input[placeholder="Add a comment..."]');
    await commentInput.fill('I love this idea!');
    await pageUser2.locator('button:has-text("Send")').click();
    
    await expect(pageUser2.locator('text="I love this idea!"')).toBeVisible();

    // 4. Creator revokes link
    await pageCreator.goto(`/trips/${tripId}/group`);
    pageCreator.once('dialog', dialog => dialog.accept());
    const revokeBtn = pageCreator.locator('button:has-text("Revoke")').first();
    await revokeBtn.click();
    // Wait for it to disappear
    await expect(revokeBtn).not.toBeVisible();

    // 5. User 3 tries to join with revoked link
    const contextUser3 = await browser.newContext();
    const pageUser3 = await contextUser3.newPage();
    
    // Login as user 3
    await loginAs(pageUser3, contextUser3, u3Email);

    await pageUser3.goto(shareUrl);
    
    // Should see error or be redirected to dashboard since link is invalid
    await expect(pageUser3.locator('text="Invalid or expired invite link."')).toBeVisible();
    
    await contextCreator.close();
    await contextUser2.close();
    await contextUser3.close();
  });
});
