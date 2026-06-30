# NoirSound — Rate Limiting Report (Phase 4)

Date: 2026-06-28

## Backing store
- `@fastify/rate-limit` now wired to **Redis** when `REDIS_URL`/`REDIS_HOST` is set and not in test (`buildRateLimitRedis()` in `index.js`), using an `ioredis` client with explicit startup connection, `enableOfflineQueue:false`, and an error handler.
- **Documented fallback:** when Redis is not configured (dev) or in tests, the limiter uses the in-memory store (per-instance). The client is closed on app `onClose`.
- Keying: **`backend/src/lib/rateLimitKeys.js` → `userOrIpKey`** decodes the session cookie (no verification needed) to key authenticated routes **per user**, else per **IP**.

## Limits per route
| Route | Limit | Key |
|---|---|---|
| `POST /auth/register` | 10 / hour | IP |
| `POST /auth/login` | 5 / 15 min | IP |
| `PUT /auth/me` (profile) | 30 / hour | user/IP (added) |
| `POST /uploads/track/init` | 10 / hour | IP/user |
| `POST /uploads/track/:id/complete` | 20 / hour | IP/user |
| `POST /tracks/:id/comments` | 30 / 10 min | user/IP (added) |
| `POST /comments/:id/replies` | 30 / 10 min | user/IP (added) |
| `POST /reports` | 20 / hour | user/IP (added) |
| `POST /tracks/:id/play-event` | 60 / min | user/IP (added) — prevents play-count inflation |

| Requirement | Status |
|---|---|
| login limit | PASS (per IP) |
| register limit | PASS (per IP) |
| upload init/complete limit | PASS |
| comments limit | PASS (added) |
| reports limit | PASS (added) |
| play events limited (anti-inflation) | PASS (added; plus existing 30s threshold + 3600s cap) |
| Redis-backed with documented fallback | PASS |
| 429 standardized | PASS (`{statusCode:429,error:'RATE_LIMITED',message,retryAfter}`) |

## Notes / limitations (honest)
- Login is keyed by IP, not IP+email. `@fastify/rate-limit`'s key generator runs before body parsing, so email is unavailable there; IP keying is the standard, effective approach. Per-user keying is used wherever a session cookie exists.

## Tests
- Unit verifies signed JWT user keys and rejects forged user identities.
- Production readiness verified Redis connectivity.
- Parallel E2E used a non-production-only multiplier; `NODE_ENV=production` is unit-tested to ignore it and retain the table above.

## Status: PASS

## Final verification record

- **What was inspected:** auth/register, upload, comments/replies, reports, play events, profile/settings, Redis lifecycle, keys, and 429 shape.
- **What was implemented:** upload limits now use verified user/IP keys; forged JWT claims fall back to IP; Redis connects before readiness.
- **What was tested:** 28 DB-free tests, PostgreSQL integration, production readiness, and repeatable parallel E2E.
- **What could not be tested:** distributed high-volume load across multiple API replicas.
- **Exact commands:** `(cd backend && npm run test:unit && npm run test)`; `npm run test:e2e`; `curl -fsS http://localhost/api/ready`.
- **Exact blockers:** none.
- **Remaining risks:** tune thresholds with production traffic and alert on sustained 429 rates.
- **Files changed:** `backend/src/index.js`; `backend/src/lib/rateLimit.js`; `backend/src/lib/rateLimitKeys.js`; auth/upload/comment/report/stats/track routes; `.github/workflows/public-beta.yml`.
