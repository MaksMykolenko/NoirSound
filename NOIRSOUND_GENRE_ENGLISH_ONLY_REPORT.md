# NoirSound — Genre Labels English-Only Pass — Report

Status: **GENRE ENGLISH-ONLY READY**

Genre and genre-group names now render in English in every supported UI language (en/uk/pl/ru). The stored/validated genre key, the taxonomy, and backend behavior are unchanged apart from one consistency fix. Full findings are in `NOIRSOUND_GENRE_LABELS_AUDIT.md`; test evidence is in `NOIRSOUND_GENRE_LABELS_QA_REPORT.md`.

## What changed

Three localization sites were removing genre-name translation dependence:

1. **`src/utils/genreLabels.js`** — `getGenreLabel(key, language)` and `getGenreGroupLabel(groupKey, language)` no longer call `i18n.t()`. Both now read the English `label`/`groupLabels` data straight off the shared taxonomy, normalize legacy/alias input first, and fall back to a humanized (never localized) string for genuinely unknown values. The `language` parameter is still accepted (so no call site had to change signature) but is fully ignored.
2. **`src/pages/Discover.jsx`** — the quick-filter tab bar (`QUICK_TABS`) built its labels via `t(\`discover.tabs.${tab.id}\`)`. Genre-group entries (Popular/Hip-Hop/Electronic/Rock/Chill/Jazz/World) now carry a hardcoded English `label` sourced from the new `QUICK_GROUP_LABELS` constant; only the "All" tab still calls `t('discover.tabs.all')`, because "All" is UI chrome, not a taxonomy term.
3. **`src/components/home/BrowseByGenre.jsx`** — the Home "Browse by Genre" chips called `t(item.labelKey)` with a genre/group key baked into the i18n key path (`genres.hip_hop`, `discover.tabs.chill`, …) — the exact `t(\`genres.${genre}\`)` anti-pattern. Replaced with `getGenreLabel()` / `QUICK_GROUP_LABELS` lookups.

Everything downstream of `getGenreLabel`/`getGenreGroupLabel`/`getLocalizedGenre` (GenrePill, GenrePicker, TrackCard, TrackListItem, TrackPage, ArtistPage, Dashboard, ListeningStats) needed **no code changes** — fixing the helper fixed every consumer at once.

