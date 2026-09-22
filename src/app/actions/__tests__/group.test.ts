import { describe, it, expect, vi, beforeEach } from "vitest";
import { removeGroupMember, leaveGroup } from "../group";
import * as securityModule from "@/lib/security";
import * as authModule from "@/lib/auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/security", () => ({
  requireTripRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    trip: {
      findUnique: vi.fn().mockResolvedValue({ id: "trip1", creatorId: "other-user" }),
    },
    groupMember: {
      delete: vi.fn().mockResolvedValue({ id: "member-id" }),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Group Actions Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
  });

  it("should throw if user is not a creator when removing member", async () => {
    vi.mocked(securityModule.requireTripRole).mockRejectedValueOnce(
      new Error("Unauthorized: Requires creator role")
    );

    await expect(removeGroupMember("trip1", "user2")).rejects.toThrow("Unauthorized");
    expect(prisma.groupMember.delete).not.toHaveBeenCalled();
  });

  it("should remove member if user is creator", async () => {
    vi.mocked(securityModule.requireTripRole).mockResolvedValueOnce(undefined);

    await removeGroupMember("trip1", "user2");
    expect(prisma.groupMember.delete).toHaveBeenCalledWith({
      where: { userId_tripId: { userId: "user2", tripId: "trip1" } },
    });
  });

  it("should allow any member (viewer+) to leave group", async () => {
    vi.mocked(securityModule.requireTripRole).mockResolvedValueOnce(undefined);

    await leaveGroup("trip1");
    expect(prisma.groupMember.delete).toHaveBeenCalledWith({
      where: { userId_tripId: { userId: "user1", tripId: "trip1" } },
    });
  });

  it("should reject leaveGroup if user has no role", async () => {
    vi.mocked(securityModule.requireTripRole).mockRejectedValueOnce(
      new Error("Unauthorized")
    );

    await expect(leaveGroup("trip1")).rejects.toThrow("Unauthorized");
  });

  it("should prevent trip creator from leaving their own trip", async () => {
    // Make the authenticated user the trip creator
    vi.mocked(prisma.trip.findUnique).mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id: "trip1", creatorId: "user1" } as any
    );

    await expect(leaveGroup("trip1")).rejects.toThrow("Trip creator cannot leave their own trip");
    expect(securityModule.requireTripRole).not.toHaveBeenCalled();
    expect(prisma.groupMember.delete).not.toHaveBeenCalled();
  });
});
