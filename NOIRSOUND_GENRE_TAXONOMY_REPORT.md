# NoirSound — Genre Taxonomy Report

**Pass:** Music Genre Taxonomy Expansion
**Date:** 2026-06-28
**Scope:** Replace the narrow dark/ambient/phonk genre list with a broad, stable, localized taxonomy that can describe a full music catalog — without breaking upload → worker → stream → playback, and without introducing mock data.

---

## 1. What changed at a glance

NoirSound previously recognized roughly seven display genres (Phonk, Lo-fi, Electronic, Rap, Indie, Ambient, Experimental). It now ships a **canonical taxonomy of 107 genres across 15 groups**, with **~90 aliases** for normalization, **localized labels in 4 languages**, and a single shared source of truth used by both the frontend and the backend.

Stable snake_case keys are stored in the database; localized display labels live only in the frontend i18n layer. No translated label is ever persisted.

---

## 2. Single source of truth

The taxonomy data lives in one file and is consumed by both runtimes:

```
shared/musicGenres.json        ← canonical data: { groups[], genres[{key, group, aliases}] }
  ├─ src/constants/musicGenres.js          (frontend ESM view + helpers)
  └─ backend/src/constants/musicGenres.js  (backend CommonJS view + helpers)
```

JSON was chosen for the shared file because the frontend is ESM (`import`) and the backend is CommonJS (`require`); a `.json` import is natively and identically supported by both, so the **data can never drift** between client and server. The small set of pure helper functions (normalize/lookup) is implemented on each side and covered by tests on both.

Each side exposes:

`MUSIC_GENRES`, `GENRE_GROUPS`, `GENRE_KEYS`, `normalizeGenre`, `isSupportedGenre`, `getGenresByGroup`, `getGroupOf`, `getAllGenreKeys`, `getGroupKeys`, `slugifyGenre`.

The frontend i18n-aware helper `src/utils/genreLabels.js` adds `getGenreLabel(key, lang)`, `getGenreGroupLabel(groupKey, lang)`, and `searchGenres(query, lang)`.

---

## 3. Taxonomy structure (15 groups, 107 genres)

| Group key | Display (EN) | Genres |
|---|---|---|
| `popular` | Popular | pop, dance_pop, synth_pop, k_pop, j_pop, hyperpop |
| `urban` | Hip-Hop & Urban | hip_hop, rap, trap, drill, boom_bap, cloud_rap, emo_rap, phonk, grime |
| `rnb_soul` | R&B & Soul | rnb, soul, neo_soul, funk, gospel |
| `rock` | Rock & Alternative | rock, alternative, alternative_rock, indie, indie_rock, punk, punk_rock, post_punk, garage_rock, psychedelic_rock, hard_rock |
| `metal` | Metal | metal, heavy_metal, death_metal, black_metal, doom_metal, metalcore, nu_metal |
| `electronic` | Electronic | electronic, house, deep_house, tech_house, techno, trance, drum_and_bass, dubstep, future_bass, uk_garage, breakbeat, idm, electro, synthwave, vaporwave, ambient, dark_ambient |
| `chill` | Chill & Beats | lofi, chillhop, downtempo, trip_hop, lounge, study_beats |
| `jazz_blues` | Jazz & Blues | jazz, smooth_jazz, bebop, fusion, blues |
| `folk` | Folk & Acoustic | folk, acoustic, singer_songwriter, indie_folk |
| `country` | Country | country, americana, bluegrass |
| `latin` | Latin & Afro | latin, reggaeton, salsa, bachata, afrobeat, amapiano, dancehall, reggae |
| `classical` | Classical | classical, piano, orchestral, opera, instrumental |
| `soundtrack` | Soundtrack & Media | soundtrack, cinematic, game_music, anime, trailer_music |
| `world` | World & Regional | world, ukrainian, polish, balkan, arabic, indian, turkish, african, celtic |
| `experimental` | Experimental | experimental, noise, industrial, avant_garde, spoken_word, podcast, other |

