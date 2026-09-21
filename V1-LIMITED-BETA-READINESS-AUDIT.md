# V1 Limited Beta Readiness Audit

## 1. Executive Decision
NOT READY FOR LIMITED BETA

*Reasoning: While the codebase passes all integration and unit tests, deployment requires a production database backend, trusted environment URLs, actual image licensing confirmation, live SMS provider resolution, and dedicated monitoring, none of which can be guaranteed purely by source code. Offline IndexedDB cleanup and UI physical pointer regressions have been mitigated in code, but production-level infrastructure remains a blocker.*

## 2. Code Release Candidate
The source code itself is structurally sound and passes all gates.
- Prisma Validation: PASS
- Prisma Migrations: UP TO DATE
- Lint: PASS
- Typecheck: PASS
- Vitest: 428 / 428 PASS
- Playwright: 45 / 45 PASS
- Build: PASS

## 3. Deployment Platform
Unknown / Next.js Node Environment. (No Vercel-specific config or Dockerfile is present, though standard Next.js build implies Vercel or Node server).

## 4. Environment Contract
Variables in use across codebase:
| Variable | Required? | Server/Client | Development | Test | Production | Purpose |
| -------- | --------- | ------------- | ----------- | ---- | ---------- | ------- |
| `DATABASE_URL` | Yes | Server | Local DB | Local DB | Prod DB URL | PostgreSQL connection |
| `AUTH_SECRET` | Yes | Server | Any string | Fixed | 32-byte secret | NextAuth encryption |
| `NEXT_PUBLIC_APP_URL` | Optional | Client/Server | Localhost | Localhost | Prod Domain | Base URL for APIs/Auth/PDF/Links |
| `GEMINI_API_KEY` | Yes | Server | API Key | Mocked | API Key | AI generation |
| `TWILIO_ACCOUNT_SID` | Optional | Server | Mocked | Mocked | Prod SID | SMS OTP |
| `TWILIO_AUTH_TOKEN` | Optional | Server | Mocked | Mocked | Prod Token | SMS OTP |
| `TWILIO_PHONE_NUMBER` | Optional | Server | Mocked | Mocked | Prod Number | SMS OTP |
| `INTERNAL_JOB_SECRET` | Optional | Server | Any string | Fixed | Secret String | Cron authentication |
| `E2E_TEST_MODE` | No | Server | false | true | false | Enables E2E backdoors |
| `E2E_AI_MOCK` | No | Server | false | true | false | Skips actual Gemini calls |

## 5. Authentication
NextAuth is fully implemented. E2E bypass paths (`/api/auth/callback/e2e-test`) are present but have been defensively blocked from starting in `NODE_ENV === "production"`. 

## 6. OTP / SMS
Actual Provider: Twilio (via `src/lib/otp.ts`), but falls back to logging the OTP if Twilio env vars are missing or if `OTP_TEST_BYPASS` is true.
Launch Decision: **Policy B** (Require real SMS provider before beta, or disable phone sign-in). Silent logging of OTPs is unacceptable for real user security.

## 7. Authorization Matrix
| Capability | Creator | Member | Viewer | Outsider |
| --- | --- | --- | --- | --- |
| View trip | Yes | Yes | Yes | No |
| Export PDF | Yes | Yes | Yes | No |
| Export ICS | Yes | Yes | Yes | No |
| Vote | Yes | Yes | No | No |
| Comment | Yes | Yes | No | No |
| Preferences | Yes | Yes | No | No |
| Expense create | Yes | Yes | No | No |
| Reorder | Yes | Yes | No | No |
| Edit stay | Yes | Yes | No | No |
| Edit transit | Yes | Yes | No | No |
| Generate itinerary | Yes | Yes | No | No |
| Create share | Yes | Yes | No | No |
| Remove member | Yes | No* | No | No |

*\*Members can leave, but only creators can remove others.*

## 8. Viewer Privacy
- **Itinerary:** Visible
- **Comments:** Visible
- **Members:** Visible
- **Accessibility:** Invisible (Server filters it)
- **Budget:** Invisible (Server rejects API calls)
- **Expenses:** Invisible (Server rejects API calls)

## 9. AI
- Provider: Google Gemini (`@google/genai`)
- Limits: Dependent on the API key tier. Application enforces basic DB rate limiting per user/IP.
- Fallback: Gracefully degrades to deterministic basic generation if API fails or times out.
- Cost Controls: Hardcoded model router (`gemini-3.6-flash`).

## 10. Weather
Actual Production Policy: **Option A**. The UI currently mocks weather if the API fails, which is not suitable as a real forecast. It must either be connected to a live provider or disabled.

