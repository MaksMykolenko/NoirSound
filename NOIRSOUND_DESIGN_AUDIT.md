# NoirSound Design Audit

Audit date: 2026-06-27  
Scope: frontend presentation and interaction only  
Modes reviewed: `VITE_USE_MOCK_API=true` and real API mode against the local backend

## Rating scale

- **Excellent** — polished, coherent, accessible, and ready for an MVP audience.
- **Good** — solid and usable with only secondary limitations.
- **Needs Polish** — functional but visibly inconsistent, dense, incomplete, or prototype-like.
- **Broken** — unusable, crashes, materially overflows, or conceals the expected state.

## Baseline findings

The starting frontend already had a distinctive noir identity, strong art direction, and a credible desktop player. The design felt most prototype-like where styles were implemented page-by-page: tiny 8–10px labels, inconsistent empty/error panels, controls below 44px, a desktop sidebar consuming 25% of a 1280px viewport, unlabelled icon controls, sparse real-data states, and a real-mode profile that could render before a user existed.

The baseline was **Good visually but inconsistent operationally**. Discover, track detail, upload, comments, profile tabs, and the player had enough visual quality to polish rather than redesign.

## Final audit matrix

| Surface | Hierarchy | Typography | Spacing | Cards | Buttons | Icons | Color | Contrast | Mobile | States | Hover/focus/active | Premium feel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home | Excellent | Excellent | Good | Good | Excellent | Good | Excellent | Good | Good | Good | Good | Excellent |
| Discover | Excellent | Good | Excellent | Excellent | Good | Good | Excellent | Good | Good | Good | Excellent | Excellent |
| Track detail | Excellent | Excellent | Good | Excellent | Excellent | Good | Excellent | Good | Excellent | Good | Good | Excellent |
| Artist profile | Excellent | Good | Good | Good | Good | Good | Excellent | Good | Good | Good | Good | Excellent |
| User profile | Good | Good | Good | Good | Good | Good | Excellent | Good | Good | Good | Good | Good |
| Library | Good | Good | Excellent | Good | Good | Good | Good | Good | Good | Excellent | Good | Good |
| Playlist page | Good | Good | Good | Good | Good | Good | Excellent | Good | Good | Good | Good | Good |
| Upload Track | Excellent | Good | Excellent | Excellent | Excellent | Good | Excellent | Good | Excellent | Excellent | Good | Excellent |
| Creator Dashboard | Good | Good | Good | Excellent | Good | Good | Excellent | Good | Good | Good | Good | Good |
| Auth modal | Excellent | Good | Excellent | Excellent | Excellent | Good | Excellent | Good | Excellent | Good | Excellent | Good |
| Search/header | Good | Good | Good | Good | Good | Good | Excellent | Good | Good | Good | Good | Good |
| Sidebar | Excellent | Good | Excellent | Good | Good | Good | Excellent | Good | Good | Good | Excellent | Good |
| Mobile navigation | Excellent | Good | Excellent | Good | Excellent | Good | Excellent | Good | Excellent | Good | Excellent | Good |
| Player | Excellent | Good | Good | Excellent | Excellent | Good | Excellent | Good | Excellent | Good | Excellent | Excellent |
| Queue | Good | Good | Good | Good | Good | Good | Excellent | Good | Excellent | Excellent | Good | Good |
| Comments/replies | Good | Good | Good | Good | Good | Good | Good | Good | Excellent | Excellent | Good | Good |
| Listening stats | Good | Good | Good | Excellent | Good | Good | Excellent | Good | Good | Excellent | Good | Good |
| Loading/error/empty | Good | Good | Excellent | Excellent | Good | Good | Good | Good | Good | Excellent | Good | Good |
| 404 | Excellent | Excellent | Excellent | Excellent | Excellent | Good | Excellent | Good | Excellent | Excellent | Good | Excellent |

## Surface notes

### Home — Excellent / Good

- The hero is now shorter, better balanced, and retains the original cinematic artwork.
- The prototype status label was replaced with audience-facing language.
- CTA hierarchy is clear: listening is primary, creator upload is secondary.
- Feature cards use readable body text and consistent glass surfaces.
- Real API mode has explicit empty and error panels rather than mock fallback content.
- Remaining limitation: the feature section is intentionally long on 360px screens.

### Discover — Excellent

- This is now the strongest browsing page.
- Search, result count, and genre filters form one coherent control surface.
- Track cards and the release list provide useful browse density without feeling crowded.
- Empty searches offer a clear filter reset.
- Artist data is defensive when genres or follower counts are absent.
- Remaining limitation: the global desktop header search is still presentation-only; Discover search is the functional search surface.

### Track detail — Excellent

- Cover, genre, title, artist, metadata, and actions have a clear descending hierarchy.
- Long titles wrap instead of truncating.
- The waveform supports keyboard seeking when active.
- Description, tags, comments, and related tracks now share one surface language.
- Empty comments are presented as a designed state.
- Mobile stacking works at 360×800 without horizontal overflow.

### Artist profile — Excellent / Good

- The cinematic banner, avatar overlap, verified mark, role badge, and follow CTA read as an artist identity.
- Missing biography, genres, social links, release dates, or tracks no longer crash the page.
- Empty releases use a designed state.
- Artist profile is clearly distinct from the listener profile.
- Remaining limitation: the banner is intentionally restrained when the backend provides only a gradient.

