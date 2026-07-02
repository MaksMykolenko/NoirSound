# NoirSound Stats, Followers, Listening Data — Audit (Phase 1)

Read: `backend/prisma/schema.prisma`, `backend/src/routes/{stats,artists,tracks,admin}.js`, `backend/src/plugins/csrf.js`, `backend/src/index.js` (rate-limit registration), `backend/prisma/seed.js`, `src/api/real/{artists,stats}.js`, `src/store/{playerStore,userStore}.js`, `src/pages/{ArtistPage,Dashboard,Profile,TrackPage,Discover}.jsx`, `src/components/artists/ArtistCard.jsx`, `src/components/profile/ListeningStats.jsx`, `src/components/tracks/TrackListItem.jsx`, `src/components/playlists/PlaylistCard.jsx`, `src/utils/formatLocale.js`. No `backend/src/routes/follows.js` or `play-events.js` exist as separate files — that logic lives inside `artists.js` and `stats.js`.

## Data model inventory

There is no `Subscription` model and no `RecentlyPlayed` model — those are computed, not stored.

- **`ArtistFollow`** (`userId`, `artistId` composite PK, `createdAt`) — the one and only follow model. No denormalized count field anywhere; follower/following counts are always a live `count()`/`_count` query against this table. This is structurally safe against staleness.
- **`PlayEvent`** (`id`, `trackId`, `userId?` nullable for anonymous, `artistId?` denormalized, `sessionId?`, `durationListenedSeconds`, `completed`, `source?`, `createdAt`) — one row per reported play. No unique constraint, no dedupe key, no `qualified` flag (added by this pass — see below).
- **`Track.plays`** (`Int @default(0)`) — a stored, incremented aggregate. Source of truth is meant to be "count of qualified `PlayEvent`s for this track," kept in sync by incrementing at write time (not a live-counted value).
- **`ArtistProfile.monthlyListeners`** (`Int @default(0)`) — stored field. **Before this pass, nothing in `backend/src` ever wrote to it after creation** — confirmed by grep across the whole backend. It is read (admin list/detail, public artist GET, `ArtistCard`) but never recalculated. Every artist's monthly listeners was permanently frozen at whatever the seed/migration set (`0` for all seeded artists) regardless of real activity.
- **`ListeningAggregate`** (1 row per user, `userId` is the primary key — not a composite of user+date, so despite the `date` field and its comment ("can be used if cron aggregates per day") it can only ever hold one snapshot, never real daily history) — **confirmed completely dead**: no route reads or writes it. `stats.js` has an explicit comment: "MVP: Calculate live from PlayEvent table to avoid background cron complexity." This model should be treated as not implemented; user listening stats are computed live from `PlayEvent` instead.
- **Genre taxonomy**: `Track.genre` is a free string; `normalizeGenre()` (`backend/src/constants/musicGenres.js`) is the shared source of truth used to collapse legacy/mixed-case values, already used correctly in the listening-stats genre grouping.

## Source of truth per metric (before this pass)

