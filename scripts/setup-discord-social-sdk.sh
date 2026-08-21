#!/usr/bin/env bash
set -euo pipefail

# NoirSound Connect - Discord Social SDK Setup Helper
# Supports both discord_partner_sdk.framework and traditional include/lib packaging

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_DIR="${REPO_ROOT}/vendor/discord-social-sdk"

echo "=== NoirSound Connect: Discord Social SDK Setup ==="
echo "Target directory: ${TARGET_DIR}"

mkdir -p "${TARGET_DIR}/include"
mkdir -p "${TARGET_DIR}/lib/arm64"
mkdir -p "${TARGET_DIR}/lib/x86_64"

cat << 'EOF' > "${TARGET_DIR}/README.md"
# Discord Social / Partner SDK Placement

Place the official Discord SDK in this directory using either format:

### Option A: macOS Framework (Current official package)
- Place `discord_partner_sdk.framework` directly inside this directory (`vendor/discord-social-sdk/discord_partner_sdk.framework`).

### Option B: Traditional Headers & Library
- `include/` -> `discordpp.h` or `discord.h`
- `lib/arm64/` -> `libdiscord_game_sdk.dylib` or `libdiscord_partner_sdk.dylib` (Apple Silicon arm64)

Then verify the setup:
./scripts/verify-discord-social-sdk.sh
EOF

echo ""
echo "Directory structure created at: ${TARGET_DIR}"
echo "Please copy the official Discord SDK package into: ${TARGET_DIR}"
echo "Run scripts/verify-discord-social-sdk.sh to verify."
