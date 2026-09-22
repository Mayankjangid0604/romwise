# Roamwise

AI-powered group travel planner with smart itineraries, budget tracking, and real-time collaboration.

## Local Development Setup

### 1. Copy env file and fill in your values

```bash
cp .env.example .env.local
```

Edit `.env.local` and set at minimum:

| Variable | How to get it |
|---|---|
| `DATABASE_URL` | A PostgreSQL connection string, e.g. from [Neon](https://neon.tech) or a local Postgres instance |
| `AUTH_SECRET` | Run `openssl rand -base64 32` and paste the output |
| `APP_URL` | `http://localhost:3000` for local dev |
| `GEMINI_API_KEY` | Get one from [Google AI Studio](https://aistudio.google.com/app/apikey) |

Optional (needed for SMS OTP login):

| Variable | How to get it |
|---|---|
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | [Twilio Console](https://console.twilio.com) |
| `TWILIO_PHONE_NUMBER` | A Twilio phone number with SMS capability |

### 2. Set up the database

```bash
# Apply migrations
npx prisma migrate deploy

# (Optional) Seed with sample data
npm run db:seed
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Vercel / Production Deployment

Set these environment variables in your Vercel project dashboard (**Settings → Environment Variables**):

- `DATABASE_URL` — your production Postgres URL
- `AUTH_SECRET` — a strong random secret (`openssl rand -base64 32`)
- `APP_URL` — your production domain, e.g. `https://roamwise.vercel.app`
- `NEXT_PUBLIC_APP_URL` — same as `APP_URL`
- `GEMINI_API_KEY` — your Gemini API key
- `INTERNAL_JOB_SECRET` — any random string for securing cron job endpoints
- `TWILIO_*` — if you use phone OTP login

**Never set** `E2E_TEST_MODE`, `E2E_AI_MOCK`, or `OTP_TEST_BYPASS` to `true` in production — the app will refuse to start if any of those are enabled.

After deploying, run migrations:

```bash
DATABASE_URL="<your-prod-url>" npx prisma migrate deploy
```

---

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run db:seed      # Seed database
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth v5
- **AI**: Google Gemini
- **UI**: Tailwind CSS v4, Framer Motion, dnd-kit
- **Maps**: Leaflet / React-Leaflet
- **Offline**: IndexedDB via `idb`
- **PDF**: Playwright (headless Chromium)
- **Tests**: Vitest + Playwright
