# NoirSound — Public Beta Baseline Audit (Phase 1)

Date: 2026-06-28
Scope: state of the repository **before** the Public Beta Finalization Sprint changes.
Method: direct source inspection of `backend/`, `src/`, `shared/`, `prisma/`, `tests/`, Docker config, env files.

Legend: `PASS` = production-acceptable · `PARTIAL` = present but incomplete · `MISSING` = absent · `BLOCKER` = must fix before public beta.

## Stack
- Frontend: Vite 8 + React 19, React Router 7, TanStack Query, Zustand, i18next (en/uk/pl/ru), Tailwind 4.
- Backend: Fastify 5, Prisma 7 (pg adapter), argon2, jsonwebtoken, @fastify/cookie/cors/rate-limit/redis/sensible, BullMQ + ioredis, AWS SDK v3 S3 + presigner, fluent-ffmpeg, fastify-multer.
- Worker: `backend/src/workers/audioProcessor.js` (BullMQ consumer, ffmpeg/ffprobe).
- Infra (dev): docker-compose with Postgres 15, Redis 7, MinIO + nginx storage-proxy.

## Findings

| # | Area | Status | Evidence / Notes |
|---|------|--------|------------------|
| 1 | Auth / session security | **PARTIAL** | JWT in HttpOnly cookie; `Secure` in prod; `SameSite=Lax`; per-request DB user lookup + `status==='ACTIVE'` gate (so suspended/banned/deleted are rejected on next request). BUT sessions are **not server-side revocable**: logout only `clearCookie`; the `Session` model exists but is unused; no "logout all". A stolen 7-day JWT stays valid after logout. |
| 2 | CSRF | **MISSING / BLOCKER** | No CSRF token and no Origin/Referer validation on mutating cookie-auth routes. CORS allows a single credentialed origin but that does not stop CSRF for simple/`fetch` POSTs. |
| 3 | Rate limiting | **PARTIAL** | `@fastify/rate-limit` registered (`global:false`). login 5/15m, register 10/h, upload init 10/h, complete 20/h. **Unlimited**: comments, replies, reports, play-events, profile update. Store is in-memory (not Redis) → ineffective across instances. 429 body standardized (PASS). |
| 4 | Upload validation | **PARTIAL** | Strong: filename sanitize + path-traversal strip, MIME allowlist (audio+cover), size caps (50MB/5MB), tags/title/description length caps, `copyrightConfirmed===true` required, normalized genre keys, ownership check on complete, idempotent claim via `updateMany`, S3 HEAD metadata verify (size+content-type). Gap: **no magic-byte/file-signature check** — declared content-type is client-set at presign, so byte-level type is only validated later by the worker's ffprobe. |
| 5 | FFmpeg / worker safety | **PARTIAL / BLOCKER** | ffprobe duration validation rejects non-audio/corrupt; temp dir cleanup in `finally`; no shell injection (fluent-ffmpeg + controlled temp paths, not user filenames); error messages redact temp paths; BullMQ attempts=3, removeOnFail=false; failure state persisted + visible. Gap: **no ffprobe/ffmpeg timeout and no max-duration cap** → a crafted/huge file can hang or OOM the worker (DoS). |
| 6 | MinIO / S3 access | **PASS** | All objects private; delivered via expiring signed GET; presigned PUT TTL 900s; bucket `anonymous set none`. Notes: single bucket with `uploads/` vs `processed/` prefix separation (no dedicated quarantine bucket); signed GET default TTL 3600s (could be shorter for stream). |
| 7 | Streaming endpoint | **PARTIAL** | Streams only `status==='PUBLISHED'` with `processedAudioKey` (blocks draft/processing/failed/rejected/hidden) and 302-redirects to a signed URL; Range handled by S3. Gap: **does not check the artist's user status** — a suspended/banned artist's already-PUBLISHED tracks keep streaming. Same for cover endpoint. |
| 8 | Moderation / admin tools | **MISSING / BLOCKER** | No admin routes, no audit-log model, no hide/unhide/suspend endpoints, no admin UI. Schema foundation exists but unused: `UserStatus.SUSPENDED/BANNED`, `TrackStatus.HIDDEN`, `Report`, `ModerationDecision`. |
| 9 | Reports / abuse flow | **PARTIAL** | `POST /api/reports` validates targetType/reason, dedupes OPEN reports, caps details length. Gaps: no rate limit; **no user-facing report UI**; no admin review path. |
| 10 | Copyright / legal pages | **MISSING / BLOCKER** | No Terms / Privacy / Guidelines / Copyright / DMCA / Abuse / Creator-rules pages or routes. Upload does enforce a `copyrightConfirmed` boolean server-side (PASS for that one control). |
| 11 | Backups / restore | **MISSING / BLOCKER** | No backup or restore scripts for Postgres or object storage anywhere in the repo. |
| 12 | Logging / monitoring | **PARTIAL** | Fastify pino logger on (off in test); worker logs stages to console with redacted errors. Gaps: no request-id surfacing, no `/api/ready`, no DB/Redis/storage/ffmpeg health probes, no metrics, no Sentry hook. `/api/health` is a static OK. |
| 13 | Docker / deployment | **PARTIAL / BLOCKER** | Dev compose good (pg/redis/minio + nginx proxy, private bucket). Backend Dockerfile good (node22-alpine + ffmpeg, non-root `node`, dumb-init, prod prune, `prisma generate`). Gaps: **no production compose**, **no Caddy/Nginx HTTPS + secure-headers config**, no frontend Dockerfile, no explicit prod worker service. |
| 14 | CI / tests | **PARTIAL / BLOCKER** | Frontend: vitest component/i18n tests + Playwright design/smoke specs. Backend: integration test (needs Postgres) + unit tests. Gaps: **no CI workflow** (`.github/` absent); **no full-stack upload→stream E2E**; no secret-scan/lint gate. |
| 15 | Frontend real-mode surfaces | **PASS** | Real API is the default; mock is gated behind `VITE_USE_MOCK_API` (off) with a visible "Demo mode" badge only when on; no silent mock fallback in `src/api/index.js`. API errors surface via a real toast event. |
| 16 | Mobile / design / theming / i18n | **PASS (re-verify)** | Extensive prior passes: i18n en/uk/pl/ru, theme system, mobile fixes, home & track-page redesigns, genre taxonomy/UI. To be re-verified by build + tests in this sprint. |
| 17 | Full-stack E2E | **MISSING / BLOCKER** | No test exercises register→upload→worker→PUBLISHED→stream→play-event end to end. |
| 18 | Env / secret hardening | **PARTIAL / BLOCKER** | Auth plugin requires `JWT_SECRET`/`COOKIE_SECRET` presence only. No secret-strength check, no `NODE_ENV=production` enforcement, no startup validation of `DATABASE_URL`/`REDIS_URL`/S3 creds. `backend/.env` is gitignored but holds weak dev secrets (local only). Root `.gitignore` does not list `.env` explicitly. |

