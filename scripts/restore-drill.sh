#!/usr/bin/env bash
# Restore drill: prove the latest backups can be restored into a CLEAN,
# isolated target (never touches production). Verifies row counts and object
# presence, then tears the drill targets down.
#
# Usage: scripts/restore-drill.sh
# Env:
#   DRILL_DATABASE_URL   new isolated database ending in _drill[_suffix]
#   DRILL_S3_BUCKET      new isolated bucket containing -drill[-suffix]
set -euo pipefail
HERE="$(dirname "${BASH_SOURCE[0]}")"
source "${HERE}/lib-backup-common.sh"

# A deployment supplies the freshly verified archive pair explicitly. Preserve
# it across legacy config loading so stale defaults cannot change drill evidence.
readonly DRILL_CALLER_POSTGRES_BACKUP="${DRILL_POSTGRES_BACKUP:-}"
readonly DRILL_CALLER_STORAGE_BACKUP="${DRILL_STORAGE_BACKUP:-}"
load_env
if [[ -n "$DRILL_CALLER_POSTGRES_BACKUP" ]]; then DRILL_POSTGRES_BACKUP="$DRILL_CALLER_POSTGRES_BACKUP"; fi
if [[ -n "$DRILL_CALLER_STORAGE_BACKUP" ]]; then DRILL_STORAGE_BACKUP="$DRILL_CALLER_STORAGE_BACKUP"; fi

DRILL_RUN_SUFFIX="$(date -u +%Y%m%d%H%M%S)-$$-${RANDOM}"
DRILL_DATABASE_URL="${DRILL_DATABASE_URL:-}"
DRILL_S3_BUCKET="${DRILL_S3_BUCKET:-noirsound-drill-${DRILL_RUN_SUFFIX}}"
export DRILL_S3_BUCKET

# Derive a drill DB url from DATABASE_URL if not provided (…/<db> -> …/<db>_drill).
if [[ -z "$DRILL_DATABASE_URL" && -n "${DATABASE_URL:-}" ]]; then
  DRILL_DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed -E "s#/([^/?]+)(\\?|$)#/\\1_drill_${DRILL_RUN_SUFFIX//-/_}\\2#")"
fi
: "${DRILL_DATABASE_URL:?Set DRILL_DATABASE_URL for the drill target}"
: "${DATABASE_URL:?DATABASE_URL is required to identify the live database}"
: "${S3_BUCKET:?S3_BUCKET is required to identify the live bucket}"

