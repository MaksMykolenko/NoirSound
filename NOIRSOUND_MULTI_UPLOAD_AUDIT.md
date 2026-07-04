# NoirSound Multi-Upload Audit

Date: 2026-07-04

## Existing single-upload system

The existing single-track flow is registered at `/api/uploads` and remains intact:

- `POST /api/uploads/track/init`
  - Requires an authenticated `ARTIST` or `ADMIN`.
  - Resolves upload permission through `evaluateUploadAccess`.
  - Validates title, canonical genre, tags, rights confirmation, audio metadata, and optional cover metadata.
  - Creates one `Track` and one `Upload`, then returns private-storage presigned PUT URLs.
- `POST /api/uploads/track/:uploadId/complete`
  - Verifies object existence, MIME, and content length.
  - Atomically claims the upload and enqueues one BullMQ `processAudio` job.
- `GET /api/uploads/track/:uploadId/status`
  - Returns safe processing state without object keys or storage URLs.

Single uploads use `UploadStatus`: `INITIATED`, `UPLOADING`, `PROCESSING`, `READY`, `FAILED`, `CANCELLED`.

Tracks use `TrackStatus`: `DRAFT`, `PROCESSING`, `PENDING_REVIEW`, `PUBLISHED`, `FAILED`, `REJECTED`, `HIDDEN`.

## Worker processing

`backend/src/workers/audioProcessor.js`:

1. Downloads the original from private S3/MinIO.
2. Validates magic bytes against the declared audio MIME.
3. Uses FFprobe with a timeout and maximum-duration limit.
4. Transcodes to 192 kbps MP3 with an FFmpeg timeout.
5. Generates waveform data.
6. Writes the processed object to private storage.
7. Updates database processing state.

Before this pass, every successful worker job immediately published its `Track`. Batch-linked jobs now stop at a processed `DRAFT`/`READY` state. Non-batch single uploads retain the existing immediate-publish behavior.

## Existing playlist system

Data model:

- `Playlist`: name, description, optional external cover URL, creator, visibility, likes.
- `PlaylistTrack`: composite `(playlistId, trackId)` key plus stable numeric order.

Endpoints:

- `GET /api/playlists` — public playlists.
- `GET /api/playlists/:id` — public playlist detail.
- `GET /api/playlists/me` — authenticated creator playlists.
- `POST /api/playlists` — authenticated playlist creation.

This pass extends playlists with optional `artistProfileId`, tags, and a private-storage `coverImageKey`. Public API serializers remove storage keys. Owners can read private playlists and their own private tracks through validated active sessions.

## Existing track metadata

Before this pass, `Track` stored title, artist relation, cover, canonical genre key, tags, description, duration, waveform, publishing state, private object keys, and rights confirmation.

The batch product requires additional persisted fields, so this pass adds:

- `primaryArtistName`
- `featuredArtists`
- `explicit`
- `isPublic`

Public track, artist, playlist, stats, sitemap, stream, and metadata queries now respect `isPublic`. Private tracks remain available to their authenticated owner.

## Cover handling

Single-track audio and cover objects use private storage keys. API payloads do not expose those keys. Public/owner cover endpoints mediate access.

The batch flow prepares per-track and playlist cover PUT URLs only after validated cover metadata. Covers remain optional for this MVP, matching the existing playlist model’s optional-cover rule.

## Artist access and security

The source of truth is `backend/src/lib/artistAccess.js`:

- Only `ARTIST` and `ADMIN` roles are eligible.
- The account must be active.
- An `ArtistProfile` must exist and must not be hidden.
- Admin-only profile auto-creation preserves the existing narrow behavior.

All mutating batch routes are behind the existing global CSRF origin/referer guard and per-user rate limits. Audio validation, private storage, worker queuing, magic-byte validation, FFprobe/FFmpeg limits, and public serialization are reused rather than reimplemented as an alternate upload pipeline.

## Reusable frontend pieces

- `GenrePicker` and the canonical shared genre taxonomy.
- Existing upload access state from `useUserStore`.
- Existing card, field, button, loading, toast, layout, and responsive primitives.
- Existing playlist page visual hierarchy.
- Existing real/mock API switching.

Genre names continue to render from the canonical English-only taxonomy in every UI locale.

## Gaps found and addressed

- No persisted batch/draft entity: addressed with `UploadBatch` and `UploadBatchItem`.
- Worker auto-published all processed audio: batch relation now keeps processed tracks unpublished until explicit batch publish.
- No safe partial-publish transaction: implemented item filtering, publish claims, playlist upserts, and `PARTIAL_READY`.
- No retry isolation: failed-item retry reuses the existing Track/Upload and does not create duplicates.
- No init idempotency: optional client batch id is persisted with a per-user unique constraint; the frontend supplies it.
- No owner read path for private batch releases: authenticated owner access added for private playlists, tracks, streams, and covers.
- No visual grouped-upload editor: implemented under `/upload/batch`.

## Remaining audit gaps

- Browsers cannot persist local `File` objects. Server metadata survives refresh, but unuploaded files must be reselected and matched by filename/size.
- There is no general “my private tracks” catalog page yet; private tracks are reachable through owner playlist/detail paths.
- Abandoned object cleanup is implemented on explicit batch cancellation, not on a scheduled age-based cleanup job.
