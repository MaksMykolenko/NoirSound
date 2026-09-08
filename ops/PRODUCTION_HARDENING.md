# Production hardening and recovery operations

These changes preserve the existing `noirsound` Compose project and named data volumes. Source implementation is not production proof. No script below performs an application rollback, production data restore, firewall/SSH change or reboot.

## Exact release images and rollout gate

`Dockerfile` and `backend/Dockerfile` accept `GIT_SHA` and `BUILD_DATE`, and set OCI revision/created/source labels. Development/ordinary CI builds default to `unknown`; they are **not release images**. The production deployment script requires the clean exact forty-character `RELEASE_SHA`, verifies the existing Compose project, uses the same SHA/date for all three builds, and verifies labels/image IDs before updating app containers. It records previous images for a separate supported rollback decision.

The script remains blocked without an explicitly configured, trusted `OFFSITE_BACKUP_VERIFY_SCRIPT`. It requires a fresh archive pair, integrity checks, successful owned restore and a private offsite receipt. A nonzero `prisma migrate status` from the **new image** stops before `migrate deploy` for explicit pending-SQL/history review. This remediation release expects no new SQL. No `db push`, reset or migration-history editing is allowed. If a later release has pending SQL, review/apply that exact image's SQL through a separately authorized migration plan rather than bypassing this guard.

Readiness must return canonical normal-TLS HTTP200 with JSON `status=ready` and database/redis/storage all `ok`. HTTP redirects do not satisfy it. App containers must remain running with zero restarts/OOM state; worker FFmpeg/FFprobe and Redis connectivity are checked. This still does not replace an actual authorized upload/playback smoke.

## Logging and proxy behavior

All six long-running services use json-file `max-size=20m`, `max-file=5`. The same historical named volumes remain configured. Existing logs are not truncated. Stateful containers receive new log settings only at an explicitly planned safe recreation using their existing named volumes; app-only deployment does not itself prove stateful log rotation applied.

Caddy serves apex and www TLS; www redirects308 preserving path/query. `/robots.txt` is proxied to the dynamic backend with `/sitemap.xml`. Dotfiles and operational root reports/backups/config/archive/key paths return404; normal SPA routes and `/api/reports` remain routable.

HTML CSP is response-type scoped, preserving the backend's stricter API CSP. Theme/analytics initialization is self-hosted JavaScript; no script unsafe-inline/unsafe-eval is allowed. React's current dynamic styles require style unsafe-inline. Google Fonts CSS/font hosts and Google avatar image hosts are explicitly allowed. Existing GA4 added by main212bd5f is retained. Script loading permits `www.googletagmanager.com`; connect/img allow explicit GA collection hosts including regional endpoints. Advertising/Tag Manager Preview endpoints are not enabled because this code only configures GA4. Browser CSP/analytics verification is still required before production readiness; a newly selected remote media/CDN host requires explicit CSP review. Same-origin API/presigned storage and blob previews are allowed.

