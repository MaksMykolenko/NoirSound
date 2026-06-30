# NoirSound

NoirSound is a full-stack music platform prepared for a public beta deployment through:

```txt
Local project -> GitHub repository -> GitHub CI checks -> Hostinger VPS deployment
```

The production stack is Docker Compose on a VPS: Caddy, frontend, backend, worker, PostgreSQL, Redis, and private MinIO storage.

## Local Development

Frontend:

```bash
cp .env.example .env
npm ci
npm run dev
```

Backend:

```bash
cd backend
cp .env.example .env
npm ci
docker compose up -d
npm run dev
```

Useful commands:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
cd backend && npm run test
```

## CI

GitHub Actions CI lives in `.github/workflows/public-beta.yml` and runs on pull requests, pushes to `main`, and manual dispatch.

Required gates:

```txt
forbidden-files-scan
frontend-lint
frontend-test
frontend-build
backend-test
backend-unit-security
playwright-e2e
docker-build
```

The forbidden-file gate is also available locally:

```bash
npm run check:forbidden
```

## Production Environment

Copy `.env.production.example` to `.env.production` only on the VPS. Do not commit `.env.production`.

Generate secrets with:

```bash
openssl rand -hex 32
```

The backend refuses to start in production if core secrets are weak or if placeholder values such as `CHANGE_ME` or `example.com` remain.

Support and legal inboxes must be configured before launch:

```txt
SUPPORT_EMAIL
COPYRIGHT_EMAIL
ABUSE_EMAIL
```

## GitHub To Hostinger Deployment

Deployment workflow:

```txt
.github/workflows/deploy-hostinger.yml
```

It is manual via `workflow_dispatch` and also runs for tags matching `public-beta-*`. It does not deploy every push to `main`.

Required GitHub Actions secrets:

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

The production `.env.production` file stays on the VPS. GitHub only connects over SSH, fetches the selected ref, and runs `scripts/deploy-hostinger.sh`.

## First-Time VPS Bootstrap

On a fresh Hostinger VPS:

```bash
GIT_REPO_URL=https://github.com/<owner>/<repo>.git \
GIT_BRANCH=main \
APP_DIR=/opt/noirsound \
scripts/bootstrap-hostinger-vps.sh
```

Then edit `/opt/noirsound/.env.production`, replace every placeholder, point DNS at the VPS, and deploy.

## Deploy Command

Manual VPS deploy:

```bash
cd /opt/noirsound
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
```

The deploy script validates `.env.production`, validates compose config, creates a backup when existing services are running, builds images, runs Prisma migrations, starts services, and waits for:

```txt
http://localhost/api/ready
```

## Health And Smoke Tests

Production smoke test:

```bash
DOMAIN=https://noirsound.co scripts/smoke-production.sh
```

Optional register/login smoke path:

```bash
SMOKE_REGISTER=true \
SMOKE_EMAIL=smoke@example.com \
SMOKE_PASSWORD='use-a-temporary-password' \
DOMAIN=https://noirsound.co \
scripts/smoke-production.sh
```

## Backups

Local VPS backups are written to `backups/` by default:

```bash
NOIRSOUND_ENV_FILE=/opt/noirsound/.env.production \
COMPOSE_FILE=docker-compose.production.yml \
scripts/backup-all.sh
```

Copy backup artifacts off-host. Local-only VPS backups are not enough.

## Rollback

Deploy a previous good tag:

```bash
cd /opt/noirsound
git fetch --tags origin
git checkout public-beta-0.1.0
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
```

Always create a backup before rollback. Do not blindly reverse database migrations if a migration is destructive.
