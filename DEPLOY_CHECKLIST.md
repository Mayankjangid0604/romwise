# Roamwise — Deploy Checklist

**Generated: 2026-09-13 (pre-flight verification pass — nothing was deployed)**

Steps are in **required execution order**. Do not reorder — several later steps fail if an earlier one is skipped.

### Legend

| Marker | Meaning |
|---|---|
| **[YOU]** | Must be done by you, outside Claude Code — creating accounts, entering payment/billing details, typing secrets into a dashboard, clicking Deploy |
| **[CLAUDE]** | I can do this locally right now, on your say-so |
| **[CLAUDE + CREDS]** | I can do this once you give me the credential — but it writes to real infrastructure, so I will ask for explicit confirmation first |

---

## Phase 0 — Fix defects found in pre-flight

These are local file edits. Do them before committing anything.

- [ ] **1. [CLAUDE]** Fix `.gitignore` — `.env.example` is currently ignored
  `.gitignore:34` is `.env*`, which also matches `.env.example`. That file is your only in-repo documentation of required env vars, and right now it can never be committed. Add `!.env.example` immediately after line 34.

- [ ] **2. [CLAUDE]** Fix the Node version in `PRODUCTION_SETUP.md`
  The guide's Prerequisites say "Node.js 18+". Next 16.3.5 declares `engines.node >= 20.9.0`. A Node 18 build fails. Should read **Node.js 20.9+**.

- [ ] **3. [YOU]** Decide the rate-limiter question (listed as unresolved in PRODUCTION_SETUP.md)
  `src/lib/rate-limit.ts` is still an in-process `Map`. On Vercel's serverless functions each instance has its own memory, so the "5 attempts / 15 min" login limit is **per instance, not global**, and resets on cold start. Two options:
  **(a)** Accept for launch — it still blunts naive brute force, or
  **(b)** Move to `@upstash/ratelimit` + Upstash Redis before launch (adds a dependency and one more env var).
  This is a judgment call about your risk tolerance, so it is yours to make. Tell me which and I will implement (b) if you want it.

---

## Phase 1 — Get the application into version control

**This is the single hardest blocker. Nothing downstream works without it.**

Right now the repo has **1 commit ("Initial commit from Create Next App") and 19 tracked files** — just the scaffold. Every file that makes this Roamwise is untracked: `src/lib/`, `src/components/`, `src/app/actions/`, `src/app/api/`, `prisma/`, and all pages. **If you connected Vercel to this repo today, you would deploy an empty Next.js starter.**

- [ ] **4. [CLAUDE]** Stage files deliberately and show you `git status` before any commit, confirming no `.env` or secret is included
- [ ] **5. [CLAUDE]** Create the commit — *I will not run this without your explicit go-ahead*
- [ ] **6. [YOU]** Create the GitHub repository (account action; choose **private** unless you intend it public)
- [ ] **7. [CLAUDE + CREDS]** Add the remote and push — *pushing publishes code to a shared remote, so I will confirm with you first*

---

## Phase 2 — Provision external services

All three require accounts, and two may ask for billing details. These are yours.

- [ ] **8. [YOU]** Create a **Neon** (or Supabase) account and project → copy the `DATABASE_URL` connection string
  Confirm it ends with `?sslmode=require`. Neon and Supabase include this by default.
- [ ] **9. [YOU]** Create a **Google AI Studio** API key → this is `GEMINI_API_KEY`
  Without it the app runs, but `/discovery` and `/group-alignment` return 503.
