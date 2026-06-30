const { userOrIpKey } = require('../lib/rateLimitKeys');
const { scaledRateLimitMax } = require('../lib/rateLimit');

async function commentsRoutes(fastify, _options) {
  // POST /api/comments/:id/replies
  fastify.post('/:id/replies', {
    preValidation: [fastify.authenticate],
    config: {
      rateLimit: { max: scaledRateLimitMax(30), timeWindow: '10 minutes', keyGenerator: userOrIpKey }
    }
  }, async (request, reply) => {
    const { text } = request.body;
    if (!text || text.length > 1000) {
      return reply.status(400).send({ error: 'Text is required and must be < 1000 chars' });
    }

    try {
      const parentComment = await fastify.prisma.comment.findUnique({
        where: { id: request.params.id },
        include: { track: true }
      });
      if (!parentComment || parentComment.isDeleted) {
        return reply.status(404).send({ error: 'Parent comment not found' });
      }

      const sanitizedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const replyComment = await fastify.prisma.comment.create({
        data: {
          trackId: parentComment.trackId,
          userId: request.user.id,
          parentId: parentComment.id,
          text: sanitizedText
        },
        include: {
          user: { select: { displayName: true, username: true, avatarUrl: true } }
        }
      });
      return { reply: replyComment };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /api/comments/:id/like
  fastify.post('/:id/like', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      await fastify.prisma.commentLike.upsert({
        where: {
          userId_commentId: {
            userId: request.user.id,
            commentId: request.params.id
          }
        },
        update: {},
        create: {
          userId: request.user.id,
          commentId: request.params.id
        }
      });
      
      // Update denormalized likes count
      await fastify.prisma.comment.update({
        where: { id: request.params.id },
        data: { likes: { increment: 1 } }
      });

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // DELETE /api/comments/:id/like
  fastify.delete('/:id/like', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      await fastify.prisma.commentLike.delete({
        where: {
          userId_commentId: {
            userId: request.user.id,
            commentId: request.params.id
          }
        }
      });

      await fastify.prisma.comment.update({
        where: { id: request.params.id },
        data: { likes: { decrement: 1 } }
      });

      return { success: true };
    } catch (error) {
      if (error.code === 'P2025') {
        return { success: true }; // Already deleted
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // DELETE /api/comments/:id
  fastify.delete('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    try {
      const comment = await fastify.prisma.comment.findUnique({
        where: { id: request.params.id }
      });

      if (!comment) {
        return reply.status(404).send({ error: 'Comment not found' });
      }

      if (comment.userId !== request.user.id && request.user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Soft delete: keep the record for replies but remove the text
      await fastify.prisma.comment.update({
        where: { id: request.params.id },
        data: {
          text: '[Deleted]',
          isDeleted: true
        }
      });

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = commentsRoutes;
