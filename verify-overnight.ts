import { generateGroundedItinerary, TripBrainInput } from "./src/lib/trip-brain";
import fs from "fs";

async function run() {
  const input: TripBrainInput = {
    maxTravelers: 2,
    destination: "Jaipur",
    startDate: new Date("2026-11-07"), // Saturday
    endDate: null,
    tripType: "OVERNIGHT",
    timeStatus: "UNKNOWN",
    startTime: "14:00",
    endTime: "14:00",
    budgetInr: 20000,
    paceLevel: "balanced",
    allPreferences: [],
    travelSegments: [],
    accommodations: [],
  };
  
  const res = await generateGroundedItinerary(input);
  fs.writeFileSync("overnight-proof.json", JSON.stringify(res, null, 2));
  console.log("Done");
}

run();
