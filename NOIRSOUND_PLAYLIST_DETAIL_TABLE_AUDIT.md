# NoirSound Playlist Detail Table — Audit

Date: 2026-07-07

## Scope

Audit of the playlist detail view ahead of a Spotify-mechanics (not Spotify-visual) upgrade: track table with title/artist/album/date-added/duration/like/actions, current-track highlighting, context menu, owner reorder/remove, and mobile layout.

## Schema (backend/prisma/schema.prisma)

No migration is required for this pass. Everything the target payload needs already exists on the current schema:

| Need | Field | Status |
| --- | --- | --- |
| Date added | `PlaylistTrack.addedAt` (`DateTime @default(now())`) | Already exists |
| Position | `PlaylistTrack.order` | Already exists |
| Duration | `Track.durationSeconds` (plus legacy `Track.duration`) | Already exists |
| Artist link | `Track.artistId` → `ArtistProfile` → `User` | Already linked |
| Explicit badge | `Track.explicit` (Boolean) | Already exists |
| Lyrics flag | Derived by `backend/src/lib/lyrics.js` `hasLyrics()` | Already exists |
| Track status/visibility | `Track.status` (enum), `Track.isPublic` | Already exists |
| Like (viewer-specific) | `TrackLike` (`userId`, `trackId`) unique | Model exists, not joined into playlist detail today |
| Album | `Album` model + `Track.albumId` | Model exists in schema **but is never written or read anywhere in the app** (`grep -rn "Album" backend/src src` returns zero matches outside `schema.prisma`). No route ever creates an `Album` row. |
| "Added by" | — | **Does not exist as a column.** `POST /:id/tracks` requires `ownedPlaylist(...)`, i.e. only the playlist owner (or an admin) can ever add a track. `addedBy` is therefore always the playlist owner; there is no collaborative-playlist concept to justify a new column. Decision: derive `addedBy` from `playlist.creator` rather than add a DB column. |

Because `Album` is unused, the JSON contract's `albumTitle`/`albumId` will be `null` for effectively every real track today. A second, real "release" signal already exists in the schema and is **not** in the original spec's field list: `Track.batchItem → UploadBatchItem.batch → UploadBatch.playlist`. When a track was published as part of a multi-track batch release (`UploadBatchItem.target === 'PLAYLIST'`), that batch's generated `Playlist` is effectively the track's "release." This is used to implement the requested fallback chain: **album title → originating release playlist title → "Single."**

## Backend serialization (backend/src/routes/playlists.js, lib/publicTrack.js, lib/publicPlaylist.js)

`serializePlaylist()` **already** returns nearly all of the requested playlist-level metadata: `trackCount`, `durationSeconds` (summed), `createdAt`, `updatedAt`, `isOwner`, `isSaved`, `canEdit`, `canDelete`, `canReorder`, `visibility`, `likes`, `tags`, `coverUrl`/`hasCoverImage`, `creator`/`owner`, `ownerArtistId`. Nothing is missing at the playlist level.

Per-track rows currently return: `id` (composite `${playlistId}:${trackId}`), `playlistId`, `trackId`, `position`, `order`, `addedAt`, `track: serializePublicTrack(track)`.

Gaps found:

- `trackInclude` only fetches `artist.user.{displayName,username,avatarUrl}`. It does not fetch `album` or `batchItem.batch.playlist`, so album/release cannot be resolved yet.
- No viewer-specific like lookup is performed for playlist tracks (`TrackLike` is never joined), so there is no per-track `isLiked` in the API response today. The **actual working like state in the UI** does not come from the API at all — see "Current-track / like detection" below.
- **Real gap, not cosmetic:** the playlist detail route enforces playlist-level visibility (private playlist → 403/404 for non-owners) but performs **no per-track availability check**. If a track inside an otherwise-public playlist is later unpublished, hidden, made private, or its artist is suspended, the row is still served with full title/artist/cover/stream data to any visitor. This directly conflicts with the stated requirement "Do NOT show unavailable/private tracks to users who should not see them" and is fixed in this pass (Phase 2/10 below), not just documented.
- `serializePublicTrack` does not strip `track.artist` sub-fields at all (no allow-list) — `artist.isHidden`, `artist.monthlyListeners`, etc. already pass through today for every track endpoint in the app, not just playlists. That is a pre-existing, app-wide characteristic, out of scope for this pass; it is called out here only so it isn't confused with something new. This pass does **not** newly expose `artist.user.status` (a more sensitive moderation field) anywhere in the client-visible response — availability is computed server-side from a raw query result and then discarded, never spread into the payload.

