# NoirSound Home Page Refresh Report

## Verdict

**HOME PUBLIC-BETA READY**

The Home page now behaves like a music product dashboard: discovery and real catalogue content appear first, creator actions remain prominent, low-data mode is intentional, and no mock tracks or fabricated platform statistics were introduced.

## Audit of the previous Home

### Previous section order

1. Large cinematic hero
2. Four static feature cards
3. Featured releases
4. Featured artists

This placed product marketing ahead of music and pushed the real catalogue below the initial desktop and mobile view.

### Data source classification

| Section | Previous source | Current source |
| --- | --- | --- |
| Hero copy and CTAs | Static localized UI copy | Static localized UI copy |
| Genre browser | Not present | Shared 107-genre taxonomy; no track counts |
| Latest releases | `getTracks()` real API response, newest first | Same real API response, moved higher |
| Featured artists | `getArtistsWithTracks()` plus real track context | Same real API response; hidden when the catalogue is empty |
| Continue listening | Not present on Home | Authenticated `getRecentlyPlayed()` data through `usePlayerStore`; hidden when empty |
| Creator/product cards | Static localized UI copy | Static localized UI copy, shortened and moved below music |

No aggregate platform-stats row was added because Home has no suitable public real-stats endpoint. No values were inferred or fabricated.

### Issues found

- The 390–440px hero height and large type made the page read like a landing page.
- Four text-heavy feature cards appeared before any music.
- The release section began too low, particularly on mobile.
- Empty releases and empty featured artists produced two large consecutive empty states.
- The previous empty release state only offered an upload action.
- The previous feature descriptions were long enough to produce uneven card density in Ukrainian, Polish, and Russian.
- Home did not expose the shared genre taxonomy.
- Discover could not initialize its genre filter from a Home link.
- Home did not use the existing real recently-played source.

## Changes made

### App-like hierarchy

The new order is:

1. Compact cinematic hero
2. Browse by genre
3. Latest releases from the real API
4. Continue listening, only when real history exists
5. Creator upload callout
6. Product feature cards
7. Real featured artists, only when catalogue and artist data exist

### Hero

- Reduced the desktop footprint and tightened mobile spacing.
- Kept the noir image, gradients, and two primary actions.
- Added a taxonomy-derived “107 genres” note rather than platform statistics.
- Used two-column mobile CTAs so real releases enter the first viewport.

### Genre discovery

- Added Hip-Hop, Pop, Electronic, Rock, R&B, Jazz, Chill, World, and More genres.
- Genre buttons navigate with canonical taxonomy keys:
  - `/discover?genre=hip_hop`
  - `/discover?group=chill`
  - `/discover?browse=all`
- Discover now initializes the matching genre/group filter from those query parameters.
- Chips wrap inside the container and do not create page-level horizontal overflow.

### Real catalogue and listening data

- Releases remain sourced exclusively from `getTracks()`.
- Featured artists remain sourced exclusively from `getArtistsWithTracks()`.
- Continue Listening loads only for an authenticated user and renders only when the real recently-played list is non-empty.
- No fake releases, history, counts, or creator metrics were added.

### Empty catalogue state

- Replaced duplicate release/artist empty panels with one full-width premium catalogue state.
- Copy: “No releases yet” and “Be the first creator to upload a track.”
- Primary action: Upload a Track.
- Secondary action: Browse Genres.
- Featured artists stay hidden until real release and artist data are available.

### Product cards

- Replaced generic long-form copy with:
  - Find your next sound
  - Upload in minutes
  - Build your collection
  - Understand your audience
- Added equal minimum heights, stronger icons, and subtle hover glow.

### Internationalization

All new Home copy is localized in English, Ukrainian, Polish, and Russian. Ukrainian and other longer translations use shorter mobile-safe headings and descriptions. Missing English and Ukrainian Discover genre-tab labels exposed by the new Home links were also completed.

## Responsive results

| Viewport | Horizontal overflow | Releases visible before fixed bottom nav | Result |
| --- | ---: | ---: | --- |
| 360×800 | 0px | Yes | Pass |
| 390×844 | 0px | Yes | Pass |
| 430×932 | 0px | Yes | Pass |
| 768×1024 | 0px | Yes | Pass |
| 1440×900 | 0px | N/A | Pass |

The existing `AppLayout` safe-area padding remains responsible for player and mobile-navigation clearance. A bottom sentinel is covered by the browser test to prevent regressions.

## Tests run

- `npm run build` — passed.
- `npm run test` — 15 files, 56 tests passed.
- `npm run test:e2e` — 23 tests passed.
- Focused Home browser suite after screenshot timing improvements — 5 tests passed.
- `npm run lint` — passed with existing unrelated warnings; no lint failure.
- Backend tests were not run because backend code was not changed.

Coverage added for:

- Hero and CTAs.
- Empty catalogue without fake track cards or duplicate artist empty state.
- Rendering real API releases.
- Genre navigation and Discover filter initialization.
- Localized product-card copy.
- Desktop and mobile overflow.
- Ukrainian mobile rendering.
- Upload navigation through the existing auth-guarded flow.
- Fixed player/mobile-nav bottom clearance.

## Screenshots

- `design-audit-screenshots/home-refresh/before-desktop-home-1440x900.png`
- `design-audit-screenshots/home-refresh/desktop-home-1440x900.png`
- `design-audit-screenshots/home-refresh/mobile-home-390x844.png`
- `design-audit-screenshots/home-refresh/mobile-home-uk-390x844.png`

## Files changed

- `src/pages/Home.jsx`
- `src/pages/Discover.jsx`
- `src/components/home/HomeHero.jsx`
- `src/components/home/BrowseByGenre.jsx`
- `src/components/home/CreatorCallout.jsx`
- `src/components/home/ProductFeatures.jsx`
- `src/components/ui/EmptyState.jsx`
- `src/i18n/locales/en/common.json`
- `src/i18n/locales/uk/common.json`
- `src/i18n/locales/pl/common.json`
- `src/i18n/locales/ru/common.json`
- `tests/components/Home.test.jsx`
- `tests/e2e/home.spec.js`
- `NOIRSOUND_HOME_PAGE_REFRESH_REPORT.md`
- `NOIRSOUND_HOME_PAGE_DESIGN_QA_REPORT.md`

## Remaining issues

- No blocking Home issues remain.
- The aggregate platform-stats row is intentionally omitted until a real public endpoint exists.
- Continue Listening is intentionally absent for signed-out users and users with no persisted playback history.
- The local QA database had no releases, so visual screenshots cover the premium empty state; populated release rendering is covered by component tests using mocked real API responses.
- The production build still reports the existing large-chunk advisory, primarily for the shared icon bundle. It does not fail the build and is outside this Home layout pass.
