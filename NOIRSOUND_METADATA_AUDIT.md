# NoirSound — Metadata / SEO / Social Preview Audit (Phase 1)

**Date:** 2026-06-30
**Method:** live checks via real browser (authoritative, cache-bypassing) + `web_fetch` + source/code review. Note: a caching layer sits in front of the site — `web_fetch` returned stale/variable HTML, so the **browser** results below are authoritative.

## Live production state (authoritative — real browser)

| Item | Finding |
|---|---|
| Homepage `<title>` | `NoirSound — Discover music after dark.` (old shell) |
| Homepage `<meta>` count | **2 only**: `charset`, `viewport` |
| Meta description | ❌ absent |
| Open Graph tags | ❌ none (`og:title/description/image/url/type/site_name` all missing) |
| Twitter Card tags | ❌ none |
| Canonical | ❌ absent |
| OG image | ❌ referenced image not served — `/images/noirsound-social-preview.jpg` returns the SPA HTML fallback (`text/html`), i.e. the file is not deployed. No `/og/*` assets exist. |
| `robots.txt` | ❌ absent (returns SPA fallback HTML) |
| `sitemap.xml` | ❌ absent (returns SPA fallback HTML) |
| `/track/:id` raw HTML | Serves the same static shell — **no per-track metadata** |
| `/artist/:id` raw HTML | Serves the same static shell — **no per-artist metadata** |
| Caddy serving | Single static `index.html` for all non-`/api`, non-asset paths (`try_files {path} /index.html`); **no SSR / meta injection** |
| Front cache/CDN | A caching layer is present (stale `web_fetch` responses) — Telegram's own cache will also need a refresh after fixes |
| Public catalog | `/api/tracks` and `/api/artists` currently return `{"data":[]}` — catalog appears empty right now |

## Repo state (not yet deployed)

- `index.html` (committed locally in `24b3eee`, **undeployed**) already has solid homepage defaults: full OG + Twitter tags, `canonical`, and a 1200×630 image — **but** it points `og:image` at `/images/noirsound-social-preview.jpg`, and that image file isn't shipped to prod. The spec wants the canonical OG path `/og/noirsound-cover.png`.
- **No server-side metadata** anywhere. The backend (Fastify) serves only `/api/*`; it does not render or inject HTML.
- **Data model** (`backend/prisma/schema.prisma`):
  - `Track`: `title`, `slug?` (unique), `coverUrl?`, `genre?`, `durationSeconds`, `status` (`DRAFT … PUBLISHED …`), `coverImageKey?` (**private** MinIO key), `publishedAt`, `artist` relation.
  - `User`: `username` (unique), `displayName`, `avatarUrl?`, `bio?`, `role` (`LISTENER/ARTIST/ADMIN`), `status` (`ACTIVE/SUSPENDED/DELETED`).
  - Covers are **private** storage keys; `serializePublicTrack()` strips keys and exposes only `hasCoverImage`. → A **controlled public cover route** is required for OG images (never expose raw MinIO keys).

## Root cause

NoirSound is a static-HTML SPA: social crawlers (Telegram, WhatsApp, Discord, X, Facebook) read the **initial HTML response** and do not execute React. The deployed initial HTML currently contains **no metadata at all** (and even the prepared homepage tags aren't deployed; the OG image isn't served). There is no `robots.txt`, no `sitemap.xml`, and no per-route (track/artist) server-rendered metadata. Hence Telegram shows only the raw URL.

## What this pass must deliver

1. Ship a **public OG image** that actually returns `200 image/*` at a stable `/og/...` path.
2. Deploy **default homepage metadata** (already prepared) + align OG image path.
3. **Server-side metadata injection** for `/`, `/track/:id`, `/artist/:id`, and legal routes (crawler-visible raw HTML).
4. A **controlled public cover route** so track covers can appear in previews without exposing private storage.
5. `robots.txt` + `sitemap.xml` (public/published content only).
6. JSON-LD, client-side `PageMeta` (tab correctness), tests, and a production verification runbook.