## Environment constraints for this sprint (honest)
This sprint runs in a sandbox with **Node 22 + ffmpeg/ffprobe available**, but **no Docker, Postgres, Redis, or MinIO**. Consequences:
- Runnable here: `npm run build`, frontend `vitest`, `oxlint`, isolated backend unit tests (pure functions, no DB), `npm audit`.
- NOT runnable here (must run locally/CI with infra): backend integration tests (`backend npm test` — needs Postgres), full-stack Playwright E2E, `docker compose build/up`, and the storage/DB restore drill.

## Baseline blockers (carried into the sprint)
1. CSRF protection absent.
2. Sessions not revocable (logout/logout-all).
3. Worker ffmpeg/ffprobe timeouts + max-duration missing.
4. No moderation/admin tooling.
5. No legal/copyright pages.
6. No backups/restore + no restore drill.
7. No production deployment config (HTTPS reverse proxy, prod compose).
8. No CI gate.
9. No full-stack upload E2E.
10. No startup secret/config validation.

## Final verification addendum

This document remains the historical pre-sprint baseline. The environment later gained a working Docker daemon and all listed blockers were closed.

- **What was inspected:** the baseline stack, routes, schemas, storage, deployment, tests, and operational controls listed above.
- **What was implemented:** see the phase reports and `NOIRSOUND_PUBLIC_BETA_FINAL_REPORT.md`.
- **What was tested:** frontend, PostgreSQL backend, full-stack E2E, production compose, and restore drill all passed.
- **What could not be tested:** real DNS/ACME, external alerts, and real support/legal inbox delivery.
- **Exact commands:** `npm run build`; `npm run test`; `npm run lint`; `npm run test:e2e`; `(cd backend && npm run test && npm run test:unit)`; `docker compose -f docker-compose.production.yml --env-file .env.production build`; `scripts/restore-drill.sh`.
- **Exact blockers:** none at final verification.
- **Remaining risks:** lawyer review, off-host encrypted backups, external monitoring, and single-host availability.
- **Files changed:** `backend/src/`; `backend/prisma/`; `src/`; `tests/e2e/`; `scripts/`; `.github/workflows/`; Docker/Caddy/env artifacts; public-beta reports.
