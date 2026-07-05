const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');

async function reportsRoutes(fastify, _options) {
  // POST /api/reports
  fastify.post('/', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(20), timeWindow: '1 hour', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    const { targetType, targetId, reason, details } = request.body;

    if (!targetType || !targetId || !reason) {
      return reply.status(400).send({ error: 'Missing required fields: targetType, targetId, reason' });
    }

    const validTargetTypes = ['TRACK', 'COMMENT', 'USER', 'ARTIST', 'PLAYLIST'];
    if (!validTargetTypes.includes(targetType)) {
      return reply.status(400).send({ error: 'Invalid target type' });
    }

    const validReasons = [
      'COPYRIGHT',
      'LYRICS_COPYRIGHT',
      'LYRICS_OFFENSIVE',
      'LYRICS_INCORRECT',
      'SPAM',
      'HARASSMENT',
      'HATE',
      'NSFW',
      'OTHER'
    ];
    if (!validReasons.includes(reason)) {
      return reply.status(400).send({ error: 'Invalid reason' });
    }

    try {
      // Validate target exists
      let targetExists = false;
      switch (targetType) {
        case 'TRACK':
          targetExists = await fastify.prisma.track.count({ where: { id: targetId } }) > 0;
          break;
        case 'COMMENT':
          targetExists = await fastify.prisma.comment.count({ where: { id: targetId } }) > 0;
          break;
        case 'USER':
          targetExists = await fastify.prisma.user.count({ where: { id: targetId } }) > 0;
          break;
        case 'ARTIST':
          targetExists = await fastify.prisma.artistProfile.count({ where: { id: targetId } }) > 0;
          break;
        case 'PLAYLIST':
          targetExists = await fastify.prisma.playlist.count({ where: { id: targetId } }) > 0;
          break;
      }

      if (!targetExists) {
        return reply.status(404).send({ error: 'Target not found' });
      }

      // Check for duplicate recent report from same user on same target to prevent spam
      const existingReport = await fastify.prisma.report.findFirst({
        where: {
          reporterId: request.user.id,
          targetType,
          targetId,
          status: 'OPEN'
        }
      });

      if (existingReport) {
        return reply.status(409).send({ error: 'You have already reported this item and it is under review' });
      }

      const report = await fastify.prisma.report.create({
        data: {
          reporterId: request.user.id,
          targetType,
          targetId,
          reason,
          details: details ? details.substring(0, 500) : null
        }
      });

      return { report };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = reportsRoutes;
