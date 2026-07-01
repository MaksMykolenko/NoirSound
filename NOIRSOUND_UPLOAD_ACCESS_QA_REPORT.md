# NoirSound Upload Access — QA Report

## What this covers

QA evidence for the upload-page side of the fix (the friendly fallback replacing the raw 422), the automated test results across backend and frontend, the E2E attempt and why it did not complete, and the disposition of Phase 13 (production verification).

## Before / after at the upload endpoint

Before this pass, `POST /api/uploads/track/init` returned, on a missing profile:

```
422 { "error": "An ArtistProfile is required before uploading tracks." }
```

a free-text sentence with no machine-readable code, and no distinction between "no profile" and "profile exists but is hidden" (hidden profiles were not checked at all — a gap in the original bug report). The frontend had no choice but to either show that raw sentence or something equally generic.

After this pass:

```
422 { "error": "ARTIST_PROFILE_REQUIRED", "message": "...", "uploadAccessReason": "MISSING_ARTIST_PROFILE" | "ARTIST_PROFILE_HIDDEN" }
```

`uploadAccessReason` is one of a fixed, frozen set (`NOT_ARTIST_ROLE`, `MISSING_ARTIST_PROFILE`, `ARTIST_PROFILE_HIDDEN`, `USER_SUSPENDED`, `USER_BANNED`, `USER_DELETED`) shared verbatim between the upload route, the admin API, and the UI's translation keys (`admin.artistAccess.reasons.*`), so the reason a user sees on the upload page and the reason an admin sees on that user's detail page are guaranteed to describe the same evaluation, computed once by `evaluateUploadAccess()` in `backend/src/lib/artistAccess.js`.

## Upload page behavior (verified by test, not just by review)

`src/components/upload/UploadForm.jsx`:

- A user whose `canUploadTracks` is `false` never reaches the upload form. Instead they see a plain "Artist profile not ready" panel (`data-testid="artist-profile-not-ready"`) with human copy ("Your artist profile is not ready yet. Please contact an admin or complete your artist profile before uploading tracks."). Verified by `tests/components/UploadFormArtistAccess.test.jsx`, which also asserts the panel's text never contains `ArtistProfile is required`, `ARTIST_PROFILE_REQUIRED`, or `422`.
- The only user who gets a self-service escape hatch is an `ADMIN` whose specific block reason is `MISSING_ARTIST_PROFILE` — they see a "Create my artist profile" button that calls `POST /auth/me/ensure-artist-profile` and refreshes their session. Verified: the button is present and functional for that exact case, and absent for a non-admin artist in the same missing-profile state, and absent for an admin blocked for a *different* reason (e.g. a hidden profile — an admin cannot silently unhide their own profile from the upload page; that still requires another admin's action).
- Even after the role/profile gate passes, the submit handler still checks for `err.code === 'ARTIST_PROFILE_REQUIRED'` on the actual upload call and shows the same friendly copy rather than a raw error, covering the edge case where access changes between page load and submit (e.g. another admin hides the profile mid-session).

## Automated test results

Backend (`cd backend`, `prisma migrate`, seed, `vitest run`): **9 test files, 118 tests, all passing.** This includes the full pre-existing suite (`endpoints.test.js`, `publicBeta.smoke.test.js`, `publicBeta.unit.test.js`, `genreTaxonomy.test.js`, `metaRenderer.unit.test.js`, `seedStrategy.test.js`, `cleanupScript.test.js`, `cleanLocalProductData.test.js` — zero regressions) plus the new `artistAccess.test.js` (20 tests).

Frontend (`npm run test`): **24 test files, 102 tests, all passing.** `npm run lint` (oxlint): 0 errors. `npm run build` (vite): succeeds.

Both suites were run against a real, migrated, seeded Postgres database (an embedded/portable Postgres instance, since this sandbox has no Docker or root access) rather than mocks — the backend suite exercises real transactions, real unique-constraint races, and real session deletion.

## E2E (Playwright) — attempted, did not complete, reason confirmed

The ticket's 9-step E2E flow (login as admin → `/admin/users` → find test user → grant artist access → confirm ready → login as that user → open upload page → upload form available → no "ArtistProfile is required" error) was not run end-to-end. This was tested directly rather than assumed:

1. `playwright install chromium --with-deps` failed: the sandbox has no root and the `no new privileges` flag blocks `sudo`, so OS-level dependency installation is not possible.
2. `playwright install chromium` (browser binary only, no OS deps) succeeded — a ~187 MB download completed.
3. Launching it anyway failed with a host-validation error naming missing shared libraries (e.g. `libxdamage1`) that only `sudo apt-get` or `sudo npx playwright install-deps` can supply — neither is available.

This is an environment limitation, not a gap in the implementation: every user-facing behavior the E2E flow would have exercised is independently covered by the backend integration tests (real HTTP requests through the real Fastify server against a real database, including the grant → upload-succeeds transition and the hidden-profile → blocked transition) and the frontend component tests (the same UI states and button flows, minus real browser navigation). Whoever has an environment with Playwright's OS dependencies available (or CI, which typically does) can run `npm run test:e2e` directly — nothing in this pass changed the E2E harness itself.

## Phase 13 — production verification: not performed

No deployed domain or production credentials are available in this sandbox (checked `.env`/`.env.example` and the repo for any configured production URL — none present). `curl https://<domain>/api/ready` and the manual smoke steps below were not run. This was flagged as a likely outcome in the Phase 1 audit before implementation began, and is confirmed here rather than assumed.

For whoever deploys this, the manual smoke steps to close out Phase 13 are:

1. `curl https://<production-domain>/api/ready` — confirm `200` and all dependency checks (`database`, `redis`, `storage`, `worker`, `ffmpeg`) report healthy.
2. Log in as an existing admin. Open `/admin/users`, find a test listener account, confirm the new "Artist Profile" and "Upload Access" columns/badges render and the two new filters work.
3. Open that user's detail page, confirm the "Artist Access" panel is present and shows "Profile missing" / "Upload blocked · No artist profile exists yet."
4. Click "Grant Artist Access," confirm the modal requires a reason, submit it, confirm the panel updates to "Can upload tracks: Yes" and an audit entry appears.
5. Log in (or impersonate, per whatever tooling exists) as that user, open the upload page, confirm the real upload form renders — no "ArtistProfile is required" text anywhere.
6. Revoke artist access on the same user from the admin panel, confirm the upload page reverts to the friendly blocked state, not a raw error.
7. Repeat step 4-5 for a user who already holds `role = ADMIN` and confirm "Create Artist Profile" behaves identically without altering their role.

## QA verdict

Everything that can be verified inside this sandbox has been verified with real tests against a real database and a real rendered UI, and two genuine regressions (a dropped `data-testid` on `AdminPanel`, and a broken generic-"Confirm" label on the pre-existing danger-zone modals) were caught and fixed by writing and running these tests rather than shipping on review alone. E2E and Phase 13 remain open only because this environment cannot run a browser or reach a production deployment — both are concretely documented above rather than silently skipped.
