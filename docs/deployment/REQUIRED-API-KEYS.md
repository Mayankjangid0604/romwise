# Required API Keys

MAP API KEY YOU NEED RIGHT NOW: NONE
GEMINI REQUIRED FOR CORE PLANNER: NO
TWILIO REQUIRED: NO
WEATHER API REQUIRED: NO
ROUTING API REQUIRED: NO
PDF EXTERNAL API REQUIRED: NO

This document outlines the API keys required to run Roamwise in different environments.

## Required for Production

| Variable | Purpose | Required? | Server/Client | Fallback | Failure behavior |
|---|---|---|---|---|---|
| **DATABASE_URL** | Core data storage | **Yes** | Server | None | Application fails to start |
| **AUTH_SECRET** | NextAuth session encryption | **Yes** | Server | None | Authentication fails |
| **APP_URL** | Base URL for absolute links | **Yes** | Server | None in Prod (`localhost:3000` locally) | Share links and PDF generation fails |
| **INTERNAL_JOB_SECRET** | Secures internal background routes | **Yes** | Server | None | Background Generation fails |

## Optional Production Enhancements

| Variable | Purpose | Required? | Server/Client | Fallback | Failure behavior |
|---|---|---|---|---|---|
| **GEMINI_API_KEY** | AI generation and Copilot | No | Server | Deterministic V2 Planner | Semantic AI features disable silently |
| **TWILIO_ACCOUNT_SID**<br>**TWILIO_AUTH_TOKEN**<br>**TWILIO_PHONE_NUMBER** | SMS OTP Authentication | No | Server | None in Prod (mock only if `OTP_TEST_BYPASS`) | SMS delivery fails gracefully. OTP must never be logged/exposed in production. |
| **NEXT_PUBLIC_MAPTILER_API_KEY** | Map tiles | No | Client | Free OpenStreetMap/Carto tiles | Retains default carto tiles |

### Note on Authentication without Twilio
Twilio is required for production PHONE OTP. Email/password authentication works without Twilio. Without Twilio: phone OTP request fails gracefully, and OTP codes are safely discarded without being logged or exposed in production. Do not call Twilio universally optional without this qualification.

## Test Only — NEVER Production

| Variable | Purpose | Required? | Server/Client | Fallback | Failure behavior |
|---|---|---|---|---|---|
| **E2E_TEST_MODE** | Disable animations for Playwright | No | Server/Client | Normal UI | Next.js blocks prod startup if set |
| **E2E_AI_MOCK** | Mock AI responses | No | Server | Live AI API | Next.js blocks prod startup if set |
| **OTP_TEST_BYPASS** | Fixed OTP code "000000" | No | Server | Live Twilio API | Next.js blocks prod startup if set |

## Not Currently Used

| Variable | Purpose | Required? | Server/Client | Fallback | Failure behavior |
|---|---|---|---|---|---|
| **DATABASE_URL_UNPOOLED** | Direct DB connection | No | Server | `DATABASE_URL` | N/A |
| **CRON_SECRET** | Vercel Cron Securing | No | Server | N/A | N/A |
| **Routing API** | Live traffic routing | No | N/A | Approximate Haversine routing | N/A |
| **Weather API** | Live weather | No | N/A | Static historical data | N/A |

## PDF Implementation Documentation
The application does not use an external PDF generation API or client-side printing for its export feature. PDF generation is implemented securely server-side using `/api/trips/[id]/pdf` with `playwright-core` and `@sparticuz/chromium`. External API keys are not required for PDF exports.
