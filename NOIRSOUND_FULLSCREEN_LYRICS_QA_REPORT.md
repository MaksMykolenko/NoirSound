# NoirSound Fullscreen Lyrics QA Report

Date: 2026-07-05

Verdict: **FULLSCREEN LYRICS PARTIAL**

## Automated verification

| Check | Result | Detail |
| --- | --- | --- |
| Focused lyrics unit tests | Pass | 1 file, 8 tests |
| Full frontend unit suite | Pass | 28 files, 147 tests |
| Focused fullscreen lyrics E2E | Pass | 2 Chromium tests in mock mode |
| Lint | Pass | `oxlint`, no warnings |
| Production build | Pass | Vite build completed; existing bundle-size advisory remains |
| Diff whitespace check | Pass | `git diff --check` |
| Full E2E command | Blocked | 49 passed, 20 skipped, 4 did not run, 1 infrastructure failure in the existing theme suite |

## Full E2E blocker

`npm run test:e2e` could not complete because the repository's existing `theme-system.spec.js` performs an unconditional login in `beforeAll`, and the API at `http://localhost:3000` was unavailable:

```text
connect ECONNREFUSED ::1:3000
```

Docker was also unavailable, so the documented PostgreSQL/Redis/MinIO stack could not be started. Backend-gated lyrics tests skipped as designed. No backend files were changed to mask this environment failure.

## New test coverage

- Player lyrics icon opens the root-level fullscreen player.
- The deleted floating panel is not rendered.
- Lyrics fetch is lazy and called once when first opened.
- Current track title and lyrics appear.
- Opening and closing preserve playback state and progress.
- Close and Escape exit fullscreen mode.
- Browser Back closes fullscreen lyrics without changing the route.
- Focus is trapped and restored to the invoking button.
- Friendly error state hides raw backend text and retry succeeds.
- No-lyrics state renders after changing tracks while fullscreen remains open.
- Shared seek, previous, next, play/pause, and volume controls render.
- No-lyrics buttons remain disabled under the existing product behavior.
- Mock E2E verifies viewport geometry, inert underlay, desktop controls, mobile controls, Escape, browser Back, and unavailable lyrics.

## Manual local browser QA

### Desktop: 1280×720

- Fullscreen bounds: 1280×720 at top/left 0.
- Computed positioning: fixed.
- Computed z-index: 200.
- Body overflow: hidden.
- Underlying app: inert.
- Close button receives initial focus.
- Lyrics and attribution are readable.
- Bottom seek, transport, repeat/shuffle, and volume controls are visible.
- Escape closes the view and keeps `/track/1`.
- Browser Back closes the view and keeps `/track/1`.

### Mobile: 390×844

- Fullscreen bounds match the viewport.
- Lyrics region uses independent `overflow-y: auto`.
- Close control remains visible.
- Bottom controls end exactly within the viewport.
- No horizontal document overflow.
- Safe-area-aware top and bottom padding is present.

### Compact mobile: 360×800

- Fullscreen bounds match the viewport.
- Close and playback controls remain reachable.
- No horizontal overflow.

## Playback preservation

Source inspection confirms that fullscreen opening/closing does not touch the audio element, current track, queue, progress, or play-event logic. The same singleton audio store controls both the existing player and fullscreen controls. Unit tests preserve `isPlaying: true` and progress during open/close.

The local mock audio host was not reachable in browser QA, so continuous audible playback was not claimed as a manual full-stack result. This does not affect the state-isolation proof, but it remains part of the production verification gap.

## Accessibility QA

- `role="dialog"` and `aria-modal="true"`.
- Localized full-screen accessible label.
- Keyboard-reachable close and playback controls.
- Escape closes only lyrics first.
- Visible-control focus trap.
- Focus restoration.
- Inert/hidden underlay.
- Body scroll restoration.
- Reduced-motion support.
- Text contrast and minimum mobile control sizing checked visually.

## Production verification

Not performed. No deployment was requested or executed, and `https://noirsound.co` was not modified.

## Remaining gaps

- Complete full-stack E2E with the local API and worker running.
- Verify real published, unpublished/private, no-lyrics, queue next/previous, and audible playback behavior in a production-equivalent environment.
- Verify the deployed flow on `https://noirsound.co` before using `FULLSCREEN LYRICS PRODUCTION VERIFIED`.

