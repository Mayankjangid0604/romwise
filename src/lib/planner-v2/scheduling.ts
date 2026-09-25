import type { CandidatePlaceV2, V2GeneratedDay, V2GeneratedItem } from "./types";
import type { GeographicCluster } from "./clustering";
import { haversineKm } from "../route-optimizer";

type PaceConfig = {
  maxActivitiesPerDay: number;
  bufferMinutes: number; // travel + buffer
};

const PACE_MAP: Record<string, PaceConfig> = {
  relaxed: { maxActivitiesPerDay: 3, bufferMinutes: 45 },
  moderate: { maxActivitiesPerDay: 4, bufferMinutes: 30 },
  full: { maxActivitiesPerDay: 5, bufferMinutes: 30 },
};

export function getActivityDuration(place: CandidatePlaceV2): number {
  if (place.durationMinutes && place.durationMinutes > 0) {
    return place.durationMinutes;
  }
  // Default based on category
  const shortCats = ["cafe", "street_food", "viewpoint", "photography"];
  const longCats = ["adventure", "theme_park", "hike", "nature", "relaxation"];
  
  if (shortCats.includes(place.category)) return 45;
  if (longCats.includes(place.category)) return 180;
  return 90; // Standard baseline
}

// Simple time string helpers
function timeStrToMins(ts: string): number {
  const [h, m] = ts.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minsToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildDays(
  clusters: GeographicCluster[],
  numDays: number,
  pace: string,
  startDate: Date
): V2GeneratedDay[] {
  const paceConfig = PACE_MAP[pace] || PACE_MAP.moderate;
  const days: V2GeneratedDay[] = [];
  
  // Flatten sorted clusters into a queue of places
  const placeQueue = clusters.flatMap(c => c.places);
  const usedPlaces = new Set<string>();

  for (let dayNum = 1; dayNum <= numDays; dayNum++) {
    let currentMins = 9 * 60; // Start at 09:00
    const endOfDayMins = 21 * 60; // End at 21:00
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + dayNum - 1);

    const items: V2GeneratedItem[] = [];
    let activitiesCount = 0;
    
    // Meal flags
    let hadLunch = false;
    let hadDinner = false;

    let lastLat: number | null = null;
    let lastLng: number | null = null;

    while (currentMins < endOfDayMins && activitiesCount < paceConfig.maxActivitiesPerDay) {
      // Check meal windows
      if (currentMins >= 12.5 * 60 && currentMins < 14 * 60 && !hadLunch) {
        // Try to find a dining place
        const mealPlace = findBestPlace(placeQueue, usedPlaces, "dining", lastLat, lastLng);
        if (mealPlace) {
          const duration = getActivityDuration(mealPlace);
          const endTime = currentMins + duration;
          items.push(createItem(mealPlace, currentMins, endTime, items.length));
          usedPlaces.add(mealPlace.id);
          currentMins = endTime + paceConfig.bufferMinutes;
          activitiesCount++;
          lastLat = mealPlace.lat;
          lastLng = mealPlace.lng;
        }
        hadLunch = true;
        continue;
      }
      
      if (currentMins >= 19 * 60 && currentMins < 21 * 60 && !hadDinner) {
        const mealPlace = findBestPlace(placeQueue, usedPlaces, "dining", lastLat, lastLng);
        if (mealPlace) {
          const duration = getActivityDuration(mealPlace);
          const endTime = currentMins + duration;
          items.push(createItem(mealPlace, currentMins, endTime, items.length));
          usedPlaces.add(mealPlace.id);
          currentMins = endTime + paceConfig.bufferMinutes;
          activitiesCount++;
          lastLat = mealPlace.lat;
          lastLng = mealPlace.lng;
        }
        hadDinner = true;
        continue;
      }

      // Find an activity (non-dining unless it's the only thing left)
      let activityPlace: CandidatePlaceV2 | null = null;
      let validTime = false;
      let duration = 0;
      
      const skippedThisRound = new Set<string>();
      
      while (true) {
        // Find best place excluding ones we already used OR skipped this round
        const combinedUsed = new Set([...usedPlaces, ...skippedThisRound]);
        activityPlace = findBestPlace(placeQueue, combinedUsed, "activity", lastLat, lastLng);
        
        if (!activityPlace) break; // No more places to schedule
        
        duration = getActivityDuration(activityPlace);
        let proposedMins = currentMins;
        
        // Check opening hours
        if (activityPlace.openingTime && activityPlace.closingTime) {
          const openMins = timeStrToMins(activityPlace.openingTime);
          const closeMins = timeStrToMins(activityPlace.closingTime);
          
          if (proposedMins < openMins) {
             proposedMins = openMins;
          }
          
          if (proposedMins + duration <= closeMins) {
            validTime = true;
            currentMins = proposedMins;
            break;
          } else {
            // Cannot fit it today, skip it for this round
            skippedThisRound.add(activityPlace.id);
          }
        } else {
          // No hours, assume always open
          validTime = true;
          break;
        }
      }

      if (activityPlace && validTime) {
        items.push(createItem(activityPlace, currentMins, currentMins + duration, items.length));
        usedPlaces.add(activityPlace.id);
        currentMins += duration + paceConfig.bufferMinutes;
        activitiesCount++;
        lastLat = activityPlace.lat;
        lastLng = activityPlace.lng;
      } else {
        // If no place fits, end the day early
        break;
      }
    }

    days.push({
      dayNumber: dayNum,
      date: dayDate,
      items
    });
  }

  return days;
}

function findBestPlace(
  queue: CandidatePlaceV2[],
  used: Set<string>,
  type: "dining" | "activity",
  lat: number | null,
  lng: number | null
): CandidatePlaceV2 | null {
  // Score places dynamically based on distance to last location
  const candidates = queue.filter(p => !used.has(p.id));
  if (candidates.length === 0) return null;

  const validCandidates = candidates.filter(p => {
    const isDining = ["dining", "restaurant", "cafe", "street_food", "food_market"].includes(p.category);
    return type === "dining" ? isDining : !isDining;
  });

  if (validCandidates.length === 0) {
    // fallback to any
    return candidates[0];
  }

  let bestPlace = validCandidates[0];
  let bestScore = -Infinity;

  for (const place of validCandidates) {
    let score = place.v2Score?.total ?? 0;
    
    // Penalize distance
    if (lat !== null && lng !== null && place.lat !== null && place.lng !== null) {
      const dist = haversineKm(lat, lng, place.lat, place.lng);
      score -= dist * 5; // 5 points per km penalty
    }

    if (score > bestScore) {
      bestScore = score;
      bestPlace = place;
    }
  }

  return bestPlace;
}

function createItem(place: CandidatePlaceV2, startMins: number, endMins: number, order: number): V2GeneratedItem {
  return {
    placeId: place.id,
    title: place.name,
    description: place.description || "",
    category: place.category,
    startTime: minsToTimeStr(startMins),
    endTime: minsToTimeStr(endMins),
    estimatedCostInr: place.typicalCostInr,
    costSource: place.typicalCostInr === 0 ? "free" : (place.typicalCostInr !== null ? "db" : "unknown"),
    lat: place.lat,
    lng: place.lng,
    reasoning: place.userStatus === "must-visit" 
      ? "Selected because it's a Must-Visit place." 
      : place.userStatus === "interested"
      ? "Selected based on your interest."
      : `Scheduled automatically based on ${place.v2Score?.total ? 'high rank' : 'proximity'}.`,
    order,
  };
}
