# Deployment Checklist

**Selected deployment platform: Vercel**

- [ ] Complete `VERCEL-SETUP-CHECKLIST.md`.
- [ ] Connect the GitHub repository in Vercel.
- [ ] Ensure Vercel overrides are set (Next.js preset should auto-detect).
- [ ] Setup Vercel project environment variables matching `VERCEL-ENVIRONMENT-VARIABLES.md`.
- [ ] Push the latest commit to trigger a deployment.
- [ ] Run `npx prisma migrate deploy` locally to update the production database schema.
- [ ] Run `npm run db:seed` to add necessary mock destinations to the production DB.
- [ ] Perform a full smoke test (`BETA-SMOKE-TEST.md`) on the staging/preview URL.
