"use client";

import { useEffect, useState } from "react";
import { getOfflineTrip, OfflineTripSnapshot } from "@/lib/idb";
import { WifiOff, Plane, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function LiveTripPage() {
  const params = useParams();
  const id = params.id as string;
  const [trip, setTrip] = useState<OfflineTripSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrip() {
      const userId = localStorage.getItem('roamwise_user_id');
      if (!userId) {
        setLoading(false);
        return;
      }
      const saved = await getOfflineTrip(id, userId);
      if (saved) {
        setTrip(saved);
      }
      setLoading(false);
    }
    loadTrip();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-ink-50 flex items-center justify-center">Loading live mode...</div>;
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-serif text-ink-900 mb-2">Trip Not Found</h1>
        <p className="text-ink-600 mb-6">This trip hasn&apos;t been saved for offline use.</p>
        <Link href="/" className="text-lagoon-600 font-medium hover:underline">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-lagoon-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center max-w-3xl mx-auto">
          <div>
            <h1 className="font-serif text-xl font-bold flex items-center gap-2">
              <Plane className="w-5 h-5" /> {trip.destination}
            </h1>
            <p className="text-lagoon-100 text-sm">
              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(trip.startDate))} - {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(trip.endDate))}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs bg-black/20 px-2 py-1 rounded-full">
            <WifiOff className="w-3 h-3" /> Offline Mode
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-8 mt-4">
        {/* Important Info Quick Access */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-ink-50 p-4 rounded-card border border-ink-100">
            <h3 className="font-semibold text-ink-900 mb-1">Accommodation</h3>
            <p className="text-sm text-ink-600">Check notes or attachments</p>
          </div>
          <div className="bg-ink-50 p-4 rounded-card border border-ink-100">
            <h3 className="font-semibold text-ink-900 mb-1">Flights</h3>
            <p className="text-sm text-ink-600">Terminal & Gate info</p>
          </div>
        </div>

        {/* Itinerary */}
        <section>
          <h2 className="text-xl font-serif text-ink-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-lagoon-500" /> Itinerary
          </h2>
          <div className="space-y-6">
            {trip.itineraryDays?.map((day) => (
              <div key={day.id} className="relative pl-6 border-l-2 border-lagoon-200">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-lagoon-500 border-4 border-white" />
                <h3 className="font-bold text-ink-900 mb-3">
                  Day {day.dayNumber} - {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(day.date))}
                </h3>
                <div className="space-y-3">
                  {day.activities?.length === 0 ? (
                    <p className="text-sm text-ink-500 italic">No activities planned.</p>
                  ) : (
                    day.activities?.map((activity) => (
                      <div key={activity.id} className="bg-white border border-ink-200 rounded-control p-3 shadow-sm">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-ink-900">{activity.title}</h4>
                          {activity.startTime && (
                            <span className="text-xs font-mono text-ink-500 bg-ink-50 px-2 py-1 rounded">
                              {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(`2000-01-01T${activity.startTime}`))}
                            </span>
                          )}
                        </div>
                        {activity.location && (
                          <p className="text-sm text-ink-600 mt-1 flex items-center gap-1">
                            📍 {activity.location}
                          </p>
                        )}
                        {activity.notes && (
                          <p className="text-sm text-ink-500 mt-2 bg-ink-50 p-2 rounded">
                            {activity.notes}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Packing List Status */}
        <section>
          <h2 className="text-xl font-serif text-ink-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" /> Packing Status
          </h2>
          <div className="bg-white border border-ink-200 rounded-card p-4 space-y-2">
            {trip.packingItems?.length === 0 ? (
               <p className="text-sm text-ink-500 italic">No items to pack.</p>
            ) : (
              trip.packingItems?.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${item.checked ? 'bg-green-500 text-white' : 'bg-ink-100 border border-ink-300'}`}>
                    {item.checked && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <span className={item.checked ? 'text-ink-500 line-through' : 'text-ink-900'}>
                    {item.label}
                  </span>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-ink-500 mt-2 italic">* Offline mode is read-only. Packing status cannot be updated here.</p>
        </section>
      </div>
    </div>
  );
}
