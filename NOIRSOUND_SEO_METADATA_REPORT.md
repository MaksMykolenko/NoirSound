# NoirSound — SEO & Metadata Report

**Date:** 2026-06-30

## Objective

Give every public NoirSound page correct, unique, crawler-visible metadata (titles, descriptions, canonical URLs, structured data) without breaking the SPA or exposing private data.

## Per-route metadata

| Route | `<title>` | Description | `og:type` | Canonical | JSON-LD |
|---|---|---|---|---|---|
| `/` | NoirSound — Creator-first music platform | Discover independent music, upload your own tracks, and build your audience on NoirSound. | website | `/` | `WebSite` (+`SearchAction`) |
| `/track/:id` | `Title — Artist \| NoirSound` | `Genre · m:ss · …` | music.song | `/track/:id` | `MusicRecording` |
| `/artist/:id` | `Name — NoirSound` | Bio excerpt or safe default | profile | `/artist/:id` | `MusicGroup` |
| `/terms` … `/creator-rules` | `<Policy> — NoirSound` | Per-policy summary | website | `/<slug>` | — |
| Unavailable track/artist | `… unavailable — NoirSound` | Generic | website | — | — (+`robots: noindex`) |

All values are HTML-escaped at render time (`metaRenderer.escapeHtml` / `escapeJsonLd`). User-generated fields (track title, artist name, bio) cannot inject markup — covered by unit tests including hostile inputs.

## How crawler-visible metadata is produced

Because crawlers don't run React, the **backend injects route metadata into the built SPA shell** (`backend/src/routes/pages.js` + `lib/metaRenderer.js` + `lib/pageMeta.js`). Caddy's `@ssr` matcher proxies `/`, `/track/*`, `/artist/*`, the legal routes and `/sitemap.xml` to the backend; all other paths stay static. The shell is fetched from the `web` service and cached, so the real hashed asset bundle is preserved and the SPA still boots for users.

## Canonical URLs

Every page emits a single `<link rel="canonical">`. Server-side, the canonical/`og:url` host comes from `PUBLIC_APP_URL` (falling back to the request host), so apex/www variants collapse to one canonical origin — complementing the CSRF same-origin fix and avoiding duplicate-content dilution.

## Structured data (JSON-LD)

- Home: `WebSite` + `SearchAction` (`/discover?q={search_term_string}`).
- Track: `MusicRecording` — `name`, `byArtist` (`MusicGroup`), ISO-8601 `duration`, `genre`, `url`.
- Artist: `MusicGroup` — `name`, `url`.

## Client-side metadata

`src/components/meta/PageMeta.jsx` updates title/description/canonical during in-app navigation (Home, Track, Artist, Legal) for browser-tab correctness — secondary to the server-rendered tags.

## Visibility & privacy rules

Only `PUBLISHED` tracks by `ACTIVE` artists, and `ACTIVE` artist profiles, expose detailed metadata. Everything else returns a generic, `noindex` page. Artist role (ADMIN/etc.) is never emitted. Cover art is served through a controlled route that never reveals storage keys.

## Tests

`backend/tests/metaRenderer.unit.test.js` (14) — escaping, tag building, idempotent injection, XSS safety, all builders, duration/genre helpers. `tests/components/metadata.test.js` (3) — `index.html` OG/Twitter/JSON-LD + `/og/` assets. `PageMeta` (2). Lint + build clean.

## Remaining / optional

Submit the sitemap in Google Search Console after deploy; optionally add `music:duration`/`music:musician` OG-music namespace tags and per-track `BreadcrumbList`. Replace generated OG art with designed artwork when available.
