import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateItineraryItem, deleteItineraryItem, addItineraryItem } from "../itinerary";
import * as authModule from "@/lib/auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    groupMember: {
      findFirst: vi.fn(),
    },
    itineraryItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    itineraryDay: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Itinerary Actions Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
  });

  const validEditInput = {
    title: "Test",
    description: "Test desc",
    startTime: "10:00",
    endTime: "11:00",
    estimatedCostInr: null,
  };

  describe("updateItineraryItem", () => {
    it("should reject outsider (not a member)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.itineraryItem.findUnique).mockResolvedValueOnce({ itineraryDay: { tripId: "trip1" } } as any);
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);

      const res = await updateItineraryItem("trip1", "item1", validEditInput);
      expect(res).toEqual({ success: false, error: "Not a member of this trip" });
      expect(prisma.itineraryItem.update).not.toHaveBeenCalled();
    });

    it("should reject viewer", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.itineraryItem.findUnique).mockResolvedValueOnce({ itineraryDay: { tripId: "trip1" } } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "viewer" } as any);

      const res = await updateItineraryItem("trip1", "item1", validEditInput);
      expect(res).toEqual({ success: false, error: "Viewers cannot edit itinerary" });
      expect(prisma.itineraryItem.update).not.toHaveBeenCalled();
    });

    it("should reject cross-trip item update (IDOR)", async () => {
      // Item belongs to trip2, but user is trying to update it via trip1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.itineraryItem.findUnique).mockResolvedValueOnce({ itineraryDay: { tripId: "trip2" } } as any);
      
      const res = await updateItineraryItem("trip1", "item1", validEditInput);
      expect(res).toEqual({ success: false, error: "Item not found" });
      expect(prisma.itineraryItem.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteItineraryItem", () => {
    it("should reject outsider", async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);

      const res = await deleteItineraryItem("trip1", "item1");
      expect(res).toEqual({ success: false, error: "Not a member" });
      expect(prisma.itineraryItem.delete).not.toHaveBeenCalled();
    });

    it("should reject viewer", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "viewer" } as any);

      const res = await deleteItineraryItem("trip1", "item1");
      expect(res).toEqual({ success: false, error: "Viewers cannot edit itinerary" });
      expect(prisma.itineraryItem.delete).not.toHaveBeenCalled();
    });

    it("should reject cross-trip item deletion (IDOR)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "creator" } as any);
      // Item belongs to trip2, but user is trying to delete it via trip1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.itineraryItem.findUnique).mockResolvedValueOnce({ itineraryDay: { tripId: "trip2" } } as any);

      const res = await deleteItineraryItem("trip1", "item1");
      expect(res).toEqual({ success: false, error: "Item not found in this trip" });
      expect(prisma.itineraryItem.delete).not.toHaveBeenCalled();
    });
  });

  describe("addItineraryItem", () => {
    it("should reject adding an item to a day belonging to another trip", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "member" } as any);
      // Day belongs to trip2, but user is trying to add to it via trip1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValueOnce({ tripId: "trip2" } as any);

      const res = await addItineraryItem("trip1", "day1");
      expect(res).toEqual({ success: false, error: "Day not found in this trip" });
      expect(prisma.itineraryItem.create).not.toHaveBeenCalled();
    });
  });
});
