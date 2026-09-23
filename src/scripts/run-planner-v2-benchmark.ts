import { generateItineraryV2 } from "../lib/planner-v2/engine";
import { resolveDestination } from "../lib/destination-resolver";
import type { CandidateQuery } from "../lib/travel-knowledge";

async function runBenchmark() {
  console.log("Starting Planner Engine V2 Benchmark...");
  const t0 = Date.now();

  const destinationId = "delhi_india"; 
  const startDate = new Date();
  
  const query: CandidateQuery = {
    destinationId,
    allPreferences: [
      { id: "p1", memberId: "m1", category: "history", priority: "must", weight: 3 },
      { id: "p2", memberId: "m1", category: "culture", priority: "must", weight: 3 },
    ],
    budgetPerDayInr: 2000,
    limit: 50,
  };

  try {
    const res = await resolveDestination("Delhi, India");
    query.destinationId = res.id;
  } catch (e) {
    console.log("Using fallback destination Delhi");
  }

  const result = await generateItineraryV2(query, 3, "moderate", startDate);
  
  console.log("--- Benchmark Results ---");
  console.log(`Generated in ${result.metrics.generationDurationMs}ms`);
  console.log(`Candidates: ${result.metrics.candidateCount}`);
  console.log(`Selected Items: ${result.metrics.selectedCount}`);
  console.log(`Valid Place Rate: ${(result.metrics.validPlaceRate * 100).toFixed(1)}%`);
  console.log(`Time Overlaps: ${result.metrics.timeOverlapCount}`);
  console.log(`Duplicate Places: ${result.metrics.duplicatePlaceCount}`);
  console.log(`Budget Fit: ${result.metrics.budgetFit}`);
  
  console.log("\nSample Day 1:");
  if (result.days[0]) {
    result.days[0].items.forEach(i => {
      console.log(`- ${i.startTime} - ${i.endTime}: [${i.category}] ${i.title}`);
    });
  }

  const totalTime = Date.now() - t0;
  console.log(`\nBenchmark completed in ${totalTime}ms`);
}

runBenchmark().catch(console.error);
