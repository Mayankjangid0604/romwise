"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { optimizeBudget, type BudgetItem, type RemovedItem } from "@/lib/budget";
import { revalidatePath } from "next/cache";

export async function optimizeTripBudget(
  tripId: string,
): Promise<{ removedItems: RemovedItem[]; savings: number }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      groupMembers: true,
      itineraryDays: {
        include: { items: true },
      },
    },
  });

  if (!trip) throw new Error("Trip not found");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) throw new Error("Not a member of this trip");

  const budgetItems: BudgetItem[] = trip.itineraryDays.flatMap((day) =>
    day.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      estimatedCostInr: item.estimatedCostInr,
      dayNumber: day.dayNumber,
    })),
  );

  const result = optimizeBudget(budgetItems, trip.budgetInr);

  if (result.removedItems.length > 0) {
    const idsToRemove = result.removedItems.map((r) => r.item.id);
    await prisma.itineraryItem.deleteMany({
      where: { id: { in: idsToRemove } },
    });
  }

  revalidatePath(`/trips/${tripId}/budget`);
  revalidatePath(`/trips/${tripId}`);

  return {
    removedItems: result.removedItems,
    savings: result.savings,
  };
}
