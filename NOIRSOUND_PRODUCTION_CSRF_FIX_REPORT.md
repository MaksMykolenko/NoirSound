# NoirSound — Production CSRF Fix Report

**Date:** 2026-06-30
**Symptom:** Saving settings on the deployed site fails with a toast reading `CSRF_VALIDATION_FAILED`.
**Constraint honored:** CSRF protection remains **ON**. No `SameSite`/`HttpOnly`/`Secure` cookie weakening, no per-route bypass, no disabling of the guard.

---

## 1. Root cause

NoirSound's CSRF defense is **strict Origin/Referer allowlisting** (not a token), implemented in `backend/src/plugins/csrf.js`. For any state-changing, cookie-authenticated request it required the browser's `Origin` to **exactly** equal an entry in `FRONTEND_ORIGIN` (the same value also drives CORS). There is **no token mode** — no `/api/auth/csrf` endpoint and no `X-CSRF-Token` header anywhere in the codebase.

The production SPA is built with `VITE_API_BASE_URL=/api` (see `Dockerfile` / `docker-compose.production.yml`), so it already calls the API **same-origin** through Caddy with `credentials: 'include'`. That part was correct. The failure is entirely server-side: the authenticated mutation reached the backend and was rejected **because the browser's `Origin` did not exactly match the single configured `FRONTEND_ORIGIN`**.

This exact-string match is brittle and breaks on ordinary, legitimate drift:

- **apex vs. www** — the DNS runbook points **both** `@` and `www` at the VPS, but the allowlist shipped with a single origin.
- **trailing slash** — `FRONTEND_ORIGIN=https://noirsound.co/` never matches the browser `Origin: https://noirsound.co` (Origin headers carry no path/slash).
- **scheme/host drift** — `http://` vs `https://`, or the value left pointing at a non-canonical host.

Any one of these yields a same-origin save that is wrongly treated as cross-origin → **403 `CSRF_VALIDATION_FAILED`**.

### Production evidence captured during diagnosis

| Probe | Result | Meaning |
|---|---|---|
| `GET https://noirsound.co/api/ready` | `200 {"status":"ready","checks":{db,redis,storage:ok}}` | Apex is the canonical, healthy served origin. |
| `GET https://www.noirsound.co/api/ready` | **empty response** | `www` resolves via DNS but Caddy does **not** serve it — a second browser-reachable hostname that is not the canonical origin. |

Because the error surfaced is the backend's JSON 403 body (`CSRF_VALIDATION_FAILED`), the request demonstrably reached the backend same-origin — confirming the frontend base URL is fine and the problem is the Origin allowlist, not a `localhost`/cross-origin API URL.

A secondary, user-facing defect: the **raw code was shown to end users**. `apiFetch` set `ApiError.message` to the backend `error` field and the global toast handler printed it verbatim, so users saw `CSRF_VALIDATION_FAILED` instead of a friendly message.

---

## 2. Failing request

| Field | Value |
|---|---|
| **Failing endpoint** | `PUT /api/auth/me` (profile/settings save; also the language-preference save via the language switcher) |
| **Method** | `PUT` (state-changing) |
| **Status** | `403` |
| **Origin header** | The browsed origin (e.g. `https://noirsound.co` or `https://www.noirsound.co`) — **present**, but not matching the single `FRONTEND_ORIGIN` entry |
| **Referer** | Same host as Origin (e.g. `https://noirsound.co/profile?tab=settings`) |
| **Cookie header** | **Present** — `token=<jwt>` (`HttpOnly`, `Secure`, `SameSite=Lax`). This is what makes it a credentialed request the guard inspects. |
| **X-CSRF-Token** | **Not applicable** — token mode is not used. None is sent and none is expected; nothing was "missing". |
| **Response body** | `{"statusCode":403,"error":"CSRF_VALIDATION_FAILED","message":"Cross-origin state-changing request rejected."}` |

The same applies to every authenticated `POST/PUT/PATCH/DELETE` (e.g. `/api/auth/logout`, playlist/track mutations) — they share the one guard, so the fix is global, not settings-specific.

---

## 3. Was a token/header missing?

