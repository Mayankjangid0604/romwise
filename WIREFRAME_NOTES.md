# Roamwise: Page-Flow Review & Proposed Wireframes

*Written 2026-09-26 as item 5 of the bug-fix/UX pass. This is a **proposal**: nothing in
the "Proposed" sections has been built. Changes already shipped in this pass (item 2) are
listed separately so it's clear what is live vs. what needs sign-off.*

## 1. How this was reviewed

Every page was opened in a production build with a real account, trip and itinerary, and
every `Link` / `router.push|replace` / `redirect()` was traced in code (see PROGRESS.md item 2
for the per-link audit). Below, **"re-opens"** means a click lands the user on a page or form
they've just seen; **"redundant"** means two different places do the same job.

## 2. Current page map (after this pass's fixes)

```
                    ┌──────────── global nav: Dashboard · Discover · + New Trip ────────────┐
 /  (landing) ──► /signup | /login ──(callbackUrl honoured)──► /dashboard
                                                                  │
      ┌──────────────────────────┬────────────────────────────────┼───────────────────────────┐
      ▼                          ▼                                ▼                           ▼
 /discovery                 /trips/new                   template card                  trip card
   ├─ ?collection=…           (destination search          "Use Template" ──► /trips/[id]     │
   │    (filter in place)       → ?destination=X → form)                                      │
   └─ /discovery/[name]  ── quick-plan form ──► /trips/new?destination=…&dates…               │
                                                   │ "Generate My Trip"                        │
                                                   ▼                                           ▼
 /trips/join/[token] (invite) ─────────────► /trips/[id]  ◄──────────────────────────────────┘
                                             tab bar: Overview · Itinerary · Packing · Budget ·
                                                      Stay · Places · Route · Preferences · Group
                                             overview buttons: Save offline · Live · PDF · Print
```

## 3. Findings: where the flow is redundant or re-opens something

| # | Where | What the user experiences | Status |
|---|---|---|---|
| F1 | New Trip → pick destination | Used to jump to `/discovery/<name>`, then "Plan" returned to `/trips/new`. | **Fixed (item 2)**: stays in `/trips/new`. |
| F2 | Discovery destination page → New Trip | Discovery's **"Plan Your Trip Here"** form asks month, days, budget, pace, then `/trips/new` shows **the same fields again** (prefilled) before anything happens. Two forms for one decision. | Proposed (P1) |
| F3 | Trip overview **"Stays"** vs **Stay** tab | Two unrelated stay concepts: overview "Add Stay" is free text (name/location); the Stay tab ranks hotels with prices and budget impact. Both write `TripAccommodation`, but the Stay tab treats "first accommodation" as *the* selection, and selecting a hotel used to wipe manually added stays. | Partly fixed in items 8/10 (see there); unification proposed (P3) |
| F4 | Trip overview **"View Full Itinerary"**, **Estimated cost ↗** | Duplicate the Itinerary / Budget tabs one row above. Harmless, but the overview reads as a second navigation bar instead of a summary. | Proposed (P2) |
| F5 | Packing, Stay, Preferences pages | Each has a "← Trip" back link and page header *inside* the workspace, which already has a breadcrumb + tab bar. Back link, breadcrumb and Overview tab all do the same thing. | Proposed (P2), low risk |
| F6 | Dashboard | "Plan a trip" / "Discover" buttons duplicate the global nav's "+ New Trip" / "Discover". "Recently viewed" often shows the same trip as the "Upcoming trip" hero directly above it. The upcoming-trip hero's "Next Adventure" badge is unreadable (dark text on dark teal: the local `cn()` doesn't merge conflicting Tailwind classes, so the Badge's `text-lagoon-800` beats the `text-lagoon-100` override). | Proposed (P4) |
| F7 | Overview transit/stay empty states | "Add Flight/Train" / "Add Stay" appear twice each (section header + empty-state box). | Proposed (P2) |
| F8 | "Info" tab | Opened a placeholder page. | **Fixed (item 2)**: tab is now "Preferences"; `/info` redirects. |
| F9 | Stay / Preferences / Print | No inbound links at all. | **Fixed (item 2)**: tabs + Print button. |
| F10 | Generate / reorder | Full page reloads re-opened the same page. | **Fixed (item 2)**: `router.refresh()`. |
| F11 | Nine flat tabs | Overview · Itinerary · Packing · Budget · Stay · Places · Route · Preferences · Group scroll horizontally on phones (the tab bar is `overflow-x-auto`), with no grouping of plan vs. logistics vs. people. | Proposed (P2) |
| F12 | Itinerary ↔ Places | Places (browse + mark must-visit/avoid) only affects the *next* generation, while "Add place" (item 1) edits the current plan. Two ways to "add a place" with different effects, and neither says so. | Proposed (P5) |

## 4. Proposed flow

### P1. One planning form (fixes F2)

Keep **`/trips/new` as the only form**. Discovery's destination page keeps its guide
content and gets a single CTA that carries only what the user has actually chosen.

