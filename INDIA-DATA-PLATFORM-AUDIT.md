# India Data Platform Audit

## 31. Navbar Regression

**Symptom:** When navigating to any `/trips/[id]/*` page, the global app navigation bar appeared twice — once from the parent layout and once from the trip-detail layout.

**Root cause:** `src/app/trips/[id]/layout.tsx` wrapped its content in `<AppShell><AppNavigation />…</AppShell>`. However, Next.js layouts are nested: the parent `src/app/trips/layout.tsx` already wraps all trip routes in `<AppShell><AppNavigation /><main>…</main></AppShell>`. The `[id]` layout was rendered as `children` of that `<main>`, so `AppNavigation` was mounted twice in the DOM.

**Files changed:**
- `src/app/trips/[id]/layout.tsx` — removed `AppShell` and `AppNavigation`; the layout now only renders the sticky workspace tab bar and content wrapper.

**Fix:** Removed the duplicate `AppShell` + `AppNavigation` from the trip detail layout. The global nav comes exclusively from `trips/layout.tsx`; the trip-specific tab bar (`TripWorkspaceNav`) remains in `trips/[id]/layout.tsx` as a secondary, contextual navigation.

**Desired architecture:**
```
Root layout
  └─ trips/layout.tsx  →  AppShell + AppNavigation (global, once)
       └─ main
            └─ trips/[id]/layout.tsx  →  sticky tab bar only
                 └─ page content
```

**Tests:** See `tests/e2e/responsive.spec.ts` (nav assertion at desktop and mobile viewports).

---

## 32. Generate Itinerary Regression

**Symptom:** Clicking "Generate Itinerary" would sometimes leave a trip permanently in `generating` status; the button could also be clicked multiple times while generation was in progress.

**Root cause:**
1. The background job at `/api/jobs/generate-itinerary/route.ts` had an outer `try/catch` block that returned a 500 response on any unexpected error, but never reset `trip.status` back from `"generating"` to `"draft"`. Only the inner Trip Brain catch block reset the status.
2. In `generate-button.tsx`, `useTransition`'s `pending` state returns `false` as soon as the server action (`generateTripItinerary`) resolves — but generation is asynchronous (fires a background job); actual completion is tracked by polling. The button was re-enabled while polling was still running, allowing duplicate generation requests.
3. The polling `setInterval` was not cleaned up on component unmount, leaking a timer.

**Generation pipeline:**
```
UI button click
  → generateTripItinerary() server action
    → auth + membership check
    → entitlement check (pre-flight, credit consumed on success)
    → trip.status = "generating"
    → after(): fires POST /api/jobs/generate-itinerary
      → auth (INTERNAL_JOB_SECRET header)
      → fetchGroundedItinerary() (Trip Brain / Gemini)
      → on success: persist ItineraryDay + items, trip.status = "planning"
      → on failure: trip.status = "draft"
  → client polls /api/trips/[id]/status every 2 s
    → status === "planning" → reload page
    → status === "draft"    → show error, re-enable button
```

**Failure location:** Outer `catch` in the background job route did not reset trip status.

**Fix:**
- Hoisted `tripId` declaration above the outer `try` block in the route handler, so the outer `catch` can reset `trip.status = "draft"`.
- Replaced `useTransition`'s `pending` with explicit `isGenerating` state that remains `true` until polling resolves (success or failure).
- Added `useRef` + `useEffect` cleanup to clear the polling interval on unmount.
- Added early-return double-click guard (`if (isGenerating) return`).
- Improved user-facing error message.

**Vercel compatibility:** Generation uses `next/server`'s `after()` to fire a fire-and-forget internal fetch after the response is sent. The background route has `export const maxDuration = 60` for Vercel Pro. The server action itself returns immediately (status: generating + polling); no long-running process assumption. `APP_URL` must be set in the Vercel environment for the internal fetch URL.

**Tests:** See `tests/e2e/` — generation test stubs added in the responsive spec.

---

## 33. Responsive Audit

| Screen | 320 | 375 | 390 | 430 | 768 | 820 | 1024 | 1280+ |
| ------ | --- | --- | --- | --- | --- | --- | ---- | ----- |
| Dashboard | FIXED | FIXED | PASS | PASS | PASS | PASS | PASS | PASS |
| New Trip planner | FIXED | FIXED | PASS | PASS | PASS | PASS | PASS | PASS |
| Trip Overview | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Itinerary | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Budget | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Route/Map | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Group | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Discovery | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

**Fixes applied:**
- `dashboard/page.tsx`: `text-3xl` → `text-2xl sm:text-3xl` heading, `min-w-[200px]` hero panel → `w-full md:min-w-[200px] md:w-auto`.
- `trips/new/page.tsx`: Fixed `h-[650px]` chat card → `h-[calc(100svh-160px)] min-h-[400px] max-h-[650px]` for dynamic viewport height on mobile.

---

## 34. Navigation Responsive Behavior

- **Mobile (< md / 768px):** Global nav shows hamburger button; clicking opens a vertical menu overlay. Desktop nav links and user actions are hidden (`hidden md:flex`). Mobile menu items close on click.
- **Tablet (768–1023px):** Desktop nav visible (`md:flex`), same as desktop. No overlap.
- **Desktop (≥ 1024px):** Full nav with links and "+ New Trip" button.
- **Trip workspace:** Tab bar (`TripWorkspaceNav`) uses `overflow-x-auto -mx-1 px-1` with `min-w-max` so tabs scroll horizontally on small screens without causing page overflow.
- **Breakpoint:** Single source at `md:` (768px). There is no range where both mobile hamburger and desktop links are simultaneously visible.

---

## 35. Mobile Itinerary

- Activity cards use responsive padding (`p-4`).
- Text sizes are 14–15px+ for body content; no sub-12px content found.
- `TripWorkspaceNav` tabs scroll horizontally with `overflow-x-auto`; no page-wide overflow.
- Drag handles from DnD library are pointer-based; touch works via browser pointer event emulation. No alternative move controls added (complexity would exceed scope).

---

## 36. Tablet Layout

- Navigation breakpoint is `md:` (768px) — tablet-sized viewports see the desktop nav, which is appropriate.
- Trip tab bar horizontal scroll works at 768px.
- Budget and group pages use `grid-cols-1 sm:grid-cols-3` — single column below 640px, 3 columns above; no cramping at tablet widths.

---

## 37. Responsive E2E

Responsive smoke spec created at `tests/e2e/responsive.spec.ts`.

Tests cover:
- Key routes at 375×667 (mobile), 768×1024 (tablet), 1440×900 (desktop).
- No horizontal page overflow (`scrollWidth <= clientWidth`).
- Global nav visible exactly once per viewport range.
- Mobile nav hidden at desktop; desktop nav hidden at mobile.
