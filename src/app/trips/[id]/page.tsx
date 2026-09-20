import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { GenerateButton } from "./generate-button";
import { ExportButton } from "./export-button";

import { ReplanPanel } from "./replan-panel";
import { formatTripDates, getTripCountdownStatus, getTripStartEndDateTimes } from "@/lib/date-utils";
import { SortableDay } from "@/components/itinerary";
import DynamicMap from "@/components/ui/dynamic-map";
import { Plane, Train, Car, Calendar, ArrowRight, Bed, MapPin, ArrowLeft } from "lucide-react";
import { AddTransitButton, AddStayButton } from "@/components/ui/logistics-buttons";
import { RecentTracker } from "@/components/ui/recent-tracker";
import {
  PageShell,
  PageHeader,
  SectionHeading,
  Card,
  Badge,
  EmptyState,
  Figure,
  formatInr,
  buttonStyles,
} from "@/components/ui";

export default async function TripPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: { include: { user: true } },
      itineraryDays: {
        orderBy: { dayNumber: "asc" },
        include: { 
          items: { 
            orderBy: { order: "asc" },
            include: {
              place: { select: { area: true, lat: true, lng: true } },
              votes: true,
              comments: true,
            }
          } 
        },
      },
      travelSegments: true,
      tripAccommodations: true,
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

  const { startDateTime, endDateTime } = getTripStartEndDateTimes(trip);
  let availableHours = 0;
  if (startDateTime && endDateTime) {
    availableHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
  }
  const isShortTrip = availableHours > 0 && availableHours < 36;

  return (
    <PageShell>
      <RecentTracker type="VIEW_TRIP" tripId={trip.id} />
      <PageHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        title={trip.title}
        subtitle={trip.destination}
        meta={
          <>
            <span>
              <Figure>{formatTripDates(trip)}</Figure>
            </span>
            {getTripCountdownStatus(trip) && (
              <span className="text-lagoon-600 font-medium">
                {getTripCountdownStatus(trip)}
              </span>
            )}
            <span>
              Budget{" "}
              <Figure className="text-ink-700 font-medium">
                {formatInr(trip.budgetInr)}
              </Figure>
            </span>
            <span className="capitalize">{trip.paceLevel} pace</span>
          </>
        }
      />

      
      <div className="mb-8">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500 mb-2">
          Members
        </p>
        <div className="flex flex-wrap gap-2">
          {trip.groupMembers.map((m) => (
            <Badge key={m.id} tone="neutral" className="px-3 py-1">
              {m.user.name}
              {m.role === "creator" && (
                <span className="text-ink-400 ml-1">(creator)</span>
              )}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mb-8">
        
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider flex items-center gap-2">
              <Plane className="w-4 h-4" /> Transit
            </h3>
            <AddTransitButton tripId={trip.id} />
          </div>
          
          {trip.travelSegments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <p className="text-sm text-ink-400">No transit added yet.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider flex items-center gap-2">
              <Bed className="w-4 h-4" /> Stays
            </h3>
            <AddStayButton tripId={trip.id} />
          </div>
          
          {trip.tripAccommodations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trip.tripAccommodations.map(ac => (
                <Card key={ac.id} className="p-4 flex gap-4 items-start bg-white border-ink-100 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-ember-50 text-ember-600 flex items-center justify-center shrink-0">
                    <Bed className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-900 text-sm truncate">{ac.name}</div>
                    {ac.location && <div className="text-xs text-ink-500 mt-1 flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0"/> <span className="truncate">{ac.location}</span></div>}
                    <div className="text-xs text-ink-500 mt-2 flex flex-col gap-1">
                      <span className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-ink-400 shrink-0" /> <span className="truncate">Check-in: {ac.checkInDate && new Date(ac.checkInDate).toLocaleDateString()}</span></span>
                      <span className="flex items-center gap-1.5"><ArrowLeft className="w-3 h-3 text-ink-400 shrink-0" /> <span className="truncate">Check-out: {ac.checkOutDate && new Date(ac.checkOutDate).toLocaleDateString()}</span></span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-400">No stays added yet.</p>
          )}
        </div>
      </div>
      <SectionHeading
        actions={
          <>
            <Link
              href={`/trips/${trip.id}/preferences`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Preferences
            </Link>
            <Link
              href={`/trips/${trip.id}/packing`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Packing
            </Link>
            <Link
              href={`/trips/${trip.id}/stay`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Stay
            </Link>
            <ExportButton tripId={trip.id} tripName={trip.title} />
            
            {trip.itineraryDays.length > 0 && (
              <>
                <Link
                  href={`/trips/${trip.id}/route`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Route
                </Link>
                <Link
                  href={`/trips/${trip.id}/budget`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Budget
                </Link>
              </>
            )}
            <GenerateButton tripId={trip.id} />
          </>
        }
      >
        Itinerary
      </SectionHeading>

      {trip.itineraryDays.length === 0 || trip.itineraryDays.every((d) => d.items.length === 0) ? (
        trip.status === "draft" ? (
          <EmptyState
            title="No itinerary generated yet"
            hint={'Click "Generate Itinerary" to create one.'}
          />
        ) : (
          <EmptyState
            title="Time window too short"
            hint="No activities fit within this short time window. Try widening your time range."
          />
        )
      ) : (
        <div className="space-y-10">
          <p className="text-[0.8125rem] text-ink-500">
            Estimated total{" "}
            <Figure className="text-ink-700 font-medium">
              {formatInr(totalCost)}
            </Figure>{" "}
            of <Figure>{formatInr(trip.budgetInr)}</Figure> budget
          </p>

          {trip.itineraryDays.map((day) => (
            <section key={day.id}>
              <h3 className="font-display text-lg font-semibold text-ink-800 mb-3">
                {trip.itineraryDays.length > 1 && `Day ${day.dayNumber}`}
                <span className={trip.itineraryDays.length > 1 ? "text-ink-500 font-sans text-[0.875rem] font-normal ml-2" : "text-ink-800"}>
                  {new Date(day.date).toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </h3>

              <SortableDay day={day} tripId={trip.id} isShortTrip={isShortTrip} />
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