Two extra, in-scope polish fixes: `AdminTracks.jsx`, `AdminTrackDetail.jsx`, and `AdminArtistDetail.jsx` previously printed the **raw normalized key** (e.g. `hip_hop`) instead of a label. They now call `getGenreLabel()` too, so admin surfaces show the same polished English label as the public site (this was never a localization bug — a snake_case key isn't Ukrainian — but it's the same surface the task named, so it's fixed for consistency).

## Source of truth

`shared/musicGenres.json` (mirrored byte-for-byte at `backend/src/shared/musicGenres.json`, which the backend prefers only when the repo-root copy is unavailable, e.g. a `backend/`-only Docker image):

```json
{
  "groups": ["popular", "urban", "rnb_soul", ...],
  "groupLabels": { "popular": "Popular", "urban": "Hip-Hop & Urban", ... },
  "genres": [
    { "key": "hip_hop", "label": "Hip-Hop", "group": "urban", "aliases": ["hip hop", "hiphop", "hip-hop"] },
    ...
  ]
}
```

- `key` — unchanged, the stable snake_case value the database/API use. Not touched by this pass.
- `label` — new. English display name, generated once from the (already-correct) English strings previously duplicated in `src/i18n/locales/en/common.json`'s `genres.*` block, so no label was hand-retyped/risked a mismatch.
- `groupLabels` — new top-level map, same provenance (`en/common.json`'s old `genreGroups.*` block).
- `aliases` — unchanged; still required for normalization (`Dark Synth` → `synthwave`, `Hip Hop` → `hip_hop`, etc.) and is taxonomy data, not a translation.
- No `labelUk` / `labelPl` / `labelRu` fields exist anywhere.

`src/constants/musicGenres.js` (ESM) / `backend/src/constants/musicGenres.js` (CJS) expose this as `MUSIC_GENRES` (each entry now carries `.label`), `GROUP_LABELS`, and new pure lookups `getLabelOfKey(key)` / `getLabelOfGroup(groupKey)` — neither accepts a language argument. The frontend module additionally exports `QUICK_GROUP_LABELS`, a deliberately shorter English label set for space-constrained UI (Discover quick tabs, Home genre chips — e.g. "Hip-Hop" vs. the picker's full "Hip-Hop & Urban"); this is a presentation concern, not taxonomy data, so it lives in the frontend constants file only.

## Genre group labels — decision (Phase 6)

**Chose the preferred, English-only approach.** Group names (e.g. "Hip-Hop & Urban", "Jazz & Blues", "World & Regional") are music-taxonomy terms exactly like individual genre names, and the product already had two English wordings in use (the picker's full form and the quick-tab short form) — nothing about the existing design implied either should vary by UI language. Both now come from static English data (`GROUP_LABELS`, `QUICK_GROUP_LABELS`); neither is looked up via i18n.

## Removed / deprecated i18n keys

Removed entirely (all exclusively genre/group-name translations, zero remaining runtime consumers) from **all four** locale files (`en`, `uk`, `pl`, `ru` — `src/i18n/locales/*/common.json`):

- `genres.*` — 108 keys per file (107 genre names + an already-dead `all` key).
- `genreGroups.*` — 15 keys per file (one per group, full form).
- `discover.tabs.{popular,urban,electronic,rock,chill,jazz,world}` — 7 keys per file (quick-tab short form). `discover.tabs.all` and `discover.tabs.more` were **kept** — they're plain UI words ("All"/"More"), not genre names.

Nothing else in any locale file was touched. In particular, `admin.genres` / `admin.genre` (the "Genre(s)" column header word in the admin console) and `admin.artistAccess.reasons.*` (upload-access gate reason codes — unrelated to genres despite superficially matching the `t(\`admin.artistAccess.reasons.${x}\`)` pattern called out in the task brief) remain fully translated, unchanged.

A repo-wide search after the change confirms zero remaining references to any removed key (`grep -rn "genres\.\${\|genreGroups\.\${\|t(\`genres" src backend` → no matches) and zero remaining direct `t()` calls keyed by a genre or group value anywhere in the codebase.

## Backend behavior

The backend needed almost no change — it already had no i18n/locale handling anywhere (`grep -ri "i18n|locale|Accept-Language" backend/src` matches only a code comment) and already returned only the bare, normalized `genre` key in every API response, never a label:

- `POST /uploads/track/init` still requires `normalizeGenre(genre)` to resolve (rejects unknown genres, accepts legacy aliases like `"Hip-Hop"` or `"Dark Synth"`) and persists the **normalized key** — unchanged.
- `GET` routes across `artists.js`, `stats.js`, `admin.js` still `select` and return the raw stored `genre`/`genres` field(s) — unchanged. API shape is, and remains, the "Preferred" shape from the task brief: `{ "genre": "hip_hop" }`, no `genreLabel` field at all.
- The one real fix: **`backend/src/lib/pageMeta.js`**'s `genreLabel()` helper (used only for the OG description and JSON-LD `genre` field on track pages) previously did a naive `replace(/[_-]+/g,' ')` + title-case, which silently produced *wrong* text for keys with real punctuation (`hip_hop` → "Hip Hop", missing the hyphen; `rnb` → "Rnb", not "R&B"). It now prefers the canonical taxonomy label for any known key/alias, falling back to the old humanizer only for genuinely unknown/custom genre strings. This was never a localization bug (the backend has no request-language concept at all) — it was a consistency bug against the on-site label. Verified: `genreLabel('hip_hop') === 'Hip-Hop'`, `genreLabel('lo-fi_house') === 'Lo Fi House'` (unknown value, unchanged fallback), `genreLabel(null) === null` (unchanged).

## Affected UI surfaces (verified English in en/uk/pl/ru)

Upload genre picker · Discover quick-filter tabs and full picker (including group headers) · Track cards · Track list rows · Track page genre pill + client-side meta description · Artist page focus genres · Artist dashboard track rows · User listening stats (top-genre card + genre-breakdown bars) · Home "Browse by Genre" chips · Search-by-genre text filter · Admin track list, admin track detail, admin artist detail. Admin Stats has no genre content (confirmed, nothing to change there). Sitemap generation has no genre text (confirmed).

## Tests

See `NOIRSOUND_GENRE_LABELS_QA_REPORT.md` for the full pass/fail matrix. Summary: every frontend unit/component test (26 files) and every backend test that doesn't require a live Postgres connection (4 files, 73 tests) passes. `npm run build` compiles cleanly (verified via an alternate output directory — the default `dist/` path hits an unrelated, pre-existing sandbox file-permission error unlinking a stray `.DS_Store`). Playwright e2e could not execute in this sandbox (no root access to install the OS-level Chromium dependencies) and the full backend integration suite (`npm run test`) needs a reachable `DATABASE_URL_TEST` Postgres instance that isn't available here — both are documented with exact commands to run in CI/production.

## Production verification

`curl -fsS https://noirsound.co/api/ready` succeeds right now: `{"status":"ready","checks":{"database":"ok","redis":"ok","storage":"ok"}}` — the production site is live and healthy. That is as far as production verification goes in this pass: **these code changes are not yet deployed** (this session has no deploy credentials or CI trigger), so the manual multi-language smoke test (switch to uk/pl/ru, check Discover/Upload/Track-page/Stats) would currently just re-observe the *old*, pre-fix behavior on the live site and shouldn't be read as a check of this work. Deploy first (this repo's existing GitHub → Hostinger pipeline, per `NOIRSOUND_GITHUB_TO_HOSTINGER_DEPLOYMENT_REPORT.md`), then run the 9-step manual smoke test in Phase 11 of the task brief; verdict can be upgraded to **GENRE ENGLISH-ONLY PRODUCTION VERIFIED** once that's done.

## Files changed

Backend: `backend/src/constants/musicGenres.js`, `backend/src/lib/pageMeta.js`, `backend/src/shared/musicGenres.json`, `backend/tests/genreTaxonomy.test.js`, `backend/tests/metaRenderer.unit.test.js`

Shared: `shared/musicGenres.json`

Frontend source: `src/constants/musicGenres.js`, `src/utils/genreLabels.js`, `src/i18n/genreLabels.js`, `src/pages/Discover.jsx`, `src/components/home/BrowseByGenre.jsx`, `src/pages/admin/AdminTracks.jsx`, `src/pages/admin/AdminTrackDetail.jsx`, `src/pages/admin/AdminArtistDetail.jsx`, `src/i18n/locales/{en,uk,pl,ru}/common.json`

Tests: `src/constants/__tests__/musicGenres.test.js`, `src/utils/__tests__/genreLabels.test.js`, `tests/components/{ArtistPage,DiscoverGenres,Home,ListeningStats,TrackPage,UploadFormGenres}.test.jsx`, `tests/e2e/genre-design.spec.js`

New reports: `NOIRSOUND_GENRE_LABELS_AUDIT.md`, `NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md`, `NOIRSOUND_GENRE_LABELS_QA_REPORT.md`

## Remaining gaps

Not deployed (no credentials/trigger available here); Playwright browsers cannot launch in this sandbox (no root, so no OS-level Chromium dependencies); the DB-backed backend integration suite needs a real `DATABASE_URL_TEST` Postgres instance not present here; `npm run build`'s default `dist/` output path is blocked by a pre-existing, unrelated sandbox file-permission artifact (works fine with any other output directory, and will work fine in CI/production, which won't have this specific stray `.DS_Store`).
