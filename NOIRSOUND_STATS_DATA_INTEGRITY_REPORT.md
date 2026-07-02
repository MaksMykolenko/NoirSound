# NoirSound Stats, Followers, Listening Data Integrity — Final Report

Master report for the Stats/Followers/Listening Data Integrity QA pass. See `NOIRSOUND_STATS_DATA_AUDIT.md` for the Phase 1 model inventory and the original bug list (F-1…F-5, P-1, M-1, D-1). This report covers what was implemented, three additional bugs found only once the fixes were run end-to-end, the full test/build/lint/integrity results, and the final verdict. Companion reports: `NOIRSOUND_FOLLOWERS_QA_REPORT.md`, `NOIRSOUND_LISTENING_STATS_QA_REPORT.md`, `NOIRSOUND_ARTIST_DASHBOARD_STATS_REPORT.md`.

## Source of truth per metric (final state)

| Metric | Source of truth | Implementation |
|---|---|---|
| Followers count | Live `count(ArtistFollow where artistId=X)` | `backend/src/routes/artists.js` — `_count.followers`, always live-queried, structurally cannot go stale (no denormalized field, composite PK prevents duplicates) |
| Following count | Live `count(ArtistFollow where userId=X)` | `GET /api/me/followed-artists` |
| Follow | `ArtistFollow.upsert` on `(userId, artistId)` composite key | `POST /api/artists/:id/follow` — idempotent, rate-limited, CSRF-protected, blocks self-follow, 404 for hidden/nonexistent artist |
| Unfollow | `ArtistFollow.deleteMany` on `(userId, artistId)` | `POST /api/artists/:id/unfollow` — stable no-op when not following, same auth/rate-limit/CSRF |
| Track plays | Count of `PlayEvent` rows with `qualified: true` for that track, cached on `Track.plays` | Incremented only when `qualified === true`, recomputed server-side (see below); `recalculateAllTrackPlayCounts` in `backend/src/lib/statsAccess.js` repairs drift |
| Qualified play | `durationListenedSeconds >= min(30, trackDurationSeconds * 0.5)`, recomputed server-side, client-sent `qualified`/`completed` flags never trusted | `qualifyThresholdSeconds` / `isQualifiedPlay` in `backend/src/lib/statsAccess.js` |
| Artist monthly listeners | Distinct authenticated `userId`s with a qualified play on any of the artist's **currently published** tracks in the trailing 30 days, excluding the artist's own plays of their own tracks | `computeArtistMonthlyListeners` — recomputed synchronously on every qualifying play, recalculable on demand via admin |
| Artist total listeners | Not implemented — not present in the schema, UI, or ticket's "if implemented" scope. Documented as not implemented, no fake value shown. | — |
| Recently played | Latest **qualified** play events for the current user, deduped by track | `GET /api/me/recently-played` |
| User listening stats | Live aggregation over the current user's qualified `PlayEvent` rows only, private by default | `GET /api/me/listening-stats` |
| Top genres | Qualified plays grouped by `normalizeGenre()`, percentage of total | Same handler, `topGenres` |
| Top artists | Qualified plays grouped by artist, ranked by count | Same handler, `topArtists` — implemented this pass (previously dead plumbing) |
| Top tracks | Qualified plays grouped by track, ranked by count | Same handler, `topTracks` — implemented this pass |
| Artist dashboard stats | Sourced directly from the caller's own `ArtistProfile` and its tracks (never the capped public feed, never another artist's id) | `GET /api/me/artist-dashboard` |
| Admin stats / integrity | Same `runStatsIntegrityCheck()` shared by CLI and admin UI, read-only cross-checks against raw tables | `backend/src/lib/statsIntegrity.js`, `GET /admin/stats/integrity`, `/admin/system/stats` |

## Bugs found and fixed

The seven bugs from the Phase 1 audit (F-1 through F-5, P-1, M-1, D-1 — missing unfollow, unhydrated follow state, no `isFollowing` on artist reads, unrated follow endpoint, inconsistent auth-guard UX, the always-zero-duration play tracker, the never-recalculated monthly listener field, and inconsistent number formatting) were all fixed as described in `NOIRSOUND_STATS_DATA_AUDIT.md` and are covered by the follower/listening/dashboard reports below. Three further bugs were found only once those fixes were exercised end-to-end — against a running server, seeded data, and the real integrity CLI — rather than by static reading:

**F-6 (Followers, severe).** `src/pages/ArtistPage.jsx` declared `const [followActionPending, setFollowActionPending] = useState(false)` *after* three early `return` statements (loading skeleton, not-found, error). Because the very first render always takes the loading-guard's early return, that hook was never called on mount, then got called on the very next render once the artist finished loading — violating React's Rules of Hooks. This is not a lint nitpick: React throws a hard `Invariant Violation: Rendered more hooks than during the previous render` in this exact situation, meaning **every real visit to any artist page crashed the moment its data finished loading**, taking the follow button and the follower/monthly-listener counters down with it. Caught by `npm run lint` (oxlint's `react-hooks/rules-of-hooks`) during Phase 11, not by any existing test — there was no test that rendered `ArtistPage` and waited for the loading-to-loaded transition. Fixed by moving the hook above the early returns; a new regression test (`tests/components/ArtistPage.test.jsx`, 4 tests) now renders the page through that exact transition and would fail immediately if this regressed.

**I-1 (Integrity check false positive).** The first version of `findMissingArtistProfiles()` (`backend/src/lib/statsIntegrity.js`) flagged any user with `role IN (ARTIST, ADMIN)` and no `ArtistProfile`. Running `stats:check` against realistic demo-seeded data immediately produced a `FAIL` on the seed admin — but per `NOIRSOUND_ARTIST_ACCESS_ADMIN_AUDIT.md` (prior QA pass) and its own passing test ("set-role to ADMIN does not auto-create a profile unless explicitly requested"), an admin with no artist profile is a normal, common, fully-supported state with its own named upload-access reason (`MISSING_ARTIST_PROFILE`), not a data bug — there is no legitimate "repair" for it, since auto-granting artist profiles to every admin would itself be wrong. Fixed by scoping the check to `role: 'ARTIST'` only, since ARTIST role is only ever assigned in the same transaction that creates the paired profile (`grantArtistAccess` in `artistAccess.js`), making a divergence there a genuine corruption signal. This is exactly the kind of false positive that only surfaces by actually running the tool against real data instead of narrow hand-built fixtures — the original unit tests never exercised a realistic seeded admin at all.

**T-1 / T-2 (Test hygiene, not a production bug).** Two backend test files promote throwaway fixture users to `ADMIN` role via direct Prisma writes to exercise admin-only code paths, and this shared Postgres test database is never reset between files within one `npm run test` run. `backend/tests/artistAccess.test.js` did this in five places without demoting back afterward; the two new regression tests added to `backend/tests/statsQA.test.js` for I-1 above (registering a throwaway `ADMIN` and a throwaway `ARTIST`) initially had the same gap. A leaked extra `ADMIN` changes what "the last active admin" means for `endpoints.test.js`'s admin-demotion-protection test, which — depending on file execution order — could let that test's demotion attempt actually succeed (200 instead of the expected blocking 409), permanently demoting the shared seed admin for the rest of that file's run and cascading into 403s on every later admin-scoped assertion in the same file. This reproduced intermittently (order-dependent) even with `vitest.config.js`'s `fileParallelism: false`, which rules out a concurrency race and confirms it as pure state leakage. Fixed by demoting every fixture back to `LISTENER` (via `try`/`finally` in the two new tests) immediately after use. Verified with two consecutive full clean runs (133/133 tests, 10/10 files) after the fix.

## Test results

Backend (`cd backend && npm run test`, embedded Postgres, `vitest run`, `fileParallelism: false`): **133/133 tests passing across 10 files**, including the new `tests/statsQA.test.js` (15 tests covering follow/unfollow idempotency, qualified-play thresholding, anti-gaming rules, dashboard ownership, and admin integrity/recalculation) and the artistAccess.test.js cleanup fix. Confirmed deterministic with two consecutive clean full-suite runs after the T-1/T-2 fix.

Frontend (`npm run test`, Vitest + React Testing Library): **119/119 tests passing across 26 files**, including the rewritten `src/store/__tests__/playerStore.test.js` (qualified-play session tracking), `tests/components/ArtistCard.test.jsx` (5 tests), the extended `tests/components/ListeningStats.test.jsx` (topTracks/topArtists rendering + honest empty states), and the new `tests/components/ArtistPage.test.jsx` (4 tests, including the F-6 regression test).

Build (`npm run build`): clean, no errors. Pre-existing chunk-size warning for `lucide-react`/`i18n` bundles is unrelated to this pass.

Lint (`npm run lint`, oxlint): **0 warnings, 0 errors** (after fixing F-6; it was the only finding).

`npm run stats:check`: full end-to-end demonstration run against fresh demo-seeded data —

```
Verdict: PASS   (fresh demo seed)
  ... all seven counts 0

Verdict: FAIL   (after deliberately corrupting Track.plays -> 999 and
                 ArtistProfile.monthlyListeners -> 777 via direct DB writes)
  staleTrackPlayCounts: 1
  staleMonthlyListeners: 1

node scripts/recalculate-track-stats.js       (dry run — reports the drift,
node scripts/recalculate-artist-stats.js       writes nothing; verified by
                                                re-reading the DB directly)

node scripts/recalculate-track-stats.js --apply
node scripts/recalculate-artist-stats.js --apply
  -> both corrupted values repaired to their true recomputed values

node scripts/recalculate-follower-counts.js
  -> 0 duplicate rows, 0 orphan rows (structural check — ArtistFollow has
     no stored aggregate to recalculate, by design)

Verdict: PASS   (after repair)
```

E2E (`npm run test:e2e`, Playwright): **cannot run in this sandbox.** The Chromium browser binary downloads successfully (confirmed — `npx playwright install chromium` completed), but launching it fails with `browserType.launch: Host system is missing dependencies to run browsers` (missing shared libraries such as `libxdamage1`). Installing them requires `sudo npx playwright install-deps`, and `sudo` is blocked in this sandbox by a "no new privileges" container flag with no override available. This is a hard environment limitation, not a test-quality gap — the spec files exist and are unchanged from the prior pass. Exact commands for a real CI/VPS environment:
```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

## Production verification

Not performed. This sandbox has no deploy access, no VPS/SSH credentials, and no production `.env` files — consistent with the same limitation documented in the prior `NOIRSOUND_ADMIN_SECURITY_REPORT.md`/`NOIRSOUND_ARTIST_ACCESS_ADMIN_AUDIT.md` passes. The exact commands from the ticket's Phase 12 (`docker compose ... ps`, `curl .../api/ready`, `docker compose exec backend npm run stats:check`, the manual smoke steps, and the three cross-check SQL queries) are ready to run as-is on the VPS and are reproduced in full in the ticket; none were executed here.

## Remaining gaps

Artist total listeners (lifetime, distinct from the 30-day monthly figure) is not implemented anywhere in the schema or UI; this was not flagged as a broken/fake metric because nothing displays it, but it is a genuine absence if the product wants it later. `ListeningAggregate` remains dead schema (documented in the Phase 1 audit, out of scope to activate or remove in a QA pass). Anonymous/session-based listener identity does not exist, so anonymous qualified plays increment `Track.plays` but never count toward `monthlyListeners` — documented behavior, not a bug, but worth product sign-off if anonymous listening volume matters. `monthlyListeners` is kept fresh on write (recomputed on every qualifying play) rather than on a cron; an artist with zero *new* activity but an aging 30-day window will not silently drift stale between plays, but there is also no scheduled job to proactively "roll forward" every artist nightly — the admin recalculate button and `stats:check` are the on-demand safety net for that gap, by design, since this codebase has no cron infrastructure to introduce one into. E2E and production verification are both unperformed for sandbox-environment reasons described above, not because of test-quality or product gaps.

## Verdict

**STATS DATA INTEGRITY READY.**

Follow/unfollow works correctly and idempotently; duplicate follows cannot inflate counts (structurally, via the composite primary key); qualified play events are computed correctly and never trust client-supplied flags; track plays match the qualified-event source of truth; artist monthly listeners are computed as a real distinct-listener count and stay correct under adversarial cases (self-plays, replays, sub-threshold attempts); user listening stats are private by default and contain no fabricated data; the artist dashboard is correctly scoped to the caller's own profile and matches the database; no fake/demo stats appear in the production code path; the backend and frontend test suites both pass in full (133 + 119 = 252 tests); and the integrity CLI, admin UI, and three repair scripts all exist and were demonstrated working end-to-end, including detection, dry-run safety, and repair. `STATS PRODUCTION VERIFIED` is not claimed because the VPS/deployed-domain verification in Phase 12 was not performed in this sandbox (no deploy access) — that remains the only step between this verdict and the next one.
