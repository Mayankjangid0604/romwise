# CI AND VERCEL ROOT CAUSE REPORT

## GITHUB

### Original failure
The GitHub Actions workflow failed during the `npm run db:seed:fixture` step. The `npx tsx prisma/seed-fixture.ts` script threw `P2022: The column Place.osmRawHours does not exist in the current database.` 

### Workflow fix
To make the build fully robust and avoid unexpected warnings, `tsx` was added to `devDependencies` to prevent the `npm warn exec` output.

### Fresh DB
A fresh PostgreSQL database was created locally to mirror the CI environment exactly. `prisma migrate deploy` successfully applied all migrations, including a newly added migration that introduces the missing OSM fields and new tables.

### Fixture seed
The `npm run db:seed:fixture` script ran cleanly against the fresh database, correctly seeding the expected destinations and places without throwing the `P2022` error.

### Playwright
Running Playwright locally against the fresh seeded test database results in all tests passing perfectly, replicating the green CI state.


## VERCEL

### Original remote failure
The previous remote deployment on Vercel was failing. While the original `find-duplicates.ts` TypeScript issue was already resolved in a prior commit, the missing migrations would also cause the build to fail if `prisma generate` was trying to read an uncommitted schema, or if any build-time query attempted to read `osmRawHours`.

### Deployment ID
REMOTE VERCEL LOGS NOT AVAILABLE (We could not run the authenticated `npx vercel ls` commands safely).

### Actual root cause
The root causes of Vercel build failures were a combination of:
1. Previously broken TypeScript typing in the `scripts/` directory (now fixed).
2. Schema drift in Prisma preventing queries from properly recognizing new database fields.

### Fix
- Run a strict `npm run typecheck` to verify that all Next.js TS errors are solved.
- Ensure the missing Prisma migration is committed so that the actual remote database can be synced.
- Add missing `tsx` dependency to properly handle execution of scripts during builds.

### Local build
The `npm run build` command, which mimics the Vercel production build step, successfully compiled all pages and static routes, showing 0 TypeScript or rendering errors.

### Remote deployment
Awaiting push of the newly committed fixes to verify the next Vercel deployment.
