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
| 2 | Navigation / page-reopen audit | DONE: 16 instances found by tracing every Link/router/redirect/reload call; all fixed and back/forward verified in a real browser | clean / clean |
| 3 + 6 | Slow page opens (one investigation) | DONE: measured with injected DB latency; trip-tab clicks went from 0.7–1.2 s frozen to a skeleton in <100 ms, and page renders are 2–3.7× faster | clean / clean |
| — | **Security hotfix (found during 3, reported under 7)** | DONE: overview/budget/itinerary/expenses API were serializing members' bcrypt `passwordHash` + email to the browser; fixed + regression test | clean / clean |

## Item notes

### 1. Add-place flow
- **Already existed (partly):** a per-day "Add Activity" text search (commit `1836efe`). It required typing ≥2 characters, searched only the trip's top-level destination, did **not** check trip membership (`searchPlacesForTrip`), offered hotels/transport, and could write invalid times such as `24:10`.
- **New:** `AddPlacePanel` (`src/components/itinerary/add-place-panel.tsx`) opens on a *suggested* list (popular places not yet in the plan) so users can pick without typing; typing searches name / area / category. Available as a toolbar **Add place** dialog with a day picker, and inline under each day. The panel stays open after adding, so several places can go in one pass.
- **Server:** `listAddablePlaces` (membership-checked; trip destination + sub-destinations; excludes stays/transport and already-scheduled places) replaces `searchPlacesForTrip`. `addItineraryItem` now uses the same destination hierarchy as the planner, rejects stay/transport places, appends after the *latest-ending* item via `computeAppendSlot` (`src/lib/itinerary-slots.ts`; refuses to go past midnight), labels cost provenance like the generator (`db`/`free`), removes the place from the "couldn't be scheduled" warning, and revalidates the whole trip layout.
- **Itinerary page:** days now have headings ("Day 2 · Sat, 17 Oct", time window, stop count, *View route* link). Before this, days were stacked with no labels.
- **Route:** the route page already read items from the DB on every request; the stop-building logic is now a pure `buildRouteStops()` with tests proving an added place is included in the optimization. The page shows "Optimizing N of M stops" and calls out custom activities that have no map location. Fixed `?day=<missing>` → `redirect(?day=1)`, which loops forever for a trip without a Day 1; it now falls back to the first day in place.
- **Verified in a real browser** against a local Postgres: added "Chokhi Dhani" to Day 2 from the suggestions → it disappeared from suggestions, appeared on Day 2, and `/route?day=2` optimized 5/5 stops including it.
- Tests: `itinerary-slots.test.ts` (8), `route-stops.test.ts` (4), `add-place.test.ts` (10).

### 2. Navigation / page-reopen audit
Method: grepped every `href=`, `router.push/replace/refresh/back`, `redirect()`, and `window.location` in `src/`, then confirmed each suspect in a real browser against the production build, logging every request (including `<Link>` prefetches).

| # | Where | What was wrong | Fix |
|---|---|---|---|
| 1 | Trip overview "PDF" (`trips/[id]/page.tsx`) | `<Link>` to the `/api/trips/[id]/pdf` Route Handler, so **every overview view (and hover) prefetched it**, which launches headless Chromium server-side. Confirmed: `GET /api/trips/…/pdf [prefetch]` + "PDF generation failed" in the server log with no click. | Plain `<a target=_blank>`. |
| 2 | Login / signup / phone-OTP actions | Always `redirectTo: "/dashboard"`; the proxy's `?callbackUrl=` was ignored, so deep links and **invite links landed on the dashboard without joining**. | `safeCallbackUrl()` (open-redirect-safe, tested) + hidden `callbackUrl` field; the login↔signup links preserve it. |
| 3 | `/trips/join/[token]` | A Route Handler: after login, the soft (RSC) navigation followed its 307 inside `fetch`, so the trip rendered under the stale join URL with no active tab. | Converted to a page (same URL); `redirect()` now updates the address bar. Error states render a page instead of raw text. |
| 4 | `/trips/new` destination search | Shared `DestinationSearch` always pushed `/discovery/<name>`, whose "Plan" button pushed back to `/trips/new?destination=`: a detour that re-opened the page the user started on. | `mode="plan"` keeps the user in `/trips/new?destination=…`; `TripBuilder` is keyed by destination so the form appears. |
| 5 | `/discovery?collection=…` | On mount the search box `router.replace`d to the **identical URL**, re-rendering the page and re-running the collection SQL (confirmed: extra non-prefetch RSC request on every visit). | Only navigate when the filter actually changes. |
| 6 | Collection search submit | `router.push` of the URL the debounce had already applied → a duplicate history entry (Back "re-opened" the same page). | `replace`, and a no-op when unchanged. |
| 7 | Places browser search | A history entry per debounced keystroke. | Typing uses `replace`; explicit filters/pagination still `push`. |
| 8 | Generate itinerary (`generate-button.tsx`) | `window.location.reload()` when generation finished: a full document reload of the same page. | `router.refresh()`. |
| 9 | Itinerary drag-reorder (`sortable-day.tsx`) | `window.location.reload()` after saving. | `router.refresh()`. |
| 10 | Login "Use a different number" | `window.location.reload()`. | Remounts the phone form (state reset, no reload). |
| 11 | Live mode (not saved offline) | "Back to Home" → `/`, which only redirects signed-in users to the dashboard, losing the trip. | "Back to trip" → `/trips/[id]`. |
| 12 | Delete trip | `router.push("/dashboard")` left the deleted trip in history (Back → redirect bounce). | `router.replace` + `revalidatePath("/dashboard")`. |
| 13 | `/trips/[id]/stay`, `/preferences`, `/print` | **Zero inbound links anywhere in the UI**; reachable only by typing the URL. | Stay and Preferences tabs; Print button on the overview. |
| 14 | "Info" tab | Linked to a placeholder page ("will be implemented here"). | Tab now reads **Preferences**; `/info` redirects there so old links still work. |
| 15 | `/route?day=<missing>` | `redirect(?day=1)` loops forever when no Day 1 exists (fixed in item 1). | Falls back to the first day in place. |
| 16 | Trip breadcrumb | The trip title wasn't a link. | Links to the trip overview. |

