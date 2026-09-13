"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function selectHotel(
  tripId: string,
  hotelName: string,
  costPerNightInr: number,
  nights: number,
  lat: number,
  lng: number,
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

  const totalCostInr = costPerNightInr * nights;

  await prisma.staySelection.upsert({
    where: { tripId },
    create: {
      hotelName,
      costPerNightInr,
      totalCostInr,
      nights,
      lat,
      lng,
      tripId,
    },
    update: {
      hotelName,
      costPerNightInr,
      totalCostInr,
      nights,
      lat,
      lng,
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

  await prisma.staySelection.deleteMany({ where: { tripId } });

  revalidatePath(`/trips/${tripId}/stay`);
  revalidatePath(`/trips/${tripId}/budget`);
}
