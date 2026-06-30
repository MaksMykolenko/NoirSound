# NoirSound — Genre UI Design Fix Report

**Pass:** New UI Elements Design QA — fixes
**Date:** 2026-06-28

Concrete before/after for every change. UI/UX only — no backend, worker, stream, taxonomy, or data changes.

---

## Fix 1 — GenrePicker becomes a mobile bottom sheet (was a clipped dropdown)

`src/components/ui/GenrePicker.jsx`

**Before:** the open panel was `absolute z-30 mt-2 w-full … max-h-72`. On mobile it stacked at the same z-index as the mini-player (z-30) and below the bottom nav (z-40), so the lower part of the list — and the search field — could be covered, and a ~288px dropdown could run off short viewports.

**After:** responsive rendering.

- Mobile (`<640px`): a **bottom sheet** — `fixed inset-x-0 bottom-0 z-[60] max-h-[80vh] rounded-t-2xl`, with a dimmed **backdrop** (`fixed inset-0 z-[55] bg-black/70`). It sits above the nav (z-40) and player (z-30/z-50). The list scrolls internally (`max-h-[56vh] overflow-y-auto overscroll-contain`) with `pb-[env(safe-area-inset-bottom)]`. A header row shows the field label + a close button.
- Desktop (`≥640px`): the original anchored dropdown (`sm:absolute sm:mt-2 sm:z-40 sm:rounded-2xl sm:max-h-none`, list capped at `sm:max-h-72`).

Result: the picker never clips, never goes off-screen, and is never hidden behind the bottom nav or mini-player. (Parts 2, 4, 5, 7.)

## Fix 2 — GenrePicker accessibility

`src/components/ui/GenrePicker.jsx`

- **Keyboard navigation:** Arrow Down/Up and Home/End move a roving focus across the visible `[data-genre-option]` buttons; from the search box, Arrow Down jumps into the list. Enter selects (native button).
- **Escape** closes the picker and returns focus to the trigger.
- **Semantics:** `role="listbox"` now wraps only the options list (previously it wrapped the search input too); options keep `role="option"` + `aria-selected`, so the selected genre is announced.
- **Autofocus** the search input on desktop only (`matchMedia('(min-width: 640px)')`) — on mobile this avoided the keyboard popping over the sheet before the user can scroll.
- **Close affordance:** explicit `aria-label`'d close button in the mobile header; trigger keeps `aria-haspopup="listbox"` + `aria-expanded`.
- Focus ring is the app-wide `:focus-visible` outline + pink box-shadow (unchanged, already strong). (Part 5.)

## Fix 3 — Discover selected-genre chip is one accessible button

`src/pages/Discover.jsx`

**Before:** a `<span>` chip containing a nested icon-only `<button aria-label>`. The global mobile rule `button[aria-label]{min-width:44px}` forced that inner button to 44px wide, stretching/breaking the chip on phones.

**After:** the whole chip is a single `<button aria-label="Clear genre: <label>">` with a truncating label and an `aria-hidden` × icon. Accessible, 44px-tall on mobile (fine for a chip), no inner stretch, `max-w-full truncate` so long localized names don't overflow. (Parts 3, 4, 7.)

## Fix 4 — "More" reads as a disclosure

`src/pages/Discover.jsx`

Added a rotating `ChevronDown` inside the "More" pill (rotates when open). Obvious as a disclosure without dominating the tab row. (Part 3.)

## Fix 5 — Long-label hardening

- `src/components/tracks/TrackCard.jsx` — cover genre badge: bounded its container (`left-2 right-2`) and added `max-w-full truncate`, so labels like "Альтернативний рок" can't spill across the artwork.
- `src/components/tracks/TrackListItem.jsx` — row genre badge: `max-w-[14ch] truncate` (md+ only) so it can't squeeze the row.
- `src/components/profile/ListeningStats.jsx` — breakdown row: label `truncate min-w-0`, percentage `shrink-0`, so a long localized genre can't collide with the percent. (Parts 4, 6.)

## Fix 6 — Quick-tab density on small phones

`src/components/ui/GenrePill.jsx` — `px-4 sm:px-5` and `text-[13px] sm:text-sm` (min height stays 44px). Tabs continue to `flex-wrap` (no horizontal scroll). (Parts 3, 7.)

## Fix 7 — i18n

Added `actions.close` to `src/i18n/locales/{en,uk,pl,ru}/common.json` (Close / Закрити / Zamknij / Закрыть) for the new close button. All other genre/UI keys were already present.

---

## Visual consistency

All new/changed elements reuse the existing tokens: `ns-card` surfaces and radii (`rounded-2xl` ≈ `--ns-radius-modal`), `ns-field` inputs, `ns-icon-button`, the `#f02255` pink accent (`brand-red`), the zinc hover palette, `EmptyState` styling, and the global focus ring. No new colors, radii, or shadow language were introduced.

## Tests

- New: `tests/e2e/genre-design.spec.js` — Discover mobile no-overflow, More opens/closes, Escape closes, search filters options, selecting sets the chip, mobile bottom sheet within viewport + usable search, Ukrainian tabs fit, Upload picker opens (backend-tolerant), Upload mobile scrollable + search results. Captures the requested screenshots into `design-audit-screenshots/genre-ui/`.
- Existing `DiscoverGenres` / `UploadFormGenres` component tests remain valid — all test hooks (`genre-picker-trigger/panel/search`, `data-genre-option/group`, 9 quick tabs) were preserved through the rewrite.

In-sandbox verification: all changed JSX parses cleanly; spec passes `node --check`; all locale JSON valid; i18n key coverage complete. Run `npm run build && npm run test && npm run test:e2e` in your environment for the final gate (the macOS-native toolchain/browsers can't run in this QA sandbox).

## Files changed

```
src/components/ui/GenrePicker.jsx          (mobile sheet + a11y + close)
src/components/ui/GenrePill.jsx            (mobile padding/size)
src/pages/Discover.jsx                     (chip button, More chevron)
src/components/tracks/TrackCard.jsx        (badge truncate)
src/components/tracks/TrackListItem.jsx    (badge truncate)
src/components/profile/ListeningStats.jsx  (breakdown truncate)
src/i18n/locales/{en,uk,pl,ru}/common.json (actions.close)
tests/e2e/genre-design.spec.js             (new)
design-audit-screenshots/genre-ui/README.md (new)
```
