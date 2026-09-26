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
| 4 | Cache AI discovery results | DONE: DB-backed `AiResponseCache` + in-process L1, conservative prompt normalization, date/prompt-version aware keys; applied to the chat planner and group alignment; hits 0.3 ms (memory) / ~13 ms (DB) vs a 1.2 s simulated provider call | clean / clean |
| 5 | Wireframe / page-flow redesign | DONE (proposal only): `WIREFRAME_NOTES.md`, with 12 flow findings (4 already fixed in item 2) and 5 proposed changes, none of which rename or remove a route | n/a (docs) / clean |
| 7 | Security re-audit | DONE: 2 of the 4 hardening guarantees had regressed (secrets in responses; rate limiting missing on 2 Gemini paths), plus 6 new authz gaps (viewers could mutate, reorder IDOR, …). All fixed, verified live, and guarded by tests | clean / clean |
| — | **Security hotfix (found during 3, reported under 7)** | DONE: overview/budget/itinerary/expenses API were serializing members' bcrypt `passwordHash` + email to the browser; fixed + regression test | clean / clean |
| 8 | Hotel sample data expansion | DONE: the 10-hotel list had been deleted (Stay page showed **0** hotels); replaced with a labelled 58-archetype catalogue → 21–28 stays per destination (1,459 across the 55 curated destinations), 11+ property types, ₹500–₹18,500/night | clean / clean |
| 9 | Full pipeline trace (signup → packing) | DONE: traced in code and walked live; 8 new breaks fixed (incl. **every multi-day itinerary had a phantom extra day**, 3-day trips lost their last day, template trips 404'd on Places), dead code listed | clean / clean |
| 10 | Hotel suggestions on trip overview | DONE: compact "Suggested stays" card (name, type, ★ rating + review count, ₹/night, sample-data label, "See all N stays") from the Stay tab's own ranking; streams in without delaying the overview | clean / clean |
| 11 | Transit points are never attractions | DONE: stations/bus stands/airports were reaching the itinerary candidates, the Discover/New-trip "must visit" list, and the copilot's catch-all placeholder, mostly via importer mislabelling. One shared rule now excludes them everywhere, both importers are fixed, a repair script is added, and a regression suite covers the whole class of bug (8 of its checks fail on the old code) | clean / clean |

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

### 4. Cache AI discovery results
**What actually calls Gemini today (traced, not assumed):** the Discovery pages make **no** Gemini calls; since V2 they are DB-driven (collections, destination details, search). The Phase-2 `/api/discovery` route no longer exists. Free-text "discovery" prompts go to **`/api/chat/planner`** (conversation → destination/dates/budget extraction). No web UI component calls it any more (the trip builder became a form), but it is a live authenticated endpoint and the natural entry point for the mobile work being scoped. The only Gemini call the web UI triggers on demand is **Group Alignment** (Group tab → "Analyze"). Copilot (trip-state dependent, performs actions) and the V1 planner (behind `PLANNER_ENGINE=v1`) are deliberately **not** cached.

**Choice: DB-backed cache table plus a small in-process L1.** Production is serverless (Vercel), where each instance has its own memory and cold starts wipe it, so an in-memory-only cache would rarely hit and would differ per instance. That's the same reason rate limiting already moved to the `RateLimitEntry` table. A new additive table `AiResponseCache` (migration `20260926140735_add_ai_response_cache`: one `CREATE TABLE` + one index) is shared by all instances; an LRU map (200 entries) in front makes repeat hits on a warm instance skip even that round trip. No new infrastructure or dependencies.

**Correctness guards** (`src/lib/ai/cache.ts`)
- Key = sha256 of task + model + **prompt version** (hash of the system prompt, so editing a prompt invalidates old answers) + normalized input.
- Normalization only folds formatting: case, whitespace, spacing around punctuation, trailing `!?.`, Unicode width forms, and thousands separators (`50,000` → `50000`, `1,00,000` → `100000`). Numbers, words, negations and order all stay in the key. Tested pairs that must *not* collide include `3 days` vs `5 days`, `50,000` vs `5,000`, `1,2` vs `12`, `2.5 lakh` vs `25 lakh`, "not crowded" vs "crowded", and "Goa then Hampi" vs "Hampi then Goa".
- The planner key includes **today's date (UTC)**: its answers contain relative dates ("next month"), so an answer is never served across days. TTL is 24 h; group alignment is 7 days (no relative dates; any preference change produces a new key).
- Only responses that pass the endpoint's own zod schema are stored; a cached entry that fails validation is a miss; provider errors are never cached; cache/DB failures fall back to calling the provider; stored values are copied so callers can't mutate them. Expired rows are pruned at most hourly per instance.
- Destination resolution in the planner still runs on every request (it depends on current DB data). Responses carry `X-Roamwise-AI-Cache: hit|miss`.

**Measured** with the real module against the real Postgres table, provider stubbed at 1.2 s (no Gemini key in this environment): miss 1210 ms; hit on the same instance **0.3 ms**; hit from a cold instance (DB) **12.6 ms** locally, ~179 ms at 20 ms RTT including opening a new pooled connection. A different prompt missed as expected; 2 provider calls for 4 requests.

Tests: `ai/__tests__/cache.test.ts` (24: normalization equivalence/non-collision, hit/miss, cross-instance, expiry, invalid entry, errors not cached, DB down, mutation safety), `chat/planner/__tests__/route-cache.test.ts` (4: repeat hits without a Gemini call, different prompt misses, next day misses, invalid AI output never cached). The existing planner and group-alignment parsing tests mock the cache as a passthrough, since they test parsing, not caching.

### 5. Wireframe / page-flow redesign
See `WIREFRAME_NOTES.md`. It has a current page map, 12 flow-level findings (F1, F8, F9, F10 were fixed in item 2), and 5 proposals with ASCII wireframes. P1: one planning form instead of Discovery's quick-plan form *plus* `/trips/new`. P2: overview as a summary hub with grouped tabs. P3: one stay model. P4: dashboard duplicate trims. P5: make "mark for next generation" vs. "add to current plan" explicit. **None of the proposals rename or remove a URL**; the few URL-affecting candidates are listed separately with the redirect each would need. Nothing in the proposals was built.

### 7. Security re-audit (vs. the production-hardening phase, 2026-09-13)
Method: every server action (`src/app/actions`) and route handler (`src/app/api`) was read for session → membership → role → input → output, then each finding was reproduced against the running production build with real accounts (creator, member, viewer via invite link, outsider).

**The four hardening guarantees**

| Guarantee | Status now | Evidence |
|---|---|---|
| Session-derived identity only | ✅ Still true | Every action and route takes the acting user from `auth()`. Parameters naming *other* users are authorization-checked data, not identity: `removeGroupMember` is creator-only; expense payer/participants are validated as trip members. `security.test.ts` still passes. |
| No secrets in responses | ❌ **Regressed**, now fixed | **Every trip member's bcrypt `passwordHash` and email were embedded in page HTML/JSON:** the overview (whole `trip` passed to the client `OfflineSaveButton`, since `78cb9f2`), itinerary (comment authors, `b6e4025`), budget and `POST /api/trips/[id]/expenses` (expense payers, `b045fdf`). Anyone who could open a trip could read them, including viewers from an invite link. Confirmed live (5 hashes in one overview page); after the fix there are 0 on every trip page, including as a viewer. Also `/api/destination-details` echoed raw `err.message` (Prisma internals on DB errors); it now returns a generic 500. |
| Rate limiting functional | ✅ Works, ⚠️ two gaps fixed | Live: login gives "Invalid" ×5, then "Too many attempts" on the 6th **even with the correct password**; another IP is unaffected. `/api/chat/planner` returns 429 on request 6 (DB-backed counter). **Gaps:** the group-alignment *server action* (what the UI actually calls; only the unused API route was limited) and the copilot action both call Gemini with no limit. Both now use `checkRateLimitDb` (5/min and 10/min per user). |
| bcrypt cost 12 | ✅ Still true | `hash(password, 12)` in signup; every stored hash in the DB starts `$2b$12$`. |

**Other gaps introduced since that phase (all fixed)**
1. **Viewers could change trips.** Viewers are meant to be read-only (`docs/architecture/COLLABORATION-MATRIX.md`), but 9 actions checked only membership: `generateTripItinerary` (**wipes and regenerates** the itinerary), `optimizeTripBudget` (**deletes** items), `acceptReplan`, 4 packing actions, `selectHotel`/`removeHotelSelection`, plus `POST /api/trips/[id]/stay|transit`. Now `canEditTrip(role)` everywhere; live, a viewer gets 403.
2. **IDOR in `POST /api/trips/[id]/reorder`**: the body's `dayId` wasn't checked against the trip, so a member of *any* trip could rewrite another trip's day order/times. Live after the fix: 404 and the other trip unchanged.
3. `searchPlacesForTrip` had no membership check (replaced in item 1 by the membership-checked `listAddablePlaces`).
4. `GET /api/trips/[id]/status` answered for any trip id (now members only → 404).
5. `GET /api/weather` was an unauthenticated proxy to the weather API (now 401 when signed out).
6. Stay/transit POST had no input validation (undefined names → 500); now typed, length-limited, and the mode is allow-listed.

**Guards added:** `no-user-record-leak.test.ts` (fails on any `user|creator|payer|…: true` include in `src/`; caught all 7 leak sites on the old code), `authorization-audit.test.ts` (every mutating server action must enforce edit rights or be on an audited own-data list; flagged all 9 viewer gaps on the old code), `reorder/__tests__/route.test.ts` (IDOR), `viewer-permissions.test.ts`.

**Noted, not changed (need a product decision or are pre-existing)**
- Login/signup/OTP limits are still in-memory per instance (a known, documented limitation from the hardening phase). `checkRateLimitDb` exists and is a one-line swap if you want them global on serverless.
- A successful login never resets its counter (`resetRateLimit` sits after `signIn`, which always throws a redirect): 5 logins from one IP within 15 min lock that IP. Pre-existing.
- `COLLABORATION-MATRIX.md` says only the creator may generate; the code allows members (viewers are now blocked). Either the doc or the code should change.
- A verified phone-OTP record isn't consumed on use, so it could be replayed to the credentials callback until it expires. Low risk: the `otpId` never leaves the server.
- The Group page shows members' emails to all members, including viewers (PII by design, not a secret).

### 8. Hotel sample data expansion
**Starting point (traced):** the "10-hotel sample dataset" no longer existed. Commit `331ee89` (Planner V2) deleted `SAMPLE_HOTELS` and switched the Stay page to `Place` rows with `category = "stay"`, but none are imported, so **the Stay page listed zero hotels for every trip**. The page also measured "distance to activities" to the city centre only, and selecting a hotel ran `tripAccommodation.deleteMany({ tripId })`, which silently deleted any stay the user had typed in on the overview.

**New dataset** (`src/lib/sample-hotels.ts`, labelled sample data, not a booking integration)
- 58 property archetypes across 21 types: hostels, pod hotel, budget hotels, guesthouses, homestays, serviced apartments, boutique, business, upscale and luxury hotels, eco-lodge, beach huts, beach/valley/lake resorts, cottages, a planter's bungalow, heritage havelis and a palace hotel, houseboats, desert and river camps, ashram, yoga retreat, dharamshala, jungle lodge. ₹450–₹18,000 base price per night, with amenities, area and distance band. Names are generic, and a test forbids hotel-chain brand words.
- Each destination gets the archetypes that fit its setting (beach, mountain, heritage, backwater/lake, desert, spiritual, wildlife, city; from `destinationType` plus per-slug overrides), priced for the place (e.g. Mumbai ×1.35, Orchha ×0.8) and placed around its real coordinates. So Goa gets beach huts, Alappuzha houseboats, Jaisalmer dune camps, Varanasi an ashram, and Mumbai no houseboats. It works for all 300+ DB destinations, not only the curated 55.
- Deterministic (seeded by slug): ids/prices are stable, so the server looks the hotel up by id on select, and **prices never come from the client**.
- Result: 21–28 stays per destination (1,459 across the 55 curated destinations), versus 10 fixed hotels in one city before (and 0 today).

**Stay flow fixes**
- New additive column `TripAccommodation.selectionRef` (migration `20260926142131_…`: one `ADD COLUMN`) marks the Stay-tab pick. Selecting or removing a hotel now only replaces that pick; manually added stays are kept (verified: "Aunt Meera's flat" survived a selection).
- Distances are to the itinerary's actual stops (centre only before an itinerary exists). The Stay page shows type, ★ rating with "sample reviews", price/night + total, area, amenities, a "Sample" badge and a clear sample-data banner. Viewers see the list without Select buttons.
- Budget uses the Stay-tab pick's cost (it read `tripAccommodations[0]`, so a manual stay listed first hid the hotel's cost).
- Shared `getTripStayRecommendations()` so the Stay tab and the overview (item 10) rank identically.

