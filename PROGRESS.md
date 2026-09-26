# Roamwise — Progress

> The previous PROGRESS.md / FINAL_REPORT.md (Phases 1–4, health check, production
> hardening, visual redesign) were removed from the tree in `b045fdf`; read them with
> `git show b045fdf^:PROGRESS.md` and `git show b045fdf^:FINAL_REPORT.md`. Later phase
> reports live in `docs/audits/current/`.

## Bug-fix & UX pass (2026-09-26): IN PROGRESS

One line per item; `typecheck` + `build` were run after each item before moving on.
Details for every item are in the "Item notes" section below.

| # | Item | Status | typecheck / build |
|---|---|---|---|
| 1 | Add-place flow + route reflects current items | DONE: "Add place" dialog (day picker) + per-day panel, suggestions list + search, route re-optimizes over current items (verified in browser) | clean / clean |

## Item notes

### 1. Add-place flow
- **Already existed (partly):** a per-day "Add Activity" text search (commit `1836efe`). It required typing ≥2 characters, searched only the trip's top-level destination, did **not** check trip membership (`searchPlacesForTrip`), offered hotels/transport, and could write invalid times such as `24:10`.
- **New:** `AddPlacePanel` (`src/components/itinerary/add-place-panel.tsx`) opens on a *suggested* list (popular places not yet in the plan) so users can pick without typing; typing searches name / area / category. Available as a toolbar **Add place** dialog with a day picker, and inline under each day. The panel stays open after adding, so several places can go in one pass.
- **Server:** `listAddablePlaces` (membership-checked; trip destination + sub-destinations; excludes stays/transport and already-scheduled places) replaces `searchPlacesForTrip`. `addItineraryItem` now uses the same destination hierarchy as the planner, rejects stay/transport places, appends after the *latest-ending* item via `computeAppendSlot` (`src/lib/itinerary-slots.ts`; refuses to go past midnight), labels cost provenance like the generator (`db`/`free`), removes the place from the "couldn't be scheduled" warning, and revalidates the whole trip layout.
- **Itinerary page:** days now have headings ("Day 2 · Sat, 17 Oct", time window, stop count, *View route* link). Before this, days were stacked with no labels.
- **Route:** the route page already read items from the DB on every request; the stop-building logic is now a pure `buildRouteStops()` with tests proving an added place is included in the optimization. The page shows "Optimizing N of M stops" and calls out custom activities that have no map location. Fixed `?day=<missing>` → `redirect(?day=1)`, which loops forever for a trip without a Day 1; it now falls back to the first day in place.
- **Verified in a real browser** against a local Postgres: added "Chokhi Dhani" to Day 2 from the suggestions → it disappeared from suggestions, appeared on Day 2, and `/route?day=2` optimized 5/5 stops including it.
- Tests: `itinerary-slots.test.ts` (8), `route-stops.test.ts` (4), `add-place.test.ts` (10).
