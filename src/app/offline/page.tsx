"use client";

import { useEffect, useState } from "react";
import { getOfflineTrips, OfflineTripSnapshot } from "@/lib/idb";
import Link from "next/link";
import { WifiOff, Plane, ArrowRight } from "lucide-react";

export default function OfflinePage() {
  const [offlineTrips, setOfflineTrips] = useState<OfflineTripSnapshot[]>([]);

  useEffect(() => {
    async function loadTrips() {
      const userId = localStorage.getItem('roamwise_user_id');
      if (!userId) return;
      const trips = await getOfflineTrips(userId);
      setOfflineTrips(trips);
    }
    loadTrips();
  }, []);

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-card shadow-card max-w-md w-full">
        <div className="mx-auto bg-ink-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-ink-500" />
        </div>
        <h1 className="text-2xl font-serif text-ink-900 mb-2">You&apos;re Offline</h1>
        <p className="text-ink-600 mb-8">
          It looks like you&apos;ve lost your connection. You can still access your saved trips below.
        </p>

        <div className="text-left space-y-4">
          <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider">
            Available Offline ({offlineTrips.length})
          </h2>
          {offlineTrips.length === 0 ? (
            <p className="text-sm text-ink-500 italic">No trips saved for offline use.</p>
          ) : (
            <div className="space-y-3">
              {offlineTrips.map((trip) => {
                return (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}/live`}
                    className="block border border-ink-200 rounded-control p-4 hover:border-lagoon-500 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-ink-900 flex items-center gap-2">
                          <Plane className="w-4 h-4 text-lagoon-500" /> {trip.destination}
                        </h3>
                        <p className="text-sm text-ink-600">
                          {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(trip.startDate))} - {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(trip.endDate))}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-ink-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
