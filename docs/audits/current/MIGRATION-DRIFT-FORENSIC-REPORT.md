# Migration Drift Forensic Report

## 1. Local PostgreSQL Availability
- **PostgreSQL 15.15 (Homebrew)** installed at `/opt/homebrew/opt/postgresql@15/bin`
- Server running since 7 Sep 2026
- Local database `roamwise_migration_recovery` created successfully

## 2. Production Migration Metadata (READ-ONLY)
21 migrations recorded in production `_prisma_migrations`. Key entries:

### The 3 missing migrations (previously absent from repo):
| Migration | Checksum | Applied | Steps |
|---|---|---|---|
| `20260920164330_add_round_trip_waypoints` | `dd8b93e2df8c4df71ab562a0c9aaf886e689c5baa9ff0fe8e30ecffbc8f2453a` | 2026-09-20 16:43:31 | 1 |
| `20260920184239_add_financial_fields_to_trip_accommodation` | `8f0735ecb38af0dc2076eab4e9a0a5ecc04caf8ed98c26e6ef4c268c0477e1fb` | 2026-09-20 18:42:40 | 1 |
| `20260920184354_drop_stay_selection` | `8fcb206849ee36e58caa71156f79da3bfae78d67a47205ae182c629cca9608f9` | 2026-09-20 18:43:55 | 1 |

### Critical discovery — checksum matches:
| Old migration (in prod) | Later migration (in repo) | Checksum match? |
|---|---|---|
| `20260920164330_add_round_trip_waypoints` | `20260922074700_add_trip_routing_fields` | ✅ **IDENTICAL** |
| `20260920184239_add_financial_fields_to_trip_accommodation` | `20260922080000_add_accommodation_cost_fields` | ✅ **IDENTICAL** |

The later repo migrations were marked `applied_steps_count: 0` — they were resolved via `prisma migrate resolve --applied`, not actually executed.

## 3. Historical Migration Recovery Search
Searched: `git log --all`, `git reflog --all`, `git fsck --lost-found`, `git stash show -p`, `find .. -type d`, filesystem grep, dangling blobs.

**Result:** Migration SQL files were never committed. The schema changes entered via commit `b6e4025d` which modified `prisma/schema.prisma` directly. The migrations were generated locally, applied to production via `prisma migrate deploy`, but their directories were excluded from the commit (likely `.gitignore` or accidental omission).

## 4. Exact Schema Changes Per Migration

### Migration 1: `add_round_trip_waypoints`
```sql
ALTER TABLE "Trip" ADD COLUMN "isRoundTrip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "returnDestination" TEXT,
ADD COLUMN "travelerComposition" TEXT,
ADD COLUMN "waypoints" TEXT;
```
**Confidence:** CERTAIN — identical SQL/checksum as `add_trip_routing_fields`

### Migration 2: `add_financial_fields_to_trip_accommodation`
```sql
ALTER TABLE "TripAccommodation" ADD COLUMN "costPerNightInr" INTEGER,
ADD COLUMN "nights" INTEGER,
ADD COLUMN "totalCostInr" INTEGER;
```
**Confidence:** CERTAIN — identical SQL/checksum as `add_accommodation_cost_fields`

### Migration 3: `drop_stay_selection`
```sql
ALTER TABLE "StaySelection" DROP CONSTRAINT "StaySelection_tripId_fkey";
DROP TABLE "StaySelection";
```
**Confidence:** HIGH — reconstructed from schema diff (StaySelection removed between parent and b6e4025d)

## 5. Production Schema State (READ-ONLY)
| Object | Expected | Production | Consistent |
|---|---|---|---|
| Trip.waypoints | YES | YES | ✅ |
| Trip.isRoundTrip | YES | YES | ✅ |
| Trip.returnDestination | YES | YES | ✅ |
| Trip.travelerComposition | YES | YES | ✅ |
| TripAccommodation.costPerNightInr | YES | YES | ✅ |
| TripAccommodation.totalCostInr | YES | YES | ✅ |
| TripAccommodation.nights | YES | YES | ✅ |
| StaySelection table | ABSENT | ABSENT | ✅ |
| AiResponseCache table | YES | NO (pending) | Expected |
| TripAccommodation.selectionRef | YES | NO (pending) | Expected |

## 6. Fresh Repository DB State
- 23 migrations apply cleanly from zero
- Fixture seed succeeds (3 destinations, 24 places)
- `prisma migrate status`: "Database schema is up to date!"

## 7. Production vs Fresh DB Schema Comparison
Application schemas are **equivalent**. Fresh DB has additional tables/columns from the 2 pending migrations (AiResponseCache, selectionRef) which are expected.

## 8. Migration Checksum Implications
- Migrations 1 & 2: Restored with **exact original SQL** (verified by checksum match)
- Migration 3: Reconstructed SQL — checksum will differ from production record. However, Prisma only checks checksums for migrations it applies; since this migration is already applied in production, the checksum mismatch does not block `prisma migrate deploy` for newer migrations.
- The later duplicate migrations were made idempotent (`ADD COLUMN IF NOT EXISTS`) so they work both from-zero AND against production.

## 9. Safe Reconciliation — RECOMMENDED APPROACH
**No production changes needed for the old migrations.** The restored migration files + idempotent later migrations mean:
1. Fresh DB: Migrates cleanly from zero ✅
2. Production: `prisma migrate status` shows only 2 genuinely pending migrations ✅
3. Production deploy: Will apply only `add_ai_response_cache` and `add_trip_accommodation_selection_ref` ✅

## 10. Reconciliation Options Evaluated

| Option | Data Risk | History Risk | Fresh DB | Prod Compatible | Recommended |
|---|---|---|---|---|---|
| A. Recover exact files | None | None | ✅ | ✅ | ✅ **CHOSEN** |
| B. Baseline migration | Low | Loses history | ⚠️ | ✅ | No |
| C. Reconstruct SQL | None | Checksum mismatch | ✅ | ✅ | Partial (migration 3) |
| D. `migrate resolve` | None | Masks drift | ❌ | ✅ | No |

## 11. Test Results

### Vitest
- Files: 62
- Tests: 644
- Passed: 644
- Failed: 0

### Playwright
- Total: 114
- Passed: 114
- Failed: 0
- Skipped: 0

### Build: PASSED

## 12. Collaboration
- Root cause: Stale test assertion (`"Invalid or expired invite link."` → `"Invalid invite link"`)
- All 3 browser engines: PASSED (114/114 includes cross-browser)

## 13. PDF
- Implementation: `playwright-core` + `@sparticuz/chromium` (Vercel-safe)
- Unit tests: 9/9 passed
- Security: APP_URL used (no Host header SSRF), auth check, membership check, safe fallback

## 14. Production Migration Status
```
23 migrations found in prisma/migrations
Following migrations have not yet been applied:
20260926140735_add_ai_response_cache
20260926142131_add_trip_accommodation_selection_ref
```

## 15. Next Steps (DO NOT EXECUTE YET)
1. Take Neon database backup/snapshot
2. `npx prisma migrate deploy` against production
3. `npx prisma migrate status` to confirm
4. Production smoke test

## Production Modified: NO
