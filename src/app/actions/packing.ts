"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { weatherProvider } from "@/lib/providers/weather";
import { generateIntelligentPackingList } from "@/lib/packing";
import { getTripDuration } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";
import { canEditTrip, roleIn } from "@/lib/security";

export async function generatePacking(tripId: string) {

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { groupMembers: true },
  });
  if (!trip) throw new Error("Trip not found");

  const role = roleIn(trip.groupMembers, session.user!.id);
  if (!role) throw new Error("Not a member of this trip");
  if (!canEditTrip(role)) throw new Error("Viewers cannot modify this trip");

  const durationDays = getTripDuration(trip, 3);

  const accessibilityNotes = trip.groupMembers
    .map((m) => m.accessibilityNotes)
    .filter((note) => note.length > 0)
    // Flatten if notes are strings, but actually they are already joined or single strings
    // Wait, accessibilityNotes might be strings like "wheelchair"
    .reduce((acc, note) => {
      // Split by comma if needed, or just push
      if (note) acc.push(...note.split(',').map(s => s.trim()));
      return acc;
    }, [] as string[]);

  // Fetch weather forecast
  let weather: import("@/lib/providers/weather").WeatherForecast[] = [];
  try {
    const destination = await prisma.travelDestination.findFirst({
      where: { name: trip.destination }
    });
    
    if (destination) {
      const today = new Date();
      // If trip is in the past or unknown dates, use next week for typical weather
      const start = trip.startDate || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const end = trip.endDate || new Date(start.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);
      weather = await weatherProvider.getForecast(destination.lat, destination.lng, start, end);
    }
  } catch (err) {
    console.error("Failed to fetch weather for packing list:", err);
  }

  await prisma.packingItem.deleteMany({ where: { tripId } });

  const items = await generateIntelligentPackingList({ 
    durationDays, 
    accessibilityNotes,
    destinationName: trip.destination,
    weather
  });

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

  const role = roleIn(item.trip.groupMembers, session.user!.id);
  if (!role) throw new Error("Not a member of this trip");
  if (!canEditTrip(role)) throw new Error("Viewers cannot modify this trip");

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

  const role = roleIn(item.trip.groupMembers, session.user!.id);
  if (!role) throw new Error("Not a member of this trip");
  if (!canEditTrip(role)) throw new Error("Viewers cannot modify this trip");

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

  const role = roleIn(trip.groupMembers, session.user!.id);
  if (!role) throw new Error("Not a member of this trip");
  if (!canEditTrip(role)) throw new Error("Viewers cannot modify this trip");

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
