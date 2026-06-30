# NoirSound Release And Rollback Runbook

## Release Tag

From a clean local checkout after CI passes:

```bash
git checkout main
git pull --ff-only origin main
git tag public-beta-0.1.0
git push origin main --tags
```

Tags matching `public-beta-*` can trigger `.github/workflows/deploy-hostinger.yml`.

## Manual Tag Deploy On VPS

```bash
cd /opt/noirsound
git fetch --tags origin
git checkout public-beta-0.1.0
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
```

## Rollback

Pick the previous good tag:

```bash
cd /opt/noirsound
git fetch --tags origin
git checkout <previous-good-tag>
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
```

## Database Warning

The deploy script creates a backup before updating already-running services. Still, do not rollback database migrations blindly:

- Prisma `migrate deploy` only applies forward migrations.
- Destructive schema changes may need manual restore or forward-fix migration.
- Always confirm backup artifacts before a rollback that follows a migration.

## Post-Rollback Verification

```bash
DOMAIN=https://noirsound.co scripts/smoke-production.sh
curl -fsS https://noirsound.co/api/ready
docker compose -f docker-compose.production.yml --env-file .env.production ps
```