| Metric | Source of truth | Status before this pass |
|---|---|---|
| Followers count | `count(ArtistFollow where artistId=X)` / Prisma `_count.followers` | Correct, live-queried, no staleness risk |
| Following count | `count(ArtistFollow where userId=X)` | Correct (used by `/me/followed-artists`) |
| Follow (mutate) | `ArtistFollow.upsert` on composite key | Correct — idempotent, cannot duplicate |
| **Unfollow (mutate)** | — | **Not implemented at all.** No backend route, no frontend API function, no working UI path. See Bug F-1. |
| Track plays | Meant to be: qualified `PlayEvent` count, cached on `Track.plays` | **Broken.** The only client ever calls the endpoint with `durationListenedSeconds: 0`, so the increment condition (`>= 30`) is never satisfied in real usage. See Bug P-1. |
| Artist monthly listeners | Meant to be: distinct listener identities with a qualified play on any of the artist's tracks in the last 30 days | **Broken / not implemented.** Field exists, is displayed everywhere, and is never computed. Always shows the seed/creation value. See Bug M-1. |
| Recently played | Latest **valid** play events for the current user, deduped by track | **Partially broken.** The query itself is correct (published/visible tracks only, dedup, most-recent-first) but "valid" was never enforced — every zero-duration phantom play event pollutes it. See Bug P-1. |
| User listening stats (`totalListeningSeconds`, `tracksPlayed`, `uniqueArtists`, `topGenre`) | Live aggregation over the user's `PlayEvent` rows | **Partially broken** — same root cause: unfiltered by validity, so `tracksPlayed` counts every click, not every listen. |
| Top genres | Grouped valid play events by normalized genre, percentage of total | Logic correct, same validity gap as above |
| Top artists (ranked list) | — | **Not implemented.** `userStore.js` reads `stats.topArtists` from the listening-stats response; the backend never returns that field. Always silently `[]`. No UI currently renders it, so it is dead plumbing rather than a visible bug, but it directly matches a ticket focus area. Implemented in this pass (see below). |
| Top tracks (ranked list) | — | **Not implemented**, same as top artists (`stats.topTracks`). Only a singular `topTrackId` existed. Implemented in this pass. |
| Artist dashboard stats | — | **Mostly not implemented.** Dashboard only ever computed `totalStreams`/`totalLikes` from the artist's own `track.plays`/`track.likes` (itself broken per Bug P-1) and explicitly told the artist "Follower, monthly-listener, revenue, and time-series analytics are not available from the backend yet." Honest placeholder, but a real gap against the ticket's Phase 6 requirements. |
| Admin stats / integrity | `/admin/overview` has real, correct aggregate counts (users/tracks/uploads/reports/comments/play events). No integrity-check surface existed. | Overview correct; integrity tooling not implemented (Phase 8-10 of this ticket). |

## Bugs found (numbered, referenced from the fix sections and the other reports)

**F-1 (Followers).** No unfollow anywhere: no backend route, no `unfollowArtist` API function, and the follow button's own click handler has `if (isFollowing) return;` with no unfollow branch — clicking "Following" is a silent no-op.

**F-2 (Followers).** `isFollowing` is hardcoded `useState(false)` in both `ArtistPage.jsx` and `ArtistCard.jsx` and is never hydrated from the server. A user who already follows an artist sees a "Follow" button, not "Following" — most visible on the Profile → Followed Artists tab, where by definition every card shown *is* already followed but still renders "Follow". Clicking it calls the (idempotent, safe) upsert, so the database count never becomes wrong, but the **locally displayed** follower count is optimistically incremented anyway, becoming fake-inflated on screen even though the real count didn't change.

**F-3 (Followers).** `GET /api/artists/:id` (and the list endpoint) never told the frontend whether the current viewer already follows — root cause of F-2.

**F-4 (Followers).** The follow endpoint has no rate limit (`@fastify/rate-limit` is registered with `global: false`, so every route must opt in; `artists.js` never does).

**F-5 (Followers).** `ArtistCard.jsx`'s follow handler doesn't check for a signed-in user before calling the API — no login-required prompt, unlike `ArtistPage.jsx`, which does it correctly. Inconsistent UX, and the anonymous call just fails against the backend's auth guard.

**P-1 (Plays / listening data — the most serious bug found).** `playerStore.js`'s `playTrack()` calls `incrementPlayStats(track.id, track.artistId, { durationListenedSeconds: 0, completed: false })` **immediately** on every successful `audio.play()` — on first play, on every `next()`/`previous()`, and on every loop of repeat-one. This is the *only* call site of `recordPlayEvent` in the whole frontend. Consequences:
- `Track.plays` can never increment through real usage, because the backend only increments it when the reported duration is `>= 30`, and the only caller always reports `0`.
- A full `PlayEvent` row is created on every click, including instant skips — polluting `recently-played`, `tracksPlayed`, `uniqueArtists`, and `topGenre`/`topGenres` for the current user, since none of those queries filtered by any listened-duration threshold.
- The backend's own threshold (a flat `durationListenedSeconds >= 30`) doesn't implement the ticket's rule either — for a track shorter than 60 seconds, the qualifying threshold should be `duration * 0.5`, which is less than 30.
- There is no `qualified` concept stored anywhere, so no consumer could filter for "valid" events even if it wanted to.

