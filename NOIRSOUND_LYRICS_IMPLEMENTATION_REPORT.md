# NoirSound Lyrics Implementation Report

Date: 2026-07-05

## Scope delivered

NoirSound now supports artist-provided plain lyrics through single upload, batch upload,
post-publish editing, public Track pages, the global player, and admin moderation. Lyrics are
never scraped, generated, translated, or added automatically.

## Data model

The Prisma model now includes a `LyricsType` enum with `NONE`, `PLAIN`, and `SYNCED`.
`Track` stores:

- `lyricsText`
- `lyricsType`
- `lyricsLanguage`
- `lyricsSynced`
- `lyricsRightsConfirmed`
- `lyricsUpdatedAt`

`UploadBatchItem` stores the matching draft fields so processing, retries, and publish can
preserve per-track lyrics. The default type is `NONE`; validated non-empty plain lyrics are
stored as `PLAIN`. This makes the no-lyrics state explicit while retaining a forward-compatible
`SYNCED` JSON slot.

Migration `20260705120000_add_track_lyrics` is additive. It creates the enum and nullable/defaulted
columns without rewriting existing Track or batch-item data.

## Validation and output safety

`backend/src/lib/lyrics.js` is the shared validation boundary. It:

- accepts empty lyrics without blocking an upload;
- normalizes line endings and trims only outer whitespace;
- preserves intentional line breaks;
- limits content to 50,000 characters and 1,000 lines;
- normalizes an optional ISO-like language code;
- rejects HTML, script-like content, and unsafe control characters;
- requires a separate lyrics-rights confirmation for non-empty content;
- validates the reserved synced-line array shape and ordering;
- returns stable error codes instead of stack traces.

The UI renders lyrics as text with preserved whitespace. It does not render lyrics as HTML or
Markdown.

## API endpoints and response shape

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /api/tracks/:id/lyrics` | Public | Lazy full-lyrics read for public, published, visible Tracks |
| `GET /api/tracks/:id/lyrics/manage` | Owner/admin | Full management payload, including non-public Tracks |
| `PATCH /api/tracks/:id/lyrics` | Owner/admin + CSRF | Add, edit, or remove validated lyrics |
| `POST /api/admin/tracks/:id/lyrics/remove` | Admin + CSRF | Reason-required, audited moderation removal |

Public Track/list/playlist/recently-played payloads carry only `hasLyrics` and `lyricsType`.
`lyricsText`, synced data, rights state, and timestamps are removed by the public serializer.
Hidden, rejected, draft, failed, private, artist-hidden, and inactive-owner Tracks cannot expose
lyrics through the public endpoint. A public Track without lyrics returns a clean
`hasLyrics: false` payload.

## Upload integration

The single-upload init request accepts lyrics text, type, language, and the separate lyrics
rights confirmation. Lyrics are validated before the draft Track is created. Audio rights remain
an independent required confirmation. Existing no-lyrics uploads retain their prior behavior.

For batch uploads:

- per-item draft lyrics are persisted and returned only to the batch owner;
- the Track settings drawer has `Details`, `Artwork`, `Lyrics`, and `Rights` tabs;
- processing copies lyrics into a newly created Track;
- later draft edits mirror into an existing draft Track;
- publish copies the final draft values transactionally;
- retry and repeated publish paths retain their existing idempotency;
- list, playlist-builder, and review views show lyrics status without embedding the full text.

## Artist and public UI

The single-upload form has a collapsed optional lyrics editor with text, language, fixed plain
type, counts, preview, rights confirmation, legal copy, and inline validation.

The Track page lazily loads full lyrics into a readable NoirSound card. A clean localized empty
state is shown when none exist. Owners and admins receive an edit control; public listeners do
not. The artist dashboard also exposes add/edit controls without placing lyrics text in its
initial Track list payload.

Saving or removing lyrics updates lightweight Track metadata in the player store so the current
Track, queue, original queue, and recent list do not retain stale availability flags.

## Moderation, reporting, and audit

Admin Track detail includes the lyrics preview, language, type, rights confirmation, and last
updated timestamp. Removal requires a reason and creates an audit event.

Implemented audit actions:

- `TRACK_LYRICS_UPDATED`
- `TRACK_LYRICS_REMOVED`
- `TRACK_LYRICS_MODERATED`

Implemented report reasons:

- lyrics copyright issue;
- lyrics offensive content;
- lyrics incorrect or misleading.

Creator/legal copy states that lyrics must be written, owned, or licensed by the uploader and
that users may report copyright issues. NoirSound does not claim automatic copyright
verification.

## Localization

All lyrics UI, player controls, validation copy, moderation labels, and report reasons have
English, Ukrainian, Polish, and Russian strings. Artist-provided lyrics remain byte-for-byte UI
content after backend newline normalization and are never passed through translation.

## Remaining scope

- Timed-line authoring, playback highlighting, and auto-scroll are intentionally not enabled.
  The enum, JSON field, validator, and fallback model are ready for a later synced-lyrics pass.
- Production deployment and `noirsound.co` smoke verification were not part of this local
  implementation pass.
