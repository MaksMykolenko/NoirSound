# NoirSound Deployment Final Commands

## Local Verification

```bash
npm run check:forbidden
npm run build
npm run test
npm run test:e2e
cd backend && npm run test
bash -n scripts/*.sh
APP_ENV_FILE=.env.production.example docker compose -f docker-compose.production.yml --env-file .env.production.example config --quiet
```

## First VPS Bootstrap

```bash
GIT_REPO_URL=https://github.com/<owner>/<repo>.git \
GIT_BRANCH=main \
APP_DIR=/opt/noirsound \
scripts/bootstrap-hostinger-vps.sh
```

## Production Env On VPS

```bash
cd /opt/noirsound
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32
```

Edit `.env.production` and replace every placeholder.

## Manual VPS Deploy

```bash
cd /opt/noirsound
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
```

## GitHub Deploy

```txt
Actions -> Deploy to Hostinger VPS -> Run workflow -> ref main
```

Or tag:

```bash
git tag public-beta-0.1.0
git push origin main --tags
```

## Health And Smoke

```bash
curl -fsS https://noirsound.co/api/ready
DOMAIN=https://noirsound.co scripts/smoke-production.sh
```

## Backup

```bash
cd /opt/noirsound
NOIRSOUND_ENV_FILE=/opt/noirsound/.env.production \
COMPOSE_FILE=docker-compose.production.yml \
scripts/backup-all.sh
```

## Rollback

```bash
cd /opt/noirsound
git fetch --tags origin
git checkout <previous-good-tag>
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
```
