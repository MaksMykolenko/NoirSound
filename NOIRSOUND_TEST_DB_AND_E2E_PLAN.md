# NoirSound Test Database and E2E Plan

**Date:** 2026-06-27  
**Current test-DB result:** **PASS**

## Dedicated database strategy

Local clean PostgreSQL initialization creates:

```text
noirsound_db
noirsound_test_db
```

Environment:

```env
DATABASE_URL=postgresql://.../noirsound_db?schema=public
DATABASE_URL_TEST=postgresql://.../noirsound_test_db?schema=public
```

`backend/tests/runTests.js`:

1. loads the backend environment;
2. requires `DATABASE_URL_TEST`;
3. rejects `NODE_ENV=production`;
4. rejects database names that do not contain `test`;
5. creates the test database if it is absent;
6. sets `DATABASE_URL` to the test URL for child processes;
7. runs Prisma generate;
8. runs `prisma migrate reset --force`;
9. seeds the isolated test database;
10. runs Vitest.

Guard proof:

```text
DATABASE_URL_TEST=.../noirsound_db node tests/runTests.js
→ Refusing to reset database "noirsound_db"
→ exit 1
```

The development database remained the target of the live runtime proof and was
not reset by `npm run test`.

## Current automated coverage

Backend integration tests: **12/12 PASS**

- health;
- authentication;
- upload auth and role enforcement;
- init creates exactly one linked Track and Upload;
- completion rejects a missing object;
- completion verifies metadata and queues one job;
- status reads real state;
- duplicate completion is rejected;
- stream rejects unprocessed Track;
- stream redirects a published processed Track;
- worker failure writes valid failure statuses and safe errors.

Frontend tests: **12/12 PASS**

- auth modal behavior;
- player/store behavior;
- real-mode user stats do not fabricate data.

Committed Playwright smoke tests: **2/2 PASS**

- title/home render;
- navigation links.

Build/static checks:

- Oxlint: 0 errors, 61 warnings;
- Vite production build: PASS;
- backend Node 22/FFmpeg Docker image: PASS;
- Compose config: PASS.
- frontend dependency audit: 0 vulnerabilities;
- backend dependency audit: 3 moderate, 0 high, 0 critical, currently limited
  to the Prisma CLI/dev dependency chain.

## Full-stack runtime E2E executed in Phase 9

A browser-driven, real-infrastructure proof covered:

```text
Chromium
→ Fastify auth
→ PostgreSQL Track/Upload
→ presigned PUT through storage edge
→ private MinIO
→ completion
→ Redis/BullMQ
→ live worker
→ FFprobe/FFmpeg
→ processed private MP3
→ PostgreSQL PUBLISHED/READY
→ signed 302
→ MP3 206 range playback
→ play-event
→ Recently Played
```

This passed, but it is not yet committed as a hermetic test because it depends
on live processes and a generated legal media fixture.

## Next E2E implementation plan

### P1: committed full-infrastructure test

Add a dedicated Playwright project and setup that:

1. starts the clean Compose dependency stack;
2. migrates/seeds `noirsound_test_db`;
3. starts API and worker with test-specific DB, bucket, and queue names;
4. generates a 2–4 second sine-wave WAV and deterministic PNG fixture;
5. logs in through the browser;
6. uploads both files through the real Upload page;
7. waits for `READY`;
8. asserts PostgreSQL links and final fields;
9. asserts anonymous original/cover/processed requests return 403;
10. opens the generated Track page and asserts 302 → 206 playback;
11. asserts player progress, play event, and Recently Played;
12. deletes the test bucket objects, queue jobs, and database records.

### Isolation requirements

- Use `noirsound_e2e_test_db`, not development.
- Use an E2E-only bucket or unique key prefix.
- Use an E2E-only BullMQ queue prefix.
- Fail closed if any URL contains a production hostname.
- Never print cookies, credentials, or signed URLs.
- Use fixed legal synthetic fixtures.
- Capture API/worker/container logs as test artifacts on failure.

### Additional P1 cases

- queue unavailable after completion claim;
- worker retry then terminal failure;
- corrupt audio that passes object metadata but fails FFprobe;
- content type and content length mismatch;
- expired presigned PUT and signed GET;
- hidden/failed/unprocessed stream authorization;
- two concurrent completion requests enqueue once;
- browser upload and playback at mobile viewport;
- measured play duration and completion telemetry.

## Files changed

- `backend/docker/postgres/init-test-db.sql`
- `backend/docker-compose.yml`
- `backend/.env.example`
- `backend/package.json`
- `backend/tests/runTests.js`
- `backend/tests/endpoints.test.js`
- `package.json`
- `vite.config.js`
- `tests/e2e/home.spec.js` (existing smoke suite retained)

## Verdict

Test DB isolation is fixed. The runtime E2E has been executed successfully.
Promoting that proof into a hermetic committed test remains P1 and is not a
blocker to the current local **MVP CANDIDATE** verdict.
