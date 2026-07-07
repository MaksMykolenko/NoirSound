# NoirSound Playlists + Context Menu Audit

Date: 2026-07-05

## Baseline data model

- `Playlist` already contained `id`, `name`, `description`, `coverUrl`, private `coverImageKey`, `creatorId`, optional `artistProfileId`, `isPublic`, tags, likes, and timestamps.
- `PlaylistTrack` already provided a unique `(playlistId, trackId)` key, `order`, and `addedAt`.
- `PlaylistLike` already provided a unique `(userId, playlistId)` key and timestamp. This is the persisted save/follow relation.
- The existing equivalents satisfy the requested model without a destructive or additive migration. Duplicates are intentionally disallowed.
- `backend/src/lib/publicPlaylist.js` strips the cover storage key. The public cover route also checks playlist visibility before streaming.

## Baseline API

Before this pass, `backend/src/routes/playlists.js` supported public list/detail, authenticated `/me`, and create. It did not provide the complete edit/delete, membership, reorder, save, or cover-upload lifecycle.

Global infrastructure already present:

- authenticated session middleware;
- global CSRF origin validation for cookie-authenticated mutations;
- Fastify rate-limit support;
- private storage and controlled public cover streaming.

## Baseline UI

- `PlaylistPage` showed artwork, metadata, play, and a static track list.
- `Library`, `Profile`, and the desktop sidebar rendered playlist collections.
- `CreatePlaylistModal` accepted only a name.
- `PlaylistCard` and `SidebarPlaylistItem` could navigate/play, but there was no shared action system.
- There was no custom context-menu provider and no add-to-playlist flow.

## Existing player and library behavior

- `playerStore` owns the single audio element and qualified-play tracking.
- Queue creation did not emit play events; actual playback still drives the existing 30-second/50% qualification path.
- Likes are persisted through the track API.
- Recently played is populated only after a qualified play and loaded from the real API.
- Library already separated liked tracks, recently played, playlists, and followed artists.

## Context targets identified

| Entity | Surfaces |
| --- | --- |
| Track | cards, list rows, track hero, playlist rows, liked/recent rows, player, fullscreen player, queue |
| Playlist | cards, page hero, sidebar/library rows, profile |
| Artist | cards and sidebar rows |
| Queue item | queue overlay in normal and fullscreen player |
| Native-menu exceptions | input, textarea, select, contenteditable, role=textbox, and active text selections |

## Baseline gaps addressed

- Persisted CRUD, save/follow, membership, ordering, visibility, and cover upload.
- Player source metadata, play-next, batch queue append, and accessible queue reordering.
- Shared right-click/three-dot/keyboard menu and responsive mobile action sheet.
- Reusable add-to-playlist/create-and-add modal.
- Server-authoritative permissions and stable playlist errors.

