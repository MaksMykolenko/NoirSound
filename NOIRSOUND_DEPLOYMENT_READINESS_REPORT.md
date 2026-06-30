# NoirSound — Deployment Readiness Report

Date: 2026-06-28  
Verdict: PUBLIC BETA READY

## What was inspected

Production images, compose topology, migrations, secrets, Caddy routing, signed storage URLs, health checks, worker dependencies, persistent volumes, logs, tests, audits, and backup/restore.

## What was implemented

Production startup validation, public/private S3 endpoint separation, same-origin Caddy storage routing, private MinIO initialization, migration-on-start, a worker service, readiness-driven backend health, hardened images, and patched dependency overrides.

## What was tested

- `docker compose ... build`: PASS.
- `docker compose ... up -d`: PASS.
- All six long-running services started; backend/PostgreSQL/Redis/MinIO healthy.
- `/api/ready`: 200, all dependency checks `ok`.
- Frontend route: 200.
- Anonymous bucket request: 403.
- Logs: migrations applied/no pending migrations; no startup errors.

## Exact commands run

```bash
docker compose -f docker-compose.production.yml --env-file .env.production config --no-env-resolution --quiet
docker compose -f docker-compose.production.yml --env-file .env.production build
docker compose -f docker-compose.production.yml --env-file .env.production up -d
docker compose -f docker-compose.production.yml --env-file .env.production ps
docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=100
curl -fsS http://localhost/api/ready
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/terms
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/noirsound-audio/
```

## What could not be tested here

Real-domain HTTPS issuance and cloud/network perimeter controls.

## Exact blockers

None.

## Remaining risks

The local smoke intentionally used HTTP and disposable secrets; the real deployment must use HTTPS, real secrets, DNS, off-host backups, and monitored support/copyright inboxes.

## Files changed

`Dockerfile`; `backend/Dockerfile`; `docker-compose.production.yml`; `Caddyfile`; `.env.production.example`; `backend/.env.example`; `backend/src/config.js`; `backend/src/index.js`; `backend/src/services/storage.js`.
