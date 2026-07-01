# NoirSound Artist Access Admin — Audit

Date: 2026-07-01

## Root cause

`backend/src/routes/uploads.js` (`POST /api/uploads/track/init`, line ~124) looks up `ArtistProfile` by `userId`. If none exists **and** `request.user.role === 'ADMIN'`, it silently creates a bare profile on the spot. For every other role — including `ARTIST` — a missing profile returns:

```
422 { "error": "An ArtistProfile is required before uploading tracks." }
```

There has never been an admin-facing way to create that row. The only fix available to operators has been a manual `INSERT INTO "ArtistProfile"`, which is exactly what this pass replaces.

## `User.role` today

`UserRole` enum (`backend/prisma/schema.prisma`): `LISTENER | ARTIST | ADMIN`. **There is no `PLAYER` value in the schema.** The ticket's "PLAYER" is treated throughout this pass as the existing `LISTENER` role — "PLAYER → ARTIST" means `LISTENER → ARTIST`, and revoking artist access demotes `ARTIST` back to `LISTENER`.

`role` gates two independent things:
- Route-level authorization (`requireAdmin` checks `role === 'ADMIN'`; upload-init checks `role in [ARTIST, ADMIN]`).
- Nothing else — it does **not** by itself guarantee an `ArtistProfile` exists, which is the bug.

`status` (`UserStatus`: `ACTIVE | SUSPENDED | BANNED | DELETED`) is enforced in `plugins/auth.js#authenticate`: any non-`ACTIVE` user fails authentication outright (401), independent of role.

## How `ArtistProfile` is created today

Two paths, both narrow:
1. `POST /api/uploads/track/init` auto-creates an empty profile **only** when `role === 'ADMIN'` and none exists (`backend/src/routes/uploads.js:128-133`).
2. Manual SQL by an operator (the problem this ticket fixes).

There is no route that creates a profile for an `ARTIST`-role user. Registration (`POST /api/auth/register`) never creates one either — new users always start as `LISTENER` with no profile.

`ArtistProfile` schema already has every field the ticket needs, so **no migration is required**:

