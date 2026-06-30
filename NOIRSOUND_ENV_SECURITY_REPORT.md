# NoirSound — Env & Secret Hardening Report (Phase 2)

Date: 2026-06-28

## What was implemented
- **`backend/src/config.js`** — centralized, pure-testable config validation.
  - `evaluateConfig(env)` returns `{errors, warnings}` (no throw) for unit testing.
  - `loadAndValidateConfig()` throws on errors; called in `start()` so the server **refuses to boot in production** with bad config.
  - `safeConfigSummary()` logs a redacted startup summary (no secret values).
- **Wired into `backend/src/index.js`** `start()`: validates before `listen`, then logs the safe summary.

## Rules enforced (production)
| Rule | Status |
|------|--------|
| App refuses startup in production if secrets weak/missing | PASS (`loadAndValidateConfig` → `process.exit(1)`) |
| JWT/session secret long/random (≥32 chars, not default) | PASS (`isWeakSecret`) |
| Cookie secret long/random | PASS |
| JWT_SECRET ≠ COOKIE_SECRET | PASS |
| DATABASE_URL required | PASS (all envs) |
| REDIS_URL required (queues/rate limit) | PASS in prod (warn in dev) |
| S3/MinIO credentials required | PASS in prod (warn in dev) |
| FRONTEND_ORIGIN required (CORS+CSRF allowlist) | PASS in prod |
| NODE_ENV=production handling | PASS (strict checks gate on it) |
| Reject default S3 secret (`minioadmin`) in prod | PASS |
| Public/private storage separation documented | PASS (see Upload/Streaming reports + `S3_IS_PUBLIC=false`) |
| Trusted proxy setting documented | PASS (`TRUST_PROXY`, default true in prod) |

## .env hygiene
- `backend/.env.example` updated: secret-strength note, CORS note, and new ops vars (`TRUST_PROXY`, `LOG_LEVEL`, `AUDIO_WORKER_CONCURRENCY`, `FFPROBE_TIMEOUT_MS`, `FFMPEG_TIMEOUT_MS`, `MAX_AUDIO_DURATION_SECONDS`, optional `SENTRY_DSN`). No real secrets.
- New **`.env.production.example`** at repo root for the production compose.
- Root **`.gitignore`** now ignores `.env`, `.env.production`, `backend/.env*`, and `backups/`.
- `backend/.gitignore` already ignores `.env`. No `.env` is committed.

## Tests (runnable, executed in-sandbox)
`backend/tests/publicBeta.unit.test.js` covers `isWeakSecret`, missing-secret errors, weak-prod-secret rejection, valid-prod pass, multi-origin parsing. **Result: passing** (part of 28/28 final DB-free tests).

## Status: PASS

## Final verification record

- **What was inspected:** config validation, env examples, ignore rules, redacted startup logs, production compose injection, and public signed-storage endpoint configuration.
- **What was implemented:** production now also requires `S3_PUBLIC_ENDPOINT`; temporary smoke secrets were kept in ignored `.env.production` and deleted after the test.
- **What was tested:** valid production config, weak/missing rejection, production container startup, redacted logs, audits at zero.
- **What could not be tested:** cloud secret-manager integration and rotation.
- **Exact commands:** `(cd backend && npm run test:unit && npx prisma validate && npm audit --omit=dev)`; `docker compose -f docker-compose.production.yml --env-file .env.production up -d`.
- **Exact blockers:** none.
- **Remaining risks:** production operators must rotate secrets and avoid shell/env leakage.
- **Files changed:** `backend/src/config.js`; `backend/src/index.js`; `.env.production.example`; `backend/.env.example`; `.gitignore`; `docker-compose.production.yml`; `backend/tests/publicBeta.unit.test.js`.
