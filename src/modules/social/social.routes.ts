import { createReadStream } from 'fs';
import type { FastifyInstance } from 'fastify';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { MessageKind } from './social.types';

const MAX_MEDIA_UPLOAD_BYTES = 200 * 1024 * 1024;

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
            status: { type: 'string', maxLength: 200 },
            avatarUri: { type: 'string', maxLength: 1024 },
            locale: { type: 'string', minLength: 2, maxLength: 16 },
            locationSharingEnabled: { type: 'boolean' }
          }
        }
      }
    },
    async (request) => {
      const body = (request.body as {
        name?: string;
        status?: string;
        avatarUri?: string;
        locale?: string;
        locationSharingEnabled?: boolean;
      } | undefined) ?? {};
      const data = await app.socialService.updateMeProfile(request.user.sub, body);
      return { success: true, data };
    }
  );

  app.post(
    '/me/location',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Update latest shared location for current user',
        body: {
          type: 'object',
          required: ['latitude', 'longitude', 'source'],
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            accuracyM: { type: 'number', minimum: 0 },
            capturedAt: { type: 'string' },
            source: { type: 'string', enum: ['heartbeat', 'precision_refresh', 'manual_refresh'] }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as {
        latitude: number;
        longitude: number;
        accuracyM?: number;
        capturedAt?: string;
        source: 'heartbeat' | 'precision_refresh' | 'manual_refresh';
      };
      const data = await app.socialService.updateMyLocation({
        userId: request.user.sub,
        latitude: body.latitude,
        longitude: body.longitude,
        accuracyM: body.accuracyM,
        capturedAt: body.capturedAt,
        source: body.source
      });
      return { success: true, data };
    }
  );

  app.get(
    '/me/location/refresh-request',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Get current pending precise location refresh request'
      }
    },
    async (request) => {
      const data = await app.socialService.getMyLocationRefreshRequest(request.user.sub);
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
            size: { type: 'number', minimum: 1, maximum: MAX_MEDIA_UPLOAD_BYTES }
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

  app.patch(
    '/friends/:friendUserId/alias',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Set or clear a personal alias for a friend',
        params: {
          type: 'object',
          required: ['friendUserId'],
          properties: {
            friendUserId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            alias: { type: ['string', 'null'], minLength: 1, maxLength: 100 }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { friendUserId: string };
      const body = (request.body as { alias?: string | null } | undefined) ?? {};
      const data = await app.socialService.setFriendAlias(request.user.sub, params.friendUserId, body.alias);
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
            type: { type: 'string', enum: ['direct', 'group', 'family'] },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            cursor: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const query = (request.query as { type?: 'direct' | 'group' | 'family'; limit?: number; cursor?: string } | undefined) ?? {};
      const data = await app.socialService.listRooms({
        userId: request.user.sub,
        type: query.type,
        limit: query.limit,
        cursor: query.cursor
      });
      return { success: true, data };
    }
  );

  app.post(
    '/rooms',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Create shared room',
        body: {
          type: 'object',
          required: ['type', 'title', 'memberUserIds'],
          properties: {
            type: { type: 'string', enum: ['group', 'family'] },
            title: { type: 'string', minLength: 1, maxLength: 100 },
            memberUserIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' }
            }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { type: 'group' | 'family'; title: string; memberUserIds: string[] };
      const data = await app.socialService.createRoom(request.user.sub, body);
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

  app.post(
    '/rooms/family',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Create family room',
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
      const data = await app.socialService.createFamilyRoom(request.user.sub, body);
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
            muted: { type: 'boolean' },
            title: { type: 'string', minLength: 1, maxLength: 100 }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const body = (request.body as { favorite?: boolean; muted?: boolean; title?: string } | undefined) ?? {};
      const data = await app.socialService.updateRoomSettings(request.user.sub, params.roomId, body);
      return { success: true, data };
    }
  );

  app.get(
    '/rooms/:roomId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Get room detail',
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
      const data = await app.socialService.getRoomByIdForUser(request.user.sub, params.roomId);
      return { success: true, data };
    }
  );

  app.get(
    '/rooms/:roomId/members',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List shared room members and management permissions',
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
      const data = await app.socialService.listRoomMembers({
        userId: request.user.sub,
        roomId: params.roomId
      });
      return { success: true, data };
    }
  );

  app.get(
    '/room-invitations',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List pending incoming/outgoing shared room invitations'
      }
    },
    async (request) => {
      const data = await app.socialService.listRoomInvitations(request.user.sub);
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/invitations',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Create a shared room invitation',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
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
      const params = request.params as { roomId: string };
      const body = request.body as { targetUserId: string };
      const data = await app.socialService.createRoomInvitation({
        userId: request.user.sub,
        roomId: params.roomId,
        targetUserId: body.targetUserId
      });
      return { success: true, data };
    }
  );

  app.post(
    '/room-invitations/:invitationId/accept',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Accept a shared room invitation',
        params: {
          type: 'object',
          required: ['invitationId'],
          properties: {
            invitationId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { invitationId: string };
      const data = await app.socialService.acceptRoomInvitation({
        userId: request.user.sub,
        invitationId: params.invitationId
      });
      return { success: true, data };
    }
  );

  app.post(
    '/room-invitations/:invitationId/reject',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Reject a shared room invitation',
        params: {
          type: 'object',
          required: ['invitationId'],
          properties: {
            invitationId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { invitationId: string };
      const data = await app.socialService.rejectRoomInvitation({
        userId: request.user.sub,
        invitationId: params.invitationId
      });
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/transfer-ownership',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Transfer shared room ownership',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
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
      const params = request.params as { roomId: string };
      const body = request.body as { targetUserId: string };
      const data = await app.socialService.transferRoomOwnership({
        userId: request.user.sub,
        roomId: params.roomId,
        targetUserId: body.targetUserId
      });
      return { success: true, data };
    }
  );

  app.patch(
    '/rooms/:roomId/members/:targetUserId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Update shared room member role',
        params: {
          type: 'object',
          required: ['roomId', 'targetUserId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' },
            targetUserId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['admin', 'member'] }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string; targetUserId: string };
      const body = request.body as { role: 'admin' | 'member' };
      const data = await app.socialService.updateRoomMemberRole({
        userId: request.user.sub,
        roomId: params.roomId,
        targetUserId: params.targetUserId,
        role: body.role
      });
      return { success: true, data };
    }
  );

  app.delete(
    '/rooms/:roomId/members/:targetUserId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Remove a shared room member',
        params: {
          type: 'object',
          required: ['roomId', 'targetUserId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' },
            targetUserId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string; targetUserId: string };
      const data = await app.socialService.kickRoomMember({
        userId: request.user.sub,
        roomId: params.roomId,
        targetUserId: params.targetUserId
      });
      return { success: true, data };
    }
  );

  app.get(
    '/rooms/:roomId/member-profiles',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List family room member profiles',
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
      const data = await app.socialService.listFamilyRoomMemberProfiles({
        userId: request.user.sub,
        roomId: params.roomId
      });
      return { success: true, data };
    }
  );

  app.patch(
    '/rooms/:roomId/member-profiles/:targetUserId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Update family room member alias',
        params: {
          type: 'object',
          required: ['roomId', 'targetUserId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' },
            targetUserId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            alias: { type: ['string', 'null'], minLength: 1, maxLength: 100 }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string; targetUserId: string };
      const body = (request.body as { alias?: string | null } | undefined) ?? {};
      const data = await app.socialService.updateFamilyRoomMemberProfile({
        userId: request.user.sub,
        roomId: params.roomId,
        targetUserId: params.targetUserId,
        alias: body.alias
      });
      return { success: true, data };
    }
  );

  app.get(
    '/rooms/:roomId/relationships',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List family room guardian-child relationships',
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
      const data = await app.socialService.listFamilyRoomRelationships({
        userId: request.user.sub,
        roomId: params.roomId
      });
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/relationships',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Create family room guardian-child relationship',
        params: {
          type: 'object',
          required: ['roomId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['targetUserId', 'as'],
          properties: {
            targetUserId: { type: 'string', format: 'uuid' },
            as: { type: 'string', enum: ['guardian', 'child'] }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string };
      const body = request.body as { targetUserId: string; as: 'guardian' | 'child' };
      const data = await app.socialService.createFamilyRoomRelationship({
        userId: request.user.sub,
        roomId: params.roomId,
        targetUserId: body.targetUserId,
        as: body.as
      });
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/relationships/:relationshipId/respond',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Respond to a pending family room guardian-child request',
        params: {
          type: 'object',
          required: ['roomId', 'relationshipId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' },
            relationshipId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['accept', 'reject'] }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string; relationshipId: string };
      const body = request.body as { decision: 'accept' | 'reject' };
      const data = await app.socialService.respondFamilyRoomRelationship({
        userId: request.user.sub,
        roomId: params.roomId,
        relationshipId: params.relationshipId,
        decision: body.decision
      });
      return { success: true, data };
    }
  );

  app.delete(
    '/rooms/:roomId/relationships/:relationshipId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Delete family room guardian-child relationship',
        params: {
          type: 'object',
          required: ['roomId', 'relationshipId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' },
            relationshipId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string; relationshipId: string };
      const data = await app.socialService.deleteFamilyRoomRelationship({
        userId: request.user.sub,
        roomId: params.roomId,
        relationshipId: params.relationshipId
      });
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

  app.get(
    '/rooms/:roomId/locations',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'List latest shared child locations visible to current guardian in a family room',
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
      const data = await app.socialService.listFamilyRoomLocations({
        userId: request.user.sub,
        roomId: params.roomId
      });
      return { success: true, data };
    }
  );

  app.post(
    '/rooms/:roomId/locations/:targetUserId/refresh',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['social'],
        summary: 'Request one-time precise location refresh for a visible child in family room',
        params: {
          type: 'object',
          required: ['roomId', 'targetUserId'],
          properties: {
            roomId: { type: 'string', format: 'uuid' },
            targetUserId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const params = request.params as { roomId: string; targetUserId: string };
      const data = await app.socialService.requestFamilyRoomLocationRefresh({
        userId: request.user.sub,
        roomId: params.roomId,
        targetUserId: params.targetUserId
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
            size: { type: 'number', minimum: 1, maximum: MAX_MEDIA_UPLOAD_BYTES }
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

  app.put(
    '/media/upload',
    {
      preHandler: app.authenticate,
      bodyLimit: MAX_MEDIA_UPLOAD_BYTES,
      schema: {
        tags: ['social'],
        summary: 'Upload media bytes to pending asset URL',
        querystring: {
          type: 'object',
          required: ['fileUrl'],
          properties: {
            fileUrl: { type: 'string', minLength: 1, maxLength: 2048 }
          }
        }
      }
    },
    async (request, reply) => {
      const query = request.query as { fileUrl: string };
      if (!Buffer.isBuffer(request.body)) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Binary request body is required.');
      }

      await app.socialService.storeUploadedMedia(request.user.sub, {
        fileUrl: query.fileUrl,
        bytes: request.body
      });

      reply.code(204);
      return reply.send();
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

  app.get(
    '/media/files/:year/:month/:fileName',
    {
      schema: {
        tags: ['social'],
        summary: 'Serve completed media file',
        params: {
          type: 'object',
          required: ['year', 'month', 'fileName'],
          properties: {
            year: { type: 'string', minLength: 4, maxLength: 4 },
            month: { type: 'string', minLength: 2, maxLength: 2 },
            fileName: { type: 'string', minLength: 1, maxLength: 255 }
          }
        }
      }
    },
    async (request, reply) => {
      const params = request.params as { year: string; month: string; fileName: string };
      const publicBaseUrl = app.socialService.getMediaPublicBaseUrl();
      const fileUrl = `${publicBaseUrl}/v1/media/files/${params.year}/${params.month}/${params.fileName}`;
      const asset = await app.socialService.getCompletedMediaDownload(fileUrl);

      reply.header('Content-Type', asset.mimeType);
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.header('Accept-Ranges', 'bytes');

      const rangeHeader = request.headers.range;
      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        if (!match) {
          reply.code(416);
          reply.header('Content-Range', `bytes */${asset.size}`);
          return reply.send();
        }

        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : asset.size - 1;
        const safeStart = Number.isFinite(start) ? start : 0;
        const safeEnd = Number.isFinite(end) ? Math.min(end, asset.size - 1) : asset.size - 1;

        if (safeStart < 0 || safeEnd < safeStart || safeStart >= asset.size) {
          reply.code(416);
          reply.header('Content-Range', `bytes */${asset.size}`);
          return reply.send();
        }

        reply.code(206);
        reply.header('Content-Range', `bytes ${safeStart}-${safeEnd}/${asset.size}`);
        reply.header('Content-Length', String(safeEnd - safeStart + 1));
        return reply.send(createReadStream(asset.path, { start: safeStart, end: safeEnd }));
      }

      reply.header('Content-Length', String(asset.size));
      return reply.send(createReadStream(asset.path));
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
