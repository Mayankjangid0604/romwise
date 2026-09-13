export type PaceLevel = "easy" | "balanced" | "full";

export type PreferencePriority =
  | "must-have"
  | "very-important"
  | "preferred"
  | "nice-to-have"
  | "avoid"
  | "never";

export type Category =
  | "dining"
  | "sightseeing"
  | "adventure"
  | "culture"
  | "shopping"
  | "relaxation"
  | "nightlife"
  | "nature";

export type Preference = {
  category: Category;
  priority: PreferencePriority;
};

export type ItineraryItemOutput = {
  title: string;
  description: string;
  category: Category;
  startTime: string;
  endTime: string;
  estimatedCostInr: number;
  reasoning: string;
  order: number;
};

export type ItineraryDayOutput = {
  dayNumber: number;
  date: Date;
  items: ItineraryItemOutput[];
};

export type ItineraryInput = {
  destination: string;
  startDate: Date;
  endDate: Date;
  budgetInr: number;
  paceLevel: PaceLevel;
  preferences: Preference[];
};

const PRIORITY_WEIGHTS: Record<PreferencePriority, number> = {
  "must-have": 5,
  "very-important": 4,
  preferred: 3,
  "nice-to-have": 2,
  avoid: -3,
  never: -10,
};

const ACTIVITIES: Record<
  Category,
  { titles: string[]; descriptions: string[]; costRange: [number, number] }
> = {
  dining: {
    titles: [
      "Local breakfast",
      "Street food tour",
      "Fine dining experience",
      "Traditional lunch",
      "Sunset dinner",
      "Cafe hopping",
    ],
    descriptions: [
      "Sample authentic local cuisine at a well-reviewed restaurant",
      "Explore the vibrant street food scene with local specialties",
      "Enjoy an upscale dining experience with regional ingredients",
      "Taste traditional dishes at a family-run eatery",
      "Dine with a view as the sun sets over the destination",
      "Visit popular cafes known for their specialty drinks and snacks",
    ],
    costRange: [200, 2500],
  },
  sightseeing: {
    titles: [
      "Landmark walking tour",
      "Viewpoint visit",
      "Old quarter exploration",
      "Architecture tour",
      "Photo walk",
      "Historical monuments",
    ],
    descriptions: [
      "Walk through the most iconic landmarks and photo spots",
      "Visit the highest viewpoint for panoramic views of the area",
      "Wander through the charming old quarter and its hidden gems",
      "Admire the distinctive architecture spanning different eras",
      "Capture stunning photos at the most photogenic locations",
      "Explore historical monuments that define the destination's heritage",
    ],
    costRange: [0, 1000],
  },
  adventure: {
    titles: [
      "Hiking trail",
      "Water sports session",
      "Cycling tour",
      "Rock climbing",
      "Zipline experience",
      "Kayaking adventure",
    ],
    descriptions: [
      "Trek through scenic trails with varying difficulty levels",
      "Try water sports like jet skiing, parasailing, or surfing",
      "Cycle through scenic routes and discover hidden spots",
      "Challenge yourself at a local rock climbing spot",
      "Soar over the landscape on an exhilarating zipline",
      "Paddle through calm waters and explore the coastline",
    ],
    costRange: [500, 3000],
  },
  culture: {
    titles: [
      "Museum visit",
      "Cultural performance",
      "Art gallery tour",
      "Temple or heritage site",
      "Local craft workshop",
      "Festival or fair visit",
    ],
    descriptions: [
      "Explore exhibits showcasing local history and art",
      "Watch a traditional dance or music performance",
      "Browse contemporary and traditional artwork at a gallery",
      "Visit a sacred or heritage site significant to the region",
      "Learn a local craft from artisans in a hands-on workshop",
      "Experience a local festival or fair with music and food",
    ],
    costRange: [100, 1500],
  },
  shopping: {
    titles: [
      "Local market visit",
      "Souvenir shopping",
      "Artisan bazaar",
      "Night market",
      "Mall exploration",
      "Spice or tea market",
    ],
    descriptions: [
      "Browse vibrant local markets for unique finds",
      "Pick up souvenirs and gifts at specialty shops",
      "Explore an artisan bazaar with handcrafted goods",
      "Wander a bustling night market with food and goods",
      "Visit a modern mall for shopping and entertainment",
      "Discover aromatic spices and teas at a specialty market",
    ],
    costRange: [500, 3000],
  },
  relaxation: {
    titles: [
      "Spa treatment",
      "Beach relaxation",
      "Park visit",
      "Yoga session",
      "Pool time",
      "Meditation session",
    ],
    descriptions: [
      "Unwind with a rejuvenating spa or massage treatment",
      "Relax on a beautiful beach and soak up the sun",
      "Enjoy the tranquility of a local park or garden",
      "Join a morning yoga session to energize your day",
      "Spend a laid-back afternoon at the pool",
      "Find inner peace with a guided meditation session",
    ],
    costRange: [0, 2000],
  },
  nightlife: {
    titles: [
      "Rooftop bar",
      "Live music venue",
      "Night walk",
      "Beach bonfire",
      "Cocktail lounge",
      "Night cruise",
    ],
    descriptions: [
      "Enjoy drinks and views from a popular rooftop bar",
      "Listen to live music at a local venue",
      "Take a guided night walk through illuminated streets",
      "Gather around a bonfire on the beach under the stars",
      "Sip craft cocktails at a stylish lounge",
      "Cruise along the waterfront with drinks and music",
    ],
    costRange: [500, 3000],
  },
  nature: {
    titles: [
      "Nature walk",
      "Bird watching",
      "Waterfall visit",
      "Botanical garden",
      "Sunrise hike",
      "Wildlife sanctuary",
    ],
    descriptions: [
      "Explore lush trails and enjoy the natural beauty",
      "Spot local and migratory birds in their natural habitat",
      "Visit a stunning waterfall tucked away in nature",
      "Wander through a botanical garden with diverse flora",
      "Hike to a viewpoint in time for a breathtaking sunrise",
      "Visit a wildlife sanctuary to observe animals up close",
    ],
    costRange: [0, 1500],
  },
};

