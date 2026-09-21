# Deployment Requirements

**Selected deployment platform: Vercel**

## 1. Application Runtime
- **Environment**: Next.js App Router on Vercel.
- **Compute**: The PDF generation route relies on `@sparticuz/chromium`. This may require Vercel Pro depending on the memory allocation (ideally 1024MB+) and execution limits, though it might work on Hobby for small pages. Requires runtime testing on Vercel.

## 2. Database
- **Engine**: PostgreSQL.
- **Topology**: Vercel Postgres or an external provider like Neon/Supabase.
- **Backups**: The provider must support automated backups.

## 3. Security & Networking
- **TLS**: Automatically handled by Vercel.
- **Environment Variables**: Use Vercel's Environment Variables dashboard to inject secrets safely (see `VERCEL-SETUP-CHECKLIST.md`).

## 4. Background Jobs (Optional)
- Vercel Cron Jobs can be used to hit the `/api/jobs/generate-itinerary` endpoint securely using the `INTERNAL_JOB_SECRET`.
