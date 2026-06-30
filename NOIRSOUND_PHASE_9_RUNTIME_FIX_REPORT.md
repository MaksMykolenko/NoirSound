# NoirSound Phase 9 Runtime Fix Report

**Date:** 2026-06-27  
**Verdict:** **MVP CANDIDATE**  
**Public-beta verdict:** **NOT A PUBLIC BETA CANDIDATE**

## Outcome

The Phase 9 creator/listener loop is now proven against a clean local PostgreSQL, Redis, MinIO, BullMQ, FFmpeg, Fastify, Vite, and Chromium stack:

```text
artist login
  → real Upload page
  → persisted Track + Upload
  → private presigned audio and cover PUTs
  → completion metadata verification
  → one BullMQ job
  → FFprobe + FFmpeg + deterministic waveform
  → private processed MP3
  → Track PUBLISHED + Upload READY
  → public /stream route returns a signed 302
  → browser receives MP3 range response (206)
  → HTML5 player reaches Pause and progress 0:01
  → play-event POST returns 200
  → track appears in Recently Played
```

The proof track created through the browser was:

- Track: `cc727800-2da7-43ad-a2fd-ff5e43d42dd7`
- Upload: `e22e889a-779d-40b0-bdff-5fdc62fffa16`
- Title: `Phase 9 Browser Upload Proof`
- Final Track status: `PUBLISHED`
- Final Upload status: `READY`
- Duration: 4 seconds
- Waveform: 100 deterministic points

## Exact bugs found and fixed

### Upload persistence and completion

- Upload init used the authenticated `User.id` where Prisma required `ArtistProfile.id`.
- Database failures were swallowed and fake IDs were returned.
- Track and Upload creation were not guaranteed to be atomic.
- Completion could not find the fake/non-persisted Upload.
- Completion did not validate stored object content type and byte length.
- Upload status was hard-coded instead of queried.
- Duplicate completion could enqueue more than once.

Fixes:

- Resolve the authenticated artist profile before initialization.
- Reject users without an ArtistProfile with HTTP 422.
- Validate title, genre, tags, description, rights confirmation, and audio/cover metadata.
- Create Track and Upload in one Prisma transaction.
- Return persisted IDs only.
- Generate presigned URLs only after persistence succeeds.
- Store expected cover metadata on Upload.
- HEAD-check audio and cover objects before queueing.
- Atomically claim the Upload as `PROCESSING`.
- Use deterministic BullMQ job ID `upload-<uploadId>`.
- Return failure if queue creation fails.
- Read real Track/Upload state in the status route with ownership/admin enforcement.

### Worker and schema

- Worker failure attempted to write an invalid `TrackStatus.FAILED`.
- Waveform data used random values.
- Worker lifecycle and stage logging were insufficient.

Fixes:

- Added `FAILED` to `TrackStatus` through migration
  `20260627121713_phase9_upload_runtime`.
- Added safe failure updates for Track and Upload.
- Sanitized user-visible processing errors while retaining internal logs.
- Downloaded the private original to a temporary directory.
- Used FFprobe for actual duration and FFmpeg for 192 kbps MP3 output.
- Derived a deterministic 100-point waveform from decoded mono PCM.
- Uploaded processed audio under `processed/<user>/<track>/stream.mp3`.
- Updated `processedAudioKey`, `durationSeconds`, `waveformJson`,
  Track `PUBLISHED`, and Upload `READY`.
- Added graceful worker shutdown and guaranteed temp cleanup.

### Streaming and browser playback

- Seed and upload paths did not use one authoritative stream key.
- Fastify 5 redirect argument order was incorrect.
- Browser media requests failed after the signed redirect because the storage
  response did not satisfy redirect/range CORS.
- Real mode could use a synthetic audio fallback and report false playback.
- Play telemetry was submitted before playback, with a fabricated 45-second
  completed event.

Fixes:

- `Track.processedAudioKey` is now the sole processed-audio source of truth.
- Stream only permits `PUBLISHED` tracks with a processed key.
- Stream returns a valid 302 to a short-lived signed private-object URL.
- Original audio is never used by the stream route.
- Added a private signed cover redirect.
- Added a storage-edge Nginx service that preserves the signed Host header,
  supports 60 MB PUTs, range responses, and CORS for capability URLs.
- Removed the real-mode synthetic audio fallback.
- Record a zero-duration playback-start event only after `audio.play()` succeeds.
- Confirmed Recently Played updates in the same browser session.

### Real API mode

- Frontend code used inconsistent API environment names.
- Real API failures silently returned mock data or mock success.
- Real mode started with a hard-coded logged-in user.
- Backend response mappers omitted or renamed required fields.
- `apiFetch` set JSON content type on an empty completion POST, which Fastify 5
  rejected with `FST_ERR_CTP_EMPTY_JSON_BODY`.

Fixes:

- Standardized on `VITE_API_BASE_URL`.
- Mock behavior is now gated by `VITE_USE_MOCK_API=true`.
- Real errors reach page state and the global toast path.
- App startup hydrates `/api/auth/me`.
- Real mode starts unauthenticated until hydration/login succeeds.
- Track, artist, and playlist mappers now match backend response shapes.
- Upload uses real init, two storage PUTs, completion, and status polling.
- `apiFetch` sends JSON content type only when a request body exists.

