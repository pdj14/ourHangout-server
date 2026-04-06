import type { FastifyInstance } from 'fastify';

export async function pobiRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pobis'],
        summary: 'List current user Pobi companions'
      }
    },
    async (request) => {
      const data = await app.pobiService.listPobis(request.user.sub);
      return { success: true, data };
    }
  );

  app.post(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pobis'],
        summary: 'Create a new user-owned Pobi',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 40 },
            theme: { type: 'string', minLength: 1, maxLength: 32 },
            status: { type: 'string', maxLength: 200 },
            avatarUri: { type: 'string', maxLength: 1024 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { name: string; theme?: string; status?: string; avatarUri?: string };
      const data = await app.pobiService.createPobi(request.user.sub, body);
      return { success: true, data };
    }
  );

  app.patch(
    '/:pobiId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pobis'],
        summary: 'Update Pobi settings',
        params: {
          type: 'object',
          required: ['pobiId'],
          properties: {
            pobiId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 40 },
            theme: { type: 'string', minLength: 1, maxLength: 32 },
            status: { type: 'string', maxLength: 200 },
            avatarUri: { type: 'string', maxLength: 1024 },
            setDefault: { type: 'boolean' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { pobiId: string };
      const body =
        (request.body as { name?: string; theme?: string; status?: string; avatarUri?: string; setDefault?: boolean } | undefined) ?? {};
      const data = await app.pobiService.updatePobi(request.user.sub, params.pobiId, body);
      return { success: true, data };
    }
  );

  app.delete(
    '/:pobiId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pobis'],
        summary: 'Delete a Pobi and remove its room/OpenClaw bindings',
        params: {
          type: 'object',
          required: ['pobiId'],
          properties: {
            pobiId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { pobiId: string };
      const data = await app.pobiService.deletePobi(request.user.sub, params.pobiId);
      return { success: true, data };
    }
  );

  app.post(
    '/:pobiId/direct-room',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pobis'],
        summary: 'Create or get direct room with selected Pobi',
        params: {
          type: 'object',
          required: ['pobiId'],
          properties: {
            pobiId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { pobiId: string };
      const data = await app.pobiService.createOrGetDirectRoom(request.user.sub, params.pobiId);
      return { success: true, data };
    }
  );

  app.get(
    '/:pobiId/openclaw',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pobis'],
        summary: 'Get Pobi-specific OpenClaw connection info',
        params: {
          type: 'object',
          required: ['pobiId'],
          properties: {
            pobiId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { pobiId: string };
      const data = await app.pobiService.getOpenClawInfo(request.user.sub, params.pobiId);
      return { success: true, data };
    }
  );

  app.post(
    '/:pobiId/openclaw/pairings',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pobis'],
        summary: 'Create or get a reusable OpenClaw pairing code for a Pobi',
        params: {
          type: 'object',
          required: ['pobiId'],
          properties: {
            pobiId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            ttlSeconds: { type: 'number', minimum: 60, maximum: 3600 }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { pobiId: string };
      const body = (request.body as { ttlSeconds?: number } | undefined) ?? {};
      const data = await app.pobiService.createOpenClawPairing(request.user.sub, params.pobiId, body.ttlSeconds);
      return { success: true, data };
    }
  );

  app.delete(
    '/:pobiId/openclaw',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['pobis'],
        summary: 'Disconnect the current OpenClaw device from a Pobi while keeping its reusable pairing code',
        params: {
          type: 'object',
          required: ['pobiId'],
          properties: {
            pobiId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { pobiId: string };
      const data = await app.pobiService.disconnectOpenClaw(request.user.sub, params.pobiId);
      return { success: true, data };
    }
  );
}
