# ROAMWISE V3.2 — DEPLOYMENT AND MIGRATION INSTRUCTIONS

## 1. Prerequisites
- Node.js 18.x or 20.x
- PostgreSQL 15+ database
- Verified environment variables (see `REQUIRED-API-KEYS.md`)

## 2. Remote Synchronization
The application MUST be deployed from `origin/main`.
```bash
git checkout main
git pull origin main
```
Exact SHA verified for V3.2 production: (Verified from origin/main)

## 3. Dependency Installation
Strict lockfile installation is required to ensure consistent dependencies.
```bash
# Do NOT use npm install
npm ci
```

## 4. Database Migration
Ensure the database schema is up-to-date.
```bash
npx prisma migrate deploy
npx prisma generate
```

## 5. Build
Produce the optimized production build.
```bash
npm run build
```

## 6. Start
Start the Next.js production server.
```bash
npm start
```
