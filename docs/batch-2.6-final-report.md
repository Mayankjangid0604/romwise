# Roamwise — Phase 3.5 Batch 2.6: Final Report

**Date:** 2026-09-14  
**Scope:** Hierarchy, Geography, Budget Semantics & Architecture Hardening  
**Verdict:** ✅ READY FOR DATA EXPANSION

---

## 1. Executive Summary

Batch 2.6 resolved four architectural risks left open after Batch 2.5:

1. **Hierarchy traversal gap** — Trip Brain queried `destinationId = exact` so a trip to "Goa" could never include places tagged to "Panaji" or "North Goa". Fixed by introducing a BFS hierarchy service (`destination-hierarchy.ts`) consumed by all three travel-knowledge functions.

2. **Four coordinate warnings** — Four place records had coordinates matching their destination centers. All four were classified and resolved: Durgiana Temple was corrected to real coordinates; Pangong Tso and two railway endpoints were documented as intentional.

3. **`Trip.budgetInr` semantics undocumented** — The field was GROUP_TOTAL but nothing said so. Added canonical comments to the Prisma schema and trip-brain.ts.

4. **Legacy `itinerary-engine.ts` still present** — Dead code (only imported by its own test) deleted along with its test.

All regression tests pass (292/292). TypeScript is clean. The Prisma migration has been applied to Neon.

---

## 2. Hierarchy Traversal

### Problem
`getCandidatePlaces` in `travel-knowledge.ts` queried `WHERE destinationId = $1`. A trip to "Goa" (parent) would receive zero candidates if places were tagged to "Panaji" or "North Goa" (children). The same gap existed in `bulkVerifyPlaces` and `verifyPlaceOwnership`.

### Solution
Created [`src/lib/destination-hierarchy.ts`](../src/lib/destination-hierarchy.ts) with:

- **`getDestinationDescendants(destinationId)`** — BFS traversal returning the root plus all descendants. Guard: `MAX_DEPTH = 8` terminates cleanly even if the DB contains a cycle the validator missed.
- **`detectHierarchyCycles(records)`** — DFS over a flat record list, returns every `(id, parentId)` pair in a cycle. Handles 2-node, 3-node, and self-referential cycles.
- **`findOrphanChildren(records)`** — Returns children whose `parentDestinationId` is absent from the known ID set.

All three functions in `travel-knowledge.ts` now call `getDestinationDescendants` before querying places. Cross-destination contamination is prevented by design: the DB relation only connects parent → child, so BFS stays within one subtree.

### Regression guard
- `getCandidatePlaces` for Panaji never queries Goa's places (verified by inspection of the `IN` clause IDs in test assertions).
- `verifyPlaceOwnership("panaji-market", "dest-goa")` returns the place (hierarchy-aware).

---

## 3. Geography & Coordinate Fixes

### The four flagged places

| Place | File | Old coords | Classification | Action |
|---|---|---|---|---|
| Durgiana Temple | amritsar.json | (31.64, 74.86) = Amritsar center | DESTINATION_CENTER | Fixed to (31.6317, 74.8786) per Wikipedia |
| Darjeeling Himalayan Railway | darjeeling.json | (27.041, 88.2663) = Darjeeling center | ROUTE_GEOMETRY_NEEDED | No change — terminus legitimately near city center |
| Pangong Tso | pangong-lake.json | (33.7495, 78.6478) = Pangong Lake center | VALID_PLACE_COORDINATE | No change — the lake IS the destination |
| Kalka–Shimla Railway | shimla.json | (31.1048, 77.1734) = Shimla center | ROUTE_GEOMETRY_NEEDED | No change — terminus legitimately near city center |

### Validator warnings
The data validator issues warnings for coordinate matches but does **not** auto-fail them, because three of the four cases are legitimate. The two railway endpoints remain warned as a reminder that a `placeType: route` field would be more accurate (Phase 4 enhancement, not Batch 2.6 scope).

### Invariants in force
- A POI without real coordinates must NOT inherit destination-center coordinates silently.
- Route page (`trips/[id]/route/page.tsx`) no longer falls back to center coordinates — items without real place coordinates are excluded from route calculations.

---

## 4. Budget Semantics

### Determination
`Trip.budgetInr` is **GROUP_TOTAL**: total budget for the entire trip across all travelers and all days. It is NOT per-person and NOT per-day.

Evidence: `trip-brain.ts` divides `input.budgetInr / dayCount` (days only) to compute `budgetPerDay`. No traveler-count division anywhere in the codebase.

### Changes
- **Prisma schema** — added comment to `Trip.budgetInr`: "GROUP_TOTAL: total budget for the entire trip across all travelers and all days. NOT per-person. NOT per-day."
- **`trip-brain.ts`** — added inline comment at the `budgetPerDay` calculation confirming GROUP_TOTAL semantics.
- **UI** — `trips/new/page.tsx` labels the field "Budget (₹ INR)" with no per-person qualifier; this is correct given GROUP_TOTAL semantics. No change needed.

### Cost discriminator invariants (from Batch 2.5, regression-tested)
- `null` = unknown cost (excluded from estimated spend totals)
- `0` = genuinely free (counted as ₹0, never removed by optimizer)
- `> 0` = known cost

These three values are never conflated. Enforced by five invariant tests in `budget.test.ts`.

---

