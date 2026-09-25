# Roamwise V3.2 Final Deployment Sequence

This document describes the correct, safe process for deploying the V3.2 update to staging and production environments.

## 1. Pre-Flight Backup
Before connecting to any production database, ensure a full backup/snapshot is taken.

## 2. Apply Migrations Safely
Connect directly to the database and run:
`npx prisma migrate status`

If there are pending migrations, deploy them safely:
`npx prisma migrate deploy`

Verify success:
`npx prisma migrate status`

**NEVER RUN** `npx prisma migrate reset` or `npx prisma db push` on staging or production.

## 3. Data Initialization (Staging Only)
Only on disposable staging environments or a completely fresh database, you may run:
`npm run db:seed`

**NEVER RUN** `db:seed:fixture` in production. 

## 4. Vercel Deployment Truth
Vercel is configured to build the application and automatically runs `prisma generate` during `postinstall`.
Vercel **does not** automatically run `prisma migrate deploy` on production unless a custom build step is defined. Migrations should be run manually or via a secure CI pipeline prior to application deployment to ensure safety and prevent race conditions.