# Validate identifiers and separation BEFORE SQL, bucket creation, or cleanup
# registration. Even an override must never make a drill target the live data.
[[ "$DRILL_DATABASE_URL" =~ ^postgres(ql)?:// ]] || fail "Drill target must be a PostgreSQL URL."
DRILL_DB="$(printf '%s' "$DRILL_DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
LIVE_DB="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
[[ "$DRILL_DB" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ && ${#DRILL_DB} -le 63 ]] || fail "Unsafe drill database identifier."
[[ "$DRILL_DB" =~ _drill(_[a-zA-Z0-9_]+)?$ ]] || fail "Database name must identify an isolated drill target."
[[ "$DRILL_DB" != "$LIVE_DB" ]] || fail "Drill database must differ from the live database."
[[ "$DRILL_S3_BUCKET" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ && ${#DRILL_S3_BUCKET} -ge 3 && ${#DRILL_S3_BUCKET} -le 63 ]] || fail "Unsafe drill bucket identifier."
[[ "$DRILL_S3_BUCKET" =~ -drill(-[a-z0-9-]+)?$ ]] || fail "Bucket name must identify an isolated drill target."
[[ "$DRILL_S3_BUCKET" != "$S3_BUCKET" ]] || fail "Drill bucket must differ from the live bucket."
export NOIRSOUND_ALLOW_PROD_RESTORE=no

LATEST_PG="${DRILL_POSTGRES_BACKUP:-$(ls -1t "${BACKUP_DIR}"/postgres_*.dump.gz 2>/dev/null | head -1 || true)}"
LATEST_ST="${DRILL_STORAGE_BACKUP:-$(ls -1t "${BACKUP_DIR}"/storage_*.tar.gz 2>/dev/null | head -1 || true)}"
[[ -n "$LATEST_PG" ]] || fail "No PostgreSQL backup found in ${BACKUP_DIR}. Run backup-all.sh first."
[[ -n "$LATEST_ST" ]] || fail "No storage backup found; a complete drill requires both archives."
[[ -s "$LATEST_PG" && -s "$LATEST_ST" ]] || fail "Backup archives must be nonempty."
gzip -t "$LATEST_PG" || fail "PostgreSQL archive is unreadable."
tar -tzf "$LATEST_ST" >/dev/null || fail "Storage archive is unreadable."

log "=== Restore drill ==="
log "PG backup:      $(basename "$LATEST_PG")"
log "Storage backup: ${LATEST_ST:+$(basename "$LATEST_ST")}"
log "Drill DB:       $(redact_url "$DRILL_DATABASE_URL")"

# 1) Create a clean drill database.
ADMIN_URL="$(printf '%s' "$DRILL_DATABASE_URL" | sed -E 's#/[^/?]+(\?|$)#/postgres\1#')"
ADMIN_PG_URL="$(postgres_cli_url "$ADMIN_URL")"
DRILL_PG_URL="$(postgres_cli_url "$DRILL_DATABASE_URL")"
command -v psql >/dev/null 2>&1 || fail "psql not found; cannot create the clean drill database."
EXISTING_DB="$(psql "$ADMIN_PG_URL" -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_database WHERE datname = '${DRILL_DB}';")"
[[ -z "${EXISTING_DB//[[:space:]]/}" ]] || fail "Drill database already exists; it is not owned by this run."

# Preflight bucket existence before creating either resource. Listing failure
# is an error, never evidence that the target is absent.
if command -v aws >/dev/null 2>&1; then
  STORAGE_CLIENT=aws
  BUCKETS="$(AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
    aws --endpoint-url "${S3_ENDPOINT:-http://localhost:9000}" s3api list-buckets --query 'Buckets[].Name' --output text)"
elif command -v mc >/dev/null 2>&1; then
  STORAGE_CLIENT=mc
  mc alias set nsdrill "${S3_ENDPOINT:-http://localhost:9000}" "${S3_ACCESS_KEY_ID:-}" "${S3_SECRET_ACCESS_KEY:-}" >/dev/null
  BUCKETS="$(mc ls nsdrill | awk '{print $NF}' | sed 's#/$##')"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  STORAGE_CLIENT=docker
  MC_ENDPOINT="$(docker_s3_endpoint "${S3_ENDPOINT:-http://localhost:9000}")"
  export MC_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
  BUCKETS="$(docker run --rm --add-host host.docker.internal:host-gateway --entrypoint /bin/sh \
    -e MC_ENDPOINT -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY minio/mc -ec '
      mc alias set nsdrill "$MC_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
      mc ls nsdrill
    ' | awk '{print $NF}' | sed 's#/$##')"
else
  fail "No object-storage client is available for drill preflight."
fi
for bucket in $BUCKETS; do
  [[ "$bucket" != "$DRILL_S3_BUCKET" ]] || fail "Drill bucket already exists; it is not owned by this run."
done

DRILL_DATABASE_CREATED=false
DRILL_STORAGE_CREATED=false
cleanup_drill() {
  local cleanup_failed=false
  if [[ "$DRILL_DATABASE_CREATED" == "true" ]]; then
    if psql "$ADMIN_PG_URL" -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"${DRILL_DB}\";" >/dev/null 2>&1; then
      DRILL_DATABASE_CREATED=false
    else
      cleanup_failed=true
    fi
  fi

  if [[ "$DRILL_STORAGE_CREATED" == "true" ]]; then
    if command -v aws >/dev/null 2>&1; then
      if AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
        aws --endpoint-url "${S3_ENDPOINT:-http://localhost:9000}" \
          s3 rb "s3://${DRILL_S3_BUCKET}" --force >/dev/null 2>&1; then
        DRILL_STORAGE_CREATED=false
      else
        cleanup_failed=true
      fi
    elif command -v mc >/dev/null 2>&1; then
      mc alias set nsdrill "${S3_ENDPOINT:-http://localhost:9000}" \
        "${S3_ACCESS_KEY_ID:-}" "${S3_SECRET_ACCESS_KEY:-}" >/dev/null 2>&1 || true
      mc rm --recursive --force "nsdrill/${DRILL_S3_BUCKET}" >/dev/null 2>&1 || true
      if mc rb "nsdrill/${DRILL_S3_BUCKET}" >/dev/null 2>&1; then
        DRILL_STORAGE_CREATED=false
      else
        cleanup_failed=true
      fi
    elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      local_mc_endpoint="$(docker_s3_endpoint "${S3_ENDPOINT:-http://localhost:9000}")"
      if docker run --rm --add-host host.docker.internal:host-gateway \
        --entrypoint /bin/sh \
        -e "MC_ENDPOINT=${local_mc_endpoint}" \
        -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e DRILL_S3_BUCKET \
        minio/mc -ec '
          mc alias set nsdrill "$MC_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
          mc rm --recursive --force "nsdrill/$DRILL_S3_BUCKET" >/dev/null 2>&1 || true
          mc rb "nsdrill/$DRILL_S3_BUCKET" >/dev/null 2>&1
        ' >/dev/null 2>&1; then
        DRILL_STORAGE_CREATED=false
      else
        cleanup_failed=true
      fi
    else
      cleanup_failed=true
    fi
  fi
  [[ "$cleanup_failed" == false ]] || { log "Owned drill resources could not be fully removed." >&2; return 1; }
}
trap cleanup_drill EXIT

# CREATE without DROP/IF-NOT-EXISTS fails closed if another run wins a race.
psql "$ADMIN_PG_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DRILL_DB}\";" >/dev/null
DRILL_DATABASE_CREATED=true
log "Created clean drill database '${DRILL_DB}'."

# 2) Restore PostgreSQL into the drill DB.
RESTORE_DATABASE_URL="$DRILL_DATABASE_URL" "${HERE}/restore-postgres.sh" "$LATEST_PG" "$DRILL_DATABASE_URL"

# 3) Verify: a few key tables exist and report counts.
log "Verifying restored data:"
for tbl in "User" "Track" "Upload" "Report"; do
  COUNT="$(psql "$DRILL_PG_URL" -tAc "SELECT COUNT(*) FROM \"${tbl}\";" 2>/dev/null || echo "ERR")"
  log "  ${tbl}: ${COUNT} rows"
  [[ "$COUNT" == "ERR" ]] && fail "Verification failed: table ${tbl} not restored."
done

# 4) Restore storage into a new owned drill bucket and count objects.
if [[ -n "$LATEST_ST" ]]; then
  case "$STORAGE_CLIENT" in
    aws)
      AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
        aws --endpoint-url "${S3_ENDPOINT:-http://localhost:9000}" s3 mb "s3://${DRILL_S3_BUCKET}" >/dev/null
      ;;
    mc) mc mb "nsdrill/${DRILL_S3_BUCKET}" >/dev/null ;;
    docker)
      docker run --rm --add-host host.docker.internal:host-gateway --entrypoint /bin/sh \
        -e MC_ENDPOINT -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e DRILL_S3_BUCKET minio/mc -ec '
          mc alias set nsdrill "$MC_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
          mc mb "nsdrill/$DRILL_S3_BUCKET"
        ' >/dev/null
      ;;
  esac
  DRILL_STORAGE_CREATED=true
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
log "Removed drill bucket '${DRILL_S3_BUCKET}'."

log "=== Restore drill PASSED: backups are restorable. ==="