## 5. Legacy Architecture Removal

### Deleted files
- `src/lib/itinerary-engine.ts` — 509-line synthetic generation engine. No DB calls. Only imported by its own test file. The Trip Brain (`trip-brain.ts`) replaced it; `replan.ts` uses the replanner, not this file.
- `src/lib/__tests__/itinerary-engine.test.ts` — sole consumer of the above.

### Verification
`grep -r "itinerary-engine"` returns zero results after deletion.

### `syntheticCoordinates` in `route-optimizer.ts`
This function still exists and is tested. It is a fallback for route optimization when real coordinates are unavailable. It is not dead code and was not deleted. If coordinates are missing, the route page excludes items rather than fabricating positions — so `syntheticCoordinates` is only reached by the optimizer for waypoint interpolation, not for replacing missing place data.

---

## 6. Trip Brain Data Contract

### Gemini's role
Gemini synthesizes the itinerary narrative and day structure from a pre-filtered candidate place list. It receives:
- Real place names, slugs, categories, coordinates (from the DB)
- Budget, date range, preferences, pace

Gemini **cannot** introduce places that are not in the candidate list. The grounding pipeline validates every place reference in the Gemini response against `bulkVerifyPlaces` before persisting. Any place not in the verified map falls back to the deterministic fallback engine.

### Tier invariant
Tier 1 (curated/verified data) can never be masqueraded as AI-enriched. The `sourceType` field on every place record tracks provenance. Gemini output is structurally constrained: it selects and orders from the candidate set, it does not invent.

---

## 7. Tests Added (Batch 2.6)

| File | Tests | Coverage |
|---|---|---|
| `hierarchy-service.test.ts` | 16 | BFS traversal, cycle detection, orphan detection |
| `travel-knowledge-contamination.test.ts` | 28 | Scenarios A–F, cross-destination rejection, hierarchy-aware ownership |
| `budget.test.ts` (Batch 2.5) | 5 | Cost discriminator invariants (null/0/>0) |

**Total: 292 tests, 0 failures, 0 TypeScript errors.**

Key scenarios:
- **A (Goa):** Parent query includes Panaji child places.
- **B (Panaji):** Child query does NOT include Goa parent places.
- **C (Ladakh):** Completely unrelated destination never contaminates Goa results.
- **D (Meghalaya):** `never:nightlife` hard-excludes nightlife places.
- **E (Jaipur):** `never:nightlife` + `must-have:history` — exclusion and scoring both work.
- **F (Atlantis):** Unknown destination returns empty candidates, never errors.

---

## 8. Dataset

### Current state
- 30 destinations (23 top-level, 7 sub-destinations)
- 27 place files, 164 place records
- 0 validation errors, 3 intentional warnings
- 100% coordinates present; 0% cost/hours/duration data (all `needs_review`)
- Source split: 76 wikipedia_geosearch, 88 curated

### Data quality rules reaffirmed
- A dataset of 500 poor records is worse than 200 excellent records.
- No AI enrichment of place data. Gemini is for itinerary generation only.
- All place records remain `dataStatus: "needs_review"` until human-verified.

### Not done in this batch (by design)
- No new places added.
- No new destinations added.
- No Gemini enrichment of place data.

---

## 9. Remaining Risks

### Low severity
1. **Railway place `placeType` field** — Darjeeling Himalayan Railway and Kalka–Shimla Railway are linear features, not points. A future `placeType: "route" | "area" | "point"` field would let the route optimizer handle them correctly. Currently they show validator warnings. Non-blocking.

2. **`syntheticCoordinates` still in `route-optimizer.ts`** — The function exists as a fallback for waypoint interpolation. If the route page ever regresses to calling it for missing place coords, the silently-fake-precision problem would return. Covered by the route page fix (explicit null, no fallback), but the function itself is not guarded against misuse.

3. **`Trip.budgetInr` has no `budgetMode` enum** — The semantics are documented but not enforced by the schema. A future migration could add `budgetMode: "group_total" | "per_person"` as a proper field. Currently GROUP_TOTAL is the only supported mode.

4. **0% cost/hours/duration enrichment** — 164 places have `null` for all operational data. Until human verification happens, trip cost estimates and time planning will be approximate. The null handling in the budget engine is correct; the data gap is a quality issue, not a correctness issue.

### Not risks
- Cross-destination contamination: **prevented by design** (DB relation + BFS traversal).
- Null vs 0 vs unknown cost conflation: **prevented by schema + invariant tests**.
- Gemini inventing places: **prevented by grounding pipeline + bulkVerifyPlaces**.
- Cycle in destination hierarchy causing infinite loop: **prevented by MAX_DEPTH=8 guard**.

---

## 10. Recommendation

**READY FOR DATA EXPANSION**

The four architectural risks are resolved. The test suite (292 tests) covers the critical invariants. TypeScript is clean. The migration is applied.

The next step is a **human data enrichment pass** on the existing 164 places before expanding:
1. Verify and correct coordinates for `needs_review` records.
2. Add cost ranges, opening hours, and duration estimates for the highest-traffic places (starting with Golden Temple, Jaisalmer Fort, Pangong Tso, etc.).
3. Only after that pass is done: expand to 300–500 places using the same sourcing discipline (Wikipedia Geosearch → human verify → curated tier).

The architecture is now sound enough to support that expansion without data quality risk.
