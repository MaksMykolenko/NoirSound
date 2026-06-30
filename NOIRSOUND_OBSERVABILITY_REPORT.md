# NoirSound — Observability Report

Date: 2026-06-28  
Status: PASS for beta baseline

## What was inspected

Request logging, request IDs, security headers, liveness/readiness, dependency checks, worker logs, failure persistence, health-check integration, and operational log access.

## What was implemented

- `x-request-id` acceptance/response and structured Fastify request logging.
- `/api/health` liveness.
- `/api/ready` checks PostgreSQL, Redis, and object storage; returns 503 on failure.
- Production Docker health uses readiness.
- Worker startup fails fast if FFmpeg or FFprobe is unavailable.
- Worker stage/failure logs and persisted user-safe processing errors.

## What was tested

Smoke tests asserted request IDs, headers, health, and not-ready behavior. Local and production compose readiness returned 200 with `database`, `redis`, and `storage` all `ok`. Worker processed valid media and rejected corrupt bytes.

## Exact commands run

```bash
cd backend
npm run test:unit
curl -i http://127.0.0.1:3000/api/ready

cd ..
docker compose -f docker-compose.production.yml --env-file .env.production ps
docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=100
curl -fsS http://localhost/api/ready
```

## What could not be tested here

No external metrics backend, paging/alert delivery, log aggregation, tracing, or Sentry project was configured.

## Exact blockers

None for a controlled public beta.

## Remaining risks

Operators must actively watch logs until external error tracking, latency/error-rate metrics, disk/queue alerts, and on-call notification are configured.

## Files changed

`backend/src/index.js`; `backend/src/config.js`; `backend/src/services/storage.js`; `backend/src/workers/audioProcessor.js`; `docker-compose.production.yml`; `.env.production.example`; `backend/tests/publicBeta.smoke.test.js`.
