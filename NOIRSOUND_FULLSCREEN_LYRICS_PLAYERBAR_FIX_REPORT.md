# NoirSound Fullscreen Lyrics PlayerBar Fix Report

Date: 2026-07-05

Verdict: **FULLSCREEN LYRICS PLAYERBAR PARTIAL**

The visual/mechanical consistency fix is implemented. The verdict remains partial because the complete E2E command is blocked by the unavailable local backend and production was not verified.

## Previous inconsistency

The fullscreen lyrics footer used a separate center-weighted control layout with:

- an oversized pink/purple gradient play button;
- fullscreen-only control sizes and spacing;
- no standard left-side cover/title/artist/like area;
- no standard right-side lyrics/queue/volume/close area;
- progress and volume arrangements that differed from the normal `PlayerBar`.

This made fullscreen lyrics look like a second playback product despite using the same store.

## Shared component refactor

`src/components/player/PlayerBarShared.jsx` now owns the reusable player visual primitives:

- `PlayerTrackInfo`
- `PlayerTransportControls`
- `PlayerProgress`
- `PlayerVolumeControls`
- `DesktopPlayerBarContent`
- `MobilePlayerProgress`
- `MobilePlayerTransportControls`

The normal desktop `PlayerBar` and fullscreen lyrics desktop footer both render `DesktopPlayerBarContent`. The normal expanded mobile player and fullscreen lyrics mobile footer both render the same mobile progress and transport components.

## Desktop consistency

The fullscreen footer is now the same 90px NoirSound playerbar structure:

```text
[cover + title + artist + like]
[shuffle previous play/pause next repeat + progress]
[active lyrics + queue + volume + close]
```

Track info, transport, progress, action, and play-button class sets are identical between the normal and fullscreen bars. The standard 32px white play button replaces the old fullscreen gradient button.

The lyrics action is active and closes fullscreen lyrics when selected. Queue opens above the fullscreen surface, volume uses the normal control, and the right-side close action exits fullscreen lyrics.

## Mobile consistency

- Uses the same mobile progress component as the expanded mobile player.
- Uses the same mobile shuffle/previous/64px play/next/repeat transport component.
- Keeps track info, like, active lyrics, and queue available in a compact footer row.
- Volume stays hidden, matching the constrained mobile presentation.
- Safe-area padding and independent lyrics scrolling remain.
- No horizontal overflow at 390×844 or 360×800.

## Queue integration

- `AppLayout` continues to own queue-open state.
- The normal queue is suppressed while fullscreen lyrics is active.
- Fullscreen lyrics renders the same `QueuePanel` with a fullscreen positioning variant.
- Queue z-index is 220, above the lyrics surface and below no duplicate player.
- Escape closes an open queue first; a subsequent Escape closes fullscreen lyrics.

## Playback isolation

- No second audio element was created.
- Both playerbars call the same Zustand actions.
- Play/pause uses `togglePlay`.
- Seek uses `seek`.
- Volume uses `setVolume`.
- Previous/next, shuffle, repeat, like, and queue use the existing actions/state.
- Opening/closing lyrics does not call `playTrack`, seek, reset the queue, or create a play event.
- Unit tests compare the singleton audio object before and after opening fullscreen lyrics.

## Files changed

- `src/components/player/PlayerBarShared.jsx`
- `src/components/player/PlayerBar.jsx`
- `src/components/player/FullscreenLyricsPlayer.jsx`
- `src/components/player/QueuePanel.jsx`
- `src/components/layout/AppLayout.jsx`
- `tests/components/LyricsSystem.test.jsx`
- `tests/e2e/fullscreen-lyrics-player.spec.js`
- `tests/e2e/lyrics-system.spec.js`
- `NOIRSOUND_FULLSCREEN_LYRICS_PLAYERBAR_FIX_REPORT.md`
- `NOIRSOUND_FULLSCREEN_LYRICS_PLAYERBAR_QA_REPORT.md`

## Remaining gaps

- Run the backend-dependent E2E suite with PostgreSQL, Redis, MinIO, API, and worker available.
- Deploy and manually verify on `https://noirsound.co`.

