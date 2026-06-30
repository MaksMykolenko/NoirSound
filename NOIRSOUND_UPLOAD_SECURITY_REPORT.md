# NoirSound — Upload Security & Media Validation Report (Phase 5)

Date: 2026-06-28

## Upload init (`routes/uploads.js`) — already strong, verified
- Filename sanitized + path-traversal stripped (`cleanFileName`), length-capped (180).
- Declared MIME allowlist (audio + cover), size caps (audio 50MB / cover 5MB).
- Extension danger handled via MIME allowlist (no executable/script types accepted).
- Genre normalized to a supported taxonomy key; tags ≤20 (≤30 chars each); title ≤150; description ≤2000.
- `copyrightConfirmed === true` required (server-enforced).
- Artist/admin role required; ArtistProfile required.

## Upload complete — verified
- Verifies the uploaded object exists and that S3 content-length + content-type match the declared values (`getObjectMetadata` + `metadataMismatch`).
- Ownership enforced (`upload.userId === user.id` or admin).
- Idempotent claim via `updateMany(status in [INITIATED,UPLOADING] → PROCESSING)`; duplicate completion → 409; cannot complete someone else's upload; cannot publish without worker validation (track only goes PUBLISHED in the worker).

## NEW — Worker / FFmpeg hardening (`workers/audioProcessor.js`)
- **Magic-byte verification** (`lib/fileSignature.js` → `assertAudioSignature`): the first bytes are checked against real audio signatures and must match the declared MIME type. A renamed script/PDF/executable or WAV-declared-as-MP3 mismatch is rejected before transcode.
- **FFprobe kill timeout** (`FFPROBE_TIMEOUT_MS`, default 30s).
- **FFmpeg transcode + waveform timeouts** with `command.kill('SIGKILL')` (`FFMPEG_TIMEOUT_MS`, default 5m).
- **Max duration cap** (`MAX_AUDIO_DURATION_SECONDS`, default 30m) — rejects over-long/oversized decodes (also bounds waveform memory).
- Existing protections retained: temp-dir cleanup in `finally`; no shell injection (fluent-ffmpeg + controlled temp paths, never user filenames); deterministic 100-point waveform; failure state persisted + path-redacted error.

| Requirement | Status |
|---|---|
| filename length / dangerous ext / path traversal | PASS |
| declared MIME / size / type validation | PASS |
| copyright confirmation required | PASS |
| normalized genre keys, tag/title/desc caps | PASS |
| complete verifies object exists + content length/type | PASS |
| magic bytes / signature verification | PASS (worker, new) |
| refuse declared/actual media mismatch | PASS (non-audio rejected) |
| idempotent completion / no duplicate jobs | PASS (`jobId: upload-<id>`, updateMany claim) |
| cannot complete/stream others' upload | PASS |
| cannot publish without worker validation | PASS |
| ffprobe/ffmpeg timeouts, max duration | PASS (new) |
| handles corrupt/tiny/empty/huge-metadata files | PASS (ffprobe rejects; signature rejects; duration cap) |
| no invalid Prisma enum states | PASS (DRAFT→PROCESSING→PUBLISHED/FAILED) |

## Storage
- All objects private; signed GET URLs; presigned PUT TTL 900s; bucket `anonymous set none`. Single bucket with `uploads/` (quarantine) vs `processed/` prefix separation. `S3_IS_PUBLIC=false`.

## Tests executed in-sandbox (real ffmpeg)
`publicBeta.unit.test.js` generates a real WAV and verifies valid, junk, and declared-type mismatch behavior, probe/transcode, and waveform output. Playwright verified both successful processing and corrupt-file failure through real MinIO/Redis/worker infrastructure.

## Status: PASS

## Final verification record

- **What was inspected:** init/complete validation, object metadata, ownership/idempotency, worker download, byte/type checks, timeouts, duration, temp cleanup, storage visibility.
- **What was implemented:** FFprobe now uses a killable child process; declared/actual types must match; public API serialization removes storage keys.
- **What was tested:** 28 DB-free tests, 58 backend tests, full upload and malicious-file E2E.
- **What could not be tested:** multi-gigabyte adversarial corpus beyond configured size caps.
- **Exact commands:** `(cd backend && npm run test:unit && npm run test)`; `npm run test:e2e`.
- **Exact blockers:** none.
- **Remaining risks:** cover-image bytes are constrained by MIME/size and browser decoding but do not yet have a separate worker decode/re-encode pipeline.
- **Files changed:** upload route; `fileSignature.js`; `audioProcessor.js`; `publicTrack.js`; storage service; upload E2E and backend tests.
