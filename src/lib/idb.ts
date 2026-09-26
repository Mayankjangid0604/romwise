/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface OfflineTripSnapshot {
  schemaVersion: 1;
  id: string;
  ownerUserId: string;
  savedAt: number;
  tripUpdatedAt: Date;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  itineraryDays: Array<{
    id: string;
    dayNumber: number;
    date: Date;
    activities: Array<{
      id: string;
      title: string;
      startTime: string | null;
      location: string | null;
      notes: string | null;
    }>;
  }>;
  packingItems: Array<{
    id: string;
    label: string;
    checked: boolean;
  }>;
}

interface RoamwiseDB extends DBSchema {
  trips: {
    key: string;
    value: OfflineTripSnapshot;
  };
}

let dbPromise: Promise<IDBPDatabase<RoamwiseDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<RoamwiseDB>('roamwise-db', 2, {
      upgrade(db) {
        // We drop the old store and recreate if needed, or handle upgrades
        if (db.objectStoreNames.contains('trips')) {
          db.deleteObjectStore('trips');
        }
        db.createObjectStore('trips', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export function createOfflineTripSnapshot(trip: any, userId: string): OfflineTripSnapshot {
  // Strip out sensitive / large data (comments, votes, raw AI data, tokens, etc)
  return {
    schemaVersion: 1,
    id: trip.id,
    ownerUserId: userId,
    savedAt: Date.now(),
    tripUpdatedAt: trip.updatedAt,
    title: trip.title || trip.name || trip.destination,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    itineraryDays: (trip.itineraryDays || []).map((day: any) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date,
      activities: (day.items || day.activities || []).map((act: any) => ({
        id: act.id,
        title: act.title,
        startTime: act.startTime,
        location: act.place?.address || act.place?.area || act.location || null,
        notes: act.notes,
      })),
    })),
    packingItems: (trip.packingItems || []).map((item: any) => ({
      id: item.id,
      label: item.label,
      checked: item.checked,
    })),
  };
}

export async function saveTripToOffline(tripData: any, userId: string) {
  if (!userId) throw new Error("userId required for offline save");
  const db = await getDB();
  if (!db) return;
  const snapshot = createOfflineTripSnapshot(tripData, userId);
  await db.put('trips', snapshot);
}

export async function getOfflineTrip(id: string, userId: string): Promise<OfflineTripSnapshot | null> {
  if (!userId) return null;
  const db = await getDB();
  if (!db) return null;
  const trip = await db.get('trips', id);
  if (trip && trip.ownerUserId === userId) {
    return trip;
  }
  return null;
}

export async function getOfflineTrips(userId: string): Promise<OfflineTripSnapshot[]> {
  if (!userId) return [];
  const db = await getDB();
  if (!db) return [];
  const trips = await db.getAll('trips');
  return trips.filter(t => t.ownerUserId === userId);
}
