"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTripDuration } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";
import { canEditTrip, roleIn } from "@/lib/security";

export async function selectHotel(
  tripId: string,
  placeId: string,
) {
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

  const place = await prisma.place.findUnique({
    where: { id: placeId },
  });
  if (!place || place.category !== "stay") throw new Error("Stay not found");

  const dayCount = getTripDuration(trip, 3);
  const nights = Math.max(1, dayCount - 1);
  const costPerNightInr = place.typicalCostInr ?? null;
  const totalCostInr = costPerNightInr !== null ? costPerNightInr * nights : null;

  await prisma.tripAccommodation.deleteMany({ where: { tripId } });
  
  await prisma.tripAccommodation.create({
    data: {
      tripId,
      name: place.name,
      costPerNightInr,
      totalCostInr,
      nights,
      latitude: place.lat,
      longitude: place.lng,
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

  const role = roleIn(trip.groupMembers, session.user!.id);
  if (!role) throw new Error("Not a member of this trip");
  if (!canEditTrip(role)) throw new Error("Viewers cannot modify this trip");

  await prisma.tripAccommodation.deleteMany({ where: { tripId } });

  revalidatePath(`/trips/${tripId}/stay`);
  revalidatePath(`/trips/${tripId}/budget`);
}
