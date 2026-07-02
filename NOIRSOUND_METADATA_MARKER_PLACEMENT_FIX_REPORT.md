# NoirSound — SSR Metadata Marker Placement Fix Report

**Date:** 2026-07-01
**Scope:** Move `<!--noirsound:ssr-meta-->` (and the metadata it anchors) to the top of `<head>` in the source `index.html`, confirm the backend injects exactly at that marker, rebuild, and get this live on `https://noirsound.co/`.

---

## tl;dr — read this first

The **source-code fix is correct and already in place** (it was written in the previous turn of this session and is unchanged on disk). Production still shows the old, broken ordering only because **the build was never deployed**. That's confirmed again below with fresh `curl` output. This session has hit two concrete, unresolved blockers that prevent finishing steps 7–8 (rebuild + redeploy) from here — both detailed in **"Why production still hasn't changed"** below, with exact next actions for you.

## What was fixed in source (confirmed still present, and tightened this round)

`index.html` `<head>`, in order:

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#09090b" />

<!-- SSR-injected per-route metadata; see backend/src/lib/metaRenderer.js -->
<!--noirsound:ssr-meta-->
<title>NoirSound — Creator-first music platform</title>
<meta name="description" content="..." />
<link rel="canonical" .../>
<meta property="og:type" .../>
... (full og:*, twitter:*, JSON-LD block, exactly matching the requested order)

<script>theme init...</script>
<link rel="icon" .../>
<!-- Google Fonts -->
<link rel="preconnect" .../>
<link rel="preconnect" .../>
<link ... rel="stylesheet">          <!-- Google Fonts stylesheet -->
<script type="module" src="/src/main.jsx"></script>
```

This round I also **shortened the doc comment above the marker** (it was a 9-line block explaining the SSR mechanism, which pushed the marker to line 18 of `<head>` — still inside the requested "10–20 lines" window, but right at the edge). It's now a single line, putting the marker at **line 7** of `<head>` after a fresh build — comfortably inside the target window regardless of how it's counted.

`backend/src/lib/metaRenderer.js` — `injectMeta()` replaces content **at the `<!--noirsound:ssr-meta-->` marker**, not before `</head>`. This is the part that makes the fix durable: Vite always appends the bundled `<script type="module">`, its `modulepreload` links, and the CSS bundle at the very end of `<head>` at build time, no matter where the source places the entry script. Anchoring on the marker (which now lives near the top) means the SSR block stays pinned above those tags regardless of how many scripts/fonts/chunks the build adds later. Fallback: if the marker is ever missing from a shell, it inserts right after `<head>` — never before `</head>`.

`backend/src/routes/pages.js` — `FALLBACK_SHELL` (used only if the shell fetch from the `web` container fails) carries the marker in the same position, so the degenerate path can't regress to the old behavior either.

## Fresh local verification (this round)

```bash
npx vite build --outDir <scratch>     # same command the Dockerfile runs
sed -n '/<head/,/<\/head>/p' <scratch>/index.html | head -22
```

```
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#09090b" />

    <!-- SSR-injected per-route metadata; see backend/src/lib/metaRenderer.js -->
    <!--noirsound:ssr-meta-->                                    ← line 7
    <title>NoirSound — Creator-first music platform</title>
    ...
```

Ran the real (unmodified) `injectMeta` + `pageMeta.js` builders against that real built shell for `/`, `/profile`, and `/track/:id` — the three routes called out in this task:

| Route | Marker position | `<title>` | description | Notes |
|---|---|---|---|---|
| `/` | line 7 of `<head>`, before theme script/favicon/fonts/module script/modulepreload/CSS | 1 | 1 | SSR-injected |
| `/profile` | line 7 (static shell — `/profile` isn't in Caddy's `@ssr` matcher, so it's intentionally served the static default block, unchanged behavior) | 1 | 1 | SPA fallback, not personalized — same as before this fix, just reordered |
| `/track/:id` | line 5 (no doc comment in the SSR-rendered path) | 1 | 1 | Real title/artist/genre/duration injected |

Test suites, re-run after the comment trim:

| Suite | Result |
|---|---|
| `backend/tests/metaRenderer.unit.test.js` | ✅ 18/18 |
| `tests/components/metadata.test.js` | ✅ 3/3 |
| `oxlint` (223 files) | ✅ 0 warnings/errors |

## Production verification — run just now against `https://noirsound.co/`

```bash
curl -sSL https://noirsound.co/ | sed -n '/<head/,/<\/head>/p' | head -80
```

Still shows, in this exact order: charset → theme script → favicon → viewport → theme-color → blank placeholder lines → Google Fonts → `<script type="module" src="/assets/index-DURaLAjW.js">` → 7× `modulepreload` → `<link rel="stylesheet" href="/assets/index-DtwJcEUc.css">` → **then** `<!--noirsound:ssr-meta-->` and the full OG/Twitter block. Identical to the bug report, byte-for-byte the same shape as last time.

```bash
curl -sSI https://noirsound.co/og/noirsound-cover.png
→ HTTP/2 200, content-type: image/png, content-length: 78227        ✅ unaffected, still healthy

curl -sSI https://noirsound.co/
→ HTTP/2 200, content-type: text/html; charset=utf-8, x-noirsound-ssr: 1   ✅ unaffected

curl -sSL https://noirsound.co/profile | sed -n '/<head/,/<\/head>/p' | head -80
→ same pre-fix static shell ordering (no marker at all — /profile never carried one
  pre-fix, since the marker only ever existed as a runtime-only insertion)

curl -sSL https://noirsound.co/track/test-id | sed -n '/<head/,/<\/head>/p' | head -100
→ correctly resolves to the "Track unavailable" noindex fallback (no track with that
  id exists), but still shows the marker at the very bottom — same bug, same shape
```