**M-1 (Monthly listeners).** Direct consequence of `ArtistProfile.monthlyListeners` never being written: every artist shows a permanently frozen number (0 for everyone created after the initial migration/seed) regardless of real listening activity, on the public artist page, `ArtistCard`, and the admin artist list/detail.

**D-1 (Formatting consistency).** Six call sites format follower/play/like counts with raw `.toLocaleString()` (browser-default locale, no compact notation) instead of the shared `formatNumber()` helper: `Discover.jsx:354`, `TrackPage.jsx:267,270`, `PlaylistCard.jsx:71`, `ArtistCard.jsx:65`, `TrackListItem.jsx:139`. Even the call sites that *do* use `formatNumber()` don't get compact notation, because the helper itself only does locale-aware grouping (`1,234,567`), not the `1.2K` / `1.4M` compact form the ticket specifies. `AdminOverview.jsx` has its own local `valueOrUnavailable()` helper using `.toLocaleString()` — this one is intentionally kept as exact/precise (admin/ops context) and is *not* changed by this pass; only the public-facing social-proof counters are unified.

## Design decisions for the fix

- **`PlayEvent` gets a new `qualified Boolean @default(false)` column** (migration, no data loss) computed and stored server-side at write time, using `min(30, trackDurationSeconds * 0.5)` — never trusting a client-sent flag. This makes "valid play event" a first-class, queryable, auditable concept instead of something re-derived ad hoc (and inconsistently) in every consumer. `recently-played`, `listening-stats`, and monthly-listener computation all filter on it.
- **Frontend play tracking is rewritten** to accumulate real listened seconds from `ontimeupdate` deltas (capped per-tick to prevent seek-to-qualify gaming) while actually playing (not while paused), and to send exactly one `recordPlayEvent` call per play session, at the moment the threshold is first crossed — never on `playTrack()` itself. This satisfies "no count on page load," "no count from rapid play/pause," and "no duplicate count from progress polling" simultaneously, because it lives in the Zustand store (survives React remounts) and is gated by a single "already sent" flag per session.
- **`ArtistProfile.monthlyListeners` becomes a kept-fresh cache**: recomputed for the affected artist synchronously whenever a new qualified play event is recorded for one of their tracks (a real distinct-`userId`-in-30-days query), plus recalculable on demand by an admin via `POST /api/admin/stats/recalculate`. No cron exists in this codebase and this pass does not add one; "kept fresh on write + recalculable on demand" was chosen over introducing new scheduler infrastructure.
- **Top artists / top tracks are implemented** (not just documented as missing) in the same `/me/listening-stats` handler that already grouped by genre, using the same qualified-event grouping, and rendered in `ListeningStats.jsx`.
- **`formatNumber()` is upgraded to compact notation** (`Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 })`), matching the ticket's exact expected outputs (`0`, `1`, `999`, `1.2K`, `1.4M`), and all six raw `.toLocaleString()` call sites for public-facing counters are switched to it. Admin's exact-count helper is left untouched.
- **`ListeningAggregate` is left as dead schema** — out of scope to activate or remove in a data-integrity QA pass; documented here so it isn't mistaken for a working feature.

See `NOIRSOUND_FOLLOWERS_QA_REPORT.md`, `NOIRSOUND_LISTENING_STATS_QA_REPORT.md`, and `NOIRSOUND_ARTIST_DASHBOARD_STATS_REPORT.md` for what was actually fixed, tested, and verified, and `NOIRSOUND_STATS_DATA_INTEGRITY_REPORT.md` for the overall verdict.
