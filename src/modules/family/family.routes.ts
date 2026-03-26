import type { FastifyInstance } from 'fastify';

export async function familyRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/upgrade-requests',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'Create family upgrade request from an existing friend',
        body: {
          type: 'object',
          required: ['targetUserId'],
          properties: {
            targetUserId: { type: 'string', format: 'uuid' },
            note: { type: 'string', maxLength: 300 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as {
        targetUserId: string;
        note?: string;
      };
      const data = await app.familyService.createUpgradeRequest({
        requesterId: request.user.sub,
        targetUserId: body.targetUserId,
        note: body.note
      });
      return { success: true, data };
    }
  );

  app.get(
    '/upgrade-requests',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'List pending incoming/outgoing family upgrade requests'
      }
    },
    async (request) => {
      const data = await app.familyService.listUpgradeRequests(request.user.sub);
      return { success: true, data };
    }
  );

  app.post(
    '/upgrade-requests/:requestId/accept',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'Accept a family upgrade request',
        params: {
          type: 'object',
          required: ['requestId'],
          properties: {
            requestId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { requestId: string };
      const data = await app.familyService.acceptUpgradeRequest(request.user.sub, params.requestId);
      return { success: true, data };
    }
  );

  app.post(
    '/upgrade-requests/:requestId/reject',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'Reject a family upgrade request',
        params: {
          type: 'object',
          required: ['requestId'],
          properties: {
            requestId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { requestId: string };
      const data = await app.familyService.rejectUpgradeRequest(request.user.sub, params.requestId);
      return { success: true, data };
    }
  );

  app.post(
    '/upgrade-requests/:requestId/cancel',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'Cancel an outgoing family upgrade request',
        params: {
          type: 'object',
          required: ['requestId'],
          properties: {
            requestId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { requestId: string };
      const data = await app.familyService.cancelUpgradeRequest(request.user.sub, params.requestId);
      return { success: true, data };
    }
  );

  app.get(
    '/links',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'List active family links for the current user'
      }
    },
    async (request) => {
      const data = await app.familyService.listLinks(request.user.sub);
      return { success: true, data };
    }
  );

  app.delete(
    '/links/:relationshipId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'Remove an active family link and keep the friend connection',
        params: {
          type: 'object',
          required: ['relationshipId'],
          properties: {
            relationshipId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { relationshipId: string };
      const data = await app.familyService.removeLink(request.user.sub, params.relationshipId);
      return { success: true, data };
    }
  );

  app.get(
    '/groups/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'List family groups the current user belongs to'
      }
    },
    async (request) => {
      const data = await app.familyService.getMyGroups(request.user.sub);
      return { success: true, data };
    }
  );

  app.get(
    '/groups/:familyGroupId/permissions',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['family'],
        summary: 'List family service permissions for a family group',
        params: {
          type: 'object',
          required: ['familyGroupId'],
          properties: {
            familyGroupId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { familyGroupId: string };
      const data = await app.familyService.listGroupPermissions(request.user.sub, params.familyGroupId);
      return { success: true, data };
    }
  );
}
