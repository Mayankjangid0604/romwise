import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { RecentTracker } from "@/components/ui/recent-tracker";
import { Plane, Train, Car, Calendar, ArrowRight, Bed, MapPin, ArrowLeft, ArrowUpRight } from "lucide-react";
import { AddTransitButton, AddStayButton } from "@/components/ui/logistics-buttons";
import {
  Card,
  Badge,
  Figure,
  formatInr,
  buttonStyles,
} from "@/components/ui";

export default async function TripOverviewPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: { include: { user: true } },
      travelSegments: true,
      tripAccommodations: true,
      itineraryDays: {
        include: {
          items: true,
        }
      }
    },
  });

  if (!trip) redirect("/dashboard");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) redirect("/dashboard");

  const totalCost = trip.itineraryDays.reduce(
    (sum, day) =>
      sum + day.items.reduce((daySum, item) => daySum + (item.estimatedCostInr ?? 0), 0),
    0,
  );
  
  const hasItinerary = trip.itineraryDays.length > 0 && trip.itineraryDays.some(d => d.items.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <RecentTracker type="VIEW_TRIP" tripId={trip.id} />
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
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
              {trip.groupMembers.length} {trip.groupMembers.length === 1 ? 'traveler' : 'travelers'} • {trip.paceLevel} pace
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
                <p className="text-ink-700">You have activities planned across {trip.itineraryDays.length} days.</p>
                <div className="flex items-center gap-2 text-ink-500">
                  <div className="w-2 h-2 rounded-full bg-lagoon-400"></div>
                  {trip.itineraryDays.reduce((sum, day) => sum + day.items.length, 0)} places to visit
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
          
          {trip.travelSegments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {trip.travelSegments.map(ts => (
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
          
          {trip.tripAccommodations.length > 0 ? (
            <div className="flex flex-col gap-3">
              {trip.tripAccommodations.map(ac => (
                <Card key={ac.id} className="p-4 flex gap-4 items-start bg-white border-ink-100 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-ember-50 text-ember-600 flex items-center justify-center shrink-0">
                    <Bed className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="font-semibold text-ink-900 text-sm truncate">{ac.name}</div>
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
              <p className="text-sm text-ink-500 mb-3">No stays added yet.</p>
              <AddStayButton tripId={trip.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
