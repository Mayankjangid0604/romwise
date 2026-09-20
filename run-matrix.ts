import { generateGroundedItinerary, TripBrainInput } from "./src/lib/trip-brain";
import fs from "fs";

interface MatrixCase {
  id: number;
  tripType: string;
  startDateStr: string;
  endDateStr: string | null;
  startTime: string | null;
  endTime: string | null;
  destination: string;
  desc: string;
}

const cases: MatrixCase[] = [
  { id: 1, tripType: "PICNIC", startDateStr: "2026-11-07", endDateStr: null, startTime: "06:00", endTime: "08:00", destination: "Jaipur", desc: "Very short (2h), very early morning" },
  { id: 2, tripType: "PICNIC", startDateStr: "2026-11-07", endDateStr: null, startTime: "10:00", endTime: "12:00", destination: "Jaipur", desc: "2h midday" },
  { id: 3, tripType: "PICNIC", startDateStr: "2026-11-07", endDateStr: null, startTime: "14:00", endTime: "20:00", destination: "Jaipur", desc: "6h afternoon/evening" },
  { id: 4, tripType: "PICNIC", startDateStr: "2026-11-07", endDateStr: null, startTime: "09:00", endTime: "21:00", destination: "Jaipur", desc: "12h" },
  { id: 5, tripType: "DAY_TRIP", startDateStr: "2026-11-07", endDateStr: null, startTime: "07:00", endTime: "09:00", destination: "Jaipur", desc: "Very short (2h) day trip" },
  { id: 6, tripType: "DAY_TRIP", startDateStr: "2026-11-07", endDateStr: null, startTime: "08:00", endTime: "20:00", destination: "Jaipur", desc: "Standard 12h full day" },
  { id: 7, tripType: "DAY_TRIP", startDateStr: "2026-11-07", endDateStr: null, startTime: "22:00", endTime: "23:59", destination: "Jaipur", desc: "Very short, very late" },
  { id: 8, tripType: "OVERNIGHT", startDateStr: "2026-11-07", endDateStr: null, startTime: "14:00", endTime: "14:00", destination: "Jaipur", desc: "Already tested 14:00" },
  { id: 9, tripType: "OVERNIGHT", startDateStr: "2026-11-07", endDateStr: null, startTime: "22:00", endTime: "22:00", destination: "Jaipur", desc: "Late-night start" },
  { id: 10, tripType: "OVERNIGHT", startDateStr: "2026-11-07", endDateStr: null, startTime: "06:00", endTime: "06:00", destination: "Jaipur", desc: "Early-morning start" },
  { id: 11, tripType: "OVERNIGHT", startDateStr: "2026-11-07", endDateStr: null, startTime: "12:00", endTime: "12:00", destination: "Jaipur", desc: "Midday start" },
  { id: 12, tripType: "WEEKEND", startDateStr: "2026-11-06", endDateStr: "2026-11-08", startTime: "18:00", endTime: "20:00", destination: "Jaipur", desc: "Friday evening arrival, Sunday evening departure" },
  { id: 13, tripType: "WEEKEND", startDateStr: "2026-11-07", endDateStr: "2026-11-08", startTime: "08:00", endTime: "22:00", destination: "Jaipur", desc: "Weekend starting Saturday morning" },
  { id: 14, tripType: "MULTI_DAY", startDateStr: "2026-11-09", endDateStr: "2026-11-11", startTime: "08:00", endTime: "20:00", destination: "Jaipur", desc: "Standard multi-day (3 days)" },
  { id: 15, tripType: "MULTI_DAY", startDateStr: "2026-11-09", endDateStr: "2026-11-13", startTime: "08:00", endTime: "20:00", destination: "Jaipur", desc: "Longer multi-day (5 days)" },
  { id: 16, tripType: "MULTI_DAY", startDateStr: "2026-11-09", endDateStr: "2026-11-12", startTime: "14:00", endTime: "10:00", destination: "Jaipur", desc: "Partial start/end days" },
  { id: 17, tripType: "DAY_TRIP", startDateStr: "2026-11-07", endDateStr: null, startTime: "08:00", endTime: "20:00", destination: "Dawki", desc: "Destination with very few candidate places" },
  { id: 18, tripType: "DAY_TRIP", startDateStr: "2026-11-07", endDateStr: null, startTime: "10:00", endTime: "16:00", destination: "Pink City", desc: "Destination name requiring alias resolution combined with short-window" }
];

async function run() {
  const results = [];
  for (const c of cases) {
    console.log(`Running case ${c.id}: ${c.tripType} - ${c.desc}`);
    const input: TripBrainInput = {
      maxTravelers: 2,
      destination: c.destination,
      startDate: new Date(c.startDateStr),
      endDate: c.endDateStr ? new Date(c.endDateStr) : null,
      tripType: c.tripType as 'MULTI_DAY' | 'DAY_TRIP' | 'PICNIC' | 'OVERNIGHT' | 'WEEKEND',
      timeStatus: c.startTime ? "EXACT" : "UNKNOWN",
      startTime: c.startTime,
      endTime: c.endTime,
      budgetInr: 50000,
      paceLevel: "balanced",
      allPreferences: [],
      travelSegments: [],
      accommodations: [],
    };

    try {
      const res = await generateGroundedItinerary(input);
      let itemCount = 0;
      const outOfWindow = false;
      let overlap = false;

      // Start/End timestamps across all days to track overall overlap
      // For window checks, we need absolute times.
      // A quick check is to ensure that startTime and endTime within a single day don't overlap
      for (const day of res.days) {
        let lastEndMinutes = -1;
        for (const item of day.items) {
          itemCount++;
          const [sh, sm] = item.startTime.split(":").map(Number);
          const [eh, em] = item.endTime.split(":").map(Number);
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          if (startMin < lastEndMinutes) {
            overlap = true;
          }
          lastEndMinutes = endMin;
        }
      }

      const checkStr = `Count: ${itemCount}, OutOfWindow: ${outOfWindow}, Overlap: ${overlap}`;
      const verdict = (overlap || outOfWindow) ? "FAIL" : "PASS";

      fs.writeFileSync(`matrix-output-${c.id}.json`, JSON.stringify(res, null, 2));
      results.push(`Row ${c.id}: [${verdict}] ${checkStr}`);
    } catch (e) {
      const err = e as Error;
      console.error(`Row ${c.id} failed:`, err);
      results.push(`Row ${c.id}: [FAIL] Exception: ${err.message}`);
    }
  }
  
  console.log("\n--- MATRIX SUMMARY ---");
  console.log(results.join("\n"));
}

run();
