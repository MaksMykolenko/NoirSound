# NoirSound Human Design Audit

Date: 2026-07-08

## Method

Full read of the design-token source (`src/index.css`), `App.jsx`, and every layout/player component (`AppLayout`, `Header`, `Sidebar`, `MobileHeader`/`MobileNavbar`, `PlayerBar`, `PlayerBarShared`, `QueuePanel`, `FullscreenLyricsPlayer`), plus every card/list component (`TrackCard`, `PlaylistCard`, `ArtistCard`, `TrackListItem`, `PlaylistTrackTable`), the home marketing components (`HomeHero`, `ProductFeatures`, `CreatorCallout`), `StatsCard`, `NotFound`, `ArtistPage`/`UserProfileHeader` hero sections, and `UploadForm`. Every other file in the phase-1 list was swept with targeted greps for the specific smells called out in the brief (`gradient`, `backdrop-blur`/`blur-`, `glow`/arbitrary `shadow-[`, literal `purple/violet/fuchsia` Tailwind classes, `hover:scale`/`scale-`, `rounded-[`, `animate-`) across all 150+ `.jsx` files, so every finding below is either a direct read or a grep hit with a file:line citation. Findings are fixed directly in this pass, not just logged (see the two later reports for what changed).

## Headline finding

NoirSound is **not** a raw, unstructured "AI slop" UI. `src/index.css` already defines a real token system (`--ns-bg/-surface/-card/-border/-text/-accent/-accent-secondary`, `--ns-radius-card/-control/-modal`, `--ns-shadow-card/-modal`, `--ns-focus`) and shared utility classes (`.ns-card`, `.ns-card-interactive`, `.ns-button-primary/secondary`, `.ns-icon-button`, `.ns-field`, `.ns-state-panel`, `.ns-tab`), and seven full theme palettes are wired through it. The "AI-generated" feel comes from individual components **not fully using that system** — reaching for one-off arbitrary values, duplicating the same decorative flourish across many components instead of once, and occasionally hardcoding a raw Tailwind color that ignores the theme entirely. The fix here is mostly subtraction and token discipline, not a rebuild.

## Concrete findings

### 1. Untokenized "hero radius" repeated as a magic number
`rounded-[1.75rem]` (and one `rounded-[2rem]` variant) is hand-typed in at least 10 places that are all conceptually the same thing — a page-level hero/feature panel: `PlaylistPage.jsx:330`, `TrackPage.jsx:97,98,187`, `TrackPage.jsx:217` (`[2rem]`), `ArtistPage.jsx:144`, `UserProfileHeader.jsx:19`, `HomeHero.jsx:12`, `LyricsEditModal.jsx:115`, `AuthModal.jsx:116`, `BatchFileDropzone.jsx:33`, `FullscreenLyricsPlayer.jsx:236` (`[2rem]`). `.ns-card` already defines a *different* radius (`--ns-radius-card: 1.25rem`) for ordinary cards, so there are really two legitimate radii in the app today, but only one of them is a named token. **Fixed**: added `--ns-radius-hero` and a `.ns-card-hero` utility; replaced the arbitrary values.

### 2. Literal, non-theme-aware purple/violet/blue used as if it were the brand accent
The theme system already exposes a secondary accent (`--color-brand-purple` / `--color-brand-blue`, both mapped to `--ns-accent-secondary`), but several components bypass it with raw Tailwind `purple-300/400/500/600` or `violet`/`blue-500`, so switching to any of the other six themes leaves a hardcoded violet or blue sitting next to that theme's real palette: `Sidebar.jsx:142` (active nav-link gradient `to-purple-500/5`), `LibrarySidebarSection.jsx:126` (icon badge `to-purple-600`), `ArtistPage.jsx:174` and `UserProfileHeader.jsx:47` (identical "Independent Artist" pill, `text-purple-300 border-purple-400/20 bg-purple-500/10`, copy-pasted twice), `UploadForm.jsx:404` (selected-cover border, `border-purple-400/35`), `NotFound.jsx:10` (`to-purple-400` in a heading gradient). **Fixed**: swapped to the theme-aware `brand-purple` alias (or the accent tokens) everywhere except the two "Verified" checkmark badges (`ArtistCard.jsx:100`, `ArtistPage.jsx:166`), which intentionally keep a fixed blue — a recognizable, platform-agnostic verification convention, not a random accent choice.

