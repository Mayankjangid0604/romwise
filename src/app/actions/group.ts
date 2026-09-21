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
  // A member can remove themselves, so we check if the authenticated user is the one leaving
  // And require at least member role
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  await requireTripRole(tripId, "viewer"); // At least viewer to leave

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
