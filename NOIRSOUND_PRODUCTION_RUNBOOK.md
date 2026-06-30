# NoirSound — Production Runbook

Date: 2026-06-28

## What was inspected

Frontend/backend images, Caddy, migrations, worker startup, PostgreSQL, Redis, MinIO, health checks, signed object routing, secrets, logs, backup/restore, and rollback controls.

## What was implemented

Production Dockerfiles, `docker-compose.production.yml`, automatic migrations, a dedicated worker, Caddy HTTPS/reverse proxy, same-origin signed MinIO routing, private bucket initialization, health checks, persistent volumes, and a validated production env template.

## Exact commands run

```bash
cd /Users/maksymmikolenko/MyProjects/NoirSound
cp .env.production.example .env.production
openssl rand -hex 32
# Fill DOMAIN, FRONTEND_ORIGIN, S3_PUBLIC_ENDPOINT, unique secrets, and real passwords.
docker compose -f docker-compose.production.yml --env-file .env.production config --quiet
docker compose -f docker-compose.production.yml --env-file .env.production build
docker compose -f docker-compose.production.yml --env-file .env.production up -d
docker compose -f docker-compose.production.yml --env-file .env.production ps
docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=100
curl -fsS https://YOUR_DOMAIN/api/ready
```

`S3_PUBLIC_ENDPOINT` must equal the browser-facing origin. Caddy forwards `/<S3_BUCKET>/*` to private MinIO; anonymous bucket access remains disabled.

## Routine operations

```bash
scripts/backup-all.sh
scripts/restore-drill.sh
docker compose -f docker-compose.production.yml --env-file .env.production logs -f backend worker web
docker compose -f docker-compose.production.yml --env-file .env.production exec backend npx prisma migrate status
```

## Rollback

Keep the previous image tags and a pre-deploy backup. Roll back images, run `up -d`, then verify `/api/ready`. Do not reverse a destructive database migration without a tested restore plan.

## What was tested

Production images built; compose started; PostgreSQL/Redis/MinIO/backend were healthy; worker and Caddy ran; migrations had no pending work; `/api/ready` returned 200 with all dependencies `ok`; anonymous storage returned 403.

## What could not be tested here

Real DNS, ACME issuance, cloud firewall policy, external SMTP/support inboxes, and multi-host failover.

## Exact blockers

None in code. Deployment requires operator-supplied production secrets, DNS, and reachable legal/support inboxes.

## Remaining risks

Single-node volumes are not high availability. Add off-host backups, external alerting, and capacity monitoring before growth.

## Files changed

`Dockerfile`; `backend/Dockerfile`; `docker-compose.production.yml`; `Caddyfile`; `.dockerignore`; `.env.production.example`; `backend/.env.example`; `backend/src/config.js`; `backend/src/services/storage.js`.
