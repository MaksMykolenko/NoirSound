# External music Beta

Imported tracks use the normal `/track/<track-id>` page, Home/Discover catalogue,
likes and private playlist rows, with a compact platform icon. Source administration
remains at `/external-music/<recording-id>` and imports at `/external-music`.
The unified catalogue extension is private: the server derives the curator scope
from the current owner session, allowlist, environment and persisted beta gate.
Guests and listeners still see only the ordinary public native catalogue.
Catalogue counts/facets/cursors use that same scope; cursors cannot cross owners
or survive a change to public scope. Merge members do not become duplicate cards.
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

SoundCloud, Apple Music and YouTube support official visible players through
`GET /api/external-catalog/embed?provider=...&url=...`. The same administrator
allowlist, environment gate and persisted beta switch protect this endpoint.
Select a platform in “Add a track by link” and provide the public recording URL,
permitted title/artist metadata, provenance and audit reason. The existing
`POST /recordings` endpoint validates the URL and atomically saves a private Track
bridge and its origin; repeated canonical URLs return the existing recording.
No provider metadata is guessed or scraped. Audius alone provides automatic
search/metadata import; no new provider credentials are invented.
Saved confirmed SoundCloud/Apple Music/YouTube sources resolve official embeds
through the same recording/source playback endpoint used by ordinary cards.
Manual links attached to an existing recording remain unplayable as matched
recordings until confirmation with evidence. Spotify remains a source link.
The standalone embed resolver performs no third-party fetch and writes no rows.

The existing global player owns one active platform frame. Opening one pauses
and clears the native/Audius audio source; switching back synchronously blanks
and removes the frame. Closing/collapsing, entering admin, logging out or loss
of beta access stops the frame. The persisted gate is checked every 15 seconds
and on window focus. YouTube remains visible with controls and a viewport of
at least 200 by 200 pixels. Controls live in the official player; no fictional
NoirSound progress, playback state, queue entries or listen statistics are emitted.

Apple Music supports a preview without sign-in; full listening depends
on the platform account/subscription. SoundCloud and YouTube honor publisher,
region and embed restrictions; the original-platform link stays available.
Opening a widget explicitly connects to that platform, which may use cookies.
No API keys, audio extraction, proxying, transcoding or hidden video are used.
HTML `frame-src` allows only the three official embed origins; JSON API CSP
remains `default-src 'none'; frame-ancestors 'none'`.

Spotify stays LINK_OUT_ONLY: its widget terms Section IV.2.f prohibit integrating
Spotify with streams from another service. No Spotify widget/SDK/catalog content
is incorporated into this multi-platform player. Existing source links, matching
verification and private catalog relations are preserved. Stored source modes remain intact; the normal track view advertises
OFFICIAL_EMBED only for supported, confirmed, non-rejected available/unknown
sources. Embeds remain outside audio queues/native play statistics. Source
icons describe provenance, never a claim of official artist verification.

References reviewed 2026-10-01:
- https://docs.audius.co/sdk/
- https://api.audius.co/v1/swagger.yaml
- https://docs.audius.co/developers/guides/image-mirrors/
- https://developer.spotify.com/documentation/embeds/terms
- https://developers.soundcloud.com/docs/api/html5-widget
- https://developers.google.com/youtube/iframe_api_reference
- https://artists.apple.com/support/1117-apple-music-marketing-tools
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
are LINK_OUT_ONLY; widget providers are OFFICIAL_EMBED, which indicates a
configured URL adapter rather than guaranteed availability. API failures and disabled providers remain explicit. Normal
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

## Prior release

The Audius beta was deployed at `769b034d9e105541790a50e6f8f5b48e99326ff0`
through the production CI workflow, with fresh backup, isolated restore and
attended user-device offsite verification. The original missing offsite hook was
resolved through the transport below. This provider expansion requires the same
fresh gates and introduces no database migration.

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


## Automatic platform catalog (October 2026)

The private owner sees live platform cards in Discover without entering URLs. Opening, playing, liking or saving a result automatically creates/reuses its private Track identity. The existing player, private playlists and likes are retained. Browsing/search is read-only: it does not mirror entire third-party catalogs or download audio. Cards and details link to each confirmed platform publication. Different recordings/versions are not automatically merged; the existing evidence-backed merge/unmerge flow is retained.

`GET /api/external-catalog/browse?q=&cursor=&limit=20` returns a bounded live page (up to 20 items per configured provider), interleaved in each provider's ranking order, with independent provider status/errors and an opaque query-bound next cursor. Empty query uses Audius weekly trending (top 100), Apple current songs chart, and YouTube most-popular music videos. A query uses official catalog search. No false global totals or exhaustive-catalog claims are made. Failures in one provider do not hide successful results from another.

`POST /api/external-catalog/import` accepts `provider` (AUDIUS default, APPLE_MUSIC or YOUTUBE) and `externalId`. Metadata is fetched again from the official API; clients cannot supply guessed matches, titles or artwork in this flow. Publication identity imports are idempotent. Metadata expires after 24 hours, is refreshed on catalog/detail use and stale playback, and is purged by the bounded sweep. No payload/stream/preview URLs are archived. External plays remain separate from native metrics.

Credentials must be supplied privately in the existing server `.env.production`, followed by the normal attended deploy workflow. Never paste secrets into chat, return them through the status endpoint, commit them, or put them in frontend VITE variables. The existing compose `env_file` already passes server variables:

- `YOUTUBE_API_KEY`: an application key for an enabled YouTube Data API v3 project. Requests use `X-Goog-Api-Key`; no key is sent to the browser. Quota exhaustion is reported as a provider error with no infinite retries. Music videos must be public and embeddable; uploader labels are not guessed recording artists. Playback uses visible official video controls, never extracted audio.
- `APPLE_MUSIC_DEVELOPER_TOKEN`: a valid application developer JWT. `APPLE_MUSIC_STOREFRONT` defaults to `us`; catalog availability is regional. Playback remains the official Apple embed with account/preview limitations; this does not implement full MusicKit playback.
- Spotify: **PERMISSION_REQUIRED**, search disabled. [Developer Policy III.5](https://developer.spotify.com/policy) prohibits products integrated with streams or content from another service. A key alone does not authorize this use case.
- SoundCloud: **PERMISSION_REQUIRED**, search disabled. [API terms, Content and Privacy](https://developers.soundcloud.com/docs/api/terms-of-use) restrict alternative aggregate listening services unless explicitly licensed. No API catalog or API streaming is enabled by merely having a key. Existing administrator-supplied links remain independently reviewable.

Apple/YouTube adapters without credentials are **NOT_CONFIGURED**, never called and never presented as live-tested. Audius public browsing/search does not require invented credentials. Disable the existing beta switch to hide the platform feed and deny import/playback routes. Release rollback uses the previous image revision; no database restore or destructive migration is required by this change.