```
/discovery/Jaipur                                /trips/new?destination=Jaipur[&month=Nov]
┌──────────────────────────────────────────┐     ┌──────────────────────────────────────┐
│  [hero]  Jaipur                          │     │  ◉ Jaipur · Rajasthan   (change)     │
│  Overview · Quick facts · Must-visit     │     │  When?   [Nov ▾] or [exact dates]    │
│  Cuisine · Tips · You might also like    │     │  Days    [ 5 ]   Travelers [ 2 ]     │
│                                          │     │  Budget  [ ₹ 40,000 ] (suggested)    │
│  ┌────────────────────────────────────┐  │     │  Pace    ( ) Easy (•) Balanced ( )   │
│  │ Plan a trip to Jaipur →            │──┼────►│  Accessibility notes [           ]  │
│  └────────────────────────────────────┘  │     │  [ Generate my trip ]                │
│  (quick-plan form removed)               │     └──────────────────────────────────────┘
└──────────────────────────────────────────┘
```
URL impact: none. `/trips/new` already accepts `destination`, `startDate`, `endDate`, `budget`
and `pace` params, so old links keep working.

### P2. Trip workspace: overview as a hub, grouped tabs (fixes F4, F5, F7, F11)

```
Dashboard / Trip to Jaipur · Jaipur
[ Overview ]  Plan: Itinerary · Places · Route   Logistics: Stay · Budget · Packing   People: Group · Preferences
──────────────────────────────────────────────────────────────────────────────────────────────
Overview (summary cards, each links to its tab; no duplicate CTAs)
┌ Itinerary ─────────────┐ ┌ Budget ────────────────┐ ┌ Readiness ─────────────┐
│ 2 days · 9 stops        │ │ ₹2,815 of ₹40,000      │ │ ████████░░ 50%         │
│ Next: Hawa Mahal 09:00  │ │ + stay ₹7,200          │ │ ☐ Packing ☐ Transit     │
│ [+ Add place]           │ │                        │ │ ☐ Stay                  │
└─────────────────────────┘ └────────────────────────┘ └─────────────────────────┘
┌ Stay (item 10) ───────────────────────────┐ ┌ Transit ──────────────────────────┐
│ Selected: —                                │ │ No transit yet  [+ Add]           │
│ Suggested: 3 hotels · name · ★ · ₹/night   │ │                                    │
│ [See all stays →]                          │ └────────────────────────────────────┘
└────────────────────────────────────────────┘
```
- Tabs stay the same URLs; only their grouping/labels change. On phones: Overview + a
  "Plan / Logistics / People" segmented control, instead of a 9-tab horizontal scroll.
- Remove in-workspace "← Trip" back links (F5) and duplicate empty-state buttons (F7).

URL impact: none (no route added, removed or renamed).

### P3. One stay model (finishes F3)

- Stay tab = the one place to pick/replace **the** hotel (ranked sample data, clearly labeled).
- Overview "Stays" = the chosen hotel + any extra nights the user typed in manually
  (e.g. a relative's house), shown as a list.
- Needs a schema decision before building: today `TripAccommodation` can't tell "the
  selected hotel" from "a manually added stay". Item 8 adds an explicit `source` marker so
  selecting a hotel no longer deletes manual entries; P3 is the UI follow-through.

URL impact: none.

### P4. Dashboard trims (F6)

- Drop the page-level "Plan a trip / Discover" buttons, or keep them and hide the nav
  duplicates on the dashboard only. Pick one; showing both is the redundancy.
- Hide "Recently viewed" entries that are already shown as the Upcoming trip.
- Fix the unreadable "Next Adventure" badge (class-conflict; either pass an explicit tone or adopt `tailwind-merge` in `cn()`).

URL impact: none.

### P5. Make the two "add a place" paths explicit (F12)

- Places tab header: "Mark places as **must-visit** or **avoid** — used next time you
  regenerate", with a secondary "Add to current plan" button per row that opens the item-1
  Add Place dialog preselected.
- Add Place dialog (item 1): footer hint "Adds to your current plan only".

URL impact: none.

## 5. What would touch URLs (flagged, not proposed)

Nothing above renames or removes a route. If a future pass wants cleaner URLs, these are the
candidates, and each would need a redirect for existing bookmarks/shared links:

| Candidate | Why | Needs |
|---|---|---|
| `/trips/[id]/info` | Already redirects to `/preferences`. Can be deleted once old links age out. | Keep the redirect for a release. |
| `/trips/[id]/print` vs `/api/trips/[id]/pdf` | Two ways to print. The PDF route needs headless Chromium, which may not run on Vercel's default runtime (see PROGRESS item 9). | Decide whether PDF stays server-side or Print becomes the only path. |
| `/api/chat/planner` | Not linked from the web UI any more; likely the mobile entry point. | Keep; document as a mobile/API endpoint. |

## 6. Suggested order

1. P1 (removes the most obvious repeated form; no URL/schema impact).
2. P2 and P4 (layout-only; can ship together).
3. P3 after the item 8 schema marker has been live for a release.
4. P5 copy + button.
