# NoirSound — Backup & Restore Report

Date: 2026-06-28  
Status: PASS

## What was inspected

PostgreSQL dump/restore behavior, Prisma URL compatibility, PostgreSQL client/server versions, MinIO/S3 copy and restore, retention, safety guards, isolated drill targets, row verification, object-count verification, and cleanup.

## What was implemented

- Compressed timestamped PostgreSQL and object-storage backups.
- Safe restore scripts that refuse live targets unless explicitly overridden.
- Prisma `?schema=` normalization for PostgreSQL CLI tools.
- Matching PostgreSQL client-container fallback when local and server major versions differ.
- Dockerized MinIO client fallback when `aws`/`mc` is not installed on the host.
- Failure propagation; restore errors are no longer swallowed.
- Clean storage restore, 28/28 object verification, and guaranteed drill cleanup.

## What was tested

The final drill restored 20 users, 5 tracks, 5 uploads, 1 report, and 28/28 objects into isolated targets, then removed the drill database and bucket. Exit code: 0.

## Exact commands run

```bash
cd /Users/maksymmikolenko/MyProjects/NoirSound
bash -n scripts/*.sh
scripts/backup-all.sh
scripts/backup-postgres.sh
scripts/restore-drill.sh
```

## What could not be tested here

Remote/off-site backup transport, encryption-at-rest by a cloud backup provider, and scheduled retention jobs were not exercised.

## Exact blockers

None.

## Remaining risks

Backups currently land in a local ignored `backups/` directory. Production must copy them off-host, encrypt them, monitor failures, and periodically repeat the drill.

## Files changed

`scripts/lib-backup-common.sh`; `scripts/backup-postgres.sh`; `scripts/restore-postgres.sh`; `scripts/backup-storage.sh`; `scripts/restore-storage.sh`; `scripts/backup-all.sh`; `scripts/restore-drill.sh`; `.gitignore`.
