# NoirSound Connect (Desktop App)

**NoirSound Connect** is a lightweight desktop companion application for macOS (arm64 Apple Silicon) that broadcasts your currently playing tracks on [NoirSound](https://noirsound.co) to Discord as a **Listening to NoirSound** Rich Presence activity.

---

## Key Features

- **Menu Bar Companion**: Runs quietly in the macOS menu bar / system tray.
- **Secure Device Pairing**: Authenticates via an opaque cryptographic device code and 8-character user code.
- **Keychain Storage**: Refresh tokens are securely stored in the macOS Keychain; access tokens reside in memory only.
- **Zero Discord Credentials**: Direct Rich Presence via local Discord Desktop IPC without OAuth, Client Secrets, or Bot Tokens.
- **Dual Adapter Architecture**:
  - `DiscordSocialSdkAdapter`: Links against the official Discord Social SDK.
  - `MockDiscordPresenceAdapter`: Built-in mock mode for CI and environments without Discord Desktop running.

---

## Directory Structure

```text
desktop/noirsound-connect/
├── src/                # React + TypeScript UI
├── src-tauri/          # Rust Tauri 2 core (Keychain, Sidecar manager, WS client, Tray)
├── sidecar/            # C++ Native Discord Bridge (noirsound-discord-bridge)
└── scripts/            # Setup and verification helpers
```

---

## Development & Build Commands

### 1. Build C++ Sidecar Bridge

```bash
cd sidecar
mkdir -p build && cd build
cmake ..
cmake --build .
```

To link the official Discord Social SDK:
```bash
export DISCORD_SOCIAL_SDK_ROOT="/path/to/vendor/discord-social-sdk"
cd sidecar/build && cmake .. && cmake --build .
```

### 2. Run Desktop UI in Development

```bash
# Start frontend + Tauri dev app
npm run dev
# or full Tauri dev
npm run tauri dev
```

### 3. Build Desktop Application

```bash
npm run build
npm run tauri build
```

---

## Diagnostics & Privacy

NoirSound Connect only receives:
- Track ID
- Track Title
- Artist Name & Album Name
- Track Duration & Playhead Position
- Public Album Artwork URL
- Public Share URL (`https://noirsound.co/track/...`)

No private libraries, passwords, audio streams, or browser cookies are ever transferred to or through the desktop app.
