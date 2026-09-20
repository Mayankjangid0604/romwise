"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generatePackingList } from "@/lib/packing";
import { getTripDuration } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";

export async function generatePacking(tripId: string) {
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

  const durationDays = getTripDuration(trip, 3);

  const accessibilityNotes = trip.groupMembers
    .map((m) => m.accessibilityNotes)
    .filter((note) => note.length > 0);

  await prisma.packingItem.deleteMany({ where: { tripId } });

  const items = generatePackingList({ durationDays, accessibilityNotes });

  await prisma.packingItem.createMany({
    data: items.map((item) => ({
      label: item.label,
      category: item.category,
      essential: item.essential,
      tripId,
    })),
  });

  revalidatePath(`/trips/${tripId}/packing`);
}

export async function togglePackingItem(itemId: string, checked: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const item = await prisma.packingItem.findUnique({
    where: { id: itemId },
    include: { trip: { include: { groupMembers: true } } },
  });
  if (!item) throw new Error("Item not found");

  const isMember = item.trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) throw new Error("Not a member of this trip");

  await prisma.packingItem.update({
    where: { id: itemId },
    data: { checked },
  });

  revalidatePath(`/trips/${item.tripId}/packing`);
}

export async function toggleEssential(itemId: string, essential: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const item = await prisma.packingItem.findUnique({
    where: { id: itemId },
    include: { trip: { include: { groupMembers: true } } },
  });
  if (!item) throw new Error("Item not found");

  const isMember = item.trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) throw new Error("Not a member of this trip");

  await prisma.packingItem.update({
    where: { id: itemId },
    data: { essential },
  });

  revalidatePath(`/trips/${item.tripId}/packing`);
}

export async function addCustomPackingItem(
  tripId: string,
  label: string,
  category: string,
  essential: boolean,
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

  if (!label.trim()) throw new Error("Label is required");

  await prisma.packingItem.create({
    data: {
      label: label.trim(),
      category,
      essential,
      tripId,
    },
  });

  revalidatePath(`/trips/${tripId}/packing`);
}
