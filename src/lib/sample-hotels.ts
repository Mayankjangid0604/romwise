/**
 * SAMPLE HOTEL DATA — for demonstration only. Not a booking provider integration:
 * names, prices, ratings and review counts are illustrative, not live availability or
 * real reviews. Every generated hotel carries `isSample: true` and the UI labels it.
 *
 * Replaces the original 10-hotel list (removed in 331ee89, after which the Stay page
 * showed nothing because no `Place` rows have category "stay"). Instead of a fixed
 * list pinned to one city, this is a catalogue of 58 property archetypes — hostels,
 * guesthouses, homestays, heritage havelis, houseboats, desert camps, ashrams, jungle
 * lodges, business and luxury hotels — and each destination gets the ones that fit its
 * setting (beach, mountain, heritage, backwater/lake, desert, spiritual, wildlife, city),
 * priced for the place and positioned around its real coordinates. Output is
 * deterministic (seeded by destination slug), so ids and prices are stable across
 * requests and the server can look a hotel up by id when it's selected.
 *
 * Names are deliberately generic (no hotel-chain brand words).
 */
import type { StayCandidate } from "./stay";

export type HotelSetting = "any" | "city" | "beach" | "mountain" | "heritage" | "backwater" | "desert" | "spiritual" | "wildlife";

export type PropertyType =
  | "hostel" | "budget_hotel" | "guesthouse" | "homestay" | "mid_range" | "business" | "boutique"
  | "upscale" | "luxury" | "apartment" | "eco_lodge" | "beach_hut" | "resort" | "cottage" | "camp"
  | "heritage" | "houseboat" | "ashram" | "retreat" | "dharamshala" | "jungle_lodge";

type Archetype = {
  id: string;
  /** "{D}" is replaced with the destination name */
  name: string;
  type: PropertyType;
  costPerNightInr: number;
  rating: number;
  amenities: string[];
  area: string;
  /** Distance band from the destination centre, km */
  distanceKm: [number, number];
  settings: HotelSetting[];
};

