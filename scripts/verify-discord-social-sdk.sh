#!/usr/bin/env bash
set -euo pipefail

# NoirSound Connect - Discord Social SDK Verification Helper

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SDK_ROOT="${DISCORD_SOCIAL_SDK_ROOT:-${REPO_ROOT}/vendor/discord-social-sdk}"

echo "=== NoirSound Connect: Discord Social SDK Verification ==="
echo "Checking SDK root: ${SDK_ROOT}"

HEADER_FOUND=false
LIB_FOUND=false

if [[ -f "${SDK_ROOT}/include/discord.h" ]] || [[ -f "${SDK_ROOT}/include/discord_game_sdk.h" ]]; then
    HEADER_FOUND=true
    echo "[✓] Headers found in ${SDK_ROOT}/include/"
else
    echo "[✗] Missing headers in ${SDK_ROOT}/include/ (expected discord.h)"
fi

if [[ -f "${SDK_ROOT}/lib/arm64/libdiscord_game_sdk.dylib" ]] || [[ -f "${SDK_ROOT}/lib/libdiscord_game_sdk.dylib" ]] || [[ -f "${SDK_ROOT}/lib/libdiscord_social_sdk.dylib" ]]; then
    LIB_FOUND=true
    echo "[✓] macOS arm64 dynamic library found"
else
    echo "[✗] Missing macOS arm64 library in ${SDK_ROOT}/lib/ or ${SDK_ROOT}/lib/arm64/"
fi

echo "---------------------------------------------------------"
if [[ "${HEADER_FOUND}" == "true" && "${LIB_FOUND}" == "true" ]]; then
    echo "STATUS: SUCCESS. Official Discord Social SDK is ready for native build."
    echo "You can build the native bridge with:"
    echo "  export DISCORD_SOCIAL_SDK_ROOT=\"${SDK_ROOT}\""
    echo "  cd desktop/noirsound-connect/sidecar && mkdir -p build && cd build && cmake .. && make"
    exit 0
else
    echo "STATUS: BLOCKED / NOT CONFIGURED."
    echo ""
    echo "Expected location: ${SDK_ROOT}"
    echo "Instructions:"
    echo "1. Obtain official Discord Social SDK package from Discord Developer Portal."
    echo "2. Extract headers into: ${SDK_ROOT}/include/"
    echo "3. Extract libdiscord_game_sdk.dylib into: ${SDK_ROOT}/lib/arm64/"
    echo "4. Export DISCORD_SOCIAL_SDK_ROOT=\"${SDK_ROOT}\""
    echo ""
    echo "Note: NoirSound Connect will automatically run with MockDiscordPresenceAdapter for CI/Mock mode."
    exit 1
fi
