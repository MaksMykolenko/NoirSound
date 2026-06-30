# NoirSound — Genre UI Polish Report

**Pass:** Music Genre Taxonomy Expansion (frontend)
**Date:** 2026-06-28

This report covers the UI changes that surface the new taxonomy: the upload form, the Discover filters, the shared genre picker, localized genre displays, search, and empty states. No full UI redesign was done — changes are scoped to genre handling.

---

## 1. Shared genre picker — `src/components/ui/GenrePicker.jsx` (new)

A single reusable, accessible, **searchable + grouped, single-select** picker used by both Upload and Discover:

- Trigger button shows the localized selected label (or placeholder).
- Opens a panel with a **search box** that matches by localized label, key, and **alias** (e.g. `dnb` → Drum & Bass, `r&b` → R&B).
- Options are **grouped by category** with sticky group headers, in canonical group order.
- Mobile-friendly: full-width panel, capped height with internal scroll, large tap targets; closes on outside-click / Escape.
- Returns a **stable key** via `onChange(key)`; an inline "Clear" affordance returns to no selection.
- Test hooks: `data-testid="genre-picker-trigger" | "genre-search" | "genre-picker-panel"`, `data-genre-group`, `data-genre-option`.

---

## 2. Upload form — `src/components/upload/UploadForm.jsx`

- Removed the 7-item hardcoded `<select>`; replaced with `GenrePicker` (full grouped, searchable taxonomy).
- The form now submits a **genre key** (e.g. `phonk`) rather than display text.
- Helper text under the picker: *"Choose the closest main genre. Add specific styles as tags."*
- Tags input refreshed for niche styles/moods/language/scene, with helper text and example placeholder *"ukrainian rap, sad, underground, freestyle"*.
- Added a friendly client-side guard: a genre must be chosen before submit.
- The upload pipeline (init → presigned PUT → complete → worker → status poll) is **unchanged**; only the genre value is now a normalized key.

Example flow from the brief: **Main genre** `rap` + **Tags** `ukrainian rap, sad, underground, freestyle`.

---

## 3. Discover — `src/pages/Discover.jsx`

Replaced the single giant horizontal genre row with **smart grouping**:

- Quick tabs (wrap on mobile, never clipped): **All · Popular · Hip-Hop · Electronic · Rock · Chill · Jazz · World · More** — a bounded set (≤ 9 controls).
- **More** opens the full grouped, searchable `GenrePicker` to pick any of the 107 genres.
- Selecting a specific genre shows a **removable chip** (clear/×).
- Filtering is computed on **normalized keys**: group tabs match by `getGroupOf(track.genre)`; a specific selection matches by exact normalized key. Legacy values (e.g. `Dark Synth`) therefore fall under the right group (Electronic) automatically.
- The genre filter combines with the existing search box.

### Search (Part 9)
The Discover search now matches a track by **title, artist name, raw genre, normalized genre key, localized genre label, and tags**. There is currently no backend genre-search endpoint, so this is client-side over the loaded catalog (see the validation report's "gaps").

### Empty & low-data states (Part 10)
- No tracks at all → upload CTA ("Be the first creator to upload one." via the existing upload empty state).
- A genre/group selected but empty → **"No releases in this genre yet."** / *"Be the first creator to upload one."*
- A free-text search with no matches → **"No tracks found for this style yet."**
- No fake/filler tracks are ever shown.

---

## 4. Localized genre displays (Part 8)

Genre text is now localized everywhere it is shown to users:

| Location | File | Change |
|---|---|---|
| Track card badge | `src/components/tracks/TrackCard.jsx` | `getLocalizedGenre(track.genre)` |
| Track row badge | `src/components/tracks/TrackListItem.jsx` | `getLocalizedGenre(track.genre)` |
| Track page (hero + meta) | `src/pages/TrackPage.jsx` | localized; related-tracks now matched on normalized keys |
| Discover quick tabs / chip | `src/pages/Discover.jsx` | group + genre labels localized |
| Genre pill | `src/components/ui/GenrePill.jsx` | added optional `label` prop (keeps `getLocalizedGenre` fallback) |
| Artist focus genres | `src/pages/ArtistPage.jsx` | already localized (unchanged) |
| Dashboard rows | `src/pages/Dashboard.jsx` | already localized (unchanged) |
| Listening stats (top genre + breakdown) | `src/components/profile/ListeningStats.jsx` | already localized; now receives normalized keys from the API |
| Upload success preview | `src/components/upload/UploadForm.jsx` | localized label for the chosen key |

Genre charts/breakdowns already iterate the API's `topGenres` array, so they scale to many categories; values arrive as normalized keys and render as localized labels. Internal roles can never appear (taxonomy keys exclude them and role-leak filters remain).

---

## 5. i18n keys added for the UI

`uploadForm.{selectGenre, searchGenres, noGenreMatch, genreHelper, tagsHelper, tagsPlaceholder}`, `actions.{clear, more}`, `discover.{tabs.*, genreEmptyTitle, genreEmptyDesc, styleEmptyTitle, filterByGenre, browseAllGenres, clearGenre}` — added for **all four languages** (en/uk/pl/ru), validated present (0 missing).

---

## 6. Mobile & no-overflow

- Discover quick tabs use `flex-wrap` → they wrap to a second line on narrow screens instead of horizontally clipping.
- The full 107-genre list is never rendered as a row; it lives in the vertical, scrollable picker panel.
- Picker and chips use ≥ 44px tap targets and full-width mobile layout.

---

## 7. Frontend verification

- All JSX files parse cleanly (acorn + acorn-jsx, isolated install — the project's own `node_modules` were untouched).
- All label/search/group expectations used by the component tests were replicated against the real taxonomy + locale data and **match exactly** (20/20).
- Component tests added: `tests/components/UploadFormGenres.test.jsx`, `tests/components/DiscoverGenres.test.jsx` (see validation report).

> Note: `npm run build` and the Vitest/Playwright suites were **not executed in this sandbox** because the mounted `node_modules` are macOS-native (no Linux esbuild/rollup) and must not be overwritten. Run them in your environment — details and the executable in-sandbox checks are in `NOIRSOUND_GENRE_VALIDATION_REPORT.md`.
