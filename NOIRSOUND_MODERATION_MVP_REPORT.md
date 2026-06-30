# NoirSound — Moderation MVP Report (Phase 7)

Date: 2026-06-28

## Backend (`backend/src/routes/admin.js`, prefix `/api/admin`)
All routes require `[authenticate, requireAdmin]` (new `requireAdmin` decorator in `plugins/auth.js`). Every state-changing action writes an **`AuditLog`** row.

| Endpoint | Purpose |
|---|---|
| `GET /admin/reports?status=` | List reports (filter OPEN/REVIEWED/ACTION_TAKEN/DISMISSED) |
| `GET /admin/reports/:id` | Report detail + decision |
| `POST /admin/reports/:id/resolve` | Resolve (ACTION_TAKEN/DISMISSED/REVIEWED) + ModerationDecision |
| `POST /admin/tracks/:id/hide` · `/unhide` | Flip PUBLISHED ↔ HIDDEN |
| `POST /admin/comments/:id/hide` · `/unhide` | Soft-hide/restore a comment |
| `POST /admin/users/:id/suspend` · `/unsuspend` | Suspend (+revoke all sessions) / restore |
| `GET /admin/audit-logs` | Recent moderation actions |
| `GET /admin/summary` | Counters (open reports, hidden tracks, suspended users) |

Effects:
- **Hide track** → `HIDDEN`, so it leaves catalog/discover and the stream returns 404 (Phase 6).
- **Hide comment** → `isDeleted=true`, text replaced; the original is retained in the hide audit metadata so a safe unhide restores it.
- **Suspend user** → `SUSPENDED` + all sessions deleted, so login/session/upload/comment actions are blocked immediately (auth status check). Self-suspend and suspending admins are refused.
- **Resolve report** → status + `reviewedAt`/`reviewedById` + `ModerationDecision` upsert.

## Schema
- Added **`AuditLog`** model + migration `prisma/migrations/20260628160000_public_beta_moderation/migration.sql`. `prisma validate` passes. **Action required:** run `npx prisma migrate deploy` (prod) / `migrate dev` (local) — done automatically by the production compose backend command and CI.
- Reused existing `Report`, `ModerationDecision`, `UserStatus`, `TrackStatus.HIDDEN`.

## Reports / abuse flow
- `POST /api/reports` (already present) validates target/reason, dedupes OPEN reports, caps details, **now rate-limited** (20/h).
- **User-facing report UI:** `src/components/ui/ReportButton.jsx` (reason modal) wired into the Track page (track reports); reusable for comments/users/playlists.

## Frontend (`src/pages/Admin.jsx`, route `/admin`)
- Admin-only (renders an "Admins only" empty state otherwise).
- Summary cards; Reports tab (status filter, per-target Hide/Suspend, Action-taken/Dismiss); Audit-log tab. Polished loading/empty/error states. Admin link added to the sidebar for ADMIN users. No fake reports — all data is live from the API.

| Requirement | Status |
|---|---|
| admin-only role checks | PASS |
| actions write audit log | PASS |
| hide track removes from catalog/discover/stream | PASS |
| hide comment removes from discussion | PASS |
| suspend blocks login/session/uploads/comments | PASS |
| report status pending/resolved/rejected | PASS (OPEN/ACTION_TAKEN/DISMISSED/REVIEWED) |
| reason fields where appropriate | PASS |
| user-facing report flow | PASS (track; reusable) |
| Admin page + lists + actions + audit viewer + empty states | PASS |

## Final verification record

- **What was inspected:** report creation/review, track/comment hide/unhide, suspension, role gates, audit durability, public effects, and Admin UI.
- **What was implemented:** state changes and audit rows are now atomic transactions; comment unhide restores original text; suspension revokes sessions.
- **What was tested:** migrations applied; non-admin 403; report/hide/catalog/detail/stream/audit E2E; suspension/session/re-login/unsuspend E2E; backend status tests.
- **What could not be tested:** moderator staffing/response-time process.
- **Exact commands:** `(cd backend && npm run test && npx prisma migrate status)`; `npx playwright test tests/e2e/public-beta-moderation.spec.js`; `npm run test:e2e`.
- **Exact blockers:** none.
- **Remaining risks:** audit rows cascade if the actor user is hard-deleted; production retention/export policy should be defined.
- **Files changed:** Prisma schema/migration; admin/report/auth/track routes; `src/pages/Admin.jsx`; moderation API; `ReportButton.jsx`; Track page; moderation E2E.

## Status: PASS
