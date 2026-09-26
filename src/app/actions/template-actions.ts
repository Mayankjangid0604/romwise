"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { TRIP_TEMPLATES } from "@/lib/trip-templates";
import { resolveDestination } from "@/lib/destination-resolver";

const TEMPLATE_PREFERENCE_CATEGORY: Record<string, string> = {
  Attractions: "sightseeing",
  Culture: "culture",
  Food: "dining",
  Nature: "nature",
  Adventure: "adventure",
  Relaxation: "relaxation",
  // "Budget", "Luxury" and "Safety" aren't place categories; budget/pace already carry them
};
const TEMPLATE_PREFERENCE_PRIORITY = { high: "very-important", medium: "preferred", low: "nice-to-have" } as const;

export async function createTripFromTemplate(
  templateId: string,
  destination: string,
  startDateStr: string
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("You must be logged in");
  }

  const template = TRIP_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error("Invalid template");
  }

  if (!destination || !startDateStr) {
    throw new Error("Destination and Start Date are required");
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + template.durationDays - 1);

  // Template preferences use their own labels; map the ones the planner understands
  // (previously computed into an unused variable and dropped)
  const travelerPreferences = template.preferences.flatMap((p) => {
    const category = TEMPLATE_PREFERENCE_CATEGORY[p.category];
    return category ? [{ category, priority: TEMPLATE_PREFERENCE_PRIORITY[p.priority] }] : [];
  });

  // Link the destination now (as the New Trip form does): without it the Places tab
  // 404'd and Stay/Add Place had nothing to show until the first generation.
  const matchedDestination = await resolveDestination(destination);

  const trip = await prisma.trip.create({
    data: {
      title: `${template.title} in ${destination}`,
      destination: destination,
      destinationId: matchedDestination?.id ?? null,
      tripType: template.tripType,
      dateStatus: "exact",
      timeStatus: "UNKNOWN",
      startDate: startDate,
      endDate: endDate,
      budgetInr: template.budgetInr,
      maxTravelers: template.maxTravelers,
      paceLevel: template.paceLevel,
      creatorId: session.user.id,
      groupMembers: {
        create: {
          userId: session.user.id,
          role: "creator",
          travelerPreferences: travelerPreferences.length > 0 ? { create: travelerPreferences } : undefined,
        },
      },
      packingItems: {
        create: template.packingList.map((item) => ({
          label: item.name,
          category: item.category,
        })),
      },
    },
  });

  return { tripId: trip.id };
}
