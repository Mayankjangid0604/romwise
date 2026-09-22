"use server";

import { prisma } from "@/lib/db";
import { requireTripRole } from "@/lib/security";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function removeGroupMember(tripId: string, userIdToRemove: string) {
  // Only creators can remove members
  await requireTripRole(tripId, "creator");

  await prisma.groupMember.delete({
    where: {
      userId_tripId: {
        userId: userIdToRemove,
        tripId,
      },
    },
  });

  revalidatePath(`/trips/${tripId}/group`);
}

export async function leaveGroup(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error("Trip not found");
  if (trip.creatorId === session.user.id) throw new Error("Trip creator cannot leave their own trip");

  await requireTripRole(tripId, "viewer");

  await prisma.groupMember.delete({
    where: {
      userId_tripId: {
        userId: session.user.id,
        tripId,
      },
    },
  });

  revalidatePath(`/dashboard`);
}
