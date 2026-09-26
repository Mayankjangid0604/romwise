import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectHotel, removeHotelSelection } from "../stay";
import * as authModule from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSampleHotelsForDestination } from "@/lib/sample-hotels";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/destination-hierarchy", () => ({ getDestinationDescendants: vi.fn(async (id: string) => [id]) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    trip: { findUnique: vi.fn() },
    place: { findUnique: vi.fn() },
    tripAccommodation: { deleteMany: vi.fn((args) => ({ op: "deleteMany", args })), create: vi.fn((args) => ({ op: "create", args })) },
    $transaction: vi.fn(async (ops) => ops),
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
const goa = { id: "goa-id", slug: "goa", name: "Goa", lat: 15.3, lng: 74.0, destinationType: "beach" };
const trip = (role = "member") =>
  ({
    id: "t1",
    destinationId: goa.id,
    destinationRef: goa,
    startDate: new Date("2026-11-01"),
    endDate: new Date("2026-11-04"), // 4 days → 3 nights
    tripType: "MULTI_DAY",
    groupMembers: [{ userId: "u1", role }],
  }) as any;

describe("selectHotel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.auth).mockResolvedValue({ user: { id: "u1" } } as any);
  });

  it("stores a sample hotel with the server-side price and a selectionRef", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(trip());
    const hotel = getSampleHotelsForDestination(goa).find((h) => h.propertyType === "beach_hut")!;

    await selectHotel("t1", hotel.id);

    const create = vi.mocked(prisma.tripAccommodation.create).mock.calls[0][0] as any;
    expect(create.data).toMatchObject({
      tripId: "t1",
      name: hotel.name,
      costPerNightInr: hotel.costPerNightInr,
      totalCostInr: hotel.costPerNightInr! * 3,
      nights: 3,
      selectionRef: hotel.id,
    });
  });

  it("replaces only the previous Stay-tab pick, never manually added stays", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(trip());
    const [hotel] = getSampleHotelsForDestination(goa);
    await selectHotel("t1", hotel.id);
    expect(prisma.tripAccommodation.deleteMany).toHaveBeenCalledWith({ where: { tripId: "t1", selectionRef: { not: null } } });
  });

  it("rejects ids that aren't a known stay for this destination", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(trip());
    await expect(selectHotel("t1", "sample:goa:made-up")).rejects.toThrow("Stay not found");
    await expect(selectHotel("t1", "sample:jaipur:chandni-haveli")).rejects.toThrow("Stay not found");
    vi.mocked(prisma.place.findUnique).mockResolvedValue({ id: "p", category: "history", destinationId: goa.id } as any);
    await expect(selectHotel("t1", "p")).rejects.toThrow("Stay not found");
    expect(prisma.tripAccommodation.create).not.toHaveBeenCalled();
  });

  it("rejects viewers", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(trip("viewer"));
    const [hotel] = getSampleHotelsForDestination(goa);
    await expect(selectHotel("t1", hotel.id)).rejects.toThrow(/Viewers/);
    await expect(removeHotelSelection("t1")).rejects.toThrow(/Viewers/);
  });

  it("removing a selection keeps manual stays", async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(trip());
    await removeHotelSelection("t1");
    expect(prisma.tripAccommodation.deleteMany).toHaveBeenCalledWith({ where: { tripId: "t1", selectionRef: { not: null } } });
  });
});
