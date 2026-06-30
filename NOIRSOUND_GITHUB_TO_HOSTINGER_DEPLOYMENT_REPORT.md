# NoirSound GitHub To Hostinger Deployment Report

Date: 2026-06-30

## Verdict

HOSTINGER DEPLOYMENT READY, pending manual VPS secret setup and successful GitHub/VPS execution.

## What Changed

- Added explicit forbidden-file scanning with `scripts/check-forbidden-files.sh`.
- Added Hostinger deploy script with env validation, backups, compose validation, image build, migrations, service startup, readiness wait, and redacted failure logs.
- Added Hostinger bootstrap script for a fresh Ubuntu VPS.
- Added production smoke test script.
- Strengthened production env placeholder detection in backend startup validation.
- Added `/api/mode` for smoke verification of real API mode.
- Expanded production env templates.
- Reworked CI into explicit GitHub gate jobs.
- Added manual/tagged Hostinger SSH deploy workflow.
- Added DNS, backup, release, rollback, secrets, checklist, command, and audit documentation.

## GitHub Workflow

CI:

```txt
.github/workflows/public-beta.yml
```

Deploy:

```txt
.github/workflows/deploy-hostinger.yml
```

The deploy workflow runs only by manual dispatch or `public-beta-*` tag push. It does not auto-deploy every push to `main`.

## VPS Deploy Flow

```txt
GitHub Actions SSH -> cd deploy path -> git fetch -> checkout branch/tag -> git pull --ff-only for branches -> scripts/deploy-hostinger.sh
```

The VPS keeps `.env.production`. GitHub does not receive production app secrets.

## Required GitHub Secrets

```txt
HOSTINGER_HOST
HOSTINGER_USER
HOSTINGER_SSH_KEY
HOSTINGER_KNOWN_HOSTS
HOSTINGER_DEPLOY_PATH
PRODUCTION_DOMAIN
```

Optional:

```txt
HOSTINGER_PORT
```

## Required VPS Files

```txt
/opt/noirsound/.env.production
/opt/noirsound/docker-compose.production.yml
/opt/noirsound/Caddyfile
/opt/noirsound/scripts/deploy-hostinger.sh
```

## Deployment Commands

```bash
cd /opt/noirsound
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
```

Smoke:

```bash
DOMAIN=https://noirsound.co scripts/smoke-production.sh
```

## Backup Commands

```bash
cd /opt/noirsound
NOIRSOUND_ENV_FILE=/opt/noirsound/.env.production \
COMPOSE_FILE=docker-compose.production.yml \
scripts/backup-all.sh
```

## Rollback Commands

```bash
cd /opt/noirsound
git fetch --tags origin
git checkout <previous-good-tag>
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
```

## Tests Run

Passed locally:

- `npm run lint`
- `npm run test`: 18 files, 73 tests passed.
- `npm run build`
- `cd backend && npm run test:unit`: 2 files, 31 tests passed.
- `bash -n scripts/*.sh`
- `npm run check:forbidden`
- production Compose config validation using `.env.production.example`
- workflow YAML parsing
- `git diff --check`

Environment-blocked locally:

- `cd backend && npm run test` could not start because PostgreSQL was not running on `localhost:5432`.
- Docker image builds could not run because the local Docker daemon socket was unavailable.
- `npm run test:e2e` ran without backend dependencies: 31 passed, 9 failed, 13 skipped, and 9 did not run. Failures included direct connection refusal to `localhost:3000` and data-dependent Discover expectations.

The GitHub CI workflow provisions PostgreSQL, Redis, MinIO, FFmpeg, and Playwright before running the full integration gates. The first GitHub CI run remains required before deployment.

## Manual Work Left

- Push the repository to GitHub.
- Configure GitHub deploy secrets.
- Bootstrap or prepare the Hostinger VPS.
- Create and fill `/opt/noirsound/.env.production` with real values.
- Point DNS records to the VPS.
- Run first GitHub or manual VPS deployment.
- Configure off-host backup copy.
