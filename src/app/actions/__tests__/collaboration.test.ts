import { describe, it, expect, vi, beforeEach } from "vitest";
import { toggleVote, addComment, deleteComment } from "../collaboration";
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
    vote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Collaboration Actions Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
  });

  describe("Voting", () => {
    it("should throw if user is a viewer", async () => {
      vi.mocked(securityModule.requireTripRole).mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(toggleVote("trip1", "item1", 1)).rejects.toThrow("Unauthorized");
    });

    it("should create vote if user is member and hasn't voted", async () => {
      vi.mocked(securityModule.requireTripRole).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.vote.findUnique).mockResolvedValueOnce(null);

      await toggleVote("trip1", "item1", 1);
      expect(prisma.vote.create).toHaveBeenCalledWith({
        data: { itineraryItemId: "item1", userId: "user1", value: 1 },
      });
    });
  });

  describe("Commenting", () => {
    it("should throw if user is a viewer", async () => {
      vi.mocked(securityModule.requireTripRole).mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(addComment("trip1", "item1", "Hello")).rejects.toThrow("Unauthorized");
    });

    it("should allow deleting own comment", async () => {
      // Mock the comment to belong to user1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({ userId: "user1", id: "comment1" } as any);
      
      await deleteComment("trip1", "comment1");
      
      expect(securityModule.requireTripRole).not.toHaveBeenCalled();
      expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: "comment1" } });
    });

    it("should require creator role when deleting someone else's comment", async () => {
      // Mock the comment to belong to user2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({ userId: "user2", id: "comment1" } as any);
      vi.mocked(securityModule.requireTripRole).mockResolvedValueOnce(undefined);
      
      await deleteComment("trip1", "comment1");
      
      expect(securityModule.requireTripRole).toHaveBeenCalledWith("trip1", "creator");
      expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: "comment1" } });
    });

    it("should reject deleting someone else's comment if not creator", async () => {
      // Mock the comment to belong to user2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({ userId: "user2", id: "comment1" } as any);
      vi.mocked(securityModule.requireTripRole).mockRejectedValueOnce(new Error("Unauthorized"));
      
      await expect(deleteComment("trip1", "comment1")).rejects.toThrow("Unauthorized");
      expect(prisma.comment.delete).not.toHaveBeenCalled();
    });
  });
});