export const SAMPLE_HOTEL_ARCHETYPES: readonly Archetype[] = [
  // ── Anywhere ─────────────────────────────────────────────────────────────
  { id: "backpackers-hostel", name: "{D} Backpackers Hostel", type: "hostel", costPerNightInr: 650, rating: 4.3, amenities: ["Wi-Fi", "Lockers", "Shared kitchen", "Dorm beds"], area: "Near the main market", distanceKm: [0.4, 2], settings: ["any"] },
  { id: "pod-hotel", name: "Nomad Pod Hotel", type: "hostel", costPerNightInr: 950, rating: 4.1, amenities: ["Sleeping pods", "Lockers", "Wi-Fi", "Lounge"], area: "Central", distanceKm: [0.3, 1.5], settings: ["any"] },
  { id: "budget-inn", name: "Sunrise Budget Inn", type: "budget_hotel", costPerNightInr: 1400, rating: 3.6, amenities: ["Wi-Fi", "AC rooms", "24h front desk"], area: "Near the bus stand", distanceKm: [1, 3], settings: ["any"] },
  { id: "station-road-lodge", name: "Station Road Lodge", type: "budget_hotel", costPerNightInr: 1100, rating: 3.3, amenities: ["Fan rooms", "Hot water", "Luggage storage"], area: "Station Road", distanceKm: [1.5, 4], settings: ["any"] },
  { id: "city-nest", name: "City Nest Hotel", type: "budget_hotel", costPerNightInr: 1750, rating: 3.8, amenities: ["Wi-Fi", "AC rooms", "Breakfast"], area: "Central", distanceKm: [0.5, 2.5], settings: ["any"] },
  { id: "family-guesthouse", name: "{D} Family Guesthouse", type: "guesthouse", costPerNightInr: 1800, rating: 4.4, amenities: ["Home-cooked meals", "Wi-Fi", "Garden"], area: "Residential quarter", distanceKm: [1, 3], settings: ["any"] },
  { id: "comfort-suites", name: "Comfort Stay Suites", type: "mid_range", costPerNightInr: 3200, rating: 4.0, amenities: ["AC rooms", "Restaurant", "Room service", "Wi-Fi"], area: "Central", distanceKm: [0.5, 2], settings: ["any"] },
  { id: "business-hotel", name: "{D} Business Hotel", type: "business", costPerNightInr: 4800, rating: 4.1, amenities: ["Gym", "Restaurant", "Meeting rooms", "Airport transfer"], area: "Commercial district", distanceKm: [2, 5], settings: ["any"] },
  { id: "boutique-loft", name: "The Indigo Loft", type: "boutique", costPerNightInr: 5200, rating: 4.6, amenities: ["Design rooms", "Café", "Rooftop terrace", "Wi-Fi"], area: "Arts quarter", distanceKm: [0.5, 2], settings: ["any"] },
  { id: "grand-hotel", name: "Grand {D} Hotel", type: "upscale", costPerNightInr: 8500, rating: 4.5, amenities: ["Pool", "Spa", "Multi-cuisine restaurant", "Gym", "Concierge"], area: "City centre", distanceKm: [0.3, 1.5], settings: ["any"] },
  { id: "peacock-crest", name: "The Peacock Crest", type: "luxury", costPerNightInr: 14500, rating: 4.7, amenities: ["Infinity pool", "Spa", "Fine dining", "Butler service", "Airport transfer"], area: "Prime location", distanceKm: [1, 4], settings: ["any"] },
  { id: "serviced-apartments", name: "{D} Serviced Apartments", type: "apartment", costPerNightInr: 3800, rating: 4.2, amenities: ["Kitchenette", "Washing machine", "Wi-Fi", "Weekly housekeeping"], area: "Residential", distanceKm: [2, 5], settings: ["any"] },
  { id: "green-leaf", name: "Green Leaf Eco Stay", type: "eco_lodge", costPerNightInr: 2600, rating: 4.3, amenities: ["Solar power", "Organic meals", "Bicycle hire"], area: "Outskirts", distanceKm: [4, 9], settings: ["any"] },
  { id: "neem-tree-rooms", name: "Neem Tree Guest Rooms", type: "guesthouse", costPerNightInr: 1250, rating: 4.0, amenities: ["Courtyard", "Wi-Fi", "Tea & coffee"], area: "Old quarter", distanceKm: [0.5, 2], settings: ["any"] },
  { id: "youth-hostel", name: "{D} Youth Hostel", type: "hostel", costPerNightInr: 500, rating: 4.0, amenities: ["Dorm beds", "Lockers", "Common room"], area: "Central", distanceKm: [0.5, 2.5], settings: ["any"] },
  { id: "travellers-rest", name: "Travellers' Rest House", type: "budget_hotel", costPerNightInr: 900, rating: 3.4, amenities: ["Basic rooms", "Hot water", "Tea stall"], area: "Old market road", distanceKm: [0.5, 3], settings: ["any"] },
  { id: "market-homestay", name: "{D} Homestay by the Market", type: "homestay", costPerNightInr: 1600, rating: 4.5, amenities: ["Home-cooked meals", "Local tips", "Wi-Fi"], area: "Market area", distanceKm: [0.3, 1.5], settings: ["any"] },
  { id: "silver-birch-inn", name: "Silver Birch Inn", type: "mid_range", costPerNightInr: 2200, rating: 4.1, amenities: ["Garden", "Breakfast", "Wi-Fi"], area: "Quiet lane", distanceKm: [1, 3], settings: ["any"] },
  { id: "maple-residency", name: "Maple Leaf Residency", type: "mid_range", costPerNightInr: 2600, rating: 3.9, amenities: ["AC rooms", "Breakfast", "Parking"], area: "Main road", distanceKm: [1, 4], settings: ["any"] },
  { id: "banyan-boutique", name: "The Banyan Boutique Stay", type: "boutique", costPerNightInr: 4400, rating: 4.5, amenities: ["Courtyard garden", "Café", "Curated rooms"], area: "Leafy quarter", distanceKm: [1, 3], settings: ["any"] },
  { id: "horizon-heights", name: "Horizon Heights Hotel", type: "upscale", costPerNightInr: 6800, rating: 4.3, amenities: ["Rooftop restaurant", "Pool", "Gym"], area: "Hilltop / high-rise", distanceKm: [1.5, 5], settings: ["any"] },

  // ── Big cities ───────────────────────────────────────────────────────────
  { id: "gateway-business", name: "Gateway Business Hotel", type: "business", costPerNightInr: 5600, rating: 4.0, amenities: ["Airport shuttle", "Gym", "Business centre", "Restaurant"], area: "Near the airport", distanceKm: [10, 18], settings: ["city"] },
  { id: "art-deco-residency", name: "Art Deco Residency", type: "boutique", costPerNightInr: 4200, rating: 4.4, amenities: ["Heritage building", "Café", "Wi-Fi"], area: "Old business district", distanceKm: [1, 3], settings: ["city"] },
  { id: "skyline-hostel", name: "Skyline Rooftop Hostel", type: "hostel", costPerNightInr: 850, rating: 4.3, amenities: ["Rooftop bar", "Dorm beds", "Events", "Wi-Fi"], area: "Nightlife district", distanceKm: [1, 3], settings: ["city"] },
  { id: "sapphire-tower", name: "The Sapphire Tower", type: "luxury", costPerNightInr: 16000, rating: 4.7, amenities: ["Skyline views", "Spa", "3 restaurants", "Club lounge", "Pool"], area: "Business district", distanceKm: [2, 6], settings: ["city"] },
  { id: "downtown-suites", name: "Downtown Suites", type: "mid_range", costPerNightInr: 3600, rating: 3.9, amenities: ["AC rooms", "Breakfast", "Metro nearby"], area: "Downtown", distanceKm: [0.5, 2], settings: ["city"] },

  // ── Beach ────────────────────────────────────────────────────────────────
  { id: "palm-shack-huts", name: "Palm Shack Beach Huts", type: "beach_hut", costPerNightInr: 1600, rating: 4.2, amenities: ["Sea view", "Beach access", "Café"], area: "Beachfront", distanceKm: [3, 10], settings: ["beach"] },
  { id: "coral-sands", name: "Coral Sands Resort", type: "resort", costPerNightInr: 7800, rating: 4.4, amenities: ["Pool", "Beach access", "Spa", "Water-sports desk"], area: "Beachfront", distanceKm: [4, 12], settings: ["beach"] },
  { id: "tidewater-hostel", name: "Tidewater Surf Hostel", type: "hostel", costPerNightInr: 750, rating: 4.4, amenities: ["Surf lessons", "Dorm beds", "Bonfire nights"], area: "Near the beach", distanceKm: [3, 9], settings: ["beach"] },
  { id: "casa-azul", name: "Casa Azul Villa Homestay", type: "homestay", costPerNightInr: 3200, rating: 4.7, amenities: ["Private garden", "Home-cooked seafood", "Scooter hire"], area: "Village lane", distanceKm: [2, 8], settings: ["beach"] },
  { id: "clifftop-sunset", name: "Clifftop Sunset Resort", type: "upscale", costPerNightInr: 11000, rating: 4.6, amenities: ["Sea-view infinity pool", "Spa", "Sunset deck"], area: "Clifftop", distanceKm: [6, 14], settings: ["beach"] },
  { id: "seaside-rooms", name: "Seaside Budget Rooms", type: "budget_hotel", costPerNightInr: 1300, rating: 3.5, amenities: ["Fan rooms", "Beach 5 min walk"], area: "Near the beach", distanceKm: [2, 7], settings: ["beach"] },

  // ── Mountains / hill stations ────────────────────────────────────────────
  { id: "pine-ridge-backpackers", name: "Pine Ridge Backpackers", type: "hostel", costPerNightInr: 600, rating: 4.5, amenities: ["Mountain view", "Bonfire", "Trek desk", "Dorm beds"], area: "Upper town", distanceKm: [1, 4], settings: ["mountain"] },
  { id: "orchard-cottages", name: "Apple Orchard Cottages", type: "cottage", costPerNightInr: 3000, rating: 4.5, amenities: ["Fireplace", "Orchard", "Home-cooked meals"], area: "Orchard belt", distanceKm: [3, 8], settings: ["mountain"] },
  { id: "snowline-resort", name: "Snowline Valley Resort", type: "resort", costPerNightInr: 7200, rating: 4.3, amenities: ["Valley view", "Heated rooms", "Spa", "Restaurant"], area: "Valley road", distanceKm: [4, 10], settings: ["mountain"] },
  { id: "misty-hills-homestay", name: "Misty Hills Homestay", type: "homestay", costPerNightInr: 1900, rating: 4.6, amenities: ["Home-cooked meals", "Garden", "Local guide"], area: "Hillside village", distanceKm: [2, 7], settings: ["mountain"] },
  { id: "planters-bungalow", name: "Old Planter's Bungalow", type: "heritage", costPerNightInr: 6800, rating: 4.7, amenities: ["Estate walks", "Colonial rooms", "Fireplace", "All meals"], area: "Plantation estate", distanceKm: [5, 12], settings: ["mountain"] },
  { id: "riverside-camp", name: "Riverside Adventure Camp", type: "camp", costPerNightInr: 2400, rating: 4.2, amenities: ["Tents", "Bonfire", "Guided treks", "Rafting desk"], area: "Riverside", distanceKm: [5, 15], settings: ["mountain"] },
  { id: "deodar-lodge", name: "Deodar Lodge", type: "budget_hotel", costPerNightInr: 1500, rating: 3.7, amenities: ["Heaters", "Hot water", "Mountain view"], area: "Mall road", distanceKm: [0.5, 2], settings: ["mountain"] },

  // ── Heritage towns ───────────────────────────────────────────────────────
  { id: "chandni-haveli", name: "Chandni Haveli", type: "heritage", costPerNightInr: 5400, rating: 4.6, amenities: ["Painted courtyard", "Rooftop restaurant", "Heritage walks"], area: "Walled city", distanceKm: [0.5, 2], settings: ["heritage"] },
  { id: "rajwada-palace", name: "Rajwada Palace Hotel", type: "luxury", costPerNightInr: 18000, rating: 4.8, amenities: ["Palace suites", "Pool", "Spa", "Royal dining"], area: "Palace grounds", distanceKm: [2, 6], settings: ["heritage"] },
  { id: "fort-view-guesthouse", name: "Fort View Guesthouse", type: "guesthouse", costPerNightInr: 1600, rating: 4.4, amenities: ["Rooftop café", "Monument view", "Wi-Fi"], area: "Below the fort", distanceKm: [0.5, 2.5], settings: ["heritage"] },
  { id: "old-city-homestay", name: "Old City Heritage Homestay", type: "homestay", costPerNightInr: 2200, rating: 4.5, amenities: ["Family home", "Cooking class", "Heritage walks"], area: "Old city", distanceKm: [0.5, 2], settings: ["heritage"] },
  { id: "jharokha-boutique", name: "Jharokha Boutique Hotel", type: "boutique", costPerNightInr: 4600, rating: 4.5, amenities: ["Carved balconies", "Café", "Craft shop"], area: "Old city", distanceKm: [0.5, 2], settings: ["heritage"] },
  { id: "bazaar-lane-hostel", name: "Bazaar Lane Hostel", type: "hostel", costPerNightInr: 550, rating: 4.2, amenities: ["Dorm beds", "Rooftop", "Walking tours"], area: "Bazaar", distanceKm: [0.3, 1.5], settings: ["heritage"] },

  // ── Backwaters & lakes ───────────────────────────────────────────────────
  { id: "lotus-houseboat", name: "Lotus Deluxe Houseboat", type: "houseboat", costPerNightInr: 7500, rating: 4.5, amenities: ["All meals", "Private crew", "Sunset cruise"], area: "On the water", distanceKm: [1, 6], settings: ["backwater"] },
  { id: "heron-houseboat", name: "Heron Budget Houseboat", type: "houseboat", costPerNightInr: 3900, rating: 4.1, amenities: ["Meals included", "Deck seating"], area: "On the water", distanceKm: [1, 6], settings: ["backwater"] },
  { id: "lakeshore-resort", name: "Lakeshore Resort", type: "resort", costPerNightInr: 8200, rating: 4.4, amenities: ["Lake view", "Pool", "Spa", "Kayaks"], area: "Lakeshore", distanceKm: [2, 8], settings: ["backwater"] },
  { id: "waterside-homestay", name: "Waterside Homestay", type: "homestay", costPerNightInr: 2100, rating: 4.6, amenities: ["Canoe rides", "Home-cooked meals", "Fishing"], area: "Canal side", distanceKm: [1, 5], settings: ["backwater"] },

  // ── Desert ───────────────────────────────────────────────────────────────
  { id: "dune-star-camp", name: "Dune Star Luxury Camp", type: "camp", costPerNightInr: 6500, rating: 4.4, amenities: ["Swiss tents", "Camel safari", "Folk music evening", "All meals"], area: "Sand dunes", distanceKm: [30, 45], settings: ["desert"] },
  { id: "desert-moon-camp", name: "Desert Moon Camp", type: "camp", costPerNightInr: 2200, rating: 4.0, amenities: ["Tents", "Dinner under the stars", "Jeep safari"], area: "Sand dunes", distanceKm: [30, 45], settings: ["desert"] },
  { id: "sand-castle-homestay", name: "Sand Castle Homestay", type: "homestay", costPerNightInr: 1800, rating: 4.3, amenities: ["Mud-house rooms", "Village meals", "Rooftop stargazing"], area: "Village outskirts", distanceKm: [2, 8], settings: ["desert"] },

  // ── Pilgrimage & spiritual towns ─────────────────────────────────────────
  { id: "ashram-rooms", name: "Ashram Guest Rooms", type: "ashram", costPerNightInr: 900, rating: 4.4, amenities: ["Vegetarian meals", "Morning yoga", "Meditation hall"], area: "Temple quarter", distanceKm: [0.5, 3], settings: ["spiritual"] },
  { id: "temple-view-guesthouse", name: "Temple View Guesthouse", type: "guesthouse", costPerNightInr: 1500, rating: 4.3, amenities: ["Rooftop view", "Vegetarian café", "Wi-Fi"], area: "Near the main temple", distanceKm: [0.3, 1.5], settings: ["spiritual"] },
  { id: "shanti-retreat", name: "Shanti Yoga Retreat", type: "retreat", costPerNightInr: 5200, rating: 4.6, amenities: ["Daily yoga", "Ayurvedic meals", "Riverside garden"], area: "Quiet outskirts", distanceKm: [3, 8], settings: ["spiritual"] },
  { id: "pilgrims-rest", name: "Pilgrim's Rest Dharamshala", type: "dharamshala", costPerNightInr: 450, rating: 3.9, amenities: ["Basic rooms", "Community kitchen"], area: "Temple quarter", distanceKm: [0.3, 1.5], settings: ["spiritual"] },

  // ── Wildlife ─────────────────────────────────────────────────────────────
  { id: "sal-forest-lodge", name: "Sal Forest Jungle Lodge", type: "jungle_lodge", costPerNightInr: 6200, rating: 4.5, amenities: ["Safari bookings", "Resident naturalist", "All meals"], area: "Park buffer zone", distanceKm: [2, 10], settings: ["wildlife"] },
  { id: "forest-edge-camp", name: "Forest Edge Camp", type: "camp", costPerNightInr: 2800, rating: 4.1, amenities: ["Tents", "Bird walks", "Campfire"], area: "Park gate", distanceKm: [1, 6], settings: ["wildlife"] },
];

