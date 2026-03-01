import type { FastifyInstance } from 'fastify';

export async function pairingRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/code',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pairing'],
        summary: 'Generate one-time pairing code',
        body: {
          type: 'object',
          properties: {
            ttlSeconds: { type: 'number', minimum: 30, maximum: 3600 },
            relationshipType: {
              type: 'string',
              enum: ['friend', 'parent_child'],
              default: 'friend'
            }
          }
        }
      }
    },
    async (request) => {
      const body =
        (request.body as { ttlSeconds?: number; relationshipType?: 'friend' | 'parent_child' } | undefined) ?? {};
      const data = await app.pairingService.createCode(
        request.user.sub,
        body.ttlSeconds,
        body.relationshipType ?? 'friend'
      );
      return { success: true, data };
    }
  );

  app.post(
    '/consume',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pairing'],
        summary: 'Consume one-time pairing code and create relationship',
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 6, maxLength: 6 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { code: string };
      const data = await app.pairingService.consumeCode(request.user.sub, body.code);
      return { success: true, data };
    }
  );

  app.get(
    '/relationships',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pairing'],
        summary: 'List relationships created by pairing and related room ids'
      }
    },
    async (request) => {
      const data = await app.pairingService.listRelationships(request.user.sub);
      return { success: true, data };
    }
  );
}
