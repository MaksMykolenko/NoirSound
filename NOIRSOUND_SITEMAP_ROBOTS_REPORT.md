# NoirSound — robots.txt & sitemap.xml Report

**Date:** 2026-06-30

## robots.txt

Static file `public/robots.txt` → served by Caddy at `https://noirsound.co/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin

Sitemap: https://noirsound.co/sitemap.xml
```

- Public pages (`/`, `/track/`, `/artist/`, legal) and preview assets (`/og/`, `/api/public/covers/`) stay crawlable so social/OG fetches and indexing work.
- Only the admin UI and admin API are disallowed. The cover route is deliberately **not** blocked (social scrapers must reach OG images).

## sitemap.xml

Primary: **dynamic** `GET /sitemap.xml` (backend `routes/pages.js`), proxied by Caddy's `@ssr` matcher. Content type `application/xml; charset=utf-8`, cached 1h.

Includes:

- Static pages: `/`, `/discover`, and the six legal routes.
- **Published** tracks owned by **active** artists → `/track/:id` (with `lastmod`).
- **Active** artists that have at least one published track → `/artist/:id` (with `lastmod`).

Excludes (never listed): draft/processing/pending/failed/rejected/**hidden** tracks, and suspended/banned/deleted artists. URLs are escaped and built from the canonical domain (`PUBLIC_APP_URL`). Capped at 5000 entries per collection (split into a sitemap index if the catalog grows beyond that).

Fallback: static `public/sitemap.xml` (core pages) ships in the build and is used only if the dynamic route is unavailable.

## Why a caching layer matters here

A CDN/cache sits in front of the site (observed during the audit: `web_fetch` returned stale HTML vs. the live browser). After deploy, purge/age out the cache for `/`, `/robots.txt`, `/sitemap.xml`, and refresh Telegram via **@WebpageBot** so previews reflect the new metadata.

## Verification (after deploy)

```bash
curl -fsS https://noirsound.co/robots.txt
curl -fsS https://noirsound.co/sitemap.xml | head
# valid XML, lists only published tracks / active artists, robots references the sitemap
```

## Status

Implemented and unit-covered for visibility rules; **pending production deploy + curl verification** (cannot be run against the VPS from the build environment).
