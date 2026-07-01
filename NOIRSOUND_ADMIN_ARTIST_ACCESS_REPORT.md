# NoirSound Admin Artist Management — Implementation Report

## Summary

Admins previously had to run raw PostgreSQL commands to give a user artist upload access, because a user could hold `role = ARTIST` or `role = ADMIN` and still fail uploads with a 422 (`An ArtistProfile is required before uploading tracks.`) whenever no `ArtistProfile` row existed for that user. This pass adds first-class admin tooling for granting, revoking, and creating artist access, extends the admin API and UI to make upload-access state visible and filterable, gives the upload page a friendly fallback instead of a raw error, and audits every mutation. No database migration was needed — the fix reuses the existing `ArtistProfile`, `AuditLog`, and `Session` models.

## Root cause

`POST /api/uploads/track/init` (backend/src/routes/uploads.js) required `request.user.artistProfile` to exist before creating a track. Role alone (`ARTIST`/`ADMIN`) never guaranteed a profile row existed — profiles were only created through the artist-onboarding flow, which an admin could bypass when creating or promoting a user directly. The only way to close that gap before this pass was to `INSERT INTO "ArtistProfile" ...` by hand.

## Backend endpoints added

All three live in `backend/src/routes/admin.js`, gated by `fastify.requireAdmin`, require a `reason` string, refuse to act on `BANNED`/`DELETED` targets (409 `ADMIN_USER_BANNED`/`ADMIN_USER_DELETED`), and run inside a Prisma `$transaction`:

- `POST /api/admin/users/:id/grant-artist` — sets role to `ARTIST` (admins keep `ADMIN`), creates the `ArtistProfile` if missing, unhides it if it was hidden, and (by default) revokes the user's sessions. Body accepts `{ reason, createProfile?, revokeSessions? }`.
- `POST /api/admin/users/:id/revoke-artist` — moves `ARTIST` back to `LISTENER`; an admin's role is never touched, only their profile can optionally be hidden. Body accepts `{ reason, hideArtistProfile?, revokeSessions? }`.
- `POST /api/admin/users/:id/ensure-artist-profile` — idempotent profile creation with no role change, for the case where an admin just needs the row to exist. Body accepts `{ reason, revokeSessions? }`.

A matching self-service endpoint, `POST /api/auth/me/ensure-artist-profile`, lets an authenticated `ADMIN` create their own profile without a separate admin acting on them (403 `ADMIN_ONLY` for anyone else).

`POST /api/admin/users/:id/set-role` (pre-existing) was extended with the same profile logic: promoting to `ARTIST` auto-creates a profile by default (opt-out via `createArtistProfile: false`), promoting to `ADMIN` does not auto-create one unless explicitly requested, and demoting away from `ARTIST` offers to hide the existing profile rather than forcing it.

`GET /api/admin/users` and `GET /api/admin/users/:id` now return `hasArtistProfile`, `artistProfileId`, `artistProfileHidden`, `canUploadTracks`, and `uploadAccessReason` for every user, computed by the shared helper described below. The list endpoint also accepts `hasArtistProfile` and `uploadBlocked` filters and searches by user id in addition to email/username.

## Shared logic: backend/src/lib/artistAccess.js

A single helper module is the source of truth for "can this user upload":

`evaluateUploadAccess({ role, status, artistProfile })` returns `{ canUploadTracks, uploadAccessReason }`, checking in priority order: account deleted → banned → suspended → role not artist/admin → no profile → profile hidden → else allowed. The upload route, the admin list/detail endpoints, and the UI all read this one function, so "why can't this user upload" can never drift between screens.

`ensureArtistProfile(client, userId)` is race-safe: it checks for an existing profile, creates one on a cache miss, and falls back to a re-read on a Prisma `P2002` unique-constraint error, so two concurrent grant requests for the same user can never create two profiles.

`grantArtistAccess` / `revokeArtistAccess` wrap the role change, profile creation/hide/unhide, and optional session revocation into one auditable unit and return a diff (`previousRole`, `nextRole`, `profileCreated`, `profileUnhiddenNow`, `revokedSessionCount`, …) that both the route handler and the tests use to make precise assertions.

## Admin UI

`/admin/users/:id` (src/pages/admin/AdminUserDetail.jsx) gained an "Artist Access" panel showing has-profile / profile id / profile-hidden / can-upload state, a plain-language reason when blocked (e.g. "No artist profile exists yet — create one to enable uploads."), and action buttons — Grant Artist Access, Create Artist Profile (only offered when eligible and missing), Revoke Artist Access, Hide/Unhide Artist Profile — each behind a `ConfirmActionModal` that requires a typed reason and exposes the relevant checkboxes (create profile, revoke sessions, hide profile) before submitting. Role changes from the danger zone now surface the same checkboxes (auto-create profile on promotion to `ARTIST`, opt-in for `ADMIN`, hide-on-demote).

`/admin/users` (src/pages/admin/AdminUsers.jsx) gained "Artist Profile" and "Upload Access" columns with compact badges (Profile ready / Profile missing / Profile hidden, Can upload / Upload blocked) and two new filters (`hasArtistProfile`, `uploadBlocked`) alongside the existing role/status filters and email/username/id search.

No raw SQL, table names, or column names are ever rendered — the closest the UI gets is the `ArtistProfile` id itself (an application-level UUID, not a schema artifact), consistent with the ticket's constraint.

## Upload page fallback

