"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  setPreference,
  removePreference,
  isValidCategory,
  isValidPriority,
  type Category,
  type Priority,
} from "@/lib/preferences";
import { revalidatePath } from "next/cache";

async function getMembership(tripId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { userId_tripId: { userId, tripId } },
  });
  return member;
}

export async function updatePreference(
  tripId: string,
  category: string,
  priority: string,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const member = await getMembership(tripId, session.user.id);
  if (!member) throw new Error("Not a member of this trip");

  if (!isValidCategory(category)) throw new Error("Invalid category");
  if (!isValidPriority(priority)) throw new Error("Invalid priority");

  await setPreference(member.id, category as Category, priority as Priority);
  revalidatePath(`/trips/${tripId}`);
}

export async function deletePreference(tripId: string, category: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const member = await getMembership(tripId, session.user.id);
  if (!member) throw new Error("Not a member of this trip");

  if (!isValidCategory(category)) throw new Error("Invalid category");

  await removePreference(member.id, category as Category);
  revalidatePath(`/trips/${tripId}`);
}
