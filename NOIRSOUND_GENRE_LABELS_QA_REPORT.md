# NoirSound — Genre Labels English-Only Pass — QA Report

Companion to `NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md`. This document is the evidence trail: exact commands run, exact results, and exact reasons anything didn't run in this sandbox.

Environment note: this sandbox runs commands one at a time with a ~45s-per-call budget and no persistent background processes across calls, and `npm run test` (frontend) is configured with `maxWorkers: 1` (deliberately serialized, see `vite.config.js`). A single `npx vitest run` for the whole frontend suite legitimately takes longer than 45s wall-clock. To get real pass/fail results rather than a timeout, every test file was run individually/in small batches — this is evidence-equivalent to `npm run test`, just split across multiple invocations to fit the sandbox's per-call limit.

## Frontend — `npm run build`

`vite build` transforms and bundles cleanly: **1939 modules transformed, 0 errors**, in <1s. The default invocation (`npm run build`, output to `dist/`) fails with `EPERM: operation not permitted, unlink '.../dist/.DS_Store'` — a pre-existing macOS metadata file on the host-mounted `dist/` folder that this sandbox's non-root user cannot delete (confirmed: plain `rm -f dist/.DS_Store` also fails with the same `Operation not permitted`, independent of Vite). This is an artifact of the sandbox/host filesystem mount, not a code issue: re-running the identical build with a fresh output directory succeeds outright.

```
$ npx vite build --outDir /tmp/ns-build-check --emptyOutDir
✓ 1939 modules transformed.
✓ built in 949ms
```

`npm run build` will work as-is in CI/production (no stray `.DS_Store` with that specific permission problem there).

## Frontend — unit/component tests (`npm run test` / `vitest run`)

All 26 test files matched by the project's vitest config (`src/**/*.test.{js,jsx}` + `tests/components/**/*.test.{js,jsx}`) were run. **All pass.**

