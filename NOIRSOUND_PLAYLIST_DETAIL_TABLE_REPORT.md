# NoirSound Playlist Detail Table Report

Date: 2026-07-07

## Data model decision

No Prisma migration was required. `PlaylistTrack.addedAt` already existed; `Track.durationSeconds`, `explicit`, `genre`, `status`, `isPublic`, and `albumId` already existed. A real "release" fallback is derived from the existing `Track.batchItem -> UploadBatchItem.batch -> UploadBatch.playlist` relation instead of the `Album` model, which remains unused in production data today (see the Phase 1 audit).

## Backend delivered

- New pure helper module `backend/src/lib/playlistTrackView.js`: `isTrackAvailable`, `resolveAlbumRelease`, `sanitizeTrackForSerialization`, `buildPlaylistTrackEntry`.
- `GET /api/playlists/:id` and `POST /api/playlists/:id/tracks` now return, per track: `playlistTrackId`, `position`, `addedAt`, `addedBy` (the playlist owner — only owners/admins can add today), `artistName`/`artistId`, `albumTitle`/`albumId`, `releaseTitle`/`releasePlaylistId`, `coverUrl`, `durationSeconds`, `explicit`, `genre`, `isLiked`, `hasLyrics`, `status`, `isAvailable`.
- Playlist-level payload adds `trackCount`, `durationSeconds` (summed from raw rows so the total never changes based on who is viewing), `isOwner`/`canEdit`/`canReorder`/`isSaved`, `visibility`.
- `trackInclude` was extended to fetch `album`, `batchItem.batch.playlist`, and `artist.user.status` — the last one only to compute availability server-side; `sanitizeTrackForSerialization` strips it before any response leaves the server.

## Album / release fallback logic

Three tiers, in order: real `Track.album.title` (shown, never linked — no album page exists anywhere in the app); otherwise the title of the `UploadBatch` playlist the track was published through, linked, but only if that release playlist is public or the viewer owns/administers it (private release playlists never leak their name to a stranger); otherwise `"Single"`. Nothing is fabricated.

## Date added and duration

- `addedAt` is the real `PlaylistTrack.addedAt`, formatted with `formatDate(..., { month: 'short', day: 'numeric', year: 'numeric' })`.
- Per-row duration uses `formatDuration`, extended to roll over to `h:mm:ss` at or above one hour (unchanged below that).
- New `formatDurationLong` renders the playlist header total as "X hr Y min" or "X min Y sec" (e.g. "12 tracks, 40 min 30 sec").

## Frontend delivered

- Playlist page header: cover, "Playlist" type label, title, description, owner link, visibility badge, track count, total duration, save count, updated date, Play / Shuffle / Add to queue / Save (or Edit, for owners) / Share / More buttons, with a `PlaylistCoverArt` component that falls back to a 2x2 collage of the first tracks with covers, or a single gradient placeholder if fewer than two exist.
- New `src/components/playlists/PlaylistTrackTable.jsx`: desktop `<table>` with `# | Title | Album | Date added | Duration | Actions` columns, plus a parallel mobile row list (cover, title, artist • album, like, more) — both render in the DOM simultaneously and switch visibility purely via Tailwind breakpoints, so there is one data path for both layouts.
- Hover-to-play per row, active-row highlight (`aria-current`), click title/artist/album to navigate, like toggle, inline reorder (owner, custom order only) and remove (owner, confirmed via a new `RemoveTrackDialog` mirroring the existing delete-playlist dialog).
- Lightweight client-side sort (title/artist/album/date added/duration) with reorder disabled and a visible explanation whenever sorted by anything other than custom order — sorting is presentational only and does not persist.
- The shared `TrackListItem.jsx` (used by Library/Profile/Search/Artist) was left untouched; this is a separate component.

## Player and context menu integration

- Clicking a row's play control starts the queue from that row using the already-loaded, currently displayed (sorted) track order, filtered to available tracks, via the existing `usePlayerStore` (`playTrack`/`togglePlay`), matching the app's one player convention.
- The existing context-menu system (`useTrackContextMenu`, `usePlaylistContextMenu`, `buildTrackContextActions`, `buildPlaylistContextActions`) already covered nearly every required action; reorder/remove were wired in as owner-only, order-aware entries. No new context-menu component was built.
- The like button reads/writes `usePlayerStore().likedTracks`, the same client-side mechanism every other track surface already uses, rather than introducing a second source of truth.

## Unavailable / private track handling

An `isAvailable: false` row (computed server-side from track status/visibility) renders only an "unavailable" placeholder cell with no title, artist, cover, album, date, duration, play, or like control — the same for owners and strangers, since the backend is what decides whether to even send those fields, not the component. `sanitizeTrackForSerialization` guarantees a hidden track's real data never reaches an unauthorized client in the first place.

## Accessibility

Semantic `<table>`/`<th scope="col">`, `role="menu"`/`"menuitem"` context menus (pre-existing, reused), keyboard-reachable reorder/remove/like/more controls with `aria-label`s that include the track title (e.g. "Play {title} from here", "Move {title} up", "More actions for {title}"), `aria-current="true"` plus screen-reader-only "Currently playing" text on the active row, and focus-visible rings on rows and buttons. Reorder remains button-based (no drag), so there is no keyboard-inaccessible drag interaction to provide an alternative for.

## i18n

26 new keys added under the existing `playlists.*` namespace (reusing `trackPage.like/unlike` and `contextMenu.*` where an equivalent already existed) across `en`, `uk`, `pl`, and `ru`. All four locale files were validated to parse as JSON.

## Mock / demo mode parity

`src/api/mock/playlists.js` now synthesizes `playlistTrackId`, `position`, `addedAt` (deterministic, not wall-clock-relative), `addedBy`, `isAvailable: true`, and `isLiked` (matching the player store's own mock-mode seed) for every track, and `addTrackToPlaylist` returns the same enriched shape the real API does. The demo catalogue has no album or batch-release data, so it honestly renders "Single" for every track rather than inventing album names.

## Product / scope choices

- Sorting is presentational-only per track; no new backend sort/persistence was added (explicitly allowed to be scoped down).
- `addedBy` is derived from `playlist.creator` rather than a new schema field, since only owners/admins can add tracks today.
- `isLiked` was added to the API payload for completeness, but the UI intentionally keeps reading the existing client-side `likedTracks` store rather than switching to the new field, to avoid diverging from every other track surface in one pass.
