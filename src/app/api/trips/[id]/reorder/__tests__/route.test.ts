import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import * as authModule from "@/lib/auth";
import { hasTripRole } from "@/lib/security";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security", () => ({ hasTripRole: vi.fn() }));
vi.mock("@/lib/providers/maps", () => ({ mapProvider: { calculateDistance: () => 1 } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    trip: { findUnique: vi.fn() },
    itineraryDay: { findUnique: vi.fn() },
    itineraryItem: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
const req = (body: unknown) => ({ json: async () => body }) as unknown as Request;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/trips/[id]/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "member-of-A" } } as any);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({ id: "tripA" } as any);
    vi.mocked(hasTripRole).mockResolvedValue(true); // member of trip A
  });

  it("refuses to reorder a day that belongs to another trip (IDOR)", async () => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue({ tripId: "tripB" } as any);

    const res = await POST(req({ dayId: "dayOfTripB", items: [{ id: "x", order: 0 }] }), params("tripA"));

    expect(res.status).toBe(404);
    expect(prisma.itineraryItem.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("still reorders a day of the authorized trip", async () => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue({ tripId: "tripA" } as any);
    vi.mocked(prisma.itineraryItem.findMany).mockResolvedValue([
      { id: "a", startTime: "09:00", endTime: "10:00", place: null },
      { id: "b", startTime: "10:30", endTime: "11:30", place: null },
    ] as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as any);

    const res = await POST(
      req({ dayId: "dayOfTripA", items: [{ id: "b", order: 0 }, { id: "a", order: 1 }] }),
      params("tripA"),
    );

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects non-members before touching any day", async () => {
    vi.mocked(hasTripRole).mockResolvedValue(false);
    const res = await POST(req({ dayId: "d", items: [] }), params("tripA"));
    expect(res.status).toBe(401);
    expect(prisma.itineraryDay.findUnique).not.toHaveBeenCalled();
  });
});
