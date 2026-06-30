# NoirSound — Auth / Session / CSRF Report (Phase 3)

Date: 2026-06-28

## Sessions (now server-side revocable)
Previously the JWT was stateless and logout only cleared the cookie. Now:
- **`backend/src/lib/session.js`** — `hashToken` (sha256), `newSessionId`, `sessionExpiry`. The raw JWT is **never stored**; only its hash is persisted as a revocation handle.
- **Login & register** (`routes/auth.js` → `issueSession`) create a `Session` row `{ id: sid, userId, token: sha256(jwt), expiresAt }` and embed `sid` in the JWT.
- **`authenticate`** (`plugins/auth.js`) now verifies the JWT **and** looks up the session: rejects if missing, wrong user, expired, or token-hash mismatch — then still checks `user.status === 'ACTIVE'`.
- **Logout** deletes the current session (`DELETE` by `sid`). **`POST /api/auth/logout-all`** revokes every session for the user.
- **Suspend** (admin) deletes all of the user's sessions immediately.

| Requirement | Status |
|---|---|
| Sessions server-side revocable | PASS |
| Logout revokes session | PASS |
| Logout-all endpoint | PASS (added) |
| Expired sessions rejected | PASS (`expiresAt` check) |
| Deleted/banned/suspended users can't reuse old sessions | PASS (status check every request + session purge on suspend) |
| Session tokens never stored plain (hash only) | PASS (sha256; raw JWT never persisted) |
| HttpOnly cookie | PASS |
| Secure cookie in production | PASS (`secure: NODE_ENV==='production'`) |
| SameSite=Lax | PASS |
| No wildcard COOKIE_DOMAIN | PASS (no domain set) |

`Session` table already exists in the initial migration — **no schema change required** for revocation.

## CSRF (Origin/Referer validation)
- **`backend/src/plugins/csrf.js`** — global `onRequest` guard with a pure `isCsrfSafe()` helper.
- Policy: safe methods (GET/HEAD/OPTIONS) pass; requests **without** a session cookie pass (no ambient credential to forge); state-changing requests **with** a session cookie must carry an `Origin` (or `Referer`) in the `FRONTEND_ORIGIN` allowlist. Cross-origin → **403 `CSRF_VALIDATION_FAILED`**.
- Chosen mechanism is the task-permitted "strict Origin/Referer validation". It needs no frontend token plumbing and does not break the existing API/test clients (which send no Origin).

| Requirement | Status |
|---|---|
| CSRF protection on cookie-auth mutating routes | PASS (Origin/Referer guard) |
| GET/HEAD exempt | PASS |
| POST/PUT/PATCH/DELETE require same-origin | PASS (when session cookie present) |
| Frontend keeps working | PASS (browser sends same-origin `Origin`) |
| Tests cover missing/invalid CSRF | PASS (unit + smoke) |
| Login/register not broken | PASS (no cookie yet on login/register → allowed) |

## Tests executed in-sandbox
- `publicBeta.unit.test.js`: `isCsrfSafe` (6 cases) + session helpers — **passing**.
- `publicBeta.smoke.test.js`: real server (no DB) asserts cross-origin POST → 403, same-origin POST → past CSRF (401 on forged token), admin route requires auth — **passing (6/6)**.

## Final database and E2E verification

PostgreSQL-backed tests now pass 58/58. Playwright verifies register/hydrate/logout revocation, logout-all across two sessions, cross-origin CSRF rejection, UI login, suspension session revocation, and blocked re-login. Integration tests verify `SUSPENDED`, `BANNED`, and `DELETED` statuses reject both login and existing-session hydration.

- **What was inspected:** session issuance/hash storage, cookie flags, expiry/status checks, logout/logout-all, CSRF hook ordering, login/register behavior.
- **What was implemented:** inactive users are rejected before session issuance; suspension revokes all sessions.
- **What was tested:** 58 backend tests, 28 DB-free tests, and full Playwright pass.
- **What could not be tested:** browser behavior on a real public HTTPS domain; local API and production container smoke were used.
- **Exact commands:** `(cd backend && npm run test && npm run test:unit)`; `npm run test:e2e`.
- **Exact blockers:** none.
- **Remaining risks:** session-row retention cleanup can be added for long-running deployments.
- **Files changed:** `backend/src/lib/session.js`; `backend/src/plugins/auth.js`; `backend/src/plugins/csrf.js`; `backend/src/routes/auth.js`; `backend/tests/endpoints.test.js`; auth/moderation E2E specs.

## Status: PASS
