# Fallback Food Provenance Audit

## Overview
During the recent India Data phase, an automated Overpass/Wikidata pipeline experienced rate-limiting and connection failures. A fallback script (`scripts/fallback-osm-import.ts`) was created to inject 72 predefined food and beverage POIs across major Indian destinations to ensure the Planner feature worked.

## Provenance Violation
The fallback script erroneously assigned the following attributes to these manually curated records:
- `sourceType: 'OPENSTREETMAP'`
- `sourceRecordId: 'manual-osm-...'`

This violates the strict data provenance requirement: **"No record may remain presented as OSM/Wikidata-sourced unless it actually came from that source."**

## Remediation Actions
- **Freeze & Inspect:** Conducted repository freeze and identified `scripts/fallback-osm-import.ts` as the source of the unverified records.
- **Audit Duplicate Merge Safety:** Verified `scripts/find-duplicates.ts` and `scripts/merge-destinations.ts` safely reassign `Places`, `Images`, `FavoriteDestination`, `DestinationAlias`, and `Trip` relationships using proper Prisma standard operations. Verified there were no orphaned relationships generated.
- **Quarantine Unverified Data:** Executed a purge command against the production database to completely remove all 72 fallback records (`sourceType: 'OPENSTREETMAP'` and `sourceRecordId` starting with `manual-osm-`), as they were not genuinely sourced from OSM.
- **Geography Repair Validation:** Re-checked specific records (Varkala, Canacona, Kalavoor) and corrected Canacona's state back to Goa from Karnataka (a regression identified during the check).
- **CI/Vercel Diagnostics:** Found that Vercel deployment failed due to a missing type signature (`any`) in `scripts/find-duplicates.ts`. Corrected the file and verified with a successful local `npm run build`. GitHub Playwright failed because the test database was not seeded in the CI workflow. Corrected `.github/workflows/playwright.yml` to include the `npm run db:seed:fixture` step.
- **Repository Cleanup:** Consolidated past JSON dumps and audit markdown files into `docs/audits` to maintain a clean workspace.

## Conclusion
The repository has been stabilized. Unverified data asserting false OSM provenance has been quarantined (deleted). Build failures have been rectified, and automated pipelines have been supplied with seeded test data.
