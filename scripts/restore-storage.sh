#!/usr/bin/env bash
# Restore a NoirSound object-storage archive into a target bucket.
# Usage: scripts/restore-storage.sh <storage-backup.tar.gz> [TARGET_BUCKET]
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib-backup-common.sh"

load_env

ARCHIVE="${1:?Usage: restore-storage.sh <storage-backup.tar.gz> [TARGET_BUCKET]}"
TARGET_BUCKET="${2:-${RESTORE_S3_BUCKET:-${S3_BUCKET:-}}}"
: "${TARGET_BUCKET:?Provide a target bucket (arg 2 or RESTORE_S3_BUCKET)}"
[[ -f "$ARCHIVE" ]] || fail "Archive not found: $ARCHIVE"
S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"

if [[ "$TARGET_BUCKET" == "${S3_BUCKET:-}" ]] && [[ "${NOIRSOUND_ALLOW_PROD_RESTORE:-no}" != "yes" ]]; then
  fail "Refusing to restore over the live bucket '${TARGET_BUCKET}'. Set NOIRSOUND_ALLOW_PROD_RESTORE=yes to override."
fi

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT
tar -xzf "$ARCHIVE" -C "$STAGING"
log "Restoring object storage into bucket '${TARGET_BUCKET}' at ${S3_ENDPOINT}"

if command -v aws >/dev/null 2>&1; then
  AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
  aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://${TARGET_BUCKET}" --recursive --no-progress 2>/dev/null || true
  AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
  aws --endpoint-url "$S3_ENDPOINT" s3 mb "s3://${TARGET_BUCKET}" 2>/dev/null || true
  AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
  aws --endpoint-url "$S3_ENDPOINT" s3 sync "$STAGING" "s3://${TARGET_BUCKET}" --no-progress
elif command -v mc >/dev/null 2>&1; then
  mc alias set nsrestore "$S3_ENDPOINT" "${S3_ACCESS_KEY_ID:-}" "${S3_SECRET_ACCESS_KEY:-}" >/dev/null 2>&1
  mc rm --recursive --force "nsrestore/${TARGET_BUCKET}" >/dev/null 2>&1 || true
  mc mb --ignore-existing "nsrestore/${TARGET_BUCKET}"
  mc mirror --overwrite "$STAGING" "nsrestore/${TARGET_BUCKET}"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  MC_ENDPOINT="$(docker_s3_endpoint "$S3_ENDPOINT")"
  export MC_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY TARGET_BUCKET
  docker run --rm --add-host host.docker.internal:host-gateway \
    --entrypoint /bin/sh \
    -e MC_ENDPOINT -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e TARGET_BUCKET \
    -v "${STAGING}:/restore" minio/mc -c '
      mc alias set nsrestore "$MC_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
      mc rm --recursive --force "nsrestore/$TARGET_BUCKET" >/dev/null 2>&1 || true
      mc mb --ignore-existing "nsrestore/$TARGET_BUCKET"
      mc mirror --overwrite /restore "nsrestore/$TARGET_BUCKET"
    '
else
  fail "Neither aws, mc, nor a working Docker daemon is available."
fi

log "Storage restore complete into '${TARGET_BUCKET}'."
