#!/usr/bin/env bash
# Shared helpers for NoirSound backup/restore scripts.
# Sourced by the other scripts. Never prints secrets.
set -euo pipefail

NOIRSOUND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${NOIRSOUND_BACKUP_DIR:-${NOIRSOUND_ROOT}/backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RETENTION_DAYS="${NOIRSOUND_BACKUP_RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
NOIRSOUND_LOADED_ENV_FILE=""

log()  { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail() { printf '[%s] ERROR: %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; exit 1; }

# Load env without echoing values. Prefers an explicit env, then backend/.env.
load_env() {
  local env_file="${NOIRSOUND_ENV_FILE:-${NOIRSOUND_ROOT}/backend/.env}"
  if [[ -f "$env_file" ]]; then
    NOIRSOUND_LOADED_ENV_FILE="$env_file"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    log "Loaded environment from $(basename "$(dirname "$env_file")")/$(basename "$env_file") (values not shown)"
  else
    log "No env file at $env_file; relying on the current environment."
  fi
}

compose_file_path() {
  if [[ "$COMPOSE_FILE" = /* ]]; then
    printf '%s' "$COMPOSE_FILE"
  else
    printf '%s/%s' "$NOIRSOUND_ROOT" "$COMPOSE_FILE"
  fi
}

compose_available() {
  command -v docker >/dev/null 2>&1 || return 1
  docker compose version >/dev/null 2>&1 || return 1
  [[ -f "$(compose_file_path)" ]] || return 1
}

compose_args() {
  printf '%s\n' "-f" "$(compose_file_path)"
  if [[ -n "$NOIRSOUND_LOADED_ENV_FILE" ]]; then
    printf '%s\n' "--env-file" "$NOIRSOUND_LOADED_ENV_FILE"
  fi
}

# Redact a connection string for logs: keep scheme + host + db, hide credentials.
redact_url() {
  printf '%s' "$1" | sed -E 's#(://)[^@/]*@#\1***:***@#'
}

# Prisma accepts `?schema=public`; PostgreSQL CLI/libpq tools do not. Remove
# only that Prisma-specific query parameter and preserve other connection args.
postgres_cli_url() {
  printf '%s' "$1" \
    | sed -E 's/([?&])schema=[^&]*&?/\1/; s/\?&/?/; s/[?&]$//'
}

# Containers cannot reach the host through localhost. Docker Desktop and
# host-gateway expose the portable host.docker.internal alias.
docker_host_url() {
  printf '%s' "$1" \
    | sed -E \
      -e 's#(://)(localhost|127\.0\.0\.1)(:|/)#\1host.docker.internal\3#' \
      -e 's#(@)(localhost|127\.0\.0\.1)(:|/)#\1host.docker.internal\3#'
}

# Backwards-compatible name used by the storage scripts.
docker_s3_endpoint() { docker_host_url "$1"; }

url_host() {
  printf '%s' "$1" | sed -E 's#^[[:alpha:]][[:alnum:]+.-]*://([^/@]+@)?([^/:?#]+).*#\2#'
}

postgres_server_major() {
  local url
  url="$(postgres_cli_url "$1")"
  command -v psql >/dev/null 2>&1 || return 1
  local version_num
  version_num="$(psql "$url" -tAc 'SHOW server_version_num;' 2>/dev/null | tr -d '[:space:]')"
  [[ "$version_num" =~ ^[0-9]+$ ]] || return 1
  printf '%s' "$((version_num / 10000))"
}

postgres_client_major() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || return 1
  "$command_name" --version | sed -E 's/.* ([0-9]+).*/\1/'
}

ensure_backup_dir() { mkdir -p "$BACKUP_DIR"; }

prune_old() {
  local pattern="$1"
  find "$BACKUP_DIR" -maxdepth 1 -name "$pattern" -type f -mtime "+${RETENTION_DAYS}" -print -delete 2>/dev/null || true
}
