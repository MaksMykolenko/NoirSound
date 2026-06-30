#!/usr/bin/env bash
# Full NoirSound backup: PostgreSQL + object storage + a metadata manifest.
# Usage: scripts/backup-all.sh
set -euo pipefail
HERE="$(dirname "${BASH_SOURCE[0]}")"
source "${HERE}/lib-backup-common.sh"

load_env
ensure_backup_dir

log "=== NoirSound full backup ${TIMESTAMP} ==="
"${HERE}/backup-postgres.sh"
"${HERE}/backup-storage.sh"

# Metadata manifest: schema migration state + versions (no secrets).
MANIFEST="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"
{
  echo "NoirSound backup manifest"
  echo "timestamp_utc=${TIMESTAMP}"
  echo "node_version=$(node --version 2>/dev/null || echo n/a)"
  echo "git_commit=$(git -C "$NOIRSOUND_ROOT" rev-parse --short HEAD 2>/dev/null || echo n/a)"
  echo "database=$(redact_url "${DATABASE_URL:-unset}")"
  echo "s3_bucket=${S3_BUCKET:-unset}"
  echo "applied_migrations:"
  ls -1 "${NOIRSOUND_ROOT}/backend/prisma/migrations" 2>/dev/null | grep -v migration_lock || echo "  (none found)"
} > "$MANIFEST"

log "Manifest written: $(basename "$MANIFEST")"
log "=== Full backup complete. Artifacts in ${BACKUP_DIR} ==="
ls -1t "${BACKUP_DIR}" | head -6
