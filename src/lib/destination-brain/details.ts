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

export async function getDestinationDetails(name: string, context?: string): Promise<DestinationDetails> {
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
        take: 10
      }
    }
  });

  if (!dest) {
    throw new Error("Destination not found");
  }

  // Only count places with known, positive costs — unknown costs must NOT be treated as zero
  const placesWithKnownCost = dest.places.filter(p => p.typicalCostInr && p.typicalCostInr > 0);
  const costCoverage = placesWithKnownCost.length / Math.max(dest.places.length, 1);
  
  let averageDailyBudgetInr: number;
  let budgetLevelLabel: string;
  
  if (placesWithKnownCost.length >= 3) {
    // Enough data for a reasonable estimate
    const totalKnownCost = placesWithKnownCost.reduce((acc, p) => acc + (p.typicalCostInr ?? 0), 0);
    averageDailyBudgetInr = Math.round(totalKnownCost / placesWithKnownCost.length);
    budgetLevelLabel = averageDailyBudgetInr < 2000 ? "Budget" : averageDailyBudgetInr > 6000 ? "Luxury" : "Mid-range";
  } else {
    // Insufficient cost data — use a generic estimate with clear label
    averageDailyBudgetInr = 3000;
    budgetLevelLabel = "Estimate unavailable";
  }

  const mustVisitPlaces = dest.places
    .filter(p => p.category !== "stay") // Exclude stays from "must visit"
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
    vibe: "Relaxed and scenic",
    bestMonths: ["October", "November", "December", "January", "February", "March"],
    suggestedDays: { min: 2, max: 7 },
    budgetLevelLabel,
    averageDailyBudgetInr,
    mustVisitPlaces,
    localCuisine: ["Local Delicacies", "Street Food"],
    practicalTips: ["Carry cash", "Wear comfortable shoes", "Stay hydrated"],
  };
}
