import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasTripRole } from "@/lib/security";
import { mapProvider } from "@/lib/providers/maps";

function parseTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;
  const { dayId, items } = await req.json();

  if (!dayId || !items || !Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { id },
  });

  if (!trip) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await hasTripRole(id, "member");
  if (!isMember) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch current items
  const currentItems = await prisma.itineraryItem.findMany({
    where: { itineraryDayId: dayId },
    include: { place: true },
    orderBy: { order: "asc" }
  });

  if (currentItems.length === 0) return NextResponse.json({ success: true });

  // 2. Map new order
  const newOrderIds = items.sort((a: { order: number }, b: { order: number }) => a.order - b.order).map((i: { id: string }) => i.id);
  const reorderedItems = newOrderIds.map(itemId => currentItems.find(i => i.id === itemId)).filter(Boolean) as typeof currentItems;

  if (reorderedItems.length !== currentItems.length) {
    return NextResponse.json({ error: "Item count mismatch" }, { status: 400 });
  }

  // 3. Start time from the first item originally (or 09:00)
  let currentMins = parseTime(currentItems[0].startTime || "09:00");
  
  const updates = [];

  for (let i = 0; i < reorderedItems.length; i++) {
    const item = reorderedItems[i];
    
    // Add travel time from previous item if possible
    if (i > 0) {
      const prevItem = reorderedItems[i - 1];
      if (prevItem.place?.lat && prevItem.place?.lng && item.place?.lat && item.place?.lng) {
        const dist = mapProvider.calculateDistance(
          { lat: prevItem.place.lat, lng: prevItem.place.lng },
          { lat: item.place.lat, lng: item.place.lng }
        );
        // Rough estimate: 30 km/h average in city -> 2 min per km
        const travelMins = Math.max(15, Math.ceil(dist * 2));
        currentMins += travelMins;
      } else {
        currentMins += 30; // default travel/buffer
      }
    }

    // Check opening hours
    if (item.place?.openingTime) {
      const openMins = parseTime(item.place.openingTime);
      if (currentMins < openMins) {
        currentMins = openMins; // Wait until it opens
      }
    }

    const durationMins = parseTime(item.endTime || "10:00") - parseTime(item.startTime || "09:00");
    const safeDuration = durationMins > 0 ? durationMins : 60;

    const newStartTime = formatTime(currentMins);
    currentMins += safeDuration;
    const newEndTime = formatTime(currentMins);

    // Validate closing hours
    if (item.place?.closingTime) {
      const closeMins = parseTime(item.place.closingTime);
      if (currentMins > closeMins) {
        return NextResponse.json({ 
          error: `Cannot reorder: ${item.title} would close before or during your visit (closes at ${item.place.closingTime}).` 
        }, { status: 400 });
      }
    }

    updates.push({
      id: item.id,
      order: i,
      startTime: newStartTime,
      endTime: newEndTime,
    });
  }

  try {
    await prisma.$transaction(
      updates.map(u => 
        prisma.itineraryItem.update({
          where: { id: u.id },
          data: { order: u.order, startTime: u.startTime, endTime: u.endTime }
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder items", error);
    return NextResponse.json({ error: "Failed to reorder items" }, { status: 500 });
  }
}
