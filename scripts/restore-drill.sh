#!/usr/bin/env bash
# Restore drill: prove the latest backups can be restored into a CLEAN,
# isolated target (never touches production). Verifies row counts and object
# presence, then tears the drill targets down.
#
# Usage: scripts/restore-drill.sh
# Env:
#   DRILL_DATABASE_URL   target DB url (default: local 'noirsound_drill' db)
#   DRILL_S3_BUCKET      target bucket (default: 'noirsound-drill')
set -euo pipefail
HERE="$(dirname "${BASH_SOURCE[0]}")"
source "${HERE}/lib-backup-common.sh"

load_env

DRILL_DATABASE_URL="${DRILL_DATABASE_URL:-}"
DRILL_S3_BUCKET="${DRILL_S3_BUCKET:-noirsound-drill}"
export DRILL_S3_BUCKET

# Derive a drill DB url from DATABASE_URL if not provided (…/<db> -> …/<db>_drill).
if [[ -z "$DRILL_DATABASE_URL" && -n "${DATABASE_URL:-}" ]]; then
  DRILL_DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's#/([^/?]+)(\?|$)#/\1_drill\2#')"
fi
: "${DRILL_DATABASE_URL:?Set DRILL_DATABASE_URL for the drill target}"

LATEST_PG="$(ls -1t "${BACKUP_DIR}"/postgres_*.dump.gz 2>/dev/null | head -1 || true)"
LATEST_ST="$(ls -1t "${BACKUP_DIR}"/storage_*.tar.gz 2>/dev/null | head -1 || true)"
[[ -n "$LATEST_PG" ]] || fail "No PostgreSQL backup found in ${BACKUP_DIR}. Run backup-all.sh first."

log "=== Restore drill ==="
log "PG backup:      $(basename "$LATEST_PG")"
log "Storage backup: ${LATEST_ST:+$(basename "$LATEST_ST")}"
log "Drill DB:       $(redact_url "$DRILL_DATABASE_URL")"

# 1) Create a clean drill database.
ADMIN_URL="$(printf '%s' "$DRILL_DATABASE_URL" | sed -E 's#/[^/?]+(\?|$)#/postgres\1#')"
DRILL_DB="$(printf '%s' "$DRILL_DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
ADMIN_PG_URL="$(postgres_cli_url "$ADMIN_URL")"
DRILL_PG_URL="$(postgres_cli_url "$DRILL_DATABASE_URL")"
if command -v psql >/dev/null 2>&1; then
  psql "$ADMIN_PG_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DRILL_DB}\";" >/dev/null
  psql "$ADMIN_PG_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DRILL_DB}\";" >/dev/null
  log "Created clean drill database '${DRILL_DB}'."
else
  fail "psql not found; cannot create the clean drill database."
fi

