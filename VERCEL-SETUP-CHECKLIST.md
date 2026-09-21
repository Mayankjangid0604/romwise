# Vercel Setup Checklist

Follow these exact steps in the Vercel dashboard to configure the Roamwise deployment.

### 1. Remove Unwanted Test Variables from Production
If the following variables exist in your Vercel project settings, uncheck the "Production" environment for them (or delete them entirely if not needed for automated testing previews):
- [ ] `OTP_TEST_BYPASS`
- [ ] `E2E_TEST_MODE`
- [ ] `E2E_AI_MOCK`

### 2. Configure Production-Only / Production-Specific Variables
Ensure the following variables are assigned to the "Production" environment in Vercel with their real production values:
- [ ] `DATABASE_URL` (Production PostgreSQL connection string)
- [ ] `AUTH_SECRET` (A secure random 32-character string)
- [ ] `APP_URL` (Your exact production URL, e.g., `https://roamwise.com`)
- [ ] `GEMINI_API_KEY` (Your real production Gemini API Key)
- [ ] `TWILIO_ACCOUNT_SID` (Your real production Twilio SID)
- [ ] `TWILIO_AUTH_TOKEN` (Your real production Twilio Token)
- [ ] `TWILIO_PHONE_NUMBER` (Your real production Twilio Number)
- [ ] `INTERNAL_JOB_SECRET` (Your secure internal cron job secret)

### 3. Configure Preview Assignments
For the "Preview" environments, ensure you use **separate, non-production values** where applicable:
- [ ] Use a staging `DATABASE_URL` so preview builds don't mutate production data.
- [ ] Use a separate `AUTH_SECRET`.
- [ ] Avoid assigning production `TWILIO_*` or `GEMINI_API_KEY` to preview environments unless required for staging.

### 4. Database Setup
Do **not** run `prisma migrate deploy` automatically on every Vercel preview build against your production database!
- [ ] Run `npx prisma migrate deploy` locally or via a secure CI/CD step pointed specifically at the production `DATABASE_URL`.
- [ ] Run the initial seed script `npm run db:seed` against the production database to populate the required mock destinations.

### 5. Redeploy
- [ ] After setting the environment variables, trigger a fresh redeployment of the latest GitHub `main` commit in Vercel.

### 6. Runtime Smoke Tests
Once deployed, verify the following manually on the live URL:
- [ ] **Login/OTP**: Attempt to sign up/in using a phone number.
- [ ] **Database**: Verify destinations and trips load successfully.
- [ ] **Gemini Planner**: Run the Trip Brain and verify the AI creates a valid itinerary.
- [ ] **PDF**: Click the "Download PDF" button on a trip to ensure the Vercel Serverless Function correctly spawns `@sparticuz/chromium` (Note: This may require Vercel Pro depending on memory/timeout limits).
- [ ] **PWA**: Verify the manifest and service worker register correctly via HTTPS.
