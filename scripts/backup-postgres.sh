#!/usr/bin/env bash
# Backup the NoirSound PostgreSQL database to a compressed, timestamped dump.
# Usage: scripts/backup-postgres.sh
# Requires: pg_dump (PostgreSQL client) and DATABASE_URL.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib-backup-common.sh"

load_env
ensure_backup_dir

: "${DATABASE_URL:?DATABASE_URL is required}"

OUT="${BACKUP_DIR}/postgres_${TIMESTAMP}.dump.gz"
PARTIAL="${OUT}.partial"
trap 'rm -f "$PARTIAL"' EXIT
log "Backing up PostgreSQL ($(redact_url "$DATABASE_URL")) -> $(basename "$OUT")"
PG_URL="$(postgres_cli_url "$DATABASE_URL")"
SERVER_MAJOR="$(postgres_server_major "$PG_URL" || true)"
LOCAL_MAJOR="$(postgres_client_major pg_dump || true)"

# Custom format (-Fc) is compressed + restorable selectively; pipe through gzip
# for an extra, transport-friendly layer and a stable .gz artifact.
if [[ -n "$LOCAL_MAJOR" && ( -z "$SERVER_MAJOR" || "$LOCAL_MAJOR" == "$SERVER_MAJOR" ) ]]; then
  pg_dump --format=custom --no-owner --no-privileges "$PG_URL" | gzip -9 > "$PARTIAL"
elif [[ -n "$SERVER_MAJOR" ]] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DOCKER_PG_URL="$(docker_host_url "$PG_URL")"
  export DOCKER_PG_URL
  log "Using PostgreSQL ${SERVER_MAJOR} client container (local pg_dump major: ${LOCAL_MAJOR:-missing})."
  docker run --rm --add-host host.docker.internal:host-gateway \
    --entrypoint /bin/sh -e DOCKER_PG_URL "postgres:${SERVER_MAJOR}-alpine" \
    -c 'pg_dump --format=custom --no-owner --no-privileges "$DOCKER_PG_URL"' \
    | gzip -9 > "$PARTIAL"
else
  fail "A pg_dump client matching PostgreSQL ${SERVER_MAJOR:-unknown} is required."
fi
mv "$PARTIAL" "$OUT"
trap - EXIT

SIZE="$(du -h "$OUT" | cut -f1)"
log "PostgreSQL backup complete: $(basename "$OUT") (${SIZE})"

prune_old "postgres_*.dump.gz"
log "Done. Retention: ${RETENTION_DAYS} days."
