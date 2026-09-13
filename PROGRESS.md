# Roamwise — Progress

## Visual Redesign Phase: IN PROGRESS

Direction documented in `DESIGN_SYSTEM.md` ("Field Guide" — warm paper ground, lagoon teal primary, editorial serif headings). Visual-only pass: no business logic, data fetching, server actions, or validation touched.

### Step 1 — Design direction: DONE
- `DESIGN_SYSTEM.md` written: palette (lagoon / ink / ember / success / danger / caution), type scale, spacing conventions, component specs, old→new semantic color mapping
- Three decisions approved: light-only theme (dead dark-mode query removed), Fraunces added as display face, Arial override fixed so Geist actually applies

### Step 2 — Shared primitives: DONE — typecheck clean, build clean
- `src/app/globals.css` — Tailwind v4 `@theme` tokens: 6 color scales, radius (`control`/`card`), elevation (`card`/`lift`), font families; body set to warm `ink-50` ground
- `src/app/layout.tsx` — Fraunces loaded via `next/font/google` alongside existing Geist Sans/Mono
- `src/components/ui/` — primitives: `Button` (6 variants + `buttonStyles()` for Link-as-button), `Card`/`CardTitle`, `Input`/`Textarea`/`Select`/`Label`/`Field`, `Badge` (6 tones), `Alert` (4 tones), `PageHeader`/`SectionHeading`/`BackLink`, `Stat`, `Progress`, `EmptyState`, `Figure`/`formatInr`, `PageShell`/`CenteredShell`, `cn` helper
- No new dependencies added — local `cn` helper instead of clsx/tailwind-merge
- Form primitives spread all props through, so `name`/`id` attributes reach server actions unchanged

### Step 3 — Per-page application: DONE

Typecheck + build run after each page; all clean.

| # | Page | Status | typecheck / build |
|---|---|---|---|
| 1 | Landing + login + signup | done | clean / clean |
| 2 | Dashboard | done | clean / clean |
| 3 | Trip creation | done | clean / clean |
| 4 | Trip detail / itinerary (+ replan panel, generate button) | done | clean / clean |
| 5 | Discovery | done | clean / clean |
| 6 | Group alignment | done | clean / clean |
| 7 | Route | done | clean / clean |
| 8 | Budget (+ optimize button) | done | clean / clean |
| 9 | Stay (+ select/remove buttons) | done | clean / clean |
| 10 | Packing (+ packing actions) | done | clean / clean |
| — | Error boundaries (root + trip) | done | clean / clean |

### Step 4 — Final verification: DONE
- `npm run typecheck` — **0 errors**
- `npm test` — **169 passed (15 files)** — unchanged from before the redesign, as expected for a visual-only pass
- `npm run build` — **clean, 16 routes**, zero warnings
- `grep` for legacy palette classes (`bg|text|border-{blue,gray,green,red,yellow,orange,amber,slate,zinc}-N`) across `src/` — **zero matches**

### Functional preservation — verified
- **Signup form contract** checked in-browser: `name`/`email`/`password` fields keep exact `name`/`id`/`required`/`minLength=8`, and React's server-action hidden fields are present, confirming `action={formAction}` still bound
- **Trip creation** checked in-browser: all 8 fields keep exact `name`/`id`/`type`/`required`
- **Group alignment** checked in-browser: Add Traveler 2→3 works, conditional Remove buttons appear at >2 travelers
- **Server action reachability** confirmed via dev-server logs — submitted signup reached `prisma.user.findUnique` in `auth.ts:57` (failing only on DB connectivity, not wiring)
- **Packing check + mark-essential** left as real inline server-action `<form>` submits — restyled inside the existing `<button type="submit">`, not converted to decorative checkboxes
- **Replan propose/accept/reject**, **hotel select/remove**, **budget optimize**, **generate itinerary** — handlers and `useTransition` wiring copied verbatim; only `className` and wrapper markup changed

### Not verified in-browser
Pages requiring a live database (dashboard, trip detail, route, budget, stay, packing) were verified by typecheck, build, and code-level handler preservation only — no PostgreSQL instance is running in this environment (`DATABASE_URL` is still the placeholder from the production-hardening phase). End-to-end click-through of those flows needs a database.

---

## Production Hardening Phase: COMPLETE

All checks pass:
- `npx prisma validate` — schema valid (PostgreSQL)
- `npm run typecheck` (tsc --noEmit) — no errors
- `npm test` (vitest run) — 169 tests pass (15 test files)
- `npm run build` (next build) — successful production build