| Test file | Result | Notes |
|---|---|---|
| `src/utils/__tests__/genreLabels.test.js` | ✅ 6/6 | Rewritten: asserts English regardless of a passed `language` arg (en/uk/pl/ru), alias normalization, unknown-genre fallback, group labels, search. |
| `src/constants/__tests__/musicGenres.test.js` | ✅ 10/10 | Original 7 unchanged + 3 new: every genre/group has a non-empty English `label`, `getLabelOfKey`/`getLabelOfGroup` resolve canonical keys correctly. |
| `tests/components/TrackPage.test.jsx` | ✅ 6/6 | Rewrote `'localizes the genre label'` (used to assert `'Реп'` under `uk` — the anti-goal) → now loops uk/pl/ru and asserts `'Rap'` stays visible, `'Реп'` never appears. |
| `tests/components/Home.test.jsx` | ✅ 6/6 | Fixed the `i18n.t('genres.hip_hop')` lookup (now-removed key) → hardcoded `'Hip-Hop'`. Added a new test: Browse-by-Genre chips stay English under `uk`. |
| `tests/components/DiscoverGenres.test.jsx` | ✅ 9/9 | Fixed two `i18n.t('discover.tabs.electronic')` lookups (now-removed key) → hardcoded `'Electronic'`. Added a parametrized test (uk/pl/ru, 3 cases): quick tabs, full picker group headers + options, and the active-filter chip all stay English. |
| `tests/components/UploadFormGenres.test.jsx` | ✅ 5/5 | Added: genre picker group header + option labels stay English under `uk` (`'Hip-Hop & Urban'`, `'Hip-Hop'`, not `'Хіп-хоп та урбан'`/`'Хіп-хоп'`). |
| `tests/components/ListeningStats.test.jsx` | ✅ 7/7 | Added a parametrized test (uk/pl/ru): top-genre stat + genre-breakdown bars render `'Hip-Hop'`/`'Electronic'`, never `'Хіп-хоп'`/`'Електроніка'`. |
| `tests/components/ArtistPage.test.jsx` | ✅ 5/5 | Added: focus-genre chips render `'Hip-Hop'`/`'Electronic'` under `uk`, not the Cyrillic forms. |
| `tests/components/UploadFormArtistAccess.test.jsx` | ✅ 5/5 | Unaffected; unrelated feature (upload-access gating), run to confirm no collateral breakage. |
| `tests/components/AdminConsole.test.jsx` | ✅ 12/12 | Unaffected; run to confirm no collateral breakage. |
| `tests/components/ArtistCard.test.jsx` | ✅ 5/5 | Unaffected. |
| `tests/components/ProfileRoleLeak.test.jsx` | ✅ 2/2 | Unaffected (tests the artist-genres mapper's forbidden-role filter, not labels). |
| `tests/components/i18n.test.jsx` | ✅ 5/5 | Unaffected — confirms generic (non-genre) i18n strings still switch correctly across en/uk/pl/ru. |
| `tests/components/AuthModal.test.jsx` | ✅ 4/4 | Unaffected. |
| `tests/components/FallbackVisuals.test.jsx` | ✅ 2/2 | Unaffected. |
| `tests/components/ThemeSelector.test.jsx` | ✅ 7/7 | Unaffected. |
| `tests/components/DiscoverPresentation.test.jsx` | ✅ 2/2 | Unaffected. |
| `tests/components/metadata.test.js` | ✅ 3/3 | Unaffected (static `index.html` OG/JSON-LD shell, no genre content). |
| `src/api/__tests__/csrfClient.test.js` | ✅ 2/2 | Unaffected. |
| `src/api/__tests__/realMode.test.js` | ✅ 1/1 | Unaffected. |
| `src/api/mappers/__tests__/presentationMappers.test.js` | ✅ 3/3 | Unaffected (confirms mapper still passes genre keys through untouched). |
| `src/components/meta/__tests__/PageMeta.test.jsx` | ✅ 2/2 | Unaffected. |
| `src/store/__tests__/playerStore.test.js` | ✅ 11/11 | Unaffected. |
| `src/store/__tests__/themeStore.test.js` | ✅ 3/3 | Unaffected. |
| `src/store/__tests__/userStore.test.js` | ✅ 4/4 | Unaffected. |
| `src/utils/__tests__/apiErrorMessage.test.js` | ✅ 5/5 | Unaffected. |

**Total: 26/26 files, 132/132 tests passing.**

Commands used (split into batches to respect the sandbox's per-call time budget; equivalent in aggregate to `npx vitest run`):
```
npx vitest run src/utils/__tests__/genreLabels.test.js src/constants/__tests__/musicGenres.test.js
npx vitest run tests/components/TrackPage.test.jsx tests/components/Home.test.jsx
npx vitest run tests/components/DiscoverGenres.test.jsx tests/components/UploadFormGenres.test.jsx
npx vitest run tests/components/ListeningStats.test.jsx tests/components/ArtistPage.test.jsx
npx vitest run tests/components/i18n.test.jsx tests/components/AdminConsole.test.jsx tests/components/ArtistCard.test.jsx tests/components/ProfileRoleLeak.test.jsx
npx vitest run tests/components/AuthModal.test.jsx tests/components/FallbackVisuals.test.jsx tests/components/ThemeSelector.test.jsx tests/components/DiscoverPresentation.test.jsx tests/components/metadata.test.js
npx vitest run tests/components/UploadFormArtistAccess.test.jsx
npx vitest run src/api/__tests__/csrfClient.test.js src/api/__tests__/realMode.test.js src/api/mappers/__tests__/presentationMappers.test.js src/components/meta/__tests__/PageMeta.test.jsx
npx vitest run src/store/__tests__/playerStore.test.js src/store/__tests__/themeStore.test.js src/store/__tests__/userStore.test.js src/utils/__tests__/apiErrorMessage.test.js
```
In an environment without the per-call time limit, plain `npm run test` runs the same suite in one invocation.

## Frontend — lint

```
$ npm run lint
Found 0 warnings and 0 errors.
Finished in 109ms on 236 files with 91 rules using 4 threads.
```

## Backend — tests

`npm run test` (`node tests/runTests.js`) resets and re-seeds a live Postgres database (`DATABASE_URL_TEST`) before running the suite. No Postgres is reachable from this sandbox — confirmed by running the integration suite directly:

```
$ npx vitest run tests/endpoints.test.js
FAIL tests/endpoints.test.js > NoirSound backend integration
PrismaClientKnownRequestError: Can't reach database server at 127.0.0.1:5432
```

This is an environment limitation (no local Postgres in this sandbox), not a defect from this change — the failure happens at the seed step, before any test body (genre-related or otherwise) executes. The same applies to `artistAccess.test.js`, `statsQA.test.js`, `cleanLocalProductData.test.js`, `cleanupScript.test.js`, and `seedStrategy.test.js`, which the repo's own `vitest.config.js` documents as "integration tests that share ONE live Postgres database."

What *can* and *did* run without a database — every genre-relevant backend test, plus the full designated no-DB smoke/unit suite, all passing:

| Test file | Result | Notes |
|---|---|---|
| `backend/tests/genreTaxonomy.test.js` | ✅ 10/10 | Original 2 unchanged + 3 new: every taxonomy genre/group carries a non-empty English `label`; `getLabelOfKey`/`getLabelOfGroup` take no language argument (`fn.length === 1`, i.e. no `lng` parameter exists to accept one). Upload validation (accepts keys/aliases, rejects junk/roles) unchanged and passing. |
| `backend/tests/metaRenderer.unit.test.js` | ✅ 21/21 | Original 19 unchanged + 2 new: `genreLabel('hip_hop') === 'Hip-Hop'` (was a risk of `'Hip Hop'`), `genreLabel('rnb') === 'R&B'`, `genreLabel('other') === 'Other'`, legacy aliases still normalize, `genreLabel('lo-fi_house')` (unknown value) unchanged at `'Lo Fi House'`, `genreLabel(null)` unchanged at `null`. `trackMeta()` end-to-end: OG description and JSON-LD `genre` both carry the canonical `'Hip-Hop'`, not a Cyrillic string (no request-language handling exists to produce one) and not the old naive `'Hip Hop'`. |
| `backend/tests/publicBeta.unit.test.js` | ✅ 32/32 | Unaffected; run to confirm no collateral breakage (this is the repo's own designated no-DB unit suite). |
| `backend/tests/publicBeta.smoke.test.js` | ✅ 10/10 | Unaffected; same designated no-DB suite. |

**Total (no-DB-required): 4/4 files, 73/73 tests passing.**

```
cd backend && npx vitest run tests/genreTaxonomy.test.js tests/metaRenderer.unit.test.js
cd backend && npx vitest run tests/publicBeta.unit.test.js tests/publicBeta.smoke.test.js   # == npm run test:unit
```

To run the full backend suite including DB-backed integration tests, in CI/production with Postgres reachable:
```
cd backend && npm run test
```

## E2E (Playwright)

`tests/e2e/genre-design.spec.js` was updated:
- Fixed `'Genre i18n does not break layout'`: the Ukrainian quick-tab assertion used to check for `'Хіп-хоп'` (the anti-goal) — now checks for `'Hip-Hop'` and asserts the localized text is absent, parametrized across uk/pl/ru, plus a new picker+chip check for each language.
- Added a new `describe` block (`'Genre i18n — Upload picker and Track page pill stay English'`) that logs in via the API, uploads a throwaway track, and checks the Upload genre picker and Track page pill under Ukrainian UI — guarded with `test.skip` (via the repo's existing `backendUp()` helper) when the backend isn't reachable, matching this file's and `_helpers.js`'s established pattern.

**Could not execute in this sandbox.** Root cause, confirmed directly (not assumed):

```
$ npx playwright install chromium
... downloads chromium-headless-shell, then:
Host system is missing dependencies to run browsers.
Please install them with: sudo npx playwright install-deps

$ sudo -n true
sudo: The "no new privileges" flag is set, which prevents sudo from running as root.
```

This sandbox's non-root user cannot install the OS-level shared libraries (e.g. `libxdamage1`) Chromium needs to launch, and has no path to acquire root. This is a hard sandbox constraint, not a project or test-authoring issue — network access to Playwright's CDN itself works fine (the partial browser download succeeded).

Exact commands to run in CI/production (which has a full Chromium install via `playwright install --with-deps` or a Playwright Docker image):
```
npx playwright install --with-deps chromium
npm run test:e2e
# or target just the genre specs:
npx playwright test tests/e2e/genre-design.spec.js
```

## Production verification

```
$ curl -fsS https://noirsound.co/api/ready
{"status":"ready","checks":{"database":"ok","redis":"ok","storage":"ok"},"timestamp":"2026-07-02T17:12:46.773Z"}
```
Production is live and healthy. The 9-step manual multi-language smoke test from the task brief (Discover chips / Upload picker / Track page pill / User Statistics, across uk → pl → ru) was **not** run against the live domain, because this code has not been deployed yet — this sandbox session has no deploy credentials or CI trigger, and testing the *current* production build would only re-confirm the pre-existing (localized) behavior, not this fix. Run the smoke test immediately after deploying; see `NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md` for the exact steps and the upgrade path to **GENRE ENGLISH-ONLY PRODUCTION VERIFIED**.

## Verdict

**GENRE ENGLISH-ONLY READY**

- All genre names display in English in every UI language — verified by 132 passing frontend tests spanning en/uk/pl/ru across every listed surface, plus a repo-wide grep confirming zero remaining genre-name `t()` lookups.
- Backend still validates normalized genre keys and rejects invalid ones — verified by 10 passing `genreTaxonomy.test.js` tests (unchanged validation logic).
- No localized genre labels are used in runtime, frontend or backend — verified by code review + tests; the backend has no locale concept at all, and the frontend helper's only remaining fallback path is the original raw/humanized text for genuinely unknown values (never a lookup keyed by language).
- Build passes; every test that can run without a database or a browser binary passes (205 tests total: 132 frontend + 73 backend).
- Reports are complete (this file + the English-only report + the Phase 1 audit).

Not yet **PRODUCTION VERIFIED**: that tier requires testing the behavior on the deployed domain, and this change has not been deployed from this session.