Verified in the browser (Jaipur trip): 28 options across 11 property types, ₹500–₹18,500/night; selecting "Nomad Pod Hotel" stored ₹1,050 from the server-side catalogue with its `selectionRef`; the manual stay remained; Budget showed the hotel.
Tests: `sample-hotels.test.ts` (breadth, setting fit, labelling, sane prices/ratings, geography, no brand names, determinism, lookup), `actions/__tests__/stay.test.ts` (server-side price, manual stays kept, bad ids rejected, viewers rejected). The existing `stay.test.ts` ranking tests are unchanged and pass.

### 9. Full pipeline trace (signup → packing)
Traced in code: signup/login → dashboard → New Trip (destination search → form → `createTrip`) → background generation (`after()` → V2 planner) → itinerary (edit / add / reorder / replan) → Places → Route → Budget → Stay → Group/invite → Preferences → Packing. Then walked it live on the production build with fresh accounts. Compared against the last health check (2026-09-13) and the V3.x audit docs.

**Chain verified working (live):** signup → auto-login → dashboard; login (with `callbackUrl`); new trip → generation → itinerary with day headings; add place → route; places selections; budget incl. stay cost; stay pick; invite → join; packing generate → check → persists after reload (31 items, 1 checked, confirmed in DB).

**New breaks found and fixed**
1. **Every multi-day itinerary had a phantom extra day.** The V2 planner passes time-adjusted datetimes (start 09:00, end 20:00) to `getTripDuration`, which did `ceil(ms span) + 1`: Nov 13–15 → **4** days (incl. Nov 16, after the trip), a same-day trip → 2. `planner-v2/__tests__/adapter.test.ts` had enshrined it (one test commented "5 days duration" asserted 6). Now counts calendar days; tests corrected; live, Nov 13–15 → 13/14/15 and Dec 1–5 → 5 days.
2. **3-day trips lost their last day.** The form path stored a 3-calendar-day range as `WEEKEND`, which every consumer treats as a fixed 2 days (the itinerary stopped a day early, Stay counted 1 night instead of 2, and `formatTripDates` showed a 2-day range while the dashboard showed 3). New `deriveTripTypeFromDates` → `MULTI_DAY`. The E2E test that asserted `WEEKEND` for this case was updated (flagged: it encoded the bug). Templates still use `WEEKEND` with a genuine 2-day span.
3. **Generation failures after "Generate My Trip" were silent.** `createTrip` ignored `generateTripItinerary`'s result, so e.g. hitting the free limit (3 generations per account) landed on an empty itinerary with no reason. Now shows the reason (verified).
4. **Template trips:** preferences were computed into an unused variable and dropped; `destinationId` was never resolved, so **the Places tab 404'd** and Stay/Add Place were empty until the first generation; `dateStatus: "known"` isn't a valid value. All fixed; template labels mapped to planner categories ("Family-Friendly", "Safety", "Budget", "Luxury" have no planner equivalent and are left out).
5. Places tab 404'd for any trip whose destination text didn't resolve → explanatory empty state.
6. **Login defaulted to the Phone tab, but phone login can't work in production:** `lib/sms.ts` only has a console provider that refuses in production, and nothing reads the `TWILIO_*` vars the README documents. Default is now Email (signup creates email accounts). Wiring Twilio is left as a follow-up (needs credentials).
7. **PDF export can't work on Vercel as configured:** the route imports `playwright` (only a transitive *dev* dependency), while `@sparticuz/chromium` and `playwright-core` sit unused in `dependencies`. Failures now redirect (303) to the Print page instead of a bare 500; wiring serverless Chromium is left as a follow-up (needs a Vercel test).
8. The chat planner asks the model for relative dates ("next month") without telling it today's date → now included in the prompt.

