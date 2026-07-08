# NoirSound Human Design QA Report

Date: 2026-07-08
Companion documents: `NOIRSOUND_HUMAN_DESIGN_AUDIT.md` (findings), `NOIRSOUND_HUMAN_DESIGN_POLISH_REPORT.md` (implementation detail).

## AI-looking patterns found / removed / tokens / components / copy

Full detail lives in the audit and polish report. In brief: an untokenized hero radius typed as a magic number in 10 places, non-theme-aware purple/violet/blue standing in for the brand's secondary accent in 6 places, a decorative blur blob copy-pasted onto every card in two grids, a triple-stacked hover-scale duplicated across three card components, a rainbow-gradient/glow 404 heading, and five hardcoded English strings on `ArtistPage` that bypassed i18n. All were fixed directly (not just logged) via two new CSS tokens (`--ns-radius-hero`, `.ns-card-hero`, `.ns-row-interactive`) and 19 component/locale file edits. See the polish report for the itemized list.

## Desktop QA

Code-level review, not rendered screenshots (no browser tool is available in this sandbox session — see "Production verification" below for why). For every file touched, checked that only radius/color/hover-effect classes changed and no spacing, breakpoint (`sm:`/`md:`/`lg:`), flex/grid, or structural class was altered:

- `TrackPage.jsx`, `ArtistPage.jsx`, `PlaylistPage.jsx`, `UserProfileHeader.jsx`, `HomeHero.jsx` hero sections: radius swapped to `.ns-card-hero`, all padding/gap/flex classes untouched.
- `TrackCard.jsx`, `PlaylistCard.jsx`, `ArtistCard.jsx`: only the `group-hover:scale-*`/`hover:scale-*`/`active:scale-*` fragments and one decorative `<div>` were removed; the card, image-wrap, and layout classes are unchanged, so grid layout at desktop widths is unaffected.
- `ProductFeatures.jsx`/`StatsCard.jsx`: only the absolutely-positioned decorative `<div>` was removed; the card's own padding/content is untouched.
- `LyricsEditModal.jsx`/`AuthModal.jsx`: radius now reads from `var(--ns-radius-hero)` at the same breakpoints (`rounded-t-` on mobile, `sm:rounded-` at ≥640px) — the responsive corner behavior is preserved, only the value's source changed.
- Verified `PlayerBarShared.jsx` is imported by both `PlayerBar.jsx` and `FullscreenLyricsPlayer.jsx` (shared transport/progress/track-info subcomponents), so desktop player and fullscreen-lyrics player render from the same code, not independently-styled copies.

`npx vite build` succeeded with 0 errors both before and after every batch of edits (see "Tests" below), which confirms the CSS/JSX is syntactically valid and Tailwind could resolve every class, including the new `var(--ns-radius-hero)` arbitrary-value references — but a successful build does not substitute for a rendered visual check.

## Mobile QA

Also code-level. Confirmed the global mobile rules in `index.css` (safe-area padding and 44px minimum tap targets below 1024px) were not touched by this pass, and confirmed none of the edited files' mobile-specific classes (`mobile-safe-bottom`, `pt-[calc(.75rem+env(safe-area-inset-top))]`, `sm:`/breakpoint variants on the two bottom-sheet modals) were altered — only their radius value's source changed. No horizontal-overflow or tap-target regression is expected from this pass since no width, padding, or touch-target class was modified anywhere. This was not verified on an actual 390×844 / 360×800 rendered viewport — no browser tool was available this session (see below).

## Accessibility QA

- The single global `:focus-visible` rule (`index.css` lines ~328–337) was read and confirmed unmodified.
- Every element removed this pass (`ArtistCard`'s glow overlay `<div>`, `ProductFeatures`'/`StatsCard`'s blur-blob `<div>`s) was purely decorative and non-semantic — no `aria-*`, no focusable element, no text content — so removing them has no accessibility impact.
- No `aria-label`, `role`, `tabIndex`, or keyboard handler was touched in any edit; every change this pass was a `className` string edit or a decorative-node removal, never a JSX-structure or props change to an interactive element.
- The new i18n keys on `ArtistPage.jsx` replace hardcoded strings with `t()` calls using the same components (`EmptyState`, `ErrorState`) and props they used before — no structural change to focus order or landmarks.

## Tests

- `npx oxlint src` — **0 warnings, 0 errors** across 176 files (run twice: once after the component batch, once after the final ArtistPage/i18n batch).
- `npx vitest run` — full suite, chunked into 3 calls to stay under the sandbox's per-call time limit: **32 test files, 181 tests, all passing** (60 in `src/**`, 51 + 70 in `tests/components/**`). Re-ran `tests/components/ArtistPage.test.jsx` individually after the i18n edit (5/5 passing).
- `node -e "JSON.parse(...)"` — all 4 locale files (`en`/`uk`/`pl`/`ru` `common.json`) parse as valid JSON after the new keys were added.
- `npx vite build --outDir <scratch>` — succeeded (0 errors, ~1–7s). The default `dist/` output still hits the same sandbox-specific `.DS_Store` `EPERM` quirk noted in the prior playlist-detail-table pass, worked around the same way with `--outDir`.
- Backend was not touched this pass (no shared mappers, API contracts, or Prisma models were changed — this was a frontend CSS/JSX/i18n pass only), so backend tests were not run, consistent with the spec's own "required only if shared mappers/API changed" condition.
- E2E (`npm run test:e2e`) was not run — this sandbox has no Docker/Postgres and Playwright's webServer boot hangs here, the same constraint documented in the prior pass.

## Production verification

Not performed. No deployment step was run and `https://noirsound.co` was not checked. This sandbox session has no browser-automation tool connected (no Claude-in-Chrome, no computer-use) and no way to boot a persistent dev server across tool calls, so neither a local rendered check nor a live-site check was possible. All QA above is code-level: reading the actual changed source, confirming only the intended classes changed, and confirming the build/lint/test toolchain accepts the result.

## Remaining gaps

- No rendered/visual QA at any breakpoint (390×844, 360×800, 1440×900) — everything above is a code-level review, not a pixel check.
- No production deployment or live check against `https://noirsound.co`.
- Shadow-literal-vs-token inconsistency in `PlayerBar.jsx`/`ArtistCard.jsx` (raw `rgba()` instead of `--ns-shadow-color`) is documented but intentionally not fixed this pass — see polish report.
- No backend or E2E verification (unchanged code, and sandbox cannot run them respectively).