export type SampleHotel = StayCandidate & {
  isSample: true;
  propertyType: PropertyType;
  rating: number;
  reviewCount: number;
  amenities: string[];
  area: string;
};

export type SampleHotelDestination = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  destinationType?: string | null;
};

// Destinations whose setting isn't captured by `destinationType` in the data
const SETTING_BY_SLUG: Record<string, HotelSetting[]> = {
  goa: ["beach"], panaji: ["beach"], pondicherry: ["beach", "heritage"], gokarna: ["beach"], varkala: ["beach"], andaman: ["beach"],
  manali: ["mountain"], shimla: ["mountain"], darjeeling: ["mountain"], gangtok: ["mountain"], munnar: ["mountain"],
  coorg: ["mountain"], shillong: ["mountain"], dharamshala: ["mountain", "spiritual"], ladakh: ["mountain", "desert"],
  "nubra-valley": ["mountain", "desert"], sohra: ["mountain"], dawki: ["mountain"], mawlynnong: ["mountain"],
  srinagar: ["mountain", "backwater"], "pangong-lake": ["mountain", "backwater"],
  jaipur: ["heritage", "city"], udaipur: ["heritage", "backwater"], jodhpur: ["heritage", "desert"], jaisalmer: ["heritage", "desert"],
  agra: ["heritage"], delhi: ["heritage", "city"], orchha: ["heritage"], khajuraho: ["heritage"], hampi: ["heritage"],
  mysuru: ["heritage"], kolkata: ["heritage", "city"], mumbai: ["city"], bengaluru: ["city"], chennai: ["city"], hyderabad: ["city"],
  alappuzha: ["backwater"], kochi: ["backwater", "heritage"],
  varanasi: ["spiritual", "heritage"], rishikesh: ["spiritual", "mountain"], haridwar: ["spiritual"], amritsar: ["spiritual", "heritage"],
};

