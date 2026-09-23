# PLANNER-V2-AUDIT

## 1. Executive Summary
This document audits the original Planner V1 pipeline and outlines the new Planner V2 architecture. Planner V2 aims to build deterministic, constraint-valid itineraries grounded fully in factual travel database records, making Gemini optional for synthesis rather than required for construction.

## 2. Previous Architecture (V1)
The V1 architecture resides primarily in `src/lib/trip-brain.ts`.
- **UI -> server action**: `actions/itinerary.ts` calls `generateTripItinerary`
- **Candidate retrieval**: `getCandidatePlaces` pulls from DB and filters by basic preferences.
- **Gemini/Trip Brain (AI)**: Sends candidates as JSON to Gemini API to create an itinerary.
- **Fallback**: A rudimentary `deterministicFallback` loops through places to fill slots if Gemini fails.
- **Persistence**: Server action writes `ItineraryDay` and `ItineraryItem` to Prisma.
- **Polling**: Client UI polls the `Trip.generationStatus`.

**Gemini Dependency**: Gemini was required for intelligent sequencing, pacing, geographic clustering, and selecting the most appropriate places. 

## 3. V2 Architecture
V2 replaces the AI-driven scheduling with a multi-stage deterministic pipeline:
1. **Candidate Retrieval**: Smart bounds on candidate count.
2. **Hard Filtering**: Explicit checks for hours, accessibility, closed status.
3. **Candidate Scoring**: Weighted scoring (interest, budget, geographic, pace, quality).
4. **Geographic Clustering**: Area-based or coordinate-based grouping.
5. **Day Allocation**: Distributing clusters across days.
6. **Scheduling Engine**: Time-slotting with travel estimates and buffer times.
7. **Constraint Validator**: Verifying overlaps, IDs, and boundaries.
8. **Repair Loop**: Fixing overlaps or dropping invalid items.

[To be updated after implementation]
