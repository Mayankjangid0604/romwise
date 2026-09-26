import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTripItinerary } from "../itinerary";
import { optimizeTripBudget } from "../budget";
import * as authModule from "@/lib/auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    trip: { findUnique: vi.fn(), update: vi.fn() },
    itineraryItem: { deleteMany: vi.fn(), delete: vi.fn() },
    itineraryDay: { deleteMany: vi.fn() },
    user: { update: vi.fn() },
  },
}));
vi.mock("@/lib/entitlements", () => ({ checkGenerationEntitlement: vi.fn(async () => ({ canGenerate: true })) }));

/* eslint-disable @typescript-eslint/no-explicit-any */
const tripWith = (role: string) =>
  ({
    id: "t1",
    status: "planning",
    budgetInr: 1000,
    groupMembers: [
      { userId: "creator", role: "creator", travelerPreferences: [], preferences: "[]" },
      { userId: "u1", role, travelerPreferences: [], preferences: "[]" },
    ],
    tripPlaceSelections: [],
    itineraryDays: [],
  }) as any;

describe("viewers cannot change a trip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "u1" } } as any);
  });

  it("a viewer cannot regenerate (wipe) the itinerary", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(tripWith("viewer"));
    const res = await generateTripItinerary("t1");
    expect(res).toMatchObject({ success: false, errorType: "auth" });
    expect(prisma.trip.update).not.toHaveBeenCalled();
  });

  it("a member can still start generation", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(tripWith("member"));
    const res = await generateTripItinerary("t1");
    expect(res.success).toBe(true);
    expect(prisma.trip.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: "generating" } });
  });

  it("a viewer cannot run the budget optimizer (it deletes items)", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(tripWith("viewer"));
    await expect(optimizeTripBudget("t1")).rejects.toThrow(/Viewers cannot modify/);
    expect(prisma.itineraryItem.delete).not.toHaveBeenCalled();
    expect(prisma.itineraryItem.deleteMany).not.toHaveBeenCalled();
  });
});
