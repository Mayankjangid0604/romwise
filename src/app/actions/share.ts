"use server";

import { prisma } from "@/lib/db";
import { requireTripRole, TripRole } from "@/lib/security";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export async function generateShareLink(tripId: string, role: TripRole) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) throw new Error("Unauthorized");
  
  // Only creators can generate share links
  await requireTripRole(tripId, "creator");

  // Generate a random cryptographically secure 32-byte token (64 hex characters)
  const token = crypto.randomBytes(32).toString("hex");

  // Invalidate any existing active tokens for this role on this trip
  await prisma.tripShare.updateMany({
    where: {
      tripId,
      role,
      active: true,
    },
    data: {
      active: false,
    },
  });

  const share = await prisma.tripShare.create({
    data: {
      tripId,
      token,
      role,
      active: true,
    },
  });

  revalidatePath(`/trips/${tripId}/group`);
  return share;
}

export async function revokeShareLink(tripId: string, role: TripRole) {
  await requireTripRole(tripId, "creator");

  await prisma.tripShare.updateMany({
    where: {
      tripId,
      role,
      active: true,
    },
    data: {
      active: false,
    },
  });

  revalidatePath(`/trips/${tripId}/group`);
}

export async function getActiveShares(tripId: string) {
  await requireTripRole(tripId, "creator");

  return prisma.tripShare.findMany({
    where: {
      tripId,
      active: true,
    },
  });
}
