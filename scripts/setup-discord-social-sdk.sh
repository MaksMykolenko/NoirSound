#!/usr/bin/env bash
set -euo pipefail

# NoirSound Connect - Discord Social SDK Setup Helper
# This script creates the standard vendor directory layout for the official Discord SDK.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_DIR="${REPO_ROOT}/vendor/discord-social-sdk"

echo "=== NoirSound Connect: Discord Social SDK Setup ==="
echo "Target directory: ${TARGET_DIR}"

mkdir -p "${TARGET_DIR}/include"
mkdir -p "${TARGET_DIR}/lib/arm64"
mkdir -p "${TARGET_DIR}/lib/x86_64"
mkdir -p "${TARGET_DIR}/bin"

cat << 'EOF' > "${TARGET_DIR}/README.md"
# Discord Social SDK Placement

Place the official Discord Social SDK files in this directory:

- `include/` -> `discord.h` and any related headers
- `lib/arm64/` -> `libdiscord_game_sdk.dylib` (macOS arm64 / Apple Silicon)
- `lib/x86_64/` -> `libdiscord_game_sdk.dylib` (macOS x86_64 / Intel)

Then set the environment variable:
export DISCORD_SOCIAL_SDK_ROOT="$(pwd)"

To verify the setup:
bash ../../scripts/verify-discord-social-sdk.sh
EOF

echo ""
echo "Directory structure created at: ${TARGET_DIR}"
echo "Please copy the official Discord Social SDK files into:"
echo "  - ${TARGET_DIR}/include/ (headers: discord.h)"
echo "  - ${TARGET_DIR}/lib/arm64/ (library: libdiscord_game_sdk.dylib)"
echo ""
echo "Run scripts/verify-discord-social-sdk.sh to verify installation."
