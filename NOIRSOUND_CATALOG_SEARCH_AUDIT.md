# NoirSound: catalog/search audit

Audit date: 2026-09-04. This document records the starting state and the intended correction before the consumer changes. Current implementation and executed checks are recorded separately.

## Source and isolation

- Working directory: `/Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Catalog Search`.
- Branch: `codex/catalog-search-pagination`; starting HEAD: `79b43b5a93f356e4cc4c6224ab9676dfe3713c73`.
- Source: the dirty `NoirSound Design Baseline` worktree, including its design changes, functional tests, untracked implementation and deleted visual tests. Copied 2,706 files and preserved six tracked deletions. Full hashes, source status and omissions: `artifacts/catalog-search/inherited-source-manifest.json`.
- The source preview on localhost:54193 and its database/services remain separate. Catalog verification uses its own Compose project, database, storage and ports. No original checkout reset, stash, clean, commit, push or deployment.

## Consumer map

| UI surface | Endpoint/query at baseline | Actual limit/problem | Required change |
| --- | --- | --- | --- |
| Discover results | `useDiscoverTracks` → `GET /api/tracks` → Prisma filtered list | Explicit 60 items; server maximum 60; local genre/beat filtering and recent/played sorting of those rows; no continuation | Add catalog response with server filters/order, keyset pages, total and infinite query |
| Discover taxonomy/style/mood/key counts | Two extra `/tracks?limit=60` requests | Counts over the first 60; fallbacks disguise unavailable aggregate data as partial/zero values | Full authorized DB aggregates, excluding each facet's own dimension |
| Discover trending/editorial | `/tracks?sort=trending&limit=10` plus client fallback ranking | Seven-day qualified plays could fall back to lifetime plays; View All only scrolled a partial list | Preserve real seven-day semantics and route View All into matching catalog query |
| Header/search helper | Desktop readonly search navigation; `searchTracks` loads capped `/tracks` then filters again in JS | No complete search; tag/credit/alias semantics differ | Shared server `q`, debounced URL state and cancellation |
| Home new Music/fresh Beats | `getTracks()` → `/tracks` default 20, then local type filter/sort/slice8 | A type can vanish when other-type uploads fill the first20 | Two bounded server selections (Music8, Beat8); View All preserves type/sort |
| Home creators | `/artists?hasPublishedTracks=true` plus ranking against capped Home rows | Public eligibility must match public catalog; sample data is not a catalog statistic | Preserve editorial section; use public creator aggregates instead of sample-derived ranking |
| Artist detail | `/artists/:id/tracks` | Existing full artist list, separate public conditions | Reuse public visibility conditions; preserve response shape |
| Track related selection | `getTracks()` first20 then type/genre filter/slice4 | Related tracks outside first20 never considered | Bounded server genre/type query; exclude current track after selection |
| Library | Real `/me/liked-tracks`, `/me/followed-artists`, `/me/playlists`; `getTracks()` only in mock mode | Real collection does not use catalog cap | Preserve collection contracts and Music/Beat tabs |
| Playlist/upload/admin | Dedicated existing endpoints | Not catalog consumers | Preserve API shapes; regression checks cover their behavior |

## Existing data and policy

`Track` remains the shared Music/Beat entity. Credits are `primaryArtistName` and `featuredArtists[]`, tags are `tags[]`; there is no new credits table. The publication/moderation state is `Track.status`; public discovery requires PUBLISHED, isPublic, a visible ArtistProfile and an ACTIVE author. Existing discovery permits a published record without processed audio and marks it unstreamable; this task preserves that rule. Admin viewers of public Discover use the same visibility policy. Full lyrics, storage keys, upload credentials and author email have no place in the lightweight catalog response.

Canonical taxonomy and legacy aliases already exist. Beat metadata uses existing BPM40–240 and musical-key validation. The new API must reject unsupported parameters and conflicting ranges instead of ignoring them.

## Baseline gates executed on the inherited state

- Frontend: 61 files / 398 tests passed.
- Backend: 19 files / 281 tests passed, none skipped.
- Build and Prisma validation: passed.
- Lint: passed with seven inherited warnings (two admin unused imports; five backend warnings).
- Full E2E before harness changes:67passed,5failed,4skipped,0interrupted/not-run. Four admin demo-data/real-API mismatches and one mobile picker test setup failure were reproduced. The prior batch title locator correction passed. Final corrected gate:80passed; detailed provenance is in the QA report.

This stage adds correctness and functional interaction checks only. It does not restore screenshot, CSS, geometry, color or typography test suites.