## 11. Routing
Actual Production Policy: Labeled explicitly as estimated/straight-line where applicable. Safe to launch.

## 12. Media
License Review Status: Curated images are hotlinked from Unsplash. While Unsplash is free to use, direct hotlinking violates some TOS without attribution, and hardcoded `src` tags lack verifiable licensing.
Status: Needs manual review.

## 13. PDF
Deployment/Runtime Status: The `api/trips/[id]/pdf` route relies on `@sparticuz/chromium` and `playwright-core`. This requires a heavy Node.js lambda environment (e.g., 1024MB RAM, extended timeouts). It is NOT guaranteed to work in a standard edge function or a low-tier serverless environment without explicit configuration.

## 14. PWA
HTTPS / offline / logout privacy status:
- Service Worker registration is active.
- Offline IndexedDB and `localStorage` are cleared defensively on `SignOut` to prevent cross-account session contamination.
- Requires HTTPS context for Service Workers to function in production.

## 15. Database
- Migrations: 14 migrations deployed. Schema is completely up to date.
- Seed: `npm run db:seed` required for Destinations.
- Admin Bootstrap: Requires manual DB insertion for the first admin user.
- Backups: Unknown (Infrastructure dependent).

## 16. Security Headers
Status: Missing strict Content-Security-Policy. (Next.js defaults apply, but no custom CSP is enforced). 

## 17. Rate Limiting
Status: Handled via DB `RateLimitEntry`.

## 18. Error Handling
Status: Safe generic error messages returned to clients. Re-audited `console.error` and `error.message` usage; sensitive Prisma/DB errors are stripped.

## 19. Observability
Status: Missing. Standard `console.log` exists, but no Sentry or Datadog integration is present.

## 20. Performance
Findings: Good baseline. `React.memo` and optimistic UI updates are utilized for drag-and-drop. Database queries heavily rely on Prisma `include`, which could become an N+1 bottleneck on very large itineraries, but is acceptable for beta.

## 21. Privacy/Data Flow
Technical Summary:
- Authentication identity (email/phone) is stored in the DB.
- User Accessibility Notes are filtered before sending trip states to AI or viewers.
- Offline states persist locally in IndexedDB but are wiped on sign-out.

## 22. Automated Verification
- Prisma: Valid, Migrations Up To Date.
- Lint: Passed.
- Typecheck: Passed.
- Vitest: 428 Passed.
- Playwright: 45 Passed.
- Build: Passed.

## 23. Critical Repeat Tests
- Templates: Passed (3/3 repeats)
- Collaboration: Passed (3/3 repeats)
- Money: Passed (3/3 repeats)
- Pointer Create: Fixed physical `TemplateCard` z-index intersection. Button is clickable.
- Offline Logout: Added test ensuring IndexedDB clears on sign-out. Passed.
- Viewer Financial Privacy: API explicitly blocks viewer roles from expense operations.

## 24. Manual Staging Requirements
See `BETA-SMOKE-TEST.md`.

## 25. Deployment Checklist Status
See `DEPLOYMENT-CHECKLIST.md`.

## 26. Beta Blockers
- Real SMS / Auth Provider must be configured (or phone auth disabled).
- Weather provider must be integrated or UI disabled.
- Trusted Origin environment variables (`NEXT_PUBLIC_APP_URL`) must be set.
- PDF Serverless environment sizing (RAM/Timeout) must be proven.

## 27. Production Blockers
- Sentry / Error Monitoring.
- Formal Privacy Policy / TOS for AI processing.
- Automated Database Backups.

## 28. External Requirements
- Backups, monitoring, HTTPS, staging environment, and external API credentials cannot be proven by this repository's code.

## 29. Canonical Feature Matrix
Status: Reference `FEATURE-STATUS.md` at repository root for the canonical list of the 20 features and their deployment readiness. All 20 features are substantially complete or complete, aside from minor deployment gaps.

## 30. Canonical Deployment Gates

### CODE GATES
- Prisma: PASS
- Migrations: PASS
- Lint: PASS
- Typecheck: PASS
- Vitest: PASS
- Playwright: PASS
- Build: PASS

### DEPLOYMENT GATES
- trusted `APP_URL` configured for server contexts
- production DB (Neon/Supabase) integrated
- PDF runtime capable of headless Chromium
- HTTPS enforcement
- Weather policy (hide if mock, or use live API)

### EXTERNAL GATES
- backups configured on DB provider
- monitoring (Sentry/Datadog) configured
- staging deployment validated via smoke test
- image license approval completed

## 31. Recommendation
**NOT READY FOR LIMITED BETA**

READY FOR GENERAL PRODUCTION: NO

*(Requires infrastructure provisioning, credential injection, and staging verification first).*
