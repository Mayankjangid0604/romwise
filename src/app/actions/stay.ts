"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTripDuration } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";
import { canEditTrip, roleIn } from "@/lib/security";
import { findSampleHotel } from "@/lib/sample-hotels";
import { getDestinationDescendants } from "@/lib/destination-hierarchy";

/**
 * Pick the trip's hotel from the Stay tab. `stayId` is a ranked option id: either a
 * sample hotel ("sample:<destination>:<archetype>") or a `stay` Place. Name, price and
 * location are always looked up server-side — never taken from the client.
 */
export async function selectHotel(
  tripId: string,
  stayId: string,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { groupMembers: true, destinationRef: true },
  });
  if (!trip) throw new Error("Trip not found");

  const role = roleIn(trip.groupMembers, session.user!.id);
  if (!role) throw new Error("Not a member of this trip");
  if (!canEditTrip(role)) throw new Error("Viewers cannot modify this trip");

  let stay: { name: string; costPerNightInr: number | null; lat: number; lng: number; area: string | null } | null = null;

  if (stayId.startsWith("sample:")) {
    const hotel = trip.destinationRef ? findSampleHotel(trip.destinationRef, stayId) : null;
    if (hotel) {
      stay = { name: hotel.name, costPerNightInr: hotel.costPerNightInr, lat: hotel.lat, lng: hotel.lng, area: hotel.area };
    }
  } else if (trip.destinationId) {
    const place = await prisma.place.findUnique({ where: { id: stayId } });
    const allowed = await getDestinationDescendants(trip.destinationId);
    if (place && place.category === "stay" && allowed.includes(place.destinationId)) {
      stay = { name: place.name, costPerNightInr: place.typicalCostInr ?? null, lat: place.lat, lng: place.lng, area: place.area };
    }
  }
  if (!stay) throw new Error("Stay not found");

  const nights = Math.max(1, getTripDuration(trip, 3) - 1);
  const totalCostInr = stay.costPerNightInr !== null ? stay.costPerNightInr * nights : null;

  // Replace only the previous Stay-tab pick; stays the user typed in manually are kept
  await prisma.$transaction([
    prisma.tripAccommodation.deleteMany({ where: { tripId, selectionRef: { not: null } } }),
    prisma.tripAccommodation.create({
      data: {
        tripId,
        name: stay.name,
        location: stay.area,
        costPerNightInr: stay.costPerNightInr,
        totalCostInr,
        nights,
        latitude: stay.lat,
        longitude: stay.lng,
        selectionRef: stayId,
        notes: stayId.startsWith("sample:") ? "Sample hotel data (demonstration only)" : null,
      },
    }),
  ]);

  // Overview, Stay and Budget all show the selection
  revalidatePath(`/trips/${tripId}`, "layout");
}

export async function removeHotelSelection(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { groupMembers: true },
  });
  if (!trip) throw new Error("Trip not found");

  const role = roleIn(trip.groupMembers, session.user!.id);
  if (!role) throw new Error("Not a member of this trip");
  if (!canEditTrip(role)) throw new Error("Viewers cannot modify this trip");

  await prisma.tripAccommodation.deleteMany({ where: { tripId, selectionRef: { not: null } } });

  revalidatePath(`/trips/${tripId}`, "layout");
}
