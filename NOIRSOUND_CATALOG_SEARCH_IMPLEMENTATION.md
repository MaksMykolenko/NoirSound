# NoirSound: catalog and server search

## Contract and compatibility

`GET /api/discover/catalog` is additive. It returns `{ items, total, pageInfo: { nextCursor, hasNextPage, pageSize }, facets, meta }`. Existing `/api/tracks`, artist tracks, playlists, upload and admin response envelopes remain compatible. The legacy `/tracks` page-size maximum is still 60 for old bounded consumers; Discover no longer relies on it and has no total-catalog cap.

| Parameter | Meaning and validation |
| --- | --- |
| `q` | NFC-normalized, trimmed, repeated whitespace collapsed; maximum120 characters; empty means no search |
| `contentType` | MUSIC or BEAT; omitted/ALL means both; old records default to MUSIC |
| `genre`, `group` | Existing taxonomy keys/genre aliases; mutually exclusive; legacy stored genre values match canonical selections |
| `style`, `mood` | Exact trimmed, case-insensitive Beat metadata; maximum80 characters |
| `key` | Existing musical-key normalizer, including F# Minor |
| `bpmMin`, `bpmMax` | Inclusive integer bounds40–240; minimum cannot exceed maximum |
| `bpm` | Compatibility adapter for under-90,90-119,120-149,150-plus; cannot be combined with explicit bounds |
| `sort` | recent, played, liked, trending; allowlisted SQL only |
| `limit` | Default30, minimum1, maximum100; page size, never a total limit |
| `cursor` | Validated opaque continuation for the same normalized search/filter/sort |

Unknown parameters, repeated query values, invalid enum/range/sort values and conflicting filters return400. Beat-specific filters require `contentType=BEAT`; the UI clears them when moving to Music/All. Different dimensions combine with AND. Existing controls are single-select; there is no new multiselect contract.

Search runs in PostgreSQL over title, public author display name/username, primaryArtistName, featuredArtists[], tags[], genre keys/labels/aliases, beatStyle and beatMood. Credits and tags use EXISTS/unnest rather than multiplying result rows. Quotes, percent, underscore, backslash and hash are literal search characters; LIKE metacharacters are escaped and values parameterized. Descriptions and full lyrics are deliberately outside search and catalog payload.

## Pagination and ordering

Recent: publishedAt DESC NULLS LAST, id ASC. Played/liked: stored plays/likes counter DESC, then the same date/id tie-break. Trending: qualified PlayEvent count in the previous seven days DESC, then the same date/id tie-break; it never falls back to lifetime plays. Zero-score tracks remain reachable at the end of the full trending-sorted catalog.

The database filters and orders before LIMIT(pageSize+1). The extra row determines hasNextPage. Cursor version1 binds the normalized filters and sort by SHA256 fingerprint and carries the last row's score/date/ID plus rankingAsOf. A changed query/sort with an old cursor returns CATALOG_CURSOR_INVALID. Changing page size is allowed. Null publication dates are explicitly supported.

Each response's items, total and facets run in one Repeatable Read transaction. Unchanged data traverses exactly once, including ties and null dates. This is not a persistent database snapshot across requests: new publications can appear before a cursor; publication/visibility changes can remove rows; changes to plays/likes counters or qualification can move ranks. Trending freezes its time-window endpoints in the cursor, but does not freeze later event edits. Refreshing starts a new traversal. The UI defensively deduplicates appended IDs while preserving server order; it cannot promise snapshot isolation across live changes.

## Counts, facets and creators

Total counts the entire authorized match set, independently of page size/cursor. Every returned facet count includes q, content type and all other dimensions, excluding its own dimension. Genre/group are one hierarchical taxonomy dimension, so selecting one does not accidentally suppress siblings through the other. Taxonomy aliases are merged once; group totals sum disjoint canonical genres. BPM choices exclude the active BPM range.

There are seven bounded read queries per catalog response: page, total, taxonomy, styles, moods, keys, BPM. Dynamic creator-authored facets return the top100 case-insensitive values by count, retaining an actively selected rare value as an additional option. Each count still covers the complete authorized database. `facets.meta` declares optionLimit, availableOptions and truncated for styles/moods/keys. This bounds facet payload without treating omitted options as zero or limiting track access; the API can still filter an exact value directly. The existing taxonomy is returned completely. A failed request remains an error, never a synthetic zero count.

`/api/artists?hasPublishedTracks=true&sort=trending&limit=6` (maximum24) ranks visible active creators using qualified seven-day events on public published tracks only. Its explicit payload returns discoveryPlays and omits cached monthlyListeners, which could contain unrelated activity. Follow flags are viewer-specific; cards retain their existing follower metric. Home requests8, Discover6. Default artist endpoints preserve their original envelopes.

