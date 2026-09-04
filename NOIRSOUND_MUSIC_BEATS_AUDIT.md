# NoirSound Music / Beats Audit

Audit date: 2026-08-27

## Scope and safety boundary

This audit covers the current NoirSound track, upload, discovery, profile, library, player, playlist, statistics, moderation, API-mapping, mock-data, and localization paths needed to add a first-class `Music` / `Beats` split. The implementation is additive: existing uploads and tracks must continue to behave as Music, Beats remain ordinary playable `Track` records, and no licensing or payment transaction is introduced.

The checkout contained unrelated, pre-existing uncommitted work when this pass started. That work is preserved. This pass does not reset, clean, stash, commit, push, or deploy the repository.

## Current Track model

`backend/prisma/schema.prisma` defines one `Track` model for every playable item. Before this pass it included:

- identity and catalog fields: `id`, `title`, optional `slug`, `artistId`, `coverUrl`, `genre`, `tags`, `description`, and release timestamps;
- playback fields: legacy `duration`, `durationSeconds`, waveform JSON, original/processed audio keys, MIME type, and size;
- publication and moderation fields: `status`, `isPublic`, `explicit`, copyright confirmation, and publication timestamps;
- engagement fields: denormalized `plays` and `likes`, plus `TrackLike`, `PlayEvent`, comments, and playlist relations;
- optional lyrics fields, including plain/synced types and rights confirmation.

There was no content-type field and no beat-specific metadata. `genre` is a normalized music-taxonomy value and therefore cannot safely represent the Music/Beat product boundary.

Conclusion: the schema needs an additive migration. A `TrackContentType` enum with `MUSIC` as the database default is appropriate for the existing PostgreSQL/Prisma stack. Optional beat fields can live on `Track`; no separate Beat table or player entity is needed.

## Current upload metadata

Single upload is implemented by `backend/src/routes/uploads.js` and the frontend `UploadForm` flow. It validates title, normalized genre, tags, rights confirmation, audio metadata, optional cover metadata, and optional lyrics. It creates a draft `Track`, an `Upload`, then hands the object to the existing processing pipeline.

Multi-upload is implemented separately by `backend/src/routes/uploadBatches.js` and persists per-item draft metadata in `UploadBatchItem`. The publish path creates or updates ordinary `Track` records from each item. The frontend uses `BatchUploadPage`, `BatchTrackTable`, `BatchTrackSettingsDrawer`, and the batch upload API modules.

Required integration seams:

- accept optional `contentType` on old and new single-upload payloads, defaulting missing values to `MUSIC`;
- validate optional beat metadata without making it mandatory for Beats;
- add the same fields to `UploadBatchItem`, its serializers, patch validation, review UI, and `trackDataFromItem` publication mapping;
- retain copyright and lyrics validation; Beat selection must not weaken upload permissions or rights confirmation.

## Current genre and filter system

Genres use the canonical English-only taxonomy in `backend/src/constants/musicGenres.js` and `src/constants/musicGenres.js`. Backend uploads normalize a submitted genre; frontend labels are localized through genre-label helpers while stored taxonomy keys remain stable.

Discover currently filters the loaded track collection by genre group/key and free-text search. This confirms that Beats must be an independent `contentType` filter layered above genre/style rather than a new genre value. Beat style can be stored as optional plain text while the existing genre field remains available for catalog compatibility.

## Current discovery and search structure

There is no `backend/src/routes/discover.js`. `GET /api/tracks` is the public discovery feed, currently limited to published, public tracks from active, visible artists and ordered by publication date. The frontend `getDiscoverTracks()` delegates to that endpoint, and Discover performs genre/search presentation filtering locally.

Required integration seams:

- add an optional, validated `contentType=MUSIC|BEAT` query to `GET /api/tracks` and artist-track queries;
- keep an unfiltered All mode for a smooth transition;
- make frontend cache keys and API calls content-type-aware;
- label Beat results and expose beat-specific metadata;
- treat mood, BPM, key, style, recency, and popularity as Beat filters. Small collections can be filtered locally while the server remains the visibility/security boundary.

## Current artist/profile layout

`ArtistPage` loads the public artist record and a separate list of that artist's published tracks. It renders a shared hero, popular-track list, discography grid, About panel, genres, and public social links. Artists are not globally typed as producers.

