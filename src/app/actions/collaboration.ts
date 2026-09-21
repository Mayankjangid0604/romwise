"use server";

import { prisma } from "@/lib/db";
import { requireTripRole } from "@/lib/security";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function toggleVote(tripId: string, itineraryItemId: string, value: 1 | -1) {
  // Viewers cannot vote
  await requireTripRole(tripId, "member");

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existingVote = await prisma.vote.findUnique({
    where: {
      itineraryItemId_userId: {
        itineraryItemId,
        userId: session.user.id,
      },
    },
  });

  if (existingVote) {
    if (existingVote.value === value) {
      // Toggle off
      await prisma.vote.delete({
        where: { id: existingVote.id }
      });
    } else {
      // Change vote
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: { value }
      });
    }
  } else {
    // New vote
    await prisma.vote.create({
      data: {
        itineraryItemId,
        userId: session.user.id,
        value,
      }
    });
  }

  revalidatePath(`/trips/${tripId}`, 'layout');
}

export async function addComment(tripId: string, itineraryItemId: string, content: string) {
  await requireTripRole(tripId, "member");

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.comment.create({
    data: {
      itineraryItemId,
      userId: session.user.id,
      content,
    }
  });

  revalidatePath(`/trips/${tripId}`, 'layout');
}

export async function deleteComment(tripId: string, commentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return;

  // Only the creator of the comment (or the trip creator) can delete it
  if (comment.userId !== session.user.id) {
    await requireTripRole(tripId, "creator"); // This throws if they aren't creator
  }

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(`/trips/${tripId}`, 'layout');
}
