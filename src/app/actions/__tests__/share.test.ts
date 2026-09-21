import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateShareLink, revokeShareLink } from "../share";
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
    tripShare: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "share-id", token: "fake-token" }),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Share Actions Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
  });

  it("should throw if user is not a creator when generating link", async () => {
    vi.mocked(securityModule.requireTripRole).mockRejectedValueOnce(
      new Error("Unauthorized: Requires creator role")
    );

    await expect(generateShareLink("trip1", "viewer")).rejects.toThrow("Unauthorized");
    expect(prisma.tripShare.create).not.toHaveBeenCalled();
  });

  it("should generate link if user is creator", async () => {
    vi.mocked(securityModule.requireTripRole).mockResolvedValueOnce(undefined);

    const share = await generateShareLink("trip1", "viewer");
    expect(share.token).toBe("fake-token");
    expect(prisma.tripShare.updateMany).toHaveBeenCalled();
    expect(prisma.tripShare.create).toHaveBeenCalled();
  });

  it("should throw if user is not a creator when revoking link", async () => {
    vi.mocked(securityModule.requireTripRole).mockRejectedValueOnce(
      new Error("Unauthorized: Requires creator role")
    );

    await expect(revokeShareLink("trip1", "viewer")).rejects.toThrow("Unauthorized");
    expect(prisma.tripShare.updateMany).not.toHaveBeenCalled();
  });
});
