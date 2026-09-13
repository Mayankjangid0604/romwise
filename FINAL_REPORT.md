# Roamwise — Final Project Report

*Generated: 2026-09-13. All CI numbers are live — verified by running the commands immediately before this report was written.*

---

## 1. What Is Roamwise

Roamwise is a full-stack AI-assisted group travel planning web application. Users sign up, create a trip by entering a destination, dates, traveler count, daily budget, pace preference, and individual traveler interests, then get a fully generated, day-by-day itinerary — deterministic and reproducible from the same inputs. From there they can explore AI-suggested destinations before committing to a trip, check group harmony across conflicting traveler preferences, view an optimized travel route, manage a real-time budget, select accommodation from a ranked hotel list, generate an accessibility-aware packing checklist, and handle live disruptions (delays and cancellations) via a propose-then-accept replanning flow. Everything except AI calls runs without any external API dependency, making it fully functional in local development without network services beyond a running PostgreSQL instance.

---

## 2. Feature List by Phase

### Phase 1 — Foundation
| Feature | Status |
|---|---|
| Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 scaffold | Built + tested |
| Prisma schema: User, Trip, GroupMember, ItineraryDay, ItineraryItem | Built + tested |
| NextAuth v5 credentials auth with bcrypt (12 rounds), JWT sessions | Built + tested |
| Trip creation form with full server-side validation | Built + tested |
| Deterministic itinerary engine (8 categories, 3 pace levels, seeded PRNG, per-item reasoning) | Built + tested |
| Server-side session checks on all DB-touching server actions | Built + tested |

### Phase 2 — AI Features & Budget
| Feature | Status |
|---|---|
| `/api/discovery` — Gemini destination suggestions (3 results, structured schema) | Built + tested (mocked); AI path manually verified |
| `/discovery` page — textarea input, rendered destination cards, error states | Built + manually verified |
| `/api/group-alignment` — Gemini tension/compromise analysis for traveler groups | Built + tested (mocked); AI path manually verified |
| `/group-alignment` page — dynamic traveler form (2–20), results display | Built + manually verified |
| Budget engine — `computeBudgetSummary()`, category totals, over-budget detection | Built + tested |
| Budget optimizer — value-scored removal of paid items when over budget | Built + tested |
| `/trips/[id]/budget` page — summary cards, category bar chart, item table, optimizer button | Built + manually verified |
| Custom error classes: GeminiConfigError, GeminiProviderError, GeminiSchemaError, ValidationError | Built + tested |

### Phase 3 — Route Optimization & Replanning
| Feature | Status |
|---|---|
| Route optimizer — synthetic coordinates, haversine distance, nearest-neighbor ordering | Built + tested |
| Backtracking detection (1.6x threshold) | Built + tested |
| `/trips/[id]/route` page — day selector, side-by-side order comparison, distance/time saved cards | Built + manually verified |
| Replanning engine — delayed/skipped disruption handling, time-sensitive protection, priority-based removal | Built + tested |
| Replanning UI — inline disruption form, diff-style proposal view, explicit accept/reject | Built + manually verified |
| `proposeReplan` (read-only) + `acceptReplan` (write-only on explicit accept) | Built + tested |

### Phase 4 — Packing, Stay & Budget Integration
| Feature | Status |
|---|---|
| Packing generator — 27 base items, 7 categories, accessibility-aware keyword matching | Built + tested |
| Long-trip additions (>=5 days: 5 extra items) | Built + tested |
| DB-persisted checked state, essential flag, custom item add, regenerate | Built + tested |
| `/trips/[id]/packing` page — progress bar, category grouping, custom item form | Built + not yet manually verified |
| Stay ranking — 10 sample hotels, 50/50 budget fit + haversine distance score | Built + tested |
| Hotel selection / removal with budget page revalidation | Built + tested |
| `/trips/[id]/stay` page — ranked hotel list, amber sample-data banner, select/remove actions | Built + manually verified |
| Budget page updated with accommodation line, over-budget warning includes stay cost | Built + tested |
| Budget category bar subtitle clarifying activity-only scope when stay is selected | Built + manually verified |

### Health Check Phase — Fixes
| Fix | Status |
|---|---|
| Accessibility notes field added to GroupMember, wired through trip creation form and packing generator | Built + tested |
| Dead-code bug in itinerary engine fallback path corrected | Built + tested |
| Route page "Saved" card: shows "Already optimal" when distanceSavedKm <= 0 | Built + manually verified |
| Budget category bar subtitle when stay is selected | Built + manually verified |

