import * as fs from 'fs';

let content = fs.readFileSync('src/lib/trip-brain.ts', 'utf-8');

const regexGeminiSuccess = /let dayStartMins = DAY_START_BY_PACE\[input\.paceLevel\];[\s\S]*?(?=\/\/ Check travel segments for constraints on this date)/;
const replacementGeminiSuccess = `const { dayStartMins, dayEndMins } = computeDayWindow(
          input.tripType,
          dayIdx,
          dayCount,
          startDateTime,
          endDateTime,
          input.paceLevel,
          input.startTime || null,
          input.endTime || null
        );

        `;

content = content.replace(regexGeminiSuccess, replacementGeminiSuccess);

const regexDetFallbackCall = /days = deterministicFallback\(candidates, dayCount, slotsPerDay, input\.paceLevel, input\.startDate, baseStartMins, baseEndMins, input\.travelSegments\);/;
const replacementDetFallbackCall = `days = deterministicFallback(
      candidates, 
      dayCount, 
      slotsPerDay, 
      input.paceLevel, 
      input.startDate, 
      input.travelSegments,
      input.tripType,
      startDateTime,
      endDateTime,
      input.startTime || null,
      input.endTime || null
    );`;

content = content.replace(regexDetFallbackCall, replacementDetFallbackCall);

const regexDetFallbackDef = /function deterministicFallback\([\s\S]*?baseStartMins: number,\n  baseEndMins: number,\n  travelSegments\?: Record<string, string>\[\],\n\): GeneratedDay\[\] \{/;
const replacementDetFallbackDef = `function deterministicFallback(
  candidates: CandidatePlace[],
  dayCount: number,
  slotsPerDay: number,
  paceLevel: PaceLevel,
  startDate: Date | null,
  travelSegments: Record<string, string>[] | undefined,
  tripType: string,
  startDateTime: Date | null,
  endDateTime: Date | null,
  inputStartTime: string | null,
  inputEndTime: string | null
): GeneratedDay[] {`;

content = content.replace(regexDetFallbackDef, replacementDetFallbackDef);

const regexDetFallbackInner = /let dayStartMins = baseStartMins;\n    let dayEndMins = baseEndMins;/;
const replacementDetFallbackInner = `const { dayStartMins, dayEndMins } = computeDayWindow(
      tripType,
      d,
      dayCount,
      startDateTime,
      endDateTime,
      paceLevel,
      inputStartTime,
      inputEndTime
    );`;

content = content.replace(regexDetFallbackInner, replacementDetFallbackInner);

const regexRemoveOldBaseStartMins = /let baseStartMins = DAY_START_BY_PACE\[input\.paceLevel\];[\s\S]*?if \(input\.endTime\) \{\n      const \[h, m\] = input\.endTime\.split\(':'\)\.map\(Number\);\n      baseEndMins = h \* 60 \+ m;\n    \}/;
content = content.replace(regexRemoveOldBaseStartMins, '');

fs.writeFileSync('src/lib/trip-brain.ts', content);
