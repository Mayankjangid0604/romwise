# MIGRATION HISTORY RECOVERY

## Missing migration 1: 20260920164330_add_round_trip_waypoints
Recovered: NO
Source commit: Missing from Git history (schema applied in b6e4025d7ee35474e6b8a53aad544542244ba3cb)
Exact original SQL restored: NO

## Missing migration 2: 20260920184239_add_financial_fields_to_trip_accommodation
Recovered: NO
Source commit: Missing from Git history (schema applied in b6e4025d7ee35474e6b8a53aad544542244ba3cb)
Exact original SQL restored: NO

## Missing migration 3: 20260920184354_drop_stay_selection
Recovered: NO
Source commit: Missing from Git history (schema applied in b6e4025d7ee35474e6b8a53aad544542244ba3cb)
Exact original SQL restored: NO

## Production schema comparison:
Trip.waypoints: YES
Trip.isRoundTrip: YES
TripAccommodation.costPerNightInr: YES
StaySelection table: NO
AiResponseCache table: NO
TripAccommodation.selectionRef: NO
TripPlaceSelection table: YES
Trip.unscheduledPlaces: YES

## Production migration status:
Drift detected. DB contains old missing migrations, local repo contains unapplied Sept 26 migrations.

## Clean DB:
Migration count: BLOCKED (No local PostgreSQL database available)
Fixture seed: BLOCKED

## PDF:
Implementation: Verified - uses playwright-core and @sparticuz/chromium securely.
Tests: PASSED - Fixed `any` types with `Mock` and removed `eslint-disable`.

## Collaboration:
Root cause: Verified - test assertion was stale, product behavior is correct.
Tests: BLOCKED - Playwright tests require local DB.

## Typecheck:
PASSED

## Lint:
PASSED

## Vitest:
Files: 62
Tests: 644
Passed: 644
Failed: 0
Skipped: 0

## Playwright:
Total: BLOCKED
Passed: BLOCKED
Failed: BLOCKED
Skipped: BLOCKED
Retries: BLOCKED

## Build:
PASSED

## Production modified:
NO