### 3. The same decorative blur blob, copy-pasted onto every card in a grid
`ProductFeatures.jsx:28` puts a `blur-3xl` glow behind *every one* of its 4 feature cards; `StatsCard.jsx:10` does the same on *every* dashboard stat tile; `CreatorCallout.jsx:13` and `TrackPage.jsx:217` add one more each. Individually harmless, but a grid where every tile has its own glowing corner is exactly the "looks good alone, not as a system" and "glow on every card" pattern called out in the brief. **Fixed**: removed the per-card blobs from `ProductFeatures` and `StatsCard` (repeated grid items should be calm); left a single blob on `CreatorCallout` (one hero banner, not a repeated tile) and the one on `TrackPage`'s hero (one per page).

### 4. Triple-stacked hover scale on every media card
`TrackCard.jsx`, `PlaylistCard.jsx`, and `ArtistCard.jsx` all independently implement the same pattern: the cover/avatar image zooms on hover (`group-hover:scale-105`) **while** the overlay play button separately animates `scale-90 → group-hover:scale-100 → hover:scale-105/110 → active:scale-95`. Two simultaneous scale animations firing off one hover, duplicated three times with slightly different numbers (105 vs. 110), reads as generated rather than designed. **Fixed**: removed the cover/avatar zoom in all three; kept one clean reveal (button fades/scales in from 90%→100% on card hover) and dropped the redundant extra hover/active scale steps.

### 5. A rainbow gradient-text heading with a glow drop-shadow on the 404 page
`NotFound.jsx:10`: `bg-gradient-to-r from-brand-red via-rose-300 to-purple-400` text, plus `drop-shadow-[0_0_18px_var(--ns-accent-glow)]` — a three-stop rainbow heading with its own glow is the single most stereotypical "AI landing page" element found in the app. **Fixed**: restrained to a two-tone brand treatment with no drop-shadow glow.

### 5b. Card hover treated identically for spacious grids and dense rows
`.ns-card-interactive` (lift + growing shadow on hover) is correct for card grids (`TrackCard`, `PlaylistCard`, `ArtistCard`, `ProductFeatures`, `StatsCard`) but does not exist to be misused on dense rows — `TrackListItem.jsx` and `PlaylistTrackTable.jsx` already avoid it (plain background/border hover, no lift), which is the right instinct; there was just no shared name for that second, quieter pattern. **Fixed**: added `.ns-row-interactive` so future dense lists reach for a named quiet pattern instead of re-deriving it or reaching for `.ns-card-interactive` by mistake.

### 6. Inconsistent shadow sourcing
Most shadows correctly reference `--ns-shadow-color`/`--ns-accent-glow`, but several are raw literals instead (`shadow-[0_4px_30px_rgba(0,0,0,0.8)]` and `rgba(0,0,0,0.8)`/`0.5` variants in `PlayerBar.jsx`, `ArtistCard.jsx`). Visually indistinguishable from the tokenized version today, but they silently stop tracking the token if it's ever adjusted. Left as a documented follow-up rather than touched in this pass — see Remaining gaps in the QA report; the risk of a mechanical shadow-literal sweep across the player outweighed the visual benefit for this pass.

### 7. Copy is mostly already good — no wholesale rewrite needed
Checked `home.*`, `discover.*`, `library.*`, `empty.*` in `en/common.json` in full: copy is short, concrete, and on-brand ("Find your next sound after dark", "Ready to release your sound?", "No tracks yet. Be the first creator to upload."), not generic SaaS hype. No changes made here beyond what's covered by the token/component fixes above — see the polish report.

### 8. Everything else checked and found already consistent
- Context menu (`ContextMenu.jsx`, `ContextMenuProvider.jsx`, `contextMenuActions.js`): compact, one shared component, restrained separators/danger styling, already matches the brief's Phase 10 goals. No changes made.
- Focus states (`index.css:327-337`): a single, global `:focus-visible` rule with a visible outline + ring token applies app-wide already; not per-component ad hoc.
- Mobile safe-area/tap-target handling (`index.css:775-810`): a single global rule enforces 44px targets and safe-area padding below 1024px, rather than each component reinventing it.
- Player (`PlayerBar.jsx`): restrained; the one `blur-3xl` album backdrop on the mobile expanded sheet is a single, intentional atmospheric moment, not a repeated pattern.

## Scope note

This pass reads and fixes the highest-leverage, highest-repetition issues found (tokens, the three card components, the two marketing/dashboard blob sources, the 404 heading, the six non-theme-aware color usages). It does not touch every one of the ~300 `rounded-*`/45 `shadow`/33 `blur` occurrences individually — most of those are ordinary, correct Tailwind usage (avatars using `rounded-full`, buttons using the shared `--ns-radius-control`, etc.), not smells. Where a whole-codebase mechanical sweep was judged lower-value than the risk of touching that many files in one pass (the shadow-literal cleanup above), that is stated explicitly rather than silently skipped.