## Frontend mapping (src/api/mappers/playlistMapper.js, trackMapper.js)

- `playlistMapper.js` builds **two separate arrays** from the same backend `tracks` payload: `tracks` (via `mapTrackResponse(entry.track)`, used everywhere for rendering) and `trackEntries` (id/trackId/position/addedAt). **`trackEntries` is computed and then never read anywhere else in the codebase** (confirmed by grep). In effect, `addedAt` and per-entry position are already fetched from the backend today but are silently discarded before they reach any component. This is the main reason "Date added" isn't visible today — the data reaches the frontend API layer and is then dropped, not a missing backend field.
- `trackMapper.js`'s primary branch constructs a brand-new object (no spread of `backendTrack`), so any new backend field (`explicit`, `albumTitle`, `isAvailable`, `isLiked`, etc.) is silently dropped unless explicitly added to that object.

## Playlist page / track rows (src/pages/PlaylistPage.jsx, src/components/tracks/TrackListItem.jsx)

- `PlaylistPage.jsx` renders each row via the **shared** `TrackListItem` component (`src/components/tracks/TrackListItem.jsx`), which is also used by liked songs, recently played, search, and artist pages. It is a compact single-line row (index/play toggle, cover, title, artist, genre pill, plays, duration, like, queue, more), **not** a table, and has no album or date-added column, no owner reorder affordance, and no unavailable-track state.
- Reorder today is **buttons only** (`ArrowUp`/`ArrowDown` icon buttons rendered by `PlaylistPage.jsx` next to each row), not drag-and-drop. This was a deliberate product decision from the prior playlists pass ("Keyboard move-up/down is the supported reorder mechanism instead of pointer-only drag" — `NOIRSOUND_PLAYLISTS_IMPLEMENTATION_REPORT.md`). This pass preserves that decision rather than introducing drag-and-drop.
- Remove-from-playlist exists (`handleRemove`) but fires immediately with **no confirmation step**, unlike playlist deletion (which has `DeletePlaylistDialog`). The spec's requested `playlist.removeTrackConfirm` string implies a confirm step is wanted now; this pass adds one, mirroring the existing delete-playlist dialog pattern.
- Since `TrackListItem` is shared across many surfaces, it is **not** modified in this pass (regression risk to Library/Profile/Search/etc.). A new `PlaylistTrackTable.jsx` is added specifically for the playlist detail page instead.

## Current track / like detection (src/store/playerStore.js)

- Current track: `currentTrack` and `isPlaying` are already exposed on `usePlayerStore`; `TrackListItem` already compares `currentTrack?.id === track.id` for highlighting and swaps in an animated equalizer/pause icon. The new table reuses this exact pattern (kept for visual/behavioral consistency).
- Like state: the working source of truth is **`player.likedTracks` (a client-side array of track IDs)**, toggled via `player.toggleLikeTrack(id)` — not a per-track API field. `TrackListItem` and `contextMenuActions.js` both compute `isLiked` this way. A backend `isLiked` field is added to the playlist payload in this pass (useful, additive, and needed for the JSON contract), but the UI continues to read `player.likedTracks` for the actual like button, to stay behaviorally identical to every other track surface in the app. Note (pre-existing, not touched by this pass): in real-API mode `likedTracks` starts empty on load and is only populated by toggling during the session — it is not hydrated from the backend on app start. This is a known, pre-existing limitation, out of scope here.

