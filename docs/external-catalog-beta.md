# External music Beta

The private route is `/external-music`; details use `/external-music/<recording-id>`.
It uses NoirSound's existing global player, TrackLike and private PlaylistTrack
relations. A Track bridge with `catalogScope=EXTERNAL_BETA`, `isPublic=false`
and the importing administrator as curator preserves the legacy required artist
relation. `ExternalRecording.curatorId` records that administrative ownership.
The external performer remains independent metadata and its public view has no
local artist ID; no performer is matched to a local account by display name.

## Provider behavior

Audius uses the official REST API at `https://api.audius.co/v1`. Its published
OpenAPI permits anonymous search, resolve, track metadata and open streaming.
No API key is required for this public read-only subset. An optional
`AUDIUS_BEARER_TOKEN` stays on the backend. Private/unlisted/deleted/gated,
scheduled, stem and API-key-restricted tracks are not imported or played.
Each play checks current metadata and availability and resolves a fresh signed
stream route. The provider-signed audio CID is checked before using the fixed
Audius content gateway; the gateway is probed before the URL reaches the player.
The server never downloads/proxies audio or writes it to MinIO/transcoding.
The browser follows the gateway's GET redirect to Audius's verified R2 delivery
origin, explicitly allowed only in `media-src`. The gateway's HEAD response does
not expose that redirect. No wildcard Cloudflare storage origins are allowed;
a provider CDN origin change requires review and a CSP update.

Spotify, SoundCloud, Apple Music and YouTube support administrator-supplied
HTTPS recording links only. No API/catalog/streaming/embeds are connected.
LINK_OUT does not start playback, enter the audio queue or write a listening event.
Only exact platform hostnames and recording URL forms are accepted; album-only,
shortened unknown-host and arbitrary URLs are rejected. LINK_OUT does no fetch.

References reviewed 2026-10-01:
- https://docs.audius.co/sdk/
- https://api.audius.co/v1/swagger.yaml
- https://docs.audius.co/developers/guides/image-mirrors/
- https://developer.spotify.com/policy
- https://developers.soundcloud.com/docs/api/terms-of-use

## Enable and disable

Backend-only settings are in `backend/.env.example` and `.env.production.example`:

```dotenv
EXTERNAL_CATALOG_ENABLED=true
EXTERNAL_CATALOG_ADMIN_IDS=<existing-owner-admin-user-uuid>
AUDIUS_ENABLED=true
AUDIUS_BEARER_TOKEN=
```

The account must have the current server-verified ADMIN role; the optional UUID
allowlist further restricts it. These are not VITE variables. Initial deployment
requires the backend environment to contain these settings. By default beta is off.
After initial enablement, the beta page's Enable/Disable form writes a persisted
`ExternalCatalogSetting` and an audit entry. It takes effect for direct beta pages,
APIs, private playlists and saved beta tracks without restart or redeployment.
The server environment flag is a maximum gate; the database switch cannot
re-enable beta if that environment flag is false.

Status is LIVE only after an official API request succeeds. Link-only providers
are LINK_OUT_ONLY. API failures and disabled providers remain explicit. Normal
NoirSound endpoints continue working when Audius is disabled or unavailable.

## Test

Sign into the existing permitted account, open `/external-music`, search Audius
or paste an Audius track URL. Play a result, pause and seek using the global player,
add the result to the test catalog, then open its card. Like it or add it to a
private playlist. Switch to an existing native track and back to the chosen
external recording. External playback writes `ExternalPlaybackEvent` only;
these are local observations, not verified Audius listens or native play counts.
Previews have no persistent identity until imported and cannot be liked.

The detail page supports source editing, independent recording-match and official
publication verification, primary-source selection, version/parent editing,
manual merge and unmerge, and action history. Confirmation requires evidence;
merge also requires evidence. Title/duration similarity never auto-merges.
Known conflicting performer/version/explicitness/duration prevents a merge.
ISRC is used only when supplied by Audius or explicitly supplied with a reason.
Remix/live/nightcore and other marked versions retain their markers and cards.
Original is never inferred from popularity, upload age, profile name or “official”.

Merge changes recording group membership, retaining original Track IDs and all
likes, playlist rows, listening rows and source records. Unmerge restores the
source confirmation/primary state from the merge audit. Normal beta catalog and
known-source search return one card per group. Source verification is separate
from identifying a recording. No other platform is automatically searched.

Provider metadata is refreshed on demand with a 24-hour TTL. An hourly bounded
sweep purges expired title/artist/artwork/ISRC; deleted/denied source refreshes
mark the publication unavailable and clear provider metadata. Raw API payloads
and permanent stream URLs are not archived. Historical relation IDs remain.

## Release and rollback

