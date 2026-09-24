import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../../src/lib/db";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 1366 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 }
];

async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow, "page has horizontal overflow").toBe(false);
}

test.describe("Pre-Merge Acceptance: Responsive & Duplicate Nav", () => {
  let user: import("@prisma/client").User;
  let trip: import("@prisma/client").Trip;

  test.beforeAll(async () => {
    const testEmail = `e2e_accept_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@example.com`;
    user = await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: { email: testEmail, name: "Acceptance User" },
    });
    trip = await prisma.trip.create({
      data: {
        title: "Acceptance Trip",
        destination: "Paris",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000 * 3),
        budgetInr: 1000,
        creatorId: user.id,
        groupMembers: {
          create: {
            userId: user.id,
            role: "creator"
          }
        }
      }
    });
  });

  test.afterAll(async () => {
    if (trip) await prisma.trip.delete({ where: { id: trip.id } }).catch(() => {});
    if (user) await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  const getPages = (tripId: string) => [
    "/dashboard",
    "/discovery",
    "/trips/new",
    `/trips/${tripId}`,
    `/trips/${tripId}/itinerary`,
    `/trips/${tripId}/route`,
    `/trips/${tripId}/budget`,
    `/trips/${tripId}/group`,
    `/trips/${tripId}/info`,
    `/trips/${tripId}/live`
  ];

  for (const vp of VIEWPORTS) {
    test.describe(`Viewport ${vp.width}x${vp.height}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test.beforeEach(async ({ page }) => {
        const csrfResponse = await page.request.get("/api/auth/csrf");
        const { csrfToken } = await csrfResponse.json();
        await page.request.post("/api/auth/callback/e2e-test", {
          form: { email: user.email!, secret: "E2E_TEST_SECRET", csrfToken },
        });
      });

      test("Check all pages for overflow", async ({ page }) => {
        const pages = getPages(trip.id);
        for (const path of pages) {
          await page.goto(path, { waitUntil: "networkidle" });
          await assertNoHorizontalOverflow(page);
        }
      });
    });
  }
});
