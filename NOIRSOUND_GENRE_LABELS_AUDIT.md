# NoirSound — Genre Labels Audit (Phase 1)

Scope: locate every place a music **genre or genre-group name** is translated, rendered, validated, or persisted, across frontend, backend, i18n, and tests. This audit only covers genre *names*. It does not touch unrelated i18n strings.

Taxonomy size at time of audit: **107 genres / 15 groups** (`shared/musicGenres.json`, mirrored at `backend/src/shared/musicGenres.json`, byte-identical).

## 1. Source of truth today

| File | Role | Has labels today? |
|---|---|---|
| `shared/musicGenres.json` | Canonical taxonomy: `[{key, group, aliases[]}]` + `groups[]` (group keys only) | No — no `label` field at all |
| `backend/src/shared/musicGenres.json` | Byte-identical copy, used when backend runs standalone (e.g. Docker image containing only `backend/`) | No |
| `src/constants/musicGenres.js` | ESM wrapper: `MUSIC_GENRES`, `GENRE_GROUPS`, `normalizeGenre`, `isSupportedGenre`, `getGroupOf`, etc. | No — pure taxonomy/normalization, no display text |
| `backend/src/constants/musicGenres.js` | CJS mirror of the same wrapper (reads root `shared/musicGenres.json` first, falls back to its own copy) | No |

**Finding:** the taxonomy itself is already 100% key-based and locale-free. The localization problem is entirely in the *display label* layer, not the taxonomy.

## 2. Where genre labels are currently translated

