# NoirSound Storage Privacy Fix Report

**Date:** 2026-06-27  
**Result:** **PASS**

## Previous defect

The MinIO initializer set anonymous access on the entire `noirsound-audio`
bucket. That exposed original uploads and conflicted with the signed URL design.

## Fix

- Bucket initialization now runs `mc anonymous set none`.
- Presigned PUT URLs no longer request a public ACL.
- Original audio, cover art, and processed audio remain private objects.
- The backend issues time-limited signed URLs.
- `/api/tracks/:id/stream` signs only `Track.processedAudioKey`.
- Original object keys are never returned by the public stream route.
- Added a storage-edge Nginx service on local port 9000:
  - preserves the signed `Host` header;
  - forwards to private MinIO on the Compose network;
  - supports 60 MB direct PUT requests;
  - does not buffer uploads;
  - preserves range responses;
  - provides CORS headers for signed capability URLs;
  - handles PUT/GET/HEAD/OPTIONS only at the browser-CORS layer.

MinIO Community does not support per-bucket CORS in the tested release; its
maintainers direct community users to cluster-wide CORS. The local edge makes
the required behavior explicit and avoids making the bucket anonymous:
[MinIO discussion #20841](https://github.com/minio/minio/discussions/20841).

## Privacy proof

For the browser-uploaded Track
`cc727800-2da7-43ad-a2fd-ff5e43d42dd7`:

```text
anonymous GET original  → 403
anonymous GET cover     → 403
anonymous GET processed → 403
```

Authorized capability behavior:

```text
presigned PUT original  → 200
presigned PUT cover     → 200
signed processed GET    → 206 Partial Content in Chromium
```

MinIO initializer output:

```text
Access permission for `myminio/noirsound-audio` is set to `private`
```

## CORS incident found during proof

The first browser playback attempt reached `/stream` but failed after the 302
because the final storage response lacked a usable CORS header for the
cross-origin redirect/range request. Curl still succeeded, which showed why an
HTTP-only proof was insufficient.

The storage edge fixed both cases required by the product:

- direct browser presigned PUT;
- redirected HTML5 audio range GET.

After the fix, Chromium observed the private processed object as HTTP 206 and
the player advanced to 0:01.

## Files changed

- `backend/docker-compose.yml`
- `backend/docker/nginx/storage.conf`
- `backend/src/services/storage.js`
- `backend/src/routes/tracks.js`
- `backend/src/routes/uploads.js`
- `backend/.env.example`

## Remaining storage work

- Pin and periodically update MinIO and Nginx image versions.
- Add TLS and non-development credentials outside local use.
- Add signed URL TTL policy tests and key rotation.
- Add storage lifecycle/retention, backup, restore, and capacity monitoring.
- Add checksum/file-signature validation beyond S3 metadata and FFprobe.

These are P1/production-readiness items; no storage privacy P0 remains for the
local MVP loop.

