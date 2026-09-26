import Link from "next/link";
import { Star, BedDouble, ArrowRight } from "lucide-react";
import { getTripStayRecommendations, type TripStayContext } from "@/lib/stay";
import { PROPERTY_TYPE_LABELS } from "@/lib/sample-hotels";
import { Badge, Card, Figure, Skeleton, formatInr } from "@/components/ui";

const SUGGESTION_COUNT = 3;

/**
 * Compact hotel suggestions for the trip overview: the top of the Stay tab's own
 * ranking (budget fit + distance to the itinerary's stops), showing just name,
 * rating and price. Rendered inside <Suspense> so it never delays the overview.
 */
export async function StaySuggestions({
  trip,
  selectedRef,
}: {
  /** Passed in by the overview, which already loaded it (saves this component two queries) */
  trip: TripStayContext;
  selectedRef: string | null;
}) {
  if (!trip.destinationRef) return null;
  const tripId = trip.id;

  const { ranked } = await getTripStayRecommendations(trip);
  const suggestions = ranked.filter((h) => h.id !== selectedRef).slice(0, SUGGESTION_COUNT);
  if (suggestions.length === 0) return null;

  return (
    <Card className="p-4 bg-white border-ink-100" data-testid="stay-suggestions">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
          {selectedRef ? "Other suggested stays" : "Suggested stays"}
        </h4>
        <Badge tone="caution" title="Generated sample hotels — not live prices, availability or reviews">
          Sample data
        </Badge>
      </div>
      <ul className="divide-y divide-ink-100">
        {suggestions.map((hotel) => (
          <li key={hotel.id} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900 truncate">{hotel.name}</p>
              <p className="text-xs text-ink-500 flex items-center gap-1.5">
                {hotel.propertyType && <span>{PROPERTY_TYPE_LABELS[hotel.propertyType]}</span>}
                {hotel.rating != null && (
                  <>
                    {hotel.propertyType && <span className="text-ink-300">·</span>}
                    <span className="inline-flex items-center gap-0.5 text-ink-700" aria-label={`Rated ${hotel.rating.toFixed(1)} out of 5`}>
                      <Star className="w-3 h-3 fill-caution-200 text-caution-600" aria-hidden />
                      <Figure>{hotel.rating.toFixed(1)}</Figure>
                    </span>
                    {hotel.reviewCount != null && (
                      <span className="text-ink-400">
                        (<Figure>{hotel.reviewCount.toLocaleString("en-IN")}</Figure>)
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            <p className="shrink-0 text-right text-sm">
              {hotel.costPerNightInr !== null ? (
                <>
                  <Figure className="font-semibold text-ink-900">{formatInr(hotel.costPerNightInr)}</Figure>
                  <span className="block text-[0.6875rem] text-ink-400">per night</span>
                </>
              ) : (
                <span className="text-ink-400 text-xs">Price unavailable</span>
              )}
            </p>
          </li>
        ))}
      </ul>
      <Link
        href={`/trips/${tripId}/stay`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-lagoon-600 hover:text-lagoon-800"
      >
        <BedDouble className="w-3.5 h-3.5" /> See all {ranked.length} stays & pick one <ArrowRight className="w-3 h-3" />
      </Link>
    </Card>
  );
}

export function StaySuggestionsSkeleton() {
  return (
    <Card className="p-4 bg-white border-ink-100" aria-hidden>
      <Skeleton className="h-3 w-32 mb-4" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between py-2.5">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </Card>
  );
}
