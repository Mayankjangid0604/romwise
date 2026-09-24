import { prisma } from "@/lib/db";

export type DestinationDetails = {
  name: string;
  tagline: string;
  overview: string;
  vibe: string;
  bestMonths: string[];
  suggestedDays: {
    min: number;
    max: number;
  };
  budgetLevelLabel: string;
  averageDailyBudgetInr: number;
  mustVisitPlaces: {
    name: string;
    description: string;
    category: string;
    bestFor: string;
    tipForVisiting: string;
  }[];
  localCuisine: string[];
  practicalTips: string[];
};

const SEASON_TO_MONTHS: Record<string, string[]> = {
  "Oct–Mar": ["October", "November", "December", "January", "February", "March"],
  "Oct-Mar": ["October", "November", "December", "January", "February", "March"],
  "Nov–Feb": ["November", "December", "January", "February"],
  "Nov-Feb": ["November", "December", "January", "February"],
  "Sep–Mar": ["September", "October", "November", "December", "January", "February", "March"],
  "Sep-Mar": ["September", "October", "November", "December", "January", "February", "March"],
  "Apr–Jun": ["April", "May", "June"],
  "Apr-Jun": ["April", "May", "June"],
  "Mar–Jun": ["March", "April", "May", "June"],
  "Mar-Jun": ["March", "April", "May", "June"],
  "Jul–Sep": ["July", "August", "September"],
  "Jul-Sep": ["July", "August", "September"],
  "Year-round": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

function bestMonthsFromPlaces(places: { bestSeason: string | null }[]): string[] {
  const monthCounts: Record<string, number> = {};
  for (const p of places) {
    if (!p.bestSeason) continue;
    const months = SEASON_TO_MONTHS[p.bestSeason.trim()];
    if (months) {
      for (const m of months) monthCounts[m] = (monthCounts[m] || 0) + 1;
    }
  }
  if (Object.keys(monthCounts).length === 0) return ["October", "November", "December", "January", "February", "March"];

  const sorted = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
  const threshold = sorted[0][1] * 0.5;
  const allMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return allMonths.filter(m => (monthCounts[m] || 0) >= threshold);
}

function vibeFromPlaces(places: { vibes: string | null; category: string }[]): string {
  const vibeSet = new Set<string>();
  for (const p of places) {
    if (p.vibes) {
      for (const v of p.vibes.split(/[,;]+/).map(s => s.trim()).filter(Boolean)) {
        vibeSet.add(v);
      }
    }
  }
  if (vibeSet.size > 0) {
    const picked = [...vibeSet].slice(0, 3);
    return picked.join(", ");
  }
  // Derive from categories
  const cats = new Set(places.map(p => p.category));
  if (cats.has("adventure")) return "Adventurous and energetic";
  if (cats.has("spiritual")) return "Spiritual and serene";
  if (cats.has("nature")) return "Natural and peaceful";
  if (cats.has("history")) return "Historic and cultural";
  return "Vibrant and diverse";
}

function suggestedDaysFromPlaces(places: { durationMinutes: number | null }[]): { min: number; max: number } {
  const totalMinutes = places.reduce((acc, p) => acc + (p.durationMinutes || 60), 0);
  const fullDays = Math.ceil(totalMinutes / 480); // ~8 hours of sightseeing per day
  return { min: Math.max(2, Math.floor(fullDays * 0.6)), max: Math.max(3, fullDays) };
}

export async function getDestinationDetails(name: string, _context?: string): Promise<DestinationDetails> {
  const dest = await prisma.travelDestination.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive"
      }
    },
    include: {
      places: {
        orderBy: { popularityScore: "desc" },
        take: 15
      }
    }
  });

  if (!dest) {
    throw new Error("Destination not found");
  }

  const placesWithKnownCost = dest.places.filter(p => p.typicalCostInr && p.typicalCostInr > 0);

  let averageDailyBudgetInr: number;
  let budgetLevelLabel: string;

  if (placesWithKnownCost.length >= 3) {
    const totalKnownCost = placesWithKnownCost.reduce((acc, p) => acc + (p.typicalCostInr ?? 0), 0);
    averageDailyBudgetInr = Math.round(totalKnownCost / placesWithKnownCost.length);
    budgetLevelLabel = averageDailyBudgetInr < 2000 ? "Budget" : averageDailyBudgetInr > 6000 ? "Luxury" : "Mid-range";
  } else {
    averageDailyBudgetInr = 3000;
    budgetLevelLabel = "Estimate unavailable";
  }

  const mustVisitPlaces = dest.places
    .filter(p => p.category !== "stay")
    .map(p => ({
      name: p.name,
      description: p.description || p.category,
      category: p.category,
      bestFor: p.bestFor || "General Visit",
      tipForVisiting: p.vibes || "Enjoy the experience!"
    }));

  return {
    name: dest.name,
    tagline: `Explore ${dest.name}, ${dest.state}`,
    overview: dest.description || `A beautiful destination in ${dest.state}.`,
    vibe: vibeFromPlaces(dest.places),
    bestMonths: bestMonthsFromPlaces(dest.places),
    suggestedDays: suggestedDaysFromPlaces(dest.places),
    budgetLevelLabel,
    averageDailyBudgetInr,
    mustVisitPlaces,
    localCuisine: cuisineFromPlaces(dest.places),
    practicalTips: tipsFromDestination(dest, dest.places),
  };
}

function cuisineFromPlaces(places: { category: string; name: string; description: string | null }[]): string[] {
  const diningPlaces = places.filter(p =>
    p.category === "dining" || p.category === "restaurant" || p.category === "cafe" ||
    p.name.toLowerCase().includes("food") || p.name.toLowerCase().includes("bazaar") ||
    p.name.toLowerCase().includes("market")
  );
  if (diningPlaces.length > 0) {
    return diningPlaces.slice(0, 5).map(p => p.name);
  }
  // Fallback: look for food mentions in descriptions
  const foodMentions = places
    .filter(p => p.description?.toLowerCase().includes("food") || p.description?.toLowerCase().includes("cuisine"))
    .slice(0, 3)
    .map(p => `Try local food near ${p.name}`);
  return foodMentions.length > 0 ? foodMentions : ["Local street food", "Regional cuisine"];
}

function tipsFromDestination(dest: { state: string; destinationType: string | null }, places: { bestSeason: string | null; openingTime: string | null; closingTime: string | null }[]): string[] {
  const tips: string[] = [];

  // Opening hours tip
  const earlyClose = places.filter(p => p.closingTime && p.closingTime <= "17:00");
  if (earlyClose.length > places.length * 0.5) {
    tips.push("Most attractions close by 5 PM — start your day early");
  }

  // Season tip
  const bestMonths = bestMonthsFromPlaces(places);
  if (bestMonths.length < 12) {
    tips.push(`Best visited during ${bestMonths.slice(0, 3).join(", ")}`);
  }

  tips.push("Carry cash for entry tickets at heritage sites");
  tips.push("Wear comfortable walking shoes");

  if (dest.destinationType === "pilgrimage" || dest.destinationType === "spiritual") {
    tips.push("Dress modestly when visiting temples and religious sites");
  }

  return tips.slice(0, 5);
}
