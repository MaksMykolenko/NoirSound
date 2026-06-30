# NoirSound — Public Beta Launch Runbook

Date: 2026-06-28

## What was inspected

Launch sequencing, secrets, migrations, health, smoke checks, moderation staffing, legal contacts, backup/restore, monitoring, and rollback.

## What was implemented

The codebase now includes production deployment, readiness, moderation, legal, CI, backup, restore, and test artifacts required by this runbook.

## Exact commands run

```bash
cp .env.production.example .env.production
# Set real DOMAIN/FRONTEND_ORIGIN/S3_PUBLIC_ENDPOINT and unique secrets.
npm ci
(cd backend && npm ci)
npm run lint
npm run test
(cd backend && npm run test)
npm run test:e2e
scripts/backup-all.sh
scripts/restore-drill.sh
```

Confirm DNS, ports 80/443, monitored `support@`/`copyright@` inboxes, an on-duty moderator/admin, and an off-host backup destination.

## Launch

```bash
docker compose -f docker-compose.production.yml --env-file .env.production build
docker compose -f docker-compose.production.yml --env-file .env.production up -d
docker compose -f docker-compose.production.yml --env-file .env.production ps
curl -fsS https://YOUR_DOMAIN/api/ready
```

Manually verify register/login/logout, one creator upload, stream seek, report submission, admin resolution, legal footer links, mobile navigation, and theme/language persistence.

## First 24 hours

```bash
docker compose -f docker-compose.production.yml --env-file .env.production logs -f backend worker web
scripts/backup-all.sh
```

Watch 5xx/429 rates, readiness, queue failures, storage growth, database disk, reports, and copyright inboxes.

## Incident/rollback

Hide unsafe content, suspend abusive accounts, preserve audit/log evidence, roll back to previous images if needed, and restore only into an isolated target first. For data loss, stop writes before restoration.

## What was tested

All launch gates passed locally, including production compose and restore drill.

## What could not be tested here

Real DNS/TLS and external communications.

## Exact blockers

None.

## Remaining risks

Single-host availability and manual monitoring during early beta.

## Files changed

`docker-compose.production.yml`; Dockerfiles; `Caddyfile`; env examples; `.github/workflows/public-beta.yml`; `scripts/`; moderation/legal frontend and backend files; this runbook.