Fixed earlier in this pass, found on the same chain: Stay page listed 0 hotels (8); offline save stored no titles (security hotfix); Info tab placeholder, orphaned Stay/Preferences/Print, invite join landing, login `callbackUrl` (2); selecting a hotel deleted manual stays and the budget read the wrong stay (8).

**Dead code (reported, not deleted)**
- `src/lib/providers/routing.ts`: imported nowhere.
- `computeEndDate()` in `actions/trips.ts`: never called. Unused `redirect` import in `actions/template-actions.ts`.
- Server actions with no callers: `updateAccessibilityNotes` (`actions/trips.ts`) and `getActiveShares` (`actions/share.ts`, unused since item 3). Exported server actions stay callable endpoints; both are auth-checked.
- `POST /api/jobs/generate-itinerary`: no callers since generation moved to `after()` (guarded by `INTERNAL_JOB_SECRET`).
- Dependencies `@sparticuz/chromium`, `playwright-core`: unused (see #7).
- Not dead but orphaned from the web UI: `/api/chat/planner` (keep for mobile) and the V1 Gemini planner (`lib/trip-brain.ts`, only with `PLANNER_ENGINE=v1`).

**Reported, needs a product decision**
- "Avg budget ₹280/day" (New Trip card) and Discovery's budget suggestion come from `averageDailyBudgetInr` = the mean *entry ticket* of the top places, not a daily budget. The New Trip total budget therefore defaults to ₹1,000 for Jaipur, which makes Stay's budget-fit scores meaningless until edited. Suggested: stay (median sample hotel) + food + activities per day.
- Trips created before this fix (3-day `WEEKEND`, or planned with the phantom day) keep their current itinerary until regenerated; no data migration was run.

Tests: `trip-type-derivation.test.ts` (6), `template-actions.test.ts` (2), corrected `planner-v2/__tests__/adapter.test.ts`, updated `tests/e2e/phase-2-durations.spec.ts`.

### 10. Hotel suggestions on the trip overview
- `src/app/trips/[id]/stay-suggestions.tsx`: an async server component under the overview's **Stays** section. It shows the top 3 of the *same* ranking the Stay tab uses (`getTripStayRecommendations`: budget left after activities, distance to the itinerary's stops), each with **name, property type, ★ rating (sample review count) and price per night**, a "Sample data" badge, and "See all N stays & pick one →" linking to the Stay tab. It is not the full Stay UI: no scores, amenities or select buttons.
- It skips the hotel already picked ("Other suggested stays"). The picked sample hotel on the overview now shows a "Sample" badge and its price. The empty state points to the suggestions.
- **No slowdown:** it sits in its own `<Suspense>` with a skeleton and reuses the overview's already-loaded trip data (budget, dates, destination, current pick), so it adds only the ranking's own queries. A/B at 20 ms DB RTT against the pre-item build: overview main content 109 ms vs 117 ms (within run-to-run noise); suggestions stream in ~130 ms later.
- Verified in the browser: the card's 3 hotels are exactly the Stay tab's top 3 excluding the pick, and the link lands on `/stay`.
- Tests: `trips/[id]/__tests__/stay-suggestions.test.tsx` (4: top-3 content matches the ranking with name/rating/price and the sample label, selected hotel excluded, nothing without a destination, ranking uses itinerary stops + remaining budget).