Browser-verified after the fixes (production build): no PDF request on overview; no self-RSC request on collection pages; `/trips/new` search → `/trips/new?destination=Udaipur` with the form; `/info` → Preferences; tab clicks then Back ×3 / Forward ×2 walk `route → stay → itinerary → overview → itinerary → stay` exactly; a signed-out invitee goes invite → login → Sign up (callback kept) → lands on `/trips/<id>` as a member; `?callbackUrl=https://evil.example` is dropped.
Not changed (proposal in WIREFRAME_NOTES.md): the "← Trip" back links on Packing/Stay/Preferences duplicate the tab bar and breadcrumb but aren't broken.
Tests: `safe-redirect.test.ts` (19). Full suite 511/511.

### 3 + 6. Slow page opens
**How it was measured.** Local Postgres has ~0 ms latency, which hides the problem, so a small TCP proxy (in the session scratchpad, not committed) added a fixed delay per DB round trip: 20 ms and 100 ms RTT, i.e. a nearby vs. a cross-region or pooled/cold serverless Postgres. Two production builds ran side by side, the commit before this item (`d3b1553`) and after it, against the same DB and the same trip. Numbers are medians: 12 samples for document loads, 3–4 rounds of real Playwright clicks timed *inside the page* with a MutationObserver. Playwright's own `waitForSelector` backs off to ~500 ms polling and made an early run look like a regression.

**Root causes found**
1. **No `loading.tsx` anywhere.** A click showed nothing until the whole server render finished. Also, `<Link>`'s default prefetch for dynamic routes only goes "down to the nearest `loading.js`", so with none, *nothing* useful was prefetched.
2. **The trip layout awaited `auth()` + a DB query.** Per the Next 16 docs, runtime data in a layout blocks every navigation into the segment before any loading UI can show.
3. **Serial DB round trips.** Pages loaded one nested `include` tree; Prisma resolves each relation level as a separate sequential query. Overview ≈ 8 round trips, itinerary ≈ 6 (days → items → votes/comments/place → comment users), group ≈ 8 (`getTripRole` → trip → `getActiveShares` re-deriving the role → creator lookup), route resolved each waypoint with its own `await`.
4. (Item 2) The overview's `<Link>` to the PDF route made every overview view render a PDF in headless Chromium server-side.

**Fixes**
- `loading.tsx` skeletons for every route with a real async wait: `trips/[id]` (all tabs, rendered under the still-interactive tab bar), `trips/[id]/itinerary` (timeline-shaped), `dashboard`, `dashboard/favorites`, `discovery`, `trips/new`. Shared `Skeleton` / `LoadingState` primitives (`role="status"`, screen-reader label).
- Trip layout: the session + DB breadcrumb moved into its own `<Suspense>`; the layout itself awaits only `params`.
- Overview, itinerary, budget, stay, route, places, group: independent queries run in `Promise.all` with explicit selects and are joined in memory; the `trip` object keeps the same shape, so render code is unchanged. Route resolves waypoints concurrently.
- Not changed, noted for later: `relationJoins` (a Prisma preview flag that would collapse every nested include into one query app-wide), since a preview feature in production is your call.

**Results: document load (server render), median**

| Page | 20 ms RTT before → after | 100 ms RTT before → after |
|---|---|---|
| Trip overview | 189 → 60 ms | 829 → 225 ms |
| Itinerary | 165 → 125 ms¹ | 829 → 224 ms |
| Budget | 165 → 60 ms | 726 → 326 ms |
| Stay | 165 → 80 ms | 725 → 425 ms |
| Route | 144 → 79 ms | 626 → 326 ms |
| Places | 128 → 128 ms¹ | 531 → 266 ms |
| Group | 169 → 100 ms | 731 → 425 ms |
| Dashboard / Packing | 67 / 76 ms (unchanged) | 220 / 318 ms (unchanged) |

¹ measured before the final itinerary/places flattening; the 100 ms column is after it.

**Results: real clicks at 100 ms RTT (what the user feels)**

| | Before | After |
|---|---|---|
| Time to any visible response (trip tabs) | **700–1218 ms** (UI frozen, then everything at once) | **67–95 ms** (skeleton) |
| Time to page content | 700–1218 ms | 378–499 ms |

Honest trade-off: at *low* latency (20 ms RTT) content now lands ~100 ms later than before (≈380 ms vs 220–380 ms). Once React shows a Suspense fallback it keeps it for at least 300 ms to avoid flicker. The skeleton appears in ~75 ms instead of the UI sitting frozen, and the gain grows with latency (see the 100 ms column), which is the production condition that was reported.
