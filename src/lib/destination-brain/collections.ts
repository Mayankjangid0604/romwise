import { CollectionTheme } from "./types";

export interface CollectionDefinition {
  id: CollectionTheme;
  title: string;
  description: string;
  // Raw SQL weighting for sorting
  scoreSql: string;
}

export const COLLECTIONS: Record<CollectionTheme, CollectionDefinition> = {
  mountains: {
    id: "mountains",
    title: "Mountains & Hills",
    description: "Mountain towns, valleys, viewpoints and high-altitude escapes",
    scoreSql: `
      SUM(CASE WHEN p.category = 'nature' THEN 1 ELSE 0 END) * 1.0 +
      SUM(CASE WHEN p.category = 'adventure' THEN 1.5 ELSE 0 END) +
      SUM(CASE WHEN p."placeType" IN ('viewpoint', 'peak', 'waterfall') THEN 2.0 ELSE 0 END)
    `,
  },
  beaches: {
    id: "beaches",
    title: "Beaches & Coast",
    description: "Coastal destinations, beaches and seaside escapes",
    scoreSql: `
      SUM(CASE WHEN p."placeType" = 'beach' THEN 5.0 ELSE 0 END) +
      SUM(CASE WHEN p.category = 'nature' AND p.name ILIKE '%beach%' THEN 5.0 ELSE 0 END)
    `,
  },
  forests: {
    id: "forests",
    title: "Forests & Greenery",
    description: "Forests, waterfalls, parks and green retreats",
    scoreSql: `
      SUM(CASE WHEN p."placeType" IN ('national_park', 'forest', 'garden', 'waterfall') THEN 3.0 ELSE 0 END) +
      SUM(CASE WHEN p.category = 'nature' THEN 1.0 ELSE 0 END)
    `,
  },
  nature: {
    id: "nature",
    title: "Nature Escapes",
    description: "Lakes, parks, waterfalls, valleys and natural attractions",
    scoreSql: `
      SUM(CASE WHEN p.category = 'nature' THEN 2.0 ELSE 0 END) +
      SUM(CASE WHEN p."placeType" IN ('lake', 'waterfall', 'national_park', 'garden', 'cave') THEN 2.0 ELSE 0 END)
    `,
  },
  heritage: {
    id: "heritage",
    title: "Heritage & History",
    description: "Forts, palaces, monuments and historic cities",
    scoreSql: `
      SUM(CASE WHEN p.category = 'history' THEN 2.0 ELSE 0 END) +
      SUM(CASE WHEN p.category = 'culture' THEN 1.0 ELSE 0 END) +
      SUM(CASE WHEN p."placeType" IN ('fort', 'palace', 'monument', 'archaeological_site', 'world_heritage_site') THEN 3.0 ELSE 0 END)
    `,
  },
  spiritual: {
    id: "spiritual",
    title: "Spiritual",
    description: "Temples, monasteries, mosques, churches and pilgrimage destinations",
    scoreSql: `
      SUM(CASE WHEN p.category = 'spiritual' THEN 2.0 ELSE 0 END) +
      SUM(CASE WHEN p."placeType" IN ('temple', 'church', 'mosque') THEN 2.0 ELSE 0 END)
    `,
  },
  wildlife: {
    id: "wildlife",
    title: "Wildlife",
    description: "National parks, sanctuaries, zoos and wildlife destinations",
    scoreSql: `
      SUM(CASE WHEN p."placeType" IN ('national_park', 'zoo', 'wildlife_sanctuary') THEN 5.0 ELSE 0 END) +
      SUM(CASE WHEN p.name ILIKE '%sanctuary%' OR p.name ILIKE '%national park%' THEN 3.0 ELSE 0 END)
    `,
  },
  adventure: {
    id: "adventure",
    title: "Adventure",
    description: "Trekking, mountain, outdoor and adventure-oriented destinations",
    scoreSql: `
      SUM(CASE WHEN p.category = 'adventure' THEN 5.0 ELSE 0 END) +
      SUM(CASE WHEN p.name ILIKE '%trek%' OR p.name ILIKE '%camp%' THEN 3.0 ELSE 0 END)
    `,
  },
  romantic: {
    id: "romantic",
    title: "Romantic",
    description: "Scenic, relaxing and couple-friendly destinations",
    scoreSql: `
      SUM(CASE WHEN p.category IN ('relaxation', 'nature', 'sightseeing') THEN 1.0 ELSE 0 END) +
      SUM(CASE WHEN p.vibes ILIKE '%romantic%' OR p.vibes ILIKE '%scenic%' THEN 2.0 ELSE 0 END)
    `,
  },
  family: {
    id: "family",
    title: "Family",
    description: "Destinations with strong family-friendly activity coverage",
    scoreSql: `
      SUM(CASE WHEN p.category = 'family' THEN 5.0 ELSE 0 END) +
      SUM(CASE WHEN p."placeType" IN ('zoo', 'museum', 'garden') THEN 2.0 ELSE 0 END)
    `,
  },
  food: {
    id: "food",
    title: "Food & Culture",
    description: "Destinations with dining and cultural depth",
    scoreSql: `
      SUM(CASE WHEN p.category IN ('dining', 'restaurant', 'cafe', 'culture') THEN 3.0 ELSE 0 END) +
      SUM(CASE WHEN p.vibes ILIKE '%culinary%' THEN 2.0 ELSE 0 END)
    `,
  },
  photography: {
    id: "photography",
    title: "Photography",
    description: "Viewpoints, heritage, landscapes and photogenic places",
    scoreSql: `
      SUM(CASE WHEN p.category = 'photography' THEN 5.0 ELSE 0 END) +
      SUM(CASE WHEN p.vibes ILIKE '%photogenic%' OR p.vibes ILIKE '%scenic%' THEN 2.0 ELSE 0 END) +
      SUM(CASE WHEN p.category IN ('history', 'nature') THEN 0.5 ELSE 0 END)
    `,
  },
  weekend: {
    id: "weekend",
    title: "Weekend Escapes",
    description: "Destinations suitable for short trips",
    scoreSql: `
      -- Balance: not too few, not too many places. But simpler: prioritize places with high popularity and good stay coverage
      SUM(CASE WHEN p.category NOT IN ('stay', 'transport') THEN 1.0 ELSE 0 END)
    `,
  },
  relaxing: {
    id: "relaxing",
    title: "Relaxing",
    description: "Lower-density, nature and relaxation-oriented trips",
    scoreSql: `
      SUM(CASE WHEN p.category = 'relaxation' THEN 5.0 ELSE 0 END) +
      SUM(CASE WHEN p.vibes ILIKE '%peaceful%' OR p.vibes ILIKE '%calm%' OR p.vibes ILIKE '%serene%' THEN 2.0 ELSE 0 END)
    `,
  },
  backpacking: {
    id: "backpacking",
    title: "Backpacking",
    description: "Destinations suited to flexible, activity-rich travel",
    scoreSql: `
      SUM(CASE WHEN p.category IN ('adventure', 'local_experience', 'history') THEN 1.0 ELSE 0 END) +
      SUM(CASE WHEN p."placeType" = 'hostel' THEN 5.0 ELSE 0 END)
    `,
  },
};