```prisma
model ArtistProfile {
  id               String   @id @default(uuid())
  userId           String   @unique
  isHidden         Boolean  @default(false)
  monthlyListeners Int      @default(0)
  genres           String[]
  socialLinks      Json?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

`userId` is `@unique`, so the DB itself prevents duplicates (`P2002` on a race); application code additionally checks-before-create.

## Why upload requires `ArtistProfile`

`Track.artistId` is a required foreign key to `ArtistProfile.id` (not to `User.id`). A track cannot exist without an artist profile to hang off of — `monthlyListeners`, `genres`, `socialLinks`, follower relations, and the public artist page all key off `ArtistProfile`, not `User`. Removing the requirement (as the ticket forbids) would break `Track.artist` and the entire public artist surface.

## Where upload currently checks `ArtistProfile`

Single call site: `backend/src/routes/uploads.js`, `POST /track/init`, lines 124-138. `POST /track/:uploadId/complete` and `GET /track/:uploadId/status` do not re-check (they operate on an already-created `Upload`/`Track` row).

## Current admin user-management endpoints

`backend/src/routes/admin.js` already implements a full moderation console (shipped in a prior pass — see `NOIRSOUND_ADMIN_CONSOLE_AUDIT.md`). Relevant surface:

- `GET /api/admin/users`, `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id`
- `POST /api/admin/users/:id/suspend|unsuspend|ban|unban|revoke-sessions|set-role`
- `POST /api/admin/artists/:id/hide|unhide` (artist-profile-id-keyed, not user-id-keyed)
- Shared guards: `adminReadOptions`/`adminMutationOptions` (`fastify.authenticate` + `fastify.requireAdmin`, plus per-route rate limiting on mutations) in `backend/src/lib/adminGuard.js`.
- Shared audit helpers: `auditData`/`createAudit`/`redactAuditMetadata` in `backend/src/lib/auditLog.js`, backed by the existing `AuditLog` model.
- `set-role` already refuses to demote the last active `ADMIN` (`ADMIN_LAST_ADMIN`, 409) — the "don't remove the last admin" safeguard this ticket also requires already exists and this pass must not weaken it.
- Session revocation = `prisma.session.deleteMany({ where: { userId } })` (JWT carries an opaque `sid`; deleting the row invalidates the still-unexpired cookie on next request — see `plugins/auth.js`).
- None of the above endpoints touch `ArtistProfile` creation, and none report upload-readiness.

## Current admin UI gaps

`src/pages/admin/AdminUserDetail.jsx` shows account info, activity counters, a track list (only if a profile already exists), a danger zone (suspend/ban/revoke/role select), and audit history. It has:
- No artist-access section, no `ArtistProfile` existence/hidden indicator, no "can upload" signal.
- `set-role` is exposed via a bare `<select>` + button with **no** side-effect options (no profile auto-create, no session-revoke choice).

`src/pages/admin/AdminUsers.jsx` table shows user/email/role/status/updated/tracks/reports/actions — no artist-profile or upload-access column, and no filter for either.

`src/pages/Upload.jsx` → `src/components/upload/UploadForm.jsx` gates only on `role` (line 143: `!['ARTIST','ADMIN'].includes(user.role)` → "Creator access required" message). If role passes but the profile is missing, the form renders normally and the raw backend string (`"An ArtistProfile is required before uploading tracks."`) surfaces verbatim via `setErrorMsg(err.message)` on submit — this is the exact UX gap Phase 8 must close.

`GET /api/auth/me` returns `artistProfileId` (nullable) but no `hasArtistProfile`/`canUploadTracks`/`uploadAccessReason`, so the client cannot pre-emptively show a friendly state before the user attempts an upload.

## Design decisions for this pass

1. **No schema migration.** Every field the ticket needs already exists.
2. **Terminology:** "PLAYER" in the ticket = `LISTENER` in the schema/UI.
3. **Self-service scope:** an open `/artist/setup` that lets any `LISTENER` self-grant a profile would undercut the admin-gated model this entire ticket builds ("Do NOT weaken admin permissions", "Do NOT bypass upload safety"). This pass therefore only exposes self-service profile creation to a user who is **already `ADMIN`** creating their own profile on the Upload page (this mirrors the auto-create behavior that already exists silently in `uploads.js` for admins — it is made visible and explicit, not new privilege). Everyone else (including `ARTIST` with no profile, an anomalous pre-existing-bug state) sees a contact-admin message inline. No new `/artist/setup` route is added since it would be dead surface for the only audience allowed to use it.
4. **Audit action names:** the ticket's Phase 11 list overlaps with action names already shipped and already displayed in the Artists/Users admin UI. To avoid fragmenting one logical change (e.g. "a profile got hidden") across two different action strings depending on which screen triggered it, granular sub-effects reuse the existing canonical names — `USER_SET_ROLE`, `USER_REVOKE_SESSIONS`, `ARTIST_HIDE`, `ARTIST_UNHIDE` — and three genuinely new actions are added for operations that did not exist before: `USER_GRANT_ARTIST`, `USER_REVOKE_ARTIST`, `ARTIST_PROFILE_CREATED`. Every mutation still writes one audit row per real side effect (matching the existing multi-row pattern already used by `decideReport`), so nothing is under-logged — see the audit report for the full mapping.
5. **Idempotency over strict state-machine errors:** existing single-purpose toggles (`/artists/:id/hide`) 409 if already in that state. The new grant/revoke/ensure endpoints are composite and must be safely repeatable (explicit test requirement: "duplicate grant does not create duplicate profile"), so they succeed (200) and report the resulting state rather than erroring when called twice.
6. **Banned/deleted targets:** granting artist access to a `BANNED`/`DELETED` user is refused (409) rather than silently reactivating them — un-banning is a distinct, deliberate action and must not be a side effect of a role/profile grant.

## Verification environment

No live Postgres/Redis/object storage is available by default in this workspace and there is no root/Docker access to install one. This pass uses the `embedded-postgres` npm package (a real, unmodified PostgreSQL binary that runs as the current user, no root required) purely as an ephemeral **test** database, so the actual backend integration suite (`cd backend && npm run test`, including `prisma migrate reset` + demo seed) can run against a genuine Postgres rather than being skipped. Results are in `NOIRSOUND_UPLOAD_ACCESS_QA_REPORT.md`. No deployed production domain or credentials are available in this environment, so Phase 13's literal production smoke test could not be executed here — see that report for what remains for the user to do after deploy.
