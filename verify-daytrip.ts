import { generateGroundedItinerary, TripBrainInput } from "./src/lib/trip-brain";
import fs from "fs";

async function run() {
  const baseInput: TripBrainInput = {
    maxTravelers: 2,
    destination: "Jaipur",
    startDate: new Date("2026-11-07"),
    endDate: null,
    tripType: "DAY_TRIP",
    timeStatus: "UNKNOWN",
    budgetInr: 20000,
    paceLevel: "balanced",
    allPreferences: [],
    travelSegments: [],
    accommodations: [],
    startTime: null,
    endTime: null,
  };
  
  const res4h = await generateGroundedItinerary({ ...baseInput, startTime: "10:00", endTime: "14:00" });
  const res10h = await generateGroundedItinerary({ ...baseInput, startTime: "08:00", endTime: "18:00" });
  
  fs.writeFileSync("daytrip-4h.json", JSON.stringify(res4h, null, 2));
  fs.writeFileSync("daytrip-10h.json", JSON.stringify(res10h, null, 2));
  console.log("4h items:", res4h.days[0].items.length);
  console.log("10h items:", res10h.days[0].items.length);
}

run();
