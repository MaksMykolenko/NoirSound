# NoirSound Current State Summary

**Date:** 2026-06-27  
**Verdict:** **MVP CANDIDATE**  
**Public beta:** **Not ready**

## Proven now

- Real browser Upload page persists Track + Upload.
- Private presigned audio and cover PUTs succeed.
- Completion verifies objects and queues one BullMQ job.
- Worker runs FFprobe/FFmpeg, writes a deterministic waveform, stores a private
  MP3, and reaches `PUBLISHED`/`READY`.
- `/stream` returns a signed 302; Chromium receives 206 and advances playback.
- Play event and Recently Played update after playback starts.
- Anonymous original, cover, and processed requests return 403.
- Backend tests 12/12, frontend tests 12/12, Playwright smoke tests 2/2.
- Frontend build and Node 22/FFmpeg backend image build pass.
- Tests reset `noirsound_test_db`, not the development database.

## Scores

| Category | Score |
|---|---:|
| Frontend demo | 90/100 |
| Frontend real API | 82/100 |
| Backend API | 78/100 |
| Audio pipeline | 94/100 |
| Local runtime | 91/100 |
| Tests | 68/100 |
| Security | 52/100 |
| Public beta | 25/100 |
| Production | 12/100 |

## Remaining priority

There is no P0 for the narrow local MVP media loop. P1 work includes a committed
full-infrastructure E2E test, measured/deduplicated playback telemetry, stronger
upload security, session/CSRF/rate-limit hardening, moderation, backups,
observability, deployment planning, and replacing remaining static/store-only
real-mode surfaces. The backend also has three moderate Prisma CLI/dev-chain
audit findings; there are no high or critical findings.

Full detail: [NOIRSOUND_PHASE_9_RUNTIME_FIX_REPORT.md](NOIRSOUND_PHASE_9_RUNTIME_FIX_REPORT.md)
