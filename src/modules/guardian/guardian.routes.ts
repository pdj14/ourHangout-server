import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';
import {
  buildGuardianConsoleJwtPayload,
  buildGuardianConsoleUser,
  isGuardianConsoleCredentialMatch
} from './guardian.auth';
import type { MessageKind, RoomType } from '../social/social.types';

export async function guardianRoutes(app: FastifyInstance): Promise<void> {
  const guardianAuth = { preHandler: app.authenticateGuardian };

  app.post(
    '/auth/login',
    {
      schema: {
        tags: ['guardian'],
        summary: 'Login to Guardian Console with configured ID/password',
        body: {
          type: 'object',
          required: ['loginId', 'password'],
          properties: {
            loginId: { type: 'string', minLength: 1, maxLength: 100 },
            password: { type: 'string', minLength: 1, maxLength: 200 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { loginId: string; password: string };

      if (!isGuardianConsoleCredentialMatch(body.loginId, body.password)) {
        throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Guardian Console ID or password is incorrect.');
      }

      const accessToken = app.jwt.sign(buildGuardianConsoleJwtPayload(), {
        expiresIn: env.GUARDIAN_CONSOLE_ACCESS_TOKEN_TTL
      });

      return {
        success: true,
        data: {
          accessToken,
          tokenType: 'Bearer',
          expiresIn: env.GUARDIAN_CONSOLE_ACCESS_TOKEN_TTL,
          user: buildGuardianConsoleUser()
        }
      };
    }
  );

  app.get(
    '/auth/me',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Get the current Guardian Console user'
      }
    },
    async () => {
      return { success: true, data: buildGuardianConsoleUser() };
    }
  );

  app.get(
    '/summary',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Get Guardian Console dashboard summary'
      }
    },
    async (request) => {
      const data = await app.guardianService.getSummary(request.user.sub);
      return { success: true, data };
    }
  );

  app.get(
    '/users',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'List users for Guardian Console',
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 100 },
            role: { type: 'string', enum: ['parent', 'user'] },
            limit: { type: 'number', minimum: 1, maximum: 200 }
          }
        }
      }
    },
    async (request) => {
      const query = (request.query as { q?: string; role?: 'parent' | 'user'; limit?: number } | undefined) ?? {};
      const data = await app.guardianService.listUsers(request.user.sub, query);
      return { success: true, data };
    }
  );

  app.patch(
    '/users/:userId',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Update user profile metadata and role',
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['parent', 'user'] },
            displayName: { type: ['string', 'null'], minLength: 1, maxLength: 100 },
            statusMessage: { type: ['string', 'null'], minLength: 1, maxLength: 200 },
            phoneE164: { type: ['string', 'null'], minLength: 8, maxLength: 20 },
            locale: { type: ['string', 'null'], minLength: 2, maxLength: 16 }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { userId: string };
      const body =
        (request.body as {
          role?: 'parent' | 'user';
          displayName?: string | null;
          statusMessage?: string | null;
          phoneE164?: string | null;
          locale?: string | null;
        } | undefined) ?? {};

      const data = await app.guardianService.updateUser(request.user.sub, params.userId, body);
      return { success: true, data };
    }
  );

  app.post(
    '/users/:userId/revoke-sessions',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Revoke all refresh sessions for a user',
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { userId: string };
      const data = await app.guardianService.revokeUserSessions(request.user.sub, params.userId);
      return { success: true, data };
    }
  );

  app.get(
    '/users/:userId/location',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Get latest shared location for one user',
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { userId: string };
      const data = await app.guardianService.getUserLocation(request.user.sub, params.userId);
      return { success: true, data };
    }
  );

  app.post(
    '/users/:userId/location/refresh',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Request one-time precise location refresh for one user',
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { userId: string };
      const data = await app.guardianService.requestUserLocationRefresh(request.user.sub, params.userId);
      return { success: true, data };
    }
  );

  app.get(
    '/family-links',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'List active parent-child links'
      }
    },
    async (request) => {
      const data = await app.guardianService.listFamilyLinks(request.user.sub);
      return { success: true, data };
    }
  );

  app.get(
    '/rooms',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'List rooms for Guardian Console',
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['direct', 'group', 'family'] },
            memberUserId: { type: 'string', format: 'uuid' },
            q: { type: 'string', minLength: 1, maxLength: 100 },
            limit: { type: 'number', minimum: 1, maximum: 120 }
          }
        }
      }
    },
    async (request) => {
      const query =
        (request.query as { type?: RoomType; memberUserId?: string; q?: string; limit?: number } | undefined) ?? {};
      const data = await app.guardianService.listRooms(request.user.sub, query);
      return { success: true, data };
    }
  );

  app.get(
    '/rooms/:roomId/messages',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'List room messages for Guardian Console',
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
            before: { type: 'string', format: 'date-time' },
            q: { type: 'string', minLength: 1, maxLength: 100 },
            limit: { type: 'number', minimum: 1, maximum: 200 }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const query = (request.query as { before?: string; q?: string; limit?: number } | undefined) ?? {};
      const data = await app.guardianService.listRoomMessages(request.user.sub, {
        roomId: params.roomId,
        before: query.before,
        q: query.q,
        limit: query.limit
      });
      return { success: true, data };
    }
  );

  app.delete(
    '/messages/:messageId',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Delete one message',
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
      const data = await app.guardianService.deleteMessage(request.user.sub, params.messageId);
      return { success: true, data };
    }
  );

  app.post(
    '/messages/bulk-delete',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Preview or bulk delete matching messages',
        body: {
          type: 'object',
          properties: {
            searchText: { type: 'string', minLength: 1, maxLength: 200 },
            roomId: { type: 'string', format: 'uuid' },
            senderId: { type: 'string', format: 'uuid' },
            before: { type: 'string', format: 'date-time' },
            kinds: {
              type: 'array',
              items: { type: 'string', enum: ['text', 'image', 'video', 'system'] }
            },
            limit: { type: 'number', minimum: 1, maximum: 500 },
            dryRun: { type: 'boolean', default: true }
          }
        }
      }
    },
    async (request) => {
      const body =
        (request.body as {
          searchText?: string;
          roomId?: string;
          senderId?: string;
          before?: string;
          kinds?: MessageKind[];
          limit?: number;
          dryRun?: boolean;
        } | undefined) ?? {};

      const data = await app.guardianService.bulkDeleteMessages(request.user.sub, body);
      return { success: true, data };
    }
  );

  app.get(
    '/storage',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Get Guardian Console storage overview'
      }
    },
    async (request) => {
      const data = await app.guardianService.getStorageOverview(request.user.sub);
      return { success: true, data };
    }
  );

  app.get(
    '/storage/assets',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'List media assets for storage management',
        querystring: {
          type: 'object',
          properties: {
            ownerUserId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
            unreferencedOnly: { type: 'boolean' },
            limit: { type: 'number', minimum: 1, maximum: 200 }
          }
        }
      }
    },
    async (request) => {
      const query =
        (request.query as {
          ownerUserId?: string;
          status?: 'pending' | 'completed' | 'failed';
          unreferencedOnly?: boolean;
          limit?: number;
        } | undefined) ?? {};

      const data = await app.guardianService.listStorageAssets(request.user.sub, query);
      return { success: true, data };
    }
  );

  app.delete(
    '/storage/assets/:assetId',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Delete one media asset when no room message references remain',
        params: {
          type: 'object',
          required: ['assetId'],
          properties: {
            assetId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            forceAvatarDetach: { type: 'boolean', default: false }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { assetId: string };
      const query = (request.query as { forceAvatarDetach?: boolean } | undefined) ?? {};
      const data = await app.guardianService.deleteStorageAsset(
        request.user.sub,
        params.assetId,
        query.forceAvatarDetach ?? false
      );
      return { success: true, data };
    }
  );

  app.post(
    '/storage/cleanup-orphans',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Delete storage files that are not tracked by media_assets'
      }
    },
    async (request) => {
      const data = await app.guardianService.cleanupOrphanFiles(request.user.sub);
      return { success: true, data };
    }
  );
}