The same track list can be partitioned into Music and Beats. Producer wording should only appear in Beat sections and actions. Existing artist cards and follow mechanics can remain shared. The public artist API must continue enforcing hidden-user/artist and track visibility rules.

## Current player and playlist assumptions

The player store owns the single audio element and accepts generic mapped track objects. Queue, play-next, recently played, likes, waveform, player bar, fullscreen lyrics, and play-event recording are keyed by track identity and stream availability rather than genre or release type.

Playlists already relate to `Track` through `PlaylistTrack`; no schema change is needed to allow Beats. Playlist detail serialization uses the shared public-track mapping, so adding `contentType` and safe beat metadata to that serializer propagates the distinction without a parallel playlist implementation.

The shared context-menu architecture builds actions from a track object and is reused by cards, rows, player surfaces, queues, and playlists. Beat-aware labels and a safe producer-profile contact action can be conditional while all playback and playlist mutations remain shared. Native menus in editable fields and on selected text must remain available.

## Current library and search assumptions

Library loads liked tracks, playlists, followed artists, and recently played data. Liked Beats already fit the same `TrackLike` relation; the UI only needs Music/Beats partitions or filters and a subtle Beat badge. Discover is also the current search experience, so content-type search filters belong there unless a dedicated search route is added later.

## Current statistics assumptions

Play events and aggregate counters point to `Track`; a Beat therefore participates safely in existing play counting, anti-inflation qualification, recent history, and likes. Artist dashboard responses currently expose undifferentiated track totals/top tracks. Adding `contentType` to their track records is the minimum safe foundation; separate music/beat counts, play totals, and top-Beat lists can be derived without changing play-event semantics.

## Current admin assumptions

Admin track list/detail routes expose catalog and moderation records, enforce admin access, and redact storage-only data. The list currently supports search/status pagination but no content-type filter. Admin UI likewise lacks a type column/filter and Beat metadata presentation. A constrained type-edit endpoint may be added, but it must retain existing moderation and audit rules and reject invalid values or metadata.

## Serialization and mapping seams

`backend/src/lib/publicTrack.js` is the central safe public serializer. It strips storage keys and upload-only data, then exposes stream/cover/lyrics capability flags. It should include `contentType` and optional safe Beat metadata while continuing to redact all storage fields.

`src/api/mappers/trackMapper.js` normalizes real and already-normalized/mock track shapes. It must default missing legacy values to `MUSIC`, retain optional Beat fields, and avoid inventing metadata. Playlist, artist, stats, recently-played, and liked-track views already flow through this mapping or the equivalent backend serializer.

## Migration decision

The current stack already uses Prisma enums with PostgreSQL, and migrations are additive SQL directories. Use:

```prisma
enum TrackContentType {
  MUSIC
  BEAT
}
```

Add `Track.contentType @default(MUSIC)`, optional `beatKey`, `beatBpm`, `beatMood`, `beatStyle`, `beatLicenseType`, `beatUsageNotes`, and `beatContactEnabled @default(false)`. Mirror the upload-time fields on `UploadBatchItem` so drafts survive refresh and publication. Existing rows become `MUSIC` through the database default/backfill, with no destructive rewrite or data loss.

## Validation requirements

Shared backend helpers should provide stable errors and normalized data:

- only `MUSIC` and `BEAT` are accepted (`TRACK_CONTENT_TYPE_INVALID`);
- missing content type becomes `MUSIC`;
- BPM is an integer from 40 through 240 (`BEAT_BPM_INVALID`);
- key, mood, style, license label, and usage notes are trimmed, length-limited plain text with markup/control characters rejected (`BEAT_METADATA_INVALID`);
- Music payloads may omit Beat metadata and legacy clients remain valid;
- no raw stack trace or untrusted HTML is returned.

## Implementation risk notes

- `GET /api/tracks` is capped, so client-only content filtering can under-fill one mode. Passing the filter to Prisma is needed for correct Music/Beat feeds.
- Batch upload has several lifecycle stages; storing Beat fields only on the final `Track` would lose them on draft reload, review, retry, or resumed publication.
- Contact functionality must not expose a private account email or imply paid licensing. It should only appear when enabled and route to an already-public producer contact/profile surface.
- Beat lyrics should remain supported by the shared player, but Beat detail/upload UI should keep lyrics secondary and conditional.
- Tests must cover defaulting, validation, visibility, serializer propagation, and batch publication because a UI-only discriminator would not be a real content separation system.
