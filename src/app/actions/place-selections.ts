"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function togglePlaceSelection(tripId: string, placeId: string, status: "must-visit" | "interested" | "exclude" | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify access to trip
  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      groupMembers: { some: { userId: session.user.id } }
    }
  });

  if (!trip) throw new Error("Trip not found or access denied");

  if (status === null) {
    await prisma.tripPlaceSelection.deleteMany({
      where: { tripId, placeId }
    });
  } else {
    await prisma.tripPlaceSelection.upsert({
      where: {
        tripId_placeId: { tripId, placeId }
      },
      update: { status },
      create: { tripId, placeId, status }
    });
  }

  revalidatePath(`/trips/${tripId}/places`);
  return { success: true };
}