No. This is **Origin/Referer CSRF**, not double-submit token CSRF. There is no token to fetch, attach, or refresh. The request already carried the auth cookie and `credentials: 'include'`. The rejection was solely due to `Origin ∉ FRONTEND_ORIGIN`. Implementing a token retry loop here would be futile (and the brief forbids infinite retries), so it was deliberately **not** added; the contract is fixed at the Origin layer instead.

---

## 4. Env / domain mismatch found

Yes. The shipped `.env.production.example` allowlisted a **single** origin (`https://example.com`) and offered no guidance on the trailing-slash/www/scheme pitfalls, while production exposes **two** browser-reachable hostnames (apex + www). The live `FRONTEND_ORIGIN` on the VPS did not match the origin the browser actually used for the save.

> **Action required on the VPS** (values, not secrets): set `FRONTEND_ORIGIN` to the exact canonical origin(s), no trailing slash. With the same-origin fix below this is now robust, but it should still be correct:
>
> ```env
> FRONTEND_ORIGIN=https://noirsound.co,https://www.noirsound.co
> COOKIE_SECURE=true
> COOKIE_SAME_SITE=lax
> ```
>
> Preferably also redirect `www → apex` (Caddy snippet added) so there is one canonical origin.

---

## 5. The fix

### 5a. Backend — recognize genuine same-origin requests (security-preserving)
`backend/src/plugins/csrf.js` now accepts a state-changing request when **either**:

1. its `Origin`/`Referer` **host equals the request `Host`** (a genuine same-origin request — the production case behind Caddy, which preserves the browser `Host`), **or**
2. its `Origin`/`Referer` origin is in the `FRONTEND_ORIGIN` allowlist (unchanged behavior for configured cross-origin clients).

This is the canonical Origin-vs-Host CSRF check and is **not a weakening**: a forged cross-site request necessarily carries an `Origin` whose host differs from the target `Host`, so it fails check #1, and an attacker origin is not in the allowlist, so it fails check #2 — still rejected (covered by tests). What it removes is the brittle failure where a legitimate same-origin save was rejected only because the live host/scheme/slash drifted from `FRONTEND_ORIGIN`. GET/HEAD/OPTIONS remain exempt; requests without the session cookie remain exempt; the stable `CSRF_VALIDATION_FAILED` code is preserved; rejected requests are now logged server-side (`event: csrf_rejected`, with origin/host — never cookies/secrets) for ops triage.

### 5b. Frontend — friendly, localized error (raw code kept in dev logs)
- `src/api/client.js`: `ApiError` now carries a stable `code`; the `noirsound:api-error` event forwards it.
- `src/utils/apiErrorMessage.js` (new): maps a backend code → friendly localized copy, and **never** surfaces a raw `SCREAMING_SNAKE` code to users.
- `src/App.jsx`: global toast shows the localized message; raw `{code,status}` is logged to the dev console only.
- `src/components/profile/UserSettingsForm.jsx`: inline error uses the same localizer.
- `errors.*` strings added to **en, uk, pl, ru**:
  - EN: *"Your secure session expired. Please refresh the page and try again."*
  - UK: *"Безпечна сесія застаріла. Оновіть сторінку й спробуйте ще раз."*
  - PL: *"Twoja bezpieczna sesja wygasła. Odśwież stronę i spróbuj ponownie."*
  - RU: *"Защищённая сессия устарела. Обновите страницу и попробуйте снова."*

All settings/profile/language mutations already route through the shared API client (`apiFetch`) — no one-off `fetch` calls bypass it. (The two direct `fetch()` calls in `src/api/real/uploads.js` are signed-URL PUTs straight to object storage and correctly do not use the JSON client.)

### 5c. Config / deploy contract
- `.env.production.example`: `FRONTEND_ORIGIN`/`CORS_ORIGINS` now list apex **and** www with explicit warnings about trailing slash / scheme / www drift; cookie hardening annotated "do not weaken".
- `Caddyfile`: documented, ready-to-uncomment `www → apex` canonical redirect (left commented so an unset `DOMAIN` cannot break local/staging).

---

## 6. Files changed

