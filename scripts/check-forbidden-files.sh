#!/usr/bin/env bash
# Fail when Git-visible files contain deploy-forbidden secrets or artifacts.
# This script prints file names only; it never prints matching secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

failures=()
candidate_file="$(mktemp)"
scan_file="$(mktemp)"
trap 'rm -f "$candidate_file" "$scan_file"' EXIT
git ls-files --cached --others --exclude-standard >"$candidate_file"

is_allowed_env_template() {
  case "$1" in
    .env.example|.env.production.example|*/.env.example|*/.env.production.example)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

add_failure() {
  failures+=("$1")
}

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    .env|*/.env|.env.*|*/.env.*)
      if ! is_allowed_env_template "$path"; then
        add_failure "forbidden env file: $path"
      fi
      ;;
    *.pem|*.key|*.p12)
      add_failure "private key/certificate file: $path"
      ;;
    backups/*|*/backups/*|backup/*|*/backup/*|dumps/*|*/dumps/*|minio-data/*|*/minio-data/*|minio_dump/*|*/minio_dump/*)
      add_failure "backup/dump/object-store artifact: $path"
      ;;
    *.dump|*.dump.gz|*.bak|*.backup|*.tar.gz|*.tgz)
      add_failure "backup/archive artifact: $path"
      ;;
    *.sql)
      if [[ "$path" != backend/prisma/migrations/*/migration.sql && "$path" != backend/docker/postgres/init-test-db.sql ]]; then
        add_failure "database dump or ad-hoc SQL file: $path"
      fi
      ;;
    *.log)
      add_failure "log file: $path"
      ;;
  esac
done <"$candidate_file"

secret_pattern='-----BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{30,}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}'
while IFS= read -r path; do
  if [[ -f "$path" ]] && grep -I -l -E "$secret_pattern" "$path" >>"$scan_file" 2>/dev/null; then
    add_failure "potential secret material in: $path"
  fi
done <"$candidate_file"

rm -f "$candidate_file" "$scan_file"
trap - EXIT

if ((${#failures[@]} > 0)); then
  printf 'Forbidden files or secret material detected:\n' >&2
  printf ' - %s\n' "${failures[@]}" >&2
  exit 1
fi

printf 'Forbidden-file scan passed.\n'
