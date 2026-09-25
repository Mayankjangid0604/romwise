import { describe, it, expect, vi, beforeEach } from "vitest";
import { togglePlaceSelection } from "../place-selections";
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
    place: {
      findUnique: vi.fn(),
    },
    tripPlaceSelection: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Place Selections Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
  });

  it("should reject outsider (no group member record)", async () => {
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);
    await expect(togglePlaceSelection("trip1", "place1", "interested")).rejects.toThrow("Trip not found or access denied");
    expect(prisma.tripPlaceSelection.upsert).not.toHaveBeenCalled();
  });

  it("should reject viewer role", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "viewer", trip: { destinationId: "dest1" } } as any);
    await expect(togglePlaceSelection("trip1", "place1", "interested")).rejects.toThrow("Viewers cannot modify place selections");
    expect(prisma.tripPlaceSelection.upsert).not.toHaveBeenCalled();
  });

  it("should allow member role according to policy", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "member", trip: { destinationId: "dest1" } } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.place.findUnique).mockResolvedValueOnce({ destinationId: "dest1" } as any);

    await togglePlaceSelection("trip1", "place1", "interested");
    expect(prisma.tripPlaceSelection.upsert).toHaveBeenCalled();
  });

  it("should allow creator role", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "creator", trip: { destinationId: "dest1" } } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.place.findUnique).mockResolvedValueOnce({ destinationId: "dest1" } as any);

    await togglePlaceSelection("trip1", "place1", "must-visit");
    expect(prisma.tripPlaceSelection.upsert).toHaveBeenCalled();
  });

  it("should reject invalid Place (not found)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "member", trip: { destinationId: "dest1" } } as any);
    vi.mocked(prisma.place.findUnique).mockResolvedValueOnce(null);

    await expect(togglePlaceSelection("trip1", "place1", "interested")).rejects.toThrow("Place not found");
    expect(prisma.tripPlaceSelection.upsert).not.toHaveBeenCalled();
  });

  it("should reject cross-destination Place", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ role: "creator", trip: { destinationId: "dest1" } } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.place.findUnique).mockResolvedValueOnce({ destinationId: "different-dest" } as any);

    await expect(togglePlaceSelection("trip1", "place1", "interested")).rejects.toThrow("Place does not belong to this trip's destination");
    expect(prisma.tripPlaceSelection.upsert).not.toHaveBeenCalled();
  });

  it("should reject invalid status", async () => {
    // Cast invalid string to bypass TS temporarily
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(togglePlaceSelection("trip1", "place1", "invalid-status" as any)).rejects.toThrow("Invalid selection status");
    expect(prisma.groupMember.findFirst).not.toHaveBeenCalled();
  });
});
