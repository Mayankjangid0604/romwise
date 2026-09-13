"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateItinerary, type Preference } from "@/lib/itinerary-engine";
import { generateTripBrainItinerary, type GeneratedDay } from "@/lib/trip-brain";
import { checkGenerationEntitlement } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";

export async function generateTripItinerary(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      destinationRef: true,
      groupMembers: {
        include: { travelerPreferences: true },
      },
    },
  });

  if (!trip) throw new Error("Trip not found");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) throw new Error("Not a member of this trip");

  const entitlement = await checkGenerationEntitlement(session.user.id);
  if (!entitlement.canGenerate) {
    throw new Error(entitlement.reason ?? "Generation limit reached");
  }

  const allPreferences = trip.groupMembers.flatMap((m) => {
    if (m.travelerPreferences.length > 0) {
      return m.travelerPreferences.map((p) => ({
        category: p.category,
        priority: p.priority,
      }));
    }
    try {
      return JSON.parse(m.preferences) as { category: string; priority: string }[];
    } catch {
      return [];
    }
  });

  const creatorMember = trip.groupMembers.find((m) => m.role === "creator");

  let days: GeneratedDay[];

  const hasGemini = !!process.env.GEMINI_API_KEY;

  if (hasGemini) {
    try {
      days = await generateTripBrainItinerary({
        destination: trip.destination,
        destinationState: trip.destinationRef?.state,
        destinationLat: trip.destinationRef?.lat,
        destinationLng: trip.destinationRef?.lng,
        startDate: trip.startDate,
        endDate: trip.endDate,
        budgetInr: trip.budgetInr,
        paceLevel: trip.paceLevel as "easy" | "balanced" | "full",
        preferences: allPreferences,
        accessibilityNotes: creatorMember?.accessibilityNotes,
      });
    } catch {
      days = fallbackGenerate(trip, allPreferences);
    }
  } else {
    days = fallbackGenerate(trip, allPreferences);
  }

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

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "planning" },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tripGenerations: { increment: 1 } },
  });

  revalidatePath(`/trips/${tripId}`);
}

function fallbackGenerate(
  trip: { destination: string; startDate: Date; endDate: Date; budgetInr: number; paceLevel: string },
  preferences: { category: string; priority: string }[],
): GeneratedDay[] {
  return generateItinerary({
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    budgetInr: trip.budgetInr,
    paceLevel: trip.paceLevel as "easy" | "balanced" | "full",
    preferences: preferences as Preference[],
  });
}
