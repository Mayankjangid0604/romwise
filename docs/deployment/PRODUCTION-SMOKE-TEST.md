# Production Smoke Test Checklist

Use this checklist immediately after deploying to a production or staging environment to verify system integrity.

## Authentication
- [ ] User can sign up or log in.
- [ ] Session persists across page reloads.

## Dashboard
- [ ] Dashboard loads successfully.
- [ ] Recent trips are visible.
- [ ] Favorites are visible and accessible.

## Discovery
- [ ] Discovery index page loads.
- [ ] Filtering/Search (e.g., typing "Manali") narrows down the collections.
- [ ] Clicking a destination (e.g., "Mountains", "Beaches") navigates correctly to its detail page.
- [ ] Similar Destinations appear correctly on destination detail pages.

## Planner & Generation
- [ ] Start a new trip.
- [ ] Select dates and click continue.
- [ ] System properly delegates to V2 deterministic planner (if Gemini is missing).
- [ ] "Building Itinerary..." completes successfully without "Trip generation failed" false errors.
- [ ] Resulting trip info displays accurately.

## Spiritual & Preferences
- [ ] No spiritual inference or explicit assumption of religion.
- [ ] Preference model accepts constraints (e.g., "Prefer fewer religious sites").
- [ ] Excluded place categories stay out of the itinerary.

## Itinerary & Logistics
- [ ] Itinerary loads timeline view.
- [ ] Drag-and-drop correctly reorders places and adjusts durations.
- [ ] Add Place search opens.
- [ ] Adding a place correctly checks IDOR and prevents cross-trip additions.

## Map
- [ ] Route Map page opens successfully.
- [ ] Default map tiles (OpenStreetMap/Carto) load without breaking or requiring a MapTiler API Key.
- [ ] Map attribution is visible.
- [ ] Markers and route polyline render correctly.

## Budget
- [ ] Budget tab calculates approximate cost in INR.
- [ ] Missing unknown place costs default to `null` and don't zero out average values randomly.

## Collaboration & Sharing
- [ ] Generating a share link works.
- [ ] Another browser (incognito) can join using the link.
- [ ] Viewers can view but cannot edit or delete trips (IDOR enforcement).

## Exports
- [ ] ICS export triggers successfully with a calendar download.
- [ ] PDF export triggers successfully via `/api/trips/[id]/pdf` generating a server-side Playwright/Chromium document.

## PWA & Performance
- [ ] Site passes Lighthouse checks.
- [ ] Offline fallback displays when simulating disconnected network.
- [ ] Pages load responsively.

---
**Security Notes:** 
- `E2E_TEST_MODE`, `E2E_AI_MOCK`, and `OTP_TEST_BYPASS` must be `false` or undefined in the environment.
