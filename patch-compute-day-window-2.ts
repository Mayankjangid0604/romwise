import * as fs from 'fs';

let content = fs.readFileSync('src/lib/trip-brain.ts', 'utf-8');

const regex = /if \(startDateTime && endDateTime\) \{\n\s*if \(dayCount === 1\) \{\n\s*dayStartMins = startDateTime.getHours\(\) \* 60 \+ startDateTime.getMinutes\(\);\n\s*dayEndMins = endDateTime.getHours\(\) \* 60 \+ endDateTime.getMinutes\(\);\n\s*\}/;

const replacement = `if (startDateTime && endDateTime) {
    if (dayCount === 1) {
      if (inputStartTime) {
        dayStartMins = startDateTime.getHours() * 60 + startDateTime.getMinutes();
      }
      if (inputEndTime) {
        dayEndMins = endDateTime.getHours() * 60 + endDateTime.getMinutes();
      }
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/lib/trip-brain.ts', content);
