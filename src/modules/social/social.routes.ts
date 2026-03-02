import type { FastifyInstance } from 'fastify';
import type { MessageKind } from './social.types';

export async function socialRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Get current user profile'
      }
    },
    async (request) => {
      const data = await app.socialService.getMeProfile(request.user.sub);
      return { success: true, data };
    }
  );

  app.patch(
    '/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Update current user profile',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            status: { type: 'string', minLength: 1, maxLength: 200 },
            avatarUri: { type: 'string', maxLength: 1024 }
          }
        }
      }
    },
    async (request) => {
      const body = (request.body as { name?: string; status?: string; avatarUri?: string } | undefined) ?? {};
      const data = await app.socialService.updateMeProfile(request.user.sub, body);
      return { success: true, data };
    }
  );

  app.post(
    '/me/avatar/upload-url',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Issue avatar upload URL',
        body: {
          type: 'object',
          required: ['mimeType', 'size'],
          properties: {
            mimeType: { type: 'string', minLength: 1, maxLength: 100 },
            size: { type: 'number', minimum: 1, maximum: 52428800 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { mimeType: string; size: number };
      const data = await app.socialService.issueAvatarUploadUrl(request.user.sub, body);
      return { success: true, data };
    }
  );

  app.get(
    '/friends',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List friends',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100 },
            cursor: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const query = (request.query as { limit?: number; cursor?: string } | undefined) ?? {};
      const data = await app.socialService.listFriends({
        userId: request.user.sub,
        limit: query.limit,
        cursor: query.cursor
      });
      return { success: true, data };
    }
  );

  app.get(
    '/friends/search',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Search users for friend',
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 100 },
            limit: { type: 'number', minimum: 1, maximum: 50 }
          }
        }
      }
    },
    async (request) => {
      const query = request.query as { q: string; limit?: number };
      const data = await app.socialService.searchUsersForFriend({
        userId: request.user.sub,
        q: query.q,
        limit: query.limit
      });
      return { success: true, data };
    }
  );

  app.get(
    '/friends/requests',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List incoming/outgoing friend requests'
      }
    },
    async (request) => {
      const data = await app.socialService.listFriendRequests(request.user.sub);
      return { success: true, data };
    }
  );

  app.post(
    '/friends/requests',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Create friend request',
        body: {
          type: 'object',
          required: ['targetUserId'],
          properties: {
            targetUserId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { targetUserId: string };
      const data = await app.socialService.createFriendRequest(request.user.sub, body.targetUserId);
      return { success: true, data };
    }
  );

  app.post(
    '/friends/requests/:requestId/accept',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Accept friend request',
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
      const data = await app.socialService.acceptFriendRequest(request.user.sub, params.requestId);
      return { success: true, data };
    }
  );

  app.post(
    '/friends/requests/:requestId/reject',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Reject friend request',
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
      const data = await app.socialService.rejectFriendRequest(request.user.sub, params.requestId);
      return { success: true, data };
    }
  );

  app.patch(
    '/friends/:friendUserId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Update friend flags',
        params: {
          type: 'object',
          required: ['friendUserId'],
          properties: {
            friendUserId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['trusted'],
          properties: {
            trusted: { type: 'boolean' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { friendUserId: string };
      const body = request.body as { trusted: boolean };
      const data = await app.socialService.setFriendTrusted(request.user.sub, params.friendUserId, body.trusted);
      return { success: true, data };
    }
  );

  app.delete(
    '/friends/:friendUserId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Remove friend',
        params: {
          type: 'object',
          required: ['friendUserId'],
          properties: {
            friendUserId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { friendUserId: string };
      const data = await app.socialService.removeFriend(request.user.sub, params.friendUserId);
      return { success: true, data };
    }
  );

  app.get(
    '/rooms',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List rooms',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100 },
            cursor: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const query = (request.query as { limit?: number; cursor?: string } | undefined) ?? {};
      const data = await app.socialService.listRooms({
        userId: request.user.sub,
        limit: query.limit,
        cursor: query.cursor
      });
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/direct',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Create or get direct room',
        body: {
          type: 'object',
          required: ['friendUserId'],
          properties: {
            friendUserId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { friendUserId: string };
      const data = await app.socialService.createOrGetDirectRoom(request.user.sub, body.friendUserId);
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/group',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Create group room',
        body: {
          type: 'object',
          required: ['title', 'memberUserIds'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 100 },
            memberUserIds: {
              type: 'array',
              minItems: 1,
              items: { type: 'string', format: 'uuid' }
            }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { title: string; memberUserIds: string[] };
      const data = await app.socialService.createGroupRoom(request.user.sub, body);
      return { success: true, data };
    }
  );

  app.patch(
    '/rooms/:roomId/settings',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Update room settings',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            favorite: { type: 'boolean' },
            muted: { type: 'boolean' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const body = (request.body as { favorite?: boolean; muted?: boolean } | undefined) ?? {};
      const data = await app.socialService.updateRoomSettings(request.user.sub, params.roomId, body);
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/leave',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Leave group room',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const data = await app.socialService.leaveRoom(request.user.sub, params.roomId);
      return { success: true, data };
    }
  );

  app.delete(
    '/rooms/:roomId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Delete room or hide direct room',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const data = await app.socialService.deleteRoom(request.user.sub, params.roomId);
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/report',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Create abuse report for room/message',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 2, maxLength: 1000 },
            messageId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const body = request.body as { reason: string; messageId?: string };
      const data = await app.socialService.createRoomReport(request.user.sub, params.roomId, body);
      return { success: true, data };
    }
  );

  app.get(
    '/rooms/:roomId/messages',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List room messages',
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
            limit: { type: 'number', minimum: 1, maximum: 100 },
            cursor: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const query = (request.query as { limit?: number; cursor?: string } | undefined) ?? {};
      const data = await app.socialService.listRoomMessages({
        userId: request.user.sub,
        roomId: params.roomId,
        limit: query.limit,
        cursor: query.cursor
      });
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/messages',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Send room message',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['kind'],
          properties: {
            clientMessageId: { type: 'string', minLength: 1, maxLength: 128 },
            kind: { type: 'string', enum: ['text', 'image', 'video', 'system'] },
            text: { type: 'string', minLength: 1, maxLength: 5000 },
            uri: { type: 'string', maxLength: 2048 }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const body = request.body as {
        clientMessageId?: string;
        kind: MessageKind;
        text?: string;
        uri?: string;
      };
      const data = await app.socialService.sendRoomMessage({
        userId: request.user.sub,
        roomId: params.roomId,
        clientMessageId: body.clientMessageId,
        kind: body.kind,
        text: body.text,
        uri: body.uri
      });
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/read',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Mark room as read',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            lastReadMessageId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const body = (request.body as { lastReadMessageId?: string } | undefined) ?? {};
      const data = await app.socialService.markRoomRead({
        userId: request.user.sub,
        roomId: params.roomId,
        lastReadMessageId: body.lastReadMessageId
      });
      return { success: true, data };
    }
  );

  app.post(
    '/media/upload-url',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Issue media upload URL',
        body: {
          type: 'object',
          required: ['kind', 'mimeType', 'size'],
          properties: {
            kind: { type: 'string', enum: ['image', 'video', 'avatar'] },
            mimeType: { type: 'string', minLength: 1, maxLength: 100 },
            size: { type: 'number', minimum: 1, maximum: 52428800 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { kind: 'image' | 'video' | 'avatar'; mimeType: string; size: number };
      const data = await app.socialService.issueMediaUploadUrl(request.user.sub, body);
      return { success: true, data };
    }
  );

  app.post(
    '/media/complete',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Complete media upload',
        body: {
          type: 'object',
          required: ['fileUrl', 'kind'],
          properties: {
            fileUrl: { type: 'string', maxLength: 2048 },
            kind: { type: 'string', enum: ['image', 'video', 'avatar'] }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { fileUrl: string; kind: 'image' | 'video' | 'avatar' };
      const data = await app.socialService.completeMediaUpload(request.user.sub, body);
      return { success: true, data };
    }
  );

  app.post(
    '/push-tokens',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Register push token',
        body: {
          type: 'object',
          required: ['platform', 'pushToken'],
          properties: {
            platform: { type: 'string', enum: ['android', 'ios', 'web'] },
            pushToken: { type: 'string', minLength: 8, maxLength: 4096 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { platform: 'android' | 'ios' | 'web'; pushToken: string };
      const data = await app.socialService.registerPushToken({
        userId: request.user.sub,
        platform: body.platform,
        pushToken: body.pushToken
      });
      return { success: true, data };
    }
  );

  app.delete(
    '/push-tokens',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Remove push token',
        body: {
          type: 'object',
          required: ['pushToken'],
          properties: {
            pushToken: { type: 'string', minLength: 8, maxLength: 4096 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { pushToken: string };
      const data = await app.socialService.removePushToken({
        userId: request.user.sub,
        pushToken: body.pushToken
      });
      return { success: true, data };
    }
  );

  app.get(
    '/admin/reports',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List report queue (parent role)',
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['open', 'reviewed', 'closed'] },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            cursor: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const query = (request.query as {
        status?: 'open' | 'reviewed' | 'closed';
        limit?: number;
        cursor?: string;
      } | undefined) ?? { };
      const data = await app.socialService.listReports({
        userId: request.user.sub,
        status: query.status,
        limit: query.limit,
        cursor: query.cursor
      });
      return { success: true, data };
    }
  );

  app.patch(
    '/admin/reports/:reportId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Update report status (parent role)',
        params: {
          type: 'object',
          required: ['reportId'],
          properties: {
            reportId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['reviewed', 'closed'] }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { reportId: string };
      const body = request.body as { status: 'reviewed' | 'closed' };
      const data = await app.socialService.updateReportStatus(request.user.sub, params.reportId, body.status);
      return { success: true, data };
    }
  );
}
