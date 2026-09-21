# Roamwise Deployment Checklist

Before exposing Roamwise to beta users, ensure the following infrastructure and configuration checks are complete.

## 1. Infrastructure & Environment
- [ ] **Database Connection**: `DATABASE_URL` is set to the production database (e.g., Neon/Supabase).
- [ ] **Database Backups**: Automated daily/continuous backups are enabled in the database provider's dashboard. Restore procedure is tested and documented.
- [ ] **Trusted App URL**: `NEXT_PUBLIC_APP_URL` (or `AUTH_URL` / `NEXTAUTH_URL`) is explicitly set to the exact production domain (e.g., `https://app.roamwise.com`).
- [ ] **Security Secret**: `AUTH_SECRET` is set to a secure, cryptographically random 32-byte string.
- [ ] **HTTPS / TLS**: The deployment platform (e.g., Vercel) enforces HTTPS for all connections. Secure cookies are enabled by default via NextAuth on HTTPS.

## 2. External Providers
- [ ] **AI (Gemini)**: `GEMINI_API_KEY` is set to a production key. Usage limits and billing alerts are configured in Google AI Studio / Google Cloud.
- [ ] **SMS / Auth (Twilio)**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` are configured. (Or if disabled for Beta, fallback auth methods are tested).
- [ ] **Weather**: If a live provider is not integrated, ensure weather is clearly labeled as "Demo/Estimated" or disabled in the UI.
- [ ] **Maps / Routing**: Confirm Leaflet/OSM configurations do not violate usage limits or are replaced with production map tiles (e.g., Mapbox) if traffic is high.
- [ ] **Images**: Unverified/demo placeholder images are removed or replaced with explicitly licensed / API-sourced images (e.g., Unsplash).

## 3. PDF Generation Runtime
- [ ] **Playwright Dependencies**: Ensure the deployment environment supports `playwright-core` and `@sparticuz/chromium`. (On Vercel, this requires specific memory limits and function sizing, usually `memory: 1024` or higher for the PDF route).
- [ ] **Timeout Config**: Ensure the serverless function timeout for the PDF route is increased (default 10s is often too short for Chromium spin-up).

## 4. Database Setup
- [ ] **Migrations**: Run `npx prisma migrate deploy` against the production database to ensure the schema is up to date.
- [ ] **Seed Data**: Run `npm run db:seed` (and any required master data imports like `db:seed:districts`) against production to populate reference data.
- [ ] **Admin Bootstrap**: Create the first admin user manually via the database or a secure bootstrap script. Do NOT use default seeded E2E users.

## 5. Security & Privacy
- [ ] **E2E Flags Disabled**: Verify that `E2E_TEST_MODE` and `E2E_AI_MOCK` are NOT set in the production environment.
- [ ] **CORS**: Ensure private APIs do not expose permissive CORS headers.
- [ ] **Security Headers**: Basic Next.js security headers (e.g., frame-ancestors) are configured in `next.config.ts` or edge middleware.

## 6. Verification & Observability
- [ ] **Smoke Test**: `BETA-SMOKE-TEST.md` has been successfully executed in the production (or identical staging) environment.
- [ ] **Error Monitoring**: A monitoring solution (e.g., Sentry, Datadog, or Vercel Logs) is attached to capture unhandled exceptions and client-side crashes.
- [ ] **AI Usage Logs**: Review `AIUsage` table to ensure tokens are being tracked correctly.
- [ ] **Rollback Plan**: Verify that a previous deployment can be quickly restored if a critical regression is discovered (and verify DB migration backward compatibility).
