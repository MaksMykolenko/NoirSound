#!/usr/bin/env bash
# Production smoke checks. Usage: DOMAIN=https://noirsound.co scripts/smoke-production.sh
set -euo pipefail

DOMAIN="${DOMAIN:-}"
S3_BUCKET="${S3_BUCKET:-noirsound-audio}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -n "$DOMAIN" ]] || fail "Set DOMAIN, for example: DOMAIN=https://noirsound.co scripts/smoke-production.sh"
BASE="${DOMAIN%/}"

status_code() {
  curl -sS -o /dev/null -w '%{http_code}' "$1"
}

expect_2xx() {
  local url="$1"
  local code
  code="$(status_code "$url")" || fail "Could not connect to $url"
  case "$code" in
    2*) printf 'OK %s -> %s\n' "$url" "$code" ;;
    *) fail "$url returned HTTP $code" ;;
  esac
}

expect_not_5xx() {
  local url="$1"
  local code
  code="$(status_code "$url")" || fail "Could not connect to $url"
  case "$code" in
    5*) fail "$url returned HTTP $code" ;;
    *) printf 'OK %s -> %s\n' "$url" "$code" ;;
  esac
}

expect_2xx "$BASE/"
expect_2xx "$BASE/terms"
expect_2xx "$BASE/privacy"
expect_2xx "$BASE/copyright"
expect_2xx "$BASE/upload"
expect_2xx "$BASE/api/ready"

mode_body="$(curl -fsS "$BASE/api/mode")"
if ! grep -Eq '"apiMode"[[:space:]]*:[[:space:]]*"real"' <<<"$mode_body"; then
  fail "/api/mode did not report real API mode."
fi
if ! grep -Eq '"mock"[[:space:]]*:[[:space:]]*false' <<<"$mode_body"; then
  fail "/api/mode did not report mock=false."
fi
printf 'OK %s/api/mode -> real API mode\n' "$BASE"

storage_code="$(status_code "$BASE/$S3_BUCKET/")" || fail "Could not connect to anonymous storage route."
case "$storage_code" in
  401|403) printf 'OK anonymous storage route is denied -> %s\n' "$storage_code" ;;
  404) printf 'OK anonymous storage route is not listable -> %s\n' "$storage_code" ;;
  *) fail "Anonymous storage route returned HTTP $storage_code; expected 401/403/404." ;;
esac

expect_not_5xx "$BASE/api/health"

if [[ "${SMOKE_REGISTER:-false}" == "true" ]]; then
  : "${SMOKE_EMAIL:?SMOKE_EMAIL is required when SMOKE_REGISTER=true}"
  : "${SMOKE_PASSWORD:?SMOKE_PASSWORD is required when SMOKE_REGISTER=true}"
  SMOKE_USERNAME="${SMOKE_USERNAME:-smoke_$(date +%s)}"
  SMOKE_DISPLAY_NAME="${SMOKE_DISPLAY_NAME:-Production Smoke}"
  case "${SMOKE_EMAIL}${SMOKE_PASSWORD}${SMOKE_USERNAME}${SMOKE_DISPLAY_NAME}" in
    *\"*|*\\*)
      fail "Smoke credentials cannot contain quotes or backslashes."
      ;;
  esac
  cookie_jar="$(mktemp)"
  trap 'rm -f "$cookie_jar"' EXIT
  payload="$(printf '{"email":"%s","password":"%s","username":"%s","displayName":"%s"}' "$SMOKE_EMAIL" "$SMOKE_PASSWORD" "$SMOKE_USERNAME" "$SMOKE_DISPLAY_NAME")"
  register_code="$(curl -sS -o /dev/null -w '%{http_code}' -c "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    "$BASE/api/auth/register")"
  case "$register_code" in
    200|400) printf 'OK register smoke path returned %s\n' "$register_code" ;;
    *) fail "Register smoke path returned HTTP $register_code" ;;
  esac
  login_payload="$(printf '{"email":"%s","password":"%s"}' "$SMOKE_EMAIL" "$SMOKE_PASSWORD")"
  login_code="$(curl -sS -o /dev/null -w '%{http_code}' -b "$cookie_jar" -c "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -d "$login_payload" \
    "$BASE/api/auth/login")"
  case "$login_code" in
    200) printf 'OK login smoke path returned %s\n' "$login_code" ;;
    *) fail "Login smoke path returned HTTP $login_code" ;;
  esac
else
  printf 'Skipping register/login smoke path. Set SMOKE_REGISTER=true with test credentials to enable it.\n'
fi

printf 'Production smoke checks passed.\n'
