# Roamwise Beta Deployment Handoff

## Current Code Status
CODE RC: PASS
VERCEL STAGING: READY TO DEPLOY
LIMITED BETA: NOT YET (pending staging verification)

## GitHub/Vercel Source Status
Local HEAD: 92e8b95
Upstream: origin/main
Ahead/Behind: 0
Uncommitted: None
Latest code on GitHub: Yes, the latest deployment-preparation changes are pushed.

## Vercel Environment Status
The environment variables have been audited. See `VERCEL-ENVIRONMENT-VARIABLES.md` for the canonical list of required values.

## Variables to Remove (from Production)
- `OTP_TEST_BYPASS` (Temporarily allowed by code logic for manual testing, but should be removed from the environment eventually)
- `E2E_TEST_MODE`
- `E2E_AI_MOCK`

## Variables to Add/Keep
- `DATABASE_URL`
- `AUTH_SECRET`
- `APP_URL`
- `GEMINI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `INTERNAL_JOB_SECRET`

## Preview vs Production Separation
Production and Preview should not share secrets. Preview should ideally have a separate `DATABASE_URL` (sandbox database), separate `AUTH_SECRET`, and possibly a restricted `GEMINI_API_KEY`.

## Database Deployment
Run `npx prisma migrate deploy` locally to upgrade the Vercel PostgreSQL database schema (do not do this automatically in the Vercel build step).

## Twilio Verification
Twilio configured — runtime verification required. Needs manual test of the OTP flow on Vercel.

## Gemini Verification
Requires smoke test on Vercel to ensure AI planner completes.

## PDF Runtime Verification
Requires runtime verification on Vercel to ensure headless Chromium doesn't exceed Lambda function constraints.

## Weather Decision
Weather is currently mocked on the UI for missing data points. A live provider is needed for real usage; this is a deployment blocker if real weather is expected for the beta.

## Media License Decision
Unsplash images lack verified commercial licenses. These are beta blockers.

## Exact Next Vercel Actions
See `VERCEL-SETUP-CHECKLIST.md`.

## Go / No-Go Conditions
To change from **LIMITED BETA: NOT YET** to **READY**, the smoke tests in `BETA-SMOKE-TEST.md` must pass against the deployed Vercel application.
