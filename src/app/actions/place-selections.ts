"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const VALID_STATUSES = ["must-visit", "interested", "exclude"] as const;
type SelectionStatus = (typeof VALID_STATUSES)[number];

export async function togglePlaceSelection(tripId: string, placeId: string, status: SelectionStatus | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Validate status at runtime
  if (status !== null && !VALID_STATUSES.includes(status)) {
    throw new Error("Invalid selection status");
  }

  // Verify access to trip and get membership role
  const member = await prisma.groupMember.findFirst({
    where: {
      tripId,
      userId: session.user.id
    },
    include: { trip: { select: { destinationId: true } } }
  });

  if (!member) throw new Error("Trip not found or access denied");

  // Viewers cannot mutate
  if (member.role === "viewer") throw new Error("Viewers cannot modify place selections");

  // Cross-destination guard: verify place belongs to trip's destination
  if (status !== null && member.trip.destinationId) {
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { destinationId: true }
    });

    if (!place) throw new Error("Place not found");
    if (place.destinationId !== member.trip.destinationId) {
      throw new Error("Place does not belong to this trip's destination");
    }
  }

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