### 11. Places vs. transit points
**Where a station/bus stand/airport could be offered as a place to visit (before this item):**

| Surface | What was wrong |
|---|---|
| Itinerary candidates (`getCandidatePlaces`, feeds both planners) | No category filter at all: the V1 (Gemini + deterministic fallback) planner got hotels **and** `transport` places as candidates, and the prompt didn't say not to schedule them. V2 dropped `category === "transport"` afterwards, so a station stored as "history" still went through. |
| Discover page / New-trip "must visit" (`destination-brain/details.ts`) | Top 15 places by popularity, filtered only for `stay`, so correctly labelled airports and stations were listed as must-visits. The budget estimate also averaged hotel prices in. |
| Copilot "add …" | The place lookup had no category filter, and when nothing matched it created an **"Explore <keyword>" sightseeing item**, so "add the railway station to day 2" produced one. |
| Add place, Places browser | Only excluded `category: "transport"`, so mislabelled stations got through. The Places browser also listed transport places if you set `?category=transport` in the URL. |
| Importers (root cause of the mislabelling) | Wikidata runs one pass per category and each pass **overwrote** the last. The railway-station pass ran before the "World Heritage Site" and "monuments" passes, so CSMT-type stations ended up as sightseeing/history. OSM only knew `railway=station`, `aeroway=aerodrome` and `amenity=bus_station`, so halts, metro stations, bus stops, `public_transport=station` and a "Bus Stand" tagged `tourism=attraction` became attractions. |
| Sample data | No problem: the hotel catalogue only contains stays. The curated master data has exactly one station (see the judgment call below). |

