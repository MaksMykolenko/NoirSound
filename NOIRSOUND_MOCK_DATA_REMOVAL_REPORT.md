# NoirSound Mock Data Removal Report

Date: 2026-06-28  
Final verdict: **REAL-MODE CLEAN**

## Outcome

With `VITE_USE_MOCK_API=false`, NoirSound now:

- calls real backend modules selected at build time;
- throws and renders real API failures;
- starts with no authenticated user and treats `/auth/me` 401 as logged out;
- preserves the proven upload init → private PUT → complete → status poll flow;
- streams through `/api/tracks/:id/stream`;
- sets playback active and Recently Played only after `audio.play()` succeeds;
- contains no synthetic playback path;
- shows API/empty/unavailable states instead of fake personal collections or analytics;
- excludes the demo dataset from the emitted real-mode bundle.

## Mock paths removed or isolated

- Moved `src/data/mockData.js` to `src/api/mock/data.js`.
- Added isolated mock modules in `src/api/mock/`.
- Added backend-only modules in `src/api/real/`.
- Added a build-time `#api-mode` alias in `vite.config.js`.
- Added a visible Demo mode badge when the mock build is intentionally selected.
- Deleted local mock-backed comment and playlist stores.
- Removed sample dashboard metrics/chart, sample profile summaries, generated waveform, local follow success, and synthetic playback.
- Kept seed data and test fixtures.

## Backend contract fixes

- Auth hydration includes the real artist profile ID.
- Listening stats return calculated fields only.
- Recently Played and playlist track relations include artist user metadata.
- Track like/unlike persists both relation and count.
- Artist follower counts are returned and follow responses include the real count.

No backend audio processing, queue, FFmpeg, storage-key, or worker logic was changed.

## UX states verified

- Logged out/session 401
- API failure
- Empty tracks/artists/playlists/comments/history
- Track/artist/playlist not found
- Listener role denied for upload/dashboard
- No creator releases or analytics
- Missing liked tracks, personal playlists, followed artists, activity, profile editing
- Missing waveform
- Stream failure
- Upload failure/status-poll failure

## Main files changed

### Frontend API and mode

- `vite.config.js`
- `src/api/client.js`, `src/api/index.js`, `src/api/mode.js`
- `src/api/{tracks,artists,playlists,comments,user,uploads,stats}.js`
- `src/api/real/*`
- `src/api/mock/*`
- `src/api/mappers/*`

### Stores, pages, and components

- `src/store/userStore.js`, `src/store/playerStore.js`
- `src/pages/{Home,Library,PlaylistPage,Profile,Dashboard,TrackPage,ArtistPage}.jsx`
- `src/components/layout/*`
- `src/components/player/Waveform.jsx`
- `src/components/playlists/*`
- `src/components/profile/*`
- `src/components/ui/{CommentSection,CommentItem,ReplyInput}.jsx`
- `src/components/upload/UploadForm.jsx`

### Backend

- `backend/src/routes/{auth,tracks,artists,playlists,stats}.js`
- `backend/tests/endpoints.test.js`

### Tests

- `src/api/__tests__/realMode.test.js`
- `src/store/__tests__/{userStore,playerStore}.test.js`
- `tests/components/{Home,ListeningStats}.test.jsx`
- `tests/e2e/home.spec.js`

## Verification

| Command / check | Result |
|---|---|
| `npm run build` | PASS; real production bundle emitted |
| Real bundle known-mock identity scan | PASS; no `Nightcrawler`, `HyperDrive`, or `you_after_dark` |
| `VITE_USE_MOCK_API=true npm run build` | PASS; explicit demo build remains functional |
| `npm run test` | PASS; 6 files, 15 tests |
| `npm run test:e2e` | PASS; 6 tests |
| `cd backend && npm run test` | PASS; 1 file, 16 tests |
| `npm run lint` | PASS with existing unused-variable warnings; no lint errors |
| In-app runtime check against local backend | PASS; real API track visible, no demo banner or known mock identities |

Vitest was set to one worker after a transient worker-start timeout on a repeated run. The exact `npm run test` command is now deterministic and passes.

## Remaining real-mode gaps

The remaining missing capabilities are documented in `NOIRSOUND_REAL_API_GAPS.md`. They render explicit unavailable states and do not make the application mock-dependent.

## Verdict criteria

- No component imports mock data directly: PASS
- No real API client catches errors and returns mock data: PASS
- No hardcoded authenticated user in real mode: PASS
- Upload/playback cannot fake success in real mode: PASS
- Missing backend data uses honest states: PASS
- Frontend build/tests/E2E and backend tests pass: PASS

**REAL-MODE CLEAN**
