# NoirSound — Social Metadata `<head>` Placement Fix Report

**Date:** 2026-07-01
**Scope:** Move SSR-injected OG/Twitter/JSON-LD metadata to the top of `<head>` (before scripts, preload links, Google Fonts, and CSS) so strict/flaky crawlers (Telegram, WhatsApp) read it reliably. No metadata content, image, robots, or routing changes.

---

## Root cause

The bug was not "missing metadata" — the homepage already returned complete, correct OG/Twitter tags. It was **placement**. Two things combined to push the metadata block to the very end of `<head>`:

1. **`backend/src/lib/metaRenderer.js`** (`injectMeta`) always inserted the fresh `<!--noirsound:ssr-meta-->` block immediately **before `</head>`**, with no anchor — regardless of what else was already in `<head>`.
2. **Vite's production build** appends the bundled `<script type="module">`, its `<link rel="modulepreload">` dependencies, and the extracted CSS `<link rel="stylesheet">` at the **end of `<head>`** at build time — this happens unconditionally, independent of where the source `index.html` places the entry script.

Net effect: every SSR response (`/`, `/track/:id`, `/artist/:id`, legal pages) landed the OG/Twitter block *after* the module script, 7 modulepreload links, and the CSS bundle. Confirmed live before this fix (captured during this session):

```
...
<link rel="stylesheet" crossorigin href="/assets/index-DtwJcEUc.css">
  <!--noirsound:ssr-meta-->
```

i.e. the marker — and everything after it (title, OG, Twitter, JSON-LD) — appeared **after** all script/font/CSS tags, past the first 80 lines of `<head>`. The production HTML also had several blank placeholder lines left behind by the tag-stripping step.

## Fix

**`index.html`** — reordered so `<!--noirsound:ssr-meta-->` and the full default metadata block (title → description → canonical → og:* → twitter:* → JSON-LD) sit immediately after `charset` / `viewport` / `theme-color`, ahead of the theme-init script, favicon, Google Fonts preconnects/stylesheet, and the module script. This matches the requested order exactly.

**`backend/src/lib/metaRenderer.js`** — `injectMeta` no longer inserts before `</head>`. It now replaces the `<!--noirsound:ssr-meta-->` marker **in place**, so the route-specific block lands wherever the marker lives in the shell (top of `<head>`), not wherever `</head>` happens to be. Added a same-position fallback (insert right after `<head>`) for a shell that's missing the marker, so metadata can never again silently fall to the bottom. Also collapses blank lines left behind by stripped tags.

**`backend/src/routes/pages.js`** — `FALLBACK_SHELL` (used only if the shell fetch from the `web` service fails) updated to carry the marker in the same position, so the degenerate path behaves identically to the real shell.

Why this is sufficient and durable: Vite always appends the bundled script/modulepreload/CSS tags at the *end* of `<head>`, no matter where the source places the entry script. Once the marker is anchored near the *top* and `injectMeta` targets that marker instead of `</head>`, the metadata block stays pinned ahead of those tags **regardless of how many chunks, fonts, or stylesheets get added to the build in the future** — there's no longer a hardcoded assumption that `</head>` is a safe insertion point.

### Files changed

| File | Change |
|---|---|
| `index.html` | Reordered `<head>`; marker + default metadata moved to the top |
| `backend/src/lib/metaRenderer.js` | `injectMeta` anchors on the marker, not `</head>`; blank-line cleanup |
| `backend/src/routes/pages.js` | `FALLBACK_SHELL` carries the marker in the correct position |
| `backend/tests/metaRenderer.unit.test.js` | Shell fixture rebuilt to mirror the real build shape; 4 new tests assert top-of-head placement, marker fallback, idempotency, and whitespace cleanup |

## Verification (local — exact production pipeline, see note below)

I don't have deploy access to the Hostinger VPS from this environment (no SSH key / GitHub Actions secrets here — `deploy-hostinger.yml` only fires on a manual `workflow_dispatch` or a `public-beta-*` tag push, both of which need credentials this session doesn't have). So I verified by running the **real, unmodified production code path** locally end-to-end, not a mock:

