"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SAMPLE_HOTELS } from "@/lib/stay";
import { getTripDuration } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";

export async function selectHotel(
  tripId: string,
  hotelName: string,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { groupMembers: true },
  });
  if (!trip) throw new Error("Trip not found");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) throw new Error("Not a member of this trip");

  const hotel = SAMPLE_HOTELS.find((h) => h.name === hotelName);
  if (!hotel) throw new Error("Hotel not found");

  const dayCount = getTripDuration(trip, 3);
  const nights = Math.max(1, dayCount - 1);
  const totalCostInr = hotel.costPerNightInr * nights;

  await prisma.tripAccommodation.deleteMany({ where: { tripId } });
  
  await prisma.tripAccommodation.create({
    data: {
      tripId,
      name: hotel.name,
      costPerNightInr: hotel.costPerNightInr,
      totalCostInr,
      nights,
      latitude: hotel.lat,
      longitude: hotel.lng,
    },
  });

  revalidatePath(`/trips/${tripId}/stay`);
  revalidatePath(`/trips/${tripId}/budget`);
}

export async function removeHotelSelection(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { groupMembers: true },
  });
  if (!trip) throw new Error("Trip not found");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) throw new Error("Not a member of this trip");

  await prisma.tripAccommodation.deleteMany({ where: { tripId } });

  revalidatePath(`/trips/${tripId}/stay`);
  revalidatePath(`/trips/${tripId}/budget`);
}
