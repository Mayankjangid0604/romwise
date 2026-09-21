# Beta Smoke Test Checklist

**Selected deployment platform: Vercel**

This smoke test must be executed against the staging/preview URL or production Vercel environment before enabling the Limited Beta.

### 1. Database & Seeding
- [ ] Ensure the DB was migrated (`npx prisma migrate deploy`).
- [ ] Ensure the DB was seeded with supported mock destinations.
- [ ] Verify you can see "Araku Valley", "Tokyo", or "Paris" depending on your seed data in the UI (e.g. Discovery page).

### 2. Authentication
- [ ] Go to `/login`.
- [ ] Enter a phone number.
- [ ] Wait for SMS (or bypass if testing).
- [ ] Enter OTP and verify successful login and session creation.

### 3. Gemini Planner (Trip Brain)
- [ ] Go to `/discovery` or the dashboard to plan a new trip.
- [ ] Use AI to generate an itinerary for a destination available in the database (e.g. "Araku Valley").
- [ ] Verify the AI completes successfully and does not hang or error out (requires `GEMINI_API_KEY` working).

### 4. PDF Generation (Vercel Serverless Check)
- [ ] Open any existing trip.
- [ ] Click the "Print/Download PDF" action.
- [ ] Ensure the Vercel function does not time out (504 Gateway Timeout) and does not run out of memory. If it fails, this is a Vercel-specific constraint that needs fixing (e.g., upgrading to Pro or modifying `maxDuration`).

### 5. PWA & Offline
- [ ] Verify the `manifest.json` is served properly.
- [ ] Verify the service worker registers successfully on HTTPS.
- [ ] Save a trip for offline access.
- [ ] Verify that going offline and reloading the page still displays the trip.