DRILL_STORAGE_TOUCHED=false
cleanup_drill() {
  psql "$ADMIN_PG_URL" -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"${DRILL_DB}\";" >/dev/null 2>&1 || true

  if [[ "$DRILL_STORAGE_TOUCHED" == "true" ]]; then
    if command -v aws >/dev/null 2>&1; then
      AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
        aws --endpoint-url "${S3_ENDPOINT:-http://localhost:9000}" \
          s3 rb "s3://${DRILL_S3_BUCKET}" --force >/dev/null 2>&1 || true
    elif command -v mc >/dev/null 2>&1; then
      mc alias set nsdrill "${S3_ENDPOINT:-http://localhost:9000}" \
        "${S3_ACCESS_KEY_ID:-}" "${S3_SECRET_ACCESS_KEY:-}" >/dev/null 2>&1 || true
      mc rm --recursive --force "nsdrill/${DRILL_S3_BUCKET}" >/dev/null 2>&1 || true
      mc rb "nsdrill/${DRILL_S3_BUCKET}" >/dev/null 2>&1 || true
    elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      local_mc_endpoint="$(docker_s3_endpoint "${S3_ENDPOINT:-http://localhost:9000}")"
      docker run --rm --add-host host.docker.internal:host-gateway \
        --entrypoint /bin/sh \
        -e "MC_ENDPOINT=${local_mc_endpoint}" \
        -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e DRILL_S3_BUCKET \
        minio/mc -c '
          mc alias set nsdrill "$MC_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
          mc rm --recursive --force "nsdrill/$DRILL_S3_BUCKET" >/dev/null 2>&1 || true
          mc rb "nsdrill/$DRILL_S3_BUCKET" >/dev/null 2>&1 || true
        ' >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup_drill EXIT

# 2) Restore PostgreSQL into the drill DB.
RESTORE_DATABASE_URL="$DRILL_DATABASE_URL" "${HERE}/restore-postgres.sh" "$LATEST_PG" "$DRILL_DATABASE_URL"

# 3) Verify: a few key tables exist and report counts.
log "Verifying restored data:"
for tbl in "User" "Track" "Upload" "Report"; do
  COUNT="$(psql "$DRILL_PG_URL" -tAc "SELECT COUNT(*) FROM \"${tbl}\";" 2>/dev/null || echo "ERR")"
  log "  ${tbl}: ${COUNT} rows"
  [[ "$COUNT" == "ERR" ]] && fail "Verification failed: table ${tbl} not restored."
done

# 4) Optionally restore storage into a drill bucket and count objects.
if [[ -n "$LATEST_ST" ]]; then
  DRILL_STORAGE_TOUCHED=true
  RESTORE_S3_BUCKET="$DRILL_S3_BUCKET" NOIRSOUND_ALLOW_PROD_RESTORE=no \
    "${HERE}/restore-storage.sh" "$LATEST_ST" "$DRILL_S3_BUCKET"

  EXPECTED_OBJECTS="$(tar -tzf "$LATEST_ST" | awk '!/\/$/ { count += 1 } END { print count + 0 }')"
  if command -v aws >/dev/null 2>&1; then
    ACTUAL_OBJECTS="$(
      AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
      aws --endpoint-url "${S3_ENDPOINT:-http://localhost:9000}" \
        s3 ls "s3://${DRILL_S3_BUCKET}" --recursive | awk 'END { print NR + 0 }'
    )"
  elif command -v mc >/dev/null 2>&1; then
    mc alias set nsdrill "${S3_ENDPOINT:-http://localhost:9000}" \
      "${S3_ACCESS_KEY_ID:-}" "${S3_SECRET_ACCESS_KEY:-}" >/dev/null 2>&1
    ACTUAL_OBJECTS="$(mc ls --recursive "nsdrill/${DRILL_S3_BUCKET}" | awk 'END { print NR + 0 }')"
  else
    MC_ENDPOINT="$(docker_s3_endpoint "${S3_ENDPOINT:-http://localhost:9000}")"
    export MC_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY DRILL_S3_BUCKET
    ACTUAL_OBJECTS="$(
      docker run --rm --add-host host.docker.internal:host-gateway \
        --entrypoint /bin/sh \
        -e MC_ENDPOINT -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e DRILL_S3_BUCKET \
        minio/mc -c '
          mc alias set nsdrill "$MC_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
          mc ls --recursive "nsdrill/$DRILL_S3_BUCKET"
        ' | awk 'END { print NR + 0 }'
    )"
  fi
  log "  object storage: ${ACTUAL_OBJECTS}/${EXPECTED_OBJECTS} objects restored"
  [[ "$ACTUAL_OBJECTS" == "$EXPECTED_OBJECTS" ]] \
    || fail "Storage verification failed: expected ${EXPECTED_OBJECTS}, found ${ACTUAL_OBJECTS}."
fi

# 5) Teardown the isolated drill targets.
cleanup_drill
trap - EXIT
log "Dropped drill database '${DRILL_DB}'."
[[ "$DRILL_STORAGE_TOUCHED" == "true" ]] && log "Removed drill bucket '${DRILL_S3_BUCKET}'."

log "=== Restore drill PASSED: backups are restorable. ==="
