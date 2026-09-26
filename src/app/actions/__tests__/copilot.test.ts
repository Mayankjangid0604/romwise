/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCopilotIntent } from "../copilot";
import * as authModule from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AIGateway } from "@/lib/ai/gateway";
import { NOT_TRANSIT_WHERE } from "@/lib/transit-filter";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/ai/gateway", () => ({
  AIGateway: {
    generateStructured: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    groupMember: {
      findFirst: vi.fn(),
    },
    trip: {
      findUnique: vi.fn(),
    },
    travelDestination: {
      findFirst: vi.fn(),
    },
    itineraryItem: {
      create: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db-rate-limit", () => ({
  checkRateLimitDb: vi.fn(async () => ({ allowed: true })),
}));

describe("Copilot Null-Cost Rule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
     
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
  });

  it("should preserve typicalCostInr=null as estimatedCostInr=null (not 0) when adding a place", async () => {
     
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ role: "creator" } as any);
    
     
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({
      id: "trip1", destination: "Goa", itineraryDays: [{ id: "day1", dayNumber: 1, items: [] }]
    } as any);

    // Mock AI returning ADD_PLACE
    vi.mocked(AIGateway.generateStructured).mockResolvedValue({
      data: {
        message: "Adding place",
        intent: { action: "ADD_PLACE", targetDayNumber: 1, newPlaceKeyword: "beach" }
      }
    } as any);

    // Mock Place with typicalCostInr = null
     
    vi.mocked(prisma.travelDestination.findFirst).mockResolvedValue({
      places: [
        { id: "place1", name: "Secret Beach", category: "beach", typicalCostInr: null, description: "nice" }
      ]
    } as any);

    await executeCopilotIntent("trip1", "add beach");

    // Assert that the created item has estimatedCostInr = null
    expect(prisma.itineraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estimatedCostInr: null,
          title: "Secret Beach",
        })
      })
    );
  });
});

describe("Copilot never adds transit points as activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ role: "creator" } as any);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({
      id: "trip1", destination: "Jaipur", itineraryDays: [{ id: "day1", dayNumber: 1, items: [] }]
    } as any);
  });

  it.each(["Jaipur Junction railway station", "Sindhi Camp bus stand", "Jaipur Airport"])(
    "declines ADD_PLACE for %s instead of creating an 'Explore …' activity",
    async (keyword) => {
      vi.mocked(AIGateway.generateStructured).mockResolvedValue({
        data: { message: "Added!", intent: { action: "ADD_PLACE", targetDayNumber: 1, newPlaceKeyword: keyword } },
      } as any);

      const res = await executeCopilotIntent("trip1", `add ${keyword} to day 1`);

      expect(res).toMatchObject({ success: true, action: "NO_ACTION" });
      expect(prisma.itineraryItem.create).not.toHaveBeenCalled();
    },
  );

  it("only looks up non-transit places for a keyword", async () => {
    vi.mocked(AIGateway.generateStructured).mockResolvedValue({
      data: { message: "Adding", intent: { action: "ADD_PLACE", targetDayNumber: 1, newPlaceKeyword: "heritage" } },
    } as any);
    vi.mocked(prisma.travelDestination.findFirst).mockResolvedValue({ places: [] } as any);

    await executeCopilotIntent("trip1", "add something heritage");

    const where = (vi.mocked(prisma.travelDestination.findFirst).mock.calls[0][0] as any).include.places.where;
    expect(where.AND).toContainEqual(NOT_TRANSIT_WHERE);
  });
});
