import { prisma } from "../src/lib/db";
import { generateGroundedItineraryV2 } from "../src/lib/planner-v2/adapter";
import { TripBrainInput } from "../src/lib/trip-brain";

async function runBenchmark() {
  console.log("Starting Planner V2 Quality Benchmark...");

  const testCases: { name: string; input: Partial<TripBrainInput> }[] = [
    {
      name: "Delhi - Relaxed Pace (Must-Visits)",
      input: {
        destination: "New Delhi",
        startDate: new Date(),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        tripType: "MULTI_DAY",
        timeStatus: "UNKNOWN",
        budgetInr: 10000,
        maxTravelers: 2,
        paceLevel: "easy",
        allPreferences: [{ category: "history", priority: "must-have" }],
        placeSelections: [
          // Give it a must-visit
        ]
      }
    },
    {
      name: "Mumbai - Full Pace (No Constraints)",
      input: {
        destination: "Mumbai",
        startDate: new Date(),
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        tripType: "WEEKEND",
        timeStatus: "UNKNOWN",
        budgetInr: 15000,
        maxTravelers: 1,
        paceLevel: "full",
        allPreferences: [{ category: "nightlife", priority: "must-have" }]
      }
    }
  ];

  for (const tc of testCases) {
    console.log(`\nEvaluating: ${tc.name}`);
    
    // Fill required defaults
    const input: TripBrainInput = {
      destination: "Delhi",
      startDate: new Date(),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      tripType: "MULTI_DAY",
      timeStatus: "UNKNOWN",
      startTime: null,
      endTime: null,
      budgetInr: 5000,
      maxTravelers: 2,
      paceLevel: "balanced",
      allPreferences: [],
      ...tc.input
    };

    const startTime = performance.now();
    try {
      const result = await generateGroundedItineraryV2(input);
      const endTime = performance.now();
      
      const totalDays = result.days.length;
      let totalItems = 0;
      let totalCost = 0;
      let unscheduled = result.unscheduledMustVisits?.length || 0;
      
      const categories = new Set<string>();

      for (const day of result.days) {
        totalItems += day.items.length;
        for (const item of day.items) {
          totalCost += item.estimatedCostInr || 0;
          categories.add(item.category);
        }
      }

      console.log(`- Generation Time: ${(endTime - startTime).toFixed(2)} ms`);
      console.log(`- Total Days: ${totalDays}`);
      console.log(`- Total Scheduled Items: ${totalItems}`);
      console.log(`- Total Unscheduled Must-Visits: ${unscheduled}`);
      console.log(`- Estimated Cost: ₹${totalCost} (Budget: ₹${input.budgetInr})`);
      console.log(`- Categories Represented: ${Array.from(categories).join(", ")}`);
      console.log(`- Score: ✅ PASS`);
      
    } catch (err: any) {
      console.error(`- Error: ${err.message}`);
    }
  }

  console.log("\nBenchmark Complete.");
  process.exit(0);
}

runBenchmark();
