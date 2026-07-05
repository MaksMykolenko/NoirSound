# NoirSound Lyrics System Audit

Date: 2026-07-05

## Current Track model

`Track` stores release metadata, visibility/moderation state, audio object references,
processing output, rights confirmation for audio, and engagement counters. It has no lyrics,
lyrics rights, language, type, or lyrics update timestamp fields.

Public Track serialization is centralized in `backend/src/lib/publicTrack.js`. The serializer
removes storage and upload-only fields, then feeds track list, detail, playlist, artist, liked,
recently played, and stats responses. Any lyrics fields added to `Track` must therefore be
explicitly removed from this generic serializer so full lyrics are never embedded in cards,
queues, or list responses.

## Upload metadata

### Single upload

- `POST /api/uploads/track/init` validates title, canonical genre, description, tags, audio
  rights, and file metadata.
- The route creates a draft `Track` and an `Upload`.
- The frontend payload is assembled in `src/api/real/uploads.js`.
- `src/components/upload/UploadForm.jsx` owns the form state and currently has one audio-rights
  checkbox.
- There is no lyrics metadata or separate lyrics-rights confirmation.

### Batch upload

- `UploadBatchItem` is the persisted per-track draft and is serialized by
  `backend/src/lib/batchUpload.js`.
- `PATCH /api/uploads/batch/:batchId/items/:itemId` updates draft metadata and mirrors it to an
  already-created draft Track.
- `trackDataFromItem` copies draft metadata when processing creates the Track.
- Batch publish copies the final item metadata into the Track transactionally.
- `BatchTrackSettingsDrawer.jsx` is the per-track editing surface.
- `BatchItemList.jsx`, `BatchPlaylistEditor.jsx`, and the Batch review step are the correct
  locations for lyrics badges/status.

## Existing track editing

There is no general owner Track edit endpoint or dedicated artist Track settings page.
The creator dashboard links published releases to the public Track page and includes all owner
tracks in its private dashboard response. The practical lyrics edit integration points are:

- an owner/admin edit control on the Track page;
- an edit control in the artist dashboard backed by an owner-only management read;
- the admin Track detail page for moderation/removal.

## Player structure and data flow

- `src/store/playerStore.js` stores the complete lightweight mapped Track object in
  `currentTrack`, `queue`, and `originalQueue`.
- Track objects enter the store from Track cards, lists, playlist mappers, recently played
  mappers, and Track pages.
- `src/api/mappers/trackMapper.js` is the shared boundary that must preserve `hasLyrics` and
  `lyricsType`.
- `src/components/player/PlayerBar.jsx` contains the desktop full bar, desktop collapsed mini
  player, mobile collapsed mini player, and mobile expanded player.
- Opening a lyrics panel can remain local UI state in `PlayerBar`; it does not need to touch
  playback, the queue, or play-event accounting.

## Track detail and visibility boundaries

- `GET /api/tracks` returns only published, public Tracks owned by active, visible artists.
- `GET /api/tracks/:id` returns published public Tracks, plus a private published Track to its
  owner.
- Stream and cover routes independently enforce publication, visibility, artist visibility,
  and account status.
- Hidden, rejected, draft, failed, and private Track lyrics require the same or stricter
  boundary. Public lyrics must be fetched from a dedicated lazy endpoint.
- Owner/admin editing of non-public lyrics needs a separate authenticated management read so
  full lyrics are not added to dashboard or Track list payloads.

## Admin and reporting

- Admin Track detail already reads explicit Track fields and displays reports/audit history.
- Admin actions use the shared audit helper and reason-required mutation guard.
- Reports use string reasons rather than a database enum, so lyrics-specific reasons can be
  added without a schema change.
- The admin detail response may include full lyrics because it is admin-only. Public serializers
  must not.

## Required implementation points

### Backend

- Prisma `LyricsType` enum and nullable lyrics fields on `Track`.
- Matching draft lyrics fields on `UploadBatchItem`.
- Additive migration.
- Shared validation/normalization helper with stable error codes.
- Single-upload persistence.
- Batch item validation, serialization, missing-field rules, Track creation/mirroring, and
  publish copying.
- Public lyrics read endpoint, owner/admin management read, and owner/admin update endpoint.
- Admin lyrics detail fields and audited removal action.
- Lyrics-specific report reasons.
- Lightweight Track flags in generic serializers and artist dashboard payloads.

### Frontend

- Real/mock lyrics clients and shared Track mapper flags.
- Reusable lyrics editor and edit modal.
- Collapsible single-upload lyrics section.
- Tabbed batch Track settings with lyrics and separate audio/lyrics rights.
- Batch list, playlist preview, and review badges.
- Track page lyrics card with empty state and owner/admin editing.
- Player lyrics buttons in desktop/mobile variants and a lazy, accessible lyrics panel.
- Artist dashboard lyrics edit control.
- Admin Track lyrics moderation panel.
- Legal copy and en/uk/pl/ru UI translations.

## Safety constraints

- Never scrape or auto-populate lyrics.
- Never translate creator-provided text.
- Render lyrics as text with preserved line breaks; do not render HTML or Markdown.
- Require a separate explicit rights confirmation whenever lyrics content exists.
- Never include full lyrics in Track lists, playlist payloads, queue items, stats, or recently
  played responses.
- Opening lyrics must not call the play-event API or mutate playback state.
- Public lyrics must remain unavailable for hidden, rejected, draft, failed, unpublished, or
  private Tracks.