Relevant primary guidance: [Caddy response header matching](https://caddyserver.com/docs/caddyfile/directives/header), [Google Analytics CSP requirements](https://developers.google.com/tag-platform/security/guides/csp#google_analytics).

## Backup architecture and secure permissions

Existing commands `backup-all.sh`, `backup-postgres.sh`, `backup-storage.sh` and `restore-drill.sh` invoke the same standard-library `backup-tool.py`. Direct arbitrary-target `restore-postgres.sh` / `restore-storage.sh` now fail closed; production restore is not exposed as an override.

Required host tools: Python3, Docker+Compose, and the existing containers/images. No host psql, pg_dump, aws or mc installation is required. PostgreSQL tools run **inside the existing postgres container**. S3 operations run with the backend image's existing AWS SDK and environment. Storage mirroring uses the existing `minio-create-bucket` mc image with `--pull never` on the **same Compose network**; a missing image fails rather than selecting a new release. No MinIO host port is opened.

The explicit environment must identify `COMPOSE_PROJECT_NAME`, `POSTGRES_USER`, `POSTGRES_DB` and `S3_BUCKET`; these are checked against live container identities. Endpoint, region, path-style setting, bucket and credential values must match the running backend. Conflicting caller/file storage overrides are rejected. Both the SDK and mc receive the same privately captured, frozen backend storage configuration; SDK commands use that exact backend container ID. The environment parser accepts dotenv literals/interpolated `${NAME}` without shell source/eval. No secret values are printed. All entrypoints have umask077. Backup directories are0700, archives/manifests0600. Every entrypoint obtains the same exclusive nonblocking file lock; configure one `NOIRSOUND_BACKUP_LOCK` for scheduler/deployment/operational copies.

A full backup includes PostgreSQL custom dump+gzip, storage tar, and private JSON content in `manifest_<run>.txt` containing archive SHA256/size, actual applied migration metadata, selected table counts and per-object content hashes. Private manifests can contain object names and must never enter Git/public reports. PG readability uses `pg_restore --list`; storage archive members reject links, path traversal and device entries. The seven source counts (`User`, `ArtistProfile`, `CreatorRegistration`, `Track`, `Upload`, `Report`, `_prisma_migrations`) are observed in read-only repeatable-read transactions before/after pg_dump. If counts move, verification fails and a quieter snapshot must be retried. pg_dump itself provides a consistent database snapshot; count stability is not proof that every existing row was unchanged.

Storage listing records exact source keys/sizes/ETags/last-modified timestamps before copying and after archive creation. Both inventories must agree and archive keys/sizes must match that stable source list; content hashes are retained for restored readback. Missing objects, same-size overwrites with changed metadata and unrepresentable keys fail verification. This is bounded drift detection, not an atomic S3 snapshot or a claim of historical completeness.

Retention defaults14 days, allows7–3650, preserves at least the newest3 complete recognized manifest sets and does not infer ownership of legacy archives. A prunable manifest must name exactly its own same-run PostgreSQL+storage archive pair; both files must be regular non-symlinks with matching size/hash. Invalid sets neither displace protected sets nor authorize deletion. Only verified complete sets beyond retention are removed. Failed partial artifacts remain private for investigation. A complete database+object-store backup cannot provide a cross-system atomic transaction during concurrent uploads; run at a quiet time and require a successful readback restore.

## Manual backup and isolated restore

Use explicit verified paths; do not source the production env in an interactive terminal. Example values below identify the existing production configuration, not a new Compose project:

```bash
NOIRSOUND_ENV_FILE=/opt/noirsound/NoirSound/.env.production \
COMPOSE_FILE=/opt/noirsound/NoirSound/docker-compose.production.yml \
NOIRSOUND_BACKUP_DIR=/opt/noirsound/NoirSound/backups \
NOIRSOUND_BACKUP_LOCK=/opt/noirsound/NoirSound/backups/.operation.lock \
bash /opt/noirsound/NoirSound/scripts/backup-all.sh
```

Select the **exact newly emitted** archive pair and its private manifest for restore; never substitute an older pair to satisfy a failed check:

```bash
NOIRSOUND_ENV_FILE=/opt/noirsound/NoirSound/.env.production \
COMPOSE_FILE=/opt/noirsound/NoirSound/docker-compose.production.yml \
NOIRSOUND_BACKUP_DIR=/opt/noirsound/NoirSound/backups \
NOIRSOUND_BACKUP_LOCK=/opt/noirsound/NoirSound/backups/.operation.lock \
NOIRSOUND_RESTORE_TEST=1 \
DRILL_POSTGRES_BACKUP=/absolute/path/to/the-new-postgres.dump.gz \
DRILL_STORAGE_BACKUP=/absolute/path/to/the-new-storage.tar.gz \
DRILL_MANIFEST=/absolute/path/to/the-new-manifest.txt \
bash /opt/noirsound/NoirSound/scripts/restore-drill.sh
```

The tool generates `ns_<24 random hex>_restore_test` and bucket `ns-<same id>-restore-test`. User-supplied DB/bucket/restore URL overrides are rejected. Pre-existing resources are rejected before creation. DB ownership is attested by a database comment `noirsound-restore:<run-id>`; bucket ownership uses the `noirsound-restore-owner` tag. SQL creates a separate database, restores **without clean/drop of existing objects**, checks schema table presence/counts and actual `_prisma_migrations` against the backup manifest. S3 writes only the run-owned bucket, downloads it to a newly created local staging directory and compares every content hash/count.

Cleanup rechecks exact generated identity and ownership comment/tag before dropping only that temporary database/bucket. Missing/changed ownership fails cleanup and leaves a private receipt identifying the run-owned resources; do not manually guess a cleanup target. The production DB/bucket is never used as a restore destination, and no production override exists. Production aggregate counts and full object inventory are observed before creation and after cleanup; changed/unavailable observations fail the drill without asserting what caused the change. Successful receipts report restore, cleanup and `production_unchanged` VERIFIED. Aggregate rows/IDs/credentials are not dumped. Older manifests without the verified source inventory are rejected; take a new backup with this tool before the drill.

The PostgreSQL role used in the existing container must be able to create/drop its own temporary database and read the backup tables; it is the configured `POSTGRES_USER`, not an invented or newly granted role. Bucket tagging/list/create/read/delete capability is needed for the temporary bucket. The tool does not grant SQL/S3 privileges. Missing privileges fail closed. Roles and actual permissions must be recorded during the operator's live drill.

## Scheduler

Templates: `ops/systemd/noirsound-backup.service` and `.timer`. Timer: daily03:15UTC with up to15m delay, Persistent=true. Service uses the exact backup-all entrypoint, umask0077, shared lock, two-hour deadline and safe journal summaries. It must be installed/enabled and manually invoked once to establish runtime evidence; source templates alone do not prove scheduling.

For an independently verified operations copy outside the production Git checkout, an operator may install the same reviewed scripts under `/opt/noirsound/operations-remediation/scripts`. Record their file SHA256 values and the candidate commit/artifact reference. Override the systemd WorkingDirectory/ExecStart to that artifact while retaining explicit `NOIRSOUND_ENV_FILE`, `COMPOSE_FILE`, `NOIRSOUND_BACKUP_DIR`, `NOIRSOUND_BACKUP_LOCK` and `NOIRSOUND_SOURCE_ROOT=/opt/noirsound/NoirSound`. Do not make the prod checkout dirty or represent an uncommitted operations artifact as a deployed application release. Use the identical shared lock across this copy and future application deployment.

## Offsite and reboot gates

No destination is invented. Without `OFFSITE_BACKUP_VERIFY_SCRIPT`, local backups succeed and emit **OFFSITE BLOCKED — PROVIDER/DESTINATION NOT AUTHORIZED**. With an explicit operator-owned executable, full backups invoke the existing adapter contract with `[backup directory, checksum manifest path, receipt path]`; stdout/stderr stay in0600 private files. `RELEASE_SHA` must be exact; scheduled jobs may resolve it from the explicit `NOIRSOUND_SOURCE_ROOT` checkout. The adapter must independently upload/read/hash an authorized private destination and return six fields: version=1, release_sha, checksum_sha256, offsite_verified=true, private_storage_verified=true, and a non-sensitive backup_reference. Any configured-adapter failure makes the job fail while preserving local artifacts. The checksum manifest is rechecked after the adapter returns.

A local archive or an adapter executable is not offsite proof. No deployment/reboot proceeds without the required fresh backup, real isolated restore and authorized offsite evidence. The MinIO advisory/support issue remains a separate launch blocker until an approved tested patched image exists; these tools do not silently replace storage.

## Reproducible local checks

```bash
npx vitest run tests/scripts/restoreDrill.test.js tests/scripts/deployHostinger.test.js
python3 scripts/check-caddy-routing.py
APP_ENV_FILE=.env.production.example docker compose --env-file .env.production.example -f docker-compose.production.yml config --quiet
```

The restore test wrapper runs28 Python guard scenarios with fake clients; it does **not** prove a real restore. They include mismatched storage configuration, inherited credential overrides, incomplete copies, same-size object drift, cross-run retention attacks, owned cleanup and changed production observations. The Caddy functional checker uses generated local containers/network and removes only its own objects; it checks404 namespaces, valid reporting/SPA/assets routing, HTML/API CSP separation, www308 path/query and storage routing. The media proxy expectation uses a deliberately absent MinIO stub (502 proves it reached the proxy, not successful playback). Real TLS/browser/upload/restore/scheduler/post-reboot checks remain separate production evidence.