### User profile — Good

- Listener role labeling distinguishes it from the artist page.
- Sparse real user records receive avatar, banner, biography, location, stats, and joined-date fallbacks.
- The six-card summary switches to three columns at the 1024px desktop breakpoint to avoid compression.
- Tabs are horizontally scrollable and contained rather than leaking page width.
- Real mode does not claim all artists are followed; discovery and followed-artist states are separated.
- Remaining limitation: the overview genre summary is sample data and is explicitly labeled as such.

### Library — Good

- Query-string tabs now open the requested library section.
- Liked, playlists, history, and followed-artist empty states are consistent.
- Real mode starts with no mock playlists or liked tracks.
- Track rows retain useful desktop metadata and simplify on small screens.
- Remaining limitation: real playlist/follow synchronization requires product/API work outside this design pass.

### Playlist page — Good

- Hero styling now matches track detail.
- Owner, track count, duration, likes, play, like, and pin states are legible.
- Mobile track actions are progressively simplified to prevent row overflow.
- Loading, missing playlist, API error, and empty playlist states are designed.
- Remaining limitation: the current playlist store is local frontend state; real playlist hydration is outside this polish scope.

### Upload Track — Excellent

- The creator entry point now has the strongest form hierarchy in the app.
- Audio and cover inputs expose selected state; cover artwork receives an immediate preview.
- File size, format guidance, validation, rights confirmation, progress, processing, success, and failure states share one visual language.
- Labels, input relationships, invalid states, and progress semantics are exposed to assistive technology.
- The real upload mutation and polling behavior were not changed.

### Creator Dashboard — Good

- Metric cards, chart, actions, and releases have consistent surfaces and spacing.
- Static analytics are explicitly labeled **Preview analytics** and the chart copy says **Sample**.
- Real artist releases are resolved by the authenticated display identity instead of the mock-only artist ID.
- Empty releases use a creator-focused CTA.
- Remaining limitation: analytics values are still sample values.

### Auth modal — Good

- Mobile presentation becomes a bottom-aligned sheet; desktop remains centered.
- Escape, backdrop close, focus restoration, initial focus, and a keyboard focus loop are implemented.
- Inputs have explicit labels, error relationships, loading disablement, and consistent focus states.
- Remaining limitation: OAuth is not present and was not introduced.

### Header and sidebar — Good

- Sidebar default width was reduced from 320px to 272px, with a 240–360px resize range.
- Active navigation uses an inset accent rather than a large flat fill.
- Library rows, filters, scrollbar, resize handle, and hierarchy remain compact.
- Route changes reset the internal content scroll position.
- Icon controls have accessible labels and visible focus.
- Remaining limitation: the desktop header search field does not yet submit a search.

### Player and queue — Excellent / Good

- Desktop, collapsed, mobile mini-player, and mobile full-sheet states are visually balanced.
- Mobile queue now layers above the player sheet instead of behind it.
- Sliders have readable progress, large interaction areas, and labels.
- Playback errors are visible in both desktop and mobile player surfaces.
- All primary transport controls have accessible names and active state semantics.
- Remaining limitation: automated real-audio playback was blocked by the browser's media gesture policy during this pass; the UI error state behaved correctly.

### Comments and replies — Good

- Main comments and replies use textareas, 200-character limits, readable metadata, and larger action targets.
- Names and timestamps wrap cleanly below 430px.
- Reply indentation is shallower on mobile.
- Empty, loading, posting, disabled, validation, reply-toggle, like, and delete states are clear.

### Loading, error, empty, and 404 states — Good / Excellent

- `ErrorState`, `EmptyState`, and `LoadingState` now provide a consistent base.
- Real mode no longer initializes mock playlists, followed artists, or liked tracks.
- Logged-out profile and upload states are explicit.
- The 404 page now fits the NoirSound identity instead of feeling generic.

## Responsive audit

Validated sizes:

- 360×800
- 390×844
- 430×932
- 768×1024
- 1024×768
- 1440×900

Representative checks covered Home, Track detail, Upload, and Profile at every size. No document-level horizontal overflow remained. Mobile controls use a 44px minimum height, icon controls with accessible labels use a 44px minimum width, bottom navigation observes safe-area padding, and tabs use contained horizontal scrolling where the number of items exceeds available width.

## Accessibility audit

Improved:

- global `:focus-visible` treatment;
- minimum mobile touch targets;
- explicit icon-button labels;
- pressed/expanded state attributes;
- semantic tab lists;
- dialog names and modal state;
- Auth modal focus loop, initial focus, Escape close, and focus restoration;
- form labels and linked errors;
- progressbar semantics;
- waveform keyboard seeking;
- toast live regions and error roles;
- reduced-motion handling.

Remaining:

- no full screen-reader audit was performed;
- some card-wide click targets still contain independent child actions and should eventually be refactored to dedicated semantic links;
- the create-playlist modal closes on Escape but does not yet implement the full focus loop used by Auth.

## Strict verdict

**STRONG MVP DESIGN**

The interface is cohesive, premium, mobile-usable, and materially more honest in real API mode. It is not rated public-beta ready because global search is incomplete, some frontend data surfaces remain local/sample-backed, and accessibility has not received a full assistive-technology audit.

