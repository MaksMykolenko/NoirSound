# NoirSound Playlists Implementation Report

Date: 2026-07-05

## Data model decision

No Prisma migration was required. Existing `Playlist`, `PlaylistTrack`, and `PlaylistLike` models provide metadata, private/public visibility, stable ordering, a duplicate-preventing composite key, save/follow uniqueness, and cascade behavior.

## API delivered

- `GET /api/playlists` — lightweight public list with viewer-specific saved state.
- `GET /api/playlists/me` — own playlists plus saved public playlists.
- `POST /api/playlists` — create with title/description/visibility validation.
- `GET /api/playlists/:id` — ordered detail; private access limited to owner/admin.
- `PATCH /api/playlists/:id` — owner/admin metadata and visibility changes.
- `DELETE /api/playlists/:id` — owner/admin deletion.
- `POST /api/playlists/:id/tracks` — owner/admin add, published/streamable-only, duplicate and 1000-track limits.
- `DELETE /api/playlists/:id/tracks/:trackId` — remove and normalize positions.
- `PATCH /api/playlists/:id/tracks/reorder` — validates the complete unique track set.
- `POST|DELETE /api/playlists/:id/save` — idempotent persisted save/follow and safe counter updates.
- `POST /api/playlists/:id/cover/init|complete` — verified JPEG/PNG/WebP upload, maximum 5 MB.

All mutation routes require authentication, use the project rate-limit pattern, and are covered by the global CSRF plugin.

## UI delivered

- Create modal: title, description, public/private.
- Edit modal: title, description, visibility, validated cover upload.
- Delete alert dialog with explicit confirmation.
- Playlist page: artwork, owner link when available, visibility, track count, duration, updated date, saves, play, shuffle, queue, save, share, edit, visibility toggle, remove and reorder.
- Lightweight playlist cards/sidebar rows lazy-load detail only when play, shuffle, or queue actions need tracks.
- Library/Profile/sidebar refresh through a scoped `noirsound:playlists-changed` event after persisted mutations.
- Reusable `AddToPlaylistModal`: search, already-added state, add, and inline create-and-add.
- Empty, loading, unavailable, and private states.

## Player and queue

- A playlist can start from the first playable track or any clicked track.
- Shuffle skips unavailable tracks.
- `queueSource` carries `{ type: "playlist", id, name }`.
- `originalQueue` remains intact for shuffle restoration.
- `playNext`, duplicate-safe `addTracksToQueue`, and queue move-up/down were added.
- Queue construction does not fabricate play events; the existing qualified playback path is unchanged.

## Product choices

- Duplicate playlist tracks are disallowed.
- `isPublic` remains the visibility model; `UNLISTED` was not introduced.
- Keyboard move-up/down is the supported reorder mechanism instead of pointer-only drag.
- External playlist links are disabled for private playlists.
