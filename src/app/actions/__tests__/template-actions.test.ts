import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTripFromTemplate } from "../template-actions";
import * as authModule from "@/lib/auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { trip: { create: vi.fn(async () => ({ id: "t-new" })) } } }));
vi.mock("@/lib/destination-resolver", () => ({
  resolveDestination: vi.fn(async (name: string) => (name === "Goa" ? { id: "goa-id", name: "Goa" } : null)),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("createTripFromTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "u1" } } as any);
  });

  it("links the destination and keeps the template's preferences", async () => {
    await createTripFromTemplate("weekend-getaway", "Goa", "2026-11-06");
    const data = (vi.mocked(prisma.trip.create).mock.calls[0][0] as any).data;

    expect(data.destinationId).toBe("goa-id");
    expect(data.dateStatus).toBe("exact");
    expect(data.groupMembers.create.travelerPreferences.create).toEqual([
      { category: "sightseeing", priority: "very-important" },
      { category: "dining", priority: "preferred" },
    ]);
  });

  it("still creates the trip when the destination can't be matched", async () => {
    await createTripFromTemplate("weekend-getaway", "Somewhere Unknown", "2026-11-06");
    const data = (vi.mocked(prisma.trip.create).mock.calls[0][0] as any).data;
    expect(data.destinationId).toBeNull();
  });
});
