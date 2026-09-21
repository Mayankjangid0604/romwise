# VERCEL ENVIRONMENT VARIABLES

This document establishes the exact environment variable contract required by the current Roamwise codebase when deploying to Vercel.

| Variable | Required? | Server/Client | Local Dev | Vercel Preview | Vercel Production | Secret? | Purpose |
| -------- | --------- | ------------- | --------- | -------------- | ----------------- | ------- | ------- |
| `DATABASE_URL` | Required | Server Only | `postgresql://...` | preview DB | production DB | Yes | PostgreSQL connection string for Prisma. |
| `AUTH_SECRET` | Required | Server Only | random string | preview secret | production secret | Yes | NextAuth JWT signing/encryption key. |
| `APP_URL` | Required | Server Only | `http://localhost:3000` | preview URL | production URL | No | Canonical origin for PDF generation and share links. |
| `NEXT_PUBLIC_APP_URL` | Optional | Client/Server | `http://localhost:3000` | preview URL | production URL | No | Fallback base URL for client-side absolute URLs. |
| `GEMINI_API_KEY` | Optional* | Server Only | Dev key | Restricted preview key | Production key | Yes | Powers Trip Brain features. App falls back to determinism if absent. |
| `TWILIO_ACCOUNT_SID` | Optional | Server Only | `""` | Staging credentials | Production credentials | Yes | Used for SMS OTP sending. If absent, SMS features fail gracefully. |
| `TWILIO_AUTH_TOKEN` | Optional | Server Only | `""` | Staging credentials | Production credentials | Yes | Used for SMS OTP sending. |
| `TWILIO_PHONE_NUMBER` | Optional | Server Only | `""` | Staging number | Production number | No | Sender phone number for SMS OTP. |
| `INTERNAL_JOB_SECRET` | Optional | Server Only | Dev secret | Preview secret | Production secret | Yes | Authenticates background cron jobs like `/api/jobs/generate-itinerary`. |
| `OTP_TEST_BYPASS` | Remove | Server Only | `true` or absent | Absent | Absent | No | Enables fixed `000000` OTP code. MUST NOT BE USED in production. |
| `E2E_TEST_MODE` | Remove | Server Only | `true` or absent | Absent | Absent | No | Disables real auth/emails for automated tests. MUST BE ABSENT in production. |
| `E2E_AI_MOCK` | Remove | Server Only | `true` or absent | Absent | Absent | No | Returns static mock AI payloads. MUST BE ABSENT in production. |

### Note on Test Flags
The `next.config.ts` explicitly prevents production builds if `E2E_TEST_MODE` or `E2E_AI_MOCK` is active to prevent test modes leaking into the real product. `OTP_TEST_BYPASS` was temporarily allowed for manual beta verification but should be removed from all production deployments.

---

# Recommended Vercel Assignment

| Variable            | Development        | Preview                        | Production             |
| ------------------- | ------------------ | ------------------------------ | ---------------------- |
| `DATABASE_URL`      | local/dev DB       | staging DB                     | production DB          |
| `AUTH_SECRET`       | dev secret         | preview secret                 | production secret      |
| `APP_URL`           | `http://localhost:3000` | staging URL                    | production URL         |
| `GEMINI_API_KEY`    | dev key            | restricted preview key         | production key         |
| `TWILIO_*`          | `""`               | staging credentials if testing | production credentials |
| `INTERNAL_JOB_SECRET` | dev secret       | preview secret                 | production secret      |
| `OTP_TEST_BYPASS`   | `true` or absent   | absent                         | absent                 |
| `E2E_TEST_MODE`     | `true` for tests   | absent                         | absent                 |
| `E2E_AI_MOCK`       | `true` for tests   | absent                         | absent                 |

**Important for Preview Environments**: Avoid assigning production secrets (like the Production `DATABASE_URL` or Production `TWILIO_*` keys) to Preview deployments unless strictly necessary and safe. Preview should have a separate sandboxed database.