1. **`npx vite build`** (same command the Dockerfile runs) → inspected the real output `dist/index.html`. Result: marker + full default block sit right after `theme-color`; the module script, 7 `modulepreload` links, and the CSS bundle all land *after* it, automatically.
2. **Real `injectMeta` + real `pageMeta.js` builders against that real built shell**, for every required route:

   | Route | `<title>` | description | marker | `og:image` | metadata before scripts/CSS | private URL leak |
   |---|---|---|---|---|---|---|
   | `/` | 1 | 1 | 1 | 1 | ✅ | none |
   | `/track/:id` | 1 | 1 | 1 | 1 (`/api/public/covers/:id`) | ✅ | none |
   | `/artist/:id` | 1 | 1 | 1 | 1 | ✅ | none |
   | `/terms` (legal) | 1 | 1 | 1 | 1 | ✅ | none |
   | track-unavailable fallback | 1 | 1 | 1 | 1 | ✅ | none |
   | `/profile`, `/discover` (SPA fallback, untouched shell) | 1 | 1 | 1 | 1 | ✅ | none |

3. **Spun up a local HTTP server** running the unmodified `injectMeta`/`pageMeta` against the real built shell and ran the **exact verification commands from this task** against it:
   - Metadata block appears immediately after `theme-color`, before the theme script / favicon / Google Fonts / module script / modulepreload / CSS.
   - `GET /og/noirsound-cover.png` → `200`, `content-type: image/png`.
   - `GET /` → `200`, `content-type: text/html; charset=utf-8`, `x-noirsound-ssr: 1`.
   - Exactly one `<title>` and one `<meta name="description">`.

4. **Automated tests:**

   | Suite | Result |
   |---|---|
   | `backend/tests/metaRenderer.unit.test.js` (18 tests — 14 existing + 4 new placement/idempotency/fallback/whitespace tests) | ✅ 18/18 |
   | `tests/components/metadata.test.js` (frontend, parses `index.html` via `DOMParser`) | ✅ 3/3 |
   | `oxlint` (223 files) | ✅ 0 warnings/errors |
   | `scripts/check-forbidden-files.sh` | ✅ passed |
   | `vite build` | ✅ clean |

No metadata values, image URLs, robots rules, or routes changed — only the position of the existing block and incidental whitespace.

## Production verification — run against `https://noirsound.co/` from this session

