import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTripStayRecommendations } from "@/lib/stay";
import { PROPERTY_TYPE_LABELS } from "@/lib/sample-hotels";
import { HotelSelectButton, HotelRemoveButton } from "./stay-actions";
import { Star } from "lucide-react";
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

  const [trip, groupMembers, tripAccommodations] = await Promise.all([
    prisma.trip.findUnique({ where: { id }, include: { destinationRef: true } }),
    prisma.groupMember.findMany({ where: { tripId: id }, select: { userId: true, role: true } }),
    prisma.tripAccommodation.findMany({ where: { tripId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!trip) redirect("/dashboard");

  const me = groupMembers.find((m) => m.userId === session.user!.id);
  if (!me) redirect("/dashboard");
  const canEdit = me.role !== "viewer";

  const { nights, remainingBudgetInr, ranked } = await getTripStayRecommendations(trip);

  // The Stay-tab pick is the accommodation with a selectionRef; manual entries have none
  const selected = tripAccommodations.find((a) => a.selectionRef !== null) ?? null;
  const manualCount = tripAccommodations.filter((a) => a.selectionRef === null).length;

  const sampleCount = ranked.filter((h) => h.isSample).length;
  const typeCount = new Set(ranked.map((h) => h.propertyType).filter(Boolean)).size;
  const prices = ranked.map((h) => h.costPerNightInr).filter((p): p is number => p !== null);

  return (
    <PageShell>
      <PageHeader
        backHref={`/trips/${id}`}
        backLabel="Trip"
        eyebrow={trip.title}
        title="Stay"
      />

      <Alert tone="caution" title="Sample hotel data" className="mb-6">
        These stays are <strong>generated sample data for demonstration</strong>: names, prices,
        ratings and review counts are illustrative, not real hotels, live availability or real
        reviews. Roamwise is not connected to a booking provider.
      </Alert>

      {selected && (
        <Card tone="selected" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-success-700">
                Selected Stay
              </p>
              <p className="font-display text-xl font-semibold text-ink-900 mt-1">
                {selected.name}
              </p>
              {selected.costPerNightInr !== null ? (
                <p className="text-[0.8125rem] text-ink-600 mt-1">
                  <Figure>{formatInr(selected.costPerNightInr)}</Figure>
                  /night &times; <Figure>{selected.nights ?? 0}</Figure>{" "}
                  nights ={" "}
                  <Figure className="font-medium text-ink-800">
                    {formatInr(selected.totalCostInr ?? 0)}
                  </Figure>
                </p>
              ) : (
                <p className="text-[0.8125rem] text-ink-600 mt-1">
                  Price unavailable
                </p>
              )}
            </div>
            {canEdit && <HotelRemoveButton tripId={id} />}
          </div>
        </Card>
      )}

      <p className="text-[0.8125rem] text-ink-500 mb-4">
        <Figure>{nights}</Figure> night{nights !== 1 ? "s" : ""}
        <span className="mx-1.5 text-ink-300">&middot;</span>
        Budget remaining after activities{" "}
        <Figure className="text-ink-700 font-medium">
          {formatInr(remainingBudgetInr)}
        </Figure>
        {ranked.length > 0 && (
          <>
            <span className="mx-1.5 text-ink-300">&middot;</span>
            <Figure>{ranked.length}</Figure> options ({sampleCount} sample) across{" "}
            <Figure>{typeCount}</Figure> property types
            {prices.length > 0 && (
              <>
                , <Figure>{formatInr(Math.min(...prices))}</Figure>–<Figure>{formatInr(Math.max(...prices))}</Figure>/night
              </>
            )}
          </>
        )}
        {manualCount > 0 && (
          <>
            <span className="mx-1.5 text-ink-300">&middot;</span>
            {manualCount} stay{manualCount !== 1 ? "s" : ""} you added manually (kept when you pick a hotel)
          </>
        )}
      </p>

      {ranked.length === 0 && (
        <Alert tone="info">
          Stay suggestions appear once this trip is linked to a known destination.
        </Alert>
      )}

      <div className="space-y-3">
        {ranked.map((hotel) => {
          const isSelected = selected?.selectionRef === hotel.id;
          return (
            <Card key={hotel.id} tone={isSelected ? "success" : "default"}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg font-semibold text-ink-900">
                      {hotel.name}
                    </h3>
                    {hotel.propertyType && (
                      <Badge tone="neutral">{PROPERTY_TYPE_LABELS[hotel.propertyType]}</Badge>
                    )}
                    {hotel.isSample && <Badge tone="caution">Sample</Badge>}
                    <Badge tone="lagoon">
                      Score <span className="font-mono tabular ml-0.5">{hotel.overallScore}</span>
                    </Badge>
                  </div>

                  <p className="text-[0.875rem] text-ink-600 mt-1.5 flex flex-wrap items-center gap-x-1.5">
                    {hotel.rating != null && (
                      <span className="inline-flex items-center gap-1 text-ink-800">
                        <Star className="w-3.5 h-3.5 fill-caution-200 text-caution-600" aria-hidden />
                        <Figure>{hotel.rating.toFixed(1)}</Figure>
                        {hotel.reviewCount != null && (
                          <span className="text-ink-400 text-[0.75rem]">
                            (<Figure>{hotel.reviewCount.toLocaleString("en-IN")}</Figure> sample reviews)
                          </span>
                        )}
                      </span>
                    )}
                    {hotel.rating != null && <span className="text-ink-300">&middot;</span>}
                    {hotel.costPerNightInr !== null ? (
                      <>
                        <Figure className="font-medium text-ink-800">
                          {formatInr(hotel.costPerNightInr)}
                        </Figure>
                        /night
                        <span className="text-ink-300">&middot;</span>
                        <Figure>{formatInr(hotel.totalCostInr ?? 0)}</Figure> total
                      </>
                    ) : (
                      <span className="text-ink-500">Price unavailable</span>
                    )}
                  </p>

                  <p className="text-[0.75rem] text-ink-400 mt-1">
                    {hotel.area && <>{hotel.area}<span className="mx-1.5 text-ink-300">&middot;</span></>}
                    Avg <Figure>{hotel.avgDistanceToStopsKm.toFixed(1)} km</Figure> to
                    your stops
                    <span className="mx-1.5 text-ink-300">&middot;</span>
                    Budget fit <Figure>{hotel.budgetFitScore}</Figure>
                    <span className="mx-1.5 text-ink-300">&middot;</span>
                    Distance <Figure>{hotel.distanceScore}</Figure>
                  </p>

                  {hotel.amenities && hotel.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {hotel.amenities.slice(0, 5).map((a) => (
                        <span key={a} className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-ink-100 text-ink-600">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {isSelected ? (
                    <Badge tone="success" className="px-3 py-1">
                      Selected
                    </Badge>
                  ) : canEdit ? (
                    <HotelSelectButton
                      tripId={id}
                      stayId={hotel.id}
                    />
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
