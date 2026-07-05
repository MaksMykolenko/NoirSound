# NoirSound Fullscreen Lyrics Player Report

Date: 2026-07-05

Verdict: **FULLSCREEN LYRICS PARTIAL**

The fullscreen lyrics implementation is complete and passes unit, focused E2E, lint, build, and local desktop/mobile browser QA. The verdict remains partial because the complete backend-dependent E2E suite could not pass without the local backend and the flow was not deployed or verified on `https://noirsound.co`.

## Old hover behavior removed

- Deleted `src/components/lyrics/LyricsPanel.jsx`.
- Removed `PlayerBar`'s local `lyricsOpen` state and track-change close effect.
- Removed the player-owned floating/backdrop panel render.
- All listener player lyrics buttons now call the shared fullscreen action.
- The track-page `TrackLyricsCard` remains independent and unchanged.

## New fullscreen player state architecture

- `playerStore` owns `lyricsFullscreenOpen`, `openLyricsFullscreen()`, and `closeLyricsFullscreen()`.
- `AppLayout` mounts `FullscreenLyricsPlayer` beside the app underlay only while fullscreen lyrics is open.
- The app underlay becomes `inert` and `aria-hidden` while the fullscreen player is active.
- `FullscreenLyricsPlayer` covers `100dvh` with fixed positioning and z-index 200.
- The existing page route remains mounted; opening lyrics does not navigate or reload the page.
- The component pushes one lightweight history state. Browser Back consumes that state and closes lyrics before leaving the route.

## Lyrics data behavior

- Lyrics are fetched lazily with `getTrackLyrics(trackId)` after fullscreen mode opens.
- Responses are cached by track ID for the current browser session.
- A track change cancels the stale request, keeps fullscreen mode open, updates metadata/cover, and loads the new track's lyrics.
- Loading, no-lyrics, and friendly error/retry states are provided.
- Raw request errors are not rendered.
- Lyrics are rendered as text with `whitespace-pre-wrap`; no HTML, Markdown, or translation is applied.
- Existing API publication/privacy enforcement remains the source of truth. No backend or visibility rules were changed.

## Desktop UX

- Dedicated dark NoirSound surface with wine/pink/purple atmosphere and blurred cover treatment.
- Cover and track context occupy a separate desktop column.
- Lyrics use a large independent scroll region.
- Bottom controls reuse progress, seek, shuffle, previous, play/pause, next, repeat, and volume actions.
- The old player bar remains inert and fully covered instead of appearing as a second player.

## Mobile UX

- Full `100dvh` viewport with safe-area padding.
- Persistent top back control and current-track metadata.
- Lyrics receive the main scrollable region.
- Compact progress and primary playback controls remain pinned and reachable.
- Desktop-only secondary controls and volume are removed from the mobile visual layout.
- Local QA found no horizontal overflow at 390×844 or 360×800.

## Playback isolation proof

- No second `<audio>` element was added.
- Opening and closing lyrics only changes `lyricsFullscreenOpen`.
- The fullscreen controls call the existing store's `togglePlay`, `previous`, `next`, `seek`, `setVolume`, `toggleShuffle`, and `toggleRepeat`.
- Opening/closing never calls `playTrack`, resets progress, changes the queue, seeks, or emits a play event.
- Unit tests assert `isPlaying` and progress are preserved across open/close.

## Back, Escape, and focus behavior

- Close and Escape remove fullscreen state and consume the lyrics history entry.
- Browser Back closes lyrics while preserving the current route.
- A second Back retains normal browser behavior.
- Body scrolling and overscroll are locked while open and restored on close.
- Focus moves to Close, is trapped among visible fullscreen controls, and returns to the invoking lyrics button.
- Reduced-motion users do not receive the entry animation.

## Files changed

- `src/components/layout/AppLayout.jsx`
- `src/components/player/PlayerBar.jsx`
- `src/components/player/FullscreenLyricsPlayer.jsx`
- `src/components/player/fullscreenLyricsCache.js`
- `src/components/lyrics/LyricsPanel.jsx` (removed)
- `src/store/playerStore.js`
- `src/index.css`
- `src/i18n/locales/en/common.json`
- `src/i18n/locales/uk/common.json`
- `src/i18n/locales/pl/common.json`
- `src/i18n/locales/ru/common.json`
- `tests/components/LyricsSystem.test.jsx`
- `tests/e2e/lyrics-system.spec.js`
- `tests/e2e/fullscreen-lyrics-player.spec.js`
- `NOIRSOUND_FULLSCREEN_LYRICS_PLAYER_REPORT.md`
- `NOIRSOUND_FULLSCREEN_LYRICS_QA_REPORT.md`

## Remaining gaps

- Re-run the complete backend-dependent E2E suite with PostgreSQL, Redis, MinIO, API, and audio worker available.
- Deploy and manually verify the published-track flow on `https://noirsound.co`.
- Synced line highlighting remains intentionally deferred until trustworthy synced timing data exists.

