import { generateGroundedItinerary, TripBrainInput } from "./src/lib/trip-brain";
import fs from "fs";

async function run() {
  const baseInput: TripBrainInput = {
    maxTravelers: 2,
    destination: "Jaipur",
    startDate: new Date("2026-11-07"),
    endDate: null,
    tripType: "PICNIC",
    timeStatus: "UNKNOWN",
    budgetInr: 20000,
    paceLevel: "balanced",
    allPreferences: [],
    travelSegments: [],
    accommodations: [],
    startTime: null,
    endTime: null,
  };
  
  const res2h = await generateGroundedItinerary({ ...baseInput, startTime: "10:00", endTime: "12:00" });
  const res8h = await generateGroundedItinerary({ ...baseInput, startTime: "10:00", endTime: "18:00" });
  
  fs.writeFileSync("picnic-2h.json", JSON.stringify(res2h, null, 2));
  fs.writeFileSync("picnic-8h.json", JSON.stringify(res8h, null, 2));
  console.log("2h items:", res2h.days[0].items.length);
  console.log("8h items:", res8h.days[0].items.length);
}

run();
