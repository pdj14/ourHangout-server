import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { ClawBridgeService } from '../openclaw/claw-bridge.service';
import type { ConnectionManager } from './connection-manager';
import type { RedisChatEventBus } from './redis-event-bus';
import type { AckStatus, ChatEvent, ChatMessage, ChatRoom, ChatRoomSummary, MessageDirection } from './chat.types';

type ChatRoomRow = {
  id: string;
  pair_key: string;
  user_a_id: string;
  user_b_id: string;
  created_at: Date;
};

type ChatMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  direction: MessageDirection;
  ack_status: AckStatus;
  claw_message_id: string | null;
  created_at: Date;
  delivered_at: Date | null;
};

type ChatServiceDeps = {
  db: Pool;
  eventBus: RedisChatEventBus;
  connectionManager: ConnectionManager;
  clawBridge: ClawBridgeService;
  logger: FastifyBaseLogger;
};

export class ChatService {
  private readonly db: Pool;
  private readonly eventBus: RedisChatEventBus;
  private readonly connectionManager: ConnectionManager;
  private readonly clawBridge: ClawBridgeService;
  private readonly logger: FastifyBaseLogger;

  constructor(deps: ChatServiceDeps) {
    this.db = deps.db;
    this.eventBus = deps.eventBus;
    this.connectionManager = deps.connectionManager;
    this.clawBridge = deps.clawBridge;
    this.logger = deps.logger;
  }

  async createDirectRoom(userId: string, peerUserId: string): Promise<ChatRoom> {
    if (userId === peerUserId) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Cannot create a direct room with yourself.');
    }