`src/components/upload/UploadForm.jsx` now checks `user.canUploadTracks === false` (strict equality, so a mock-mode user object that doesn't carry the field is never incorrectly blocked) and renders a plain-language "Artist profile not ready" panel instead of ever reaching the raw backend error. If the signed-in user is an `ADMIN` blocked specifically by a missing profile, a "Create my artist profile" self-service button is offered (calling the new self-service endpoint); every other blocked user — including non-admin artists — is told to contact an admin, with no self-service escape hatch. The backend's 422 response body also changed shape, from a free-text sentence to `{ error: 'ARTIST_PROFILE_REQUIRED', message, uploadAccessReason }`; the frontend branches on `err.code`, never displays the code itself, and this is covered by both a backend test and a defensive fallback in the submit handler for the case where access changes mid-session.

## Audit logging

Every mutation writes at least one `AuditLog` row, and composite actions write one row per sub-effect plus a top-level summary row, all inside the same transaction (so a failure never produces a partial audit trail): `USER_GRANT_ARTIST` / `USER_REVOKE_ARTIST` as the top-level actions, with `USER_SET_ROLE`, `ARTIST_PROFILE_CREATED`, `ARTIST_HIDE`, `ARTIST_UNHIDE`, and `USER_REVOKE_SESSIONS` as sub-effects where applicable. Every row includes the actor, the reason text the admin typed, a `requestId`, and a metadata payload (previous/next role or status, revoked session count, etc.).

## Guardrails verified

- Non-admins get 403 on every new/extended endpoint (backend test + frontend test that the controls are not rendered at all for a non-admin).
- Banned/deleted targets are refused (409) rather than silently mutated.
- `revokeArtistAccess` never changes an `ADMIN`'s role, so the pre-existing last-admin protection on `set-role` is never in tension with the new endpoints — there is no code path where revoking artist access removes the last admin.
- Grant is idempotent: a second grant on an already-granted user creates zero additional `ArtistProfile` rows and correctly unhides a profile that had been hidden by a prior revoke.
- The upload gate also blocks on a hidden profile, not just a missing one — this was a gap in the original bug report (only "no profile" was checked) that would have let a re-promoted-but-still-hidden artist hit the same dead end.

## Tests run

Backend: `cd backend && npm run test` equivalent (`prisma migrate`, seed, `vitest run`) — **9 test files, 118 tests, all passing**, including the new `backend/tests/artistAccess.test.js` (20 tests: non-admin rejection, idempotent grant, duplicate-profile prevention, admin-role profile grant without role change, self-service ensure-profile, role-change auto-create/opt-out/opt-in, revoke demotion and hiding, session revocation on/off, banned/deleted rejection, last-admin immunity, upload blocked→allowed after grant, blocked-when-hidden, re-grant unhides, list/detail field reflection, list filters).

Frontend: `npm run test` (vitest) — **24 test files, 102 tests, all passing**, including new coverage in `tests/components/AdminConsole.test.jsx` (Artist Access panel renders; missing-profile state visible; Grant Artist Access opens a modal that requires a reason; a successful grant updates the UI to reflect upload access; Create Artist Profile works for an eligible admin; a non-admin sees none of it; the panel never renders raw SQL/table/column names) and a new `tests/components/UploadFormArtistAccess.test.jsx` (friendly fallback instead of the raw error; self-service button shown only to an admin blocked by a missing profile and works; not shown to a non-admin or for a different block reason; normal form renders once access is granted).

`npm run lint` (oxlint) — 0 errors across the project. `npm run build` (vite) — succeeds; a pre-existing chunk-size advisory for `lucide-react` is unrelated to this change.

A genuine bug was caught by this test pass, not just exercised by it: `AdminPanel` (src/components/admin/AdminUI.jsx) did not forward arbitrary props to its underlying `<section>`, so the `data-testid="artist-access-panel"` added in the UI phase was silently dropped from the rendered DOM the entire time. Fixed by spreading `...rest` onto the section; this was the one real regression risk found once the panel was actually tested rather than just reviewed by eye. A second, smaller regression was caught the same way: the initial modal rewrite gave every confirm dialog an action-specific submit label, which silently broke the pre-existing generic "Confirm" label the suspend/ban/unsuspend/unban/revoke/role modals relied on (and a pre-existing test asserted on). That was reverted for the six pre-existing actions and kept only for the newly added artist-access actions, which needed distinct labels since several of them (Grant / Revoke / Create Profile / Hide / Unhide) would otherwise be indistinguishable behind one generic button.

E2E (Playwright) and Phase 13 production verification are addressed in `NOIRSOUND_UPLOAD_ACCESS_QA_REPORT.md`.

## Final verdict

**ARTIST ACCESS ADMIN READY**

All backend and frontend automated tests pass, the build and lint are clean, and every constraint in the ticket (no manual SQL, no bypassed upload safety, no weakened admin permissions, no raw database internals in the UI, no duplicate profiles, non-admins cannot grant roles, the last admin cannot be removed, every action is audited) is verified either by an automated test or by a structural guarantee in the code (e.g. `revokeArtistAccess` has no code path that touches an `ADMIN`'s role). This is not `ARTIST ACCESS PRODUCTION VERIFIED`: that tier requires exercising the full flow against the deployed production domain, and this sandbox has no deployed domain, no production credentials, and no way to install the OS-level libraries Playwright needs to drive a real browser (confirmed by attempting the install, not assumed — see the QA report). Someone with deploy access should run the Phase 13 smoke steps in that report before this is called production-verified.
