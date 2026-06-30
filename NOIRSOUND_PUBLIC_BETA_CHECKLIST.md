# NoirSound — Public Beta Checklist

Date: 2026-06-28  
Verdict: PUBLIC BETA READY

## What was inspected and implemented

All checklist controls below were both inspected and implemented where they were absent.

## What was implemented

- [x] Production secrets/config fail closed.
- [x] Hashed, revocable server-side sessions.
- [x] Logout and logout-all revoke sessions.
- [x] Suspended/banned/deleted-status users rejected.
- [x] Same-origin CSRF enforcement.
- [x] Redis-backed auth/upload/comment/report/play/profile limits.
- [x] Magic-byte plus declared-type validation.
- [x] FFprobe/FFmpeg kill timeouts and duration cap.
- [x] Private storage and browser-reachable signed URLs.
- [x] Hidden/inactive content excluded from public APIs and streams.
- [x] Admin moderation, audit logs, reports UI.
- [x] Terms, privacy, guidelines, copyright, DMCA, abuse, creator rules.
- [x] No mock fallback/fake API data in normal mode.
- [x] Production Docker/Caddy/worker/migrations/readiness.
- [x] PostgreSQL and object-storage backup/restore drill.
- [x] CI workflow.

## What was tested

- [x] Frontend build, 73 tests, clean lint, audit 0.
- [x] Backend 58 PostgreSQL tests, 28 DB-free tests, audit 0.
- [x] Prisma generate/validate/status.
- [x] Playwright 57 passed; 5 optional unseeded visual cases skipped.
- [x] Upload→worker→stream and corrupt-file rejection.
- [x] Report/hide/audit and suspend/session-revoke flows.
- [x] Production compose build/up/readiness/log smoke.
- [x] Restore drill: DB rows and 28/28 objects.

## Exact commands run

```bash
npm run build
npm run test
npm run lint
npm run test:e2e
(cd backend && npm run test && npm run test:unit)
(cd backend && npx prisma generate && npx prisma validate && npx prisma migrate status)
docker compose -f docker-compose.production.yml --env-file .env.production build
docker compose -f docker-compose.production.yml --env-file .env.production up -d
scripts/restore-drill.sh
```

## What could not be tested here

- [ ] Real DNS/ACME certificate issuance.
- [ ] External alert delivery.
- [ ] Real support/copyright inbox delivery.

## Exact blockers

None.

## Remaining risks

The unchecked items are deployment/operator checks, not unresolved code blockers.

## Files changed

All public-beta security, frontend, E2E, ops, deployment, CI, and reporting files enumerated in `NOIRSOUND_PUBLIC_BETA_FINAL_REPORT.md`.
