# Roamwise Production Deployment Checklist

## Pre-Deployment

- [ ] Confirm the final Git commit hash matches the certified release
- [ ] Confirm GitHub Actions CI is **GREEN** for the final commit
- [ ] **Back up the production database** (pg_dump or Neon snapshot)
- [ ] Verify all required environment variables are set in Vercel:
  - `DATABASE_URL` — Production PostgreSQL connection string
  - `AUTH_SECRET` — Minimum 32 characters, randomly generated
  - `APP_URL` — Full production URL (e.g., `https://roamwise.vercel.app`)
  - `GEMINI_API_KEY` — Optional, only needed for Copilot features
  - `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — Optional, for SMS OTP
  - `PLANNER_ENGINE` — Omit or set to `v2` (default). Only `v1` requires Gemini.
- [ ] Verify test-only variables are **NOT** set:
  - `E2E_TEST_MODE` must NOT be `true`
  - `E2E_AI_MOCK` must NOT be `true`
  - `OTP_TEST_BYPASS` must NOT be `true`

## Database Migration

```bash
# From a secure environment with DATABASE_URL pointing to production:
npx prisma migrate deploy
```

- [ ] Verify migration output shows all migrations applied successfully
- [ ] Run `npx prisma migrate status` — must show "Database schema is up to date!"

## Data Initialization (First Deploy Only)

```bash
# Only run on first deployment or empty database:
npm run db:seed          # Core seed data (destinations, etc.)
npm run db:seed:districts # District/geography data

# NEVER re-run on populated databases — not idempotent
```

## Deploy

- [ ] Push the certified commit to `main` (or trigger Vercel deploy)
- [ ] Monitor Vercel build logs for successful completion
- [ ] Verify Vercel deployment status reaches **READY**

## Post-Deployment Smoke Test

### Authentication
- [ ] Sign in via email
- [ ] Protected routes redirect unauthenticated users
- [ ] Sign out clears session

### Discovery
- [ ] Discovery page loads with destinations
- [ ] Search returns relevant results
- [ ] Destination detail page renders correctly

### Trip Creation & Planning
- [ ] Create a new trip with dates
- [ ] Place Browser loads for the destination
- [ ] Build Itinerary generates successfully (no Gemini required)
- [ ] Itinerary displays with time slots and activities

### Itinerary Editing
- [ ] Drag-and-drop reorder works
- [ ] Add/remove items works
- [ ] Edit item details works

### Stay
- [ ] Stay page loads with accommodation options
- [ ] Selection persists

### Budget & Expenses
- [ ] Budget overview displays correctly
- [ ] Add/edit/delete expenses works
- [ ] Settlement calculations are correct

### Collaboration
- [ ] Share link generates
- [ ] Joining via share link works
- [ ] Comments and votes work
- [ ] Viewer cannot mutate

### Exports
- [ ] ICS download works
- [ ] PDF generation works (if Chromium available)

### Offline / PWA
- [ ] Offline page loads when disconnected
- [ ] Service worker registers

### Admin
- [ ] Admin accessible only by admin users
- [ ] Normal users get 404

## Monitoring

- [ ] Check Vercel function logs for any errors in the first 15 minutes
- [ ] Verify no 500 errors on key routes

## Rollback Plan

### Application Rollback
Revert to previous Vercel deployment via Vercel dashboard, or:
```bash
git revert HEAD
git push origin main
```

### Database Rollback
If the migration caused data loss (unlikely with forward-only additive migrations):
1. Restore from pre-deployment backup
2. Deploy the previous application version

> **Note**: The V3.1 migration (`20260925080000_add_trip_place_selection`) is purely additive (new table + new nullable column). Rolling back the application without rolling back the database is safe — the old code simply won't use the new table/column.
