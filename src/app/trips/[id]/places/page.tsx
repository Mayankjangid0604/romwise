import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { PlaceBrowser, PlaceDTO, PlaceSelectionStatus } from "./place-browser";
import { MapPin } from "lucide-react";
import { Prisma } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import { NOT_TRANSIT_WHERE } from "@/lib/transit-filter";

export default async function PlacesPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ q?: string, category?: string, page?: string, status?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const [tripRow, groupMembers, tripPlaceSelections] = await Promise.all([
    prisma.trip.findUnique({ where: { id } }),
    prisma.groupMember.findMany({ where: { tripId: id }, select: { userId: true } }),
    prisma.tripPlaceSelection.findMany({ where: { tripId: id } }),
  ]);
  const trip = tripRow ? { ...tripRow, groupMembers, tripPlaceSelections } : null;

  const isCreator = trip?.creatorId === session.user.id;
  const isMember = trip?.groupMembers.some((m) => m.userId === session.user!.id);

  if (!trip || (!isCreator && !isMember)) notFound();

  // A trip whose destination text didn't match a known destination has no place catalogue
  // yet. This used to 404 the whole tab (e.g. every trip created from a template).
  if (!trip.destinationId) {
    return (
      <EmptyState
        title="No place catalogue for this destination yet"
        hint={`We couldn't match "${trip.destination}" to a destination in our database. Generate the itinerary (it links the destination when it can), or create the trip from Discover to pick a known destination.`}
      />
    );
  }

  const q = searchParams.q || "";
  const category = searchParams.category || "all";
  const statusFilter = searchParams.status || "all";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = 24;

  const whereCondition: Prisma.PlaceWhereInput = {
    destinationId: trip.destinationId,
    category: category !== "all" ? category : { notIn: ["stay", "transport"] },
    // Stations/bus stands/airports aren't places to visit, whatever category an importer gave them
    AND: [NOT_TRANSIT_WHERE],
  };

  if (q) {
    whereCondition.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { area: { contains: q, mode: "insensitive" } }
    ];
  }

  // Handle status filter by joining against tripPlaceSelections
  if (statusFilter !== "all") {
    if (statusFilter === "none") {
      whereCondition.tripPlaceSelections = { none: { tripId: id } };
    } else {
      whereCondition.tripPlaceSelections = { some: { tripId: id, status: statusFilter } };
    }
  }

  // Fetch paginated top places for this destination
  // Categories for the dropdown load alongside the page of results (was a separate
  // sequential query after them).
  const [totalCount, dbPlaces, categoriesRaw] = await Promise.all([
    prisma.place.count({ where: whereCondition }),
    prisma.place.findMany({
      where: whereCondition,
      orderBy: { popularityScore: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        area: true,
        typicalCostInr: true,
        durationMinutes: true,
        accessibilityScore: true,
        fatigueCost: true
      }
    }),
    prisma.place.findMany({
      where: { destinationId: trip.destinationId, category: { notIn: ["stay", "transport"] }, AND: [NOT_TRANSIT_WHERE] },
      distinct: ['category'],
      select: { category: true }
    }),
  ]);

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

  const categories = categoriesRaw.map(c => c.category).sort();

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
      
      <PlaceBrowser 
        tripId={id} 
        initialPlaces={places} 
        categories={categories} 
        initialSearch={q}
        initialCategory={category}
        initialStatus={statusFilter}
        currentPage={page}
        totalPages={Math.ceil(totalCount / pageSize)}
      />
    </div>
  );
}
