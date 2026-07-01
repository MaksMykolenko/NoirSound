# NoirSound ArtistProfile Auto-Create — Implementation Report

## Scope

This report covers specifically how and when a user's `ArtistProfile` row gets created automatically, the idempotency/race-safety guarantees around that creation, and every entry point that can trigger it. It complements `NOIRSOUND_ADMIN_ARTIST_ACCESS_REPORT.md`, which covers the endpoints and UI more broadly.

## Design decision: no schema migration

`ArtistProfile` already existed as a 1:1 optional relation to `User` (`userId` unique). The bug was never a missing column or table — it was that nothing in the product ever guaranteed the row got created when a user was made an artist by an admin (as opposed to going through self-serve artist onboarding, which did create one). So this pass adds *creation logic*, not schema. `defaultArtistProfileData(userId)` in `backend/src/lib/artistAccess.js` is the single place that defines what a freshly auto-created profile looks like (empty genres array, no bio/socials, `monthlyListeners: 0`, not hidden) — every auto-create path calls through this, so a profile created by an admin's grant action looks identical in shape to one created by any other flow.

## The core primitive: `ensureArtistProfile(client, userId)`

```
async function ensureArtistProfile(client, userId) {
  const existing = await client.artistProfile.findUnique({ where: { userId } });
  if (existing) return { profile: existing, created: false };
  try {
    const profile = await client.artistProfile.create({ data: defaultArtistProfileData(userId) });
    return { profile, created: true };
  } catch (err) {
    if (err.code === 'P2002') {
      // Another concurrent request won the race; read back what it created.
      const profile = await client.artistProfile.findUnique({ where: { userId } });
      if (profile) return { profile, created: false };
    }
    throw err;
  }
}
```

Every code path that might create a profile — grant-artist, ensure-artist-profile, set-role's auto-create, the self-service `/auth/me/ensure-artist-profile`, and the admin-only fallback still present in the upload route itself — goes through this one function. Two admins clicking "Grant Artist Access" on the same user at the same moment (or a grant racing a self-service ensure-profile call) cannot produce two `ArtistProfile` rows: the loser of the race hits Prisma's `P2002` unique-constraint violation on `userId` and re-reads the winner's row instead of erroring. This is verified directly by `backend/tests/artistAccess.test.js`'s "does not create a duplicate ArtistProfile on a repeated grant" test, which calls grant-artist twice and asserts exactly one `ArtistProfile` row exists and the second call is a reported no-op (`profileCreated: false`).

## Every entry point that can auto-create a profile

| Trigger | Endpoint | Default behavior | Opt-out / opt-in |
|---|---|---|---|
| Admin grants artist access | `POST /admin/users/:id/grant-artist` | Creates if missing | `createProfile: false` to skip |
| Admin explicitly ensures a profile | `POST /admin/users/:id/ensure-artist-profile` | Always creates if missing (that's the endpoint's whole job) | n/a — idempotent no-op if one exists |
| Admin promotes a user to `ARTIST` via role change | `POST /admin/users/:id/set-role` | Creates if missing | `createArtistProfile: false` to skip |
| Admin promotes a user to `ADMIN` via role change | `POST /admin/users/:id/set-role` | Does **not** create | `createArtistProfile: true` to opt in |
| Admin grants artist access to an existing `ADMIN` | `POST /admin/users/:id/grant-artist` | Creates if missing, **role stays `ADMIN`** | `createProfile: false` to skip |
| Signed-in admin self-service | `POST /auth/me/ensure-artist-profile` | Creates if missing | Refused entirely (403 `ADMIN_ONLY`) for non-admins |

The `ARTIST` vs `ADMIN` asymmetry on `set-role` is intentional: moving someone to `ARTIST` is almost always so they can upload, so auto-create defaults on; moving someone to `ADMIN` is an operational/trust decision unrelated to uploading, so a profile is only created if the admin explicitly asks for it via the checkbox. Granting *artist access* (as opposed to changing role) to an existing admin is different again — the ticket describes "a user can have `role = ARTIST` or `role = ADMIN` and still not be able to upload," so grant-artist treats an `ADMIN` target as already having the right role and just ensures the profile exists, without touching `role` at all.

## Re-grant after revoke: unhiding, not re-creating

`revokeArtistAccess` never deletes an `ArtistProfile` — it can optionally hide it. This matters for auto-create semantics: if an admin revokes, then later re-grants, `ensureArtistProfile` finds the existing (hidden) row and reports `created: false` — which is correct, but on its own it would leave the profile hidden and uploads would stay blocked despite the role being `ARTIST` again. `grantArtistAccess` accounts for this explicitly: after ensuring the profile exists, it separately checks `profile.isHidden` and unhides it as part of the same grant, reporting `profileUnhiddenNow: true` in its diff. This was caught during implementation (before it could ship as a silent bug) and has a dedicated regression test, "re-granting artist access unhides a previously hidden profile so uploads work again," which revokes, confirms the profile is hidden via a direct Prisma read, re-grants, and confirms both `artistProfileHidden: false` and a real upload succeeding afterward.

## What auto-create deliberately does not do

- It never changes a `LISTENER` into an `ARTIST` on its own — role changes always require an explicit admin action (grant-artist or set-role), never happen as a side effect of anything else.
- It never runs for a `BANNED` or `DELETED` user — `grant-artist`, `revoke-artist`, and `ensure-artist-profile` all check `target.status` first and return 409 (`ADMIN_USER_BANNED` / `ADMIN_USER_DELETED`) before touching anything.
- It never runs twice for the same user concurrently without converging on one row (see the `P2002` handling above).
- Self-service auto-create is scoped to `ADMIN` accounts only. A non-admin `ARTIST` who is missing a profile cannot create their own — the upload page tells them to contact an admin instead. This mirrors the ticket's instruction to keep self-service "narrow" and prevents a listener-turned-artist from using a client-side code path to grant themselves upload access without an admin's own action having created the `ARTIST` role in the first place.

## Test coverage

`backend/tests/artistAccess.test.js` (20 tests, all passing) covers this logic directly: grant creates exactly one profile and audits `ARTIST_PROFILE_CREATED`; a repeated grant does not duplicate; granting to an existing `ADMIN` creates a profile without changing role; `ensure-artist-profile` is a no-op the second time and is refused for non-admins; `set-role` to `ARTIST` auto-creates by default and skips when told to; `set-role` to `ADMIN` does not auto-create unless asked; the self-service endpoint works for an admin and is refused for everyone else. All of this also runs cleanly as part of the full backend suite (9 files, 118 tests) with no regressions to the pre-existing seed/role/session tests.
