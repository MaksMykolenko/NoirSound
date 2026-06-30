# NoirSound — Streaming Endpoint Hardening Report (Phase 6)

Date: 2026-06-28

## Endpoint: `GET /api/tracks/:id/stream` (`routes/tracks.js`)
- Streams only `status === 'PUBLISHED'` tracks with a `processedAudioKey` → unprocessed/draft/processing/failed/rejected/**hidden** tracks return 404.
- **NEW:** joins the artist's user and returns 404 if `artist.user.status !== 'ACTIVE'` → **suspended/banned/deleted artists cannot stream**.
- Redirects (302) to a short-lived signed URL; Range requests are served by the storage backend (verified via E2E `Range: bytes=0-1024` → 200/206 + `content-type: audio/*`).
- No private storage key is exposed — only a time-limited signed URL.
- Public catalog (`GET /api/tracks`) now also filters `artist.user.status === 'ACTIVE'` so suspended artists' tracks drop out of discover.
- Cover endpoint mirrors the published-only rule.

| Requirement | Status |
|---|---|
| stream only PUBLISHED/available | PASS |
| unprocessed tracks can't stream | PASS (`processedAudioKey` required) |
| hidden/suspended/rejected can't stream | PASS (status + HIDDEN excluded) |
| deleted/banned/suspended artists can't stream | PASS (new artist-status check) |
| Range requests work | PASS (storage-served; E2E asserts 200/206) |
| correct audio content-type to browser | PASS (object stored `audio/mpeg`) |
| signed redirect order works in Fastify | PASS (`reply.redirect(url,302)`) |
| no path disclosure / private key leak | PASS (signed URL only) |
| frontend error states | PASS (player surfaces stream errors; covered by `playerStore` unit test) |

## Tests
- Existing `endpoints.test.js` asserts: unprocessed published → 404; processed published → 302 to signed URL (run with Postgres).
- `public-beta-upload-pipeline.spec.js` (E2E) asserts a freshly published track streams with a Range response and is in the catalog; `public-beta-moderation.spec.js` asserts a hidden track returns 404 and leaves the catalog.

## Final verification record

- **What was inspected:** catalog/detail/artist/playlist/library payloads, stream/cover routes, inactive artists, hidden states, signed redirects, Range behavior, and object-key leakage.
- **What was implemented:** a shared public-track serializer removes original/processed/cover keys and upload metadata; public detail/catalog/artist/playlists/library reject hidden/inactive content; `S3_PUBLIC_ENDPOINT` keeps signed URLs browser-reachable without making MinIO public.
- **What was tested:** upload E2E streamed real audio with Range; moderation E2E made hidden detail/stream/catalog unavailable; production anonymous bucket request returned 403.
- **What could not be tested:** CDN behavior was not configured.
- **Exact commands:** `npm run test:e2e`; `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/noirsound-audio/`.
- **Exact blockers:** none.
- **Remaining risks:** already-issued signed URLs remain valid until their short expiry.
- **Files changed:** `backend/src/lib/publicTrack.js`; track/artist/playlist/stats routes; storage service; `Caddyfile`; compose/env config; frontend track mapper.

## Status: PASS
