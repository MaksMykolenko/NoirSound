# NoirSound Mock Data Audit

Date: 2026-06-28  
Mode audited: `VITE_USE_MOCK_API=false`

## Final classification

| Location / behavior | Classification | Resolution |
|---|---|---|
| `src/data/mockData.js` | Runtime real-mode blocker; safe to delete after migration | Moved to `src/api/mock/data.js`. No component or real API module imports it. |
| `src/api/mock/data.js` | Demo/mock-mode only; safe to keep | Selected only through the Vite `#api-mode` alias when `VITE_USE_MOCK_API=true`. |
| `src/api/mock/{tracks,artists,playlists,comments,user,uploads,stats}.js` | Demo/mock-mode only; safe to keep | Isolated explicit demo implementations. |
| `src/api/real/*` | Safe to keep | Contains backend calls only. No mock imports or fallback responses. |
| `src/api/{tracks,artists,playlists,comments,user,uploads,stats}.js` | Safe to keep | Thin build-time selectors. A real build aliases directly to `src/api/real`; mock data is absent from the emitted real bundle. |
| `src/api/mode.js` and the demo badge in `src/App.jsx` | Static mode control; safe to keep | Makes demo mode explicit to users. |
| `src/store/userStore.js` hardcoded `you_after_dark` user, stats, and activity | Runtime real-mode blocker | Removed. Real mode starts with `user: null`; only the selected demo user can initialize demo mode. |
| `src/store/playlistStore.js` static playlists and local-only success actions | Runtime real-mode blocker; needs backend API connection | Deleted. Public playlist reads/creates use the API; unsupported personal collection actions show unavailable states. |
| `src/store/commentStore.js` unconditional `mockComments` state | Runtime real-mode blocker | Deleted. Comment reads and mutations now use API/query state. |
| `src/store/playerStore.js` synthetic Web Audio playback | Runtime real-mode blocker | Removed entirely. Audio failure leaves `isPlaying=false`, records no Recently Played entry, and displays an error. |
| `src/store/playerStore.js` demo liked-track IDs and demo audio URLs | Demo/mock-mode only; safe to keep | Gated by the explicit build mode. The real bundle receives real stream URLs and an empty liked state. |
| `src/components/player/WaveformMock.jsx` generated waveform | Runtime real-mode blocker | Replaced with `Waveform.jsx`, which renders backend samples or an honest unavailable state. |
| `src/components/dashboard/DashboardChart.jsx` sample chart | Runtime real-mode blocker; safe to delete | Deleted. Dashboard shows persisted catalogue totals and a creator-analytics availability message. |
| `src/pages/Dashboard.jsx` hardcoded artist ID and metrics | Runtime real-mode blocker | Removed. Access is role-gated and releases use the authenticated `artistProfileId`. |
| `src/pages/Profile.jsx` sample genres, streak, hours, follows, and playlists | Runtime real-mode blocker | Removed. Persisted listening stats/history are shown; unsupported collections are labeled unavailable. |
| `src/pages/Library.jsx` mock followed artists and local collections | Runtime real-mode blocker | Removed from real mode. Recently Played uses the backend; missing account collections have explicit states. |
| `src/pages/PlaylistPage.jsx` local static playlist resolution and recommended rows | Runtime real-mode blocker | Replaced with `GET /playlists/:id` data only. Unsupported editing controls were removed. |
| `PlaylistCard.jsx`, `SidebarPlaylistItem.jsx`, `LibrarySidebarSection.jsx` direct mock imports | Runtime real-mode blocker | Removed. Components consume normalized playlist objects only. |
| Artist follow buttons that toggled local state without a request | Runtime real-mode blocker | Follow state changes only after the backend succeeds. |
| Track like buttons that changed local state without a request | Runtime real-mode blocker | Like state changes only after the backend succeeds; backend like counts are persisted. |
| Upload mock delay, mock upload ID, and unconditional READY polling | Runtime real-mode blocker | Moved to `src/api/mock/uploads.js`; real upload/status modules contain only the proven init → PUT → complete → poll flow. |
| Backend listening-stats streak, hour, weekly chart, and mood constants | Runtime real-mode blocker | Removed. The endpoint returns calculated values only. |
| `backend/prisma/seed.js` | Seed/local development data; safe to keep | Preserved unchanged as required. |
| `backend/tests/**`, `src/**/__tests__/**`, `tests/components/**` mocks | Test fixture; safe to keep | Tests now mock API responses explicitly. |
| “Recently Played”, “Demo mode”, loading `fallback`, and other presentation text | Static UI label only; safe to keep | These labels do not provide runtime records or success state. |
| `public/images/*` cover/avatar/hero assets | Static visual assets; safe to keep | Used as artwork/placeholders, not as authenticated session or catalogue records. |

## Current search result

- `mockData`: no matches in `src` or `tests`.
- Known demo identities (`Nightcrawler`, `HyperDrive`, `you_after_dark`): only `src/api/mock/data.js`.
- `fallback` in `src/api`, `src/store`, and `src/pages`: no runtime data/playback fallback matches.
- No component imports `src/api/mock/*` or demo data directly.
- A real production build contains none of the known demo identities.

## Deleted runtime illusion files

- `src/store/commentStore.js`
- `src/store/playlistStore.js`
- `src/components/player/WaveformMock.jsx`
- `src/components/dashboard/DashboardChart.jsx`
- `src/hooks/mutations/useLikeTrack.js`
- `src/hooks/mutations/useFollowArtist.js`
- `src/components/profile/UserStatsCard.jsx`

## Data intentionally retained

- Explicit demo-mode API and dataset under `src/api/mock/`
- Backend development seed
- Automated-test fixtures and API mocks
- Static visual assets and UI copy