Every required main-genre category from the brief is present, including the full Part-1 key list (`pop, rock, hip_hop, rap, trap, rnb, soul, funk, jazz, blues, electronic, house, techno, trance, drum_and_bass, dubstep, ambient, lofi, phonk, metal, punk, indie, alternative, folk, country, reggae, dancehall, latin, classical, soundtrack, world, experimental`).

Data shape (matches the brief's example):

```js
{ key: 'hip_hop', group: 'urban', aliases: ['hip hop', 'hiphop', 'hip-hop'] }
```

---

## 4. Localization (i18n)

Genre labels were added to the existing `common` namespace (the project already uses a single `common.json` per language), keeping the i18n setup unchanged:

- `genres.<key>` — 107 genre labels per language
- `genreGroups.<groupKey>` — 15 group labels per language

Languages covered: **English (en), Ukrainian (uk), Polish (pl), Russian (ru)** — full coverage, validated programmatically (0 missing keys in any locale).

Examples — backend stores `hip_hop`, UI renders:

| Key | en | uk | pl | ru |
|---|---|---|---|---|
| `hip_hop` | Hip-Hop | Хіп-хоп | Hip-hop | Хип-хоп |
| `electronic` | Electronic | Електроніка | Elektronika | Электроника |
| `phonk` | Phonk | Фонк | Phonk | Фонк |

User-supplied free-text tags are **not** translated — only platform-known genre keys are localized.

---

## 5. Aliases, normalization & legacy compatibility

`normalizeGenre()` maps any legacy/display/free-text value to a canonical key via a slug index built from keys + ~90 aliases. Verified cases:

```
'Phonk'      → 'phonk'
'Dark Synth' → 'synthwave'      (alias)
'Hip Hop'    → 'hip_hop'
'hip-hop'    → 'hip_hop'
'Lo-fi'      → 'lofi'           (alias)
'R&B'        → 'rnb'            (alias)
'DnB'        → 'drum_and_bass'  (alias)
'retrowave'  → 'synthwave'      (alias)
'Vinyl Crackle' → null          (unknown → caller falls back safely)
```

Legacy / unknown handling (no data migration required):

- Old tracks with mixed-case values (`Phonk`, `Dark Synth`, `Lo-fi`, …) display correctly because the UI normalizes at render time.
- A value that cannot be normalized is **displayed verbatim** (never crashes, never shows an error). Optionally it can be treated as `other`.
- No DB migration was performed; `Track.genre` and `ArtistProfile.genres` remain `String`/`String[]` for MVP flexibility (the brief's preferred approach). New writes store normalized keys.

Internal roles/statuses (`ADMIN`, `LISTENER`, `ARTIST`, `SYSTEM_ADMIN`, `ACTIVE`, `BANNED`, …) are **not** genre keys and `isSupportedGenre()` returns `false` for them; the existing role-leak filters in `artistMapper`/`artists` route are preserved.

---

## 6. Files (taxonomy + i18n)

**Created**
- `shared/musicGenres.json` — canonical taxonomy data
- `src/constants/musicGenres.js` — frontend taxonomy + helpers (ESM)
- `backend/src/constants/musicGenres.js` — backend taxonomy + helpers (CJS)
- `src/utils/genreLabels.js` — i18n label/search helpers

**Modified**
- `src/i18n/genreLabels.js` — `getLocalizedGenre()` now normalizes + localizes with safe fallback (kept for backward compatibility)
- `src/i18n/locales/{en,uk,pl,ru}/common.json` — added `genres.*` (107) and `genreGroups.*` (15)

---

## 7. Verification (executed in-sandbox via Node)

- 107 genres / 15 groups, **no duplicate keys, no alias collisions**.
- `normalizeGenre` — 22/22 cases pass (incl. all brief examples).
- Label coverage — 107 genres + 15 groups present and non-empty in all 4 locales (0 gaps).
- All JSON files parse; all module files pass `node --check`.

See `NOIRSOUND_GENRE_VALIDATION_REPORT.md` for the full verification log and remaining gaps.
