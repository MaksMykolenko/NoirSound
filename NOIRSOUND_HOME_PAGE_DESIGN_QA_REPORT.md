# NoirSound Home Page Design QA Report

## Final verdict

**HOME PUBLIC-BETA READY**

## Visual QA summary

### Desktop — 1440×900

- Hero is cinematic but no longer dominates the complete viewport.
- Genre discovery and the Latest Releases heading are visible without a long marketing-card detour.
- Empty catalogue state reads as an intentional product state.
- Main content aligns with the existing sidebar and header grid.
- Player bar does not cover actionable content at the bottom of the scroll range.

### Mobile — 360×800

- Document and body overflow: 0px.
- Hero height: approximately 303px.
- Latest Releases begins at approximately 682px, above the 64px mobile navigation.
- Two-column CTAs remain contained.

### Mobile — 390×844

- Document and body overflow: 0px.
- Hero height: approximately 303px.
- Latest Releases begins at approximately 632px.
- Genre buttons wrap into two compact rows.
- Empty state content remains reachable above fixed navigation/player chrome.

### Mobile — 430×932

- Document and body overflow: 0px.
- Hero height: 300px.
- Latest Releases begins at approximately 629px.
- Longer CTA and genre labels have sufficient width.

### Tablet — 768×1024

- Document and body overflow: 0px.
- Latest Releases begins at approximately 733px.
- Hero, genres, and catalogue maintain a clear vertical rhythm.

### Ukrainian — 390×844

- Headline wraps cleanly.
- “Шукати музику” and “Завантажити трек” fit in the two-column CTA row.
- Genre names and “Інші жанри” remain contained.
- Latest Releases remains visible in the initial viewport.

## Interaction QA

| Interaction | Expected | Result |
| --- | --- | --- |
| Hero Discover CTA | Navigate to `/discover` | Pass |
| Hip-Hop chip | Navigate to `/discover?genre=hip_hop` and select Hip-Hop | Pass |
| More genres | Navigate to `/discover?browse=all` and open taxonomy picker | Pass |
| Hero Upload CTA | Navigate to `/upload`; existing auth/role guard remains responsible for access | Pass |
| Empty-state Upload | Navigate to existing upload flow | Pass |
| Empty-state Browse Genres | Navigate to full Discover taxonomy | Pass |

## Data-integrity QA

- Empty database renders zero track cards.
- Track cards render only from the real tracks API result.
- Featured artists render only from real artist and track data.
- Recently played renders only from persisted authenticated playback history.
- No Home stats, track counts, releases, or listening events are fabricated.

## Automated verification

- Build: pass.
- Frontend tests: 56/56 pass.
- End-to-end tests: 23/23 pass.
- Focused Home end-to-end tests: 5/5 pass after final screenshot capture adjustment.
- Backend unchanged.

## Screenshot evidence

### Desktop

`design-audit-screenshots/home-refresh/desktop-home-1440x900.png`

### Mobile

`design-audit-screenshots/home-refresh/mobile-home-390x844.png`

### Mobile Ukrainian

`design-audit-screenshots/home-refresh/mobile-home-uk-390x844.png`

### Baseline

`design-audit-screenshots/home-refresh/before-desktop-home-1440x900.png`

## Remaining non-blocking items

- Real catalogue screenshots should be recaptured when the local database contains published releases; the populated state is already covered by component tests.
- Aggregate live platform statistics remain deferred until a real endpoint exists.
