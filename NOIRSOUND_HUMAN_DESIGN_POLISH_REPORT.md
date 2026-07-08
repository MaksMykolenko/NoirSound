# NoirSound Human Design Polish Report

Date: 2026-07-08
Companion documents: `NOIRSOUND_HUMAN_DESIGN_AUDIT.md` (findings, file:line citations), `NOIRSOUND_HUMAN_DESIGN_QA_REPORT.md` (verification detail).

## Summary

This pass did not redesign NoirSound. The audit's headline finding was that a real design-token system already existed in `src/index.css` (`--ns-*` variables, `.ns-card`, `.ns-button-primary`, `.ns-field`, `.ns-tab`, etc.) across seven theme palettes — the "AI-generated" feel came from individual components bypassing that system with one-off arbitrary values, copy-pasted decorative flourishes, and a few hardcoded colors that ignore the active theme. The fix was targeted: two new tokens, then component-by-component substitution and subtraction, verified with lint/tests/build after each batch.

## AI-looking patterns found (see audit for full citations)

- A "hero panel" radius (`rounded-[1.75rem]`) hand-typed as a magic number in 10 places instead of once as a token.
- Literal `purple-300/400/500/600`, `violet`, and one `blue` used as if they were the brand's secondary accent, ignoring the theme system entirely — meaning any non-default theme (of the seven available) still showed a hardcoded violet or blue next to that theme's real palette.
- The same decorative `blur-3xl` glow blob copy-pasted onto every card in a grid (every feature tile, every dashboard stat tile) instead of once on a real hero.
- A triple-stacked hover animation on every media card: cover/avatar zoom **plus** a separately-animating play button with its own scale steps, duplicated three times (`TrackCard`, `PlaylistCard`, `ArtistCard`) with inconsistent numbers (105 vs. 110).
- A three-stop rainbow gradient heading with a glow drop-shadow on the 404 page — the single most stereotypical "AI landing page" element in the app.
- A handful of hardcoded English strings on `ArtistPage` (empty/error states, two section headings) that bypassed i18n entirely, so uk/pl/ru users saw English text on an otherwise fully localized page.

## What was removed

- The cover-image/avatar hover-zoom on `TrackCard`, `PlaylistCard`, and `ArtistCard` (the card's own lift/shadow, via `.ns-card-interactive`, already carries hover feedback; the image didn't need to move too).
- The redundant extra hover/active scale steps on the two cards' play buttons (kept one clean 90%→100% reveal, dropped `hover:scale-105/110` and `active:scale-95`).
- The extra glow-overlay `<div>` behind `ArtistCard`'s avatar.
- The per-card decorative blur blob in `ProductFeatures.jsx` (4 feature tiles) and `StatsCard.jsx` (every dashboard stat tile). Singular, non-repeated blobs elsewhere (`CreatorCallout`, `TrackPage`'s hero, `FullscreenLyricsPlayer`'s album backdrop) were left alone — one atmospheric touch per screen is the rule, not zero.
- The third gradient stop and glow drop-shadow on `NotFound.jsx`'s "404" heading, leaving a restrained two-tone brand gradient.

## Design tokens standardized

- `--ns-radius-hero: 1.75rem` added to `:root` in `src/index.css`, alongside the existing `--ns-radius-card`/`-control`/`-modal`.
- `.ns-card-hero { border-radius: var(--ns-radius-hero); }` — a named utility for page-level hero/feature panels, replacing the arbitrary `rounded-[1.75rem]` typed independently in ten files.
- `.ns-row-interactive` — a quiet hover pattern (background/border only, no lift) for dense rows, formalizing what `TrackListItem`/`PlaylistTrackTable` already did correctly by instinct, so future lists have a named pattern to reach for instead of misusing `.ns-card-interactive` (built for spacious grids) on a row.
- Two responsive bottom-sheet modals (`LyricsEditModal`, `AuthModal`) that split the hero radius across `rounded-t-[1.75rem] / sm:rounded-[1.75rem]` now reference `var(--ns-radius-hero)` directly in the arbitrary-value syntax, so they track the token without losing the responsive corner behavior.

## Components normalized