Use `.github/workflows/deploy-hostinger.yml` and `scripts/deploy-hostinger.sh` for
the exact verified branch/commit. Preserve existing production source/UI state;
the release branch starts at deployed frontend commit `d3355ca3` because GitHub
main is behind the currently deployed source. Do not reset the dirty local checkout.

Migration `20261001120000_external_catalog_beta` only adds tables/columns/indexes; it does not
delete/update existing tracks or change their required artist relations.
The release contains its exact reviewed SHA-256 in
`backend/prisma/reviewed-additive-migrations.json`. The deployment read-only
verifier rejects edited/unreviewed SQL and failed/divergent migration history.
Migration failure prevents application container updates. Legacy native reads retain their required artist
relation during rollback; imported beta bridges stay private and unstreamable
through the old native resolver.

Deployment must pass the existing fresh DB/file backup, readable archives,
isolated restore drill and trusted private offsite verification gates. The
operator-owned `OFFSITE_BACKUP_VERIFY_SCRIPT` must already implement the six-field
receipt contract documented in `scripts/deploy-hostinger.sh`; a local receipt or
old backup does not replace fresh offsite evidence. Never disable this protection.

To contain a regression, disable beta using the persisted switch. For application
rollback, use the exact backend/worker/web image IDs in the deployment's private
`previous-images.txt`, in a private Compose override, and run Compose `up -d
--no-deps --no-build backend worker web` against the existing project and env.
Preserve postgres/redis/minio containers and volumes. Keep the additive schema
and new data. Never restore the whole DB over new user activity.

## Current deployment blocker (2026-10-01)

The existing production deploy script was executed against its current HEAD and
stopped before backup/build/migration/application updates:
`A configured trusted private offsite verifier is required`.
`OFFSITE_BACKUP_VERIFY_SCRIPT` is absent from the production environment and live
application containers; no existing verifier executable was found in the checked
NoirSound operations/release directories. A historical offsite receipt is not a
configured verifier for this release. The required remaining operator input is
the existing trusted verifier path. No production beta deployment is claimed.

A fresh existing-system backup completed on 2026-10-01 at 16:14 UTC, reference
`20261001T161440fb57a12bZ`, in `/opt/noirsound/NoirSound/backups` (outside the web
root, files mode 0600). PostgreSQL gzip and storage tar readability passed.
This fresh pair has not been independently restored/offsite-verified by this run.
Production source and all running image references remained unchanged.


## CI and existing user-device offsite transport

Integration MinIO alone is built from official signed `RELEASE.2025-09-07T16-13-09Z`,
commit `07c3a429bfed433e49018cb0f78a52145d4bedeb`, with source SHA256 and official
Go/Alpine base digests in `tests/integration/minio.Dockerfile`. Production MinIO
is untouched. The harness verifies readiness, a private bucket, PUT/DELETE and
an independent presigned GET through the storage proxy. FFmpeg uses the runner's
existing executable when available, otherwise Ubuntu official HTTPS archive with two bounded APT attempts and no
recommended GUI packages, connection timeouts and an eight-minute step limit.

The previously approved offsite destination is the user's Mac directory
`~/.codex/private-backups/noirsound` (0700; individual files 0600). The operator
installs `scripts/offsite-user-device.py` as root:root 0700 at
`/opt/noirsound/operations/offsite-user-device.py`, creates the private root-owned
0700 queue `/opt/noirsound/offsite-verification`, and the deploy workflow exports
`OFFSITE_BACKUP_VERIFY_SCRIPT` to that executable only for the release process. No new service, storage provider
or inbound port is needed. The Mac agent uses the existing pinned-host SSH key:

```sh
python3 scripts/offsite-user-device.py agent --host root@46.202.143.125 \
  --identity ~/.ssh/noirsound_hostinger \
  --destination ~/.codex/private-backups/noirsound --minutes 180
```

Keep this agent running while the existing deploy workflow performs its gates.
Each verifier call publishes a fresh random request valid for fifteen minutes.
The SSH-authenticated agent copies only the exact three checksum-listed files
and checksum manifest to a new private directory, flushes them to disk, then
independently reopens and hashes all copies and checks their ownership/modes.
The server accepts only a matching nonce, release, checksum and complete file
proof, rechecks the unchanged sources, and creates the exact six-field receipt
expected by both backup-all and deployment. Old receipts, stale jobs, public
files, symlinks, cross-run sets and absent/offline devices fail closed.

This is an attended user-device transport. It is not an unattended cloud backup
service: when the Mac agent is unavailable the offsite gate fails and local
archives remain. Existing daily local backup configuration is preserved; the
release hook is selected through the production deploy setting. Starting an
agent does not replace the separate isolated DB/storage restore drill.
