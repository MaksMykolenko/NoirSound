# NoirSound Context Menu System Report

Date: 2026-07-05

## Architecture

- `ContextMenuProvider` owns one global menu instance and the reusable add-to-playlist flow.
- `useContextMenu` supplies right-click, Shift+F10, context-menu-key, and shared three-dot handlers.
- `contextMenuActions.js` is the centralized permission/context-aware action matrix.
- Entity hooks bind player, navigation, toast, localization, and modal controllers to the pure builders.
- The menu is rendered through a portal.

## Interaction

- Desktop: fixed pointer/button anchor with right/bottom collision clamping.
- Mobile (<=640px): safe-area-aware bottom action sheet.
- Keyboard: Arrow Up/Down, Home/End, Enter/Space, and Escape.
- Focus returns to the invoker.
- Escape is captured at `window` while a menu is open, so it closes before queue/fullscreen lyrics handlers.
- Async items show a spinner; disabled and dangerous states are distinct.

## Native browser exceptions

The custom menu is attached only to supported entities; there is no global `contextmenu` cancellation. It explicitly preserves native behavior for:

- input, textarea, select;
- contenteditable and `role=textbox`;
- any active non-collapsed text selection.

This covers search, lyrics/admin/upload metadata fields, and editable text.

## Z-index contract

| Layer | z-index |
| --- | ---: |
| Fullscreen lyrics | 200 |
| Fullscreen queue | 220 |
| Context backdrop/menu | 225/230 |
| Add-to-playlist modal | 240 |
| Playlist edit modal | 250 |
| Delete confirmation | 260 |

## Target/action matrix

| Target | Actions implemented |
| --- | --- |
| Track | play/pause, play next, queue, add to playlist, like, track, artist, lyrics, share/copy; contextual remove |
| Playlist | play, shuffle, queue, save/remove, open, edit, public/private on owner page, delete, share/copy |
| Artist | open, follow/unfollow where card state is available, share/copy |
| Queue item | play, play next, remove, move up/down, add to playlist, like, track/artist, lyrics, share/copy |
| Player current track | same track actions in normal, mobile, collapsed, and fullscreen surfaces |
| Library/profile/sidebar | entity-specific track, playlist, and artist actions |

Three-dot buttons call the same builders as right-click. On mobile card three-dot affordances remain visible.

## Known matrix limits

- Report and owner/admin track moderation actions remain in their existing explicit UI controls rather than the shared menu.
- Artist “play top tracks” is not exposed because the card payload does not contain an authoritative top-track queue.
- No touch long-press gesture was added; mobile uses the safer visible three-dot action sheet.

