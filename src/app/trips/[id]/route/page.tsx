import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  optimizeRoute,
  buildRouteStops,
  type RouteStop,
} from "@/lib/route-optimizer";
import {
  buildJourneyLegs,
  suggestTransportModes,
  type JourneyStop,
} from "@/lib/journey";
import { resolveDestination } from "@/lib/destination-resolver";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  Stat,
  EmptyState,
  Figure,
  Badge,
  cn,
} from "@/components/ui";
import DynamicMap from "@/components/ui/dynamic-map";

export default async function RoutePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;
  const { day: dayParam } = await props.searchParams;

  // Parallel flat queries instead of one nested include tree (Prisma resolves each
  // relation level as a separate sequential round trip). Same `trip` shape as before.
  const [tripRow, groupMembers, itineraryDays] = await Promise.all([
    prisma.trip.findUnique({ where: { id }, include: { destinationRef: true } }),
    prisma.groupMember.findMany({ where: { tripId: id }, select: { userId: true } }),
    prisma.itineraryDay.findMany({
      where: { tripId: id },
      orderBy: { dayNumber: "asc" },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { place: { select: { lat: true, lng: true } } },
        },
      },
    }),
  ]);

  if (!tripRow) redirect("/dashboard");
  const trip = { ...tripRow, groupMembers, itineraryDays };

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) redirect("/dashboard");

  if (trip.itineraryDays.length === 0) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        <EmptyState
          title="No itinerary generated yet"
          hint="Generate one first to see an optimized route."
        />
      </div>
    );
  }

  // ── Intercity Journey Plan ─────────────────────────────────────────────────
  // Build the journey legs from waypoints for the journey overview
  const waypointNames: string[] = [];
  if (trip.waypoints) {
    try {
      const parsed = JSON.parse(trip.waypoints);
      if (Array.isArray(parsed)) waypointNames.push(...parsed.filter((w: unknown): w is string => typeof w === "string"));
    } catch { /* ignore */ }
  }

  // Resolve origin — use returnDestination or fall back to first waypoint concept
  // Resolve the return point and every waypoint concurrently (was one await per stop)
  const [resolvedReturn, ...resolvedWaypoints] = await Promise.all([
    trip.returnDestination ? resolveDestination(trip.returnDestination) : Promise.resolve(null),
    ...waypointNames.map((wp) => resolveDestination(wp)),
  ]);
  const originStop: JourneyStop | null = resolvedReturn
    ? { name: resolvedReturn.name, lat: resolvedReturn.lat, lng: resolvedReturn.lng }
    : null;

  // Resolve all destinations in order
  const destinationStops: JourneyStop[] = [];
  // Primary destination
  if (trip.destinationRef) {
    destinationStops.push({ name: trip.destinationRef.name, lat: trip.destinationRef.lat, lng: trip.destinationRef.lng });
  }
  // Waypoints (order preserved)
  for (const resolved of resolvedWaypoints) {
    if (resolved) destinationStops.push({ name: resolved.name, lat: resolved.lat, lng: resolved.lng });
  }

  const journeyPlan = destinationStops.length > 0
    ? buildJourneyLegs(originStop, destinationStops, trip.isRoundTrip)
    : null;

  // ── Day Route ─────────────────────────────────────────────────────────────

  // Unknown/invalid ?day= falls back to the first day in place (a redirect to
  // ?day=1 would loop forever if the trip has no day numbered 1).
  const requestedDay = dayParam ? parseInt(dayParam, 10) : NaN;
  const dayData =
    trip.itineraryDays.find((d) => d.dayNumber === requestedDay) ?? trip.itineraryDays[0];
  const selectedDay = dayData.dayNumber;

  // Built from the day's current items on every request, so places added after
  // generation are included in the optimization.
  const stops: RouteStop[] = buildRouteStops(dayData.items);
  const unmappedCount = dayData.items.length - stops.length;

  const result = optimizeRoute(stops);

  const mapCenter = stops.length > 0 ? { lat: stops[0].lat, lng: stops[0].lng } : undefined;
  const mapMarkers = stops.map(s => ({ lat: s.lat, lng: s.lng, label: s.title, subtitle: s.category }));
  const mapRoute = result.optimizedOrder.map(s => ({ lat: s.lat, lng: s.lng }));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out space-y-6">
      {/* Journey Overview (intercity) */}
      {journeyPlan && journeyPlan.legs.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-display text-lg font-semibold text-ink-800">Journey Overview</h2>
            <Badge tone="lagoon">{journeyPlan.routeType.replace("_", " ")}</Badge>
          </div>
          <div className="space-y-2">
            {journeyPlan.legs.map((leg) => (
              <div key={leg.legNumber} className="flex items-center gap-3 text-[0.8125rem]">
                <span className="w-5 h-5 shrink-0 rounded-full bg-ink-100 flex items-center justify-center text-[0.625rem] font-mono font-medium text-ink-600">
                  {leg.legNumber}
                </span>
                <span className="text-ink-800 font-medium">{leg.originName}</span>
                <span className="text-ink-400">→</span>
                <span className="text-ink-800 font-medium">{leg.destinationName}</span>
                {leg.distanceKm != null && (
                  <>
                    <span className="text-ink-300">·</span>
                    <Figure>{leg.distanceKm.toFixed(0)} km</Figure>
                  </>
                )}
                {leg.suggestedModes.length > 0 && (
                  <span className="text-ink-400 text-[0.75rem]">
                    ({leg.suggestedModes.join(" / ")})
                  </span>
                )}
                {leg.isReturn && <Badge tone="neutral">Return</Badge>}
              </div>
            ))}
          </div>
          {journeyPlan.totalDistanceKm != null && (
            <p className="text-[0.75rem] text-ink-400 mt-3 pt-2 border-t border-ink-100">
              Total approximate distance: <Figure>{journeyPlan.totalDistanceKm.toFixed(0)} km</Figure>
              <span className="ml-2 text-ink-300">(straight-line estimate)</span>
            </p>
          )}
        </Card>
      )}

      {/* Day Selector */}
      <div className="flex flex-wrap gap-2">
        {trip.itineraryDays.map((d) => (
          <Link
            key={d.dayNumber}
            href={`/trips/${id}/route?day=${d.dayNumber}`}
            className={cn(
              "rounded-control px-3.5 h-9 inline-flex items-center text-[0.8125rem] font-medium transition-colors",
              d.dayNumber === selectedDay
                ? "bg-lagoon-600 text-white"
                : "bg-white border border-ink-200 text-ink-600 hover:bg-ink-100 hover:text-ink-800",
            )}
          >
            Day {d.dayNumber}
          </Link>
        ))}
      </div>

      {stops.length === 0 ? (
        <EmptyState
          title="No mappable activities for this day"
          hint="Route mapping requires activities linked to known places with GPS coordinates. Activities without a verified place location (e.g. free-text items added manually) cannot be plotted. Try regenerating the itinerary, or edit manual items to link them to a known place."
        />
      ) : (
        <div className="space-y-6">
          {result.backtracking.detected && (
            <Alert tone="caution" title="Backtracking detected">
              <p>{result.backtracking.description}</p>
              <ul className="mt-2 space-y-1">
                {result.backtracking.segments.map((seg, i) => (
                  <li key={i} className="text-[0.75rem]">
                    {seg.issue}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="Original"
              value={`${result.originalTotalKm.toFixed(1)} km`}
            />
            <Stat
              label="Optimized"
              value={`${result.optimizedTotalKm.toFixed(1)} km`}
              tone="positive"
            />
            {result.distanceSavedKm > 0 ? (
              <Stat
                label="Saved"
                value={`${result.distanceSavedKm.toFixed(1)} km`}
                detail={`${result.timeSavedMinutes} min faster`}
              />
            ) : (
              <Stat label="Saved" value="Already optimal" tone="muted" />
            )}
          </div>

          <p className="text-[0.75rem] text-ink-500">
            Optimizing <Figure>{stops.length}</Figure> of <Figure>{dayData.items.length}</Figure> stops
            for Day {selectedDay}
            {unmappedCount > 0 && (
              <> — {unmappedCount} custom {unmappedCount === 1 ? "activity has" : "activities have"} no map location and {unmappedCount === 1 ? "is" : "are"} not routed</>
            )}
            .{" "}
            <Link href={`/trips/${id}/itinerary`} className="text-lagoon-600 hover:text-lagoon-800 font-medium">
              Add or reorder places in the itinerary
            </Link>
          </p>

          {mapCenter && (
            <div className="h-[400px] sm:h-[500px]">
              <DynamicMap 
                center={mapCenter} 
                markers={mapMarkers} 
                route={mapRoute} 
                height="100%" 
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <RouteColumn
              heading="Original Order"
              stops={result.originalOrder}
              totalKm={result.originalTotalKm}
              totalMinutes={result.originalTotalMinutes}
              tone="neutral"
            />
            <RouteColumn
              heading="Estimated Optimal Order"
              stops={result.optimizedOrder}
              totalKm={result.optimizedTotalKm}
              totalMinutes={result.optimizedTotalMinutes}
              tone="optimized"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RouteColumn({
  heading,
  stops,
  totalKm,
  totalMinutes,
  tone,
}: {
  heading: string;
  stops: RouteStop[];
  totalKm: number;
  totalMinutes: number;
  tone: "neutral" | "optimized";
}) {
  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink-800 mb-4">
        {heading}
      </h2>
      <ol className="space-y-3">
        {stops.map((stop, i) => (
          <li key={stop.id} className="flex items-start gap-3">
            <span
              className={cn(
                "w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-mono text-[0.6875rem] font-medium",
                tone === "optimized"
                  ? "bg-lagoon-100 text-lagoon-800"
                  : "bg-ink-100 text-ink-600",
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[0.875rem] font-medium text-ink-800">
                {stop.title}
              </p>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">
                <Figure>
                  {stop.startTime}&ndash;{stop.endTime}
                </Figure>
                <span className="mx-1.5 text-ink-300">&middot;</span>
                <span className="capitalize">{stop.category}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[0.75rem] text-ink-400 mt-4 pt-3 border-t border-ink-100">
        Total <Figure>{totalKm.toFixed(1)} km</Figure>
        <span className="mx-1.5 text-ink-300">&middot;</span>
        <Figure>{totalMinutes} min</Figure> travel
      </p>
    </Card>
  );
}
