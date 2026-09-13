"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findDestination } from "@/lib/destinations";
import { redirect } from "next/navigation";

export type TripState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createTrip(
  _prevState: TripState,
  formData: FormData,
): Promise<TripState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be logged in" };
  }

  const title = (formData.get("title") as string)?.trim();
  const destination = (formData.get("destination") as string)?.trim();
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const budgetStr = formData.get("budget") as string;
  const maxTravelersStr = formData.get("maxTravelers") as string;
  const paceLevel = formData.get("paceLevel") as string;
  const accessibilityNotes = ((formData.get("accessibilityNotes") as string) ?? "").trim();

  const fieldErrors: Record<string, string> = {};

  if (!title) fieldErrors.title = "Trip title is required";
  if (!destination) fieldErrors.destination = "Destination is required";
  if (!startDateStr) fieldErrors.startDate = "Start date is required";
  if (!endDateStr) fieldErrors.endDate = "End date is required";
  if (!budgetStr) fieldErrors.budget = "Budget is required";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const budgetInr = parseInt(budgetStr, 10);
  const maxTravelers = parseInt(maxTravelersStr || "20", 10);

  if (isNaN(startDate.getTime())) fieldErrors.startDate = "Invalid start date";
  if (isNaN(endDate.getTime())) fieldErrors.endDate = "Invalid end date";
  if (isNaN(budgetInr) || budgetInr <= 0)
    fieldErrors.budget = "Budget must be a positive number";
  if (endDate <= startDate)
    fieldErrors.endDate = "End date must be after start date";

  const dayCount =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;
  if (dayCount > 30) fieldErrors.endDate = "Trip cannot exceed 30 days";

  if (maxTravelers < 1 || maxTravelers > 20)
    fieldErrors.maxTravelers = "Travelers must be between 1 and 20";

  if (!["easy", "balanced", "full"].includes(paceLevel))
    fieldErrors.paceLevel = "Invalid pace level";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const matchedDestination = await findDestination(destination);

  const trip = await prisma.trip.create({
    data: {
      title,
      destination,
      startDate,
      endDate,
      budgetInr,
      maxTravelers,
      paceLevel,
      status: "draft",
      creatorId: session.user.id,
      destinationId: matchedDestination?.id ?? null,
      groupMembers: {
        create: {
          userId: session.user.id,
          role: "creator",
          accessibilityNotes,
        },
      },
    },
  });

  redirect(`/trips/${trip.id}`);
}
