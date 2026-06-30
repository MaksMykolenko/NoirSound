# NoirSound — Metadata & Social Preview Report

**Date:** 2026-06-30
**Scope:** Full metadata / SEO / social-preview pass — server-side metadata injection, OG images, robots, sitemap, JSON-LD, client metadata, tests.
**Constraints honored:** CSRF/security untouched · no private storage keys or raw MinIO URLs exposed · OG images need no auth · no fake metadata · crawlers not blocked from public pages · React routes preserved.

---

## Root cause

NoirSound is a static-HTML SPA. Social crawlers (Telegram, WhatsApp, Discord, X, Facebook) read the **initial HTML response** and do not execute React, so client-side metadata alone cannot produce share previews. The deployed shell contained **no metadata** (only `charset` + `viewport`), the referenced OG image **was not served** (returned the SPA HTML fallback), and there was **no per-route server metadata, robots.txt, or sitemap**. Hence Telegram showed only the raw URL.

## Approach

Backend (Fastify) now **injects per-route `<head>` metadata into the built SPA shell** for crawler-visible routes; Caddy proxies only those document paths to the backend. Everything else (assets, OG images, client-only routes) is still served statically, and the SPA boots normally for real users.

- `backend/src/lib/metaRenderer.js` — pure, dependency-free renderer: builds `<title>`, description, canonical, Open Graph, Twitter Card and JSON-LD tags, **HTML-escapes every value**, and idempotently strips + replaces the shell's default tags before `</head>`.
- `backend/src/lib/pageMeta.js` — pure builders for home / legal / track / artist (+ "unavailable" variants), duration/genre helpers.
- `backend/src/routes/pages.js` — serves injected HTML for `/`, `/track/:id`, `/artist/:id`, the six legal routes, and the dynamic `/sitemap.xml`. Fetches the shell from the `web` container once and caches it (`APP_SHELL_ORIGIN`, default `http://web`).
- `backend/src/routes/public.js` — `GET /api/public/covers/:trackId` controlled cover route (below).
- Caddy `@ssr` matcher routes those document paths to the backend; `/index.html` stays static so the shell fetch never loops.

## Homepage metadata

`og:title` **NoirSound — Creator-first music platform**, full OG + Twitter tags, `og:image` `https://noirsound.co/og/noirsound-cover.png` (1200×630 PNG), canonical `https://noirsound.co/`, and `WebSite` JSON-LD with a `SearchAction`. Baked into `index.html` (static default) and re-affirmed server-side for `/`.

## Track preview (`/track/:id`)

Raw HTML uses **real data** for published tracks owned by active artists:

- `og:type music.song`, `og:title` = `Track Title — Artist Name`, description = `Genre · m:ss · …`, `og:url`/canonical = the track URL.
- `og:image` = `https://noirsound.co/api/public/covers/<id>` (controlled route).
- `MusicRecording` JSON-LD (name, `byArtist`, ISO-8601 `duration`, genre).
- Hidden / rejected / unpublished / deleted, or tracks of suspended/banned/deleted artists → generic **"Track unavailable — NoirSound"** + `robots: noindex`; no details leak.

## Artist preview (`/artist/:id`)

- `og:type profile`, `og:title` = `Artist Name — NoirSound`, description = bio excerpt or a safe default, canonical = artist URL, `MusicGroup` JSON-LD.
- `og:image` = the artist's avatar when it's an absolute/public URL, else `/og/default-artist.png`.
- **Role is never exposed** (e.g. ADMIN). Suspended/banned/deleted → generic **"Artist unavailable — NoirSound"** + `noindex`.

## OG images (public, no auth)

Generated dark, branded 1200×630 assets in `public/og/` → served at `/og/*`:

| File | Use |
|---|---|
| `noirsound-cover.png` / `.jpg` | homepage + legal default |
| `default-track.png` | track fallback (no cover) |
| `default-artist.png` | artist fallback (no avatar) |

Track covers stream through **`GET /api/public/covers/:trackId`**, which serves the cover only for published/active tracks by streaming bytes through the backend (never exposing the private storage key or a presigned MinIO URL), and 302-redirects to `/og/default-track.png` otherwise. No authentication, cache `public, max-age=86400`.

## robots / sitemap