**Fix: one rule, applied everywhere.** `src/lib/transit-filter.ts` defines transit as `category "transport"`, a transit `placeType` (station/halt/metro/bus stand/stop/airport/ferry terminal/…), **or** a name pattern ("… railway station", "… Junction"/"Jn", "… Terminus", "bus stand", "ISBT", "airport", "ferry terminal", …). It comes in two forms built from the same lists: `isTransitPoint()` for data already in memory and `NOT_TRANSIT_WHERE` for Prisma queries. The SQL form handles NULL `placeType` explicitly, because `NOT IN` on NULL would have hidden most places. I checked that the JS and SQL forms agree on 18 fixtures against Postgres (0 mismatches). The name patterns are deliberately narrow, so "Darjeeling Himalayan Railway", "Kalka–Shimla Railway", "Top Station Viewpoint" and "National Rail Museum" stay visible.
- Applied in: `getCandidatePlaces` (query + in-loop check), the V2 engine post-filter, `listAddablePlaces` + `addItineraryItem`, the Places browser (list, count, category dropdown), destination details, and the copilot lookup. The copilot now also refuses a transit keyword with a message pointing to Transit instead of creating a placeholder.
- Prompts: the trip-brain SELECTION RULES and the copilot prompt now say never to schedule transit infrastructure or hotels as activities. V1 output is already grounded (every `placeId` must be in the candidate list), so the prompt rule is a second layer, not the guarantee. The discovery chat planner only extracts destinations, and stations go into `travelSegments`, so it needed no change.
- Importers: OSM maps airports/terminals/helipads, metro/subway, railway station/halt/stop, bus station/stop, ferry terminal, taxi stand and name-matched transit to `transport`. Wikidata uses `resolveImportedCategory()`, so once a place is transport a later pass can't re-label it.
- Repair script for already-imported rows: `scripts/maintenance/recategorize-transit-places.ts`. It is a dry run by default; `--apply` changes it to write. It only changes imported rows and lists curated/verified rows, stays and food places for manual review.

