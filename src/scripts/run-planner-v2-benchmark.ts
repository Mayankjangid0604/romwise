import { generateItineraryV2 } from "../lib/planner-v2/engine";
import { resolveDestination } from "../lib/destination-resolver";
import type { CandidateQuery } from "../lib/travel-knowledge";
import fs from "fs";

const DESTINATIONS = [
  "Jaipur, India", "Delhi, India", "Mumbai, India", "Goa, India", 
  "Udaipur, India", "Varanasi, India", "Manali, India", "Kochi, India", 
  "Munnar, India", "Hampi, India"
];

const PACES = ["relaxed", "balanced", "full"];
const BUDGETS = [1000, 3000, 10000];
const DURATIONS = [1, 3, 5];

export type BenchmarkMetrics = {
  scenarioId: string;
  destination: string;
  duration: number;
  pace: string;
  budget: number;
  success: boolean;
  error?: string;
  candidateCount: number;
  selectedCount: number;
  validPlaceRate: number;
  hallucinatedPlaceCount: number;
  duplicatePlaceCount: number;
  timeOverlapCount: number;
  budgetFit: number;
  knownCostCount: number;
  unknownCostItemCount: number;
  generationDurationMs: number;
};

async function runBenchmark() {
  console.log("Starting Planner Engine V2 ACCEPTANCE Benchmark...");
  const t0 = Date.now();
  
  const results: BenchmarkMetrics[] = [];
  let scenariosRun = 0;

  for (const destName of DESTINATIONS) {
    let resolvedId: string;
    try {
      const res = await resolveDestination(destName);
      if (!res) throw new Error("Not found");
      resolvedId = res.id;
    } catch (e) {
      console.log(`[SKIP] Insufficient data for destination: ${destName}`);
      continue;
    }

    for (const duration of DURATIONS) {
      for (const pace of PACES) {
        for (const budget of BUDGETS) {
          scenariosRun++;
          const scenarioId = `S_${scenariosRun}_${destName.split(",")[0]}_${duration}d_${pace}_b${budget}`;
          
          const query: CandidateQuery = {
            destinationId: resolvedId,
            allPreferences: [], // Generic
            budgetPerDayInr: budget,
            limit: 100,
          };
          
          try {
            const result = await generateItineraryV2(query, duration, pace, new Date());
            
            results.push({
              scenarioId,
              destination: destName,
              duration,
              pace,
              budget,
              success: true,
              candidateCount: result.metrics.candidateCount,
              selectedCount: result.metrics.selectedCount,
              validPlaceRate: result.metrics.validPlaceRate,
              hallucinatedPlaceCount: result.metrics.hallucinatedPlaceCount,
              duplicatePlaceCount: result.metrics.duplicatePlaceCount,
              timeOverlapCount: result.metrics.timeOverlapCount,
              budgetFit: result.metrics.budgetFit,
              knownCostCount: result.metrics.knownCost,
              unknownCostItemCount: result.metrics.unknownCostItemCount,
              generationDurationMs: result.metrics.generationDurationMs,
            });
            console.log(`✅ [${scenarioId}] Success (${result.metrics.generationDurationMs}ms)`);
          } catch (error: unknown) {
             const errorMessage = error instanceof Error ? error.message : String(error);
             results.push({
              scenarioId,
              destination: destName,
              duration,
              pace,
              budget,
              success: false,
              error: errorMessage,
              candidateCount: 0,
              selectedCount: 0,
              validPlaceRate: 0,
              hallucinatedPlaceCount: 0,
              duplicatePlaceCount: 0,
              timeOverlapCount: 0,
              budgetFit: 0,
              knownCostCount: 0,
              unknownCostItemCount: 0,
              generationDurationMs: 0,
            });
            console.log(`❌ [${scenarioId}] Failed: ${errorMessage}`);
          }
        }
      }
    }
  }

  const successful = results.filter(r => r.success);
  
  const avgGenerationTime = successful.reduce((sum, r) => sum + r.generationDurationMs, 0) / (successful.length || 1);
  const totalHallucinated = successful.reduce((sum, r) => sum + r.hallucinatedPlaceCount, 0);
  const totalDuplicates = successful.reduce((sum, r) => sum + r.duplicatePlaceCount, 0);
  const totalOverlaps = successful.reduce((sum, r) => sum + r.timeOverlapCount, 0);
  
  const summary = {
    totalScenarios: scenariosRun,
    successful: successful.length,
    failed: results.length - successful.length,
    avgGenerationTimeMs: Math.round(avgGenerationTime),
    totalHallucinated,
    totalDuplicates,
    totalOverlaps,
  };

  fs.writeFileSync("planner-v2-benchmark.json", JSON.stringify({ summary, results }, null, 2));
  
  let markdown = `# PLANNER V2 BENCHMARK RESULTS\n\n`;
  markdown += `**Scenarios Run**: ${summary.totalScenarios}\n`;
  markdown += `**Success Rate**: ${Math.round((summary.successful / summary.totalScenarios) * 100)}%\n`;
  markdown += `**Avg Generation Time**: ${summary.avgGenerationTimeMs}ms\n`;
  markdown += `**Total Hallucinations**: ${summary.totalHallucinated}\n`;
  markdown += `**Total Duplicates**: ${summary.totalDuplicates}\n`;
  markdown += `**Total Overlaps**: ${summary.totalOverlaps}\n\n`;

  fs.writeFileSync("PLANNER-V2-BENCHMARK.md", markdown);

  console.log("\nBenchmark complete. Saved to planner-v2-benchmark.json and PLANNER-V2-BENCHMARK.md");
}

runBenchmark().catch(console.error);
