# NoirSound — Track Page Design QA Report

**Pass:** Track Page Design Refresh — QA
**Date:** 2026-06-28

UI/UX only. No backend/upload/worker/stream/player-behavior changes; no mock data; real metadata only.

---

## Old layout issues → fixes

| Old issue | Fix |
|---|---|
| Right-side 2×2 stat grid made the hero feel like an analytics dashboard | Removed the `aside` grid **and** the duplicate inline stat bar |
| Big boxes for tiny values; metadata over-weighted | One muted, secondary, wrapping metadata row under the actions |
| Empty-feeling right side on wide screens | Two-column hero (cover · info), no right panel |
| Waveform felt detached (large gap above) | Hero + waveform are one connected unit (`space-y-4`) |
| Related empty state looked like an error in a wide panel | Compact, friendly empty card |
| Hero leaked non-theme blue + hardcoded white icon | Theme tokens only; icons use `currentColor` (on-accent) |
| TrackPage + comments hardcoded English | New `trackPage` (29) + `comments` (12) i18n keys × 4 languages |

## New hero layout
Cover (larger, themed border/shadow, bottom-aligned on desktop) · info column: **genre pill → bold title → clickable artist → Play / Like / Add / Share → metadata row → subtle note**. Backdrop = blurred cover + `--ns-accent-soft` wash. No dashboard cards.

## What replaced the stats grid
A single secondary metadata line: `🎧 {plays} · ⏱ {duration} · Released {date}` — muted, wrapping, **omits missing values**, genre kept as the pill above. Play count is icon + number with a localized aria-label; a contextual note (`Be the first to listen.` / `Uploaded by {artist}`) sits beneath. All real data.

## Metadata row behavior
- Plays: always shown (real count, `toLocaleString`).
- Duration: shown only when `> 0` (else the segment + its separator are dropped).
- Released: localized `Released {{date}}` with a locale-formatted date; dropped if no date.
- No fabricated values; no stray `—`.

## Waveform / Description / Related / Discussion
- **Waveform:** connected to the hero; live `progress / duration` while playing, total duration otherwise; localized seek hint; compact dashed **unavailable** state (localized via new `unavailableLabel` prop); accent-colored progress bars.
- **Description:** clean text block, or one muted line `No description added.`; subtle tag chips.
- **Related:** friendly compact empty card ("No similar tracks yet." + helper line); 2–4 keyboard-accessible rows when present.
- **Discussion:** localized title + subtitle ("Join the discussion" / "Share feedback with the artist") + count; localized input/empty/sign-in/error states.

## Mobile checks (360 / 390 / 430 / 768 / 1440)
- Cover capped (`w-44` mobile → `w-60` desktop) — not huge.
- Title wraps (`break-words`), actions/metadata `flex-wrap`, no right-side grid on any width.
- Waveform is width-fluid; comments input stacks (`flex-col sm:flex-row`).
- Bottom nav/player clearance comes from the existing `AppLayout` bottom padding; the e2e spec scrolls the discussion into view to confirm it isn't covered.
- No horizontal overflow (asserted in the e2e spec).

## Theme checks (all 9 themes)
The page uses only theme tokens / remapped utilities: `--ns-accent-soft`, `--ns-border`, `--ns-shadow-color`, and `brand-red`/`rose-*`/`zinc-*` (which map to `--ns-*`). Grepped clean — no `blue-*`/`emerald-*`/literal hex/`fill="white"` in TrackPage, Waveform, or CommentSection. Play button, genre pill, active waveform, like/add/share, and focus ring all resolve through the accent token, so they recolor per theme (Noir Pink, Midnight Blue, Crimson Red, Royal Purple, Emerald Dark, Light Minimal, Green Stream, Orange Wave, System).

## Tests run
**Added**
- `tests/components/TrackPage.test.jsx` — no old 2×2 grid; metadata row (plays/duration/date) + genre pill + note; missing-metadata safe + compact empty states; friendly related empty state; theme CSS variables present; genre label localizes (uk).
- `tests/e2e/track-page.spec.js` — desktop + mobile smoke (play button, waveform, discussion, no overflow, no old grid), localized error states (en + uk), backend-tolerant real-track captures, theme screenshots.

**Verified in-sandbox** (Node v22; the project's macOS-native `node_modules` and browsers can't run here):
- All changed JSX parses cleanly (acorn-jsx); the e2e spec passes `node --check`.
- All 4 locale JSON valid; every referenced `trackPage`/`comments` key present in en/uk/pl/ru.
- TrackPage/Waveform/CommentSection grepped free of non-theme colors and hardcoded English.

Run the full gate in your environment:
```bash
npm run build
npm run test
npm run test:e2e
```
No backend files changed, so backend tests are not required.

## Files changed
`src/pages/TrackPage.jsx`, `src/components/player/Waveform.jsx`, `src/components/ui/CommentSection.jsx`, `src/i18n/locales/{en,uk,pl,ru}/common.json`, `tests/components/TrackPage.test.jsx` (new), `tests/e2e/track-page.spec.js` (new), `design-audit-screenshots/track-page-refresh/README.md` (new), plus this report and `NOIRSOUND_TRACK_PAGE_REFRESH_REPORT.md`.

## Remaining issues
- Real screenshots + full `build`/`test`/`test:e2e` must run in your environment (no browser / native toolchain in the QA sandbox).
- The Share button uses the Web Share API where available and falls back to clipboard copy + toast; on browsers without either, it silently no-ops after the toast.
- Related tracks are genre-matched client-side over the loaded catalog (unchanged from before); a dedicated endpoint could improve relevance later.

---

## Verdict

# TRACK PAGE MVP READY

The old 2×2 stat grid is gone and replaced by a subtle, secondary metadata row; the hero now reads as a real music track page (cover-forward, accent backdrop, strong title hierarchy, clean Play/Like/Add/Share); metadata is readable but secondary; waveform, description, related and discussion are polished and localized; the mobile layout has no right-side grid and no horizontal overflow; and every key element resolves through theme tokens. The remaining step to **PUBLIC-BETA READY** is running `npm run build` / `npm run test` / `npm run test:e2e` and reviewing the per-theme screenshots in your environment — all of which was implemented and statically verified here, but the macOS-native toolchain and browsers can't execute in this sandbox.
