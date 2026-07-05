# NoirSound Lyrics QA Report

Date: 2026-07-05

## Automated verification

| Gate | Result |
| --- | --- |
| Prisma schema validation and formatting | Passed |
| Additive migration against the local development database | Passed; 9 migrations current |
| Backend full suite | Passed; 12 files, 162 tests |
| Frontend full suite | Passed; 28 files, 144 tests |
| Lyrics-focused Playwright flow | Passed; 1 test |
| Updated batch-upload Playwright flow | Passed; 2 tests |
| Complete Playwright suite (`npm run test:e2e`) | Passed; 68 passed, 6 conditional skips |
| Frontend lint (`npm run lint`) | Passed |
| Production build (`npm run build`) | Passed |
| Forbidden-file scan (`npm run check:forbidden`) | Passed |
| Combined lyrics/upload/batch/Track-page E2E regression | Passed serially; 8 passed, 5 conditional skips |

The production build retains the repository's existing chunk-size warning for the icon bundle;
there are no build errors.

## Coverage

Backend tests verify:

- no-lyrics single upload remains valid;
- lyrics upload persists normalized content when rights are confirmed;
- missing rights and invalid/oversized content return stable errors;
- public lyrics are available only for eligible public Tracks;
- no-lyrics Tracks return a clean empty payload;
- hidden, draft, rejected, private, artist-hidden, and inactive-owner content is not public;
- owner and admin management reads/updates work;
- non-owners cannot edit;
- admin removal is reason-required and audited;
- generic public lists/details expose flags but not lyrics text;
- batch drafts persist lyrics and publish copies them to the final Track.

Frontend component tests verify:

- single-upload lyrics fields and conditional rights validation;
- editor counts, preview, and rights behavior;
- batch Lyrics tab, save behavior, badges, and separate Rights tab;
- public Track lyrics and no-lyrics views;
- lyrics text remains unchanged when UI language changes;
- player panel open/close does not mutate playback state;
- lazy lyrics request failures show the localized unavailable state without changing playback;
- no-lyrics player controls are disabled;
- mobile player/panel variants render.

The end-to-end lyrics flow verifies artist login, real WAV/cover upload, worker processing,
publication, Track-page lyrics, player-panel rendering during playback, a second no-lyrics
upload, dashboard editing, public refresh, admin reasoned removal, and the final public
no-lyrics response.

## E2E execution note

A first combined run triggered the API's shared localhost authentication rate limiter before
login assertions. The API was restarted using the repository's documented non-production
`RATE_LIMIT_MULTIPLIER` and the combined gate was rerun with one worker; 8 tests passed and 5
optional-fixture cases skipped.

The first complete-suite run also exposed three existing locale-sensitive genre test locators:
the tests switched to Ukrainian, Polish, or Russian but still searched for the English UI label
`More`. The locators were made language-independent, the affected genre spec passed, and the
entire 74-test Playwright suite was rerun successfully. Its 6 skips are conditional
backend/fixture smoke cases, not failures.

## Manual in-app browser smoke

The running local application was checked through the in-app browser against the real local API
and worker:

- opened a published Track with artist-provided lyrics;
- confirmed the owner-facing edit control;
- started the Track and confirmed the enabled, labeled player lyrics control;
- opened the full-screen narrow/mobile lyrics panel;
- visually confirmed exact lyric lines, Track/artist context, close control, readable layout,
  and artist attribution;
- opened a published no-lyrics Track;
- confirmed the Track-page clean state/edit affordance and disabled `Lyrics unavailable`
  player control.

No external lyrics source was contacted.

## Requirement status

| Requirement | Status |
| --- | --- |
| Single upload add | Passed |
| Batch settings add/persist/publish | Passed |
| Separate lyrics rights confirmation | Passed |
| Track page display and empty state | Passed |
| Mini/full/mobile player control and panel | Passed |
| Edit after publish | Passed |
| Admin moderation/removal and audit | Passed |
| Public visibility boundary | Passed |
| Lazy full-text fetch; flags in lists | Passed |
| en/uk/pl/ru UI localization | Passed |
| Artist text not translated | Passed |
| Playback/play-count isolation | Passed |

## Production verification

Not performed. This pass used the local application at `localhost:5173` with the local API,
PostgreSQL, Redis, object storage, and worker. `https://noirsound.co/api/ready` and the deployed
artist/admin flow must be checked after deployment before using the
`LYRICS PRODUCTION VERIFIED` verdict.

## Remaining risk

- Synced playback behavior is schema/validation-ready but not user-facing.
- A post-deploy smoke must repeat the single upload, batch publish, edit, moderation, no-lyrics,
  and visibility checks with production storage/CDN behavior.