const ALL_CATEGORIES: Category[] = [
  "dining",
  "sightseeing",
  "adventure",
  "culture",
  "shopping",
  "relaxation",
  "nightlife",
  "nature",
];

const TIME_SLOTS: Record<PaceLevel, { start: string; end: string }[]> = {
  easy: [
    { start: "09:00", end: "10:30" },
    { start: "11:00", end: "12:30" },
    { start: "13:30", end: "15:00" },
    { start: "16:00", end: "17:30" },
  ],
  balanced: [
    { start: "08:00", end: "09:30" },
    { start: "10:00", end: "11:30" },
    { start: "12:00", end: "13:30" },
    { start: "14:30", end: "16:00" },
    { start: "16:30", end: "18:00" },
    { start: "19:00", end: "20:30" },
  ],
  full: [
    { start: "07:00", end: "08:30" },
    { start: "09:00", end: "10:30" },
    { start: "11:00", end: "12:30" },
    { start: "13:00", end: "14:30" },
    { start: "15:00", end: "16:30" },
    { start: "17:00", end: "18:30" },
    { start: "19:00", end: "20:30" },
    { start: "21:00", end: "22:30" },
  ],
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildCategoryWeights(preferences: Preference[]): Map<Category, number> {
  const weights = new Map<Category, number>();
  for (const cat of ALL_CATEGORIES) {
    weights.set(cat, 1);
  }
  for (const pref of preferences) {
    const w = PRIORITY_WEIGHTS[pref.priority];
    weights.set(pref.category, (weights.get(pref.category) || 1) + w);
  }
  return weights;
}

function selectCategories(
  slots: number,
  weights: Map<Category, number>,
  random: () => number,
  dayNumber: number,
): Category[] {
  const eligible = ALL_CATEGORIES.filter((c) => (weights.get(c) || 0) > -5);
  const selected: Category[] = [];

  const alwaysDining = eligible.includes("dining");
  if (alwaysDining) {
    if (slots >= 4) {
      selected.push("dining");
      if (slots >= 6) selected.push("dining");
    } else {
      selected.push("dining");
    }
  }

  while (selected.length < slots) {
    const remaining = eligible.filter(
      (c) =>
        selected.filter((s) => s === c).length <
        (c === "dining" ? 3 : 2),
    );
    if (remaining.length === 0) break;

    const totalWeight = remaining.reduce(
      (sum, c) => sum + Math.max(0, weights.get(c) || 0),
      0,
    );
    if (totalWeight === 0) {
      selected.push(remaining[Math.floor(random() * remaining.length)]);
      continue;
    }

    const lengthBefore = selected.length;
    let r = random() * totalWeight;
    for (const c of remaining) {
      r -= Math.max(0, weights.get(c) || 0);
      if (r <= 0) {
        selected.push(c);
        break;
      }
    }
    if (selected.length === lengthBefore) {
      selected.push(remaining[remaining.length - 1]);
    }
  }

  return selected.sort((a, b) => {
    const order: Record<string, number> = {
      dining: dayNumber % 2 === 0 ? 0 : 3,
      nature: 1,
      adventure: 2,
      sightseeing: 2,
      culture: 3,
      shopping: 4,
      relaxation: 4,
      nightlife: 6,
    };
    return (order[a] || 3) - (order[b] || 3);
  });
}

function buildReasoning(
  category: Category,
  preferences: Preference[],
  paceLevel: PaceLevel,
  timeSlot: { start: string; end: string },
  dayNumber: number,
): string {
  const pref = preferences.find((p) => p.category === category);
  const parts: string[] = [];

  if (pref) {
    switch (pref.priority) {
      case "must-have":
        parts.push(
          `${category} is a must-have preference, so it's prioritized in the schedule`,
        );
        break;
      case "very-important":
        parts.push(
          `${category} is marked as very important, given a prominent slot`,
        );
        break;
      case "preferred":
        parts.push(`${category} is a preferred activity type`);
        break;
      case "nice-to-have":
        parts.push(`${category} included as a nice-to-have activity`);
        break;
      case "avoid":
        parts.push(
          `${category} is marked as avoid but included lightly for variety`,
        );
        break;
      default:
        parts.push(`${category} selected to add variety to day ${dayNumber}`);
    }
  } else {
    parts.push(
      `${category} selected for variety — a well-rounded day includes diverse experiences`,
    );
  }

  const hour = parseInt(timeSlot.start.split(":")[0]);
  if (hour < 10) {
    parts.push("scheduled in the morning when energy is fresh");
  } else if (hour < 14) {
    parts.push("placed in the midday slot for optimal enjoyment");
  } else if (hour < 18) {
    parts.push("afternoon timing allows for a relaxed experience");
  } else {
    parts.push("evening slot perfect for winding down the day");
  }

  if (paceLevel === "easy") {
    parts.push("spacing allows plenty of downtime between activities");
  } else if (paceLevel === "full") {
    parts.push("packed schedule maximizes exploration time");
  }

  return parts.join(". ") + ".";
}

export function generateItinerary(input: ItineraryInput): ItineraryDayOutput[] {
  const { destination, startDate, endDate, budgetInr, paceLevel, preferences } =
    input;

  const seed = hashString(
    `${destination}-${startDate.toISOString()}-${endDate.toISOString()}`,
  );
  const random = seededRandom(seed);

  const dayCount =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;

  const slots = TIME_SLOTS[paceLevel];
  const dailyBudget = Math.floor(budgetInr / dayCount);
  const categoryWeights = buildCategoryWeights(preferences);

  const days: ItineraryDayOutput[] = [];

  const usedTitlesByCategory = new Map<Category, Set<number>>();

  for (let d = 0; d < dayCount; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);

    const categories = selectCategories(
      slots.length,
      categoryWeights,
      random,
      d + 1,
    );

    const items: ItineraryItemOutput[] = [];
    let daySpent = 0;

    for (let s = 0; s < Math.min(categories.length, slots.length); s++) {
      const cat = categories[s];
      const slot = slots[s];
      const activity = ACTIVITIES[cat];

      if (!usedTitlesByCategory.has(cat)) {
        usedTitlesByCategory.set(cat, new Set());
      }
      const used = usedTitlesByCategory.get(cat)!;

      let titleIdx = Math.floor(random() * activity.titles.length);
      let attempts = 0;
      while (used.has(titleIdx) && attempts < activity.titles.length) {
        titleIdx = (titleIdx + 1) % activity.titles.length;
        attempts++;
      }
      used.add(titleIdx);
      if (used.size >= activity.titles.length) {
        usedTitlesByCategory.set(cat, new Set());
      }

      const [minCost, maxCost] = activity.costRange;
      const remainingBudget = dailyBudget - daySpent;
      const cost = Math.min(
        Math.floor(minCost + random() * (maxCost - minCost)),
        Math.max(remainingBudget, minCost),
      );
      daySpent += cost;

      const title = `${activity.titles[titleIdx]} in ${destination}`;
      const description = activity.descriptions[titleIdx];
      const reasoning = buildReasoning(
        cat,
        preferences,
        paceLevel,
        slot,
        d + 1,
      );

      items.push({
        title,
        description,
        category: cat,
        startTime: slot.start,
        endTime: slot.end,
        estimatedCostInr: cost,
        reasoning,
        order: s + 1,
      });
    }

    days.push({
      dayNumber: d + 1,
      date,
      items,
    });
  }

  return days;
}
