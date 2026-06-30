# NoirSound Project Status Report

**Assessment date:** 2026-06-27  
**Repository:** `/Users/maksymmikolenko/MyProjects/NoirSound`  
**Verdict:** **MVP CANDIDATE**  
**Public-beta verdict:** **NOT A PUBLIC BETA CANDIDATE**

## Current state

NoirSound now has one proven local creator/listener loop using the real React
frontend, Fastify API, PostgreSQL, Redis/BullMQ, private MinIO storage, a live
FFmpeg worker, signed streaming, and Chromium HTML5 playback.

The browser-created proof Track reached `PUBLISHED`; its Upload reached `READY`;
the deterministic waveform contained 100 points; `/stream` returned 302; the
private MP3 returned 206; the player reached 0:01; a truthful playback-start
event was stored; and the Track appeared in Recently Played.

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

## Verified

- Clean PostgreSQL/Redis/MinIO/storage-edge stack starts.
- Development and dedicated test databases are created separately.
- Prisma generate, migrations, and seed complete.
- Upload init atomically persists one real Track and Upload.
- Completion verifies object existence, content type, and byte length.
- Exactly one deterministic BullMQ job is queued.
- Worker downloads, probes, transcodes, generates waveform, uploads, and
  publishes.
- Original, cover, and processed objects all return 403 anonymously.
- Signed processed stream supports browser range playback.
- Real Upload page and real player work without mock fallback.
- Recently Played updates.
- Backend tests: 12/12.
- Frontend tests: 12/12.
- Playwright smoke tests: 2/2.
- Production frontend build passes.
- Backend Node 22/FFmpeg image builds.
- Oxlint has 0 errors and 61 warnings.

## Remaining P1 work

- Commit the currently executed full-infrastructure browser proof as a hermetic
  E2E test.
- Measure listening duration/completion and prevent event abuse/duplication.
- Add stronger file validation, checksums, processing limits, and scanning policy.
- Add revocable sessions, CSRF review, distributed rate limiting, and production
  secret/TLS configuration.
- Replace remaining store-only/static profile, dashboard, playlist, sidebar, and
  seeded catalog behavior in real mode.
- Add moderation review, backups/restore, observability, deployment design, and
  owner acceptance testing.
- Resolve lint and bundle-size warnings.
- Resolve or explicitly accept the three moderate Prisma CLI/dev-chain audit
  findings; the current automated remediation is a breaking major downgrade.

No P0 remains for the narrow local upload → worker → stream → browser playback
MVP. The remaining work blocks public beta and production claims.

## Detailed reports

- [NOIRSOUND_PHASE_9_RUNTIME_FIX_REPORT.md](NOIRSOUND_PHASE_9_RUNTIME_FIX_REPORT.md)
- [NOIRSOUND_UPLOAD_PIPELINE_FIXED_PROOF.md](NOIRSOUND_UPLOAD_PIPELINE_FIXED_PROOF.md)
- [NOIRSOUND_STORAGE_PRIVACY_FIX_REPORT.md](NOIRSOUND_STORAGE_PRIVACY_FIX_REPORT.md)
- [NOIRSOUND_REAL_API_MODE_FIX_REPORT.md](NOIRSOUND_REAL_API_MODE_FIX_REPORT.md)
- [NOIRSOUND_TEST_DB_AND_E2E_PLAN.md](NOIRSOUND_TEST_DB_AND_E2E_PLAN.md)
