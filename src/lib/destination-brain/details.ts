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

  // Calculate some average budget from places, or fallback to default
  const avgCost = dest.places.reduce((acc, place) => acc + (place.typicalCostInr || 0), 0);
  const averageDailyBudgetInr = avgCost > 0 ? avgCost / dest.places.length : 3000;
  
  let budgetLevelLabel = "Mid-range";
  if (averageDailyBudgetInr < 2000) budgetLevelLabel = "Budget";
  if (averageDailyBudgetInr > 6000) budgetLevelLabel = "Luxury";

  const mustVisitPlaces = dest.places.map(p => ({
    name: p.name,
    description: p.description || p.category,
    category: p.category,
    bestFor: p.bestFor || "General Visit",
    tipForVisiting: p.vibes || "Enjoy the view!"
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
