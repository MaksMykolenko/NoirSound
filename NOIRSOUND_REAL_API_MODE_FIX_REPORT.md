# NoirSound Real API Mode Fix Report

**Date:** 2026-06-27  
**Result:** **PASS for the core MVP loop**

## Configuration

Real mode uses:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:3000/api
```

`VITE_API_BASE_URL` is now the one API base variable used by the client,
mappers, upload flow, and player.

## Defects fixed

- API modules caught real failures and silently substituted mock records.
- Mutations could report mock success after backend failure.
- The real app booted with a hard-coded logged-in mock user.
- Startup did not hydrate `/api/auth/me`.
- Track/artist/playlist mappers did not match actual includes or field names.
- Player constructed a separate hard-coded API base URL.
- Real playback failures activated a synthetic Web Audio drone and reported
  playback as successful.
- Play telemetry was created before playback succeeded and claimed a fabricated
  45 seconds/completion.
- Empty completion POSTs inherited `Content-Type: application/json`; Fastify 5
  rejected the empty JSON body.

## Behavior now

- Mock data is used only when `VITE_USE_MOCK_API=true`.
- Real API failures throw `ApiError`, update page state where applicable, and
  dispatch a global toast event.
- Initial `/auth/me` 401 is intentionally quiet; other real failures are visible.
- Login/register update the store from backend users.
- Real mode starts with `user: null` until hydration or login.
- Home, Discover, Track, Artist, and upload data use backend response mappers.
- Upload page performs real init, audio PUT, cover PUT, complete, and status
  polling.
- Player uses `/api/tracks/:id/stream`.
- Real playback has no fake audio fallback.
- A playback-start event is sent only after `audio.play()` resolves.
- Recently Played is updated in the player store and was verified in the Library.
- JSON content type is applied only when a request has a body.

## Browser proof

The real React UI completed:

```text
login as artist
→ open /upload
→ select WAV and PNG
→ enter metadata and confirm rights
→ submit
→ Ready to Publish
→ open generated track
→ Play Track
→ player shows Pause
→ progress reaches 0:01
→ Recently Played shows the generated track
```

Network evidence:

```text
upload init        200
audio PUT          200
cover PUT          200
upload complete    200
upload status      200
stream redirect    302
signed range GET   206
play event         200
```

## Files changed

- `.env.example`
- `src/App.jsx`
- `src/api/client.js`
- `src/api/artists.js`
- `src/api/comments.js`
- `src/api/playlists.js`
- `src/api/tracks.js`
- `src/api/user.js`
- `src/api/mappers/artistMapper.js`
- `src/api/mappers/playlistMapper.js`
- `src/api/mappers/trackMapper.js`
- `src/components/upload/UploadForm.jsx`
- `src/store/playerStore.js`
- `src/store/userStore.js`
- `src/store/__tests__/userStore.test.js`

## Test results

- Frontend unit/component/store tests: **12/12 PASS**
- Vite build: PASS
- Playwright smoke tests: **2/2 PASS**
- Real upload browser proof: PASS
- Real signed-stream playback browser proof: PASS
- Real Recently Played proof: PASS

## Remaining P1 real-mode gaps

- Parts of profile, dashboard, playlists, likes/follows, and the desktop library
  sidebar remain store-only or static demo UI.
- Seeded catalog tracks intentionally have no processed object and are not
  streamable; the uploaded proof tracks are streamable.
- Profile update calls an API mutation not yet implemented by the backend.
- Play events need measured duration/completion and session deduplication.
- Add route guards and more mobile/accessibility browser coverage.
- Resolve 61 existing lint warnings and split the large main bundle.

