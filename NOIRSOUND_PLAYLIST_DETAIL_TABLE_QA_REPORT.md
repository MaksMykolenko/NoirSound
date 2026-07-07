# NoirSound Playlist Detail Table QA Report

Date: 2026-07-07

## Automated results

| Check | Result |
| --- | --- |
| Frontend Vitest (`npm run test`) | PASS — 32 files, 181 tests (chunked into 3 runs to fit the sandbox's per-command time limit; no other change) |
| — new `tests/components/PlaylistPage.test.jsx` | PASS — 20 tests |
| — new `src/api/mock/__tests__/playlists.test.js` | PASS — 5 tests |
| Frontend lint (`npm run lint`, oxlint) | PASS — 0 warnings, 0 errors, 284 files |
| Frontend production build (`npm run build`, vite build) | PASS — completes with 0 errors (see note below) |
| Locale JSON parse (en/uk/pl/ru) | PASS |
| Backend pure-logic unit tests (`playlistTrackView.unit.test.js`) | PASS — 18 tests, no database required |
| Backend route/test syntax (`node --check`) | PASS — `routes/playlists.js`, `lib/playlistTrackView.js`, `endpoints.test.js`, `playlistTrackView.unit.test.js` |
| Backend integration (`cd backend && npm run test`) | BLOCKED before execution — `connect ECONNREFUSED 127.0.0.1:5432`, no Postgres/Docker in this sandbox |
| Playlist detail table Playwright E2E (`npm run test:e2e`) | WRITTEN, NOT EXECUTED — same backend-reachability guard as every other full-stack spec in this repo |
| Production smoke on noirsound.co | NOT RUN — no deployment performed, no browser/screenshot tool available in this session |

Build note: `vite build` initially failed only because the checked-out `dist/` output directory (inside the mounted project folder) contains a stray `.DS_Store` that this sandbox's mount will not allow Node to unlink (`EPERM`, reproduced even with a direct shell `rm`). Building to a scratch `--outDir` instead completes cleanly in under a second with 0 errors — this is a sandbox/mount permission quirk, not a code defect.

## Added coverage

- `PlaylistPage.test.jsx`: header stats/actions (owner vs. non-owner), desktop column headers, album/release/Single fallback resolution, date-added and duration formatting (header total and per-row) via the real formatting utilities, play-from-row wiring into the player store (correct track/queue/source, unavailable tracks excluded from the queue), current-row highlight and pause control, header "Add to queue" dedup wiring, like-button state and toggle, right-click and more-button context menus (owner-scoped Remove hidden from non-owners), reorder buttons gated to owner + custom order and disabled while sorted, remove-track confirmation dialog before the API call fires, parallel desktop/mobile markup, empty state, and an unavailable-track row that exposes no title/artist/cover/play/like control.
- `src/api/mock/__tests__/playlists.test.js`: mock API returns the same enriched playlist-track shape as the real API, never fabricates album/release data, and keeps its `isLiked` field consistent with the player store's demo seed.
- New `tests/e2e/playlist-detail-table.spec.js`: real-backend desktop columns and Single fallback, play-from-row plus `aria-current`, header track-count stats, owner reorder-then-remove-with-confirmation, mobile viewport (table absent from the accessibility tree, mobile row visible, no horizontal overflow), and a private playlist blocked for a logged-out visitor without leaking its track titles into the page.

## Privacy verification specifics

- `backend/tests/endpoints.test.js` (written, blocked on Postgres like the rest of the backend suite) hides a track mid-test and asserts a stranger and a different logged-in non-owner both receive only `{ id, isAvailable: false }` for that row, while the owner still sees the full entry.
- `playlistTrackView.unit.test.js` asserts a private release-fallback playlist's name is hidden from a stranger and visible to its owner/an admin, and that the sanitized track view never contains any of the sensitive raw fields, string-searched directly in the test.
- The new E2E spec's logged-out test asserts the hidden playlist's own track title does not appear anywhere on the empty-state page.

## Regression status

Every pre-existing frontend suite file (32 total, including context menu, player store, track/artist pages, admin console, uploads, lyrics, themes, i18n) stayed green after this pass. `TrackListItem.jsx` (shared by Library/Profile/Search/Artist) was not modified. The pre-existing `React does not wrap state update in act()` warnings on `Home`/`ArtistPage` are unrelated to this change and were present before it.

## Known/documented gaps

- The playlist header's total duration is computed client-side from the currently loaded `tracks` array rather than trusting the backend's own `playlist.durationSeconds` field; both currently agree, but this is a latent staleness risk left untouched to avoid destabilizing a working mutation flow in this pass.
- Column-header click-to-sort was intentionally scoped down to a single shared sort-pill row (applies identically to the mobile list) rather than per-column sortable `<th>`s, per the pass's own explicit allowance to right-size sorting.
- Backend integration tests and the full-stack E2E spec are written but unexecuted in this sandbox (no Postgres/Docker, consistent with the direct predecessor pass's own documented limitation).
- No visual/browser screenshot verification was performed; no browser automation tool was available in this session.

## Verdict basis

The table, header, fallback logic, formatting, player/context-menu integration, privacy handling, mobile layout, accessibility, and i18n are implemented and covered by executable unit/component tests that all pass, plus a written (not run) E2E spec and a written (not run) backend integration test. Because the backend integration suite could not execute and nothing was deployed or manually verified in production, the defensible verdict is `PLAYLIST DETAIL TABLE PARTIAL` — the same category, for the same environmental reason, as the direct predecessor playlist pass.