## Context menu (src/hooks/useEntityContextMenu.js, src/components/context-menu/contextMenuActions.js, ContextMenu.jsx)

The shared context-menu system is already extensive and directly reusable — most of Phase 8 is **already implemented**, not new:

- `buildTrackContextActions` already supports: play/pause, play next, add to queue, add to playlist, like/unlike, contextual remove-from-playlist, contextual move up/down, go to track, go to artist, open lyrics, share, copy link.
- `buildPlaylistContextActions` already supports: play, shuffle, add to queue, save/remove from library, open, edit, make public/private, delete, share, copy link.
- Right-click, Shift+F10, and a three-dot button all route through the same `useContextMenu`/`ContextMenu.jsx`, with native-menu exceptions for inputs/textareas/contenteditable/text selection already in place.
- **Not present today:** a "Report" action for tracks or playlists in the context menu. The prior context-menu pass explicitly scoped this out ("Known matrix limits" in `NOIRSOUND_CONTEXT_MENU_SYSTEM_REPORT.md`). This pass keeps that same scope boundary (a full report-reason flow is a separate feature) and documents it again as a remaining gap rather than half-building it.
- Missing/added in this pass: wiring the already-existing `moveUp`/`moveDown` options from the new table into `useTrackContextMenu` (the hook already accepts them; `PlaylistPage.jsx`'s old per-row arrow buttons never passed them into the menu, only rendered separate arrow buttons).

## Environment constraints found (affects Phase 14 execution, not the implementation)

- No Docker and no Postgres are available in this sandbox (`docker: command not found`). `backend/tests/runTests.js` requires a live Postgres (`DATABASE_URL_TEST`) and runs `prisma migrate reset`. DB-backed backend integration tests and Playwright end-to-end specs (which skip via `backendUp()` when the API isn't reachable) cannot be executed to completion here — this matches the previous playlists pass's own QA report, which hit the same limitation.
- What **can** run here and is used for real, executed verification: frontend Vitest (jsdom, mocked API), `oxlint`, `vite build`, and a new dependency-free backend unit test for the pure album/release/availability logic (extracted into a small, DB-free module specifically so it is testable without Postgres).
- There is currently **no frontend component test file for the playlist page at all** (`tests/components/` has no `PlaylistPage`/`Playlist*` test; only `tests/e2e/playlists-context-menu.spec.js` covers playlists, and only for context-menu/CRUD, not the track table). This pass adds one.

## Naming decision: `playlist.*` vs `playlists.*` i18n keys

The existing i18n files use a `playlists` (plural) namespace throughout (`playlists.edit`, `playlists.share`, `playlists.tracksCount`, …). The requested key list in Phase 13 is written as `playlist.xxx` (singular). To avoid fragmenting the translation file into two inconsistent namespaces, every requested key is added under the existing `playlists.*` namespace instead (e.g. `playlist.titleColumn` → `playlists.columnTitle`), and reused directly where an equivalent key already exists (e.g. `playlist.trackCount` → existing `playlists.tracksCount`; `playlist.moveUp`/`moveDown` → existing `contextMenu.moveUp`/`moveDown`). The full mapping is in the implementation report.

## Summary of what changes vs what's reused

| Area | Verdict |
| --- | --- |
| Playlist-level metadata (count/duration/owner/permissions) | Already complete — reused as-is |
| Per-track `addedAt` | Fetched by backend, dropped by frontend mapper — **fixed**, not newly built |
| Duration | Already available — formatting extended for h:mm:ss and a long "min sec" form |
| Album/release | No real album usage exists; a genuine "release" fallback is derived from the existing batch→playlist relation |
| Current-track detection | Already works via `playerStore` — reused unchanged |
| Row context menu | Already exists and covers nearly everything needed — reused, with move up/down newly wired in |
| Reorder mechanism | Buttons only (deliberate prior decision) — preserved, not changed to drag-and-drop |
| Per-track privacy/availability | **Real gap** — not filtered today; fixed in this pass |
