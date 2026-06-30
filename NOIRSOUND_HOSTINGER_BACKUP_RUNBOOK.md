# NoirSound Hostinger Backup Runbook

## Scope

Backups cover:

- PostgreSQL database.
- MinIO object storage bucket.
- a redaction-safe manifest with commit and migration metadata.

The scripts do not print secret values.

## Local VPS Backup Location

Default:

```txt
/opt/noirsound/backups
```

Override:

```bash
NOIRSOUND_BACKUP_DIR=/mnt/noirsound-backups scripts/backup-all.sh
```

## Run A Backup

On the VPS:

```bash
cd /opt/noirsound
NOIRSOUND_ENV_FILE=/opt/noirsound/.env.production \
COMPOSE_FILE=docker-compose.production.yml \
scripts/backup-all.sh
```

The deployment script runs this automatically before updating already-running production services.

## Off-Host Copy

Local VPS backups are not enough. Copy the generated files off-host after each backup.

Example using `rsync` from a secure backup machine:

```bash
rsync -avz hostinger-user@your-vps:/opt/noirsound/backups/ ./noirsound-backups/
```

Do not paste `.env.production` or secret values into backup logs.

## Cron Example

Install cron manually if it is not available, then add:

```cron
15 3 * * * cd /opt/noirsound && NOIRSOUND_ENV_FILE=/opt/noirsound/.env.production COMPOSE_FILE=docker-compose.production.yml scripts/backup-all.sh >> logs/backup.log 2>&1
```

Notes:

- Create `/opt/noirsound/logs` first.
- Keep backup logs private.
- Configure off-host copy separately.
- Review retention with `NOIRSOUND_BACKUP_RETENTION_DAYS`.

## Restore Drill

Run a restore drill at least monthly and before major schema changes:

```bash
cd /opt/noirsound
scripts/restore-drill.sh
```

For real restores, read the restore script prompts carefully. Do not restore over production without a confirmed backup and an explicit maintenance window.

## Verification

After each backup:

```bash
ls -lh /opt/noirsound/backups
```

Expected artifacts:

- `postgres_<timestamp>.dump.gz`
- `storage_<timestamp>.tar.gz`
- `manifest_<timestamp>.txt`
