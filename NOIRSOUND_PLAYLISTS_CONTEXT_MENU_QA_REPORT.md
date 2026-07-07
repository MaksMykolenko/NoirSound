# NoirSound Playlists + Context Menu QA Report

Date: 2026-07-05

## Automated results

| Check | Result |
| --- | --- |
| Frontend Vitest | PASS — 30 files, 156 tests |
| Frontend lint | PASS — oxlint, no warnings |
| Frontend production build | PASS |
| Locale JSON parse (en/uk/pl/ru) | PASS |
| Backend public-beta unit/smoke | PASS — 42 tests |
| Prisma schema validation | PASS |
| Playlist route/test syntax | PASS |
| Playlist backend integration | BLOCKED before execution — test PostgreSQL/Docker daemon unavailable |
| Playlist Playwright E2E | 3 SKIPPED — backend reachability guard |
| Production smoke | NOT RUN — no deployment performed |

## Added coverage

- Context menu: right-click, Shift+F10, Arrow navigation over disabled actions, Enter, Escape, focus restore, viewport clamping, and native editable-field exception.
- Player store: play-next without duplicates, batch queue append, and move ordering; action builders cover lazy playlist-detail playback.
- Backend integration spec: auth, CSRF, validation, create/edit/delete permissions, private owner/non-owner access, unavailable/duplicate track rejection, ordered detail, save idempotency, `/me`, cover verification, remove, and delete.
- Playwright spec: owner create/edit/delete, track and playlist menus, keyboard invocation, editable search exception, and mobile viewport containment.

## Manual local browser smoke

- Mock library rendered user/saved playlists.
- Right-click on a playlist opened the custom action list.
- Mobile action-sheet rendering exposed play, shuffle, queue, save/remove, open, share, and copy actions.
- A later desktop viewport inspection was interrupted by the in-app browser connection timing out; desktop behavior remains covered by component tests and the unexecuted full-stack Playwright spec.

## Regression status

- Existing player, queue, likes, qualified playback, lyrics/fullscreen lyrics, uploads, stats, admin, theme, and auth component tests remained green.
- The separate requested fullscreen label “плеєр із текстом” was removed without changing track title/artist rendering.

## Verdict basis

The implementation is feature-complete for the requested playlist MVP surfaces, but the strict MVP gate requires executable backend integration and E2E results. Because the local test database was unavailable and production was not deployed, the defensible verdict is `PLAYLISTS CONTEXT MENU PARTIAL`.
