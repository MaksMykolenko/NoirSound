#!/usr/bin/env bash
set -euo pipefail

# NoirSound Connect - Discord Social SDK Verification Helper

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SDK_ROOT="${DISCORD_SOCIAL_SDK_ROOT:-${REPO_ROOT}/vendor/discord-social-sdk}"

echo "=== NoirSound Connect: Discord Social SDK Verification ==="
echo "Checking SDK directory: ${SDK_ROOT}"

FRAMEWORK_FOUND=false
HEADER_FOUND=false
LIB_FOUND=false

if [[ -d "${SDK_ROOT}/discord_partner_sdk.framework" ]] || [[ -d "${SDK_ROOT}/DiscordPartnerSDK.framework" ]]; then
    FRAMEWORK_FOUND=true
    echo "[✓] macOS Framework found (discord_partner_sdk.framework)"
fi

if [[ -f "${SDK_ROOT}/include/discordpp.h" ]] || [[ -f "${SDK_ROOT}/include/discord.h" ]] || [[ -f "${SDK_ROOT}/include/discord_game_sdk.h" ]]; then
    HEADER_FOUND=true
    echo "[✓] C++ Headers found in ${SDK_ROOT}/include/"
fi

if [[ -f "${SDK_ROOT}/lib/arm64/libdiscord_game_sdk.dylib" ]] || [[ -f "${SDK_ROOT}/lib/arm64/libdiscord_partner_sdk.dylib" ]] || [[ -f "${SDK_ROOT}/lib/libdiscord_game_sdk.dylib" ]] || [[ -f "${SDK_ROOT}/lib/libdiscord_partner_sdk.dylib" ]]; then
    LIB_FOUND=true
    echo "[✓] macOS arm64 dynamic library found in ${SDK_ROOT}/lib/"
fi

echo "---------------------------------------------------------"
if [[ "${FRAMEWORK_FOUND}" == "true" ]] || [[ "${HEADER_FOUND}" == "true" && "${LIB_FOUND}" == "true" ]]; then
    echo "STATUS: SUCCESS. Official Discord Social SDK is ready for native build."
    echo "To build with Real SDK:"
    echo "  export DISCORD_SOCIAL_SDK_ROOT=\"${SDK_ROOT}\""
    echo "  export NOIRSOUND_DISCORD_REQUIRE_REAL_SDK=1"
    echo "  cd desktop/noirsound-connect/sidecar && mkdir -p build && cd build && cmake .. && make"
    exit 0
else
    echo "STATUS: BLOCKED: Discord Social SDK package not present locally."
    echo ""
    echo "Expected location: ${SDK_ROOT}"
    echo "Instructions:"
    echo "1. Go to Discord Developer Portal (https://discord.com/developers/applications/1540281435296895066)"
    echo "2. Navigate to: Discord Social SDK -> Downloads -> macOS -> latest release"
    echo "3. Extract the downloaded package into: ${SDK_ROOT}/"
    echo "   (Either as discord_partner_sdk.framework OR include/ and lib/arm64/)"
    echo "4. Re-run: ./scripts/verify-discord-social-sdk.sh"
    echo ""
    echo "Note: Development and test modes can run with MockDiscordPresenceAdapter in the meantime."
    exit 1
fi
