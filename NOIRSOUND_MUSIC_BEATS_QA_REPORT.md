# NoirSound Music / Beats QA Report

QA date: 2026-08-28

## Verification boundary

Verification was performed locally against the repository checkout and a local Docker-backed PostgreSQL/Redis/MinIO stack. The additive migration was applied only to the local development database and the isolated test database. No production deploy, production database migration, or manual check on `https://noirsound.co` was authorized or performed.

The checkout contained pre-existing unrelated changes and generated visual artifacts. They were preserved; no reset, clean, stash, commit, push, or deploy was performed.

## Coverage added

Backend coverage includes:

- legacy default to Music and invalid content types;
- Beat metadata normalization, bounds, unsafe-text rejection, and Music clearing;
- safe public serialization;
- batch draft/publication persistence;
- liked-track, public-catalogue, and artist content filters;
- server-side catalogue search before feed limiting;
- public Beat detail and private/hidden visibility rules;
- single Music/Beat upload persistence and validation;
- Music/Beat dashboard aggregation;
- admin list filtering, reason-required type edits, field clearing, and audit logging.

Frontend/component coverage includes:

- single and batch upload selectors/payloads;
- conditional Beat fields and synced-lyrics preservation;
- mapper defaulting/sanitization;
- Home and Discover partitions/filters;
- Beat badge/metadata rendering;
- TrackPage Beat details;
- Artist Music/Beats/Playlists sections;
- Library Music/Beat partitions;
- shared playlist Beat rows;
- Beat context-menu wording, contact, and report;
- dashboard/admin Music/Beat presentation;
- en/uk/pl/ru localization parity.

The full-stack Playwright scenario logs in as an artist, uploads Music and Beat audio through the real presigned-storage/worker path, checks filtered APIs and Beat metadata, searches and switches Discover modes, plays the Beat, opens Beat-specific context actions, adds it to a shared playlist, verifies the playlist row, checks the producer profile and Beat page, and checks the mobile Discover tabs/overflow.

## Command results

Final command results are recorded below after the last implementation changes:

- `npm run test`: PASS, 54 files / 378 tests.
- `npm run test:e2e -- --workers=4 --reporter=line`: PASS, 80 passed / 8 skipped / 0 failed across 88 tests. Skipped checks remain recorded as not executed rather than counted as passes.
- `npm run build`: PASS, Vite production build (353 modules transformed).
- `npm run lint`: PASS (exit 0) with five unrelated pre-existing warnings listed below.
- `cd backend && npm run test`: PASS, 17 files / 250 tests across the runner's five isolated groups. The test runner recreated `noirsound_test_db`, applied all 11 migrations including the Music/Beats migration, and completed minimal/demo seed checks.
- `cd backend && npx prisma validate`: PASS.
- `cd backend && npx prisma migrate deploy`: PASS against the local development database; applied `20260827120000_add_track_content_type_and_beats`.
- `cd backend && npx vitest run tests/musicBeats.unit.test.js`: PASS, 1 file / 22 tests.
- `npx playwright test tests/e2e/music-beats.spec.js --workers=1 --reporter=line`: PASS, 1/1 against the live local API, storage, and worker.

## Known non-failing warnings and skips

- Lint completed with five unrelated pre-existing warnings in `redisPresence.js`, `desktopConnect.js`, and `desktopConnect.unit.test.js`; no Music/Beats lint warning or error remained.
- Playwright prints a Node `NO_COLOR`/`FORCE_COLOR` warning from the runner environment; it is not an application failure.
- Some existing Playwright cases conditionally skip when their own fixture or optional state is unavailable. The final report records the exact pass/skip count and treats skipped checks as not executed, not passed.
- The backend suite prints one existing `pg` deprecation warning about overlapping `client.query()` calls; all backend groups still exited successfully.

## Production verification

`NOT VERIFIED` — the implementation has not been deployed or manually exercised on `https://noirsound.co`. Local verification cannot establish production environment variables, migration state, storage/CORS behavior, CDN behavior, or deployed UI correctness.

## Open QA/product gaps

- Dedicated Artists and Playlists search scopes/results are not implemented.
- No owner Beat-metadata edit surface exists, so no safe owner `Edit beat` context action is exposed.
- There is no distinct editorial Trending Beats shelf; Most played sorting is the implemented trend view.
- Production smoke, production migration confirmation, and manual desktop/mobile visual verification remain outstanding.
