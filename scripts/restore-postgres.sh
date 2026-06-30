#!/usr/bin/env bash
# Restore a NoirSound PostgreSQL dump into a target database.
# Usage: scripts/restore-postgres.sh <backup-file.dump.gz> [TARGET_DATABASE_URL]
# Safety: refuses to restore into a URL whose db name is not clearly a
# restore/test target unless NOIRSOUND_ALLOW_PROD_RESTORE=yes is set.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib-backup-common.sh"

load_env

BACKUP_FILE="${1:?Usage: restore-postgres.sh <backup-file.dump.gz> [TARGET_DATABASE_URL]}"
TARGET_URL="${2:-${RESTORE_DATABASE_URL:-${DATABASE_URL:-}}}"
: "${TARGET_URL:?Provide a target DATABASE_URL (arg 2 or RESTORE_DATABASE_URL)}"
[[ -f "$BACKUP_FILE" ]] || fail "Backup file not found: $BACKUP_FILE"

DB_NAME="$(printf '%s' "$TARGET_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
if [[ ! "$DB_NAME" =~ (test|restore|drill|staging|local) ]] && [[ "${NOIRSOUND_ALLOW_PROD_RESTORE:-no}" != "yes" ]]; then
  fail "Refusing to restore into '${DB_NAME}'. Set NOIRSOUND_ALLOW_PROD_RESTORE=yes to override (DANGEROUS)."
fi

log "Restoring $(basename "$BACKUP_FILE") -> $(redact_url "$TARGET_URL")"
PG_TARGET_URL="$(postgres_cli_url "$TARGET_URL")"
SERVER_MAJOR="$(postgres_server_major "$PG_TARGET_URL" || true)"
LOCAL_MAJOR="$(postgres_client_major pg_restore || true)"
# --clean --if-exists drops existing objects first so the restore is repeatable.
if [[ -n "$LOCAL_MAJOR" && ( -z "$SERVER_MAJOR" || "$LOCAL_MAJOR" == "$SERVER_MAJOR" ) ]]; then
  gunzip -c "$BACKUP_FILE" | pg_restore --clean --if-exists --no-owner --no-privileges \
    --dbname "$PG_TARGET_URL" 2>&1 | sed '/password/Id'
elif [[ -n "$SERVER_MAJOR" ]] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DOCKER_PG_URL="$(docker_host_url "$PG_TARGET_URL")"
  export DOCKER_PG_URL
  log "Using PostgreSQL ${SERVER_MAJOR} client container (local pg_restore major: ${LOCAL_MAJOR:-missing})."
  gunzip -c "$BACKUP_FILE" \
    | docker run --rm -i --add-host host.docker.internal:host-gateway \
      --entrypoint /bin/sh -e DOCKER_PG_URL "postgres:${SERVER_MAJOR}-alpine" \
      -c 'pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$DOCKER_PG_URL"' \
      2>&1 | sed '/password/Id'
else
  fail "A pg_restore client matching PostgreSQL ${SERVER_MAJOR:-unknown} is required."
fi

log "PostgreSQL restore complete into '${DB_NAME}'."
