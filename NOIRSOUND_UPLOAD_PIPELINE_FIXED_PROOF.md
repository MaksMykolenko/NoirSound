# NoirSound Upload Pipeline Fixed Proof

**Proof date:** 2026-06-27  
**Result:** **PASS**

## Browser-created proof record

| Field | Value |
|---|---|
| User | `artist@noirsound.com` / ARTIST |
| Track title | `Phase 9 Browser Upload Proof` |
| Track ID | `cc727800-2da7-43ad-a2fd-ff5e43d42dd7` |
| Upload ID | `e22e889a-779d-40b0-bdff-5fdc62fffa16` |
| Input | Legal generated 4-second stereo WAV |
| Cover | Valid PNG |
| Final Track status | `PUBLISHED` |
| Final Upload status | `READY` |
| Processed format | MP3 |
| Duration | 4 seconds |
| Waveform | 100 points |

## Proof sequence

### 1. Browser upload

The actual React Upload page ran in real API mode and observed:

```text
POST /api/uploads/track/init                         200
PUT  private-audio-presigned-url                    200
PUT  private-cover-presigned-url                    200
POST /api/uploads/track/<uploadId>/complete         200
GET  /api/uploads/track/<uploadId>/status           200
GET  /api/uploads/track/<uploadId>/status           200
```

The page reached:

```text
"Phase 9 Browser Upload Proof" has been successfully uploaded and processed.
```

### 2. Init persistence

The database contained one persisted Track and one persisted Upload joined by
the same Track ID. The Track used the current user's `ArtistProfile.id`, while
the Upload used the authenticated `User.id`.

Initialization state:

```text
Track.status = DRAFT
Upload.status = UPLOADING
Upload.trackId = Track.id
```

No fake ID or swallowed Prisma error is used.

### 3. Object verification and queueing

Before queueing, completion verified:

- original exists;
- cover exists;
- original `ContentType` is `audio/wav`;
- cover `ContentType` is `image/png`;
- both `ContentLength` values exactly match initialization metadata;
- current user owns the Upload;
- Upload is not already claimed.

The job was queued once with:

```text
jobId = upload-e22e889a-779d-40b0-bdff-5fdc62fffa16
queue = audioProcessingQueue
attempts = 3
```

An atomic `updateMany` claim and deterministic BullMQ job ID prevent duplicate
completion from enqueueing the same Upload twice.

### 4. Worker evidence

Observed worker log sequence:

```text
job started
original downloaded
ffprobe duration 4s
transcode completed
processed object uploaded
database updated
job completed
BullMQ completion acknowledged
```

Final database evidence:

```text
Track.status             = PUBLISHED
Track.durationSeconds    = 4
Track.waveformJson       = JSON array with 100 points
Track.processedAudioKey  = processed/<user>/<track>/stream.mp3
Upload.status            = READY
Upload.errorMessage      = null
```

The waveform function was run twice against the same processed MP3:

```text
SHA-256 run 1: a00ad7090e8510bc86870b7330d2ce62d10edcd74644445c144abd19c4335dc6
SHA-256 run 2: a00ad7090e8510bc86870b7330d2ce62d10edcd74644445c144abd19c4335dc6
deterministic: true
```

### 5. Stream and browser playback

The uploaded Track page loaded from the real API. Clicking Play produced:

```text
GET  /api/tracks/cc727800-2da7-43ad-a2fd-ff5e43d42dd7/stream  302
GET  private signed processed object                              206
POST /api/tracks/cc727800-2da7-43ad-a2fd-ff5e43d42dd7/play-event 200
```

Browser UI evidence:

```text
player control = Pause
waveform progress = 0:01
Recently Played contains "Phase 9 Browser Upload Proof"
```

The downloaded signed object passed FFprobe as MP3 with a 4-second duration.

### 6. Failure-path tests

Automated backend coverage proves:

- init rejects wrong role or unauthenticated use;
- init creates exactly one linked Track and Upload;
- completion rejects a missing original;
- completion verifies metadata;
- successful completion adds exactly one queue job;
- duplicate completion is rejected;
- status reads real state;
- stream rejects an unprocessed Track;
- stream redirects for a processed published Track;
- worker failure writes valid `FAILED` statuses;
- user-visible worker errors do not leak local paths.

## Relevant files

- `backend/src/routes/uploads.js`
- `backend/src/services/audioQueue.js`
- `backend/src/services/storage.js`
- `backend/src/workers/audioProcessor.js`
- `backend/src/routes/tracks.js`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260627121713_phase9_upload_runtime/migration.sql`
- `backend/tests/endpoints.test.js`
- `src/api/user.js`
- `src/components/upload/UploadForm.jsx`
- `src/store/playerStore.js`
- `src/store/userStore.js`

## Test result

The full creator/listener pipeline works locally. This proof is not a fake
seed-stream shortcut: the proof Track was created through the browser Upload
page, stored privately, processed by the live worker, and played from its
processed object.