`.ns-card-hero` applied in place of the arbitrary radius in: `TrackPage.jsx` (hero section + 2 loading-skeleton panels), `ArtistPage.jsx` (hero), `UserProfileHeader.jsx` (hero), `PlaylistPage.jsx` (hero), `HomeHero.jsx`, `BatchFileDropzone.jsx` (dropzone panel), `LyricsEditModal.jsx` and `AuthModal.jsx` (var-based, see above).

Non-theme-aware color swapped to the theme-aware `brand-purple` alias in: `LibrarySidebarSection.jsx` (Liked Songs icon gradient), `ArtistPage.jsx` and `UserProfileHeader.jsx` ("Independent Artist"/"Creator" badges), `UploadForm.jsx` (selected-cover state), `Sidebar.jsx` (active nav-link gradient), `UserActivityItem.jsx` (playlist-activity icon). `UserProfileHeader.jsx`'s "Listener" badge — previously a hardcoded blue, the same treatment as "Creator" but for the default/base role — was changed to a neutral zinc pill instead of assigning it its own accent color; a default state doesn't need to compete visually with the "Creator" badge next to it. The two "Verified" checkmark badges (`ArtistCard.jsx`, `ArtistPage.jsx`) intentionally keep their fixed blue — a recognizable, platform-agnostic verification convention, not a random accent choice, and explicitly out of scope.

Media-card hover treatment normalized across `TrackCard.jsx`, `PlaylistCard.jsx`, `ArtistCard.jsx` (see "What was removed").

**Verified already consistent, no changes made:** `PlayerBar.jsx`/`PlayerBarShared.jsx`/`FullscreenLyricsPlayer.jsx` structurally share the same transport/progress/track-info subcomponents (imported from `PlayerBarShared.jsx`), which is a stronger guarantee of player-surface consistency than a style pass could add — the fullscreen lyrics view's desktop and mobile playerbars are literally the same components as the standard player, not a re-implementation. `QueuePanel.jsx` uses the same row/hover language as the rest of the app. The context-menu component set (`ContextMenu.jsx`, `ContextMenuProvider.jsx`, `contextMenuActions.js`) and all 16 admin pages (`src/pages/admin/*.jsx`) were swept for the same smell patterns (literal purple/violet, decorative blur, hover-scale, arbitrary radius) and came back clean — admin already uses a plain, consistent `rounded-lg`/`rounded-xl` scale appropriate to dense data tables, with zero decoration.

## Copy improved

`ArtistPage.jsx` had five hardcoded English strings that bypassed i18n (the "Artist not found" / "This creator has left the night studio" empty states, the "Artist profile unavailable" error title, "Return to Discover," and the "Top Tracks" / "Singles & EPs" section headings). All five now route through `t()`, with new keys (`profile.artistNotFound`, `artistNotFoundDesc`, `artistGoneDesc`, `artistUnavailable`, `artistNoTracksDesc`, `returnToDiscover`, `topTracks`, `singlesAndEps`) added and translated in all four locale files (en/uk/pl/ru). The existing English copy elsewhere (home/discover/library/empty states) was already reviewed in the audit and found concrete and on-brand ("Find your next sound after dark") — no wholesale rewrite was needed or attempted.

## Player/playlist consistency, mobile, accessibility, tests, production verification

Covered in detail in `NOIRSOUND_HUMAN_DESIGN_QA_REPORT.md`. In summary: player/playlist/context-menu systems were verified consistent by direct code read rather than changed; mobile and accessibility passes were code-level (breakpoint classes, safe-area/tap-target rules, focus-visible rule) rather than rendered-screenshot QA, since this sandbox has no working browser/E2E runner (see QA report for why); the full test suite, lint, and build all pass; there has been no production deployment or live-site check.

## Remaining gaps

- Shadow literals in `PlayerBar.jsx`/`ArtistCard.jsx` (raw `rgba(0,0,0,0.8)`/`0.5` instead of `--ns-shadow-color`) were flagged in the audit and deliberately left untouched — visually identical today, but won't track the token if it's ever adjusted. A mechanical sweep was judged lower-value than the risk of touching the player component broadly in this pass.
- No rendered/visual QA (screenshots at the specified breakpoints) was performed — see QA report.
- No production deployment or check against `https://noirsound.co`.
