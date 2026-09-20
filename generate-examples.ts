import { generateGroundedItinerary, TripBrainInput } from "./src/lib/trip-brain";
import { resolveDestination } from "./src/lib/destination-resolver";
import { getCandidatePlaces } from "./src/lib/travel-knowledge";
import fs from "fs";

const JAIPUR_INPUT: TripBrainInput = {
  maxTravelers: 2,
  destination: "Jaipur",
  startDate: new Date("2026-11-01"), // Sunday
  endDate: new Date("2026-11-03"), // Tuesday
  tripType: "MULTI_DAY",
  timeStatus: "UNKNOWN",
  startTime: null,
  endTime: null,
  budgetInr: 20000,
  paceLevel: "balanced",
  allPreferences: [],
  travelSegments: [],
  accommodations: [],
};

async function run() {
  const types = ["MULTI_DAY", "PICNIC", "DAY_TRIP", "OVERNIGHT", "WEEKEND"] as const;
  
  const results: Record<string, unknown> = {};
  
  for (const type of types) {
    const input = { ...JAIPUR_INPUT, tripType: type };
    if (type === "PICNIC") {
      input.endDate = null;
      input.startTime = "14:00";
      input.endTime = "18:00"; // 4 hours
    } else if (type === "DAY_TRIP") {
      input.endDate = null;
      input.startTime = "08:00";
      input.endTime = "20:00"; // 12 hours
    } else if (type === "OVERNIGHT") {
      input.endDate = null;
      input.startTime = "14:00";
      input.endTime = "14:00"; // 24 hours
    } else if (type === "WEEKEND") {
      input.startDate = new Date("2026-11-07"); // Saturday
      input.endDate = null;
    }
    
    console.log(`Running ${type}...`);
    try {
      const res = await generateGroundedItinerary(input);
      results[type] = res;
    } catch (e) {
      console.error(`Failed ${type}:`, e);
    }
  }
  
  fs.writeFileSync("audit-examples.json", JSON.stringify(results, null, 2));
  console.log("Done.");
}

run();
