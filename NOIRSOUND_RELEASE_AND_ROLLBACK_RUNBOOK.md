# NoirSound Release And Rollback Runbook

## Exact release identity

Finish required CI and approvals for the integrated commit before deployment. Record its full 40-character `RELEASE_SHA`; a passing branch build does not establish that a different merge commit passed. Verify any release tag name is unused before creating it. Do not move an existing tag or push unrelated tags.

The deployment workflow binds deployment to `github.sha`, uses strict SSH host verification, and holds one server-side lock across fetch, checkout, and deployment. A dirty VPS checkout blocks checkout changes. The workflow fetches the exact SHA and checks it out detached; it never pulls a moving branch during deployment.

## Mandatory production preflight

Confirm the actual VPS identity, checkout, production environment path, existing Compose project, image IDs, persistent mounts, service health, available resources, and absence of another deployment. Read the migration history from the database used by the running API and check schema/index state independently. Pending migrations are diagnostic information; do not use `migrate status && migrate deploy` as the deployment sequence. Failed migrations or drift require investigation before rollout.

Required operator settings are read from the process environment or as literal `KEY=value` entries in the existing production environment file:

- `COMPOSE_PROJECT_NAME`: the verified existing project; no default project is inferred.
- `OFFSITE_BACKUP_VERIFY_SCRIPT`: an absolute path to an executable supplied by the trusted, already configured private backup mechanism. No provider or adapter is supplied by this repository.
- `DRILL_DATABASE_URL`: an explicitly isolated, reachable PostgreSQL target accepted by `restore-drill.sh`.
- `DRILL_S3_BUCKET`: an explicitly isolated, absent bucket accepted by `restore-drill.sh`.

The restore drill requires a working PostgreSQL client and access to the configured storage endpoint. Internal Compose names are not automatically reachable from the host. Check those prerequisites without changing production networking. A failed or unavailable drill blocks deployment.

Keep credentials outside Git. Do not blindly source or print the production environment. The existing backup helpers load the explicitly supplied `NOIRSOUND_ENV_FILE`; deployment supplies the same absolute file as `APP_ENV_FILE` and the Compose `--env-file` argument.

## Trusted offsite verifier contract

The executable receives exactly three positional arguments:

```text
backup-directory checksum-file receipt-output-file
```

`RELEASE_SHA` is exported. The checksum file lists the fresh PostgreSQL archive, storage archive, and backup manifest from this deployment's private run directory. The adapter must copy those exact artifacts through the existing authorized private offsite mechanism, independently read/hash the remote copies, verify private access, and exit nonzero if any check fails. Do not treat a successful local copy or command submission as verified offsite storage.

Only after successful remote verification may the adapter write this six-line receipt:

```text
version=1
release_sha=<exact RELEASE_SHA>
checksum_sha256=<SHA-256 digest of the supplied checksum file>
offsite_verified=true
private_storage_verified=true
backup_reference=<non-sensitive opaque reference>
```

The reference accepts only letters, digits, dots, underscores, and hyphens (maximum 128 characters). Never include credentials, private destinations, signed URLs, or personal data in it. Deployment validates the trusted verifier's receipt and its binding to the backup and release; it does not independently implement a backup provider. A missing executable, nonzero exit, absent/malformed receipt, mismatched digest, or changed local archive blocks the build. Local stub tests prove these guards and ordering, not that a production offsite mechanism exists or has succeeded.

## Deployment sequence

Run the existing workflow only after the preflight and required approvals. For an authorized manual invocation, first acquire the same checkout lock and prepare the exact clean detached commit; then invoke the script with verified values:

```bash
APP_DIR=/opt/noirsound/NoirSound \
ENV_FILE=/opt/noirsound/NoirSound/.env.production \
COMPOSE_FILE=/opt/noirsound/NoirSound/docker-compose.production.yml \
RELEASE_SHA="$VERIFIED_RELEASE_SHA" \
bash scripts/deploy-hostinger.sh
```

The paths above must match the verified server. Deployment requires all existing services running and PostgreSQL, Redis, and MinIO healthy. It has no automatic first-install bypass and does not recreate stateful services.

The script preserves previous application image IDs in a private release record, then requires a fresh backup, archive validation, isolated restore of those exact archives, and a valid offsite receipt. It builds SHA-tagged backend/worker/web images with revision labels, verifies their identities and required backend schema/migrations/shared taxonomy files, runs `prisma migrate deploy` from the new backend image, and updates only backend/worker/web without rebuilding or starting dependencies.

By default private records are stored beside the checkout in `release-records/`, with a unique directory per attempt. `DEPLOY_RECORD_DIR` may explicitly select another private absolute path. They include previous/new image IDs, backup references, gate logs, migration results, and the deployment start timestamp. Failure service logs are bounded and begin at that timestamp. Do not commit or publish these operational records.

## Rollback and verification

If a gate fails before application updates, identify any checkout, backup, image, or migration changes separately. Do not rebuild/restart repeatedly. A failed migration never advances to the application update step.

For a failed application rollout, first confirm that the recorded previous image IDs still exist and remain compatible with the current database schema. Use those exact IDs in an operator-reviewed Compose override for an application-only rollback. Do not run the normal deploy script against an old tag as an automatic rollback procedure. Never restore an old database backup over newer user records without separate explicit approval.

Readiness and image-ID checks are only the infrastructure gate. Verify public HTTPS without bypassing TLS and complete the authorized live catalog/search, playback, collection, upload, privacy, and mobile smoke before declaring a release ready for users.