### Production Hardening Phase
| Item | Status |
|---|---|
| Database provider migrated: SQLite -> PostgreSQL | Built (schema valid) |
| In-memory rate limiter on login + signup (5 attempts / 15-min window per IP) | Built + tested |
| Input sanitization: email trim + lowercase, name trim, length limits | Built + tested |
| bcrypt 12 rounds hardcoded (not configurable via env) | Built + tested |
| No client-provided userId in any server action | Built + tested |
| No secrets or stack traces in API error responses | Built + tested |
| Root error boundary (`/error.tsx`) + trip-section error boundary | Built + not yet manually verified |
| `.env.example` updated with PostgreSQL format, all vars documented | Done |
| `PRODUCTION_SETUP.md` deployment guide (Neon/Supabase + Vercel) | Done |

---

## 3. Test Suite — Live Numbers

*Commands run: 2026-09-13, immediately before this report.*

### `npm run typecheck` (tsc --noEmit)
```
Exit code: 0
Output: (no errors)
```
**PASS — Zero type errors.**

### `npm test` (vitest run)
```
Test Files  15 passed (15)
     Tests  169 passed (169)
  Duration  3.76s
```
**PASS — 169 tests, 15 test files, 0 failures.**

Test file breakdown:
| File | Tests | What's Covered |
|---|---|---|
| `auth.test.ts` | 5 | bcrypt hash/verify, wrong password, salted uniqueness |
| `trip-validation.test.ts` | 11 | Field presence, date ordering, traveler count, budget bounds |
| `itinerary-engine.test.ts` | 13 | Category distribution, pace levels, determinism, day item counts |
| `discovery.test.ts` | 22 | Input validation (null/empty/long), response schema (count, fields, bounds) |
| `discovery-service.test.ts` | 7 | Mocked Gemini: success, code-fence, API failure, empty/invalid JSON, schema mismatch |
| `group-alignment.test.ts` | 17 | Input validation (traveler count, pace, fields), response schema |
| `group-alignment-service.test.ts` | 8 | Mocked Gemini: success, code-fence, failure paths |
| `budget.test.ts` | 14 | Totals, over-budget, category grouping, sort, empty items, optimizer value ordering |
| `budget-integration.test.ts` | 5 | Stay cost in summary, over-budget with stay, stay removal, hotel swap |
| `route-optimizer.test.ts` | 16 | Empty/single/two stops, backtracking, optimized <= original, leg distances, haversine |
| `replanner.test.ts` | 15 | Skip/delay behavior, time-sensitive protection, immutability, edge cases |
| `packing.test.ts` | 12 | Base count, long-trip items, accessibility keywords, no duplicates, essential flags |
| `stay.test.ts` | 9 | All hotels returned, sorted by score, budget-fit, distance score, totalCost |
| `rate-limit.test.ts` | 6 | Under limit, over limit, independent keys, window expiry, reset, retryAfterSeconds |
| `security.test.ts` | 9 | bcrypt rounds, no env leaks, no stack traces, no userId from formData, session checks, input limits |

### `npm run build` (next build)
```
Exit code: 0
Compiled successfully in 8.3s
TypeScript: clean
16 routes generated

Route (app)
├ f /                          (dynamic)
├ o /_not-found                (static)
├ f /api/auth/[...nextauth]    (dynamic)
├ f /api/discovery             (dynamic)
├ f /api/group-alignment       (dynamic)
├ f /dashboard                 (dynamic)
├ o /discovery                 (static shell)
├ o /group-alignment           (static shell)
├ o /login                     (static)
├ o /signup                    (static)
├ f /trips/[id]                (dynamic)
├ f /trips/[id]/budget         (dynamic)
├ f /trips/[id]/packing        (dynamic)
├ f /trips/[id]/route          (dynamic)
├ f /trips/[id]/stay           (dynamic)
└ o /trips/new                 (static)
```
**PASS — Clean production build. Zero warnings.**

---

## 4. Known Limitations

These are explicitly acknowledged limitations — not bugs — that are deferred by design:

1. **Dashboard shows creator's trips only** (`src/app/dashboard/page.tsx:12` — `where: { creatorId: session.user.id }`). Group members who did not create the trip will not see it in their dashboard. There is currently no invite/member-join flow, so this has no visible impact today, but it will silently break when group invites ship. Deferred until that feature is built.

2. **Sample hotel data** — The stay page uses 10 hardcoded demo hotels with static costs and coordinates. The amber banner on the page labels this clearly. There is no real booking provider integration (Booking.com, Airbnb, etc.). Costs are INR-denominated and not configurable per trip currency.

3. **No real maps provider** — Route coordinates are generated synthetically from a deterministic hash of each item's title and category. The route optimizer works correctly on these synthetic coordinates, but the resulting order has no relationship to real-world geography. A real integration (Google Maps, Mapbox, OpenStreetMap) would require replacing `getCoordinates()` in `src/lib/route-optimizer.ts` and adding lat/lng to the Prisma schema.

