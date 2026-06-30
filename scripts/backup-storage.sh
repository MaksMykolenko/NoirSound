#!/usr/bin/env bash
# Backup NoirSound object storage (MinIO/S3 bucket) to a compressed archive.
# Usage: scripts/backup-storage.sh
# Requires: AWS CLI (aws) OR MinIO client (mc). Uses S3_* env vars.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib-backup-common.sh"

load_env
ensure_backup_dir

: "${S3_BUCKET:?S3_BUCKET is required}"
S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

log "Backing up object storage bucket '${S3_BUCKET}' from ${S3_ENDPOINT}"
S3_HOST="$(url_host "$S3_ENDPOINT")"

if [[ "$S3_HOST" == "minio" ]] && compose_available; then
  : "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
  : "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
  mapfile -t COMPOSE_ARGS < <(compose_args)
  log "Using Docker Compose MinIO network for storage backup."
  docker compose "${COMPOSE_ARGS[@]}" run --rm --no-deps \
    -e S3_ENDPOINT -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e S3_BUCKET \
    -v "${STAGING}:/backup" \
    --entrypoint /bin/sh minio-create-bucket -c '
      set -e
      mc alias set nsbackup "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
      mc mirror --overwrite "nsbackup/$S3_BUCKET" /backup
    '
elif command -v aws >/dev/null 2>&1; then
  AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
  aws --endpoint-url "$S3_ENDPOINT" s3 sync "s3://${S3_BUCKET}" "$STAGING" --no-progress
elif command -v mc >/dev/null 2>&1; then
  mc alias set nsbackup "$S3_ENDPOINT" "${S3_ACCESS_KEY_ID:-}" "${S3_SECRET_ACCESS_KEY:-}" >/dev/null 2>&1
  mc mirror --overwrite "nsbackup/${S3_BUCKET}" "$STAGING"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  MC_ENDPOINT="$(docker_s3_endpoint "$S3_ENDPOINT")"
  export MC_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_BUCKET
  docker run --rm --add-host host.docker.internal:host-gateway \
    --entrypoint /bin/sh \
    -e MC_ENDPOINT -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e S3_BUCKET \
    -v "${STAGING}:/backup" minio/mc -c '
      mc alias set nsbackup "$MC_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
      mc mirror --overwrite "nsbackup/$S3_BUCKET" /backup
    '
else
  fail "Neither aws, mc, nor a working Docker daemon is available for object-storage backup."
fi

OUT="${BACKUP_DIR}/storage_${TIMESTAMP}.tar.gz"
tar -czf "$OUT" -C "$STAGING" .
SIZE="$(du -h "$OUT" | cut -f1)"
log "Storage backup complete: $(basename "$OUT") (${SIZE})"

prune_old "storage_*.tar.gz"
log "Done. Retention: ${RETENTION_DAYS} days."
