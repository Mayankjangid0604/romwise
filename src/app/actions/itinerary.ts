"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateItinerary, type Preference } from "@/lib/itinerary-engine";
import { revalidatePath } from "next/cache";

export async function generateTripItinerary(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { groupMembers: true },
  });

  if (!trip) throw new Error("Trip not found");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) throw new Error("Not a member of this trip");

  const allPreferences: Preference[] = trip.groupMembers.flatMap((m) => {
    try {
      return JSON.parse(m.preferences) as Preference[];
    } catch {
      return [];
    }
  });

  const days = generateItinerary({
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    budgetInr: trip.budgetInr,
    paceLevel: trip.paceLevel as "easy" | "balanced" | "full",
    preferences: allPreferences,
  });

  await prisma.itineraryDay.deleteMany({ where: { tripId } });

  for (const day of days) {
    await prisma.itineraryDay.create({
      data: {
        dayNumber: day.dayNumber,
        date: day.date,
        tripId,
        items: {
          create: day.items.map((item) => ({
            title: item.title,
            description: item.description,
            category: item.category,
            startTime: item.startTime,
            endTime: item.endTime,
            estimatedCostInr: item.estimatedCostInr,
            reasoning: item.reasoning,
            order: item.order,
          })),
        },
      },
    });
  }

  revalidatePath(`/trips/${tripId}`);
}