### Containers and tests

- Backend Dockerfile used unsupported Node 18 with Prisma 7.
- Build context included unnecessary files.
- Worker image did not guarantee FFmpeg.
- Backend tests reset the development database.
- Custom rate-limit responses omitted status code and became HTTP 500.

Fixes:

- Backend image now uses Node 22 Alpine, `npm ci`, Prisma generate, non-root user,
  `dumb-init`, and FFmpeg.
- Added `backend/.dockerignore`.
- Added `noirsound_test_db` during clean PostgreSQL initialization.
- Test runner requires `DATABASE_URL_TEST`, rejects non-test DB names and
  production mode, resets/migrates/seeds the test DB, then runs Vitest.
- Added upload, stream, and worker-failure integration coverage.
- Rate-limit responses now include HTTP 429.

## Files changed

### Backend and data

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260627121713_phase9_upload_runtime/migration.sql`
- `backend/prisma/seed.js`
- `backend/src/index.js`
- `backend/src/plugins/auth.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/artists.js`
- `backend/src/routes/stats.js`
- `backend/src/routes/tracks.js`
- `backend/src/routes/uploads.js`
- `backend/src/services/audioQueue.js`
- `backend/src/services/storage.js`
- `backend/src/workers/audioProcessor.js`

### Local infrastructure and image

- `backend/docker-compose.yml`
- `backend/docker/postgres/init-test-db.sql`
- `backend/docker/nginx/storage.conf`
- `backend/Dockerfile`
- `backend/.dockerignore`
- `backend/.env.example`
- `backend/package.json`

### Tests

- `backend/tests/runTests.js`
- `backend/tests/endpoints.test.js`
- `package.json`
- `vite.config.js`
- `src/store/__tests__/userStore.test.js`

### Frontend real-mode integration

- `.env.example`
- `src/App.jsx`
- `src/api/client.js`
- `src/api/artists.js`
- `src/api/comments.js`
- `src/api/playlists.js`
- `src/api/tracks.js`
- `src/api/user.js`
- `src/api/mappers/artistMapper.js`
- `src/api/mappers/playlistMapper.js`
- `src/api/mappers/trackMapper.js`
- `src/components/upload/UploadForm.jsx`
- `src/store/playerStore.js`
- `src/store/userStore.js`

## Commands and results

```bash
cd backend
docker compose down -v --remove-orphans
docker compose up -d
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run test
docker build -t noirsound-backend:local .
```

Results:

- Clean dependency stack: PASS
- Development and test databases created: PASS
- Both Prisma migrations applied: PASS
- Seed: PASS
- Backend integration tests: **12/12 PASS**
- Node 22 + FFmpeg backend image build: PASS
- Built image runtime: Node `v22.23.1`, FFmpeg `8.1.1`

```bash
npm run test
npm run lint
npm run build
npm run test:e2e
```

Results:

- Frontend tests: **12/12 PASS**
- Oxlint: **0 errors, 61 warnings**
- Vite production build: PASS
- Playwright smoke tests: **2/2 PASS**
- Browser-driven real upload/playback proof: PASS
- Frontend dependency audit: 0 vulnerabilities
- Backend dependency audit: 3 moderate, 0 high, 0 critical; all are in the
  Prisma CLI/dev dependency chain and the offered automatic fix is a Prisma 7
  to Prisma 6 major downgrade

## Readiness scores

| Category | Score |
|---|---:|
| Frontend demo readiness | 90/100 |
| Frontend real API readiness | 82/100 |
| Backend API readiness | 78/100 |
| Audio upload pipeline readiness | 94/100 |
| Local runtime readiness | 91/100 |
| Test coverage readiness | 68/100 |
| Security readiness | 52/100 |
| Public beta readiness | 25/100 |
| Production readiness | 12/100 |

## Remaining blockers

### P0

No remaining P0 blocker was found for the narrow local MVP
upload → process → stream → play loop.

### P1

- Commit a self-contained full-infrastructure browser E2E fixture; the real
  full-stack proof is currently a verified runtime procedure, while committed
  tests use fake storage/queue boundaries.
- Record measured listening time/completion, deduplicate play sessions, and add
  abuse controls. Current playback telemetry records a truthful start event.
- Add file signature/checksum validation, processing time/resource limits, and
  malicious-file scanning policy.
- Add revocable sessions, CSRF review/protection, Redis-backed distributed rate
  limiting, trusted-proxy configuration, and production secret rotation.
- Add moderation/admin review flows, backup/restore proof, monitoring, deployment
  design, and owner/user acceptance testing before any public beta claim.
- Replace remaining static/store-only profile, dashboard, playlist, sidebar,
  likes, follows, and seeded unstreamable demo content in real mode.
- Resolve existing lint warnings and the large main-bundle warning.
- Track the three moderate Prisma CLI/dev-chain audit findings; do not apply the
  suggested breaking Prisma 6 downgrade without a separate compatibility change.
