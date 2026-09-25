import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SortableDay } from "@/components/itinerary/sortable-day";
import { GenerateButton } from "../generate-button";
import { CalendarDays, Sparkles } from "lucide-react";
import { Alert, Card } from "@/components/ui";
import { AlertCircle } from "lucide-react";

export default async function ItineraryPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: true,
      itineraryDays: {
        orderBy: { dayNumber: 'asc' },
        include: {
          items: {
            orderBy: { order: 'asc' },
            include: {
              votes: true,
              comments: { include: { user: true } },
              place: {
                select: {
                  lat: true,
                  lng: true,
                  area: true,
                  accessibilityScore: true,
                  fatigueCost: true
                }
              }
            }
          }
        }
      }
    }
  });

  const isCreator = trip?.creatorId === session.user.id;
  const isMember = trip?.groupMembers.some((m) => m.userId === session.user!.id);

  if (!trip || (!isCreator && !isMember)) notFound();

  const totalActivities = trip.itineraryDays.reduce((sum, d) => sum + d.items.length, 0);

  return (
    <div className="space-y-8 pb-20 animate-fade-up">
      {trip.itineraryDays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-lagoon-50 flex items-center justify-center mb-6 text-lagoon-600">
            <CalendarDays className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">
            No itinerary yet
          </h2>
          <p className="text-ink-500 max-w-md mb-8">
            Let Roamwise AI create a personalized, budget-aware day-by-day plan 
            based on your destination, preferences, and group size.
          </p>
          <GenerateButton tripId={id} initialStatus={trip.status} />
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <Card className="p-4 bg-lagoon-50/50 border-lagoon-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lagoon-100 flex items-center justify-center text-lagoon-700">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-ink-900">{trip.itineraryDays.length} days planned</p>
                <p className="text-xs text-ink-500">{totalActivities} activities total</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GenerateButton tripId={id} initialStatus={trip.status} />
            </div>
          </Card>

          {trip.unscheduledPlaces && Array.isArray(typeof trip.unscheduledPlaces === 'string' ? JSON.parse(trip.unscheduledPlaces) : trip.unscheduledPlaces) && (typeof trip.unscheduledPlaces === 'string' ? JSON.parse(trip.unscheduledPlaces) : trip.unscheduledPlaces).length > 0 && (
            <Alert tone="caution" title="Some Must-Visit Places Couldn't Be Scheduled">
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {(typeof trip.unscheduledPlaces === 'string' ? JSON.parse(trip.unscheduledPlaces) : trip.unscheduledPlaces as any[]).map((place: any, i: number) => (
                  <li key={i}>
                    <strong>{place.name}</strong>: {place.reason}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="space-y-12">
            {trip.itineraryDays.map((day) => (
              <SortableDay 
                key={day.id} 
                day={day as unknown as Parameters<typeof SortableDay>[0]["day"]} 
                tripId={trip.id} 
                isShortTrip={trip.itineraryDays.length <= 3}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
