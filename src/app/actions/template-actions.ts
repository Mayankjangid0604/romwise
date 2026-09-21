"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { TRIP_TEMPLATES } from "@/lib/trip-templates";
import { TripType } from "@/lib/date-utils";

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

  // We map the template preferences to the required format
  const preferencesJson = JSON.stringify(template.preferences);

  const trip = await prisma.trip.create({
    data: {
      title: `${template.title} in ${destination}`,
      destination: destination,
      tripType: template.tripType,
      dateStatus: "known",
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
