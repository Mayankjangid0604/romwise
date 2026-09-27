# ROAMWISE V3.2 — PRODUCTION SMOKE TEST

Execute these tests immediately after production deployment to verify system health.

## Phase 1: Core Navigation & Health
- [ ] 1. Load the homepage and verify rendering (No 500 errors).
- [ ] 2. Verify all global navigation links are functional (Destinations, About, Login).
- [ ] 3. Verify CSS styling and fonts are correctly loaded (No FOUC or missing assets).

## Phase 2: Authentication
- [ ] 1. Attempt to sign up with a new test account.
- [ ] 2. Attempt to log in with an existing account.
- [ ] 3. Verify session persists across page reloads.

## Phase 3: Primary Workflows
- [ ] 1. Create a new trip (Verify database write).
- [ ] 2. Access the trip overview page and verify the layout components load.
- [ ] 3. Generate an AI itinerary (if `GEMINI_API_KEY` is set) OR verify deterministic fallback functions.
- [ ] 4. Add a packing item and a budget expense.

## Phase 4: Security & Jobs
- [ ] 1. Attempt to access `/api/jobs/generate-itinerary` without `INTERNAL_JOB_SECRET` (Must return 401/403).
- [ ] 2. Attempt to access `/api/jobs/generate-itinerary` WITH the correct secret (Must process or return 200/202).