| File | Mechanism | Notes |
|---|---|---|
| `src/utils/genreLabels.js` | `getGenreLabel(key, language)` → `i18n.t(\`genres.${normalizedKey}\`, { lng: language })` | **Primary offender.** Falls back to a humanized key only if the i18n key is missing. |
| `src/utils/genreLabels.js` | `getGenreGroupLabel(groupKey, language)` → `i18n.t(\`genreGroups.${groupKey}\`, { lng: language })` | Same pattern for group headers (used in the genre picker's grouped list). |
| `src/i18n/genreLabels.js` | `getLocalizedGenre(genre)` | Shim that just calls the function above. Used by most track/artist surfaces. |
| `src/i18n/locales/en/common.json` | `genres.*` (107 keys) + `genreGroups.*` (15 keys) | English translations — happen to already equal the desired English labels. |
| `src/i18n/locales/uk/common.json` | `genres.*` + `genreGroups.*` | Ukrainian translations, e.g. `hip_hop`: "Хіп-хоп", `urban` group: "Хіп-хоп та урбан". |
| `src/i18n/locales/pl/common.json` | `genres.*` + `genreGroups.*` | Polish translations, e.g. `electronic`: "Elektronika". |
| `src/i18n/locales/ru/common.json` | `genres.*` + `genreGroups.*` | Russian translations, e.g. `hip_hop`: "Хип-хоп". |
| `src/i18n/locales/*/common.json` | `discover.tabs.{popular,urban,electronic,rock,chill,jazz,world}` | **Second offender**, easy to miss: short, tab-friendly genre-*group* labels for the Discover quick-filter bar (distinct wording from `genreGroups.*`, e.g. `urban` tab = "Hip-Hop" not "Hip-Hop & Urban"). Localized per-language today (uk `world` = "Світова"). `discover.tabs.all` / `discover.tabs.more` are pure UI words and are **not** in scope. |
| `src/components/home/BrowseByGenre.jsx` | `HOME_GENRES` array with `labelKey: 'genres.hip_hop'` / `labelKey: 'discover.tabs.chill'`, rendered via `t(item.labelKey)` | **Third offender.** Home page "Browse by Genre" chips call `t()` directly with a genre/group key baked into the key path — the exact `t(\`genres.${genre}\`)` anti-pattern called out in the task, just pre-formatted per item instead of templated. |

No occurrences of `t(\`musicGenres.${genre}\`)` or `t(\`genreLabels.${genre}\`)` exist in this codebase. `t(\`admin.artistAccess.reasons.${user.uploadAccessReason}\`)` in `AdminUserDetail.jsx` matches the *shape* of the example pattern in the task brief but is unrelated to genres — `uploadAccessReason` is an artist-access-gate reason code (`NOT_ARTIST_ROLE`, `USER_SUSPENDED`, …), not a genre. **Out of scope, left untouched.**

## 3. Where genre labels are rendered (consumers of the localized helpers)

All of these call `getLocalizedGenre()` / `getGenreLabel()` / `getGenreGroupLabel()` and need **no code change** once the helper itself stops localizing — they inherit the fix automatically:

- `src/components/ui/GenrePill.jsx` — generic pill (Discover "active genre" chip, etc.)
- `src/components/ui/GenrePicker.jsx` — searchable grouped picker (upload form + Discover "More"); also calls `getGenreGroupLabel` for group headers and `searchGenres` for the search index
- `src/components/tracks/TrackCard.jsx` — genre badge on track cards (Discover, Home, Artist page singles)
- `src/components/tracks/TrackListItem.jsx` — genre badge on list rows (Discover "All Releases")
- `src/pages/TrackPage.jsx` — genre pill in the hero + genre segment of the OG/meta `description` built client-side via `PageMeta`
- `src/pages/ArtistPage.jsx` — "Focus genres" chip list
- `src/pages/Dashboard.jsx` — artist dashboard track rows (top tracks / published / recent / failed)
- `src/components/profile/ListeningStats.jsx` — "Top genre" stat card, top-tracks rows, genre-breakdown bars

Two sites bypass the helper entirely and print the **raw normalized key** (e.g. `hip_hop`) instead of a label — not a localization bug (a snake_case key isn't Ukrainian/Polish/Russian), but inconsistent with the polished English label shown everywhere else:

- `src/pages/admin/AdminTracks.jsx` (track list "Genre" column)
- `src/pages/admin/AdminTrackDetail.jsx` (detail row)
- `src/pages/admin/AdminArtistDetail.jsx` (`artist.genres.join(', ')`)

These are in scope for Phase 5 cleanup (switch to `getGenreLabel`) since the task explicitly lists "Admin track detail" / "Admin stats" as surfaces to verify.

## 4. Where genre *group* labels are rendered

- `src/components/ui/GenrePicker.jsx` — sticky group headers inside the dropdown/sheet (full form, e.g. "Hip-Hop & Urban", via `getGenreGroupLabel`)
- `src/pages/Discover.jsx` — `QUICK_TABS` quick-filter chips (short form, e.g. "Hip-Hop", via `t(\`discover.tabs.${id}\`)`)
- `src/components/home/BrowseByGenre.jsx` — Home "Browse by Genre" chips for `kind: 'group'` entries (`chill`, `world`), same short form as Discover

Two different English wordings already coexist by design (full "Hip-Hop & Urban" in the picker vs. short "Hip-Hop" on tab chips) — this is an existing product decision, not something this pass should change. Both need to become English-only; see Phase 6 below.

## 5. Where the backend touches genre

Backend has **no i18n framework, no `Accept-Language` handling, and no per-request locale anywhere** (`grep -ri "i18n|locale|Accept-Language" backend/src` matches only a comment). Its API responses are already, incidentally, English-only / label-free:

| File | Behavior |
|---|---|
| `backend/src/routes/uploads.js` | `validateInitBody()` requires `normalizeGenre(genre)` to resolve; persists `genre: normalizeGenre(genre)` (§ line ~191) — the normalized key, never a label. Single write path for track genre; no PATCH/update-genre route exists. |
| `backend/src/routes/artists.js`, `stats.js`, `admin.js` | Every Prisma `select` returns raw `genre` / `genres` fields verbatim (the stored key) — no `genreLabel` field is ever added. |
| `backend/src/lib/pageMeta.js` | Has its **own** local `genreLabel()` humanizer — `String(genre).replace(/[_-]+/g,' ')...titleCase` — used for the OG description and `jsonLd.genre` on `trackMeta()`. It does **not** consult the shared taxonomy, so it loses correct formatting for keys with canonical punctuation (e.g. `hip_hop` → "Hip Hop" instead of "Hip-Hop", `rnb` → "Rnb" instead of "R&B"). Not a *localization* bug (still English, still not request-language-dependent) but a **consistency** bug against Phase 9's requirement that metadata match the on-site label exactly. In scope for a fix. |
| `backend/src/lib/metaRenderer.js` | Pure HTML/JSON-LD assembly; no genre-specific logic. |

**Conclusion:** Phase 8 (backend consistency) is largely already satisfied by the existing design. The one required fix is making `pageMeta.js`'s `genreLabel()` prefer the canonical taxonomy label for known keys, falling back to today's humanizer only for unknown/custom genre strings (so the existing `genreLabel('lo-fi_house') === 'Lo Fi House'` test keeps passing).

## 6. Tests that currently assert *localized* genre labels (will break / need rewriting)

| Test file | Assertion today | Why it breaks |
|---|---|---|
| `src/utils/__tests__/genreLabels.test.js` | `getGenreLabel('hip_hop','uk') === 'Хіп-хоп'`, `getGenreLabel('electronic','pl') === 'Elektronika'`, `getGenreGroupLabel('urban','uk') === 'Хіп-хоп та урбан'` | Directly encodes the localization behavior being removed. |
| `tests/components/TrackPage.test.jsx` | `it('localizes the genre label')` switches to `uk` and asserts `screen.getByText('Реп')` | Encodes the exact anti-goal; must assert the English label persists under `uk`. |
| `tests/components/Home.test.jsx` | `getByRole('button', { name: i18n.t('genres.hip_hop') })` | Depends on the `genres.hip_hop` i18n key, which is being retired from runtime use. Coincidentally still resolves to "Hip-Hop" in `en`, but relies on the exact anti-pattern this pass removes. |
| `tests/components/DiscoverGenres.test.jsx` | `i18n.t('discover.tabs.electronic')` used (twice) to locate the quick-tab button | Depends on `discover.tabs.electronic`, a group-name translation key being retired. |
| `tests/e2e/genre-design.spec.js` | `test('Ukrainian quick tabs render and fit')` asserts `getByRole('button', { name: 'Хіп-хoп' })` is visible under `uk` | Directly encodes the anti-goal; must assert `'Hip-Hop'` instead. |

None of `backend/tests/*` assert localized output (backend never produced it), but `backend/tests/metaRenderer.unit.test.js` under-tests `genreLabel()` (only checks the unknown-value fallback) and should gain a canonical-key case.

## 7. All components/files touched by this pass (summary)

**Data / source of truth:** `shared/musicGenres.json`, `backend/src/shared/musicGenres.json`, `src/constants/musicGenres.js`, `backend/src/constants/musicGenres.js`

**Helpers:** `src/utils/genreLabels.js`, `src/i18n/genreLabels.js` (comment only)

**Components with direct genre-name `t()` calls to remove:** `src/components/home/BrowseByGenre.jsx`, `src/pages/Discover.jsx`

**Components that inherit the fix automatically (no code change):** `GenrePill.jsx`, `GenrePicker.jsx`, `TrackCard.jsx`, `TrackListItem.jsx`, `TrackPage.jsx`, `ArtistPage.jsx`, `Dashboard.jsx`, `ListeningStats.jsx`

**Admin surfaces upgraded from raw key → English label:** `AdminTracks.jsx`, `AdminTrackDetail.jsx`, `AdminArtistDetail.jsx`

**Backend:** `backend/src/lib/pageMeta.js`

**Locale files (remove genre-name-only keys):** `src/i18n/locales/{en,uk,pl,ru}/common.json` — `genres.*`, `genreGroups.*`, and the group-name entries under `discover.tabs.*` (`all`/`more` stay)

**Tests to update:** `src/utils/__tests__/genreLabels.test.js`, `tests/components/TrackPage.test.jsx`, `tests/components/Home.test.jsx`, `tests/components/DiscoverGenres.test.jsx`, `tests/e2e/genre-design.spec.js`, `backend/tests/metaRenderer.unit.test.js`, `backend/tests/genreTaxonomy.test.js` (additive)

**Explicitly out of scope / unaffected:** `src/api/mappers/*` (already key-only), `backend/src/routes/*` genre validation (already key-only, already correct), `AdminUserDetail.jsx`'s `admin.artistAccess.reasons.*` (unrelated feature), sitemap generation (no genre text present), all non-genre i18n strings.
