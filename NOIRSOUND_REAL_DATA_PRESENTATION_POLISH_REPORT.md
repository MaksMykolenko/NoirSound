# NoirSound Real Data Presentation Polish Report

Date: 2026-06-28

## Verdict

**REAL DATA PRESENTATION MVP-READY**

This verdict applies to presentation behavior: the UI no longer creates duplicate Featured/Recommended entries, no real-mode mock fallback was added, low-data states are explicit, seed operations are idempotent, and required verification passes.

## Initial findings

- Browser audit showed seven Discover results containing duplicate legacy seed releases (`Neon Drift` and `Midnight Run`), repeated covers, a generic `The Artist` identity, and only two sparse artist profiles.
- Featured could repeat track records and artwork instead of accepting a smaller set.
- Missing track/artist media reused stock assets.
- Mappers could preserve presentation values that were not honest representations of absent backend fields.
- Playback-start events with zero measured seconds produced `0h 0m`.
- Unprocessed releases could expose play/queue affordances.

## Implemented changes

### Catalogue selection and layout

- Added shared ID deduplication, newest-first sorting, Featured selection, and artist ranking in `src/utils/presentation.js`.
- Featured now includes only unique, published, streamable tracks and renders the available 0–4 records without filler.
- All Releases is unique and newest-first, with `0 plays` and `—` for missing duration.
- Recommended Artists is unique and ranked by published catalogue, follower count, then recency.
- Related tracks, artist releases, dashboard releases, and playlist rows use the same honest deduplication rules where applicable.

### Missing media and metadata

- Added deterministic `FallbackCover` and `FallbackAvatar` components.
- Applied them across track cards/rows/detail, artist cards/profile, playlist surfaces, player/queue, headers, comments, dashboard, and profile.
- Fallback covers vary by title, artist, and genre, include a visible “No artwork” marker, and do not use random images.
- Real mappers now use only minimal fallbacks: `Untitled track`, `Unknown artist`, `No genre`, null media, and null duration.
- Missing artist handles and social links are hidden or given an explicit empty state.
- Unprocessed tracks show “Audio unavailable”; playback queues filter them out.
- New real accounts receive no stock avatar and use the deterministic UI fallback.

### Listening stats and low-data states

- Backend stats now return exact `totalListeningSeconds`.
- Playback-start-only history shows “No measured listening time yet,” not `0h 0m`.
- Zero-event profiles show “Not enough listening data yet.”
- Genre percentages are withheld below three playback starts and presented as an early signal.
- Added/updated empty states for zero Featured tracks, zero releases, zero artists, empty playlists, missing creator uploads, and unsupported account collections.

## Seed improvements

- Replaced the generic primary seed identity with `Velvet Circuit`.
- Added four distinct artists: Velvet Circuit, Mira Vale, Northline Archive, and Static Bloom.
- Added seven stable, distinct track fixtures with unique slugs, titles, genres, release dates, and a mix of distinct local covers plus deterministic missing-cover states.
- Added a stable `Nocturne Notes` playlist, comment, and listening event.
- Seeded tracks intentionally have no fake processed-audio object. They are visibly unavailable until a real worker output exists.
- Seed uses stable upserts and stable IDs, rebuilds only its own playlist membership, and removes only narrowly matched legacy seed records.
- User-uploaded tracks and their uploaded media are not overwritten or deleted.
- Backend coverage runs the seed twice and verifies stable artist/track counts.

## Mapper changes

- `trackMapper.js`: honest title/artist/genre/media/duration/plays/likes, and streamability only for published tracks with a processed audio key.
- `artistMapper.js`: display name → username → email prefix → `Unknown artist`, null avatar/banner handling, numeric counts.
- `playlistMapper.js`: honest playlist/creator names, null cover, numeric likes, mapped real tracks.

## Tests added or expanded

- Discover: duplicate Featured track IDs, duplicate All Releases IDs, duplicate Recommended Artist IDs, and no invented cards in an empty catalogue.
- Fallback visuals: deterministic cover and avatar output.
- Mappers: absent backend values remain honest and minimal.
- Listening stats: no fake `0h 0m`, playback-start-only wording, low-confidence genre handling.
- Player store: unavailable releases are rejected from queues.
- Backend: exact listening seconds and seed idempotence.

## Verification

| Command/check | Result |
| --- | --- |
| `npm run build` | Passed |
| `npm run test` | Passed: 9 files, 23 tests |
| `npm run test:e2e` | Passed: 6 Chromium tests |
| `cd backend && npm run test` | Passed: 1 file, 17 tests |
| `npm run lint` | Completed with no errors; existing unrelated unused-parameter warnings remain |
| Real-runtime generic/mock scan | No legacy titles, stock art paths, or direct mock imports outside allowed mock/test files |
| In-app browser, real Discover | Featured 3/3 unique; All Releases 10/10 unique; Recommended Artists 3/3 unique |

## Browser evidence

- [Polished Featured section](presentation-screenshots/after-discover-featured.png)
- [Polished All Releases and Recommended Artists](presentation-screenshots/after-discover-content.png)

The initial browser DOM audit (before seed/presentation changes) recorded seven results with duplicate legacy titles, repeated art, `The Artist`, and two artist profiles. The initial screenshot was captured during loading and is therefore not used as visual evidence.

## Remaining real-data issues

- The local database still contains three genuine processed user uploads, including two “Phase 9” proof uploads that share user-provided cover art. They remain visible because this pass does not rewrite or delete user uploads.
- Seed fixtures are deliberately unstreamable until legal audio is processed through the real upload/worker pipeline.
- Liked tracks, signed-in playlist collections, followed artists, activity, profile editing, related-track ranking, discovery pagination, and richer creator analytics still require backend endpoints.
- The production bundle reports a non-blocking large `lucide-react` chunk warning; this is a delivery optimization, not a data-presentation defect.

## Principal files changed

- Presentation: `src/pages/Home.jsx`, `src/pages/Discover.jsx`, `src/pages/TrackPage.jsx`, `src/pages/ArtistPage.jsx`, `src/pages/PlaylistPage.jsx`, `src/pages/Dashboard.jsx`
- Shared presentation: `src/utils/presentation.js`, `src/utils/formatTime.js`
- Fallbacks: `src/components/ui/FallbackCover.jsx`, `src/components/ui/FallbackAvatar.jsx`
- Track/player surfaces: `src/components/tracks/TrackCard.jsx`, `src/components/tracks/TrackListItem.jsx`, `src/components/player/PlayerBar.jsx`, `src/components/player/QueuePanel.jsx`, `src/store/playerStore.js`
- Artist/playlist/account surfaces: artist, playlist, header, profile, comment, and sidebar presentation components
- API: real track discovery plus track, artist, and playlist mappers
- Backend: `backend/prisma/seed.js`, `backend/src/routes/stats.js`, `backend/src/routes/auth.js`
- Tests: Discover presentation, fallback visuals, listening stats, mapper presentation, player queue, and backend endpoints
