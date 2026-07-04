# NoirSound Multi-Upload Final Verification Report

Date: 2026-07-04

## A. Final verdict

**READY**

This verdict means the multi-upload implementation is ready to deploy. The required
release gates were completed locally against real PostgreSQL, Redis, MinIO, BullMQ,
FFprobe, and FFmpeg services:

- The migration passed on both a fresh test database and the existing development database.
- The full database-backed backend suite passed.
- The real worker path processed browser-uploaded objects from private storage.
- A real four-track browser flow published singles and an ordered playlist.
- Failure isolation, explicit partial publish, private visibility, and retry without a duplicate
  Track were exercised with real services.

The code has not been deployed in this pass. Therefore, production multi-upload behavior is
not yet smoke-verified. That is a deployment status, not a remaining local implementation
blocker.

## B. What was verified

### Previous gaps

The four earlier reports were re-read. Their material `PARTIAL` gaps were database migration
execution, the full backend suite, real queue/storage/worker execution, real Playwright
publication, and deployment. All local verification gaps are now closed. Deployment remains
an explicit handoff.

### Database and migration

- Inspected `UploadBatch`, `UploadBatchItem`, their enums, relations, uniqueness constraints,
  indexes, visibility fields, and the single new migration.
- Applied all eight migrations while resetting the fresh `noirsound_test_db`.
- Applied the four previously pending migrations, including the batch migration, to the
  existing `noirsound_db`.
- Confirmed `prisma migrate status`: `Database schema is up to date!`
- No duplicate migration was created.

### Backend behavior

The full integration suite covers:

- Authentication, active-artist access, ownership isolation, and file limits.
- Stable client batch idempotency and completion/publish idempotency.
- Draft-only initialization with no premature Track creation.
- Canonical genre and playlist metadata validation.
- Real publish transaction behavior and ordered playlist entries.
- Explicit strict versus partial publication.
- Failed/excluded/unprocessed item isolation.
- Retry using the existing Track and Upload.
- Owner access to private published tracks while public/anonymous routes return no private,
  draft, failed, or unpublished Track.
- No upload- or publish-generated `PlayEvent`.
- No storage keys or presigned URLs in batch status responses.
- Existing CSRF and rate-limit middleware remained enabled and its existing coverage passed.

### Worker and storage

- Real presigned PUTs wrote WAV fixtures to the private MinIO bucket.
- BullMQ delivered jobs to the real worker.
- Audio signatures, FFprobe duration, FFmpeg transcode, waveform generation, processed-object
  upload, and database state transitions completed.
- Invalid audio failed independently after all automatic attempts.
- A manual retry also exhausted its attempts without creating a duplicate Track.
- Batch Tracks remained drafts after processing and became public/private only during publish.
- The legacy single-upload worker path still processed, streamed, and recorded a qualified play.

### Frontend and browser

- The real app loaded at `http://localhost:5173/upload/batch`.
- An artist signed in successfully in the in-app browser; the six-step Batch Studio and persisted
  drafts rendered with no browser console warning/error.
- Playwright selected four real browser `File` objects, edited track metadata and rights,
  assigned two singles and two playlist tracks, reordered the playlist, uploaded, processed,
  published, and rendered the result on the public playlist page.
- A second real-service scenario covered one public Track, one private Track, one failed item,
  one excluded item, strict-publish rejection, explicit partial publish, and retry.
- The existing single-track browser pipeline remained green.

Browser `File` objects still need to be selected again after a hard refresh; browsers do not
permit persisting file handles. Server-side batch drafts and their metadata/status do persist.
This is not a release blocker.

### Security and deployment checks

- Forbidden-file scan passed.
- `.env` and `backend/.env` are ignored; only example environment files are tracked.
- No common private-key/API-key signatures were found in the tracked diff.
- `git diff --check` passed.
- Public and anonymous visibility checks passed.
- The current production deployment passed its existing read-only smoke script. This confirms
  current production health only; it does not claim that this undeployed batch build is live.

### Abandoned-draft cleanup

Scheduled cleanup is not required to release this feature. Explicit cancellation already refuses
published batches, removes only unpublished draft Tracks, cancels uploads, and best-effort deletes
their private objects.

A future cleanup job should first ship in dry-run/report mode, use a configurable age threshold,
select only stale non-active `DRAFT`/terminal abandoned batches, and never touch published Tracks
or active uploads. It was intentionally not added during this verification-only pass.

## C. Exact commands run

```bash
open -a Docker
cd backend
docker compose up -d
docker compose exec -T postgres pg_isready
docker compose exec -T redis redis-cli ping
curl -fsS http://localhost:9000/minio/health/live

npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma migrate status --schema prisma/schema.prisma
npm run db:seed:demo
npm test
npx vitest run tests/batchUpload.unit.test.js
npx vitest run tests/statsQA.test.js --reporter=verbose

npm start
npm run worker

cd ..
npm run dev -- --host localhost
curl -fsS http://localhost:3000/api/ready
npm test
npm run lint
npm run build

docker compose -f backend/docker-compose.yml exec -T redis sh -c \
  'redis-cli --scan --pattern "fastify-rate-limit-*" | xargs -r redis-cli del'
npx playwright test \
  tests/e2e/batch-upload-studio.spec.js \
  tests/e2e/public-beta-upload-pipeline.spec.js \
  --project=chromium --reporter=line

npm run check:forbidden
git diff --check
DOMAIN=https://noirsound.co scripts/smoke-production.sh
```

The backend `npm test` command itself regenerated Prisma Client, reset the fresh test database,
applied all eight migrations, seeded fixtures, and ran the complete backend suite.

