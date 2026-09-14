import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  optimizeRoute,
  syntheticCoordinates,
  type RouteStop,
} from "@/lib/route-optimizer";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  Stat,
  EmptyState,
  Figure,
  cn,
} from "@/components/ui";

export default async function RoutePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;
  const { day: dayParam } = await props.searchParams;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: true,
      destinationRef: true,
      itineraryDays: {
        orderBy: { dayNumber: "asc" },
        include: { items: { orderBy: { order: "asc" }, include: { place: true } } },
      },
    },
  });

  if (!trip) redirect("/dashboard");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) redirect("/dashboard");

  if (trip.itineraryDays.length === 0) {
    return (
      <PageShell>
        <PageHeader backHref={`/trips/${id}`} backLabel="Trip" title="Route" />
        <EmptyState
          title="No itinerary generated yet"
          hint="Generate one first to see an optimized route."
        />
      </PageShell>
    );
  }

  const selectedDay = dayParam ? parseInt(dayParam, 10) : 1;
  const dayData = trip.itineraryDays.find((d) => d.dayNumber === selectedDay);

  if (!dayData) redirect(`/trips/${id}/route?day=1`);

  const center = trip.destinationRef
    ? { lat: trip.destinationRef.lat, lng: trip.destinationRef.lng }
    : undefined;

  const stops: RouteStop[] = dayData.items.map((item) => {
    const realCoords =
      item.place?.lat != null && item.place?.lng != null
        ? { lat: item.place.lat, lng: item.place.lng }
        : null;
    const coords = realCoords ?? syntheticCoordinates(item.title, item.category, center);
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      startTime: item.startTime,
      endTime: item.endTime,
      order: item.order,
      lat: coords.lat,
      lng: coords.lng,
    };
  });

  const result = optimizeRoute(stops);

  return (
    <PageShell>
      <PageHeader
        backHref={`/trips/${id}`}
        backLabel="Trip"
        eyebrow={trip.title}
        title="Route"
      />

      <div className="flex flex-wrap gap-2 mb-8">
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
        <EmptyState title="No items for this day" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <RouteColumn
              heading="Original Order"
              stops={result.originalOrder}
              totalKm={result.originalTotalKm}
              totalMinutes={result.originalTotalMinutes}
              tone="neutral"
            />
            <RouteColumn
              heading="Optimized Order"
              stops={result.optimizedOrder}
              totalKm={result.optimizedTotalKm}
              totalMinutes={result.optimizedTotalMinutes}
              tone="optimized"
            />
          </div>
        </div>
      )}
    </PageShell>
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
