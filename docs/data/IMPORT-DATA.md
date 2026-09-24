# Data Import Policy

## Raw Data Caching

The `scripts/import/india-import/import-destinations.ts` script dynamically downloads the GeoNames `cities500.txt` raw file during its execution.
This file and its zip archive (`cities500.zip`) are downloaded to `data-import/raw/`.

These files are **local caches** only and must **never** be committed to source control. They are ignored in `.gitignore`.

If the `data-import` directory is empty or deleted, it will be automatically recreated and the required data fetched on demand when the importer scripts are run.

## Reproducibility
- **Source**: `https://download.geonames.org/export/dump/cities500.zip`
- **Location**: `data-import/raw/`

Do not store static copies of 40MB/50MB+ datasets inside the repository tree.
