# NoirSound Fullscreen Lyrics PlayerBar QA Report

Date: 2026-07-05

Verdict: **FULLSCREEN LYRICS PLAYERBAR PARTIAL**

## Automated results

| Check | Result | Detail |
| --- | --- | --- |
| Focused lyrics/playerbar unit tests | Pass | 9 tests |
| Full frontend unit suite | Pass | 28 files, 148 tests |
| Focused fullscreen lyrics E2E | Pass | 2 Chromium tests |
| Lint | Pass | `oxlint`, no warnings |
| Production build | Pass | Vite build completed; existing chunk-size advisory only |
| Full E2E command | Environment blocked | 51 passed, 20 skipped, 4 did not run, 1 existing setup failure |

## Full E2E blocker

`npm run test:e2e -- --reporter=line` ran 76 tests. The only failure was the existing `theme-system.spec.js` unconditional `beforeAll` login:

```text
connect ECONNREFUSED ::1:3000
```

The local API and Docker runtime were unavailable. Backend-gated suites, including the full-stack lyrics flow, skipped as designed. No backend or unrelated theme test was changed to hide the environment failure.

## Unit coverage

- Fullscreen renders the shared standard track-info area.
- Fullscreen renders the shared standard transport and progress components.
- Desktop play button has the standard `w-8 h-8` styling.
- Old pink/purple fullscreen gradient control is absent.
- Active lyrics action is present in the standard action area.
- Play/pause delegates to the existing `togglePlay`.
- Seek delegates to the existing `seek`.
- Volume delegates to the existing `setVolume`.
- Queue opens through app-shell state.
- Escape closes queue before lyrics.
- The singleton audio object is unchanged after opening fullscreen lyrics.
- Existing lazy loading, retry, track change, focus, Back, and playback-state tests remain passing.

## Focused E2E coverage

- Standard track info appears on the left.
- Standard transport and progress appear in the center.
- Lyrics, queue, volume, and close actions appear on the right.
- Standard play-button sizing is present.
- Old gradient play style is absent.
- Seek and volume inputs update.
- Queue opens and closes without closing lyrics.
- Escape and browser Back close lyrics correctly.
- Mobile shared progress/transport render without horizontal overflow.

## Rendered browser QA

### Desktop: 1440×900

- Normal and fullscreen playerbars were captured and compared.
- Fullscreen bar height: 90px.
- Track-info class set: exact match.
- Transport class set: exact match.
- Progress class set: exact match.
- Action-area class set: exact match.
- Play-button class set: exact match.
- Lyrics action label: `Close fullscreen lyrics`, `aria-pressed=true`.
- Old fullscreen gradient control: absent.
- Queue opens above fullscreen at z-index 220.

### Mobile: 390×844

- Footer fits the viewport.
- Shared mobile progress and transport are rendered.
- Track info and right-side actions remain readable.
- Lyrics scroll region remains independent.
- No horizontal overflow.

### Compact mobile: 360×800

- Footer fits the viewport.
- Standard mobile play button is 64×64px.
- Back control remains visible.
- No horizontal overflow.

## Production verification

Not performed. No deployment or change to `https://noirsound.co` was made.

## Remaining gaps

- Complete the full E2E suite with the backend stack running.
- Verify audible playback continuity, queue transitions, volume, and seek on the deployed production flow.