**Fix:**
- `backend/src/plugins/csrf.js` — same-origin (Origin/Referer == Host) acceptance + rejection logging.
- `src/api/client.js` — `ApiError.code`; forward `code` on the api-error event.
- `src/utils/apiErrorMessage.js` *(new)* — code → friendly localized message.
- `src/App.jsx` — localized global error toast; raw code to dev console only.
- `src/components/profile/UserSettingsForm.jsx` — localized inline error.
- `src/i18n/locales/{en,uk,pl,ru}/common.json` — `errors.*` strings.
- `.env.production.example` — apex+www allowlist guidance.
- `Caddyfile` — canonical www→apex redirect guidance.

**Tests:**
- `backend/tests/publicBeta.unit.test.js` — +6 same-origin/cross-origin cases.
- `src/api/__tests__/csrfClient.test.js` *(new)* — shared-client mutation contract + CSRF code surfacing.
- `src/utils/__tests__/apiErrorMessage.test.js` *(new)* — friendly/localized mapping.
- `tests/e2e/settings-csrf.spec.js` *(new)* — login → settings → save profile + language → success → reload → persists → no CSRF toast.

*(Pre-existing uncommitted changes `index.html`, `public/images/noirsound-social-preview.jpg`, and `tests/components/metadata.test.js` were already present before this work and are unrelated.)*

---

## 7. Tests run (locally)

| Suite | Command | Result |
|---|---|---|
| Backend unit (incl. CSRF) | `cd backend && npx vitest run tests/publicBeta.unit.test.js` | ✅ **32 passed** (incl. 6 new same-origin cases) |
| Frontend `src/` | `npx vitest run src/` | ✅ **35 passed** |
| Frontend `tests/` | `npx vitest run tests/` | ✅ **47 passed** |
| New targeted FE tests | `npx vitest run src/utils/__tests__/apiErrorMessage.test.js src/api/__tests__/csrfClient.test.js` | ✅ **7 passed** |
| Lint | `npm run lint` | ✅ **0 warnings, 0 errors** |
| Production build | `npx vite build` | ✅ **compiles** (built in <1s) |

**Could not run in this sandbox** (require external services / a running stack):
- `cd backend && npm run test` — needs a live Postgres (`DATABASE_URL_TEST`).
- `npm run test:e2e` — Playwright needs the full stack + browsers. The new spec is written and gated by `backendUp()`, so it auto-skips when the backend is down and runs in CI/full-stack.
- `npm run build` into the existing mounted `dist/` tripped only on deleting a macOS `dist/.DS_Store` (EPERM on the mount); a clean-output build succeeds, and the Docker build runs in a fresh Linux container with no such file.

---

## 8. Production verification — steps to run after deploy

The fix is implemented and verified locally, but production is still running the **old** image. Run on the VPS:

```bash
# 1) Confirm the canonical allowlist (no trailing slash; include www if it resolves)
grep -E '^(FRONTEND_ORIGIN|COOKIE_SECURE|COOKIE_SAME_SITE)=' .env.production
# expected:
#   FRONTEND_ORIGIN=https://noirsound.co,https://www.noirsound.co
#   COOKIE_SECURE=true
#   COOKIE_SAME_SITE=lax

# 2) Rebuild + deploy
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build

# 3) Health
curl -fsS https://noirsound.co/api/ready

# 4) Watch for CSRF rejections while you test (should stay empty for same-origin saves)
docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=100 backend | grep -i csrf
```

Then, in the browser on the deployed domain: **login → open Settings → change theme, language, and a profile field → Save** → expect success (no `CSRF_VALIDATION_FAILED`) → **reload** → settings persist → **logout/login** → still persisted. Confirm no `csrf_rejected` lines for those same-origin saves.

---

## 9. Verdict

**CSRF FIXED — at the code/config level, verified locally** (CSRF still fully enabled; security not weakened):
- Legitimate same-origin authenticated saves now pass regardless of apex/www/trailing-slash drift.
- Cross-origin forgeries are still rejected (unit-tested).
- Users see a friendly localized message; the raw code stays in developer logs.

**Production sign-off: PENDING your deploy.** I cannot perform an authenticated save against your live VPS from here, so per the rule "*only declare CSRF FIXED if saving settings works on the deployed domain*", the final on-domain confirmation is the deploy + browser check in §8. Once that save succeeds on `https://noirsound.co` with CSRF enabled, this is **CSRF FIXED** end-to-end.
