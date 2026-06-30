# NoirSound — Track Page Refresh Report

**Pass:** Track Page Design Refresh
**Date:** 2026-06-28
**Scope:** Track Page UI/UX only. No backend, upload, worker, stream, or player-behavior changes. No mock data, no fabricated stats — real metadata only.

---

## Part 1 — Audit of the previous Track Page

### Hero structure (before)
`src/pages/TrackPage.jsx` rendered a three-column hero: cover · info/actions · a **right-side 2×2 stat grid** (`<aside aria-label="Track details">`, `hidden xl:grid`) with Plays / Duration / Released / Genre as bordered utility cards. Below `xl` a separate inline "Stats Bar" (Clock/Disc/Calendar) duplicated that data. The grid is what made the hero read like an analytics panel.

### Metadata sources (all real, from the API track mapper)
`track.plays`, `track.duration` (→ `formatDuration`), `track.releaseDate` (ISO `YYYY-MM-DD`), `track.genre` (stable key → `getLocalizedGenre`), `track.artistName`, `track.description`, `track.tags`, `track.waveform`. No fabricated values.

### Waveform (before)
A separate `ns-card` titled "Audio Waves" using `Waveform` (`src/components/player/Waveform.jsx`), which renders real `track.waveform` samples (accent bars for played, muted for unplayed) and supports click/arrow seeking when the track is the active player track. Progress/duration labels only appeared while playing. A large `ns-state-panel` showed the unavailable case.

### Comments / Related (before)
Comments: `CommentSection` inside an `ns-card`, header "Discussion (N)", all strings hardcoded English. Related: a right column with an `ns-state-panel` reading "No similar tracks found under this genre." — wide and error-like when empty.

### Issues found
- Hero felt like a dashboard because of the 2×2 stat cards and an empty-feeling right side on wide screens.
- Metadata was over-weighted (big boxes for tiny values) and duplicated between the grid and the inline bar.
- Waveform card felt detached (large page-stack gap above it).
- Related-tracks empty state looked like an error in a big panel.
- The page was a stack of rectangular cards with little "music-page" flow.

### Theme-compatibility risks (before)
The app already maps Tailwind `zinc/rose/purple/brand` utilities to `--ns-*` theme tokens (9 themes via `:root[data-theme]`), so most classes were theme-safe. But the hero used **non-remapped colors** — `to-blue-500/8` glow and `text-blue-300` on a stat icon — which stayed blue in every theme, and the play icon used hardcoded `fill="white"` instead of the on-accent token.

### i18n risks (before)
TrackPage and CommentSection were **entirely hardcoded English** ("Play Track", "Description", "Related Tracks", "No similar tracks…", "Discussion", "Sign in to join…", etc.) — they never had a `trackPage`/`comments` namespace.

---

## Part 2–8 — What changed

### Stats grid → compact metadata row (Parts 2, 4)
The 2×2 `aside` grid **and** the duplicate inline stats bar are removed. Under the action buttons there is now a single secondary, muted, wrapping metadata row:

```
🎧 42   ·   ⏱ 1:58   ·   Released Jun 28, 2026
```

- Play count is an icon + number (premium, and side-steps Slavic plural clutter) with a localized `aria-label` ("42 plays").
- Duration is omitted when unknown (`formatDuration` returns `—`); the date segment is omitted when missing — no empty boxes, no `—` noise.
- Genre stays a **pill above the title** (not repeated in the row).
- A subtle contextual **track note** sits under the row: `Be the first to listen.` when `plays === 0`, otherwise `Uploaded by {artist}` — real data only.

### Music-focused hero (Part 3)
Two-column hero (cover · info), cover bottom-aligned on desktop, larger and more premium (`w-44 → md:w-60`, themed border + soft shadow). Backdrop is the blurred cover plus a subtle **accent wash** (`from-[var(--ns-accent-soft)]`). Order: genre pill → bold title (stronger hierarchy) → clickable artist → Play / Like / Add / **Share** → metadata row → note. No right-side panel, no empty space.

### Waveform polish (Part 5)
Hero + waveform are now one connected unit (`space-y-4`) so the waveform no longer floats below a big gap. The header shows the live `progress / duration` when playing and the total duration otherwise; the seek hint is localized. The unavailable state is now a compact dashed strip with an icon (not a tall panel) and a localized label via the new `unavailableLabel` prop. Active bars use the theme accent.

### Description (Part 6)
Real description in a clean text block; when absent, a single muted line `No description added.` (no huge empty card). Tags remain subtle chips.

### Related tracks (Part 7)
Empty state is now a small, friendly card: **"No similar tracks yet."** + "More tracks in this genre will appear here as creators publish music." When related exist, 2–4 compact rows (now real `<button>`s for keyboard access).

### Discussion (Part 8)
`CommentSection` gains a localized title + subtitle — **"Join the discussion" / "Share feedback with the artist."** — with a comment count. Input/avatar/send alignment kept; all strings localized; empty/sign-in/error states localized. Bottom-player overlap is handled by the existing `AppLayout` bottom padding.

### Theme + i18n (Parts 10, 11)
All hero accents use tokens (`--ns-accent-soft`, `--ns-border`, `--ns-shadow-color`; `brand-red`/`rose-*` map to the accent); the blue glow/icon and `fill="white"` are gone (icons use `currentColor` = on-accent). New `trackPage` (29 keys) and `comments` (12 keys) namespaces added in **en/uk/pl/ru**; user content (title, artist, description, tags) is never translated.

---

## Files changed
```
src/pages/TrackPage.jsx                      (hero refresh, metadata row, sections, tokens, i18n)
src/components/player/Waveform.jsx           (localized + compact unavailable state)
src/components/ui/CommentSection.jsx         (localized title/subtitle + strings)
src/i18n/locales/{en,uk,pl,ru}/common.json   (trackPage + comments namespaces)
tests/components/TrackPage.test.jsx          (new)
tests/e2e/track-page.spec.js                 (new)
design-audit-screenshots/track-page-refresh/ (README + capture target)
```

Verification and verdict are in `NOIRSOUND_TRACK_PAGE_DESIGN_QA_REPORT.md`.
