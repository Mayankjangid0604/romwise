import { describe, it, expect, vi, beforeEach } from "vitest";
import { addItineraryItem, listAddablePlaces } from "../itinerary";
import * as authModule from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { NOT_TRANSIT_WHERE } from "@/lib/transit-filter";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    groupMember: { findFirst: vi.fn() },
    itineraryDay: { findUnique: vi.fn() },
    itineraryItem: { findMany: vi.fn(), create: vi.fn() },
    place: { findUnique: vi.fn(), findMany: vi.fn() },
    trip: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/destination-hierarchy", () => ({
  // Trip destination "jaipur" has one sub-destination "amer"
  getDestinationDescendants: vi.fn(async (id: string) => (id === "jaipur" ? ["jaipur", "amer"] : [id])),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/* eslint-disable @typescript-eslint/no-explicit-any */
const day = (overrides: Record<string, unknown> = {}) =>
  ({ dayNumber: 2, trip: { id: "trip1", destinationId: "jaipur", unscheduledPlaces: null, ...overrides } }) as any;

const place = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    name: "Jal Mahal",
    description: "Palace in Man Sagar lake",
    category: "sightseeing",
    destinationId: "jaipur",
    typicalCostInr: 0,
    durationMinutes: 45,
    ...overrides,
  }) as any;

describe("addItineraryItem (Add Place flow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ role: "member" } as any);
    vi.mocked(prisma.itineraryItem.create).mockResolvedValue({ id: "new-item" } as any);
  });

  it("appends a place after the latest-ending item with the place's duration", async () => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue(day());
    vi.mocked(prisma.place.findUnique).mockResolvedValue(place());
    vi.mocked(prisma.itineraryItem.findMany).mockResolvedValue([
      { order: 0, endTime: "12:00" },
      { order: 1, endTime: "16:30" }, // latest end, even though a later order ends earlier
      { order: 2, endTime: "15:00" },
    ] as any);

    const res = await addItineraryItem("trip1", "day2", "p1");

    expect(res).toEqual({ success: true, itemId: "new-item", dayNumber: 2, startTime: "16:45", endTime: "17:30" });
    expect(prisma.itineraryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ placeId: "p1", order: 3, costSource: "free", title: "Jal Mahal" }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/trips/trip1", "layout");
  });

  it("accepts places from a sub-destination of the trip destination", async () => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue(day());
    vi.mocked(prisma.place.findUnique).mockResolvedValue(place({ destinationId: "amer" }));
    vi.mocked(prisma.itineraryItem.findMany).mockResolvedValue([] as any);

    const res = await addItineraryItem("trip1", "day2", "p1");
    expect(res.success).toBe(true);
  });

  it("rejects places from another destination", async () => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue(day());
    vi.mocked(prisma.place.findUnique).mockResolvedValue(place({ destinationId: "goa" }));

    const res = await addItineraryItem("trip1", "day2", "p1");
    expect(res).toEqual({ success: false, error: "Place does not belong to this trip's destination" });
    expect(prisma.itineraryItem.create).not.toHaveBeenCalled();
  });

  it.each(["stay", "transport"])("rejects %s places as itinerary activities", async (category) => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue(day());
    vi.mocked(prisma.place.findUnique).mockResolvedValue(place({ category }));

    const res = await addItineraryItem("trip1", "day2", "p1");
    expect(res.success).toBe(false);
    expect(prisma.itineraryItem.create).not.toHaveBeenCalled();
  });

  it("rejects a railway station even when an importer labelled it an attraction", async () => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue(day());
    vi.mocked(prisma.place.findUnique).mockResolvedValue(place({ name: "Jaipur Junction", category: "history" }));

    const res = await addItineraryItem("trip1", "day2", "p1");
    expect(res.success).toBe(false);
    expect(prisma.itineraryItem.create).not.toHaveBeenCalled();
  });

  it("refuses to overflow past midnight when the day is full", async () => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue(day());
    vi.mocked(prisma.place.findUnique).mockResolvedValue(place());
    vi.mocked(prisma.itineraryItem.findMany).mockResolvedValue([{ order: 0, endTime: "23:50" }] as any);

    const res = await addItineraryItem("trip1", "day2", "p1");
    expect(res.success).toBe(false);
    expect(prisma.itineraryItem.create).not.toHaveBeenCalled();
  });

  it("clears the place from the 'couldn't be scheduled' list once added", async () => {
    vi.mocked(prisma.itineraryDay.findUnique).mockResolvedValue(
      day({ unscheduledPlaces: [{ name: "Jal Mahal", reason: "no time" }, { name: "Nahargarh", reason: "closed" }] }),
    );
    vi.mocked(prisma.place.findUnique).mockResolvedValue(place());
    vi.mocked(prisma.itineraryItem.findMany).mockResolvedValue([] as any);

    await addItineraryItem("trip1", "day2", "p1");
    expect(prisma.trip.update).toHaveBeenCalledWith({
      where: { id: "trip1" },
      data: { unscheduledPlaces: [{ name: "Nahargarh", reason: "closed" }] },
    });
  });
});

describe("listAddablePlaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "user1" } } as any);
  });

  it("returns nothing to non-members (no trip-destination leak)", async () => {
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue(null);
    expect(await listAddablePlaces("trip1", "fort")).toEqual([]);
    expect(prisma.place.findMany).not.toHaveBeenCalled();
  });

  it("suggests unscheduled, non-stay/transport places across the destination hierarchy", async () => {
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ id: "m1" } as any);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({ destinationId: "jaipur" } as any);
    vi.mocked(prisma.itineraryItem.findMany).mockResolvedValue([{ placeId: "already-1" }] as any);
    vi.mocked(prisma.place.findMany).mockResolvedValue([] as any);

    await listAddablePlaces("trip1");

    const args = vi.mocked(prisma.place.findMany).mock.calls[0][0] as any;
    expect(args.where.destinationId).toEqual({ in: ["jaipur", "amer"] });
    expect(args.where.category).toEqual({ notIn: ["stay", "transport"] });
    expect(args.where.id).toEqual({ notIn: ["already-1"] });
    expect(args.where.OR).toBeUndefined(); // no query → suggestions
    expect(args.where.AND).toContainEqual(NOT_TRANSIT_WHERE); // stations/bus stands never suggested
    expect(args.take).toBe(12);
  });

  it("searches name, area and category when a query is given", async () => {
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ id: "m1" } as any);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({ destinationId: "jaipur" } as any);
    vi.mocked(prisma.itineraryItem.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.place.findMany).mockResolvedValue([] as any);

    await listAddablePlaces("trip1", "  fort ");

    const args = vi.mocked(prisma.place.findMany).mock.calls[0][0] as any;
    expect(args.where.OR).toHaveLength(3);
    expect(args.where.OR[0]).toEqual({ name: { contains: "fort", mode: "insensitive" } });
  });
});