`public/robots.txt` allows all public pages, disallows `/admin` + `/api/admin`, and points to the sitemap. `GET /sitemap.xml` (backend, dynamic) lists static pages + **published** tracks + **active** artists only (escaped, canonical domain), with a static `public/sitemap.xml` core-page fallback. See `NOIRSOUND_SITEMAP_ROBOTS_REPORT.md`.

## Client-side metadata

`src/components/meta/PageMeta.jsx` keeps the document title / description / canonical correct during SPA navigation (Home, Track, Artist, Legal). It is explicitly **not** the source of truth for crawlers.

## Files changed

**Backend:** `src/lib/metaRenderer.js` (new), `src/lib/pageMeta.js` (new), `src/routes/pages.js` (new), `src/routes/public.js` (new), `src/index.js` (register routes; HTML-aware CSP), `tests/metaRenderer.unit.test.js` (new).
**Frontend:** `index.html` (defaults + JSON-LD + `/og/` image), `src/components/meta/PageMeta.jsx` (new) + tests, used in `src/pages/{Home,TrackPage,ArtistPage,LegalPage}.jsx`, `tests/components/metadata.test.js` (updated).
**Assets/config:** `public/og/*` (4 images), `public/robots.txt`, `public/sitemap.xml`, `Caddyfile` (`@ssr` routing), `docker-compose.production.yml` (`APP_SHELL_ORIGIN`).

## Tests (local)

| Suite | Result |
|---|---|
| `backend` metaRenderer + builders (`metaRenderer.unit.test.js`) | ✅ 14/14 |
| Frontend `PageMeta` | ✅ 2/2 |
| Frontend `tests/components/metadata.test.js` | ✅ 3/3 |
| Lint (`oxlint`, 201 files) | ✅ 0/0 |
| Production build (`vite build`) | ✅ ships `/og/*`, `robots.txt`, `sitemap.xml`, updated `index.html` |

XSS coverage: a malicious track title/artist (`</title><script>…`, `A" onerror="x`) is HTML-escaped — verified it cannot break out of the title or an attribute.

Could **not** run here: full backend route tests (need Postgres), and an SSR e2e (the injection only runs in the full Docker stack behind Caddy, not the Vite dev server). The production catalog is currently empty, so track/artist previews have no live content to validate yet.

## Production verification (run after deploy)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
curl -fsS https://noirsound.co/api/ready
curl -L https://noirsound.co/            | grep -Ei "og:|twitter:|description|canonical|ld\+json"
curl -I https://noirsound.co/og/noirsound-cover.png      # expect 200, content-type image/png
curl -fsS https://noirsound.co/robots.txt
curl -fsS https://noirsound.co/sitemap.xml | head
# with a published track / active artist:
curl -L https://noirsound.co/track/<id>  | grep -Ei "og:|music|canonical|title"
curl -I https://noirsound.co/api/public/covers/<id>      # expect 200 image/* (or 302 to default)
```

## Telegram cache

After deploy, refresh Telegram's cache via **@WebpageBot** (send `https://noirsound.co/`). Telegram caches previews aggressively, so a stale "no preview" can persist until refreshed.

---

## Verdict

```
Verdict: METADATA MVP READY  (becomes SOCIAL PREVIEWS FIXED once deployed + curl/Telegram verified)
Root cause: Static-HTML SPA served crawlers an empty <head>; OG image not served; no robots/sitemap; no per-route server metadata.
Homepage preview: Implemented (static default + SSR for /); pending deploy.
Track preview: Implemented — real title/artist/genre/duration + MusicRecording JSON-LD; hidden/suspended → generic noindex.
Artist preview: Implemented — display name + bio excerpt + MusicGroup JSON-LD; role never exposed; suspended → generic noindex.
OG images: Generated 1200x630 /og/ assets + controlled /api/public/covers/:id (no private keys); pending deploy to return 200.
Robots/sitemap: robots.txt + dynamic /sitemap.xml (published/active only) implemented.
Tests: backend 14/14, PageMeta 2/2, metadata 3/3, lint clean, build clean.
Production verification: PENDING your deploy (I cannot curl/deploy your VPS from here).
Telegram cache: Refresh via @WebpageBot after deploy.
Files changed: see list above.
Remaining issues: deploy + run the curl/Telegram checks; catalog currently empty so dynamic previews need real content; optional designed OG art can replace the generated placeholders.
```
