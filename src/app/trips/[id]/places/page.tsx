import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { PlaceBrowser, PlaceDTO, PlaceSelectionStatus } from "./place-browser";
import { MapPin } from "lucide-react";

export default async function PlacesPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: true,
      tripPlaceSelections: true
    }
  });

  const isCreator = trip?.creatorId === session.user.id;
  const isMember = trip?.groupMembers.some((m) => m.userId === session.user!.id);

  if (!trip || (!isCreator && !isMember) || !trip.destinationId) notFound();

  // Fetch all places for this destination
  const dbPlaces = await prisma.place.findMany({
    where: { destinationId: trip.destinationId },
    orderBy: { popularityScore: 'desc' }
  });

  // Map to DTO
  const places: PlaceDTO[] = dbPlaces.map(p => {
    const selection = trip.tripPlaceSelections.find(s => s.placeId === p.id);
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      area: p.area,
      typicalCostInr: p.typicalCostInr,
      durationMinutes: p.durationMinutes,
      accessibilityScore: p.accessibilityScore,
      fatigueCost: p.fatigueCost,
      selectionStatus: (selection?.status as PlaceSelectionStatus) || null
    };
  });

  const categories = Array.from(new Set(dbPlaces.map(p => p.category))).sort();

  return (
    <div className="space-y-6 animate-fade-up pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-lagoon-100 flex items-center justify-center text-lagoon-700">
          <MapPin className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-ink-900">Place Browser</h1>
          <p className="text-ink-500">Discover and select places to include or exclude from your trip schedule.</p>
        </div>
      </div>
      
      <PlaceBrowser tripId={id} initialPlaces={places} categories={categories} />
    </div>
  );
}
