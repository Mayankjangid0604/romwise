# Travel Knowledge Architecture — Phase 2

## Overview

Phase 2 transforms Trip Brain from an ungrounded LLM-first system into a
**database-grounded pipeline**. The database is the source of truth for place
existence, coordinates, and costs. Gemini's role is strictly synthesis and
scheduling — it arranges known places, not invent new ones.

---

## Core Principle

```
Database → LLM → Database
```

1. Retrieve known places from the DB
2. Send only those Place IDs to Gemini
3. Validate Gemini output against those same IDs
4. Resolve final coordinates from the DB — never from Gemini

Any placeId in a Gemini response that is not in the candidate set is rejected
immediately as a hallucination.

---

## Data Model

### Geography vs. Tourism (separated)

| Model | Purpose |
|---|---|
| `District` | Administrative geography — India's ~788 districts. Used for address resolution, not itinerary generation. |
| `TravelDestination` | Tourist destinations (Jaipur, Rishikesh, Goa …). The unit for Trip Brain. |
| `DestinationAlias` | Alternate names (Hrishikesh → Rishikesh, Bangalore → Bengaluru). |
| `Place` | Individual points of interest with real lat/lng, cost, hours, and category. |

`Trip.destinationId` is now a FK to `TravelDestination`, not `District`.

### Place fields

```
Place {
  id, name, slug
  destinationId        → TravelDestination FK
  category             → PlaceCategory (sightseeing|culture|history|…)
  lat, lng             → real coordinates (mandatory)
  typicalCostInr       → approximate per-person cost
  durationMinutes      → expected time on site
  openingTime          → HH:MM or null
  closingTime          → HH:MM or null
  bestSeason           → e.g. "Oct-Mar" or "year-round"
  popularityScore      → 0-100
  hiddenGem            → boolean
  dataStatus           → seed | verified | needs_review | deprecated
  sourceType           → curated | ai_enriched | imported | official | fixture
}
```

`dataStatus: "deprecated"` places are excluded from all candidate queries.

### Data provenance

Every Place record carries `sourceType` so consumers know the confidence level:

| sourceType | Meaning |
|---|---|
| `fixture` | Dev/test data — NOT verified, clearly labeled |
| `seed` | Initial data, not yet verified |
| `curated` | Hand-verified by the team |
| `official` | From an authoritative source |
| `ai_enriched` | Enriched by AI, needs review |

---

## Destination Resolution

**File:** `src/lib/destination-resolver.ts`

Before any itinerary generation, the user's destination string is resolved to a
`TravelDestination` record. Unknown destinations are rejected here — no Gemini
call is made.

Resolution order:

1. **Exact match** — case-insensitive name comparison
2. **Alias match** — via `DestinationAlias` table (e.g. "Pink City" → Jaipur)
3. **Fuzzy match** — partial name contains query (last resort, lower confidence)
4. **null** → caller throws `DestinationNotFoundError`

---

## Candidate Retrieval + Preference Scoring

**Files:** `src/lib/travel-knowledge.ts`, `src/lib/preference-scoring.ts`

```
getCandidatePlaces(destinationId, allPreferences, budgetPerDay)
  → load all non-deprecated Places for the destination
  → apply hard exclusions (any member's "never" preference removes the category)
  → score remaining places by aggregated preferences
  → sort: preference score ↓, popularity ↓
  → return top 30
```

### Preference scoring

| Priority | Score |
|---|---|
| `must-have` | +40 |
| `very-important` | +20 |
| `preferred` | +10 |
| `nice-to-have` | +5 |
| `avoid` | -20 |
| `never` | −999 (hard exclusion) |

Scores are aggregated across all group members. A single member's `never` for a
category creates a **hard exclusion** — that category is removed from candidates
regardless of any other member's `must-have`. This is a server-side invariant;
Gemini cannot override it.

Place categories are mapped to preference categories via
`PLACE_TO_PREFERENCE_CATEGORY` (e.g. `history` → `culture`).

---

## Trip Brain Pipeline

**File:** `src/lib/trip-brain.ts`

```
Input: { destination, startDate, endDate, budgetInr, paceLevel, allPreferences }

1. resolveDestination(destination)
   → null? throw DestinationNotFoundError (no DB, no AI call)

2. getCandidatePlaces(resolved.id, allPreferences)
   → empty? throw DestinationDataError (no DB data for this destination)

3a. [Gemini available] buildGroundedPrompt(candidates JSON) → Gemini
   → parseGeminiResponse()
   → validateGroundedResponse()  — unknown placeId? throw ValidationError
                                  — hard-excluded category? throw ValidationError
   → bulkVerifyPlaces()          — DB ground-truth check; unknown? throw ValidationError
   → map items → real coords from Place records

3b. [Gemini unavailable OR any non-fatal error] deterministicFallback(candidates)
   → spread candidates across days in preference-score order
   → use real Place coordinates directly

4. Return TripBrainResult { days, resolvedDestination, candidateCount, usedGemini, conflicts }
```

### Error hierarchy

| Error | Cause | Re-thrown? |
|---|---|---|
| `DestinationNotFoundError` | Destination not in DB | Yes — bubbles to UI |
| `DestinationDataError` | No places in DB for destination | Yes — bubbles to UI |
| `ValidationError` | Gemini response failed validation | Yes — bubbles to UI |
| `GeminiProviderError` / `GeminiSchemaError` | Gemini API failure | No — triggers fallback |

`ValidationError` is a hard failure (not silenced) because it indicates either a
prompt bug or an adversarial Gemini response.

---

## Entitlement: Credit Consumed Only on Success

**File:** `src/app/actions/itinerary.ts`

`tripGenerations` is incremented only after the itinerary is successfully
persisted to the database. Destination resolution failures, no-place-data errors,
and validation errors do not consume any generation credit.

---

## Category System

**File:** `src/lib/categories.ts`

Single canonical source for all category types:

- `PLACE_CATEGORIES` — 13 place types (sightseeing, culture, history, …)
- `PREFERENCE_CATEGORIES` — 8 preference types (subset, user-facing)
- `PLACE_TO_PREFERENCE_CATEGORY` — mapping between the two
- `TRIP_BRAIN_CATEGORIES` — alias of PLACE_CATEGORIES for Trip Brain use

`src/lib/preferences.ts` re-exports from categories.ts for backward compatibility.

---

## Seed Scripts

| Script | Purpose |
|---|---|
| `npm run db:seed` | Original seed (legacy) |
| `npm run db:seed:districts` | Seed District table from india-districts CSV |
| `npm run db:seed:fixture` | Seed dev fixture — Jaipur/Rishikesh/Goa destinations + places (clearly labeled `sourceType=fixture`) |

The fixture is **development-only test data**. All records are marked
`sourceType: "fixture"`, `dataStatus: "seed"`. Do not treat fixture data as
authoritative travel information.

---

## What Gemini Cannot Do

- Invent a destination not in `TravelDestination`
- Reference a Place not in the candidate list
- Override a `never` hard exclusion
- Provide coordinates (all coordinates come from `Place.lat`/`Place.lng`)
- Consume a generation credit on failure