## Public policy and payload

The shared publicVisibility helper requires Track.status=PUBLISHED, Track.isPublic=true, ArtistProfile.isHidden=false and author.status=ACTIVE. There is no admin exception in public discovery. These conditions are shared by catalog/counts/facets, legacy listing/trending and public artist discovery. Hidden, private, draft, processing, failed, rejected and inactive-author records cannot influence catalog results or aggregate counts.

The existing policy allows published records without processed audio to remain discoverable with isStreamable=false. The new code preserves that rule. The catalog SQL explicitly selects public lightweight fields and safe artist display data; it does not select full lyrics, storage keys, upload URLs, email, waveform blobs or description blobs. It emits hasLyrics/lyricsType and stream/cover availability. The existing mapper resolves normal protected stream/cover routes, preserving the shared player, queue, likes, menus and playlist actions. Catalog responses contain no viewer-specific like flags and use Cache-Control:no-store. The route reuses the existing rate limiter at120 requests/minute; local test multipliers cannot raise production limits.

## Frontend state and consumers

Discover uses the existing React Query layer with useInfiniteQuery. Its key contains viewer identity and every effective filter, query, sort and page-size value. Fetch signals cancel stale requests. New filters receive their own first page; repeated Load More clicks are guarded and single-flight. A failed next page preserves loaded rows and retries the same cursor. The UI shows loaded/total and the terminal state. Loading pages does not call playback, create events or mutate queue contents. Playing uses the loaded row context only.

The URL remains the query source: `content`, q, genre/group, Beat filters and sort. Descriptive content aliases are read centrally; controls write the existing content vocabulary. Discover typing debounces300ms and replaces the current history entry; explicit tabs/filters/sort push history. Header search submits the same q to Discover. The mobile search action focuses its search field. Refresh, Back/Forward and Track detail/back retain the selected query. Viewer-scoped query keys prevent authenticated flags crossing account changes; no second server-state store was added to Zustand.

Editorial sections stay short. View All navigates to the complete matching catalog type/filter/sort. Home now asks the server separately for the newest8 MUSIC and8 BEAT records. Track detail asks for up to5 same-type/canonical-genre records and omits the current track for its existing four-item rail. Real Library continues using its own liked/history/followed collection endpoints.

## Performance and migrations

The optional guarded measurement tool is `backend/scripts/measure-catalog-test.js`; historical evidence is `artifacts/catalog-search/performance.json`. In a clean checkout, `node scripts/run-integration.mjs performance` provisions its own disposable services and writes `test-results/integration/performance.json`. It creates a dedicated loopback PostgreSQL *_perf_test database, applies existing migrations and seeds320 public records (160 MUSIC,160 BEAT),10 excluded records,6 authors and1,622 play events. It runs ANALYZE, actual parameterized EXPLAIN ANALYZE BUFFERS for representative page queries, and two warmups plus seven measured complete responses per scenario. Final measurements are in the QA document; these are local warm-cache results, not a production capacity claim.

No new migration is added by this catalog stage. Existing Track status/artist/contentType-publishedAt indexes and the inherited qualified-createdAt-trackId PlayEvent index remain available. Small-fixture plans can legitimately choose sequential scans; broad substring search with credit/tag EXISTS needs remeasurement on materially larger real datasets before adding a trigram/full-text index or new infrastructure. The release includes the two inherited Music/Beats and Discover-index migrations; their production application is not verified.

## Release integration

The catalog-stage verification preceded commit/push/merge and made no production changes. Release finalization is recorded separately in `NOIRSOUND_RELEASE_FINALIZATION_REPORT.md`.

Use the committed `scripts/run-integration.mjs all` from a clean checkout after `npm ci` in root and backend, with Docker, FFmpeg and Playwright Chromium available. It creates isolated PostgreSQL/Redis/MinIO, real API/worker and explicitly separate demo services without a local environment file.

Production uses the existing `scripts/deploy-hostinger.sh` only after exact-SHA CI, verified existing Compose project/environment, clean VPS checkout, successful PostgreSQL/storage backup, isolated restore and verified private offsite copy. Build all application images from that SHA; run `prisma migrate deploy` from the NEW backend image before updating application services. Pending migration status is diagnostic, not a reason to run migration from an old container. Preserve prior image IDs and persistent volumes. Missing access or an unverified prerequisite blocks production changes.

Readiness must be followed by real HTTPS catalog and authenticated functional smoke. On failure, stop and inspect redacted logs since deployment start; apply only a verified compatible application rollback. Never automatically restore a database over new user records.