## D. Test results

| Gate | Result |
| --- | --- |
| Frontend tests | **PASS** — 27 files, 136 tests |
| Backend tests | **PASS** — 11 files, 149 tests |
| Batch worker unit test | **PASS** — 6 tests |
| Real worker path | **PASS** — MinIO → BullMQ → signature → FFprobe/FFmpeg → MinIO → DB |
| Final Playwright E2E | **PASS** — 4/4 Chromium tests, 17.9s |
| Lint | **PASS** — `oxlint` |
| Production build | **PASS** — Vite build |
| Forbidden-file scan | **PASS** |
| Migration status | **PASS** — all 8 migrations applied |
| In-app browser smoke | **PASS** — artist auth, Batch Studio load, no console errors |
| Current production smoke | **PASS** — public/legal/upload pages, ready/health/mode, storage denial, OAuth redirect |

The build retained the existing advisory for chunks larger than 500 kB. It is not a build or
multi-upload correctness failure.

One full backend run had a transient HTTP parse failure in `statsQA.test.js`; that file passed
15/15 immediately in isolation, and the final full backend run passed 149/149 without code or
test weakening.

## E. Bugs found and fixed

1. **Batch target selector collapsed the track title area.** The global `.ns-field` width rule
   made the selector consume the flex row. It now has a fixed shrink-safe wrapper.
2. **The release-target selector lacked an accessible name.** Added its translated `aria-label`.
3. **Worker failure state raced BullMQ retries.** The worker previously persisted `FAILED` on the
   first failed attempt even when automatic retries remained, allowing a UI retry to overlap the
   queue retry. Failure state is now persisted only on the final configured attempt, with unit and
   real-worker coverage.
4. **The batch no-play E2E assertion was not parallel-safe.** A concurrent legacy single-upload
   test legitimately created a play for the same seeded user. The assertion now verifies that none
   of the newly published batch Tracks appears in recent plays; the database integration test still
   asserts the exact `PlayEvent` count is unchanged.
5. **Real E2E coverage was completed and hardened.** It now verifies init replay idempotency,
   explicit partial publish, owner-only private visibility, failed-item retry identity, playlist
   reordering, and public playlist rendering.

## F. Remaining blockers

There are no known local implementation or verification blockers.

Operational items that remain:

- The dirty working tree contains this feature plus pre-existing genre-related changes. Review and
  commit the intended release set before tagging.
- Production has not received this build, so artist authentication, real batch upload/publish,
  private/excluded/failed visibility, worker logs, and the legacy single-upload path must be smoked
  again after deployment.
- Scheduled abandoned-draft cleanup remains an optional operational follow-up.
- A general owner-facing catalog of private Tracks is outside this feature; owner detail access and
  playlist access are enforced and verified.

## G. Deployment status

**Not deployed — deploy commands provided.**

No deployment was attempted because this pass has an uncommitted dirty worktree and no explicit
authorization to mutate production.

Deploy a reviewed commit or tag on the VPS:

```bash
cd /opt/noirsound
git fetch --tags origin
git checkout <verified-commit-or-tag>
APP_DIR=/opt/noirsound scripts/deploy-hostinger.sh
DOMAIN=https://noirsound.co scripts/smoke-production.sh
```

The deploy script validates production configuration, creates a database/storage backup when live
services exist, builds images, starts PostgreSQL/Redis/MinIO, ensures the private bucket exists,
runs `prisma migrate deploy`, replaces backend/worker/web services, and blocks on `/api/ready`.

Alternatively, dispatch `.github/workflows/deploy-hostinger.yml` for the reviewed ref; its CI gate
runs before the SSH deployment.

After the script passes, run one authenticated production batch smoke with disposable audio files
and inspect backend/worker logs. The existing smoke script intentionally does not upload media.

## H. Migration safety notes

- The migration is additive: four enums, two batch tables, relations/indexes, and non-null
  `isPublic` columns with `DEFAULT true` on existing Track and Playlist rows.
- It does not rename/drop existing columns or rewrite existing media data.
- Existing Tracks and Playlists retain their prior public behavior because of the `true` default.
- Unique `(userId, clientId)` and `(batchId, clientId)` constraints enforce idempotency.
- The migration succeeded on both fresh and populated local databases.
- Back up PostgreSQL and object storage before production migration; the deploy script does this
  when existing production services are detected.
- For application rollback, deploy the previous known-good tag and normally leave this additive
  schema in place. Do not reverse it blindly: dropping the batch tables/columns/enums would destroy
  batch and visibility data.
- Deploy backend and worker from the same reviewed revision so their batch state transitions agree.

## I. Files changed in this verification pass

- `backend/src/workers/audioProcessor.js`
- `backend/tests/batchUpload.unit.test.js`
- `backend/tests/endpoints.test.js`
- `src/components/upload/batch/BatchItemList.jsx`
- `src/components/upload/batch/BatchTrackSettingsDrawer.jsx`
- `tests/e2e/batch-upload-studio.spec.js`
- `NOIRSOUND_MULTI_UPLOAD_FINAL_VERIFICATION_REPORT.md`

Other dirty files shown by `git status` belong to the existing multi-upload/genre implementation
already present at the start of this continuation pass.

## J. Clear next steps

1. Review the dirty tree and commit the intended multi-upload plus required genre/visibility changes.
2. Run the deployment script against that immutable commit or tag.
3. Run the authenticated production batch smoke and inspect backend/worker logs.
4. Confirm public artist/playlist/Track pages and private/excluded/failed isolation in production.
5. Add stale-draft cleanup later only with dry-run reporting, a configurable threshold, and the
   safety constraints listed above.