All values (title, description, canonical, OG, Twitter, `og:image`) are correct and complete on production right now — this was never a content problem. It is purely an ordering problem, and the ordering on production is unchanged because **the fixed build has not been deployed.**

## Why production still hasn't changed

Two separate, concrete blockers in this session — not a code issue:

**1. Nothing has been committed yet.** The fix exists only as uncommitted edits in your project folder:

```
$ git status --porcelain
 M backend/src/lib/metaRenderer.js
 M backend/src/routes/pages.js
 M backend/tests/metaRenderer.unit.test.js
 M index.html
```

**2. `git add`/`git commit` from this sandbox fails outright:**

```
$ git add index.html backend/src/lib/metaRenderer.js backend/src/routes/pages.js
fatal: Unable to create '.../NoirSound Web/.git/index.lock': File exists.

Another git process seems to be running in this repository, e.g.
an editor opened by 'git commit'. Please make sure all processes
are terminated then try again. If it still fails, a git process
may have crashed in this repository earlier: remove the file manually to continue.
```

`.git/index.lock` exists and this session cannot remove it (`rm -f .git/index.lock` → `Operation not permitted` — the mounted project folder doesn't let this sandbox unlink files written from the host side). This is something to clear **on your actual Mac**, not in this session: close any app that might be mid-git-operation on this repo (VS Code's Source Control panel, GitHub Desktop, a terminal with a hung `git commit`/rebase), then delete `.git/index.lock` yourself in Finder or Terminal if it's still there after that. Once it's gone, `git add`/`commit` will work normally again — from this session or yours.

**3. Even with a clean commit, this session has no deploy credentials.** `.github/workflows/deploy-hostinger.yml` only fires on a manual `workflow_dispatch` or a `public-beta-*` tag push, and the deploy step needs `HOSTINGER_HOST` / `HOSTINGER_SSH_KEY` / `HOSTINGER_USER` / `HOSTINGER_DEPLOY_PATH` — GitHub Action secrets that live in your repo settings, not in this sandbox. Re-checked this session for `gh`, `docker`, `~/.ssh`, and any matching environment variables — none are present.

### What actually needs to happen (on your machine, not in this session)

```bash
# 1. Clear the stale lock if Finder/Terminal still shows it after closing any
#    git GUI/editor that has this repo open:
rm -f "/Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Web/.git/index.lock"

# 2. Commit and push the fix (already written to your project folder):
cd "/Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Web"
git add index.html backend/src/lib/metaRenderer.js backend/src/routes/pages.js backend/tests/metaRenderer.unit.test.js
git commit -m "fix: move SSR social metadata marker to top of <head>"
git push origin main

# 3. Cut and push a release tag to trigger the deploy workflow
#    (per NOIRSOUND_RELEASE_AND_ROLLBACK_RUNBOOK.md — pick the next version):
git tag public-beta-<next-version>
git push origin main --tags

# 4. Watch the GitHub Action run to completion (Actions tab → "Deploy to Hostinger VPS")
```

Once that finishes, re-run the four verification commands from this task — I'd expect:
- marker within the first ~7 lines of `<head>`, before every script/font/preload/CSS tag
- `og:image` still 200/`image/png`
- `/` still 200/`text/html`, `x-noirsound-ssr: 1` still present
- exactly one `<title>` / one `<meta name="description">` on `/`, `/profile`, and `/track/:id`

Tell me once it's deployed and I'll re-run all of these against production myself and do the Telegram `@WebpageBot` refresh.

## Requirements checklist

| Requirement | Status |
|---|---|
| Marker moved in source `index.html`, not just the backend renderer | ✅ Both — marker repositioned in `index.html` *and* `injectMeta` now anchors on it instead of `</head>` |
| Marker immediately after charset/viewport/theme-color | ✅ One short doc-comment line, then the marker |
| Theme init script moved after the SSR metadata marker | ✅ |
| Remove empty placeholder whitespace | ✅ `injectMeta` collapses blank-line runs left by stripped tags; the long doc comment that pushed the marker toward line 18 was trimmed to one line |
| Backend injects exactly at the marker | ✅ `SSR_META_MARKER` regex match-and-replace, not append-before-`</head>` |
| No duplicate `<title>` / `<meta name="description">` | ✅ Verified on `/`, `/profile`, `/track/:id` (real + fallback), legal pages |
| Rebuild frontend | ✅ Done locally (`vite build`), output inspected and correct |
| Rebuild/redeploy production Docker containers | ❌ **Not possible from this session** — see blockers above |
| `og:image` still 200 `image/png` | ✅ Confirmed on production, unaffected throughout |
| `x-noirsound-ssr: 1` still present | ✅ Confirmed on production |
| SPA routes still work | ✅ `<div id="root">` + module bundle untouched; Caddy `@ssr`/`try_files` untouched |

---

## Verdict

```
SSR METADATA MARKER PLACEMENT FIXED (in source — production deploy still pending)
```

The marker-placement defect is fixed at the code level: `index.html` carries the marker at the top of `<head>`, `metaRenderer.js` injects exactly at that marker for every route, verified against the real build output for `/`, `/profile`, and `/track/:id`, with no duplicate title/description and `og:image` intact. `https://noirsound.co/` will show this fix as soon as the commit above is pushed and the Hostinger deploy workflow runs — this session cannot do either of those two things itself (stale `.git/index.lock` it can't remove, and no deploy credentials), so that part is on you. Once deployed, re-run the four verification commands and I'll confirm + refresh Telegram.
