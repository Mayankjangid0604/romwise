/**
 * OSM Tag → Roamwise Category Mapping
 *
 * Deterministic, centralized mapping. No AI involved.
 * Maps OSM key=value pairs to Roamwise PlaceCategory values.
 */

import { isTransitName } from "../../../src/lib/transit-filter";

export type OsmTags = Record<string, string | undefined>;

export type CategoryMapping = {
  category: string;
  placeType?: string;
};

/**
 * Map OSM tags to a Roamwise category + optional placeType.
 * Returns null if the tags don't match any useful travel category.
 */
export function mapOsmTags(tags: OsmTags): CategoryMapping | null {
  // --- ACCOMMODATION ---
  if (tags.tourism === "hotel") return { category: "stay", placeType: "hotel" };
  if (tags.tourism === "hostel") return { category: "stay", placeType: "hostel" };
  if (tags.tourism === "guest_house") return { category: "stay", placeType: "guest_house" };
  if (tags.tourism === "motel") return { category: "stay", placeType: "motel" };
  if (tags.tourism === "apartment") return { category: "stay", placeType: "apartment" };
  if (tags.tourism === "camp_site") return { category: "stay", placeType: "camp_site" };
  if (tags.tourism === "chalet") return { category: "stay", placeType: "chalet" };
  if (tags.tourism === "resort") return { category: "stay", placeType: "resort" };

  // --- TRANSPORT ---
  // Checked before historic/tourism tags: a station that is also tagged tourism=attraction
  // or historic=building is still a transit point, not a place to visit.
  if (tags.aeroway === "aerodrome" || tags.aeroway === "airport") return { category: "transport", placeType: "airport" };
  if (tags.aeroway === "terminal") return { category: "transport", placeType: "airport_terminal" };
  if (tags.aeroway === "helipad") return { category: "transport", placeType: "helipad" };
  if (tags.station === "subway" || tags.railway === "subway_entrance" ||
      (tags.public_transport === "station" && (tags.subway === "yes" || tags.light_rail === "yes" || tags.monorail === "yes"))) {
    return { category: "transport", placeType: "metro_station" };
  }
  if (tags.railway === "station" || tags.railway === "halt" || tags.railway === "stop" ||
      tags.building === "train_station" || (tags.public_transport === "station" && tags.train === "yes")) {
    return { category: "transport", placeType: tags.railway === "halt" ? "railway_halt" : "railway_station" };
  }
  if (tags.amenity === "bus_station") return { category: "transport", placeType: "bus_station" };
  if (tags.public_transport === "station" && tags.bus === "yes") return { category: "transport", placeType: "bus_station" };
  if (tags.highway === "bus_stop") return { category: "transport", placeType: "bus_stop" };
  if (tags.amenity === "ferry_terminal") return { category: "transport", placeType: "ferry_terminal" };
  if (tags.amenity === "taxi") return { category: "transport", placeType: "taxi_stand" };
  if (tags.public_transport === "station" || tags.building === "transportation") return { category: "transport", placeType: "transit_hub" };
  // Name says it's a station/bus stand/airport even if the tags don't
  if (tags.name && isTransitName(tags.name)) return { category: "transport", placeType: "transit_hub" };

  // --- FOOD ---
  if (tags.amenity === "restaurant") return { category: "restaurant", placeType: "restaurant" };
  if (tags.amenity === "cafe") return { category: "cafe", placeType: "cafe" };
  if (tags.amenity === "food_court") return { category: "dining", placeType: "food_court" };
  if (tags.amenity === "fast_food") return { category: "dining", placeType: "fast_food" };
  if (tags.shop === "bakery") return { category: "cafe", placeType: "bakery" };

  // --- SPIRITUAL ---
  if (tags.amenity === "place_of_worship") return { category: "spiritual", placeType: tags.religion || "worship" };

  // --- HISTORIC ---
  if (tags.historic === "fort") return { category: "history", placeType: "fort" };
  if (tags.historic === "castle") return { category: "history", placeType: "castle" };
  if (tags.historic === "palace") return { category: "history", placeType: "palace" };
  if (tags.historic === "monument") return { category: "history", placeType: "monument" };
  if (tags.historic === "memorial") return { category: "history", placeType: "memorial" };
  if (tags.historic === "ruins") return { category: "history", placeType: "ruins" };
  if (tags.historic === "archaeological_site") return { category: "history", placeType: "archaeological_site" };
  if (tags.historic === "city_gate") return { category: "history", placeType: "city_gate" };

  // --- TOURISM ---
  if (tags.tourism === "museum") return { category: "culture", placeType: "museum" };
  if (tags.tourism === "gallery") return { category: "culture", placeType: "gallery" };
  if (tags.tourism === "attraction") return { category: "sightseeing", placeType: "attraction" };
  if (tags.tourism === "viewpoint") return { category: "sightseeing", placeType: "viewpoint" };
  if (tags.tourism === "zoo") return { category: "family", placeType: "zoo" };
  if (tags.tourism === "aquarium") return { category: "family", placeType: "aquarium" };
  if (tags.tourism === "theme_park") return { category: "family", placeType: "theme_park" };
  if (tags.tourism === "information" && tags.information === "visitor_centre") return { category: "sightseeing", placeType: "visitor_centre" };

  // --- NATURE ---
  if (tags.natural === "beach") return { category: "nature", placeType: "beach" };
  if (tags.natural === "peak") return { category: "nature", placeType: "peak" };
  if (tags.natural === "waterfall") return { category: "nature", placeType: "waterfall" };
  if (tags.natural === "cave_entrance") return { category: "nature", placeType: "cave" };
  if (tags.natural === "hot_spring") return { category: "nature", placeType: "hot_spring" };

  // --- LEISURE ---
  if (tags.leisure === "park") return { category: "nature", placeType: "park" };
  if (tags.leisure === "garden") return { category: "nature", placeType: "garden" };
  if (tags.leisure === "nature_reserve") return { category: "nature", placeType: "nature_reserve" };
  if (tags.leisure === "water_park") return { category: "family", placeType: "water_park" };

  // --- SHOPPING ---
  if (tags.shop === "mall" || tags.shop === "department_store") return { category: "shopping", placeType: "mall" };
  if (tags.amenity === "marketplace") return { category: "shopping", placeType: "market" };

  // --- NIGHTLIFE ---
  if (tags.amenity === "bar" || tags.amenity === "pub" || tags.amenity === "nightclub") return { category: "nightlife", placeType: tags.amenity };

  return null;
}

/**
 * Compute a deterministic quality score (0-100) for a place record.
 */
export function computeQualityScore(fields: {
  name?: string;
  lat?: number;
  lng?: number;
  destinationId?: string;
  category?: string;
  area?: string;
  address?: string;
  website?: string;
  openingHours?: string;
  wheelchair?: string;
}): number {
  let score = 0;
  if (fields.name) score += 20;
  if (fields.lat !== undefined && fields.lng !== undefined) score += 20;
  if (fields.destinationId) score += 20;
  if (fields.category) score += 15;
  if (fields.area) score += 5;
  if (fields.address) score += 5;
  if (fields.website) score += 5;
  if (fields.openingHours) score += 5;
  if (fields.wheelchair) score += 5;
  return score;
}

/**
 * Parse simple OSM opening_hours into openingTime/closingTime.
 * Only safe for truly simple daily patterns like "09:00-17:00".
 * Returns null for complex schedules — caller should store raw string.
 */
export function parseSimpleHours(raw: string | undefined): { openingTime: string; closingTime: string } | null {
  if (!raw) return null;
  const simple = raw.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (simple) return { openingTime: simple[1], closingTime: simple[2] };
  return null;
}