### What Changed

#### 1. Database Migration (SQLite → PostgreSQL)
- Changed `prisma/schema.prisma` provider from `sqlite` to `postgresql`
- Updated `.env` with PostgreSQL-format placeholder URL
- All types (cuid, DateTime, Int, Float, Boolean) translate cleanly — no schema changes needed
- Created `PRODUCTION_SETUP.md` with step-by-step Neon/Supabase + Vercel deployment guide

#### 2. Secrets Audit
- **AUTH_SECRET**: weak placeholder in `.env` — flagged in PRODUCTION_SETUP.md security checklist
- **GEMINI_API_KEY**: loaded via `process.env` server-side only, not in `.env` (must be set per environment)
- **No `NEXT_PUBLIC_` vars**: confirmed no client-side secret exposure
- **No secrets in API responses**: error handlers return generic messages, never env vars or stack traces
- **`.gitignore`**: `.env*` pattern covers all env files

#### 3. Auth Hardening
- **Rate limiting**: in-memory rate limiter on login and signup (5 attempts per IP per 15-minute window)
- **Input sanitization**: name trimmed, email trimmed + lowercased (both in signup action and authorize callback)
- **Length limits**: name ≤ 100 chars, email ≤ 254 chars, password 8–72 chars (72 = bcrypt's truncation point)
- **bcrypt**: confirmed 12 rounds (hardcoded in auth action)
- **Cookie flags**: NextAuth v5 defaults — httpOnly, secure (production), sameSite: lax
- **Session check**: all server actions with DB access call `await auth()` and derive userId from `session.user.id`
- **No client-provided identity**: no server action reads userId from formData

#### 4. Environment & Deployment Readiness
- **`.env.example`**: updated with PostgreSQL format, documents all required vars
- **Error boundaries**: added `src/app/error.tsx` (root) and `src/app/trips/[id]/error.tsx` (trip section)
- **Production build**: clean, 16 routes, no warnings
- **`PRODUCTION_SETUP.md`**: complete guide covering database setup, env vars, Vercel deployment, migration, verification, troubleshooting

#### 5. Tests (15 new, 169 total)
- **Rate limiter** (6): under-limit allowed, over-limit blocked, independent keys, window expiry, explicit reset, retryAfterSeconds range
- **Security** (9): bcrypt 12 rounds verified, cost factor hardcoded in source, no env var leaks in API routes, no stack traces in errors, no client-provided userId, all DB-accessing server actions check session, input length limits enforced

### Security Decisions

1. **bcrypt 12 rounds**: balances security vs latency. 12 rounds ≈ 250ms on modern hardware — acceptable for login/signup but not so slow it enables DoS via repeated hashing. OWASP recommends ≥10. We chose 12.

2. **Max password 72 chars**: bcrypt silently truncates input at 72 bytes. Accepting longer passwords gives a false sense of security (bytes 73+ are ignored). The limit makes the actual behavior explicit.

3. **In-memory rate limiting**: simple Map-based approach. Resets on server restart, doesn't work across multiple server instances. Acceptable for initial deployment on a single Vercel function. For multi-instance deployments, swap to Redis-backed rate limiting (e.g., `@upstash/ratelimit`). Documented as a known limitation.

4. **IP-based rate limiting via x-forwarded-for**: standard for reverse-proxy deployments (Vercel, Cloudflare). Can be spoofed if there's no trusted proxy in front — Vercel sets this correctly. Falls back to "unknown" if header is missing, which means all requests without the header share one bucket.

5. **Email normalization**: trimmed and lowercased on signup and login. Prevents duplicate accounts from casing differences and whitespace in copy-paste. Applied in both the server action and the NextAuth authorize callback for consistency.

6. **Error boundaries**: generic error messages only. No error details, stack traces, or internal state exposed to the user. The `error` prop is typed but intentionally unused in the rendered output.

7. **JWT session strategy**: no server-side session store needed. Tokens are signed with AUTH_SECRET. A weak secret means tokens can be forged — PRODUCTION_SETUP.md requires `openssl rand -base64 32`.

### New Files
- `src/lib/rate-limit.ts` — in-memory rate limiter
- `src/app/error.tsx` — root error boundary
- `src/app/trips/[id]/error.tsx` — trip section error boundary
- `src/lib/__tests__/rate-limit.test.ts` — rate limiter tests
- `src/lib/__tests__/security.test.ts` — security audit tests
- `PRODUCTION_SETUP.md` — complete deployment guide
- `.env.example` — updated with PostgreSQL format

---

## Phase 4 Status: COMPLETE

All checks pass:
- `npx prisma validate` — schema valid
- `npm run typecheck` (tsc --noEmit) — no errors
- `npm test` (vitest run) — 152 tests pass (13 test files)
- `npm run build` (next build) — successful production build

### What's Built in Phase 4

#### 1. Packing Checklist (`src/lib/packing.ts`, `/trips/[id]/packing`)
- **PackingItem** Prisma model: id, label, category (7 categories), checked, essential, tripId
- **Deterministic rule-based generator** — no AI:
  - 27 base items across 7 categories (clothing, toiletries, electronics, documents, health, accessories, misc)
  - 5 additional items for trips ≥5 days (laundry supplies, travel pillow, rain gear, adapter, extra clothes)
  - Accessibility-aware: keyword matching on notes for wheelchair, mobility, hearing, vision, medication items
  - No duplicates when multiple accessibility keywords match
- **DB-persisted checked state** — survives page reloads
- **Essential flag** — toggle per item, visually distinct
- **Custom items** — add with label, category, and optional essential flag
- **Regenerate** — replaces existing list with fresh generation
- Server actions: `generatePacking`, `togglePackingItem`, `toggleEssential`, `addCustomPackingItem`
- Progress bar showing checked/total count

#### 2. Stay / Accommodation (`src/lib/stay.ts`, `/trips/[id]/stay`)
- **StaySelection** Prisma model: hotelName, costPerNightInr, totalCostInr, nights, lat, lng, tripId (unique)
- **10 sample hotels** with name, cost, coordinates, rating, amenities
- **Amber banner** clearly labeling data as "sample hotels for demonstration purposes"
- **Ranking algorithm**: overallScore = 50% budgetFitScore + 50% distanceScore
  - Budget fit: ratio-based, penalizes exceeding remaining budget (after activities)
  - Distance: average haversine distance to itinerary stops (using Phase 3's synthetic coordinates)
  - 100 for ≤0.5km, 10 for ≥10km, linear interpolation between
- **Hotel selection**: upsert to StaySelection, revalidates both stay and budget pages
- **Hotel removal**: deletes StaySelection, revalidates both pages
- Server actions: `selectHotel`, `removeHotelSelection`

#### 3. Budget Integration (cross-module wiring)
- Budget page (`/trips/[id]/budget`) now includes StaySelection cost in totals
- Summary cards show combined spend (activities + accommodation) with breakdown
- Over-budget warning accounts for stay cost
- Accommodation section shows selected hotel details and per-night cost

#### 4. Navigation
- Trip detail page now has Packing and Stay links (always visible, not gated on itinerary existence)

#### 5. Tests (25 new, 152 total)
- **Packing generation** (10): base items count, long-trip additions, wheelchair/mobility/hearing/vision/medication accessibility items, multiple notes without duplicates, essential flags, determinism, valid categories
- **Stay ranking** (9): returns all hotels, sorted by score, totalCost calculation, budget-fit scoring, distance scoring, zero budget, empty stops, overallScore formula, determinism
- **Budget integration** (5): activity-only totals, stay cost changes remaining, stay pushes over budget, removing stay restores totals, different hotel selection changes spend

### New Pages
- `/trips/[id]/packing` — Packing checklist with generate/add/check/essential
- `/trips/[id]/stay` — Hotel selection with ranking and sample data banner

### Decisions (Phase 4)
- **Sample data banner**: amber-colored, prominent, clearly states hotels are for demonstration only
- **Packing generation**: deterministic rules, not AI — predictable and testable
- **Stay ranking weights**: 50/50 budget fit vs distance — simple and transparent
- **Budget integration**: stay cost added as a separate line alongside activity costs, not injected into the BudgetItem array — keeps the budget engine unchanged
- **Nav links**: Packing and Stay always visible (don't require itinerary generation)

## Health Check (2026-09-13)

### CI Status (post-fix)
- `npm run typecheck` (tsc --noEmit) — **clean**, no errors
- `npm test` (vitest run) — **154 tests pass** across 13 test files, 0 failures
- `npm run build` (next build) — **clean** production build, no warnings, 16 routes generated
- Dev server boots in ~1.3s with no warnings, deprecation notices, or errors at idle

### Fixes Applied

#### Fix 1 (was Bug 1, Medium): Packing accessibility now reachable from UI
- Added `accessibilityNotes` string field to `GroupMember` model in Prisma schema (default `""`)
- Added "Accessibility Needs" text input to trip creation form (`/trips/new`) with placeholder showing keyword examples
- Updated `generatePacking` server action to read `m.accessibilityNotes` directly instead of broken preference-category extraction
- Added end-to-end test: comma-separated notes string → split → packing list includes wheelchair + medication items, excludes hearing items
- The packing generator's keyword matching (wheelchair, mobility, hearing, vision, medication) now works because the notes string contains the keywords

#### Fix 2 (was Bug 2, Minor): Dead code in itinerary engine fixed
- Changed `if (selected.length < selected.length)` to `if (selected.length === lengthBefore)` using a captured length before the weighted random loop
- This restores the intended fallback: if floating-point issues cause the `for` loop to finish without pushing, the last remaining category is used
- Added test verifying each day has exactly the correct number of items for its pace level (easy: 4, balanced: 6, full: 8) — would catch a regression if the fallback broke

#### Fix 3 (was Bug 4, Cosmetic): Route "Saved" card shows "Already optimal" instead of 0 or negative
- When `distanceSavedKm <= 0`, the card now shows "Already optimal" in gray instead of "0.0 km / 0 min" or a confusing negative number

#### Fix 4 (was Bug 5, Cosmetic): Budget category bars clarified
- When a stay is selected, a subtitle "Activity spending only — accommodation shown separately above" appears under the "Spending by Category" heading
- Category bars remain activity-only (cleaner than injecting accommodation as a fake category), but the label makes the scope unambiguous

### Remaining (not fixed, intentionally deferred)

#### Bug 3 (Minor): Dashboard only shows creator's trips
- **Where**: `src/app/dashboard/page.tsx:12`
- **What**: Queries `where: { creatorId: session.user.id }` instead of filtering by group membership. Non-creator members won't see shared trips. No impact today (no invite feature), but will silently break when group invites ship.
- **Deferred**: Until group invite feature is built — no way to test the fix without it.

### Confirmed Working
- **Auth flow**: Signup → auto-login → redirect to dashboard → logout → login → JWT session persists across page refresh. All correct.
- **Trip creation**: Form validation, Prisma create with `creatorId`, auto-creates GroupMember with role "creator". Data matches submission.
- **Discovery error handling**: Fewer than 3 Gemini results → 502 with clear message. Timeout → 502 "temporarily unavailable". UI shows red error box. No silent failures.
- **Itinerary reasoning strings**: Contextual, referencing preference priority, time of day, and pace level. Not generic placeholders.
- **Replanning mutation safety**: `proposeReplan` operates on in-memory copies only — no DB writes. `acceptReplan` is the only write path and requires explicit user accept. Confirmed safe.
- **Budget + Stay integration**: Hotel selection adds `totalCostInr` to budget summary. Removal sets it to 0. Integer arithmetic, no rounding or double-counting issues. `revalidatePath` called for both `/stay` and `/budget`.
- **Packing persistence**: Checked state written to DB via `prisma.packingItem.update`. Page is a server component reading from DB. No localStorage fallback. Fully DB-backed.

## Explicitly Deferred
- Language/translation, memories, live trip features
- Real hotel/booking providers, real maps
- Notifications, OAuth/social login
- UI polish beyond functional and readable

## Phase 3 Status: COMPLETE

All checks pass:
- `npx prisma validate` — schema valid
- `npm run typecheck` (tsc --noEmit) — no errors
- `npm test` (vitest run) — 127 tests pass (10 test files)
- `npm run build` (next build) — successful production build

### What's Built in Phase 3

#### 1. Route Optimization Engine (`src/lib/route-optimizer.ts`)
- Deterministic, no AI — pure coordinate geometry
- **Synthetic coordinates**: generates lat/lng from item title+category hash (no real map provider needed)
- **Haversine distance**: calculates km between stops using great-circle formula
- **Travel time estimation**: assumes 25 km/h average city speed
- **Nearest-neighbor ordering**: reorders stops to minimize total travel distance
- **Backtracking detection**: identifies zigzag segments where route doubles back (trips through A→B→C where A→C is >60% shorter than going via B)
- Returns: original vs optimized order, legs with distances, total km/minutes saved, backtracking report

#### 2. Route Page (`/trips/[id]/route`)
- Day selector tabs to view each day's route
- Side-by-side original vs optimized stop order
- Summary cards: original distance, optimized distance, distance/time saved
- Backtracking warning panel with specific segment descriptions
- Link from trip detail page

#### 3. Replanning Engine (`src/lib/replanner.ts`)
- Handles two disruption types: **delayed** (shifts time) and **skipped** (removes item)
- **Time-sensitive protection**: items marked time-sensitive (sunrise hikes, sunset activities, dinner reservations) are never removed or shifted
- **Priority-based removal**: when a delay threatens a time-sensitive item, removes lower-priority items (shopping/nightlife before culture/sightseeing) instead of cascading the entire schedule
- **Cascade shifting**: non-conflicting items after a delay get shifted later; items starting after the delay window are untouched
- Returns a **proposal** — previous state, proposed state, changes with reasons
- Does NOT auto-apply changes — explicitly requires user accept action
- Category priority scores: sightseeing (8) > dining/culture (7) > nature (6) > adventure (5) > relaxation (4) > shopping/nightlife (3)

#### 4. Replanning UI
- Each itinerary item has a "Mark as delayed/skipped" button
- Inline disruption form: radio toggle delayed/skipped, delay minutes input
- Proposal view: diff-style display showing removed (red), shifted (blue) items with reasons
- **Explicit accept/reject** buttons — changes only persist to DB on accept
- Server actions: `getReplanProposal` (read-only) and `acceptReplan` (writes to DB)

#### 5. Tests (31 new, 127 total)
- **Haversine distance** (3): same point, nearby, far apart
- **Synthetic coordinates** (3): reasonable range, determinism, different inputs diverge
- **Route optimizer** (9): empty/single/two stops, backtracking detection, linear route clean, optimized ≤ original, leg count, positive distances, time/distance consistency, distance saved arithmetic
- **Replanner — skip** (3): removes skipped item, preserves remaining times, reports skip in changes
- **Replanner — delay** (5): shifts delayed item, protects time-sensitive items, removes lower-priority, default 30min delay, unaffected items before/after
- **Replanner — immutability** (2): original items array unchanged, previousState matches input
- **Replanner — edge cases** (4): unknown item id, single-item skip/delay, removal count in summary
- **No-mutation guarantee**: tests verify that `proposeReplan` does not modify input items and that previousState reflects original data

### New Pages
- `/trips/[id]/route` — Route optimization visualization with day selector

### Decisions (Phase 3)
- **No schema change**: Items don't have lat/lng in DB — coordinates are generated deterministically from title+category at runtime via hash. This avoids a migration and keeps the model simple until real map data arrives
- **Nearest-neighbor algorithm**: simple greedy approach for route optimization — good enough for city-scale distances, can upgrade to TSP solver later
- **Backtracking threshold**: 1.6x — a route segment is flagged as backtracking if going A→B→C costs >60% more than A→C direct, and both legs are >0.5 km
- **Time-sensitive detection**: heuristic based on category + time of day (breakfast before 8am, sunset activities, dinner after 7pm, nightlife after 7pm)
- **Average speed**: 25 km/h — reasonable for intra-city travel with stops

## Explicitly Deferred
- Real maps/routing providers (Google Maps, Mapbox, OpenStreetMap)
- Packing, stay, language, memories, live trip, notifications
- UI polish beyond functional and readable
- Lat/lng persistence in DB (currently synthetic/runtime-only)

## Phase 2 Status: COMPLETE

All checks pass:
- `npx prisma validate` — schema valid
- `npm run typecheck` (tsc --noEmit) — no errors
- `npm test` (vitest run) — 96 tests pass (8 test files)
- `npm run build` (next build) — successful production build

### What's Built in Phase 2

#### 1. AI Discovery (Gemini destination suggestions)
- `POST /api/discovery` route — takes `{ description: string }`, returns 3 destination suggestions
- Each destination includes: name, rationale, climate, bestTravelTime, suggestedBudgetLevel, up to 5 activities, matchScore 0-100
- Uses `@google/genai` package with `gemini-2.0-flash` model
- API key read from `GEMINI_API_KEY` (server-side only)
- Strict schema validation on AI response — rejects malformed output with clear error
- Handles markdown code-fence wrapping in AI response
- `/discovery` page with textarea input and rendered destination cards
- Error states: 400 (bad input), 502 (provider failure or schema mismatch), 503 (missing API key)

#### 2. Group Alignment (Gemini tension/compromise analysis)
- `POST /api/group-alignment` route — takes `{ travelers: TravelerProfile[] }`
- TravelerProfile: name, pace (easy/balanced/full), interests, priorities, foodPreferences, accessibility
- Returns: coreTension, compromiseSuggestion, harmonyScore (0-100)
- Does NOT modify the trip's itinerary — suggestion only
- Same error handling pattern as discovery
- `/group-alignment` page with dynamic traveler form (add/remove, 2-20 travelers)

#### 3. Budget Module (deterministic, no AI)
- `computeBudgetSummary()` — category totals, estimated spend, remaining budget
- `optimizeBudget()` — when over budget, removes lowest-value-score paid items first
  - Value scores per category: sightseeing (8) > dining/culture (7) > nature (6) > adventure (5) > relaxation (4) > shopping/nightlife (3)
  - Tie-breaking: more expensive items removed first within same value tier
  - Free items (cost 0) never removed
  - Returns removed items with reasoning and updated summary
- `/trips/[id]/budget` page — summary cards, category bar chart, item table
- Budget optimization via server action — actually deletes removed items from DB
- Budget link appears on trip detail page when itinerary exists

#### 4. Error Handling
- All AI routes: 400 for invalid client input, 503 for missing GEMINI_API_KEY, 502 for provider failure or schema validation failure
- Custom error classes: GeminiConfigError, GeminiProviderError, GeminiSchemaError, ValidationError
- UI shows distinct error states — never fabricates a fake AI response

#### 5. Tests (96 passing, 8 test files)
Phase 1 tests (28):
- Auth password hashing, trip validation, itinerary engine

Phase 2 tests (68):
- **Discovery input validation** (8): valid input, null/empty/long/whitespace rejection
- **Discovery response schema** (12): valid 3-dest response, wrong count, empty fields, activities bounds, matchScore range/type/rounding, non-string activity
- **Discovery service (mocked Gemini)** (6): success, code-fence handling, API failure, empty response, invalid JSON, wrong schema
- **Group alignment input validation** (7): valid input, too few/many travelers, missing fields, invalid pace, non-array/non-string arrays
- **Group alignment response schema** (8): valid response, null, empty fields, missing fields, harmonyScore range/type/rounding, trimming
- **Group alignment service (mocked Gemini)** (7): success, code-fence handling, API failure, empty response, invalid JSON, missing/out-of-range harmonyScore
- **Budget summary** (5): correct totals, over-budget detection, category grouping, sort order, empty items
- **Budget optimizer** (8): under-budget no-op, removes to fit, value ordering, shopping-before-sightseeing, expensive-first tiebreak, removal reasons, skips free items, full removal

### New Pages
- `/discovery` — AI destination discovery
- `/group-alignment` — AI group harmony analysis
- `/trips/[id]/budget` — Budget overview and optimizer

## Decisions (Phase 2)
- **Gemini model**: gemini-2.0-flash — fast, good enough for structured JSON output
- **AI response parsing**: strip markdown code fences, then JSON.parse, then strict schema validation
- **Budget value scores**: hand-tuned category scores (sightseeing highest, shopping/nightlife lowest) — simple and predictable
- **Budget optimization**: removes items from DB permanently (via server action) — user triggers it explicitly

## Notes
- Live discovery and group alignment require a real `GEMINI_API_KEY` in `.env` to test manually
- All tests mock the Gemini client — no real API calls during test suite, no API key needed for tests

---

## Phase 1 Status: COMPLETE

All checks pass:
- `npx prisma validate` — schema valid
- `npm run typecheck` (tsc --noEmit) — no errors
- `npm test` (vitest run) — 28 tests pass (3 test files)
- `npm run build` (next build) — successful production build

### What's Built in Phase 1

#### 1. Project Scaffold
- Next.js 16.3.5 (App Router) + TypeScript + Tailwind CSS v4
- ESLint configured

#### 2. Database (Prisma + SQLite)
Models: User, Trip, GroupMember, ItineraryDay, ItineraryItem

#### 3. Authentication (NextAuth v5 beta)
- Credentials provider with bcrypt-hashed passwords
- JWT session strategy, server-side session checks

#### 4. Trip Creation Flow
- Full form validation, persists to DB with creator as first group member

#### 5. Deterministic Itinerary Engine
- 8 categories, 3 pace levels, preference priorities, per-item reasoning, seeded PRNG

### Decisions (Phase 1)
- Auth: NextAuth v5 beta + Credentials + JWT
- Database: SQLite via Prisma 6
- Testing: Vitest 5
- Preferences: JSON string in GroupMember
- Itinerary determinism: seeded PRNG from destination + dates hash

## Explicitly Deferred
- Route optimization, replanning engine
- Packing, stay, language, memories, live trip features
- Real maps/hotel/weather/translation providers
- UI polish beyond functional and readable
- OAuth/social login providers
- Middleware-based route protection
