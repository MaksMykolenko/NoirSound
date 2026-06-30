'use strict';

/**
 * Admin / moderation routes. Every route requires an authenticated ADMIN.
 * Every state-changing action writes an AuditLog row.
 */
async function adminRoutes(fastify) {
  const adminOnly = { preValidation: [fastify.authenticate, fastify.requireAdmin] };

  function auditData(actorId, action, targetType, targetId, reason, metadata) {
    return {
      actorId,
      action,
      targetType,
      targetId,
      reason: reason || null,
      metadata: metadata || null
    };
  }

  // --- Reports ---------------------------------------------------------------

  // GET /api/admin/reports?status=OPEN
  fastify.get('/reports', adminOnly, async (request, reply) => {
    const { status } = request.query || {};
    const where = {};
    if (status) {
      const valid = ['OPEN', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN'];
      if (!valid.includes(status)) {
        return reply.status(400).send({ error: 'Invalid status filter' });
      }
      where.status = status;
    }
    const reports = await fastify.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reporter: { select: { id: true, username: true, displayName: true } },
        decision: true
      }
    });
    return { data: reports };
  });

  // GET /api/admin/reports/:id
  fastify.get('/reports/:id', adminOnly, async (request, reply) => {
    const report = await fastify.prisma.report.findUnique({
      where: { id: request.params.id },
      include: {
        reporter: { select: { id: true, username: true, displayName: true } },
        decision: true
      }
    });
    if (!report) return reply.status(404).send({ error: 'Report not found' });
    return { report };
  });

  // POST /api/admin/reports/:id/resolve  body: { action: 'ACTION_TAKEN'|'DISMISSED', notes? }
  fastify.post('/reports/:id/resolve', adminOnly, async (request, reply) => {
    const { action, notes } = request.body || {};
    const valid = ['ACTION_TAKEN', 'DISMISSED', 'REVIEWED'];
    if (!valid.includes(action)) {
      return reply.status(400).send({ error: 'action must be one of ACTION_TAKEN, DISMISSED, REVIEWED' });
    }
    const report = await fastify.prisma.report.findUnique({ where: { id: request.params.id } });
    if (!report) return reply.status(404).send({ error: 'Report not found' });

    const updated = await fastify.prisma.$transaction(async (tx) => {
      const r = await tx.report.update({
        where: { id: report.id },
        data: { status: action, reviewedAt: new Date(), reviewedById: request.user.id }
      });
      await tx.moderationDecision.upsert({
        where: { reportId: report.id },
        update: { adminId: request.user.id, actionTaken: action, notes: notes || null },
        create: { reportId: report.id, adminId: request.user.id, actionTaken: action, notes: notes || null }
      });
      await tx.auditLog.create({
        data: auditData(
          request.user.id,
          'REPORT_RESOLVE',
          'REPORT',
          report.id,
          action,
          { notes: notes || null }
        )
      });
      return r;
    });
    return { report: updated };
  });

  // --- Tracks ----------------------------------------------------------------

  async function setTrackHidden(request, reply, hidden) {
    const track = await fastify.prisma.track.findUnique({ where: { id: request.params.id } });
    if (!track) return reply.status(404).send({ error: 'Track not found' });
    const newStatus = hidden ? 'HIDDEN' : 'PUBLISHED';
    // Only flip between PUBLISHED <-> HIDDEN; never resurrect drafts/failed.
    if (!hidden && track.status !== 'HIDDEN') {
      return reply.status(409).send({ error: `Track is not hidden (status ${track.status}).` });
    }
    if (hidden && !['PUBLISHED', 'HIDDEN'].includes(track.status)) {
      return reply.status(409).send({ error: `Only published tracks can be hidden (status ${track.status}).` });
    }
    const reason = (request.body && request.body.reason) || null;
    const updated = await fastify.prisma.$transaction(async (tx) => {
      const changed = await tx.track.update({
        where: { id: track.id },
        data: { status: newStatus }
      });
      await tx.auditLog.create({
        data: auditData(
          request.user.id,
          hidden ? 'TRACK_HIDE' : 'TRACK_UNHIDE',
          'TRACK',
          track.id,
          reason
        )
      });
      return changed;
    });
    return { track: { id: updated.id, status: updated.status } };
  }

  fastify.post('/tracks/:id/hide', adminOnly, (req, reply) => setTrackHidden(req, reply, true));
  fastify.post('/tracks/:id/unhide', adminOnly, (req, reply) => setTrackHidden(req, reply, false));

  // --- Comments --------------------------------------------------------------

  async function setCommentHidden(request, reply, hidden) {
    const comment = await fastify.prisma.comment.findUnique({ where: { id: request.params.id } });
    if (!comment) return reply.status(404).send({ error: 'Comment not found' });
    if (hidden && comment.isDeleted) {
      return reply.status(409).send({ error: 'Comment is already hidden or deleted.' });
    }
    if (!hidden && !comment.isDeleted) {
      return reply.status(409).send({ error: 'Comment is not hidden.' });
    }

    let originalText = null;
    if (!hidden) {
      const hideAudit = await fastify.prisma.auditLog.findFirst({
        where: {
          action: 'COMMENT_HIDE',
          targetType: 'COMMENT',
          targetId: comment.id
        },
        orderBy: { createdAt: 'desc' }
      });
      originalText = hideAudit?.metadata?.originalText;
      if (typeof originalText !== 'string' || !originalText) {
        return reply.status(409).send({
          error: 'The original comment text is unavailable; this comment cannot be restored safely.'
        });
      }
    }

    const reason = (request.body && request.body.reason) || null;
    const updated = await fastify.prisma.$transaction(async (tx) => {
      const changed = await tx.comment.update({
        where: { id: comment.id },
        data: hidden
          ? { isDeleted: true, text: '[Removed by moderator]' }
          : { isDeleted: false, text: originalText }
      });
      await tx.auditLog.create({
        data: auditData(
          request.user.id,
          hidden ? 'COMMENT_HIDE' : 'COMMENT_UNHIDE',
          'COMMENT',
          comment.id,
          reason,
          hidden ? { originalText: comment.text } : null
        )
      });
      return changed;
    });
    return { comment: { id: updated.id, isDeleted: updated.isDeleted } };
  }

  fastify.post('/comments/:id/hide', adminOnly, (req, reply) => setCommentHidden(req, reply, true));
  fastify.post('/comments/:id/unhide', adminOnly, (req, reply) => setCommentHidden(req, reply, false));

  // --- Users -----------------------------------------------------------------

  // POST /api/admin/users/:id/suspend  body: { reason? }
  fastify.post('/users/:id/suspend', adminOnly, async (request, reply) => {
    const target = await fastify.prisma.user.findUnique({ where: { id: request.params.id } });
    if (!target) return reply.status(404).send({ error: 'User not found' });
    if (target.id === request.user.id) {
      return reply.status(400).send({ error: 'You cannot suspend yourself.' });
    }
    if (target.role === 'ADMIN') {
      return reply.status(403).send({ error: 'Admins cannot be suspended via this endpoint.' });
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { status: 'SUSPENDED' } });
      // Revoke all of the suspended user's sessions immediately.
      await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.auditLog.create({
        data: auditData(
          request.user.id,
          'USER_SUSPEND',
          'USER',
          target.id,
          (request.body && request.body.reason) || null
        )
      });
    });
    return { user: { id: target.id, status: 'SUSPENDED' } };
  });

  // POST /api/admin/users/:id/unsuspend
  fastify.post('/users/:id/unsuspend', adminOnly, async (request, reply) => {
    const target = await fastify.prisma.user.findUnique({ where: { id: request.params.id } });
    if (!target) return reply.status(404).send({ error: 'User not found' });
    if (target.status !== 'SUSPENDED') {
      return reply.status(409).send({ error: `User is not suspended (status ${target.status}).` });
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { status: 'ACTIVE' } });
      await tx.auditLog.create({
        data: auditData(
          request.user.id,
          'USER_UNSUSPEND',
          'USER',
          target.id,
          (request.body && request.body.reason) || null
        )
      });
    });
    return { user: { id: target.id, status: 'ACTIVE' } };
  });

  // --- Audit log -------------------------------------------------------------

  // GET /api/admin/audit-logs
  fastify.get('/audit-logs', adminOnly, async () => {
    const logs = await fastify.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { id: true, username: true, displayName: true } } }
    });
    return { data: logs };
  });

  // GET /api/admin/summary — small dashboard counters
  fastify.get('/summary', adminOnly, async () => {
    const [openReports, hiddenTracks, suspendedUsers] = await Promise.all([
      fastify.prisma.report.count({ where: { status: 'OPEN' } }),
      fastify.prisma.track.count({ where: { status: 'HIDDEN' } }),
      fastify.prisma.user.count({ where: { status: 'SUSPENDED' } })
    ]);
    return { openReports, hiddenTracks, suspendedUsers };
  });
}

module.exports = adminRoutes;
