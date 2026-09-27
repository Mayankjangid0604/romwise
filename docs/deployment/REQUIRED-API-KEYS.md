# ROAMWISE V3.2 — REQUIRED API KEYS AND ENVIRONMENT VARIABLES

## Authoritative Truth from Source Code

| Variable | Requirement | Purpose | Verified Source Reference |
|----------|-------------|---------|---------------------------|
| `DATABASE_URL` | **REQUIRED** | PostgreSQL Connection String | `prisma/schema.prisma` |
| `AUTH_SECRET` | **REQUIRED** | NextAuth JWT/Session Encryption | `src/auth.config.ts` |
| `APP_URL` | **REQUIRED** | Base Application URL for Auth/Links | `src/lib/constants.ts` |
| `INTERNAL_JOB_SECRET` | **REQUIRED** | Internal CRON/Background Job Security | `src/app/api/jobs/generate-itinerary/route.ts` |
| `GEMINI_API_KEY` | Optional | AI Itinerary Generation (Falls back to deterministic) | `src/lib/destination-brain/index.ts` |
| `TWILIO_ACCOUNT_SID` | Optional | SMS Notifications | `src/lib/sms.ts` |
| `NEXT_PUBLIC_MAPTILER_API_KEY`| Optional | Advanced Map Visualizations | `src/components/Map.tsx` |

> **Note on Jobs:** `CRON_SECRET` is NOT used by the internal job routes in this deployment. The correct variable is `INTERNAL_JOB_SECRET`.

> **Note on Twilio:** The Twilio token/key is `TWILIO_AUTH_TOKEN`.
