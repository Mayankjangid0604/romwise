# V3.2 Deployment Instructions

This document provides the exact sequence of commands for deploying the V3.2 release safely to production.

## Explicit Prohibitions in Production
- **NO** `prisma db push`
- **NO** `prisma migrate reset`
- **NO** `npm run db:seed:fixture`
- **NO** `E2E_TEST_MODE=true`
- **NO** `E2E_AI_MOCK=true`
- **NO** `OTP_TEST_BYPASS=true`

## 1. Exact Release SHA Verification
Ensure you are deploying the certified release SHA (replace with exact SHA if known, e.g. `1836efe` or `b5b176f`).

## 2. Database Backup & Restore Point
Before applying any migration to production, ensure you have taken a full backup (e.g., via Neon dashboard branch/snapshot).

## 3. Environment Configuration
Verify your Vercel or production hosting environment variables:
- `DATABASE_URL` is set.
- `AUTH_SECRET` is generated (`openssl rand -base64 32`) and set.
- `APP_URL` is set to the absolute domain of your production app.
- `INTERNAL_JOB_SECRET` is set.
- All testing bypasses (`E2E_TEST_MODE`, `OTP_TEST_BYPASS`, `E2E_AI_MOCK`) are REMOVED.

## 4. Database Migration
Use the pooled or unpooled connection string as appropriate for migrations based on your database provider. For Neon, standard connections support transactions but a direct URL might be required for some DDL, though `DATABASE_URL` is configured in `prisma/schema.prisma`.

```bash
# 1. Configure direct migration DB URL (if necessary for your provider)
export DATABASE_URL="postgresql://user:password@host/db"

# 2. Check pending migrations
npx prisma migrate status

# 3. Safely deploy migrations
npx prisma migrate deploy

# 4. Verify completion
npx prisma migrate status
```

*Note: The V3.1/V3.2 migration `20260925080000_add_trip_place_selection` is purely additive and safe.*

## 5. Vercel Deployment
Deploy the exact verified SHA to Vercel. Verify the final SHA on the Vercel dashboard.

## 6. Smoke Testing
Execute the steps in `docs/deployment/PRODUCTION-SMOKE-TEST.md` to ensure system integrity.

## 7. Rollback Procedure
If the application fails:
1. Revert to the previous deployment via the Vercel Dashboard.
2. The recent migrations are additive, so rolling back the application code without restoring the database is safe. The old code simply will not query the new tables/columns.
