import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    travelDestination: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    destinationAlias: {
      findFirst: vi.fn(),
    },
  },
}));

import { resolveDestination, searchTravelDestinations } from "../destination-resolver";
import { prisma } from "@/lib/db";

const mockDestination = vi.mocked(prisma.travelDestination);
const mockAlias = vi.mocked(prisma.destinationAlias);

const JAIPUR = {
  id: "dest-jaipur",
  name: "Jaipur",
  slug: "jaipur",
  state: "Rajasthan",
  country: "India",
  lat: 26.9124,
  lng: 75.7873,
  description: "The Pink City",
  districtId: null,
  dataStatus: "seed",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const RISHIKESH = {
  id: "dest-rishikesh",
  name: "Rishikesh",
  slug: "rishikesh",
  state: "Uttarakhand",
  country: "India",
  lat: 30.0869,
  lng: 78.2676,
  description: "Yoga capital",
  districtId: null,
  dataStatus: "seed",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveDestination", () => {
  describe("exact match", () => {
    it("resolves Jaipur by exact name match", async () => {
      mockDestination.findFirst.mockResolvedValueOnce(JAIPUR);

      const result = await resolveDestination("Jaipur");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Jaipur");
      expect(result!.state).toBe("Rajasthan");
      expect(result!.matchType).toBe("exact");
    });

    it("exact match is case-insensitive", async () => {
      mockDestination.findFirst.mockResolvedValueOnce(JAIPUR);

      const result = await resolveDestination("jaipur");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Jaipur");
      expect(result!.matchType).toBe("exact");
    });

    it("resolved destination includes real lat/lng from DB", async () => {
      mockDestination.findFirst.mockResolvedValueOnce(JAIPUR);

      const result = await resolveDestination("Jaipur");

      expect(result!.lat).toBe(26.9124);
      expect(result!.lng).toBe(75.7873);
    });
  });

  describe("alias match", () => {
    it("resolves Rishikesh via Hrishikesh alias", async () => {
      // No exact match
      mockDestination.findFirst.mockResolvedValueOnce(null);
      // Alias hit
      mockAlias.findFirst.mockResolvedValueOnce({
        id: "alias-1",
        alias: "Hrishikesh",
        destinationId: RISHIKESH.id,
        destination: RISHIKESH,
        createdAt: new Date(),
      } as never);

      const result = await resolveDestination("Hrishikesh");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Rishikesh");
      expect(result!.matchType).toBe("alias");
    });
  });

  describe("fuzzy match", () => {
    it("falls back to partial match when no exact or alias", async () => {
      mockDestination.findFirst
        .mockResolvedValueOnce(null)  // exact
        .mockResolvedValueOnce(JAIPUR); // fuzzy/partial
      mockAlias.findFirst.mockResolvedValueOnce(null);

      const result = await resolveDestination("Jai");

      expect(result).not.toBeNull();
      expect(result!.matchType).toBe("fuzzy");
    });
  });

  describe("unknown destination", () => {
    it("returns null for Atlantis — fictional destination", async () => {
      mockDestination.findFirst.mockResolvedValue(null);
      mockAlias.findFirst.mockResolvedValue(null);

      const result = await resolveDestination("Atlantis");

      expect(result).toBeNull();
    });

    it("returns null for empty string", async () => {
      const result = await resolveDestination("");
      expect(result).toBeNull();
      // Should not hit the DB for an empty query
      expect(mockDestination.findFirst).not.toHaveBeenCalled();
    });

    it("returns null for whitespace-only string", async () => {
      const result = await resolveDestination("   ");
      expect(result).toBeNull();
    });
  });
});

describe("searchTravelDestinations", () => {
  it("returns empty array for empty query", async () => {
    const result = await searchTravelDestinations("");
    expect(result).toEqual([]);
    expect(mockDestination.findMany).not.toHaveBeenCalled();
  });

  it("calls DB with the query string", async () => {
    mockDestination.findMany.mockResolvedValueOnce([JAIPUR]);
    await searchTravelDestinations("Jai");
    expect(mockDestination.findMany).toHaveBeenCalledOnce();
  });
});
