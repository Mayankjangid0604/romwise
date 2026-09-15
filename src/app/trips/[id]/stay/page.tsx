import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { rankHotels } from "@/lib/stay";
import { computeBudgetSummary, type BudgetItem } from "@/lib/budget";
import { HotelSelectButton, HotelRemoveButton } from "./stay-actions";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  Badge,
  Figure,
  formatInr,
} from "@/components/ui";

export default async function StayPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: true,
      staySelection: true,
      destinationRef: true,
      itineraryDays: {
        include: { items: true },
      },
    },
  });

  if (!trip) redirect("/dashboard");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) redirect("/dashboard");

  const nights =
    Math.ceil(
      (trip.endDate.getTime() - trip.startDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

  const budgetItems: BudgetItem[] = trip.itineraryDays.flatMap((day) =>
    day.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      estimatedCostInr: item.estimatedCostInr,
      dayNumber: day.dayNumber,
    })),
  );
  const activitySummary = computeBudgetSummary(budgetItems, trip.budgetInr);
  const remainingAfterActivities = activitySummary.remaining;

  const center = trip.destinationRef
    ? { lat: trip.destinationRef.lat, lng: trip.destinationRef.lng }
    : undefined;

  const stopCoordinates = center ? [center] : [];

  const ranked = rankHotels({
    nights,
    remainingBudgetInr: remainingAfterActivities,
    stopCoordinates,
  });

  return (
    <PageShell>
      <PageHeader
        backHref={`/trips/${id}`}
        backLabel="Trip"
        eyebrow={trip.title}
        title="Stay"
      />

      <Alert tone="caution" className="mb-6">
        These are <strong>sample hotels for demonstration purposes</strong>. They
        do not reflect real availability, pricing, or reviews. Real hotel
        integration is planned for a future phase.
      </Alert>

      {trip.staySelection && (
        <Card tone="selected" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-success-700">
                Selected Stay
              </p>
              <p className="font-display text-xl font-semibold text-ink-900 mt-1">
                {trip.staySelection.hotelName}
              </p>
              <p className="text-[0.8125rem] text-ink-600 mt-1">
                <Figure>{formatInr(trip.staySelection.costPerNightInr)}</Figure>
                /night &times; <Figure>{trip.staySelection.nights}</Figure>{" "}
                nights ={" "}
                <Figure className="font-medium text-ink-800">
                  {formatInr(trip.staySelection.totalCostInr)}
                </Figure>
              </p>
            </div>
            <HotelRemoveButton tripId={id} />
          </div>
        </Card>
      )}

      <p className="text-[0.8125rem] text-ink-500 mb-4">
        <Figure>{nights}</Figure> night{nights !== 1 ? "s" : ""}
        <span className="mx-1.5 text-ink-300">&middot;</span>
        Budget remaining after activities{" "}
        <Figure className="text-ink-700 font-medium">
          {formatInr(remainingAfterActivities)}
        </Figure>
      </p>

      <div className="space-y-3">
        {ranked.map((hotel) => {
          const isSelected = trip.staySelection?.hotelName === hotel.name;
          return (
            <Card key={hotel.name} tone={isSelected ? "success" : "default"}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg font-semibold text-ink-900">
                      {hotel.name}
                    </h3>
                    <Badge tone="lagoon">
                      Score <span className="font-mono tabular ml-0.5">{hotel.overallScore}</span>
                    </Badge>
                  </div>

                  <p className="text-[0.875rem] text-ink-600 mt-1.5">
                    <Figure className="font-medium text-ink-800">
                      {formatInr(hotel.costPerNightInr)}
                    </Figure>
                    /night
                    <span className="mx-1.5 text-ink-300">&middot;</span>
                    <Figure>{formatInr(hotel.totalCostInr)}</Figure> total
                    <span className="mx-1.5 text-ink-300">&middot;</span>
                    Rating <Figure>{hotel.rating}/5</Figure>
                  </p>

                  <p className="text-[0.75rem] text-ink-400 mt-1">
                    Avg <Figure>{hotel.avgDistanceToStopsKm.toFixed(1)} km</Figure> to
                    activities
                    <span className="mx-1.5 text-ink-300">&middot;</span>
                    Budget fit <Figure>{hotel.budgetFitScore}</Figure>
                    <span className="mx-1.5 text-ink-300">&middot;</span>
                    Distance <Figure>{hotel.distanceScore}</Figure>
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {hotel.amenities.map((a) => (
                      <Badge key={a} tone="neutral">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="shrink-0">
                  {isSelected ? (
                    <Badge tone="success" className="px-3 py-1">
                      Selected
                    </Badge>
                  ) : (
                    <HotelSelectButton
                      tripId={id}
                      hotelName={hotel.name}
                    />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