    const peerResult = await this.db.query<{ id: string }>('SELECT id FROM users WHERE id = $1 LIMIT 1', [peerUserId]);
    if (!peerResult.rows[0]) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Peer user not found.');
    }

    const [userAId, userBId] = [userId, peerUserId].sort();
    const pairKey = `${userAId}:${userBId}`;

    const roomResult = await this.db.query<ChatRoomRow>(
      `INSERT INTO chat_rooms (pair_key, user_a_id, user_b_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (pair_key) DO UPDATE SET pair_key = EXCLUDED.pair_key
       RETURNING id, pair_key, user_a_id, user_b_id, created_at`,
      [pairKey, userAId, userBId]
    );

    return this.mapRoom(roomResult.rows[0]);
  }

  async listRooms(userId: string): Promise<ChatRoomSummary[]> {
    const result = await this.db.query<
      ChatRoomRow & {
        last_message_content: string | null;
        last_message_ack_status: AckStatus | null;
        last_message_created_at: Date | null;
      }
    >(
      `SELECT r.id,
              r.pair_key,
              r.user_a_id,
              r.user_b_id,
              r.created_at,
              lm.content AS last_message_content,
              lm.ack_status AS last_message_ack_status,
              lm.created_at AS last_message_created_at
       FROM chat_rooms r
       LEFT JOIN LATERAL (
         SELECT content, ack_status, created_at
         FROM messages m
         WHERE m.room_id = r.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) lm ON TRUE
       WHERE r.user_a_id = $1 OR r.user_b_id = $1
       ORDER BY COALESCE(lm.created_at, r.created_at) DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      ...this.mapRoom(row),
      peerUserId: row.user_a_id === userId ? row.user_b_id : row.user_a_id,
      ...(row.last_message_content
        ? {
            lastMessage: {
              content: row.last_message_content,
              ackStatus: row.last_message_ack_status ?? 'sent',
              createdAt: row.last_message_created_at?.toISOString() ?? new Date().toISOString()
            }
          }
        : {})
    }));
  }

  async listMessages(params: {
    userId: string;
    roomId: string;
    limit: number;
    before?: string;
  }): Promise<ChatMessage[]> {
    await this.assertRoomMembership(params.roomId, params.userId);

    const values: unknown[] = [params.roomId];
    let whereClause = 'WHERE room_id = $1';

    if (params.before) {
      values.push(new Date(params.before));
      whereClause += ` AND created_at < $${values.length}`;
    }

    values.push(params.limit);

    const result = await this.db.query<ChatMessageRow>(
      `SELECT id, room_id, sender_id, recipient_id, content, direction, ack_status, claw_message_id, created_at, delivered_at
       FROM messages
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${values.length}`,
      values
    );

    return result.rows.reverse().map((row) => this.mapMessage(row));
  }

  async sendMessage(params: { roomId: string; senderId: string; content: string }): Promise<ChatMessage> {
    const room = await this.assertRoomMembership(params.roomId, params.senderId);
    const recipientId = room.user_a_id === params.senderId ? room.user_b_id : room.user_a_id;

    const insertResult = await this.db.query<ChatMessageRow>(
      `INSERT INTO messages (room_id, sender_id, recipient_id, content, direction, ack_status)
       VALUES ($1, $2, $3, $4, 'outbound', 'sent')
       RETURNING id, room_id, sender_id, recipient_id, content, direction, ack_status, claw_message_id, created_at, delivered_at`,
      [params.roomId, params.senderId, recipientId, params.content]
    );

    const message = this.mapMessage(insertResult.rows[0]);
    await this.publishNewMessage(message, [params.senderId, recipientId]);

    void this.forwardToClaw(message).catch((error) => {
      this.logger.error(
        {
          error,
          messageId: message.id,
          provider: this.clawBridge.getProviderName()
        },
        'Failed to forward outbound message to OpenClaw bridge'
      );
    });

    return message;
  }

  async ackMessageByRecipient(messageId: string, recipientId: string): Promise<void> {
    const updateResult = await this.db.query<
      ChatMessageRow & {
        updated_at: Date;
      }
    >(
      `UPDATE messages
       SET ack_status = 'delivered',
           delivered_at = NOW()
       WHERE id = $1
         AND recipient_id = $2
         AND ack_status = 'sent'
       RETURNING id, room_id, sender_id, recipient_id, content, direction, ack_status, claw_message_id, created_at, delivered_at, NOW() AS updated_at`,
      [messageId, recipientId]
    );

    const updated = updateResult.rows[0];
    if (!updated) {
      return;
    }

    await this.publishAck(updated.id, updated.room_id, updated.sender_id, updated.recipient_id, updated.updated_at);
  }

  async handleEvent(event: ChatEvent): Promise<void> {
    if (event.type === 'message.new') {
      const sent = this.connectionManager.sendToUser(event.targetUserId, {
        type: 'chat.message',
        data: event.message
      });

      if (sent && event.targetUserId === event.message.recipientId && event.message.ackStatus === 'sent') {
        await this.ackMessageByRecipient(event.message.id, event.targetUserId);
      }

      return;
    }

    if (event.type === 'message.ack') {
      this.connectionManager.sendToUser(event.targetUserId, {
        type: 'chat.ack',
        data: event.data
      });
    }
  }

  private async forwardToClaw(message: ChatMessage): Promise<void> {
    const response = await this.clawBridge.forwardMessage({
      messageId: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content
    });

    if (!response.replyText) {
      return;
    }

    const inboundInsert = await this.db.query<ChatMessageRow>(
      `INSERT INTO messages (room_id, sender_id, recipient_id, content, direction, ack_status, claw_message_id)
       VALUES ($1, $2, $3, $4, 'inbound', 'sent', $5)
       RETURNING id, room_id, sender_id, recipient_id, content, direction, ack_status, claw_message_id, created_at, delivered_at`,
      [message.roomId, message.recipientId, message.senderId, response.replyText, response.providerMessageId ?? null]
    );

    const inbound = this.mapMessage(inboundInsert.rows[0]);
    await this.publishNewMessage(inbound, [inbound.senderId, inbound.recipientId]);
  }

  private async assertRoomMembership(roomId: string, userId: string): Promise<ChatRoomRow> {
    const result = await this.db.query<ChatRoomRow>(
      `SELECT id, pair_key, user_a_id, user_b_id, created_at
       FROM chat_rooms
       WHERE id = $1
         AND (user_a_id = $2 OR user_b_id = $2)
       LIMIT 1`,
      [roomId, userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'You are not a member of this room.');
    }

    return row;
  }

  private mapRoom(row: ChatRoomRow): ChatRoom {
    return {
      id: row.id,
      userAId: row.user_a_id,
      userBId: row.user_b_id,
      createdAt: row.created_at.toISOString()
    };
  }

  private mapMessage(row: ChatMessageRow): ChatMessage {
    return {
      id: row.id,
      roomId: row.room_id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      content: row.content,
      direction: row.direction,
      ackStatus: row.ack_status,
      createdAt: row.created_at.toISOString(),
      ...(row.delivered_at ? { deliveredAt: row.delivered_at.toISOString() } : {}),
      ...(row.claw_message_id ? { clawMessageId: row.claw_message_id } : {})
    };
  }

  private async publishNewMessage(message: ChatMessage, participants: string[]): Promise<void> {
    await Promise.all(
      participants.map((targetUserId) =>
        this.eventBus.publish({
          type: 'message.new',
          targetUserId,
          message
        })
      )
    );
  }

  private async publishAck(
    messageId: string,
    roomId: string,
    senderId: string,
    recipientId: string,
    updatedAt: Date
  ): Promise<void> {
    const data = {
      messageId,
      roomId,
      ackStatus: 'delivered' as const,
      updatedAt: updatedAt.toISOString()
    };

    await Promise.all([
      this.eventBus.publish({
        type: 'message.ack',
        targetUserId: senderId,
        data
      }),
      this.eventBus.publish({
        type: 'message.ack',
        targetUserId: recipientId,
        data
      })
    ]);
  }
}
