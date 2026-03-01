import type { FastifyInstance } from 'fastify';

export async function botRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['bots'],
        summary: 'List available in-app bots'
      }
    },
    async () => {
      const data = await app.botService.listBots();
      return { success: true, data };
    }
  );

  app.post(
    '/:botId/rooms',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['bots'],
        summary: 'Create or get direct room with selected bot',
        params: {
          type: 'object',
          required: ['botId'],
          properties: {
            botId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { botId: string };
      const data = await app.botService.createOrGetRoomWithBot(request.user.sub, params.botId);
      return { success: true, data };
    }
  );
}