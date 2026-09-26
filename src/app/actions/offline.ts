"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Data for "Save for Offline", fetched only when the user clicks the button.
 *
 * Previously the whole overview `trip` object was passed to the client button on
 * every page view — which serialized every member's full User row (incl. password
 * hash) into the HTML, and, after the overview query was slimmed down, no longer
 * contained the itinerary titles the snapshot needs. This returns just the fields
 * `createOfflineTripSnapshot` reads, for trip members only.
 */
export async function getOfflineTripData(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, groupMembers: { some: { userId: session.user.id } } },
    select: {
      id: true,
      updatedAt: true,
      title: true,
      destination: true,
      startDate: true,
      endDate: true,
      itineraryDays: {
        orderBy: { dayNumber: "asc" },
        select: {
          id: true,
          dayNumber: true,
          date: true,
          items: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              startTime: true,
              place: { select: { address: true, area: true } },
            },
          },
        },
      },
      packingItems: { select: { id: true, label: true, checked: true } },
    },
  });

  return trip;
}
