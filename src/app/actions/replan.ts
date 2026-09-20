"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  proposeReplan,
  type ReplanItem,
  type DisruptionInput,
  type ReplanProposal,
} from "@/lib/replanner";
import { revalidatePath } from "next/cache";

export async function getReplanProposal(
  tripId: string,
  dayNumber: number,
  disruption: DisruptionInput,
): Promise<ReplanProposal> {
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

  const day = await prisma.itineraryDay.findFirst({
    where: { tripId, dayNumber },
    include: { 
      items: { 
        orderBy: { order: "asc" },
        include: { place: true }
      } 
    },
  });
  if (!day) throw new Error("Day not found");

  const items: ReplanItem[] = day.items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    startTime: item.startTime,
    endTime: item.endTime,
    order: item.order,
    isTimeSensitive: isTimeSensitiveCategory(item.category, item.startTime),
    // B-004: Pass actual DB hours so replanner can validate shifts
    openingTime: item.place?.openingTime ?? null,
    closingTime: item.place?.closingTime ?? null,
  }));


  return proposeReplan(items, disruption);
}

export async function acceptReplan(
  tripId: string,
  proposal: ReplanProposal,
): Promise<void> {
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

  const tripDays = await prisma.itineraryDay.findMany({
    where: { tripId },
    include: { items: { select: { id: true } } },
  });
  const validItemIds = new Set(tripDays.flatMap((d) => d.items.map((i) => i.id)));

  for (const change of proposal.changes) {
    if (!validItemIds.has(change.itemId)) {
      throw new Error("Invalid item reference");
    }

    if (change.action === "removed" || change.action === "skipped") {
      await prisma.itineraryItem.delete({
        where: { id: change.itemId },
      });
    } else if (
      change.action === "shifted" &&
      change.newStartTime &&
      change.newEndTime
    ) {
      await prisma.itineraryItem.update({
        where: { id: change.itemId },
        data: {
          startTime: change.newStartTime,
          endTime: change.newEndTime,
        },
      });
    }
  }

  revalidatePath(`/trips/${tripId}`);
}

function isTimeSensitiveCategory(
  category: string,
  startTime: string,
): boolean {
  const hour = parseInt(startTime.split(":")[0]);
  if (category === "nature" && hour <= 8) return true;
  if (category === "dining" && (hour >= 19 || hour <= 8)) return true;
  if (category === "nightlife" && hour >= 19) return true;
  return false;
}
