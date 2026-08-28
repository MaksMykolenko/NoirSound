# NoirSound Music / Beats Implementation Report

Implementation date: 2026-08-28

## Outcome

This pass adds a real `MUSIC` / `BEAT` discriminator to NoirSound while retaining one Track model, one playback stack, one playlist system, and the existing visibility/moderation boundaries. Existing records and legacy upload payloads default to `MUSIC`. Beats are ordinary playable tracks with optional, informational metadata; no payment or licensing transaction was added.

Verdict: `MUSIC BEATS MVP READY`. Every core MVP gate listed in the implementation brief is present and passes local test/build/lint verification. The narrower enhancements documented under Remaining product gaps are not represented as complete.

The implementation is intentionally not described as production-verified. It has not been deployed to or manually checked on `https://noirsound.co` in this pass.

## Data model and migration

- Added Prisma enum `TrackContentType { MUSIC BEAT }`.
- Added `Track.contentType` with the database/default value `MUSIC`.
- Added optional Beat fields: key, BPM, mood, style/type, license label, usage notes, and a contact-enabled flag.
- Mirrored upload-time fields on `UploadBatchItem`, so a batch draft can be reloaded, reviewed, retried, and published without losing Beat metadata.
- Added the additive migration `20260827120000_add_track_content_type_and_beats`; it backfills/defaults existing rows to Music and does not remove or rewrite existing content.
- Added a content-type/status/publication index for filtered public feeds.

## Validation and safe serialization

- `trackContentType.js` accepts only `MUSIC` or `BEAT`, normalizes case, and defaults omitted legacy payloads to `MUSIC`.
- `beatMetadata.js` validates integer BPM values from 40 through 240, normalizes supported musical-key spelling, trims and length-limits plain text, rejects markup/control characters, and clears Beat-only fields when content changes to Music.
- Stable validation codes are returned: `TRACK_CONTENT_TYPE_INVALID`, `BEAT_BPM_INVALID`, and `BEAT_METADATA_INVALID`.
- `publicTrack.js` exposes lightweight `contentType` and safe Beat fields without leaking audio/storage keys or stale Beat metadata from Music records.
- Public catalogue search now accepts a validated `q` alongside `contentType`, applies search before the 20-record feed limit, and preserves public/active-artist visibility predicates.

## Upload flow

- Single upload now presents `Upload as: Music / Beat`, defaults to Music, conditionally reveals optional Beat metadata, retains copyright confirmation, and sends the new fields through the existing upload/processing pipeline.
- Batch upload stores content type per item, adds the selector and conditional metadata fields to the settings drawer, displays Music/Beat labels and summary counts, and copies the fields into the published Track.
- Switching an item back to Music clears stale Beat-only fields.
- Lyrics remain optional and use the same plain/synced lyrics system. Beat selection does not weaken rights checks.
- Real and mock upload adapters use the same payload shape.

## Discovery and navigation

- Discover has prominent `All / Music / Beats` tabs backed by server-side `contentType` filters.
- Home partitions the catalogue into `New Music` and `Fresh Beats` without hiding legacy Music.
- The Beats view supports mood, style/type, key, BPM ranges, Recently added, and Most played filtering/sorting.
- Beat cards and rows show a subtle Beat badge plus available BPM/key/mood/style metadata.
- Artist/creator recommendations are filtered to creators with published content of the selected type.
- Search terms now reach the backend before feed limiting and cover titles, genre/description, Beat metadata, and artist display/username. Music and Beats remain searchable separately.

## Track page and profiles

- Track pages retain existing Music behavior.
- Beat pages use Beat/producer copy, show optional details and usage notes, expose `Contact producer` only when enabled, and show lyrics only when Beat lyrics actually exist.
- Artist pages partition releases into Music and Beats and include Playlists and About sections.
- Beat sections use creator/producer wording, Beat metadata, and a clean no-Beats state without globally renaming every artist a producer.

## Library, player, playlists, and context menu

- Library separates liked Music and liked Beats, while retaining shared Playlists, Recently Played, and Followed Artists.
- Beats use the existing audio element, player store, queue, play-next, likes, recent history, play events, fullscreen lyrics, and current-track UI.
- Existing playlists accept Music and Beats together; playlist tables/cards retain shared playback and show Beat badges where useful.
- The custom context menu retains shared queue/like/share/copy/report behavior and changes Beat labels to `Play beat`, `Add beat to playlist`, `Go to beat`, and `Go to producer`.
- `Contact producer` is conditional and routes only to the creator's already-public profile/contact surface.
- Report uses the existing moderation dialog and does not expose a second reporting path.

## Stats and admin

- Dashboard data includes Music/Beat upload counts, Music/Beat plays, top Music, and top Beats while retaining total plays, likes, listeners, and followers.
- Admin track lists display/filter content type.
- Admin track detail shows Beat metadata and supports reason-required content-type correction.
- Admin corrections are audited as `TRACK_CONTENT_TYPE_UPDATE`; converting to Music clears Beat-only data.
- Beats continue through the same hide/reject/restore/report moderation controls as Music.

## Localization and design

- Added matching Music/Beats copy in English, Ukrainian, Polish, and Russian.
- Existing genre taxonomy remains English-only.
- Music and Beats share NoirSound tokens and layout primitives; Beat identity is limited to restrained labels/metadata rather than a separate theme or app.

## Feature-specific files

New files:

- `backend/prisma/migrations/20260827120000_add_track_content_type_and_beats/migration.sql`
- `backend/src/lib/trackContentType.js`
- `backend/src/lib/beatMetadata.js`
- `backend/tests/musicBeats.unit.test.js`
- `src/components/tracks/TrackContentMeta.jsx`
- `src/components/upload/ContentTypeSelector.jsx`
- `src/components/upload/BeatMetadataFields.jsx`
- `src/components/upload/beatMetadata.js`
- `src/utils/trackContent.js`
- `src/api/__tests__/uploadContentType.test.js`
- `src/api/mock/__tests__/batchUploadContentType.test.js`
- `tests/components/LibraryContentTypes.test.jsx`
- `tests/e2e/music-beats.spec.js`

Principal updated areas:

- Prisma Track/batch schema and public serializers.
- Track, artist, playlist, upload, batch upload, stats, and admin backend routes.
- Real/mock API adapters and track mapping/query hooks.
- Home, Discover, Library, TrackPage, ArtistPage, Dashboard, AdminTracks, AdminTrackDetail, UploadForm, and BatchUploadPage.
- Track/playlist/profile cards, shared context menu/report dialog, and all four locale files.
- Component, mapper, upload, admin, dashboard, context-menu, batch, playlist, and E2E tests.

The checkout already contained unrelated uncommitted work before this pass. Nothing was reset, cleaned, stashed, committed, pushed, or deployed, and unrelated dirty files are not claimed as Music/Beats implementation work.

## Remaining product gaps

- Discover provides full track search with All/Music/Beats filtering and artist matches, but it does not yet provide dedicated user-facing `Artists` and `Playlists` search-scope tabs or playlist search results.
- `Most played` supplies the trending ordering for Beats, but there is no separate editorial `Trending Beats` shelf.
- Saved/liked Beats are available in Library rather than duplicated inside Discover.
- The shared Beat context menu has all safe listening, navigation, contact, share, and report actions, but no owner-facing Beat metadata editor exists; therefore an `Edit beat` action is not shown. Admin content-type correction is available separately.
- Dedicated `/music` and `/beats` routes remain optional future IA; Discover query tabs are the implemented transition path.
- Paid licensing, checkout, pricing, and marketplace behavior are deliberately out of scope.
