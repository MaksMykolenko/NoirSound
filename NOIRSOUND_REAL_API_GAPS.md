# NoirSound Real API Gaps

Date: 2026-06-28

The frontend does not fabricate data for these features. It renders an unavailable, empty, or “not enough data” state until the corresponding contract exists.

| Frontend feature | Previous mock/static source | Needed backend endpoint or contract | Priority |
|---|---|---|---|
| Current-user profile editing | Local Zustand merge and success toast | `PATCH /api/auth/me` with validated editable fields | P1 |
| Current user’s liked tracks | `playerStore.likedTracks` IDs | `GET /api/me/liked-tracks` with normalized track relations | P1 |
| Personal playlist library | Static `playlistStore` collection | `GET /api/me/playlists` | P1 |
| Playlist track editing | Local array mutation | `POST /api/playlists/:id/tracks` and `DELETE /api/playlists/:id/tracks/:trackId` | P1 |
| Followed artists collection | Mock artist list | `GET /api/me/followed-artists` | P1 |
| Artist unfollow | Local toggle | `DELETE /api/artists/:id/follow` | P1 |
| Creator release management | Public published-track list filtered client-side | `GET /api/me/tracks` including DRAFT, PROCESSING, FAILED, and PUBLISHED statuses | P1 |
| Creator dashboard analytics | Static totals and sample chart | `GET /api/me/creator-stats` with time-series definitions | P2 |
| Server-side catalogue search | Client filter over the first 20 published tracks | `GET /api/search?q=...` or paginated/filterable `GET /api/tracks` | P2 |
| Comment liked-by-current-user state | Forced `false` in comment mapping | Auth-aware comments response with `likedByCurrentUser` | P2 |
| Track liked-by-current-user state | Empty state after page reload | Include `likedByCurrentUser` or provide liked-track IDs | P2 |
| Playlist like/pin state | Static playlist fields | Playlist like/unlike endpoints; define whether pinning is local or persisted | P2 |
| Waveform visualization | Generated waveform bars | Populate `Track.waveformJson` in processing or expose a waveform asset | P2 |
| Account activity feed | Static activity entries | `GET /api/me/activity` | P3 |
| Notifications | Static unread dot | `GET /api/me/notifications` plus read state mutation | P3 |
| Albums/EP grouping | Track grid labeled as releases | Album listing/detail contracts if album grouping is required | P3 |

## Supported real contracts used now

- Auth session: `GET /api/auth/me`
- Published tracks, details, cover, signed stream
- Artists and artist tracks
- Public playlists and playlist details
- Comments and replies
- Upload init, private PUT URLs, complete, and status polling
- Play events and Recently Played
- Calculated basic listening stats
- Track like/unlike
- Artist follow with persisted follower count

## Contract fixes made in this pass

- `/api/auth/me` now includes `artistProfileId`.
- Track unlike was added and like/unlike now maintain the persisted count.
- Artist responses include follower counts; follow returns the resulting count.
- Playlist details include artist-user metadata needed by the track mapper.
- Recently Played includes artist-user metadata.
- Listening stats no longer return fabricated streak, hour, weekly, or mood values.