- [ ] **10. [CLAUDE]** Generate a strong `AUTH_SECRET`
  `openssl` is present on this machine (Git Bash, OpenSSL 3.5.4), so `openssl rand -base64 32` works. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` is a verified fallback. I can generate it and hand it to you to paste into Vercel — **do not commit it anywhere.**

---

## Phase 3 — Create the database schema

Must happen **after** Phase 2 step 8 and **before** the first real signup.

- [ ] **11. [CLAUDE + CREDS]** Run `npx prisma db push` against the production `DATABASE_URL`
  This creates all 7 tables. It writes to your real database, so I will confirm before running. You can equally run it yourself — PRODUCTION_SETUP.md §5 has the exact PowerShell form.
- [ ] **12. [CLAUDE + CREDS]** Verify the tables exist (`npx prisma db pull` or a simple query) before proceeding

---

## Phase 4 — Deploy to Vercel

- [ ] **13. [YOU]** Create the Vercel account and import the GitHub repo
- [ ] **14. [YOU]** Add all three environment variables in Vercel, scoped to **Production** (not just Preview):
  `DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`
  Entering secrets into a third-party dashboard is yours to do — I should not handle this.
- [ ] **15. [YOU]** Click **Deploy**

> **Build-time note:** the build fetches three Google Fonts (Geist, Geist Mono, Fraunces) via `next/font/google`. Vercel has network access at build time so this is fine, but a Google Fonts outage during a build will fail that build. Nothing to do now — just know the failure mode.

---

## Phase 5 — Post-deploy verification (do not skip)

**Six pages have never been exercised against a real database** — there was no Postgres available during development. They pass typecheck, tests, and build, and their handler wiring was verified, but the full click-through is genuinely untested.

- [ ] **16. [YOU]** On the deployed URL, walk through in this order:
  1. Sign up → confirm redirect to dashboard
  2. Create a trip → confirm it appears on the dashboard
  3. Generate an itinerary → confirm days and items render
  4. **Packing page** — generate list, tick a checkbox, **reload**, confirm the tick persisted *(highest-risk untested path — it is an inline server-action form, and DB persistence has never been observed end to end)*
  5. **Stay page** — select a hotel, confirm the budget page total changes, then remove it
  6. **Replanning** — mark an item delayed, review the proposal, **Accept**, confirm the DB actually changed
  7. Budget optimizer on an over-budget trip
  8. Discovery + Group Alignment (needs the Gemini key)
- [ ] **17. [CLAUDE]** Paste me any Vercel function logs or errors and I will diagnose

---

## Phase 6 — Optional / after launch

- [ ] **18. [YOU]** Custom domain in Vercel → Settings → Domains (SSL is automatic)
- [ ] **19. [YOU]** If you add a custom domain, set `AUTH_URL=https://yourdomain.com` in Vercel
- [ ] **20. [CLAUDE]** Revisit the rate limiter if you scale past one instance (see step 3)
- [ ] **21. [YOU]** Decide your local-dev database story — local Postgres, or point `.env` at the cloud DB (PRODUCTION_SETUP.md §"Local Development After Migration")

---

## Known limitations shipping with v1

Accepted, not bugs — listed so nothing is a surprise post-launch.

1. **Dashboard shows only trips you created.** `src/app/dashboard/page.tsx:12` filters on `creatorId`, not group membership. Invisible today because there is no invite flow; it will matter the moment one ships.
2. **Hotels are 10 hardcoded samples**, labelled as such by a banner on the page. No booking integration.
3. **Route coordinates are synthetic**, derived from a hash of each item's title and category. The optimizer is correct on them, but they have no relationship to real geography.
4. **Rate limiting is per-instance** (see step 3).
5. **All costs are INR only**, with no currency selection or conversion.
6. **Credentials auth only** — no OAuth, and no password reset flow. A user who forgets their password cannot recover the account without direct DB access.

---

## Pre-flight results (2026-09-13)

| Check | Result |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm test` | **169 passed / 169**, 15 files |
| `npm run build` | **Clean**, 16 routes, 0 warnings |
| Hardcoded secrets in `src/` | **None** |
| `localhost` / `127.0.0.1` / port literals in `src/` | **None** |
| `process.env` usage | 2 only — `NODE_ENV`, `GEMINI_API_KEY` |
| Absolute/local path assumptions | Only `__dirname` in test files + `vitest.config.ts` — never runs in production |
| `.env` in `.gitignore` | **Yes** (`.env*`) |
| `.env` ever committed | **No** — verified across all commits and branches |
| Prisma provider | `postgresql` — correct |
| New dependencies from the UI redesign | **None** |
