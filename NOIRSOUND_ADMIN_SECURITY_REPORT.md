# NoirSound Admin Security Report

Date: 2026-06-30

## Authorization

- Every `/api/admin/*` route runs `authenticate` and `requireAdmin`.
- Authentication re-reads the server-side session and current user record.
- Suspended, banned, deleted, missing, expired, or revoked sessions are rejected.
- The frontend guard improves UX but is not treated as an authorization boundary.

## Request integrity and abuse controls

- Global same-origin/allowlisted-origin CSRF validation remains enabled.
- Admin mutations have a per-user/IP limit of 60 actions per 10 minutes, with production limits not affected by local test multipliers.
- Search strings are control-character stripped, whitespace normalized, trimmed, and length capped.
- Enums, pagination, sort fields, status transitions, reasons, and explicit role confirmation are validated.
- Unexpected admin errors use `ADMIN_INTERNAL_ERROR`; stack traces and raw dependency errors are not returned.

## Destructive-action safeguards

- No admin hard-delete endpoint was added.
- Track, artist, comment, and user actions use reversible statuses.
- Reasons are required server-side for mutations and in the UI confirmation dialog.
- Self suspend/ban is blocked.
- Admin accounts cannot be suspended/banned until their role is changed.
- The last active admin cannot be demoted.
- Suspend/ban and admin-role removal revoke sessions.
- Active/completed upload jobs cannot be cancelled.
- Reprocessing requires a failed/rejected track, a safe upload status, and an existing original object.

## Audit integrity

- Supported mutations write an audit row inside the state-change transaction.
- Report target actions and report decisions create separate audit events.
- Audit metadata is recursively redacted for secret/token/password/database URL/storage-key/signed-URL field names.
- No update/delete audit API exists.
- Actor deletion now sets `actorId` to null instead of cascading audit-row deletion.

## Data exposure controls

- User password hashes and session tokens are never selected.
- Upload URLs and raw object keys are removed; only a masked filename reference is returned.
- Track detail returns a boolean stream-availability signal, not a signed URL.
- System configuration returns presence/state values only.
- Commit identifiers are accepted only as hexadecimal values and truncated.
- Browser and API tests found no database URL, JWT/cookie secret, storage key, or signed URL exposure.

## Public enforcement

- Track availability requires `PUBLISHED`, active owner, and visible artist.
- Hidden artists are excluded from all audited public surfaces.
- User restrictions are enforced by authentication and immediate server-side session deletion.

## Remaining security work

- Run production smoke against the deployed origin/CORS/CSRF configuration.
- Consider step-up authentication or mandatory two-person approval for admin role changes in a future high-risk operations phase.
- Add external retention/export monitoring if audit logs become a regulatory record.
- Exercise retry/reprocessing against the real queue and object store before enabling those actions in production.
