#!/usr/bin/env bash
# Deploy only an already verified, exact commit to the existing production stack.
set -euo pipefail
umask 077
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
APP_DIR="${APP_DIR:-/opt/noirsound/NoirSound}"
cd "$APP_DIR" || fail 'Production checkout is unavailable.'
APP_DIR="$(pwd -P)"
[[ "${RELEASE_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fail 'RELEASE_SHA must be the verified 40-character commit SHA.'
[[ "$(git rev-parse HEAD)" == "$RELEASE_SHA" ]] || fail 'HEAD does not match RELEASE_SHA.'
LOCK_PATH="$(git rev-parse --path-format=absolute --git-path noirsound-deploy.lock)"
command -v flock >/dev/null || fail 'flock is required for the deployment lock.'
# The SSH workflow holds this same descriptor across fetch, checkout and deploy.
if [[ "$(readlink /proc/self/fd/9 2>/dev/null || true)" != "$LOCK_PATH" ]]; then exec 9>"$LOCK_PATH"; fi
flock -n 9 || fail 'Another deployment holds the checkout lock.'
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || fail 'Refusing a dirty production checkout.'
[[ "$(git rev-parse HEAD)" == "$RELEASE_SHA" ]] || fail 'Checkout changed while acquiring deployment lock.'

ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.production.yml}"
[[ "$ENV_FILE" = /* && -f "$ENV_FILE" ]] || fail 'ENV_FILE must be an existing absolute path.'
[[ "$COMPOSE_FILE" = /* && -f "$COMPOSE_FILE" ]] || fail 'COMPOSE_FILE must be an existing absolute path.'
# Read only literal deployment settings; never source the production environment
# here or expand its values as shell code. Existing backup helpers load that file.
file_setting() {
  local value
  value="$(sed -n "s/^${1}=//p" "$ENV_FILE" | tail -1)"
  if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; fi
  printf '%s' "$value"
}
setting() {
  local value="${!1:-}"
  if [[ -n "$value" ]]; then printf '%s' "$value"; else file_setting "$1"; fi
}
configured_project="$(file_setting COMPOSE_PROJECT_NAME)"
if [[ -n "$configured_project" && -n "${COMPOSE_PROJECT_NAME:-}" && "$configured_project" != "$COMPOSE_PROJECT_NAME" ]]; then
  fail 'Caller and production environment specify conflicting Compose projects; backup and application must use the same project.'
fi
COMPOSE_PROJECT_NAME="$(setting COMPOSE_PROJECT_NAME)"
OFFSITE_BACKUP_VERIFY_SCRIPT="$(setting OFFSITE_BACKUP_VERIFY_SCRIPT)"
[[ "$COMPOSE_PROJECT_NAME" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'Set the verified existing COMPOSE_PROJECT_NAME explicitly.'
[[ "$OFFSITE_BACKUP_VERIFY_SCRIPT" = /* && -f "$OFFSITE_BACKUP_VERIFY_SCRIPT" && -x "$OFFSITE_BACKUP_VERIFY_SCRIPT" ]] || fail 'A configured trusted private offsite verifier is required; no default provider is supplied.'
for required in DOMAIN FRONTEND_ORIGIN DATABASE_URL POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB REDIS_URL S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY JWT_SECRET COOKIE_SECRET; do
  grep -Eq "^${required}=.+" "$ENV_FILE" || fail "Production environment is missing required key: $required"
done
if grep -Ev '^[[:space:]]*(#|$)' "$ENV_FILE" | grep -Eq 'CHANGE_ME|example\.com|__[^[:space:]]*__'; then fail 'Production environment contains placeholders.'; fi
if [[ -n "${PRODUCTION_DOMAIN:-}" ]]; then [[ "$(setting DOMAIN)" == "$PRODUCTION_DOMAIN" ]] || fail 'Production domain does not match the environment.'; fi
for command_name in docker curl sha256sum gzip tar python3; do command -v "$command_name" >/dev/null || fail "Required command unavailable: $command_name"; done
python3 - "$OFFSITE_BACKUP_VERIFY_SCRIPT" <<'PY' || fail 'Offsite verifier must be an operator-owned regular executable, not a symlink or group/world-writable file.'
import os, pathlib, sys
try:
    path = pathlib.Path(sys.argv[1])
    trusted = path.is_absolute() and path.is_file() and not path.is_symlink() and os.access(path, os.X_OK) and path.stat().st_uid == os.geteuid() and path.stat().st_mode & 0o022 == 0
except OSError:
    trusted = False
sys.exit(0 if trusted else 1)
PY
# A hook selected from the file must also reach backup-all's own trusted verifier.
export COMPOSE_PROJECT_NAME APP_ENV_FILE="$ENV_FILE" NOIRSOUND_ENV_FILE="$ENV_FILE" COMPOSE_FILE RELEASE_SHA OFFSITE_BACKUP_VERIFY_SCRIPT
compose=(docker compose --project-name "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
"${compose[@]}" config --quiet
# This is an update of an existing stack. Missing/unhealthy dependencies never
# turn into an automatic first-install or stateful-service recreation path.
for service in postgres redis minio backend worker web; do
  cid="$("${compose[@]}" ps -q "$service")"
  [[ -n "$cid" && "$cid" != *$'\n'* ]] || fail "Expected exactly one existing $service container."
  [[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$cid")" == "$COMPOSE_PROJECT_NAME" ]] || fail "Compose project mismatch for $service."
  [[ "$(docker inspect -f '{{.State.Status}}' "$cid")" == running ]] || fail "$service is not running."
  case "$service" in postgres|redis|minio) [[ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$cid")" == healthy ]] || fail "$service is not healthy." ;; esac
done

RECORD_ROOT="${DEPLOY_RECORD_DIR:-$(dirname "$APP_DIR")/release-records}"
[[ "$RECORD_ROOT" = /* ]] || fail 'DEPLOY_RECORD_DIR must be absolute.'
mkdir -p "$RECORD_ROOT"
RECORD_DIR="$(mktemp -d "$RECORD_ROOT/${RELEASE_SHA}-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
BACKUP_RUN_DIR="$RECORD_DIR/backup"
mkdir "$BACKUP_RUN_DIR"
export NOIRSOUND_BACKUP_DIR="$BACKUP_RUN_DIR"
printf 'release_sha=%s\nprevious_checkout_sha=%s\ncompose_project=%s\n' "$RELEASE_SHA" "${PREVIOUS_PRODUCTION_SHA:-unknown}" "$COMPOSE_PROJECT_NAME" > "$RECORD_DIR/release.txt"
for service in backend worker web; do
  cid="$("${compose[@]}" ps -q "$service")"
  image_id="$(docker inspect -f '{{.Image}}' "$cid")"
  [[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "Cannot preserve previous $service image identity."
  printf '%s %s\n' "$service" "$image_id" >> "$RECORD_DIR/previous-images.txt"
done

# Keep raw operational output private on the VPS: it can contain object names
# or addresses. Never stream these logs to GitHub Actions or the public report.
bash scripts/backup-all.sh > "$RECORD_DIR/backup.log" 2>&1 || fail 'Backup failed; application images and services were not changed.'
shopt -s nullglob
pg_archives=("$BACKUP_RUN_DIR"/postgres_*.dump.gz)
storage_archives=("$BACKUP_RUN_DIR"/storage_*.tar.gz)
[[ ${#pg_archives[@]} == 1 && ${#storage_archives[@]} == 1 ]] || fail 'Backup must produce one fresh archive pair in this run directory.'
pg_name="${pg_archives[0]##*/}"
[[ "$pg_name" =~ ^postgres_([0-9]{8}T[0-9]{6}[0-9a-f]{8}Z)\.dump\.gz$ ]] || fail 'PostgreSQL backup has no recognized run reference.'
backup_reference="${BASH_REMATCH[1]}"
[[ "${storage_archives[0]##*/}" == "storage_${backup_reference}.tar.gz" ]] || fail 'PostgreSQL and storage archives must belong to the same backup run.'
# The backup's manifest_<reference>.offsite.txt receipt is a valid sibling;
# derive the integrity manifest from the exact pair instead of a broad *.txt glob.
manifest="$BACKUP_RUN_DIR/manifest_${backup_reference}.txt"
for file in "${pg_archives[@]}" "${storage_archives[@]}" "$manifest"; do [[ -f "$file" && ! -L "$file" && -s "$file" ]] || fail 'Backup artifact must be a nonempty regular file, not a symlink.'; done
gzip -t "${pg_archives[0]}" || fail 'PostgreSQL archive is unreadable.'
tar -tzf "${storage_archives[0]}" >/dev/null || fail 'Storage archive is unreadable.'
(cd "$BACKUP_RUN_DIR" && sha256sum "$(basename "${pg_archives[0]}")" "$(basename "${storage_archives[0]}")" "$(basename "$manifest")" > SHA256SUMS)
NOIRSOUND_RESTORE_TEST=1 DRILL_POSTGRES_BACKUP="${pg_archives[0]}" DRILL_STORAGE_BACKUP="${storage_archives[0]}" DRILL_MANIFEST="$manifest" bash scripts/restore-drill.sh > "$RECORD_DIR/restore-drill.log" 2>&1 || fail 'Isolated restore drill failed; deployment stopped.'
CHECKSUM_SHA256="$(sha256sum "$BACKUP_RUN_DIR/SHA256SUMS" | awk '{print $1}')"
RECEIPT="$RECORD_DIR/offsite-receipt.txt"
# Trusted operator-installed adapter: copy these exact files to the existing
# private offsite system, independently read/hash the remote copies, then attest.
"$OFFSITE_BACKUP_VERIFY_SCRIPT" "$BACKUP_RUN_DIR" "$BACKUP_RUN_DIR/SHA256SUMS" "$RECEIPT" > "$RECORD_DIR/offsite.log" 2>&1 || fail 'Private offsite verification failed; deployment stopped.'
[[ -s "$RECEIPT" ]] || fail 'Offsite verifier did not produce a receipt.'
[[ "$(wc -l < "$RECEIPT" | tr -d '[:space:]')" == 6 ]] || fail 'Offsite receipt must contain exactly six contract fields.'
for expected in 'version=1' "release_sha=$RELEASE_SHA" "checksum_sha256=$CHECKSUM_SHA256" 'offsite_verified=true' 'private_storage_verified=true'; do
  [[ "$(grep -Fxc "$expected" "$RECEIPT" || true)" == 1 ]] || fail 'Offsite receipt is missing or does not match this backup and release.'
done
[[ "$(grep -Ec '^backup_reference=[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' "$RECEIPT" || true)" == 1 ]] || fail 'Offsite receipt needs one non-sensitive backup reference.'
(cd "$BACKUP_RUN_DIR" && sha256sum -c SHA256SUMS >/dev/null) || fail 'Local backup changed during verification.'
[[ "$(sha256sum "$BACKUP_RUN_DIR/SHA256SUMS" | awk '{print $1}')" == "$CHECKSUM_SHA256" ]] || fail 'Checksum manifest changed during verification.'
[[ -z "$(git status --porcelain --untracked-files=all)" && "$(git rev-parse HEAD)" == "$RELEASE_SHA" ]] || fail 'Release source changed during prerequisite checks.'

BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export GIT_SHA="$RELEASE_SHA" BUILD_DATE
OVERRIDE="$RECORD_DIR/release-images.yml"
printf 'services:\n' > "$OVERRIDE"
for service in backend worker web; do
  cat >> "$OVERRIDE" <<IMAGE
  $service:
    image: ${COMPOSE_PROJECT_NAME}-${service}:${RELEASE_SHA}
    build:
      args:
        GIT_SHA: "$RELEASE_SHA"
        BUILD_DATE: "$BUILD_DATE"
      labels:
        org.opencontainers.image.revision: "$RELEASE_SHA"
        org.opencontainers.image.created: "$BUILD_DATE"
        org.opencontainers.image.source: "https://github.com/MaksMykolenko/NoirSound"
IMAGE
done
release_compose=("${compose[@]}" -f "$OVERRIDE")
DEPLOY_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'deploy_started_at=%s\n' "$DEPLOY_STARTED_AT" >> "$RECORD_DIR/release.txt"
record_failure() {
  local result=$?
  trap - EXIT
  if [[ "$result" != 0 ]]; then
    "${compose[@]}" logs --no-color --since "$DEPLOY_STARTED_AT" --tail=2000 backend worker web > "$RECORD_DIR/failure-services.log" 2>&1 || true
  fi
  exit "$result"
}
trap record_failure EXIT
"${release_compose[@]}" build --build-arg "GIT_SHA=$RELEASE_SHA" --build-arg "BUILD_DATE=$BUILD_DATE" backend worker web
for service in backend worker web; do
  image="${COMPOSE_PROJECT_NAME}-${service}:${RELEASE_SHA}"
  [[ "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" == "$RELEASE_SHA" ]] || fail "New $service image has the wrong release identity."
  [[ "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.created"}}' "$image")" == "$BUILD_DATE" ]] || fail "New $service image has the wrong build date."
  [[ "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.source"}}' "$image")" == "https://github.com/MaksMykolenko/NoirSound" ]] || fail "New $service image has the wrong source."
  image_id="$(docker image inspect -f '{{.Id}}' "$image")"
  printf '%s %s\n' "$service" "$image_id" >> "$RECORD_DIR/new-images.txt"
done
# Verify packaged inputs using the new image without connecting to the database.
"${release_compose[@]}" run --rm --no-deps --pull never backend node -e '
  const fs = require("fs");
  for (const file of ["prisma/schema.prisma", "prisma/migrations/20260827120000_add_track_content_type_and_beats/migration.sql", "prisma/migrations/20260829120000_add_discover_trending_index/migration.sql", "src/shared/musicGenres.json"]) {
    if (!fs.statSync(file).isFile()) throw new Error("Required release input missing: " + file);
  }
' > "$RECORD_DIR/image-inputs.log" 2>&1 || fail 'New backend image lacks required schema, migrations, or shared taxonomy.'
# Fail closed on pending/failed/divergent history. Pending SQL needs separate
# exact-release review before any schema change; this release expects no new SQL.
"${release_compose[@]}" run --rm --no-deps --pull never backend npx prisma migrate status > "$RECORD_DIR/migrate-status.log" 2>&1 || fail 'Migration preflight requires explicit SQL/history review; no migration or application update applied.'
# The override pins this one-off migration container to the NEW backend image.
"${release_compose[@]}" run --rm --no-deps --pull never backend npx prisma migrate deploy > "$RECORD_DIR/migrate.log" 2>&1 || fail 'Migration failed; application services were not updated. Inspect private migration evidence.'
"${release_compose[@]}" up -d --no-deps --no-build backend worker web
HEALTH_URL="https://$(setting DOMAIN)/api/ready"
[[ "$HEALTH_URL" =~ ^https://[a-zA-Z0-9.-]+/api/ready$ ]] || fail 'Invalid canonical HTTPS health URL.'
READINESS_ATTEMPTS="${READINESS_ATTEMPTS:-60}"
READINESS_SLEEP_SECONDS="${READINESS_SLEEP_SECONDS:-3}"
[[ "$READINESS_ATTEMPTS" =~ ^[1-9][0-9]*$ && "$READINESS_SLEEP_SECONDS" =~ ^[0-9]+$ ]] || fail 'Invalid readiness retry settings.'
ready=false
for ((attempt=0; attempt<READINESS_ATTEMPTS; attempt++)); do
  http_status="$(curl --connect-timeout 5 --max-time 10 -sS -o "$RECORD_DIR/readiness.json" -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || true)"
  if [[ "$http_status" == 200 ]] && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("status")=="ready" and all(d.get("checks",{}).get(k)=="ok" for k in ["database","redis","storage"]) else 1)' "$RECORD_DIR/readiness.json"; then ready=true; break; fi
  sleep "$READINESS_SLEEP_SECONDS"
done
[[ "$ready" == true ]] || fail 'Readiness failed after application update; preserve evidence and assess compatible application rollback.'
while read -r service expected_image; do
  cid="$("${release_compose[@]}" ps -q "$service")"
  [[ "$(docker inspect -f '{{.Image}}' "$cid")" == "$expected_image" ]] || fail "$service is not running the verified release image."
  [[ "$(docker inspect -f '{{.State.Status}}' "$cid")" == running ]] || fail "$service failed to remain running."
  [[ "$(docker inspect -f '{{.RestartCount}}' "$cid")" == 0 ]] || fail "$service restarted after this update."
  [[ "$(docker inspect -f '{{.State.OOMKilled}}' "$cid")" == false ]] || fail "$service was OOM killed."
done < "$RECORD_DIR/new-images.txt"
"${release_compose[@]}" exec -T worker node -e 'const cp=require("node:child_process");for(const bin of ["ffmpeg","ffprobe"])cp.execFileSync(bin,["-version"],{stdio:"ignore",timeout:5000});
const Redis=require("ioredis");const r=new Redis(process.env.REDIS_URL,{lazyConnect:true,connectTimeout:5000,commandTimeout:5000,maxRetriesPerRequest:1,enableOfflineQueue:false,retryStrategy:()=>null});
r.on("error",()=>{});
const deadline=setTimeout(()=>{r.disconnect();process.exit(1)},10000);
(async()=>{try{await r.connect();if(await r.ping()!=="PONG")process.exitCode=1}catch{process.exitCode=1}finally{clearTimeout(deadline);r.disconnect()}})()' > "$RECORD_DIR/worker-readiness.log" 2>&1 || fail 'Worker readiness failed.'
printf 'Release %s is running; backup, drill and trusted offsite receipts are in the private release record. Live functional smoke remains required.\n' "$RELEASE_SHA"
