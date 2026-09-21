import { prisma } from "@/lib/db";
import { SortableDay } from "@/components/itinerary/sortable-day";

export default async function ItineraryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      itineraryDays: {
        orderBy: { dayNumber: 'asc' },
        include: {
          items: {
            orderBy: { order: 'asc' },
            include: {
              votes: true,
              comments: { include: { user: true } }
            }
          }
        }
      }
    }
  });

  if (!trip) return null;

  return (
    <div className="space-y-8 pb-20">
      {trip.itineraryDays.length === 0 ? (
        <div className="text-center py-12 text-ink-500">
          No itinerary generated yet.
        </div>
      ) : (
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
      )}
    </div>
  );
}
