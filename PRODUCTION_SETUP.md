# Roamwise — Production Setup Guide

This is a step-by-step checklist for deploying Roamwise to production. It assumes you are deploying to **Vercel** with a **Neon** (or Supabase) PostgreSQL database. If you use a different host, adapt the platform-specific steps.

---

## Prerequisites

- A GitHub account with this repo pushed to it
- A [Vercel](https://vercel.com) account (free tier works)
- A [Neon](https://neon.tech) or [Supabase](https://supabase.com) account (free tier works)
- A [Google AI Studio](https://aistudio.google.com/apikey) account for a Gemini API key
- Node.js 20.9.0+ installed locally (Next.js 16 declares `engines.node >= 20.9.0`; Node 18 will fail to build)
- `openssl` available in your terminal (comes with Git Bash on Windows)

---

## Step 1: Create the PostgreSQL Database

### Option A: Neon (recommended — simplest)

1. Go to [neon.tech](https://neon.tech) and sign up / log in
2. Click **New Project**
3. Name it `roamwise`, pick the region closest to your users, click **Create Project**
4. On the dashboard, copy the **Connection string** — it looks like:
   ```
   postgresql://neondb_owner:abc123@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Save this — you will use it as `DATABASE_URL`

### Option B: Supabase

1. Go to [supabase.com](https://supabase.com) and sign up / log in
2. Click **New Project**, name it `roamwise`, set a database password, pick a region
3. Go to **Settings → Database → Connection string** and copy the URI format
4. Replace `[YOUR-PASSWORD]` with the database password you set
5. Save this — you will use it as `DATABASE_URL`

---

## Step 2: Generate a Secure AUTH_SECRET

Run this in your terminal:

```bash
openssl rand -base64 32
```

Copy the output — a 44-character random string. This is your `AUTH_SECRET`.

**Do not** use the development placeholder (`development-secret-change-in-production`). A weak secret means anyone can forge session tokens.

---

## Step 3: Get a Gemini API Key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **Create API Key**
3. Copy the key — this is your `GEMINI_API_KEY`

The free tier has rate limits but works for moderate usage. The discovery and group alignment features need this key; the rest of the app works without it.

---

## Step 4: Deploy to Vercel

1. Push this repo to GitHub if you haven't already
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. In the **Environment Variables** section, add these three:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | The PostgreSQL connection string from Step 1 |
   | `AUTH_SECRET` | The random string from Step 2 |
   | `GEMINI_API_KEY` | The API key from Step 3 |

4. Click **Deploy**

Vercel auto-detects Next.js and runs `npm run build`. The build will succeed if all three env vars are set.

---

## Step 5: Run the Database Migration

After deploying, you need to create the database tables. Run this locally with your **production** DATABASE_URL:

```bash
DATABASE_URL="postgresql://...your-production-url..." npx prisma db push
```

On Windows (PowerShell):
```powershell
$env:DATABASE_URL = "postgresql://...your-production-url..."
npx prisma db push
```

`prisma db push` creates all tables based on the schema. You should see output like:

```
Your database is now in sync with your Prisma schema.
```

**Alternative**: If you prefer migration files for version control, use:
```bash
DATABASE_URL="postgresql://...your-production-url..." npx prisma migrate deploy
```

But you must first generate migrations locally with `npx prisma migrate dev`.

---

## Step 6: Verify the Deployment

1. Open your Vercel deployment URL
2. Sign up with a new account
3. Create a trip, generate an itinerary, check the budget page
4. Try the discovery page (requires Gemini key to be working)

If signup fails with a generic error, check:
- Is `DATABASE_URL` correct and reachable from Vercel's servers?
- Did you run `prisma db push`?
- Is `AUTH_SECRET` set (not empty)?

---

## Step 7: Set Up a Custom Domain (Optional)

1. In your Vercel project, go to **Settings → Domains**
2. Add your domain and follow the DNS instructions
3. Vercel provisions an SSL certificate automatically

After adding a custom domain, you may want to set `AUTH_URL` in Vercel's env vars:
```
AUTH_URL=https://yourdomain.com
```

NextAuth uses this to build callback URLs. If you only use the `.vercel.app` domain, this is optional.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Random secret for JWT signing (min 32 chars) |
| `GEMINI_API_KEY` | Yes* | Google Gemini API key for AI features |
| `AUTH_URL` | No | Full URL of your app (needed with custom domains) |

*The app runs without `GEMINI_API_KEY` but discovery and group alignment return 503 errors.

---

## Security Checklist

Before going live, confirm:

- [ ] `AUTH_SECRET` is a strong random value (not the dev placeholder)
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require`) — Neon and Supabase include this by default
- [ ] No `.env` file is committed to git (check with `git status`)
- [ ] `GEMINI_API_KEY` is set as an env var, never hardcoded in source
- [ ] Vercel environment variables are set for **Production** (not just Preview)

---

## Troubleshooting

**Build fails on Vercel**
- Check that `DATABASE_URL` is a valid PostgreSQL URL (starts with `postgresql://`)
- The old SQLite URL (`file:./dev.db`) will not work

**"PrismaClientInitializationError" at runtime**
- Database tables don't exist yet — run `prisma db push` with the production URL
- Or the connection string is wrong / database is unreachable

**Signup/login fails silently**
- Check `AUTH_SECRET` is set and non-empty
- Check Vercel function logs for the actual error

**Discovery page shows "Service unavailable"**
- `GEMINI_API_KEY` is not set or is invalid
- Check Google AI Studio for quota/billing issues

---

## Local Development After Migration

For local development, you have two options:

### Option A: Local PostgreSQL
Install PostgreSQL locally and update `.env`:
```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/roamwise_dev"
```
Then run `npx prisma db push` to create tables.

### Option B: Use Your Cloud Database
Use your Neon/Supabase connection string in `.env` for development too. This is simpler but means dev and prod share a database — fine for solo development, not ideal for teams.

After setting `DATABASE_URL`, run:
```bash
npx prisma db push
npx prisma generate
```
