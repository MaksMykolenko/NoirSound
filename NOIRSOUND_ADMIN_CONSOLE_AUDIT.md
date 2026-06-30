# NoirSound Admin Console Audit

Date: 2026-06-30

## Baseline found

Before this pass, `backend/src/routes/admin.js` exposed:

- report list/detail and report resolution;
- track hide/unhide;
- comment hide/unhide;
- user suspend/unsuspend with session revocation;
- audit-log list;
- three summary counters.

All routes already used `authenticate` followed by `requireAdmin`. Global cookie-origin CSRF validation covered mutations. The public track list, detail, comments, cover, and stream routes already required `PUBLISHED` tracks owned by active users.

Prisma already contained `UserRole`, `UserStatus`, `TrackStatus`, `UploadStatus`, `ReportStatus`, `Report`, `ModerationDecision`, and `AuditLog`. Existing moderation mutations wrote audit entries. The original UI was one `/admin` page with reports, a few direct actions, and a flat audit list.

## Baseline gaps

- No overview, user/track/upload/artist/comment list APIs, pagination, search, or detail contracts.
- No ban/unban, role changes, session revocation action, track rejection/restore/reprocessing, upload retry/cancel, artist visibility, report rejection/escalation, audit detail/filtering, or system status.
- Mutation reasons were optional on several endpoints.
- No admin-specific mutation rate limit.
- Audit rows were deleted by a cascading actor relation.
- Upload object keys and operational status had no admin-safe serializer.
- Artist visibility was not modeled or enforced by public routes.
- The UI had no routed layout, list pages, detail views, filters, pagination, system page, or confirmation modal.
- Admin UI copy was hardcoded in English.

## Implemented API surface

All paths are under `/api/admin`.

- `GET /overview`
- `GET /users`, `GET /users/:id`, `PATCH /users/:id`
- `POST /users/:id/suspend|unsuspend|ban|unban|revoke-sessions|set-role`
- `GET /tracks`, `GET /tracks/:id`
- `POST /tracks/:id/hide|unhide|reject|restore|force-reprocess`
- `GET /uploads`, `GET /uploads/:id`
- `POST /uploads/:id/retry|cancel`
- `GET /artists`, `GET /artists/:id`
- `POST /artists/:id/hide|unhide`
- `GET /comments`, `GET /comments/:id`
- `POST /comments/:id/hide|unhide`
- `GET /reports`, `GET /reports/:id`
- `POST /reports/:id/resolve|reject|escalate`
- `GET /audit-logs`, `GET /audit-logs/:id`
- `GET /system`

`GET /summary` remains as a compatibility endpoint.

## Schema changes

- `ArtistProfile.isHidden` provides reversible artist-page visibility.
- `UploadStatus.CANCELLED` distinguishes safe cancellation from failure.
- `ReportStatus.ESCALATED` supports moderation escalation.
- `AuditLog.actorId` is nullable with `ON DELETE SET NULL`, so audit history survives actor-account removal.

## Audit behavior

The console records user profile/status/role/session mutations, track visibility/rejection/reprocessing, upload retries/cancellation, artist visibility, comment visibility, report decisions/escalation, and report-linked target actions. Multi-row state changes and audit creation use Prisma transactions.

## Public-state enforcement

- Hidden tracks remain unavailable from list/detail/cover/comments/stream routes.
- Hidden artists are excluded from artist pages, artist tracks, catalog, playlists, stats, metadata pages, public cover routes, and streaming.
- Suspended/banned/deleted users fail authentication; suspend/ban also revokes sessions.

## Remaining gaps

- A real Redis, object-storage, and audio-worker environment is required to complete the full upload/reprocess E2E flow.
- Storage-provider total usage and backup freshness are unavailable; the UI reports them as unavailable instead of fabricating data.
- Production deployment and production admin smoke verification were not authorized or available in this workspace pass.
