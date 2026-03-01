import type { FastifyInstance } from 'fastify';

type ContactType = 'email' | 'phone';

export async function contactsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/sync',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Upload hashed contacts for matching',
        body: {
          type: 'object',
          required: ['contacts'],
          properties: {
            clearMissing: { type: 'boolean', default: false },
            contacts: {
              type: 'array',
              minItems: 0,
              maxItems: 5000,
              items: {
                type: 'object',
                required: ['type', 'hash'],
                properties: {
                  type: { type: 'string', enum: ['email', 'phone'] },
                  hash: {
                    type: 'string',
                    pattern: '^[A-Fa-f0-9]{64}$'
                  },
                  label: { type: 'string', minLength: 1, maxLength: 120 }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as {
        clearMissing?: boolean;
        contacts: Array<{
          type: ContactType;
          hash: string;
          label?: string;
        }>;
      };

      const data = await app.contactsService.syncContacts({
        userId: request.user.sub,
        contacts: body.contacts,
        clearMissing: body.clearMissing ?? false
      });

      return {
        success: true,
        data
      };
    }
  );

  app.get(
    '/matches',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Get users matched from synced contact hashes',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 30 }
          }
        }
      }
    },
    async (request) => {
      const query = (request.query as { limit?: number } | undefined) ?? {};
      const data = await app.contactsService.getMatchCandidates({
        userId: request.user.sub,
        limit: query.limit ?? 30
      });

      return {
        success: true,
        data
      };
    }
  );

  app.get(
    '/status',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Get synced contact hash status for current user'
      }
    },
    async (request) => {
      const data = await app.contactsService.getContactStatus(request.user.sub);
      return {
        success: true,
        data
      };
    }
  );
}
