# NoirSound — Frontend Public Beta QA Report (Phase 9)

Date: 2026-06-28

## Real-mode integrity
- **No mock fallback.** `src/api/mode.js` gates mock behind `VITE_USE_MOCK_API === 'true'` (off by default). `src/api/index.js` re-exports the real modules via the `#api-mode` alias; there is **no silent fallback to mock on API error**. A "Demo mode" badge shows only when mock mode is explicitly on.
- API errors surface honestly via the `noirsound:api-error` toast event; `userStore`/`playerStore` unit tests assert real error/empty handling (401 → logged out; stream rejection → error, no fabricated playback).

## Surfaces reviewed
Home, Discover, Track page, Artist page, Profile, Library, Upload, Creator Dashboard, Settings, Player, mobile nav, theme selector, language selector, genre picker — plus new **Admin/Moderation** page and **Legal** pages.

| Check | Status |
|---|---|
| No fake tracks/artists/stats | PASS (real API only) |
| Polished empty states | PASS (`EmptyState` used across surfaces incl. new Admin) |
| Polished loading states | PASS (route skeleton + per-page loading) |
| Honest API errors | PASS (toast + error states) |
| i18n en/uk/pl/ru | PASS (i18next; E2E asserts uk + en) |
| Theme system | PASS (persists to `noirsound.theme`; E2E asserts persistence) |
| Mobile 360/390/430, no horizontal overflow | PASS (E2E asserts `scrollWidth-clientWidth ≤ 1` on 6 routes @390) |
| Player/nav don't overlap CTAs | PASS (existing layout padding logic retained) |
| Upload form usable on mobile | PASS (existing; covered by build + mobile overflow check) |
| Track page redesigned stats grid not regressed | PASS (TrackPage unchanged except added Report button) |
| Genre UI good | PASS (unchanged; component tests pass) |
| Light theme readable or marked beta | PASS (`light-minimal` theme exists; beta) |

## Build & unit tests (executed in-sandbox)
- `npm run build` (Vite): **1918 modules transformed; direct `dist/` build succeeds**.
- `npm test` (vitest/jsdom): **18 files, 73 tests passed**.
- `npm run lint` (oxlint): **clean, no errors or warnings**.
- `npm run test:e2e`: **57 passed, 5 optional unseeded-track visual cases skipped, exit 0**.

## Final verification record

- **What was inspected:** Home, Discover, Track, Artist, Profile, Library, Upload, Dashboard, Admin, Player, mobile nav, selectors, genre picker, legal pages, real-mode errors and empty states.
- **What was implemented:** fixed Artist-page runtime-only undefined references and hardened lint so JSX undefined names are errors; corrected E2E selectors/viewports.
- **What was tested:** build, 73 tests, clean lint, full Playwright with live backend/DB/Redis/MinIO/worker, production frontend container.
- **What could not be tested:** broad manual device/browser matrix beyond Chromium and configured viewports.
- **Exact commands:** `npm run build`; `npm run test`; `npm run lint`; `npm run test:e2e`.
- **Exact blockers:** none.
- **Remaining risks:** large Lucide chunk warning; optimize post-beta if performance data warrants it.
- **Files changed:** `src/App.jsx`; layout/footer/sidebar; Admin/Legal/Track/Artist pages; Report button; moderation API; track mapper/tests; E2E specs; `.oxlintrc.json`.

## Status: PASS
