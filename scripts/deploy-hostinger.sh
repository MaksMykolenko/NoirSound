#!/usr/bin/env bash
# Run this on the Hostinger VPS from the checked-out NoirSound repository.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/noirsound}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
HEALTH_URL="${HEALTH_URL:-http://localhost/api/ready}"
READINESS_ATTEMPTS="${READINESS_ATTEMPTS:-60}"
READINESS_SLEEP_SECONDS="${READINESS_SLEEP_SECONDS:-3}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

sanitize_logs() {
  sed -E \
    -e 's#(postgres(ql)?://)[^@[:space:]]+@#\1***:***@#g' \
    -e 's#((password|secret|token|key|signature|credential)=)[^[:space:]&]+#\1REDACTED#gi' \
    -e 's#((password|secret|token|key|signature|credential)["'\'']?[[:space:]]*:[[:space:]]*["'\''])[^"'\'']+#\1REDACTED#gi'
}

cd "$APP_DIR" || fail "Cannot cd to APP_DIR=$APP_DIR"

[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE. Create it on the VPS from .env.production.example and fill real values first."
[[ -f "$COMPOSE_FILE" ]] || fail "Missing $COMPOSE_FILE."

if grep -Ev '^[[:space:]]*(#|$)' "$ENV_FILE" | grep -Eq 'CHANGE_ME|example\.com|__[^[:space:]]*__'; then
  fail "$ENV_FILE still contains placeholder values. Replace them before deploying."
fi

for required in DOMAIN FRONTEND_ORIGIN DATABASE_URL POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB REDIS_URL S3_ENDPOINT S3_PUBLIC_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY JWT_SECRET COOKIE_SECRET; do
  if ! grep -Eq "^${required}=" "$ENV_FILE"; then
    fail "$ENV_FILE is missing required key: $required"
  fi
done

if [[ -n "${PRODUCTION_DOMAIN:-}" ]]; then
  configured_domain="$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | tail -1)"
  [[ "$configured_domain" == "$PRODUCTION_DOMAIN" ]] || fail "PRODUCTION_DOMAIN does not match DOMAIN in $ENV_FILE."
fi

command -v docker >/dev/null 2>&1 || fail "Docker is not installed."
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is not installed."
command -v curl >/dev/null 2>&1 || fail "curl is not installed."
export APP_ENV_FILE="$ENV_FILE"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  current_commit="$(git rev-parse --short HEAD 2>/dev/null || true)"
  printf 'Deploying branch=%s commit=%s\n' "${current_branch:-unknown}" "${current_commit:-unknown}"
fi

compose=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

printf 'Validating Docker Compose production config...\n'
"${compose[@]}" config --quiet

running_services="$("${compose[@]}" ps --services --status running 2>/dev/null || true)"
if grep -Eq '^(backend|postgres|minio|worker|web)$' <<<"$running_services"; then
  printf 'Existing services detected; creating pre-deploy backup.\n'
  NOIRSOUND_ENV_FILE="${APP_DIR}/${ENV_FILE}" COMPOSE_FILE="${COMPOSE_FILE}" bash scripts/backup-all.sh || {
    printf 'Backup failed. Refusing to deploy.\n' >&2
    exit 1
  }
else
  printf 'No running NoirSound production services detected; first deployment has no live data to back up.\n'
fi

printf 'Building production images...\n'
"${compose[@]}" build

wait_for_service() {
  local service="$1"
  local cid status
  printf 'Waiting for %s health...\n' "$service"
  for _ in $(seq 1 60); do
    cid="$("${compose[@]}" ps -q "$service" 2>/dev/null || true)"
    if [[ -n "$cid" ]]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)"
      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        printf '%s is %s.\n' "$service" "$status"
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

printf 'Starting stateful dependencies...\n'
"${compose[@]}" up -d postgres redis minio
wait_for_service postgres || fail "PostgreSQL did not become healthy."
wait_for_service redis || fail "Redis did not become healthy."
wait_for_service minio || fail "MinIO did not become healthy."

printf 'Ensuring private MinIO bucket exists...\n'
"${compose[@]}" run --rm --no-deps minio-create-bucket >/dev/null

printf 'Running Prisma migrations...\n'
"${compose[@]}" run --rm --no-deps backend npx prisma migrate deploy

printf 'Starting application services...\n'
"${compose[@]}" up -d backend worker web

printf 'Waiting for readiness at %s...\n' "$HEALTH_URL"
for _ in $(seq 1 "$READINESS_ATTEMPTS"); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    printf 'Ready.\n'
    "${compose[@]}" ps
    exit 0
  fi
  sleep "$READINESS_SLEEP_SECONDS"
done

printf 'Deployment failed readiness check. Recent redacted logs follow.\n' >&2
"${compose[@]}" ps >&2 || true
"${compose[@]}" logs --no-color --tail=120 backend worker web 2>&1 | sanitize_logs >&2 || true
exit 1
