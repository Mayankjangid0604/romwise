# Roamwise Beta Deployment Handoff

## Current Status
Code RC: PASS
Limited Beta: NOT READY

## Remaining Actions
- [ ] Choose a deployment platform (Vercel, Render, ECS, etc.) based on `DEPLOYMENT-REQUIREMENTS.md`.
- [ ] Provision a production PostgreSQL database.
- [ ] Configure automated database backups on the provider.
- [ ] Register production API keys (Gemini, Twilio if using phone auth).
- [ ] Set up an error monitoring tool (Sentry, Datadog) for the production environment.
- [ ] Verify image licenses mapped in `MEDIA-LICENSE-REVIEW.md` and remove/replace invalid ones.
- [ ] Deploy to a staging environment and execute `BETA-SMOKE-TEST.md`.

## Required Environment
Provide these exact variables to the deployment environment (see `.env.staging.example`):
- `APP_URL`
- `AUTH_SECRET`
- `DATABASE_URL`
- `GEMINI_API_KEY`
- `TWILIO_ACCOUNT_SID` (Optional, omit if disabling phone auth)
- `TWILIO_AUTH_TOKEN` (Optional)
- `TWILIO_PHONE_NUMBER` (Optional)
- `INTERNAL_JOB_SECRET` (Optional)

## Database
1. Run migrations safely: `npx prisma migrate deploy`
2. Seed the required destination data: `npm run db:seed`
*(Do not run `prisma migrate dev` or `db:seed` indiscriminately if they overwrite existing data. The seed script uses `upsert` and is safe to run repeatedly).*
3. **Admin Bootstrap:** You must manually inject the first admin user's role via the database console, as no API endpoint exists to bootstrap the first admin.

## Providers
- **Gemini**: Required. Enforced by application routes.
- **SMS (Twilio)**: Optional. If omitted, phone authentication will gracefully fail.
- **Weather**: Currently mocked in UI. Needs a live provider implementation before real usage.
- **Images**: Hotlinking from Unsplash. Pending license approval.
- **PDF**: Relies on `@sparticuz/chromium`. Ensure Lambda/Node environment has 1024MB+ RAM and extended timeouts.

## Staging
Perform manual testing using the exact checklist in `BETA-SMOKE-TEST.md`.

## Go / No-Go
To change the status from **NOT READY** to **READY FOR LIMITED BETA**, the above "Remaining Actions" must be completed and all checkboxes in `DEPLOYMENT-CHECKLIST.md` must be checked.
