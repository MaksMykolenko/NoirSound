# NoirSound Followers / Subscriber System — QA Report

Covers Phase 2 of the Stats/Followers/Listening Data Integrity QA pass. See `NOIRSOUND_STATS_DATA_AUDIT.md` for the original bug list (F-1…F-5) and `NOIRSOUND_STATS_DATA_INTEGRITY_REPORT.md` for the overall verdict and bug F-6.

## Source of truth

Followers and following counts are never stored as a denormalized field. `ArtistFollow` has a composite primary key `(userId, artistId)` and no count column anywhere in the schema — every follower/following count shown anywhere in the product is a live `count()`/`_count` query against that table at request time. This is deliberate and structurally safe: there is no cache to go stale, and the composite primary key makes a duplicate follow row a database-level impossibility rather than something application code has to defend against.

## Backend (`backend/src/routes/artists.js`)

`POST /api/artists/:id/follow` requires authentication (`preValidation: [fastify.authenticate]`), is rate-limited to `scaledRateLimitMax(30)` requests/minute keyed by user-or-IP, and performs an `ArtistFollow.upsert` on the composite key — calling it twice creates exactly one row, never two, and never errors on the second call. It blocks a user from following their own artist profile (400) and returns 404 for a nonexistent or hidden artist rather than silently succeeding or leaking existence. It returns `{ success, following: true, followerCount }`, where `followerCount` is the real post-mutation live count, not a client-side increment.

`POST /api/artists/:id/unfollow` uses `deleteMany` rather than `delete`, so calling unfollow when not currently following is a stable no-op (`{ success, following: false, unfollowed: false, followerCount }`) instead of a 404/500. Same auth, same rate limit.

`GET /api/artists/:id` and `GET /api/artists/` both attach `isFollowing` per row via `attachIsFollowing(prisma, artists, optionalUserId(request))`, where `optionalUserId` decodes the auth cookie without *requiring* it — the routes stay fully public for signed-out visitors, but a signed-in viewer's own follow state is correctly reflected instead of defaulting to `false`.

CSRF protection is the app-wide `@fastify/csrf-protection` plugin applied to all mutating routes, including these two; no route-specific exemption exists for follow/unfollow.

## Frontend

`src/components/artists/ArtistCard.jsx` and `src/pages/ArtistPage.jsx` both call the real `followArtist`/`unfollowArtist` API functions (`src/api/artists.js` → `src/api/real/artists.js`), gate the click behind a signed-in check (opening the auth modal instead of firing the request when signed out), disable the button and show a `t('actions.saving')` state while the request is in flight, and only flip the displayed follow state and follower count *after* the API call resolves successfully — a failed request leaves the UI exactly as it was, with a toast/error surfaced, never an optimistic flip that silently reverts or drifts from the real server state. Both components hydrate their initial `isFollowing` from the artist payload's real `isFollowing` field rather than hardcoding `false`, so a user revisiting or refreshing an artist they already follow correctly sees "Following" immediately, not "Follow". `formatNumber()` (compact notation: `0`, `1`, `999`, `1.2K`, `1.4M`) is used for the displayed count in both places, and `ArtistCard.jsx`'s labels are i18n keys (`actions.follow`/`actions.following`/`actions.saving`, `profile.monthlyListeners`) rather than hardcoded English strings.

Bug **F-6** (documented in full in the master report) was found in `ArtistPage.jsx` during this pass: the `followActionPending` state hook was declared after the component's early `return`s for the loading/error/not-found states, which violates React's Rules of Hooks and crashed the page — taking the follow button and follower count down with it — on every real transition from loading to loaded. Fixed by moving the hook above the early returns, with a new regression test that renders the page through that exact transition.

## Requirements checklist (ticket Phase 2)

Idempotent follow: yes, `upsert` on the composite key. Duplicate follows do not inflate the count: yes, structurally impossible, and covered by a test that follows twice and asserts `followerCount` stays `1` with exactly one row in the table. Unfollow decreases count exactly once and is a stable no-op when not following: yes, tested both ways. Follower count matches the database: yes, always a live query, no cache to disagree with. UI updates after follow/unfollow: yes, verified in `ArtistCard.test.jsx` and `ArtistPage.test.jsx` (click → API call → button flips → count updates). Self-follow prevention: yes, 400. Hidden/suspended artist follow behavior: a hidden or nonexistent artist returns 404 from both follow and the underlying artist lookup, so a hidden artist cannot be followed through the UI (its page 404s first). Non-authenticated users get a clear login-required state: yes, the auth modal opens instead of an API call being attempted. CSRF-protected: yes, app-wide. Rate-limited: yes, 30/minute per user-or-IP.

## Tests

Backend — `backend/tests/statsQA.test.js`, `describe('follow / unfollow')`: requires authentication (401 when signed out); follows exactly once even when called twice, and unfollow is a stable no-op (asserts `followerCount`, the raw row count via Prisma, and the artist-read endpoint's `isFollowing`/`_count.followers` all agree); does not let an artist follow their own profile (400); returns 404 for a nonexistent artist. All passing.

Frontend — `tests/components/ArtistCard.test.jsx` (5 tests): renders the follow state from the artist payload as-is (covers the Followed Artists tab case); opens the auth modal instead of calling the API when signed out; follows on click and flips to "Following" only after the API resolves; unfollows on click when already following and calls `unfollowArtist` (not `followArtist`); does not flip state when the API call fails. `tests/components/ArtistPage.test.jsx` (4 tests, new this pass): survives the loading-to-loaded transition without the F-6 hooks-order crash; renders the real follower/monthly-listener counts, not placeholders; hydrates the follow button from the backend's `isFollowing` flag; follows on click and reflects the backend's post-mutation follower count. All passing, no fake fallback counts anywhere in either suite.
