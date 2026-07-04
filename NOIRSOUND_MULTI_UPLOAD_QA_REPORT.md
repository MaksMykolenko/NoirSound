# NoirSound Multi-Upload QA Report

Date: 2026-07-04

## Verdict

`MULTI-UPLOAD PARTIAL`

## Passed checks

### Frontend

- `npm test`
  - 27 test files passed.
  - 136 tests passed.
- `npm run build`
  - Production Vite build passed.
- `npm run lint`
  - Passed with no warnings.

Focused Batch Upload Studio component tests cover:

- Multiple file selection and staging rows.
- Playlist placeholder rendering.
- Clicking a playlist track opens track settings.
- Full settings draft save.
- English genre labels under Ukrainian UI.
- Live playlist title update.
- Accessible order controls.

Existing single-upload tests remain green in the full frontend suite.

### Backend static/unit

- Prisma schema format and validation passed.
- Route and worker syntax checks passed.
- Focused backend Vitest command passed:
  - 3 files.
  - 47 tests.
- Batch unit tests cover:
  - Max file count.
  - Total batch size.
  - MIME/extension validation.
  - Duplicate client id validation.
  - Metadata requirements.
  - Tag sanitization.
  - Strict/partial publish calculations.
  - Storage-key/presigned-URL redaction.

### Browser

- `/upload/batch` loaded successfully in local mock mode.
- Desktop 1440×900 layout rendered without horizontal document overflow.
- Route, stepper, drop zone, single-track return link, and upload navigation were present and accessible.

### Production readiness endpoint

`curl -fsS https://noirsound.co/api/ready` returned:

```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok"
  }
}
```

This verifies the current deployed service dependencies only. It does **not** verify this undeployed batch implementation.

## Added database-backed coverage

`backend/tests/endpoints.test.js` now includes batch integration cases for:

- Authentication and artist access.
- File-count limit.
- Ownership isolation.
- No Track creation during draft init.
- Metadata/genre validation.
- Playlist title validation.
- Idempotent completion.
- Ordered playlist publication.
- Idempotent publish and playlist-item deduplication.
- No upload-generated play events.
- Failed-item retry without duplicate Track creation.

These tests are committed but were not executed locally because the database stack was unavailable.

## E2E status

Added `tests/e2e/batch-upload-studio.spec.js` for the requested four-file scenario:

- Two singles.
- Two playlist tracks.
- Per-track genre and rights editing in the drawer.
- Playlist metadata.
- Browser-to-private-storage upload.
- Worker processing.
- Publication.
- Public catalog and ordered playlist verification.
- Recently-played count unchanged.

Command executed:

```bash
npx playwright test tests/e2e/batch-upload-studio.spec.js --project=chromium
```

Result: 1 skipped. The test’s backend readiness prerequisite failed because local PostgreSQL/Docker was unavailable.

## Blocked checks

- `backend/npm test` could not reset/run the test database because `localhost:5432` was not accepting connections and the Docker daemon socket was unavailable.
- Real MinIO PUT, BullMQ worker processing, database transaction behavior, streaming, and published playlist page were therefore not exercised locally.
- No deployment was performed, so production multi-upload was not tested.

## Exact full-stack verification commands

```bash
npm run local:up
cd backend
npm test
cd ..
npx playwright test tests/e2e/batch-upload-studio.spec.js --project=chromium
```

For a manual local worker run:

```bash
cd backend
npm run dev
```

In a second terminal:

```bash
cd backend
npm run worker
```

In a third terminal:

```bash
npm run dev
```

## Production verification required

After deployment:

1. Apply the Prisma migration.
2. Confirm `/api/ready`.
3. Execute the three-to-five-file artist smoke flow.
4. Verify singles, playlist order, track pages, private/public visibility, and streaming.
5. Verify no new play events were created by upload or publish.
6. Inspect admin uploads/system pages and worker/API logs.
