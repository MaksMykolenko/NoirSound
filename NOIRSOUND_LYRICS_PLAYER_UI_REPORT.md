# NoirSound Lyrics Player UI Report

Date: 2026-07-05

## Player integration

`PlayerBar` now exposes a lyrics control in every active player form:

- desktop collapsed mini-player;
- desktop full player bar;
- mobile collapsed mini-player;
- mobile expanded/full player.

The control uses the existing icon system and lightweight `hasLyrics` Track flag. It is
keyboard-reachable, labeled `Lyrics`, highlighted with the active accent while open, and
disabled with a localized `Lyrics unavailable` label when the current Track has no lyrics.

## Lazy panel behavior

Opening the control mounts `LyricsPanel`, which fetches `GET /api/tracks/:id/lyrics` only when
needed. The panel shows:

- cover artwork, Track title, and artist;
- large selectable plain-text lyrics with intentional line breaks preserved;
- a persistent accessible close control;
- `Lyrics provided by the artist` attribution;
- localized loading, unavailable, empty, and retry states.

The panel is a NoirSound surface rather than a copy of Spotify's interface. Desktop uses a
layered reading panel; narrow/mobile layouts use a full-screen, scrollable view with safe-area
padding and a visible close control.

## Playback isolation

Lyrics UI state is local to the player. Opening, closing, loading, or failing to load lyrics does
not:

- invoke play or stream event endpoints;
- pause or restart audio;
- seek the current Track;
- replace or reorder the queue;
- reset shuffle/repeat state;
- change the play-count state machine.

Changing the current Track closes the previous panel. Escape closes the lyrics panel before it
affects the expanded player.

## Accessibility

The modal panel:

- has dialog semantics and an accessible label;
- traps Tab and Shift+Tab focus;
- closes with Escape;
- restores the normal player surface on close;
- keeps the close button visible;
- uses readable line height and text sizes;
- scrolls independently on mobile;
- avoids mandatory animation and respects reduced-motion styling.

Lyrics controls have screen-reader labels and disabled semantics. Track-page lyrics remain
selectable and are rendered as plain text, not interpreted markup.

## Track and data flow

Public Track objects carry only `hasLyrics` and `lyricsType` through the shared Track mapper into
`playerStore.currentTrack`, queue entries, and player controls. Full lyrics are never embedded in
the queue or normal playback payload.

After an owner/admin edit, `updateTrackMetadata` refreshes availability metadata across the
current Track, queue, original queue, and recently played items. This prevents a stale enabled or
disabled lyrics icon without refetching full lyrics globally.

## Verified states

- Track with lyrics: control enabled; panel opens and renders the artist text.
- Track without lyrics: control disabled and labeled unavailable.
- Close: playback state and queue are retained.
- UI language change: labels change; artist-provided lyric lines do not.
- Mobile: full-screen panel renders with readable text, persistent close control, and attribution.
- Public Track page: lyrics card and clean no-lyrics state render independently of the player.

## Deferred synced behavior

Plain lyrics are the shipped mode. Current-line highlighting, timing-based smooth scroll, and
synced authoring are deferred. Invalid or absent future timing data is designed to fall back to
plain text rather than block playback or lyric display.
