import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { RecentTracker } from "@/components/ui/recent-tracker";
import { TripProgress } from "@/components/ui/trip-progress";
import { DeleteTripButton } from "./delete-trip-button";
import { Plane, Train, Car, Calendar, ArrowRight, Bed, MapPin, ArrowUpRight, FileText, Share2, Users } from "lucide-react";
import { AddTransitButton, AddStayButton } from "@/components/ui/logistics-buttons";
import { OfflineSaveButton } from "@/components/ui/offline-save-button";
import {
  Card,
  Badge,
  Figure,
  formatInr,
  buttonStyles,
} from "@/components/ui";
import { imageProvider } from "@/lib/providers/images";
import { Suspense } from "react";
import { StaySuggestions, StaySuggestionsSkeleton } from "./stay-suggestions";

export default async function TripOverviewPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  // Independent queries run in parallel (one nested `include` tree ran ~8 sequential
  // round trips). Nothing is rendered until membership is confirmed below.
  // Users are selected by name only — never whole User rows (password hash, email).
  const [trip, groupMembers, travelSegments, tripAccommodations, packingCount, dayCount, itemStats] =
    await Promise.all([
      prisma.trip.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          destination: true,
          tripType: true,
          status: true,
          paceLevel: true,
          budgetInr: true,
          creatorId: true,
          startDate: true,
          endDate: true,
          destinationRef: { select: { id: true, slug: true, name: true, lat: true, lng: true, destinationType: true } },
        },
      }),
      prisma.groupMember.findMany({
        where: { tripId: id },
        select: { id: true, userId: true, user: { select: { name: true } } },
      }),
      prisma.travelSegment.findMany({ where: { tripId: id } }),
      prisma.tripAccommodation.findMany({ where: { tripId: id } }),
      prisma.packingItem.count({ where: { tripId: id } }),
      prisma.itineraryDay.count({ where: { tripId: id } }),
      prisma.itineraryItem.aggregate({
        where: { itineraryDay: { tripId: id } },
        _count: { _all: true },
        _sum: { estimatedCostInr: true },
      }),
    ]);

  if (!trip) redirect("/dashboard");

  const isMember = groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) redirect("/dashboard");

  const isCreator = trip.creatorId === session.user!.id;

  const totalCost = itemStats._sum.estimatedCostInr ?? 0;
  const itemCount = itemStats._count._all;
  const hasItinerary = dayCount > 0 && itemCount > 0;

  const destinationImage = await imageProvider.searchDestinationImage(trip.destination);

  return (
    <div className="space-y-8 animate-fade-up">
      <RecentTracker type="VIEW_TRIP" tripId={trip.id} />
      
      {/* Destination Hero */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden shadow-xl shadow-ink-900/10">
        {destinationImage ? (
          <img 
            src={destinationImage.url} 
            alt={trip.destination}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-lagoon-800 to-lagoon-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
        
        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <Badge tone="lagoon" className="bg-lagoon-500/20 text-white border-lagoon-500/30 backdrop-blur-md">
              {trip.tripType.replace("_", " ")}
            </Badge>
            <div className="flex flex-wrap gap-2">
              <OfflineSaveButton tripId={trip.id} userId={session.user.id} />
              <Link 
                href={`/trips/${trip.id}/live`} 
                className={buttonStyles({ variant: "secondary", size: "sm", className: "bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md gap-2" })}
              >
                Live Mode
              </Link>
              {/* Plain <a>, not next/link: <Link> prefetches on viewport/hover, which ran the
                  headless-Chromium PDF route handler on every overview visit. */}
              <a
                href={`/api/trips/${trip.id}/pdf`}
                target="_blank"
                rel="noopener"
                className={buttonStyles({ variant: "secondary", size: "sm", className: "bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md gap-2" })}
              >
                <FileText className="w-4 h-4" /> PDF
              </a>
              <Link
                href={`/trips/${trip.id}/print`}
                prefetch={false}
                className={buttonStyles({ variant: "secondary", size: "sm", className: "bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md gap-2" })}
              >
                Print
              </Link>
              {isCreator && (
                <DeleteTripButton tripId={trip.id} tripTitle={trip.title} />
              )}
            </div>
          </div>
          
          <div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-white mb-2 drop-shadow-md">
              {trip.title}
            </h1>
            <div className="flex items-center text-lagoon-50 gap-2 font-medium drop-shadow-sm">
              <MapPin className="w-5 h-5 text-lagoon-300" />
              <span>{trip.destination}</span>
            </div>
          </div>
        </div>

        {destinationImage && destinationImage.authorName && (
          <div className="absolute bottom-2 right-4 text-[0.65rem] text-white/60 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm flex flex-col items-end">
            <span>Photo by <a href={destinationImage.authorUrl} target="_blank" rel="noreferrer" className="underline hover:text-white">{destinationImage.authorName}</a> on <a href={destinationImage.sourceUrl || "#"} target="_blank" rel="noreferrer" className="underline hover:text-white">{destinationImage.source}</a></span>
            <span className="text-[0.60rem] opacity-75">{destinationImage.license || "License not recorded"}</span>
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Status / Quick Summary */}
        <Card className="p-6 bg-lagoon-50/50 border-lagoon-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider">Trip Status</h2>
              <Badge tone={trip.status === 'draft' ? 'neutral' : 'lagoon'} className="capitalize">
                {trip.status}
              </Badge>
            </div>
            <p className="text-ink-700 font-medium text-lg mb-2">
              {hasItinerary ? "Your itinerary is ready to go." : "Your trip is still in the planning phase."}
            </p>
            <p className="text-ink-500 text-sm">
              {groupMembers.length} {groupMembers.length === 1 ? 'traveler' : 'travelers'} • {trip.paceLevel} pace
            </p>
          </div>
          
          <div className="mt-6 pt-6 border-t border-lagoon-200/50 flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-500 uppercase tracking-wider font-semibold mb-1">Estimated Cost</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-ink-900"><Figure>{formatInr(totalCost)}</Figure></span>
                <span className="text-sm text-ink-500">/ <Figure>{formatInr(trip.budgetInr)}</Figure></span>
              </div>
            </div>
            <Link href={`/trips/${trip.id}/budget`} className="text-lagoon-600 hover:text-lagoon-700 p-2">
              <ArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
        </Card>

        {/* Itinerary Preview */}
        <Card className="p-6 flex flex-col justify-between bg-white">
          <div>
             <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider">Itinerary</h2>
            </div>
            {hasItinerary ? (
              <div className="space-y-4 text-sm">
                <p className="text-ink-700">You have activities planned across {dayCount} days.</p>
                <div className="flex items-center gap-2 text-ink-500">
                  <div className="w-2 h-2 rounded-full bg-lagoon-400"></div>
                  {itemCount} places to visit
                </div>
              </div>
            ) : (
              <div className="text-sm text-ink-600">
                <p className="mb-3">No day-by-day plan generated yet.</p>
                <p className="text-xs text-ink-400">Let AI craft a personalized itinerary based on your preferences.</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 pt-6 border-t border-ink-100">
            <Link href={`/trips/${trip.id}/itinerary`} className={buttonStyles({ className: "w-full shadow-sm shadow-ink-200" })}>
              {hasItinerary ? "View Full Itinerary" : "Generate Itinerary"}
            </Link>
          </div>
        </Card>

        {/* Trip Progress */}
        <Card className="p-6 bg-white flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-4">Trip Readiness</h2>
            <TripProgress
              hasItinerary={hasItinerary}
              hasPacking={packingCount > 0}
              hasBudget={trip.budgetInr > 0}
              hasGroup={groupMembers.length > 1}
              hasTransit={travelSegments.length > 0}
              hasStay={tripAccommodations.length > 0}
            />
          </div>
          {/* Group avatars */}
          <div className="mt-6 pt-6 border-t border-ink-100">
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {groupMembers.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="w-8 h-8 rounded-full bg-lagoon-100 border-2 border-white flex items-center justify-center text-xs font-semibold text-lagoon-700"
                    title={m.user.name}
                  >
                    {m.user.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                ))}
                {groupMembers.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-ink-200 border-2 border-white flex items-center justify-center text-xs font-semibold text-ink-600">
                    +{groupMembers.length - 5}
                  </div>
                )}
              </div>
              <Link
                href={`/trips/${trip.id}/group`}
                className="flex items-center gap-1 text-xs font-medium text-lagoon-600 hover:text-lagoon-700"
              >
                <Users className="w-3.5 h-3.5" />
                Manage
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Transit */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider flex items-center gap-2">
              <Plane className="w-4 h-4" /> Transit
            </h3>
            <AddTransitButton tripId={trip.id} />
          </div>
          
          {travelSegments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {travelSegments.map(ts => (
                <Card key={ts.id} className="p-4 flex gap-4 items-center bg-white border-ink-100 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-lagoon-50 text-lagoon-600 flex items-center justify-center shrink-0">
                    {ts.mode === "FLIGHT" ? <Plane className="w-5 h-5" /> : ts.mode === "TRAIN" ? <Train className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-900 text-sm truncate">
                      {ts.originName || "Origin"} <ArrowRight className="w-3 h-3 inline mx-1 text-ink-400" /> {ts.destinationName || "Destination"}
                    </div>
                    <div className="text-xs text-ink-500 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 shrink-0" /> <span className="truncate">{ts.departureDate && new Date(ts.departureDate).toLocaleDateString()} {ts.departureTime || ""}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-6 border border-dashed border-ink-200 rounded-xl text-center bg-ink-50/50">
              <p className="text-sm text-ink-500 mb-3">No transit added yet.</p>
              <AddTransitButton tripId={trip.id} />
            </div>
          )}
        </div>

        {/* Stays */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider flex items-center gap-2">
              <Bed className="w-4 h-4" /> Stays
            </h3>
            <AddStayButton tripId={trip.id} />
          </div>
          
          {tripAccommodations.length > 0 ? (
            <div className="flex flex-col gap-3">
              {tripAccommodations.map(ac => (
                <Card key={ac.id} className="p-4 flex gap-4 items-start bg-white border-ink-100 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-ember-50 text-ember-600 flex items-center justify-center shrink-0">
                    <Bed className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="font-semibold text-ink-900 text-sm truncate flex items-center gap-2">
                      <span className="truncate">{ac.name}</span>
                      {ac.selectionRef?.startsWith("sample:") && <Badge tone="caution">Sample</Badge>}
                    </div>
                    {ac.costPerNightInr != null && (
                      <div className="text-xs text-ink-500 mt-1">
                        <Figure>{formatInr(ac.costPerNightInr)}</Figure>/night
                        {ac.totalCostInr != null && <> · <Figure>{formatInr(ac.totalCostInr)}</Figure> total</>}
                      </div>
                    )}
                    {ac.location && <div className="text-xs text-ink-500 mt-1 flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0"/> <span className="truncate">{ac.location}</span></div>}
                    <div className="text-xs text-ink-500 mt-3 grid grid-cols-2 gap-2 bg-ink-50 p-2 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400 mb-0.5">Check-in</span>
                        <span className="truncate text-ink-700 font-medium">{ac.checkInDate ? new Date(ac.checkInDate).toLocaleDateString() : 'TBD'}</span>
                      </div>
                      <div className="flex flex-col border-l border-ink-200 pl-2">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400 mb-0.5">Check-out</span>
                        <span className="truncate text-ink-700 font-medium">{ac.checkOutDate ? new Date(ac.checkOutDate).toLocaleDateString() : 'TBD'}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-6 border border-dashed border-ink-200 rounded-xl text-center bg-ink-50/50">
              <p className="text-sm text-ink-500 mb-3">No stays added yet. Pick a suggested hotel below or add your own.</p>
              <AddStayButton tripId={trip.id} />
            </div>
          )}

          {/* Compact hotel suggestions from the Stay tab's ranking; streams in separately */}
          <div className="mt-4">
            <Suspense fallback={<StaySuggestionsSkeleton />}>
              <StaySuggestions
                trip={trip}
                selectedRef={tripAccommodations.find((a) => a.selectionRef !== null)?.selectionRef ?? null}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