These are the exact commands requested, run against the **live, currently-deployed** site (i.e. *before* this fix is deployed, since I can't deploy it myself):

```
$ curl -sSI https://noirsound.co/
HTTP/2 200
content-type: text/html; charset=utf-8
x-noirsound-ssr: 1
... (other headers unchanged)

$ curl -sSI https://noirsound.co/og/noirsound-cover.png
HTTP/2 200
content-type: image/png
content-length: 78227
```

og:image and the base response are healthy, as the task description said. But the head-order check confirms the bug is live right now:

```
$ curl -sSL https://noirsound.co/ | sed -n '/<head/,/<\/head>/p' | head -80
  <head>
    <meta charset="UTF-8" />
    <script> ... theme init ... </script>
    <link rel="icon" .../>
    <meta name="viewport" .../>
    <meta name="theme-color" .../>


    <!-- Default app-shell metadata. ... -->










    <!-- Google Fonts -->
    <link rel="preconnect" .../>
    <link rel="preconnect" .../>
    <link href="https://fonts.googleapis.com/css2?..." rel="stylesheet">
    <script type="module" crossorigin src="/assets/index-DURaLAjW.js"></script>
    <link rel="modulepreload" .../>   (×7)
    <link rel="stylesheet" crossorigin href="/assets/index-DtwJcEUc.css">
      <!--noirsound:ssr-meta-->
```

The marker — and the entire OG/Twitter/JSON-LD block after it — is still the **last** thing in `<head>` on production, exactly matching the bug report. Title/description/OG/Twitter tags themselves are correct and complete (confirmed via the grep check), they're just positioned too late.

### This fix is not live yet

I implemented and locally verified the fix against the real build/serve pipeline, but I have no credentials in this session to deploy it (the deploy workflow needs `HOSTINGER_HOST` / `HOSTINGER_SSH_KEY` / etc. GitHub Action secrets, or direct VPS SSH access — neither is available here). The code changes are saved in your project folder, uncommitted. To ship this:

```bash
git add index.html backend/src/lib/metaRenderer.js backend/src/routes/pages.js backend/tests/metaRenderer.unit.test.js
git commit -m "fix: move SSR social metadata to top of <head>, before scripts/fonts/CSS"
git push origin main
git tag public-beta-<next-version>
git push origin main --tags   # triggers .github/workflows/deploy-hostinger.yml
```

(Per `NOIRSOUND_RELEASE_AND_ROLLBACK_RUNBOOK.md` — substitute the next version number.) Once deployed, re-run the four commands from this task against production; they should show the marker and full metadata block right after `theme-color`, before every script/font/preload/CSS tag, with `og:image` still 200/`image/png`, the page still 200/`text/html`, `x-noirsound-ssr: 1` still present, and exactly one `<title>`/`<meta name="description">`.

## Telegram cache refresh — do this after deploying

Telegram caches link previews aggressively. Refreshing now would just re-cache the still-broken page, so this should happen **after** the deploy above:

1. Open `@WebpageBot` in Telegram.
2. Send `https://noirsound.co/`.
3. Click **Update with content**.
4. Paste the link into Saved Messages or another chat to confirm the image/title/description preview renders.

I can drive this from your desktop via Telegram once you confirm the deploy is live — just say the word.

## Requirements checklist

| Requirement | Status |
|---|---|
| Move `<!--noirsound:ssr-meta-->` near top of `<head>` | ✅ Done — right after charset/viewport/theme-color |
| Match recommended tag order | ✅ title → description → canonical → og:* → twitter:* → JSON-LD |
| Remove empty placeholder whitespace | ✅ `injectMeta` collapses blank-line runs left by stripped tags; production currently shows ~15 blank lines from the old code, gone in the fix |
| Exactly one active `<title>` | ✅ Verified for all routes + SPA fallback |
| Exactly one active `<meta name="description">` | ✅ Verified for all routes + SPA fallback |
| Route metadata still works: `/`, `/profile`, `/track/:id`, `/artist/:id`, legal pages | ✅ `/`, `/track/:id`, `/artist/:id`, legal pages are SSR-injected (verified); `/profile` is intentionally not SSR per-route (private/auth-gated, same as before) — it correctly serves the single, valid, deduplicated default block via the SPA static fallback, unchanged behavior, just reordered |
| No reliance on React Helmet/client metadata for crawlers | ✅ Untouched — `PageMeta.jsx` remains client-nav-only; SSR injection is still the sole source of truth for crawlers |
| No SPA routing breakage | ✅ `<div id="root">` and the module script bundle are preserved by `injectMeta`; Caddy `@ssr` matcher and `try_files` fallback untouched |
| No private MinIO URLs exposed | ✅ Unchanged — track covers still go through `/api/public/covers/:id`, artist images through `/og/default-artist.png` or an already-absolute avatar URL |
| `og:image` not removed | ✅ Present in every route's output, 1200×630 PNG, 200 `image/png` |

---

## Verdict

```
SOCIAL METADATA HEAD PLACEMENT FIXED
```

Code fix complete and verified end-to-end against the real build/serve pipeline (unit tests 18/18, frontend metadata test 3/3, lint clean, real `vite build` output inspected, real `injectMeta` exercised against that real shell for every route). Production deployment is the one step outside this session's reach — no deploy credentials available here — so `https://noirsound.co/` still serves the pre-fix HTML as of this report. Deploy via the commands above, re-run the four verification curls, then refresh Telegram via `@WebpageBot` to confirm the live preview.
