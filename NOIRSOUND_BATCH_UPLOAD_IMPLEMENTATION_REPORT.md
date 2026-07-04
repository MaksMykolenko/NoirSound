# NoirSound Batch Upload Implementation Report

Date: 2026-07-04

## Verdict

`MULTI-UPLOAD PARTIAL`

The implementation and local unit/component/build checks are complete. The verdict remains partial because the local PostgreSQL/Redis/MinIO stack was unavailable, so the database-backed backend integration suite and real worker E2E could not execute.

## Data model

Migration: `backend/prisma/migrations/20260704130000_batch_upload_studio/migration.sql`

New enums:

- `UploadBatchMode`
- `UploadBatchStatus`
- `UploadBatchItemStatus`
- `UploadBatchItemTarget`

New models:

- `UploadBatch`
  - Owner user and artist profile.
  - Per-user client idempotency key.
  - Mixed/singles/playlist mode.
  - Draft/processing/partial/ready/published lifecycle.
  - Playlist draft metadata and optional private cover object metadata.
  - Optional final playlist relation.
- `UploadBatchItem`
  - Stable `(batchId, clientId)` uniqueness.
  - File metadata, target, order, track metadata, visibility, rights, status, and safe failure details.
  - Unique optional Track and Upload relations.

Existing models are reused for actual media processing and final content. Batch init creates Upload records and batch items, but no Track. A Track is created only when a validated uploaded object is claimed for processing.

## Endpoints

Implemented under `/api/uploads/batch`:

- `POST /init`
- `GET /`
- `GET /:batchId`
- `POST /:batchId/upload-urls`
- `PATCH /:batchId/items/:itemId`
- `PATCH /:batchId/playlist`
- `POST /:batchId/complete`
- `POST /:batchId/items/:itemId/retry`
- `POST /:batchId/publish`
- `DELETE /:batchId`

Batch init validates file count, per-file size, total size, MIME, extension, duplicate client ids, mode, artist access, and idempotency. Safe GET payloads contain no storage keys or presigned URLs.

## Upload pipeline

- Audio and cover metadata validation reuses the single-upload validators.
- Each audio object receives a private-storage presigned PUT URL.
- Completion verifies object metadata before creating/linking a Track.
- The existing BullMQ job, magic-byte validation, FFprobe duration validation, FFmpeg transcode, waveform generation, and private processed storage are reused.
- The worker detects a batch relation:
  - Single upload: unchanged immediate `PUBLISHED`.
  - Batch upload: processed Track remains `DRAFT`, item becomes `READY`.

## Publish and failure behavior

- Failed, excluded, unprocessed, or missing-audio tracks are never published.
- Strict publish blocks while any included item is not ready.
- `{ "allowPartial": true }` publishes only ready items and keeps the batch `PARTIAL_READY`.
- Playlist creation requires a title and at least one ready/published playlist track.
- Playlist creation/update, track publication, ordered playlist-item upserts, and batch status changes run in one database transaction.
- An atomic status claim prevents concurrent publish requests from creating duplicate playlists.
- Repeated publish is idempotent.
- Retry claims only one failed item, reuses its Track and Upload, and queues a uniquely identified retry job.
- Explicit cancellation unlinks/deletes unpublished draft tracks, cancels uploads, and best-effort deletes private objects.

## Security

- Authenticated active ArtistProfile required at init, completion, retry, and publish.
- Ownership checked on every batch access/mutation; admins retain audited retry capability.
- Existing global CSRF enforcement covers every mutation.
- Private keys and presigned storage URLs are excluded from draft/status payloads.
- Public catalog, metadata, stats, stream, artist, and playlist queries respect Track visibility.
- Genre values are normalized to canonical keys; labels remain English-only.
- Batch operations do not create `PlayEvent` rows or increment plays.

## Compatibility

The existing `/api/uploads/track/*` routes and single-upload UI remain present. Worker behavior for uploads without an `UploadBatchItem` is unchanged.

## Remaining work before MVP-ready verdict

1. Run the migration against a disposable PostgreSQL test database.
2. Execute the full backend integration suite with PostgreSQL, Redis, and MinIO.
3. Execute the real four-file Playwright scenario with the worker running.
4. Deploy, run the production smoke flow, and inspect logs/admin surfaces.
5. Add scheduled cleanup for abandoned, never-cancelled drafts if required operationally.