const SETTING_BY_TYPE: Record<string, HotelSetting[]> = {
  beach: ["beach"], island: ["beach"],
  hill_station: ["mountain"], mountain: ["mountain"], valley: ["mountain"],
  heritage_site: ["heritage"], pilgrimage: ["spiritual"],
  lake: ["backwater"], national_park: ["wildlife"], wildlife_reserve: ["wildlife"],
};

// Rough price level vs. the archetype base price
const PRICE_LEVEL_BY_SLUG: Record<string, number> = {
  mumbai: 1.35, delhi: 1.25, bengaluru: 1.25, goa: 1.25, panaji: 1.2, udaipur: 1.2, ladakh: 1.15, "nubra-valley": 1.15,
  "pangong-lake": 1.15, srinagar: 1.1, kolkata: 1.1, jaipur: 1.05,
  orchha: 0.8, khajuraho: 0.85, hampi: 0.85, mawlynnong: 0.8, dawki: 0.8, sohra: 0.85, haridwar: 0.85, varanasi: 0.9,
};

export function hotelSettingsFor(dest: Pick<SampleHotelDestination, "slug" | "destinationType">): HotelSetting[] {
  const settings = new Set<HotelSetting>(["any"]);
  for (const s of SETTING_BY_SLUG[dest.slug] ?? []) settings.add(s);
  for (const s of SETTING_BY_TYPE[dest.destinationType ?? ""] ?? []) settings.add(s);
  return [...settings];
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let t = h >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const MAX_HOTELS_PER_DESTINATION = 28;

export function sampleHotelId(slug: string, archetypeId: string): string {
  return `sample:${slug}:${archetypeId}`;
}

/** Deterministic sample hotels for a destination (≈20–30, depending on its setting). */
export function getSampleHotelsForDestination(dest: SampleHotelDestination): SampleHotel[] {
  const settings = hotelSettingsFor(dest);
  const priceLevel = PRICE_LEVEL_BY_SLUG[dest.slug] ?? 1;
  const cosLat = Math.cos((dest.lat * Math.PI) / 180) || 1;

  const specific = SAMPLE_HOTEL_ARCHETYPES.filter((a) => a.settings.some((s) => s !== "any" && settings.includes(s)));
  // General-purpose archetypes fill the list; only multi-setting destinations with a very
  // long list lose a few (chosen per destination), keeping every list around 20–28.
  const general = SAMPLE_HOTEL_ARCHETYPES.filter((a) => a.settings.includes("any"));
  const droppable = general
    .slice(6)
    .map((a) => ({ a, r: seededRandom(`${dest.slug}:drop:${a.id}`)() }))
    .sort((x, y) => x.r - y.r);
  const dropCount = Math.max(0, specific.length + general.length - MAX_HOTELS_PER_DESTINATION);
  const dropped = new Set(droppable.slice(0, dropCount).map((d) => d.a.id));

  return [...specific, ...general.filter((a) => !dropped.has(a.id))].map((a) => {
    const rand = seededRandom(`${dest.slug}:${a.id}`);
    const distance = a.distanceKm[0] + rand() * (a.distanceKm[1] - a.distanceKm[0]);
    const bearing = rand() * 2 * Math.PI;
    const price = roundTo(a.costPerNightInr * priceLevel * (0.88 + rand() * 0.24), 50);
    const rating = Math.min(4.9, Math.max(2.8, Math.round((a.rating + (rand() - 0.5) * 0.4) * 10) / 10));

    return {
      id: sampleHotelId(dest.slug, a.id),
      name: a.name.replace("{D}", dest.name),
      costPerNightInr: price,
      lat: dest.lat + (distance * Math.cos(bearing)) / 111,
      lng: dest.lng + (distance * Math.sin(bearing)) / (111 * cosLat),
      isSample: true as const,
      propertyType: a.type,
      rating,
      reviewCount: Math.round(25 + rand() * 1400),
      amenities: [...a.amenities],
      area: a.area,
    };
  });
}

/** Server-side lookup when a sample hotel is selected — never trust client-sent prices. */
export function findSampleHotel(dest: SampleHotelDestination, id: string): SampleHotel | null {
  if (!id.startsWith(`sample:${dest.slug}:`)) return null;
  return getSampleHotelsForDestination(dest).find((h) => h.id === id) ?? null;
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  hostel: "Hostel", budget_hotel: "Budget hotel", guesthouse: "Guesthouse", homestay: "Homestay", mid_range: "Hotel",
  business: "Business hotel", boutique: "Boutique", upscale: "Upscale hotel", luxury: "Luxury", apartment: "Serviced apartment",
  eco_lodge: "Eco lodge", beach_hut: "Beach huts", resort: "Resort", cottage: "Cottages", camp: "Camp", heritage: "Heritage",
  houseboat: "Houseboat", ashram: "Ashram", retreat: "Retreat", dharamshala: "Dharamshala", jungle_lodge: "Jungle lodge",
};
