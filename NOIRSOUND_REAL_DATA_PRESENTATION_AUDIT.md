# NoirSound Real Data Presentation Audit

Date: 2026-06-28  
Mode audited: real API mode (`VITE_USE_MOCK_API` disabled)

## Summary

The initial real-mode catalogue rendered backend records, but repeated records and legacy seed content made several sections look synthetic. Missing covers and avatars also converged on repeated stock assets. The presentation pass now deduplicates API entities by stable IDs, renders missing media deterministically, and uses explicit low-data or unavailable states. No real-mode path falls back to `src/api/mock/`.

## Section audit

| Section | Backend data | Static presentation | Duplicate/generic findings | Missing-data behavior | Backend gap |
| --- | --- | --- | --- | --- | --- |
| Home | `GET /tracks`, `GET /artists` | Hero, product copy, feature descriptions, genre positioning | The old catalogue could repeat legacy seed records; the label “Trending” implied ranking that did not exist | Tracks/artists are deduplicated and sorted; empty catalogue and artist states are shown; section is now “Latest Releases” | No ranked/trending endpoint |
| Discover | `GET /tracks`, `GET /artists` | Genre filter choices and page copy | Initial browser audit showed repeated `Neon Drift`/`Midnight Run`, repeated artwork, generic `The Artist`, and duplicate artist rows | Unique newest-first releases; honest filtered/no-catalogue states; API errors remain visible | Search/filtering is client-side; no server pagination or discovery ranking |
| Featured | Derived from `GET /tracks` | Four-card maximum and selection policy | Repeated track IDs were previously allowed; unprocessed seed records could look premium/playable | Unique IDs only; published and streamable records only; renders 0–4 cards without filler; explicit stream-ready empty state | Backend does not expose a curated featured ranking |
| All Releases | Derived from `GET /tracks` | Newest-first sort policy | Duplicate track IDs and repeated missing-art assets | Unique IDs; title, artist, genre, duration, and plays are honest; missing duration is `—`; missing art uses deterministic cover; zero catalogue offers “Upload the first track” | No pagination |
| Recommended Artists | `GET /artists`, correlated with `GET /tracks` | Local ranking policy | Duplicate artist IDs, generic avatar, sparse cards | Published-track artists first, then followers, then newest; deterministic initials; fewer cards instead of duplicate filler; “No creators yet” state | No recommendation endpoint or authoritative follower-based recommendation score |
| Track detail | `GET /tracks/:id`, `GET /tracks/:id/comments`, related records from `GET /tracks` | Page headings and related-section copy | Repeated related tracks and stock missing cover; missing duration could appear numeric | Related tracks deduplicated and sorted; deterministic covers; missing duration/date are `—`; play/queue disabled when audio is unavailable | No dedicated related-tracks endpoint |
| Artist profile | `GET /artists/:id`, `GET /artists/:id/tracks`, `POST /artists/:id/follow` | “Independent artist” label and section headings | Generic artist fallback and stock avatar; absent username could render an invalid public URL | Display name → username → email prefix → `Unknown artist`; deterministic avatar; missing handle hidden; empty tracks/bio/genres/socials stated honestly | Follow status for current user and richer artist analytics are not returned |
| Library | `GET /me/recently-played` in real mode | Tab definitions and explanatory copy | Earlier demo collections could imply persisted real data | Recently played is real; liked songs, personal playlists, and followed artists show explicit unavailable states instead of fake collections | Missing current-user liked-track, playlist-collection, and followed-artist list endpoints |
| Profile | `GET /auth/me`, `GET /me/listening-stats`, `GET /me/recently-played` | Tab definitions and account-data explanation | Empty account collections previously risked looking like zero-valued complete features | Real recent history and stats; honest unavailable states for unsupported collections/activity/editing | Missing profile update, liked-track list, personal playlist list, followed-artist list, and activity endpoints |
| Listening stats | `GET /me/listening-stats` from persisted `PlayEvent` rows | Metric labels and confidence threshold | Playback starts could coexist with misleading `0h 0m`; a one-event percentage chart looked authoritative | API now returns seconds; zero-duration starts show “No measured listening time yet”; no events show “Not enough listening data yet”; percentages are hidden below three starts | No time-series or richer aggregation endpoint |
| Playlist page | `GET /playlists/:id` | Public-playlist label | Duplicate playlist track IDs and stock cover fallback | Tracks deduplicated in playlist order; deterministic cover; unavailable-only playlists do not show a working play action; zero duration says “Duration unavailable” | Backend does not expose current-user ownership/like state in the mapped response |
| Creator Dashboard | `GET /tracks`, filtered by authenticated `artistProfileId` | Available-metrics explanation | Catalogue order was not normalized; unavailable analytics could look like zeroes | Unique newest-first releases; empty state says “Your creator analytics will appear after your first upload”; unsupported metrics are named, not fabricated | Missing follower, monthly-listener, revenue, and time-series creator analytics |
| Sidebar library | `GET /me/recently-played`; create-playlist API exists | Navigation and “Backend collection pending” explanations | Real mode could not substantiate demo artist/playlist collections | Demo-only sections remain gated to mock mode; real mode shows recently played and an endpoint-gap explanation | Missing signed-in playlist and followed-artist collection endpoints |
| Player and queue | `GET /tracks/:id/stream`, play-event API | Player-ready copy and transport UI | An unstreamable record could enter a queue and fail on next | Only streamable tracks enter playback queues; missing covers use deterministic visuals; stream errors remain explicit | No queue persistence endpoint |

## Cross-cutting findings

- Real uploaded covers remain authoritative, even when a user uploaded the same artwork for multiple tracks. The UI does not replace or alter user uploads.
- Seeded records without processed audio are intentionally `PUBLISHED` but unstreamable. The UI labels them “Audio unavailable” and excludes them from Featured.
- Legacy proof uploads in the current local database are user-uploaded records. Their titles/artwork were not renamed or deleted by this pass.
- Deterministic fallbacks are derived from title, artist, and genre (covers) or artist name (avatars); no random or remote stock imagery is used.
- Generic values remain allowed in `src/api/mock/` and tests. They are not imported as real-mode runtime fallbacks.

## Endpoint priorities after this pass

1. Current-user liked tracks, playlists, and followed artists.
2. Server-side discovery/search, pagination, and curated ranking.
3. Profile update and account activity.
4. Creator analytics beyond aggregate track plays/likes.
5. Related-track recommendations and persisted queue state.
