# Roamwise Deployment Requirements

This document outlines the infrastructure capabilities required to host Roamwise in production. It does not dictate a specific provider, but serves as a decision record framework for choosing one.

## 1. Application Runtime
- **Environment**: Node.js (v18+) running a Next.js App Router application.
- **Compute**: Requires enough memory (usually 1024MB+) and execution timeout (at least 15–30 seconds) to support `@sparticuz/chromium` for the headless PDF generation route.

## 2. Database
- **Engine**: PostgreSQL.
- **Topology**: Persistent or serverless shared database accessible via connection string.
- **Backups**: The provider must support automated backups and point-in-time recovery.

## 3. Security & Networking
- **TLS**: HTTPS must be enforced at the edge/load balancer.
- **Environment Variables**: The platform must support securely injecting secrets (e.g., `DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`) without exposing them to the client bundle.

## 4. Background Jobs (Optional)
- **Scheduling**: If automated trip state transitions (e.g., moving to "Live" status automatically) are required, the platform must support cron jobs or external triggers hitting an internal API authenticated via `INTERNAL_JOB_SECRET`.

## 5. Deployment Options Comparison

### A. Vercel-compatible Deployment
- **Pros**: Zero-config Next.js optimizations (Image optimization, edge caching). Built-in preview environments.
- **Cons**: PDF generation requires specific Function memory/timeout configuration (`vercel.json`) which increases costs. NextAuth requires explicit `AUTH_URL` configuration depending on the exact deployment setup.

### B. Traditional Node Host (e.g., Render, Railway)
- **Pros**: Persistent server environment means Chromium can stay resident (warm starts), making PDF generation faster.
- **Cons**: Requires manual Dockerization or build step configuration. Lacks Vercel's out-of-the-box global edge caching for Next.js static assets.

### C. Docker / Container Host (e.g., AWS ECS, Google Cloud Run)
- **Pros**: Maximum control over the Chromium environment and OS-level dependencies.
- **Cons**: Highest operational overhead. Requires writing and maintaining a `Dockerfile` compatible with Next.js standalone output and Playwright binaries.

*Decision pending user selection.*
