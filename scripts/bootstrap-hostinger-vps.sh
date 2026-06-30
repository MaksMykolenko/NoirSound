#!/usr/bin/env bash
# Prepare a fresh Ubuntu Hostinger VPS for NoirSound. Run as root or a sudo user.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/noirsound}"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-$USER}}"
GIT_REPO_URL="${GIT_REPO_URL:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SSH_PORT="${SSH_PORT:-22}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ -z "$GIT_REPO_URL" ]]; then
  fail "Set GIT_REPO_URL to your GitHub repository URL before running this script."
fi

if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

printf 'Updating packages and installing base tools...\n'
$SUDO apt-get update
$SUDO apt-get upgrade -y
$SUDO apt-get install -y ca-certificates curl git ufw docker.io docker-compose-plugin

printf 'Enabling Docker...\n'
$SUDO systemctl enable --now docker
$SUDO usermod -aG docker "$DEPLOY_USER" || true

printf 'Configuring firewall for SSH, HTTP, and HTTPS...\n'
$SUDO ufw allow "${SSH_PORT}/tcp"
$SUDO ufw allow 80/tcp
$SUDO ufw allow 443/tcp
$SUDO ufw --force enable

printf 'Preparing app directory %s...\n' "$APP_DIR"
$SUDO mkdir -p "$APP_DIR"
$SUDO chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  printf 'Repository already exists; fetching latest metadata.\n'
  git -C "$APP_DIR" fetch --tags origin
else
  git clone --branch "$GIT_BRANCH" "$GIT_REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  cp .env.production.example .env.production
  chmod 600 .env.production
  printf 'Created .env.production from the template. Edit it now with real production values.\n'
else
  chmod 600 .env.production
  printf '.env.production already exists; leaving it untouched.\n'
fi

printf '\nNext steps:\n'
printf '  1. Edit %s/.env.production and replace every placeholder.\n' "$APP_DIR"
printf '  2. Generate secrets with: openssl rand -hex 32\n'
printf '  3. Ensure DNS points to this VPS.\n'
printf '  4. Run: APP_DIR=%s scripts/deploy-hostinger.sh\n' "$APP_DIR"
printf '\nMinIO, PostgreSQL, and Redis are not exposed publicly by docker-compose.production.yml.\n'
