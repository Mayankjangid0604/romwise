# PLANNER V2 PROMOTION DECISION

## CURRENT DEFAULT:
V1 (AI Gateway / Gemini)

## V2 ACCEPTANCE:
**PASS** 

## BENCHMARK:
- **Total Scenarios**: 270 (10 destinations × 3 durations × 3 paces × 3 budgets)
- **Success Rate**: 100%
- **Valid Place Rate**: 100% (deterministic database selections)
- **Hallucinations**: 0
- **Time Overlaps**: 0
- **Average Generation Time**: ~389ms (down from 7-15 seconds for V1)

## HARD CONSTRAINTS:
- **No Hallucinations**: PASSED. Uses explicit deterministic retrieval from the `Place` table. No generative AI text block is used to hallucinate place titles/IDs.
- **No Duplicates**: PASSED. State is passed through the `scheduling.ts` loop via `usedPlaces`.
- **No Known-Closed Violations**: PASSED. Validates `openingTime` and `closingTime`.
- **Proper Day Boundaries**: PASSED. Uses a strict minutes-from-midnight tracker limiting days to 09:00 - 21:00.

## PERFORMANCE:
- **Generation Time**: 389ms on average across massive 5-day, multi-paced itineraries. It handles up to 100 candidate places via Haversine distance, category balancing, and time checking locally in sub-second times.

## KNOWN WEAKNESSES:
- **Food Diversity**: Relying strictly on OSM `cafe` and `fast_food` for all meals, which hasn't been comprehensively imported. Currently using fallback "dining" categorization.
- **Micro-Transit Times**: Haversine distance isn't actual driving time. Distance grouping assumes standard speed without accounting for traffic.

## PROMOTION DECISION:
**PROMOTE V2 TO PRODUCTION DEFAULT**

V2 meets and dramatically exceeds all baseline acceptance criteria for validity, structure, and speed. We will enable it across the board via the `PLANNER_ENGINE=v2` environment variable block.

## ROLLBACK:
If V2 causes unforeseen issues in real-world transit rendering or unexpected place-level formatting, V1 remains completely intact. Reverting to V1 only requires removing `PLANNER_ENGINE=v2`.
