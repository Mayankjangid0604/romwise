# PRISMA CLIENT CI RECOVERY

## GitHub Failure Cause
GitHub build failed with TypeScript errors pointing to missing relations and fields (`groupMembers`, `tripPlaceSelections`, `unscheduledPlaces`, etc.) in the Prisma client. The root cause was that `package.json` had a custom `postinstall` script (`"postinstall": "prisma skills sync || exit 0"`) that overrode the default `prisma generate` behavior triggered during `npm ci`. Thus, CI typechecking and building occurred against a stale or non-existent Prisma Client that lacked the newly added V3.1 schemas.

## Committed Schema & Migration
- **TripPlaceSelection**: Exists as a model.
- **Trip.tripPlaceSelections**: Relation exists.
- **Place.tripPlaceSelections**: Relation exists.
- **Trip.unscheduledPlaces**: Exists (`Json?`).
- **Trip.groupMembers**: Exists.
- **Migration**: `20260925080000_add_trip_place_selection` successfully includes these schema updates.

## Generated Client State
Prior to the fix, the generated client was absent or stale in clean CI runs. `typecheck` implicitly swallowed some errors or threw them directly on the fields that were accessed on missing types.

## Package Install Behavior
- **Before**: `npm ci` ran `prisma skills sync || exit 0`, skipping client generation.
- **After**: Modified `postinstall` script in `package.json` to `"postinstall": "prisma generate"`. Now `npm ci` successfully generates the client matching the committed schema.

## Clean Reproduction
1. Deleted generated local artifacts (`rm -rf .next node_modules/.prisma node_modules/@prisma/client tsconfig.tsbuildinfo`).
2. Ran `npm ci`.
3. Observed `prisma generate` succeeding.
4. Ran `npm run typecheck` which completed cleanly with 0 errors.
5. Ran `npm run build` which succeeded.

## Vercel Risk
Vercel would have failed in the exact same manner as GitHub, because it also performs `npm ci` or equivalent dependency installations. It relies on `postinstall` to generate the client. By fixing the `postinstall` script, Vercel deployments will also naturally succeed.

## Verification
- **Prisma validate**: Passed.
- **Lint**: 0 errors.
- **Typecheck**: 0 errors.
- **Vitest**: 470/470 passed.
- **Playwright**: 114/114 passed.
- **Build**: Successfully generated static pages and compiled production build.

## Final Decision
- **CI FIXED**: Yes.
- **VERCEL BUILD FIXED**: Yes.
- **CODE RC**: Stable and type-safe.
- **READY TO DEPLOY**: Yes.