4. **In-memory rate limiter — multi-instance caveat** — The rate limiter (`src/lib/rate-limit.ts`) is a Map in process memory. It resets on server restart and does not share state across multiple server instances or Vercel function invocations. Acceptable for a single-instance initial deployment. For multi-instance or serverless scale-out, replace with a Redis-backed solution (e.g. `@upstash/ratelimit`).

5. **IP rate limiting fallback** — Rate limiting uses `x-forwarded-for`. If the header is absent (unusual but possible in some proxy setups), all such requests share a single rate-limit bucket under the key `"unknown"`.

6. **No real currency support** — Budget values, hotel costs, and itinerary item costs are all denominated in INR with no currency selection or conversion.

7. **No real-time features** — No WebSocket or push notification support. Group members cannot see each other's changes live.

8. **Auth: credentials-only** — No OAuth/social login providers (Google, GitHub, etc.). Deferred.

9. **No middleware-based route protection** — Route protection is handled by individual server components calling `auth()` and redirecting. A Next.js middleware file would be more robust but was explicitly deferred.

10. **Packing page not yet manually verified end-to-end** — The packing generator and DB persistence are unit-tested, and the accessibility note wiring fix was confirmed in tests. The full UI flow (generate → check items → reload → confirm persistence) has not been walked through in a browser with a live database. This is the primary item on the manual test checklist.

---

## 5. Production Readiness Status

*Pulled directly from `PRODUCTION_SETUP.md`.*

### Done — No Further Action Needed
- PostgreSQL migration: schema uses `postgresql` provider, all Prisma types translate cleanly, schema passes `prisma validate`
- Auth hardening: bcrypt 12 rounds, rate limiting, input sanitization, length limits, session-derived userId only
- Secrets audit: no `NEXT_PUBLIC_` exposure, no secrets in error responses, `.gitignore` covers `.env*`
- Error boundaries: root + trip-section; generic error messages only, no stack traces exposed
- Production build: clean, 0 warnings, 16 routes
- `PRODUCTION_SETUP.md` and `.env.example` written and accurate

### Requires Manual Action Before Going Live

| Action | Detail |
|---|---|
| **Generate a real `AUTH_SECRET`** | Run `openssl rand -base64 32`. The current `.env` contains the weak placeholder `development-secret-change-in-production`. A weak secret means session tokens can be forged. |
| **Provision a real PostgreSQL database** | Create a Neon or Supabase project, copy the connection string. The current `DATABASE_URL` in `.env` points to a non-existent local Postgres instance (`localhost:5432/roamwise`). |
| **Run `prisma db push` against the production database** | After setting the production `DATABASE_URL`, run `npx prisma db push` to create all tables. Without this step the app boots but every DB call fails. |
| **Get and set a `GEMINI_API_KEY`** | Required for `/discovery` and `/group-alignment`. Without it those routes return 503. Get one at https://aistudio.google.com/apikey |
| **Deploy to Vercel, set all three env vars** | `DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY` must be set in Vercel's env vars panel for the **Production** environment (not just Preview). |
| **Decide on rate limiter approach** | Confirm whether the in-memory rate limiter is acceptable (single Vercel function) or whether `@upstash/ratelimit` is needed before launch. |
| **Optional: set `AUTH_URL`** | Only needed with a custom domain. Set to `https://yourdomain.com`. |
| **Optional: custom domain + SSL** | Vercel provisions SSL automatically. Add domain in Settings → Domains. |

---

## 6. Tech Stack Summary

| Layer | Choice | Notes |
|---|---|---|
| **Framework** | Next.js 16.3.5 (App Router) | Server components, server actions, Turbopack in dev |
| **Language** | TypeScript 5 | Strict mode, zero type errors |
| **Styling** | Tailwind CSS v4 | Via `@tailwindcss/postcss` |
| **Database ORM** | Prisma 6.19.3 | Schema-first, type-safe client |
| **Database** | PostgreSQL | Local dev requires running Postgres; production via Neon or Supabase |
| **Auth** | NextAuth v5 beta (next-auth@5.0.0-beta.32) | Credentials provider, JWT session strategy |
| **Password hashing** | bcryptjs 3.0.3 | 12 rounds, hardcoded |
| **AI provider** | Google Gemini (`@google/genai` 2.22.0) | `gemini-2.0-flash`; discovery and group alignment only |
| **Testing** | Vitest 5 + @testing-library/react 16 | 169 tests, 15 files, no live API calls |
| **Linting** | ESLint 9 + eslint-config-next | |
| **Deployment target** | Vercel | Per `PRODUCTION_SETUP.md` |