**Judgment call to confirm:** Chhatrapati Shivaji Maharaj Terminus (Mumbai, curated, category "history") is a UNESCO site **and** a working terminus. Following "must never be presented as a visitable attraction", it is now hidden by the " terminus" rule. If you'd rather keep it as a heritage sight, add an explicit allow-list entry in `transit-filter.ts` and update `REVIEWED_TRANSIT_NAMES` in the test. Also note that "airport" matches anywhere in a name, so a restaurant called "Airport Road Dhaba" would be hidden from attraction lists. That is acceptable for this purpose, and the repair script never re-labels food/stay places.

**Verified in the browser** (production build, local Postgres): I inserted "Jaipur Junction" (history), "Sindhi Camp Bus Stand" (sightseeing) and "Jaipur International Airport" (sightseeing) with the highest popularity in Jaipur. Under the old filter they ranked #1, #2 and #4. With the fix, none of them appears in: the Places browser (page 1, `?q=junction|bus|airport`, `?category=history|sightseeing|transport`), Add-place suggestions and searches, `/api/destination-details`, `/discovery/jaipur`, `/trips/new?destination=Jaipur`, or a **regenerated itinerary** (8 items, all real sights). Real attractions (Amer Fort, Hawa Mahal, …) still list. The repair script found exactly those 3 (plus CSMT for review) and re-labelled them `transport/transit_hub` with `--apply`. The test rows were then deleted.

**Regression tests:** `src/lib/__tests__/transit-filter.test.ts` (47):
- Transit vs. look-alike names.
- `NOT_TRANSIT_WHERE` ≡ `isTransitPoint` via a small where-evaluator.
- `getCandidatePlaces` excludes stations both in its query and when the DB returns one anyway.
- A **static guard** failing if any new place query in `src/` omits `NOT_TRANSIT_WHERE` (allowlist: admin data page, stay-only query).
- OSM and Wikidata mappings.
- Curated master data contains no transit points beyond the reviewed list.

Plus cases in `add-place.test.ts` (mislabelled station rejected, suggestions filtered) and `copilot.test.ts` (3 transit keywords → NO_ACTION with no item created; lookup filtered). **Run against the pre-fix code, 8 of these checks fail.**
