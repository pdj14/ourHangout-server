import type { FastifyInstance } from 'fastify';

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/rooms/direct',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'Create or get direct 1:1 chat room',
        body: {
          type: 'object',
          required: ['peerUserId'],
          properties: {
            peerUserId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { peerUserId: string };
      const data = await app.chatService.createDirectRoom(request.user.sub, body.peerUserId);
      return { success: true, data };
    }
  );

  app.get(
    '/rooms',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'List direct rooms for authenticated user'
      }
    },
    async (request) => {
      const data = await app.chatService.listRooms(request.user.sub);
      return { success: true, data };
    }
  );

  app.get(
    '/rooms/:roomId/messages',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'List messages in room',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 30 },
            before: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const query = (request.query as { limit?: number; before?: string } | undefined) ?? {};

      const data = await app.chatService.listMessages({
        userId: request.user.sub,
        roomId: params.roomId,
        limit: query.limit ?? 30,
        before: query.before
      });

      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/messages',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'Send message in room',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 2000 }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const body = request.body as { content: string };

      const data = await app.chatService.sendMessage({
        roomId: params.roomId,
        senderId: request.user.sub,
        content: body.content
      });

      return { success: true, data };
    }
  );

  app.post(
    '/messages/:messageId/ack',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'ACK message as recipient',
        params: {
          type: 'object',
          required: ['messageId'],
          properties: {
            messageId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { messageId: string };
      await app.chatService.ackMessageByRecipient(params.messageId, request.user.sub);
      return { success: true };
    }
  );
}
