# Required API Keys

MAP API KEY YOU NEED RIGHT NOW: NONE

This document outlines the API keys required to run Roamwise in different environments.

## Required for Production

| Service | Purpose | Environment variable | Required? | Server/client | Current implementation | Fallback | What breaks if absent | How to obtain key |
|---|---|---|---|---|---|---|---|---|
| **Database** | Core data storage | `DATABASE_URL` | **Yes** | Server | PostgreSQL via Prisma | None | Everything | Provide your own PostgreSQL (e.g. Supabase, Neon) |
| **Auth Secret** | NextAuth session encryption | `AUTH_SECRET` | **Yes** | Server | NextAuth | None | Authentication | `openssl rand -base64 32` |
| **APP_URL** | Base URL for absolute links (e.g. share links) | `NEXT_PUBLIC_APP_URL` | **Yes** | Client/Server | Next.js environment | `http://localhost:3000` locally | Links/Sharing in production | The domain you deployed to |
| **Internal Job Secret** | Secures internal background API routes | `CRON_SECRET` | **Yes** | Server | `authorization: Bearer` check | None | Background Generation | `openssl rand -base64 32` |

## Optional Enhancements

| Service | Purpose | Environment variable | Required? | Server/client | Current implementation | Fallback | What breaks if absent | How to obtain key |
|---|---|---|---|---|---|---|---|---|
| **Gemini (Google)** | V1 AI Trip Planner | `GEMINI_API_KEY` | No | Server | AI Generation if PLANNER_ENGINE=v1 | V2 deterministic planner | Semantic AI capabilities | [Google AI Studio](https://aistudio.google.com/) |
| **Twilio** | SMS OTP Authentication | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | No | Server | Twilio SDK | Mock OTP | SMS Delivery | [Twilio Console](https://console.twilio.com/) |
| **MapTiler** | Map tiles | `NEXT_PUBLIC_MAPTILER_API_KEY` | No | Client | `TileLayer` in map | OpenStreetMap directly | Better map visuals | [MapTiler Cloud](https://cloud.maptiler.com/) |

## Test-Only Variables

| Service | Purpose | Environment variable | Required? | Server/client | Current implementation | Fallback | What breaks if absent | How to obtain key |
|---|---|---|---|---|---|---|---|---|
| **Mock OTP** | Bypass Twilio costs | `OTP_TEST_BYPASS` | No | Server | Static code `123456` | Twilio | N/A | Set to `"true"` |
| **E2E Mode** | Disable animations/AI for Playwright | `E2E_TEST_MODE`, `E2E_AI_MOCK` | No | Server/Client | Feature flags | Standard mode | Deterministic E2E | Set to `"true"` |

## Not Currently Used

| Service | Purpose | Environment variable | Required? | Server/client | Current implementation | Fallback | What breaks if absent | How to obtain key |
|---|---|---|---|---|---|---|---|---|
| **Routing (Google/Mapbox)** | Live traffic routing | None | No | N/A | Not Used | Approximate Haversine/Straight-line Routing | N/A | N/A |
| **PDF** | PDF Export generation | None | No | N/A | Not Used | Client-side printing | N/A | N/A |
| **Weather** | Live weather forecasts | None | No | N/A | Not Used | Static/Historical data | N/A | N/A |
